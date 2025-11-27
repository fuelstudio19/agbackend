import { getScraperResults } from '../utils/scrapper';
import { update_runner_scrapers, getRunnerDataByRunId } from '../repositories/adScrapperRepository';
import { bulk_upsert_data as competitorBulkUpsert } from '../repositories/adCompetitorCreativesRepository';
import { bulk_upsert_data as selfAdBulkUpsert } from '../repositories/selfAdCreativesRepository';
import { getCompetitorByUrl } from '../repositories/competitorsRepository';
import { logger } from '../utils/logger';
import { DbCompetitor, DbSelfAdCreative } from '../types/dbSchemaTypes';
import { MetaAdResponse } from '../types/scrapperTypes';
import { bulkUploadMediaToR2 } from './r2UploadService';

// Track active polling processes to avoid duplicates
const activePollingProcesses = new Set<string>();

type AdType = 'competitor' | 'self';

interface PollingJob {
  run_id: string;
  organisation_id: string;
  adType: AdType;
  startTime: number;
  maxAttempts: number;
  delayMs: number;
  currentAttempt: number;
}

interface MediaUrls {
  resized_image_urls: string[];
  original_image_urls: string[];
  video_hd_urls: string[];
  video_sd_urls: string[];
}

// ============================================================================
// MEDIA EXTRACTION UTILITIES
// ============================================================================

/**
 * Filter out null, undefined, or empty string values from URL arrays
 * Returns undefined if array becomes empty after filtering
 */
const filterValidUrls = (urls: any[] | undefined | null): string[] | undefined => {
  if (!Array.isArray(urls)) return undefined;
  
  const filtered = urls.filter(url => 
    url && 
    typeof url === 'string' && 
    url.trim().length > 0
  );
  
  return filtered.length > 0 ? filtered : undefined;
};

/**
 * Efficiently extract all media URLs from a single ad's cards
 */
const extractMediaFromCards = (cards: any[]): MediaUrls => {
  const media: MediaUrls = {
    resized_image_urls: [],
    original_image_urls: [],
    video_hd_urls: [],
    video_sd_urls: []
  };

  cards.forEach(card => {
    if (card.resized_image_url) media.resized_image_urls.push(card.resized_image_url);
    if (card.original_image_url) media.original_image_urls.push(card.original_image_url);
    if (card.video_hd_url) media.video_hd_urls.push(card.video_hd_url);
    if (card.video_sd_url) media.video_sd_urls.push(card.video_sd_url);
  });

  return media;
};

/**
 * Fallback media extraction from images/videos arrays
 */
const extractMediaFromArrays = (snapshot: any): MediaUrls => {
  const media: MediaUrls = {
    resized_image_urls: [],
    original_image_urls: [],
    video_hd_urls: [],
    video_sd_urls: []
  };

  // Extract from images array
  if (Array.isArray(snapshot.images)) {
    snapshot.images.forEach((img: any) => {
      if (typeof img === 'string') {
        media.original_image_urls.push(img);
      } else if (img && typeof img === 'object') {
        if (img.resized_image_url) media.resized_image_urls.push(img.resized_image_url);
        if (img.original_image_url) media.original_image_urls.push(img.original_image_url);
      }
    });
  }

  // Extract from videos array
  if (Array.isArray(snapshot.videos)) {
    snapshot.videos.forEach((video: any) => {
      if (typeof video === 'string') {
        media.video_hd_urls.push(video);
      } else if (video && typeof video === 'object') {
        if (video.video_hd_url) media.video_hd_urls.push(video.video_hd_url);
        if (video.video_sd_url) media.video_sd_urls.push(video.video_sd_url);
      }
    });
  }

  return media;
};

/**
 * Extract all media URLs from an ad's snapshot
 */
const extractAllMediaUrls = (apiCreative: MetaAdResponse): MediaUrls => {
  let media: MediaUrls = {
    resized_image_urls: [],
    original_image_urls: [],
    video_hd_urls: [],
    video_sd_urls: []
  };

  if (apiCreative.snapshot?.cards && Array.isArray(apiCreative.snapshot.cards)) {
    media = extractMediaFromCards(apiCreative.snapshot.cards);
  } else {
    // Fallback to images/videos arrays
    media = extractMediaFromArrays(apiCreative.snapshot || {});
  }

  return media;
};

