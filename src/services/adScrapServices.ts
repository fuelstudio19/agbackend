import { response } from "express";
import { MetaAdResponse } from "../types/scrapperTypes";
import { urlSchema } from "../types/scrapperTypes";
import {
  getScrapedAdsByRunId as getCompetitorAdsByRunId,
  getScrapedAdsByRunIdWithPagination as getCompetitorAdsByRunIdWithPagination,
} from "../repositories/adCompetitorCreativesRepository";
import {
  getScrapedAdsByRunId as getSelfAdsByRunId,
  getScrapedAdsByRunIdWithPagination as getSelfAdsByRunIdWithPagination,
} from "../repositories/selfAdCreativesRepository";
import { PostgrestError } from "@supabase/supabase-js";
import * as scrapperRepository from "../repositories/adScrapperRepository";
import { startMetaScraper } from "../utils/scrapper";
import {
  startBackgroundPolling,
  getPollingStatus,
  isPollingActive,
} from "./backgroundPollingService";
import * as adCompetitiorRepository from "../repositories/adCompetitorCreativesRepository";
import * as selfAdRepository from "../repositories/selfAdCreativesRepository";
import dotenv from "dotenv";
import { logger } from "../utils/logger";
import {
  DbCompetitor,
  DbCompetitorSummary,
  DbSelfAdCreativeSummary,
} from "../types/dbSchemaTypes";

dotenv.config();

type AdType = "competitor" | "self";

/**
 * Unified scrapping result interface that works for both competitor and self ads
 */
interface UnifiedScrappingResult {
  data: DbCompetitorSummary[] | DbSelfAdCreativeSummary[] | null;
  message: string | null;
  error: PostgrestError | null;
}

/**
 * Converts API ad object to database format
 */

// Function to check runId and result present in db - works for both types
export const getResultRunId = async (
  run_id: string,
  organisation_id: string,
  adType: AdType = "competitor"
): Promise<UnifiedScrappingResult> => {
  logger.info(
    `[adScrapServices] Checking status for run_id: ${run_id}, org: ${organisation_id}, type: ${adType}`
  );

  const { present, error } = await scrapperRepository.checkRunIdandResult(
    run_id
  );

  if (error) {
    logger.error(
      `[adScrapServices] Database error checking run_id ${run_id}:`,
      error
    );
    return { data: null, message: null, error: error };
  }

  if (present && present[0] && present[1]) {
    // Scrapping is Done Return data
    logger.info(
      `[adScrapServices] Scraping completed for run_id: ${run_id}, fetching results`
    );

    let data, fetchError;
    if (adType === "competitor") {
      const result = await adCompetitiorRepository.getScrapedAdsByRunId(run_id);
      data = result.data;
      fetchError = result.error;
    } else {
      const result = await selfAdRepository.getScrapedAdsByRunId(run_id);
      data = result.data;
      fetchError = result.error;
    }

    if (fetchError) {
      logger.error(
        `[adScrapServices] Error fetching scraped data for run_id ${run_id}:`,
        fetchError
      );
      return { data: null, message: null, error: fetchError };
    }
    logger.info(
      `[adScrapServices] Successfully retrieved ${
        data?.length || 0
      } records for run_id: ${run_id}`
    );
    return { data: data, message: null, error: null };
  }

  if (present && !present[0] && !present[1]) {
    // New run_id
    logger.info(
      `[adScrapServices] New run_id detected: ${run_id}, storing in database and starting background polling`
    );
    const { success, error } = await scrapperRepository.upsert_run_id(
      run_id,
      organisation_id
    );

    if (!success) {
      logger.error(
        `[adScrapServices] Failed to store run_id ${run_id}:`,
        error
      );
      return { data: null, message: null, error: error };
    }

    // Start background polling immediately with the correct type
    try {
      startBackgroundPolling(run_id, organisation_id, adType);
      logger.info(
        `[adScrapServices] Successfully started background polling for run_id: ${run_id}, type: ${adType}`
      );
    } catch (pollingError) {
      logger.error(
        `[adScrapServices] Failed to start background polling for run_id ${run_id}:`,
        pollingError
      );
      return {
        data: null,
        message: "Failed to start background polling",
        error: pollingError as PostgrestError,
      };
    }

    return {
      data: null,
      message: `run_id stored in db and ${adType} background polling started`,
      error: null,
    };
  }

  // run_id is there in runner_scrapers but not scrapped - check if background polling is active
  const isPolling = isPollingActive(run_id);
  if (isPolling) {
    logger.info(
      `[adScrapServices] Background polling active for run_id: ${run_id}`
    );
    return {
      data: null,
      message: `Background polling is active for this ${adType} scraping job`,
      error: null,
    };
  } else {
    logger.info(
      `[adScrapServices] Scraping still in progress for run_id: ${run_id} (no active polling)`
    );
    return {
      data: null,
      message: `${adType} scrapping is not done yet`,
      error: null,
    };
  }
};

