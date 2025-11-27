import { Worker } from "bullmq";
import redis from "../utils/redisClient";
import { getScraperResults } from "../utils/scrapper";
import { update_runner_scrapers } from "../repositories/adScrapperRepository";
import { bulk_upsert_data } from "../repositories/adCompetitorCreativesRepository";
import { logger } from "../utils/logger";
import { DbCompetitor } from "../types/dbSchemaTypes";
import { MetaAdResponse } from "../types/scrapperTypes";

const apicreaiveToDbCompetitor=(apiCreative:MetaAdResponse,run_id:string,organisation_id:string):DbCompetitor=>{
  if (!apiCreative.ad_archive_id && !apiCreative.ad_id){
    logger.error(`[Worker] Ad archive id is missing from API response for run_id: ${run_id}`);
    throw new Error('Cannot map API Ad to database schema: missing id field');
  }
  
  const now = new Date().toISOString();
  logger.debug(`[Worker] Mapping API response to DB format for run_id: ${run_id}`);
  
  // Extract image and video URLs from cards
  const resized_image_urls: string[] = [];
  const original_image_urls: string[] = [];
  const video_hd_urls: string[] = [];
  const video_sd_urls: string[] = [];
  
  if (apiCreative.snapshot?.cards && Array.isArray(apiCreative.snapshot.cards)) {
    logger.debug(`[Worker] Processing ${apiCreative.snapshot.cards.length} cards from snapshot for run_id: ${run_id}`);
    apiCreative.snapshot.cards.forEach((card, index) => {
      logger.debug(`[Worker] Processing card ${index + 1} for run_id: ${run_id}`);
      if (card.resized_image_url) {
        resized_image_urls.push(card.resized_image_url);
      }
      if (card.original_image_url) {
        original_image_urls.push(card.original_image_url);
      }
      if (card.video_hd_url) {
        video_hd_urls.push(card.video_hd_url);
      }
      if (card.video_sd_url) {
        video_sd_urls.push(card.video_sd_url);
      }
    });
    logger.info(`[Worker] Extracted media URLs for run_id ${run_id}: ${resized_image_urls.length} resized images, ${original_image_urls.length} original images, ${video_hd_urls.length} HD videos, ${video_sd_urls.length} SD videos`);
  } else {
    logger.warn(`[Worker] No cards found in snapshot for run_id: ${run_id}`);
    // Try to extract from other possible locations
    if (apiCreative.snapshot?.images && Array.isArray(apiCreative.snapshot.images)) {
      logger.debug(`[Worker] Trying to extract from images array (${apiCreative.snapshot.images.length} items) for run_id: ${run_id}`);
      apiCreative.snapshot.images.forEach((img, index) => {
        if (typeof img === 'string') {
          original_image_urls.push(img);
        } else if (img && typeof img === 'object') {
          if (img.resized_image_url) resized_image_urls.push(img.resized_image_url);
          if (img.original_image_url) original_image_urls.push(img.original_image_url);
        }
      });
    }
    
    if (apiCreative.snapshot?.videos && Array.isArray(apiCreative.snapshot.videos)) {
      logger.debug(`[Worker] Trying to extract from videos array (${apiCreative.snapshot.videos.length} items) for run_id: ${run_id}`);
      apiCreative.snapshot.videos.forEach((video, index) => {
        if (typeof video === 'string') {
          video_hd_urls.push(video);
        } else if (video && typeof video === 'object') {
          if (video.video_hd_url) video_hd_urls.push(video.video_hd_url);
          if (video.video_sd_url) video_sd_urls.push(video.video_sd_url);
        }
      });
    }
  }
  
  // Convert end_date timestamp to ISO string if it exists
  let end_date: string | undefined;
  let start_date: string | undefined;
  
  if (apiCreative.end_date && typeof apiCreative.end_date === 'number') {
    end_date = new Date(apiCreative.end_date * 1000).toISOString();
    logger.debug(`[Worker] Converted end_date timestamp ${apiCreative.end_date} to ${end_date} for run_id: ${run_id}`);
  }
  
  if (apiCreative.start_date && typeof apiCreative.start_date === 'number') {
    start_date = new Date(apiCreative.start_date * 1000).toISOString();
    logger.debug(`[Worker] Converted start_date timestamp ${apiCreative.start_date} to ${start_date} for run_id: ${run_id}`);
  }
  
  const dbRecord = {
    run_id: run_id,
    organisation_id: organisation_id,
    ad_archive_id: apiCreative.ad_archive_id || apiCreative.ad_id || '',
    page_id: apiCreative.page_id || apiCreative.snapshot?.page_id || '',
    page_name: apiCreative.page_name || apiCreative.snapshot?.page_name,
    is_active: apiCreative.is_active,
    page_profile_picture_url: apiCreative.page_profile_picture_url || apiCreative.snapshot?.page_profile_picture_url,
    title: apiCreative.title || apiCreative.snapshot?.title,
    body: apiCreative.body || apiCreative.snapshot?.body?.text,
    link_url: apiCreative.link_url || apiCreative.snapshot?.link_url,
    caption: apiCreative.caption || apiCreative.snapshot?.caption,
    cta_text: apiCreative.cta_text || apiCreative.snapshot?.cta_text,
    display_format: apiCreative.display_format || apiCreative.snapshot?.display_format,
    
    // New fields for multiple images/videos
    resized_image_urls: resized_image_urls.length > 0 ? resized_image_urls : undefined,
    original_image_urls: original_image_urls.length > 0 ? original_image_urls : undefined,
    video_hd_urls: video_hd_urls.length > 0 ? video_hd_urls : undefined,
    video_sd_urls: video_sd_urls.length > 0 ? video_sd_urls : undefined,
    
    // Legacy field for backward compatibility
    image_urls: apiCreative.image_urls || (original_image_urls.length > 0 ? original_image_urls : undefined),
    
    // Add publisher platforms
    publisher_platforms: apiCreative.publisher_platform || undefined,
    
    start_date: start_date,
    end_date: end_date,
    raw_data: apiCreative.snapshot,
    created_at: now,
    updated_at: now
  };
  
  logger.info(`[Worker] Successfully mapped API response to DB record for run_id: ${run_id}, ad_archive_id: ${dbRecord.ad_archive_id}`);
  return dbRecord;
}