// ============================================================================
// DATA TRANSFORMATION UTILITIES
// ============================================================================

/**
 * Convert timestamp to ISO string
 */
const convertTimestamp = (timestamp: number | undefined): string | undefined => {
  return timestamp ? new Date(timestamp * 1000).toISOString() : undefined;
};

/**
 * Transform API creative to database record
 */
const transformApiCreativeToDbRecord = (
  apiCreative: MetaAdResponse, 
  run_id: string, 
  organisation_id: string, 
  adType: AdType,
  competitorId?: string | null
): DbCompetitor | DbSelfAdCreative => {
  if (!apiCreative.ad_archive_id && !apiCreative.ad_id) {
    throw new Error('Cannot map API Ad to database schema: missing id field');
  }

  const media = extractAllMediaUrls(apiCreative);
  const now = new Date().toISOString();

  const baseRecord = {
    run_id,
    organisation_id,
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
    
    // Media URLs
    resized_image_urls: media.resized_image_urls.length > 0 ? media.resized_image_urls : undefined,
    original_image_urls: media.original_image_urls.length > 0 ? media.original_image_urls : undefined,
    video_hd_urls: media.video_hd_urls.length > 0 ? media.video_hd_urls : undefined,
    video_sd_urls: media.video_sd_urls.length > 0 ? media.video_sd_urls : undefined,
    
    // Legacy field for backward compatibility
    image_urls: filterValidUrls(apiCreative.image_urls) || (media.original_image_urls.length > 0 ? media.original_image_urls : undefined),
    
    publisher_platforms: apiCreative.publisher_platform || undefined,
    start_date: convertTimestamp(apiCreative.start_date),
    end_date: convertTimestamp(apiCreative.end_date),
    raw_data: apiCreative.snapshot,
    created_at: now,
    updated_at: now
  };

  if (adType === 'competitor') {
    return {
      ...baseRecord,
      competitor_id: competitorId || null
    } as DbCompetitor;
  } else {
    return baseRecord as DbSelfAdCreative;
  }
};

// ============================================================================
// MEDIA PROCESSING UTILITIES
// ============================================================================

/**
 * Extract all unique media URLs from database records
 */
const getAllMediaUrls = (records: (DbCompetitor | DbSelfAdCreative)[]): string[] => {
  const urlSet = new Set<string>();
  
  records.forEach(record => {
    [
      ...(record.resized_image_urls || []),
      ...(record.original_image_urls || []),
      ...(record.video_hd_urls || []),
      ...(record.video_sd_urls || []),
      ...(record.image_urls || []),
      record.page_profile_picture_url
    ].forEach(url => {
      if (url && typeof url === 'string' && url.trim()) {
        urlSet.add(url);
      }
    });
  });
  
  return Array.from(urlSet);
};

/**
 * Replace URLs in database records with R2 URLs
 */
const replaceUrlsWithR2Urls = (
  records: (DbCompetitor | DbSelfAdCreative)[],
  urlMapping: Map<string, string>
): (DbCompetitor | DbSelfAdCreative)[] => {
  return records.map(record => ({
    ...record,
    resized_image_urls: filterValidUrls(record.resized_image_urls?.map(url => urlMapping.get(url) || url)),
    original_image_urls: filterValidUrls(record.original_image_urls?.map(url => urlMapping.get(url) || url)),
    video_hd_urls: filterValidUrls(record.video_hd_urls?.map(url => urlMapping.get(url) || url)),
    video_sd_urls: filterValidUrls(record.video_sd_urls?.map(url => urlMapping.get(url) || url)),
    image_urls: filterValidUrls(record.image_urls?.map(url => urlMapping.get(url) || url)),
    page_profile_picture_url: record.page_profile_picture_url && urlMapping.has(record.page_profile_picture_url) 
      ? urlMapping.get(record.page_profile_picture_url) 
      : record.page_profile_picture_url
  }));
};

/**
 * Check if a record has any media content
 */
const hasMediaContent = (record: DbCompetitor | DbSelfAdCreative): boolean => {
  return !!(
    (record.resized_image_urls?.length) ||
    (record.original_image_urls?.length) ||
    (record.video_hd_urls?.length) ||
    (record.video_sd_urls?.length) ||
    filterValidUrls(record.image_urls)?.length
  );
};