// Check result by run_id - works for both types
export const checkResultByRunId = async (
  run_id: string,
  adType: AdType = "competitor"
): Promise<{
  result: DbCompetitorSummary[] | DbSelfAdCreativeSummary[] | null;
  error: PostgrestError | null;
}> => {
  logger.info(
    `[adScrapServices] Checking results for run_id: ${run_id}, type: ${adType}`
  );
  try {
    let data, error;
    if (adType === "competitor") {
      const result = await getCompetitorAdsByRunId(run_id);
      data = result.data;
      error = result.error;
    } else {
      const result = await getSelfAdsByRunId(run_id);
      data = result.data;
      error = result.error;
    }

    if (error) {
      logger.error(
        `[adScrapServices] Error fetching results for run_id ${run_id}:`,
        error
      );
    } else {
      logger.info(
        `[adScrapServices] Found ${
          data?.length || 0
        } results for run_id: ${run_id}`
      );
    }
    return { result: data, error };
  } catch (err) {
    logger.error(
      "[adScrapServices] Exception during result fetch by run_id:",
      err
    );
    return { result: null, error: err as PostgrestError };
  }
};

// Unified function to get ad results by URL - extracts organisation ID and uses efficient pagination
export const getAdResultsByUrl = async (
  url: string,
  limit: number,
  offset: number
): Promise<{
  result: (DbCompetitorSummary | DbSelfAdCreativeSummary)[] | null;
  error: PostgrestError | null;
  message?: string;
  isScraping?: boolean;
  count?: number;
}> => {
  logger.info(
    `[adScrapServices] Getting ad results for URL: ${url} with pagination limit=${limit}, offset=${offset}`
  );
  try {
    // First get the latest run_id and extract organisation_id from the URL
    const { run_id, error: runIdError } =
      await scrapperRepository.getLatestRunIdByCompetitorUrl(url);

    if (runIdError) {
      logger.error(
        `[adScrapServices] Error getting run_id for URL ${url}:`,
        runIdError
      );
      return { result: null, error: runIdError, isScraping: false };
    }

    if (!run_id) {
      // No scraping found for this URL at all
      logger.info(`[adScrapServices] No scraping found for URL: ${url}`);
      return {
        result: null,
        error: null,
        message: "No scraping found for this URL.",
        isScraping: false,
        count: 0,
      };
    }

    // Get the runner data to extract organisation_id
    const { data: runnerData, error: runnerError } = await scrapperRepository.getRunnerDataByRunId(run_id);
    
    if (runnerError) {
      logger.error(
        `[adScrapServices] Error getting runner data for run_id ${run_id}:`,
        runnerError
      );
      return { result: null, error: runnerError, isScraping: false };
    }

    if (!runnerData?.organisation_id) {
      logger.error(`[adScrapServices] No organisation_id found for run_id: ${run_id}`);
      return {
        result: null,
        error: null,
        message: "Organisation not found for this URL.",
        isScraping: false,
        count: 0,
      };
    }

    // Check if scraping is still in progress by checking ads_scraped status
    const { present, error: statusError } =
      await scrapperRepository.checkRunIdandResult(run_id);

    if (statusError) {
      logger.error(
        `[adScrapServices] Error checking scraping status for run_id ${run_id}:`,
        statusError
      );
      return { result: null, error: statusError, isScraping: false };
    }

    // If ads_scraped = 0, scraping is still in progress
    const isScraping = present ? !present[1] : false; // present[1] is ads_scraped boolean

    if (isScraping) {
      logger.info(
        `[adScrapServices] Scraping still in progress for URL: ${url}, run_id: ${run_id}`
      );
      return {
        result: null,
        error: null,
        message: "Scraping is still in progress. Please try again later.",
        isScraping: true,
        count: 0,
      };
    }

    logger.info(
      `[adScrapServices] Found completed run_id ${run_id} for URL: ${url}, delegating to organisation-based function`
    );

    // Use the efficient organisation-based function with the extracted organisation_id
    const response = await getAdResultsByOrganizationId(
      runnerData.organisation_id,
      limit,
      offset,
      'all' // Get both competitor and self ads
    );

    return response;
  } catch (err) {
    logger.error(
      "[adScrapServices] Exception during result fetch by URL:",
      err
    );
    return { result: null, error: err as PostgrestError, isScraping: false };
  }
};