const worker = new Worker(
  'scraperQueue',
  async job => {
    const startTime = Date.now();
    const { run_id, organisation_id } = job.data;
    
    logger.info(`[Worker] 🚀 Starting job ${job.id} - Processing run_id: ${run_id}, organisation_id: ${organisation_id}`);
    logger.info(`[Worker] Job details - ID: ${job.id}, Attempts: ${job.attemptsMade + 1}/${job.opts.attempts || 1}`);

    let attempts = 0;
    let result: MetaAdResponse[] | null = null;
    const maxAttempts = 15;
    const delayMs = 5000;

    logger.info(`[Worker] 🔄 Starting scraper result polling for run_id: ${run_id} (max attempts: ${maxAttempts}, delay: ${delayMs}ms)`);

    // Retry scraper result polling up to 15 times with 5s delay
    while (attempts < maxAttempts && !result) {
      attempts++;
      logger.info(`[Worker] 📡 Polling attempt ${attempts}/${maxAttempts} for run_id: ${run_id}`);
      
      const attemptStartTime = Date.now();
      
      if (attempts > 1) {
        logger.info(`[Worker] ⏳ Waiting ${delayMs}ms before attempt ${attempts} for run_id: ${run_id}`);
        await new Promise(r => setTimeout(r, delayMs));
      }

      try {
        result = await getScraperResults(run_id);
        const attemptDuration = Date.now() - attemptStartTime;
        
        if (result) {
          logger.info(`[Worker] ✅ Successfully fetched results for run_id: ${run_id} on attempt ${attempts} (took ${attemptDuration}ms)`);
          logger.info(`[Worker] 📊 Result summary - Found ${result.length} ads, First ad URL: ${result[0]?.url || 'N/A'}, Page ID: ${result[0]?.page_id || 'N/A'}`);
        }
      } catch (error) {
        const attemptDuration = Date.now() - attemptStartTime;
        logger.warn(`[Worker] ⚠️ Error fetching results for run_id ${run_id} on attempt ${attempts} (took ${attemptDuration}ms): ${(error as Error).message}`);
      }
    }

    if (!result) {
      const totalDuration = Date.now() - startTime;
      logger.error(`[Worker] ❌ Scraping failed or timed out for run_id: ${run_id} after ${attempts} attempts (total time: ${totalDuration}ms)`);
      throw new Error(`Scraping timeout after ${attempts} attempts`);
    }

    logger.info(`[Worker] 🎯 Got valid result for run_id: ${run_id}, proceeding with data processing`);
    logger.debug(`[Worker] Raw result - received ${result.length} ads`);
    
    // Filter for valid ads with IDs
    const validAds = result.filter(ad => {
      const hasValidId = ad.ad_archive_id || ad.ad_id;
      if (!hasValidId) {
        logger.warn(`[Worker] ⚠️ Skipping ad without valid ID in run_id: ${run_id}`);
      }
      return hasValidId;
    });
    
    if (validAds.length === 0) {
      const totalDuration = Date.now() - startTime;
      logger.error(`[Worker] ❌ No valid ads found with ad_archive_id or ad_id in run_id: ${run_id}. Total ads received: ${result.length} (total time: ${totalDuration}ms)`);
      throw new Error(`No valid ads found with ad_archive_id or ad_id in run_id: ${run_id}. Total ads received: ${result.length}`);
    }
    
    logger.info(`[Worker] ✅ Found ${validAds.length} valid ads out of ${result.length} total ads for run_id: ${run_id}`);
    
    try {
      // Transform all valid ads to database format
      const transformStartTime = Date.now();
      const dbRecords: DbCompetitor[] = [];
      let transformErrors = 0;
      
      for (let i = 0; i < validAds.length; i++) {
        const ad = validAds[i];
        try {
          logger.debug(`[Worker] 🔄 Transforming ad ${i + 1}/${validAds.length} - ID: ${ad.ad_archive_id || ad.ad_id}`);
          const dbComp = apicreaiveToDbCompetitor(ad, run_id, organisation_id);
          dbRecords.push(dbComp);
        } catch (error) {
          logger.error(`[Worker] ❌ Error transforming ad ${i + 1}/${validAds.length} (ID: ${ad.ad_archive_id || ad.ad_id}): ${(error as Error).message}`);
          transformErrors++;
        }
      }
      
      const transformDuration = Date.now() - transformStartTime;
      logger.info(`[Worker] ✅ Step 1 completed: Transformed ${dbRecords.length} ads successfully, ${transformErrors} transform errors (took ${transformDuration}ms)`);
      
      if (dbRecords.length === 0) {
        throw new Error(`No ads could be transformed to database format for run_id: ${run_id}. Transform errors: ${transformErrors}`);
      }
      
      // Step 2: Bulk upsert all ads in a single operation
      logger.info(`[Worker] 🔄 Step 2: Bulk upserting ${dbRecords.length} ads for run_id: ${run_id}`);
      const bulkStartTime = Date.now();
      
      const bulkResult = await bulk_upsert_data(dbRecords);
      const bulkDuration = Date.now() - bulkStartTime;
      
      if (!bulkResult.success) {
        logger.error(`[Worker] ❌ Step 2 failed: Bulk upsert failed for run_id: ${run_id} (took ${bulkDuration}ms): ${bulkResult.error?.message}`);
        throw new Error(`Bulk upsert failed: ${bulkResult.error?.message}`);
      }
      
      logger.info(`[Worker] ✅ Step 2 completed: Bulk upserted ${bulkResult.inserted_count} ads for run_id: ${run_id} (took ${bulkDuration}ms)`);

      // Step 3: Update runner status
      logger.info(`[Worker] 🔄 Step 3: Marking scraper as completed for run_id: ${run_id}`);
      const updateStartTime = Date.now();
      
      const updateResult = await update_runner_scrapers(run_id);
      const updateDuration = Date.now() - updateStartTime;
      
      if (!updateResult.success) {
        logger.error(`[Worker] ❌ Step 3 failed: Failed to update runner_scrapers for run_id: ${run_id} (took ${updateDuration}ms): ${updateResult.error?.message}`);
        throw new Error(`Failed to update runner status: ${updateResult.error?.message}`);
      }
      
      logger.info(`[Worker] ✅ Step 3 completed: Runner status updated for run_id: ${run_id} (took ${updateDuration}ms)`);

      const totalDuration = Date.now() - startTime;
      logger.info(`[Worker] 🎉 Job ${job.id} completed successfully! Total processing time: ${totalDuration}ms`);
      logger.info(`[Worker] 📈 Final summary - Run ID: ${run_id}, Transformed: ${dbRecords.length}/${validAds.length} ads, Inserted: ${bulkResult.inserted_count}, Transform errors: ${transformErrors}`);
      
      if (transformErrors > 0) {
        logger.warn(`[Worker] ⚠️ Warning: ${transformErrors} ads failed to transform out of ${validAds.length} total ads for run_id: ${run_id}`);
      }
      
      return {
        success: true,
        run_id,
        total_ads: validAds.length,
        transformed_ads: dbRecords.length,
        inserted_ads: bulkResult.inserted_count,
        transform_errors: transformErrors,
        processing_time_ms: totalDuration
      };
      
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      logger.error(`[Worker] 💥 Job ${job.id} failed during processing - run_id: ${run_id}, error: ${(error as Error).message} (total time: ${totalDuration}ms)`);
      logger.error(`[Worker] 🔍 Error stack trace:`, error);
      throw error; // Re-throw to let BullMQ handle retry logic
    }
  },
  {
    connection: redis,
    concurrency: 3, // Process up to 3 jobs concurrently
    maxStalledCount: 1, // Mark job as stalled after 1 check
    stalledInterval: 30000, // Check for stalled jobs every 30 seconds
  }
);

// Enhanced worker event logging
worker.on('completed', (job, result) => {
  logger.info(`[Worker] 🎯 Job ${job.id} completed successfully with result:`, result);
});

worker.on('failed', (job, err) => {
  logger.error(`[Worker] 💀 Job ${job?.id} failed permanently after ${job?.attemptsMade || 0} attempts: ${err.message}`);
  if (job) {
    logger.error(`[Worker] 📋 Failed job data:`, job.data);
  }
});

worker.on('stalled', (jobId) => {
  logger.warn(`[Worker] 🐌 Job ${jobId} stalled and will be reprocessed`);
});

worker.on('error', (err) => {
  logger.error('[Worker] 🚨 Worker error:', err);
});

worker.on('ready', () => {
  logger.info('[Worker] 🟢 Worker is ready and waiting for jobs');
});

worker.on('active', (job) => {
  logger.info(`[Worker] 🏃 Job ${job.id} became active - Data: ${JSON.stringify(job.data)}`);
});

logger.info('[Worker] 🔧 Scraper worker initialized with enhanced monitoring');

export default worker;