// ============================================================================
// VALIDATION AND PROCESSING
// ============================================================================

/**
 * Validate and filter ads, return valid ones with detailed stats
 */
const validateAndFilterAds = (
  result: MetaAdResponse[], 
  run_id: string
): { validAds: MetaAdResponse[], stats: { total: number, withIds: number, withMedia: number, skipped: number } } => {
  const stats = { total: result.length, withIds: 0, withMedia: 0, skipped: 0 };
  
  // Filter ads with valid IDs
  const adsWithIds = result.filter(ad => {
    const hasValidId = !!(ad.ad_archive_id || ad.ad_id);
    if (hasValidId) stats.withIds++;
    else stats.skipped++;
    return hasValidId;
  });

  // Filter ads with media content (check at API level for efficiency)
  const validAds = adsWithIds.filter(ad => {
    const media = extractAllMediaUrls(ad);
    const hasMedia = !!(
      media.resized_image_urls.length ||
      media.original_image_urls.length ||
      media.video_hd_urls.length ||
      media.video_sd_urls.length ||
      filterValidUrls(ad.image_urls)?.length
    );
    if (hasMedia) stats.withMedia++;
    return hasMedia;
  });

  logger.info(`[BackgroundPoller] 📊 Validation stats for run_id ${run_id}: ${stats.total} total → ${stats.withIds} with IDs → ${stats.withMedia} with media (${stats.skipped} skipped)`);
  
  return { validAds, stats };
};

/**
 * Get competitor ID for competitor ads
 */
const getCompetitorId = async (run_id: string): Promise<string | null> => {
  try {
    const { data: runnerData, error: runnerError } = await getRunnerDataByRunId(run_id);
    
    if (runnerError || !runnerData?.competitor_url) {
      logger.warn(`[BackgroundPoller] No competitor URL found for run_id: ${run_id}`);
      return null;
    }

    const { data: competitorData, error: competitorError } = await getCompetitorByUrl(
      runnerData.competitor_url,
      runnerData.organisation_id
    );

    if (competitorError || !competitorData?.id) {
      logger.warn(`[BackgroundPoller] No competitor found for URL ${runnerData.competitor_url}`);
      return null;
    }

    logger.info(`[BackgroundPoller] Found competitor_id: ${competitorData.id} for run_id: ${run_id}`);
    return competitorData.id;
  } catch (error) {
    logger.error(`[BackgroundPoller] Error getting competitor ID for run_id ${run_id}:`, error);
    return null;
  }
};

/**
 * Transform all ads to database records
 */
const transformAdsToDbRecords = async (
  validAds: MetaAdResponse[],
  run_id: string,
  organisation_id: string,
  adType: AdType
): Promise<(DbCompetitor | DbSelfAdCreative)[]> => {
  // Get competitor ID once if needed
  const competitorId = adType === 'competitor' ? await getCompetitorId(run_id) : null;
  
  const dbRecords: (DbCompetitor | DbSelfAdCreative)[] = [];
  let transformErrors = 0;

  // Transform all ads
  for (const ad of validAds) {
    try {
      const dbRecord = transformApiCreativeToDbRecord(ad, run_id, organisation_id, adType, competitorId);
      dbRecords.push(dbRecord);
    } catch (error) {
      logger.error(`[BackgroundPoller] ❌ Error transforming ad ${ad.ad_archive_id || ad.ad_id}: ${(error as Error).message}`);
      transformErrors++;
    }
  }

  logger.info(`[BackgroundPoller] ✅ Transformed ${dbRecords.length}/${validAds.length} ads successfully (${transformErrors} errors)`);
  
  if (dbRecords.length === 0) {
    throw new Error(`No ads could be transformed for run_id: ${run_id}`);
  }

  return dbRecords;
};

/**
 * Upload media to R2 and get URL mappings
 */