// Function to start Meta Ad Library scraper - works for both types
export const startScrapperService = async (
  url: string, // meta_ad_library_url or meta_ad_dashboard_url
  company_url: string, // competitor_url or company_url
  organisation_id: string,
  adType: AdType = "competitor"
): Promise<{ run_id: string; polling_status?: any }> => {
  logger.info(
    `[adScrapServices] Starting scraper service - URL: ${url}, Company: ${company_url}, Org: ${organisation_id}, Type: ${adType}`
  );

  try {
    // Get polling stats before starting
    const beforeStats = getPollingStatus();

    const run_id = await startMetaScraper(url);
    logger.info(
      `[adScrapServices] Apify scraper started with run_id: ${run_id}`
    );

    // Store run_id with the appropriate URL parameter
    const { success, error } = await scrapperRepository.upsert_run_id(
      run_id,
      organisation_id,
      company_url,
      url
    );

    if (!success) {
      logger.error(
        `[adScrapServices] Failed to store run_id ${run_id}:`,
        error
      );
      throw new Error(`Failed to store run_id: ${error?.message}`);
    }

    logger.info(
      `[adScrapServices] Run_id ${run_id} stored in database successfully`
    );

    // Start background polling immediately with the correct type
    startBackgroundPolling(run_id, organisation_id, adType);
    logger.info(
      `[adScrapServices] Background polling started for run_id: ${run_id}, type: ${adType}`
    );

    // Get polling stats after starting
    const afterStats = getPollingStatus();

    logger.info(
      `[adScrapServices] ✅ Scraper service started successfully - run_id: ${run_id}, company: ${company_url}, type: ${adType}`
    );
    return {
      run_id,
      polling_status: {
        before: beforeStats,
        after: afterStats,
      },
    };
  } catch (error) {
    logger.error(
      `[adScrapServices] ❌ Failed to start scraper service for company ${company_url}, type ${adType}:`,
      error
    );
    throw new Error(`${adType} scraper failed to start`);
  }
};

// Legacy function for competitor ads to maintain backwards compatibility
export const startCompetitorScrapperService = async (
  meta_ad_library_url: string,
  competitor_url: string,
  organisation_id: string
): Promise<{ run_id: string; polling_status?: any }> => {
  return startScrapperService(
    meta_ad_library_url,
    competitor_url,
    organisation_id,
    "competitor"
  );
};

// New function for self ads
export const startSelfAdScrapperService = async (
  meta_ad_dashboard_url: string,
  company_url: string,
  organisation_id: string
): Promise<{ run_id: string; polling_status?: any }> => {
  return startScrapperService(
    meta_ad_dashboard_url,
    company_url,
    organisation_id,
    "self"
  );
};

// New function to get self ad scraping results by run_id
export const getSelfAdResultRunId = async (
  run_id: string,
  organisation_id: string
): Promise<UnifiedScrappingResult> => {
  return getResultRunId(run_id, organisation_id, "self");
};

// Function to get background polling monitoring info
export const getPollingMonitoringInfo = async () => {
  logger.info(
    "[adScrapServices] Fetching background polling monitoring information"
  );
  try {
    const status = getPollingStatus();

    logger.info(
      `[adScrapServices] Background polling monitoring info retrieved - ${status.activeCount} active jobs`
    );

    return {
      status,
      message: `Currently ${status.activeCount} background polling processes active`,
    };
  } catch (error) {
    logger.error(
      "[adScrapServices] Error getting background polling monitoring info:",
      error
    );
    throw error;
  }
};

// Legacy function for backwards compatibility (but now uses background polling)
export const getQueueMonitoringInfo = async () => {
  logger.info(
    "[adScrapServices] Fetching monitoring information (legacy queue method)"
  );
  return await getPollingMonitoringInfo();
};

// Get ad results by organisation ID directly (for controllers) - more efficient approach
export const getAdResultsByOrganizationId = async (
  organisationId: string,
  limit: number,
  offset: number,
  adType?: "competitor" | "self" | "all"
): Promise<{
  result: (DbCompetitorSummary | DbSelfAdCreativeSummary)[] | null;
  error: PostgrestError | null;
  message?: string;
  isScraping?: boolean;
  count?: number;
}> => {
  logger.info(
    `[adScrapServices] Getting ${
      adType || "all"
    } ad results for organisation: ${organisationId} with pagination limit=${limit}, offset=${offset}`
  );

  try {
    let combinedResults: (DbCompetitorSummary | DbSelfAdCreativeSummary)[] = [];
    let combinedError: PostgrestError | null = null;
    let totalCount = 0;
    let hasActiveScraping = false;

    // Get competitor ads if requested
    if (!adType || adType === "all" || adType === "competitor") {
      const {
        data: competitorData,
        error: competitorError,
        count: competitorCount,
      } = await adCompetitiorRepository.getScrapedAdsByOrganisation(
        organisationId,
        limit,
        offset
      );

      if (competitorError) {
        combinedError = competitorError;
      } else if (competitorData) {
        combinedResults = [...combinedResults, ...competitorData];
        totalCount += competitorCount || 0;
      }
    }

    // Get self ads if requested
    if (!adType || adType === "all" || adType === "self") {
      const {
        data: selfData,
        error: selfError,
        count: selfCount,
      } = await selfAdRepository.getScrapedAdsByOrganisation(
        organisationId,
        limit,
        offset
      );

      if (selfError && !combinedError) {
        combinedError = selfError;
      } else if (selfData) {
        combinedResults = [...combinedResults, ...selfData];
        totalCount += selfCount || 0;
      }
    }

    // Check if the most recent scraping job for this organisation is active
    const { hasActiveJobs, activeCount, error: scrapingCheckError } = 
      await scrapperRepository.getActiveScrapingJobsByOrganisation(organisationId);

    if (scrapingCheckError) {
      logger.error(
        `[adScrapServices] Error checking most recent scraping job for organisation ${organisationId}:`,
        scrapingCheckError
      );
      // Continue execution even if we can't check for active jobs
      hasActiveScraping = false;
    } else {
      hasActiveScraping = hasActiveJobs;
      if (hasActiveJobs) {
        logger.info(
          `[adScrapServices] Most recent scraping job for organisation ${organisationId} is currently active`
        );
      } else {
        logger.info(
          `[adScrapServices] No active scraping job found for organisation ${organisationId}`
        );
      }
    }

    // Additional check: If scraping is active but we already have ads data, set isScraping to false
    if (hasActiveScraping && combinedResults.length > 0) {
      logger.info(
        `[adScrapServices] Scraping is active but ${combinedResults.length} ads already available for organisation ${organisationId}, setting isScraping to false`
      );
      hasActiveScraping = false;
    }

    if (combinedError) {
      logger.error(
        `[adScrapServices] Error fetching ads for organisation ${organisationId}:`,
        combinedError
      );
      return {
        result: null,
        error: combinedError,
        isScraping: hasActiveScraping,
      };
    }

    if (combinedResults.length === 0) {
      logger.info(
        `[adScrapServices] No results found for organisation: ${organisationId}`
      );
      return {
        result: null,
        error: null,
        message: "No ad results found for this organisation.",
        isScraping: hasActiveScraping,
        count: 0,
      };
    }

    // Apply pagination to combined results if needed (for 'all' type)
    if (adType === "all") {
      totalCount = combinedResults.length;
      combinedResults = combinedResults.slice(offset, offset + limit);
    }

    logger.info(
      `[adScrapServices] Found ${totalCount} total results for organisation: ${organisationId}, returning ${combinedResults.length}`
    );
    return {
      result: combinedResults,
      error: null,
      isScraping: hasActiveScraping,
      count: totalCount,
    };
  } catch (err) {
    logger.error(
      "[adScrapServices] Exception during result fetch by organisation ID:",
      err
    );
    return { result: null, error: err as PostgrestError, isScraping: false };
  }
};