const uploadMediaToR2 = async (
  records: (DbCompetitor | DbSelfAdCreative)[],
  organisation_id: string,
  adType: AdType,
  run_id: string
): Promise<Map<string, string>> => {
  const uniqueMediaUrls = getAllMediaUrls(records);
  
  if (uniqueMediaUrls.length === 0) {
    logger.info(`[BackgroundPoller] No media URLs to upload for run_id: ${run_id}`);
    return new Map();
  }

  logger.info(`[BackgroundPoller] 📤 Uploading ${uniqueMediaUrls.length} media URLs to R2 for run_id: ${run_id}`);
  
  try {
    const r2Result = await bulkUploadMediaToR2(uniqueMediaUrls, organisation_id, adType);
    
    logger.info(`[BackgroundPoller] ✅ R2 upload completed: ${r2Result.successful.length}/${uniqueMediaUrls.length} successful`);
    
    if (r2Result.failed.length > 0) {
      logger.warn(`[BackgroundPoller] ⚠️ ${r2Result.failed.length} uploads failed`);
    }
    
    return r2Result.urlMapping;
  } catch (error) {
    logger.error(`[BackgroundPoller] ❌ R2 upload failed for run_id: ${run_id}:`, error);
    return new Map(); // Return empty map to continue with original URLs
  }
};

/**
 * Bulk upsert records to database
 */
const bulkUpsertRecords = async (
  records: (DbCompetitor | DbSelfAdCreative)[],
  adType: AdType,
  run_id: string
): Promise<void> => {
  logger.info(`[BackgroundPoller] 💾 Bulk upserting ${records.length} ${adType} ads for run_id: ${run_id}`);
  
  const startTime = Date.now();
  let result;
  
  if (adType === 'competitor') {
    result = await competitorBulkUpsert(records as DbCompetitor[]);
  } else {
    result = await selfAdBulkUpsert(records as DbSelfAdCreative[]);
  }
  
  const duration = Date.now() - startTime;
  
  if (!result.success) {
    throw new Error(`Bulk upsert failed: ${result.error?.message}`);
  }
  
  logger.info(`[BackgroundPoller] ✅ Bulk upserted ${result.inserted_count} ads (took ${duration}ms)`);
};

/**
 * Update runner status to completed
 */
const updateRunnerStatus = async (run_id: string): Promise<void> => {
  logger.info(`[BackgroundPoller] 🔄 Marking scraper as completed for run_id: ${run_id}`);
  
  const result = await update_runner_scrapers(run_id);
  
  if (!result.success) {
    throw new Error(`Failed to update runner status: ${result.error?.message}`);
  }
  
  logger.info(`[BackgroundPoller] ✅ Runner status updated for run_id: ${run_id}`);
};

// ============================================================================
// MAIN PROCESSING PIPELINE
// ============================================================================

/**
 * Process scraping results - improved single pipeline
 */
const processScrapingResults = async (
  result: MetaAdResponse[], 
  run_id: string, 
  organisation_id: string, 
  adType: AdType, 
  startTime: number
): Promise<void> => {
  logger.info(`[BackgroundPoller] 🎯 Processing ${result.length} ads for run_id: ${run_id}, type: ${adType}`);

  try {
    // Step 1: Validate and filter ads
    const { validAds } = validateAndFilterAds(result, run_id);
    
    if (validAds.length === 0) {
      logger.info(`[BackgroundPoller] ℹ️ No valid ads with media content found for run_id: ${run_id}, marking as completed`);
      await updateRunnerStatus(run_id);
      
      const totalDuration = Date.now() - startTime;
      logger.info(`[BackgroundPoller] ✅ Successfully processed run_id: ${run_id} in ${totalDuration}ms (no valid ads found)`);
      return;
    }

    // Step 2: Transform to database records
    const dbRecords = await transformAdsToDbRecords(validAds, run_id, organisation_id, adType);

    // Step 3: Store with original URLs first (quick upsert for immediate data availability)
    await bulkUpsertRecords(dbRecords, adType, run_id);

    // Step 4: Upload media to R2 and get URL mappings (parallel background process)
    const urlMapping = await uploadMediaToR2(dbRecords, organisation_id, adType, run_id);

    // Step 5: Update records with R2 URLs if we have mappings
    if (urlMapping.size > 0) {
      const recordsWithR2Urls = replaceUrlsWithR2Urls(dbRecords, urlMapping);
      await bulkUpsertRecords(recordsWithR2Urls, adType, run_id);
      logger.info(`[BackgroundPoller] ✅ Updated ${urlMapping.size} URLs with R2 URLs`);
    }

    // Step 6: Mark as completed
    await updateRunnerStatus(run_id);

    const totalDuration = Date.now() - startTime;
    logger.info(`[BackgroundPoller] 🎉 Successfully processed run_id: ${run_id} in ${totalDuration}ms`);

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    logger.error(`[BackgroundPoller] 💥 Processing failed for run_id: ${run_id} after ${totalDuration}ms: ${(error as Error).message}`);
    throw error;
  }
};

// ============================================================================
// POLLING LOGIC
// ============================================================================

/**
 * Poll for scraper results
 */
const pollForResults = async (job: PollingJob): Promise<void> => {
  const { run_id, organisation_id, adType, maxAttempts, delayMs } = job;
  
  try {
    job.currentAttempt++;
    logger.info(`[BackgroundPoller] 📡 Polling attempt ${job.currentAttempt}/${maxAttempts} for run_id: ${run_id} (type: ${adType})`);
    
    const attemptStartTime = Date.now();

    try {
      const result = await getScraperResults(run_id);
      const attemptDuration = Date.now() - attemptStartTime;

      if (result) {
        logger.info(`[BackgroundPoller] ✅ Results received for run_id: ${run_id} on attempt ${job.currentAttempt} (${attemptDuration}ms) - ${result.length} ads`);

        // Process results - if this fails, stop polling
        try {
          await processScrapingResults(result, run_id, organisation_id, adType, job.startTime);
          activePollingProcesses.delete(run_id);
          return;
        } catch (processingError) {
          logger.error(`[BackgroundPoller] 💀 Critical processing error for run_id: ${run_id}, stopping polling: ${(processingError as Error).message}`);
          activePollingProcesses.delete(run_id);
          return;
        }
      }
    } catch (fetchError) {
      const attemptDuration = Date.now() - attemptStartTime;
      logger.warn(`[BackgroundPoller] ⚠️ API fetch error for run_id ${run_id} on attempt ${job.currentAttempt} (${attemptDuration}ms): ${(fetchError as Error).message}`);
    }

    // Check if we should continue polling
    if (job.currentAttempt >= maxAttempts) {
      const totalDuration = Date.now() - job.startTime;
      logger.error(`[BackgroundPoller] ❌ Polling timeout for run_id: ${run_id} after ${job.currentAttempt} attempts (${totalDuration}ms)`);
      activePollingProcesses.delete(run_id);
      return;
    }

    // Schedule next poll
    setTimeout(() => pollForResults(job), delayMs);

  } catch (error) {
    logger.error(`[BackgroundPoller] 💥 Unexpected error during polling for run_id: ${run_id}:`, error);
    activePollingProcesses.delete(run_id);
  }
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Start background polling for scraper results
 */
export const startBackgroundPolling = (
  run_id: string,
  organisation_id: string,
  adType: AdType = 'competitor',
  maxAttempts: number = 25,
  delayMs: number = 10000
): void => {
  if (activePollingProcesses.has(run_id)) {
    logger.warn(`[BackgroundPoller] ⚠️ Polling already active for run_id: ${run_id}, skipping duplicate`);
    return;
  }

  activePollingProcesses.add(run_id);

  const job: PollingJob = {
    run_id,
    organisation_id,
    adType,
    startTime: Date.now(),
    maxAttempts,
    delayMs,
    currentAttempt: 0
  };

  logger.info(`[BackgroundPoller] 🚀 Starting background polling for run_id: ${run_id}, type: ${adType} (max: ${maxAttempts}, delay: ${delayMs}ms)`);

  pollForResults(job).catch(error => {
    logger.error(`[BackgroundPoller] 💀 Failed to start polling for run_id: ${run_id}:`, error);
    activePollingProcesses.delete(run_id);
  });
};

/**
 * Get the status of background polling processes
 */
export const getPollingStatus = () => {
  const activeJobs = Array.from(activePollingProcesses);
  return {
    activeCount: activeJobs.length,
    activeJobs: activeJobs,
    timestamp: new Date().toISOString()
  };
};

/**
 * Check if polling is active for a specific run_id
 */
export const isPollingActive = (run_id: string): boolean => {
  return activePollingProcesses.has(run_id);
};

// Initialize logging
logger.info('[BackgroundPoller] 🔧 Background polling service initialized'); 