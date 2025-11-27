import { getSupabaseClient } from "../config/supabase";
import { PostgrestError } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { MetaAdResponse } from "../types/scrapperTypes";



const TABLE_NAME = 'runner_scrapers';
const SCHEMA_NAME = 'adgraam';



/**
 * Check weather run_id and result are present in run_scrapper and returning result 
 */

export const checkRunIdandResult = async (
  run_id: string
): Promise<{ present: [boolean, boolean] | null; error: PostgrestError | null }> => {
  const supabase = getSupabaseClient();
  logger.info(`[adScrapperRepository] checking if result for run_id ${run_id} is present in DB`);

  try {
    const { data, error } = await supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .select('run_id, ads_scraped') 
      .eq('run_id', run_id);

    if (error) {
      logger.error(`[adScrapperRepository] Error checking for run_id ${run_id}:`, error);
      return { present: null, error:error };
    }

    if (data && data.length > 0) {
      if (data[0].ads_scraped==1) {
        return { present: [true, true], error: null };// run_id exists and scraping is complete — use the result immediately
      }
      return { present: [true, false], error: null }; // run_id exists but scraping is still pending
    }
    return { present: [false, false], error: null }; // New run_id — not scraped yet
  } catch (e) {
    logger.error(`[adScrapperRepository] Exception checking run_id:`, e);
    return { present: null, error: e as PostgrestError };
  }
};

/**
 * Check if scraping is completed for a competitor_url
 */
export const checkResultByCompetitorUrl = async (
  competitor_url: string
): Promise<{ present: [boolean, boolean] | null; error: PostgrestError | null }> => {
  const supabase = getSupabaseClient();
  logger.info(`[adScrapperRepository] checking if result for competitor_url ${competitor_url} is present in DB`);

  try {
    const { data, error } = await supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .select('run_id, ads_scraped') 
      .eq('competitor_url', competitor_url)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      logger.error(`[adScrapperRepository] Error checking for competitor_url ${competitor_url}:`, error);
      return { present: null, error: error };
    }

    if (data && data.length > 0) {
      if (data[0].ads_scraped == 1) {
        return { present: [true, true], error: null }; // competitor_url exists and scraping is complete
      }
      return { present: [true, false], error: null }; // competitor_url exists but scraping is still pending
    }
    return { present: [false, false], error: null }; // No scraping found for this competitor_url
  } catch (e) {
    logger.error(`[adScrapperRepository] Exception checking competitor_url:`, e);
    return { present: null, error: e as PostgrestError };
  }
};

/**
 * Upsert run_id  in run_scrapper
 */

export const upsert_run_id = async (
  run_id: string,
  organisation_id: string,
  competitor_url?: string,
  meta_ad_library_url?: string
): Promise<{ success: boolean; error: PostgrestError | null }> => {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const recordToUpsert = {
    run_id: run_id,
    organisation_id: organisation_id,
    competitor_url: competitor_url,
    meta_ad_library_url: meta_ad_library_url,
    created_at: now,
    updated_at: now
  };

  logger.info(`[adScrapperRepository] Upserting run_id: ${run_id} for competitor: ${competitor_url}`);

  try {
    const { error } = await supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .upsert(recordToUpsert, { onConflict: 'run_id' })
      .select();

    if (error) {
      logger.error(`[adScrapperRepository] Error upserting run_id:`, error);
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (e) {
    logger.error(`[adScrapperRepository] Exception during upsert:`, e);
    return { success: false, error: e as PostgrestError };
  }
};


/**
 * update the db for url and runId and store result
 */

export const update_runner_scrapers = async (
  run_id: string
): Promise<{ success: boolean; error: PostgrestError | null }> => {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .update({
        completed_at: now,
        updated_at: now,
        ads_scraped:1
      })
      .eq('run_id', run_id)
      .select();

    if (error) {
      logger.error(`[adScrapperRepository] Failed to update result for run_id: ${run_id}`, error);
      return { success: false, error:error };
    }

    return { success: true, error: null };
  } catch (e) {
    logger.error(`[adScrapperRepository] Exception while updating result for run_id: ${run_id}`, e);
    return { success: false, error: e as PostgrestError };
  }
};

/**
 * Get the latest completed run_id for a competitor_url
 */
export const getLatestRunIdByCompetitorUrl = async (
  competitor_url: string
): Promise<{ run_id: string | null; error: PostgrestError | null }> => {
  const supabase = getSupabaseClient();
  logger.info(`[adScrapperRepository] getting latest run_id for competitor_url ${competitor_url}`);

  try {
    const { data, error } = await supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .select('run_id')
      .eq('competitor_url', competitor_url)
      .eq('ads_scraped', 1) // Only get completed scraping jobs
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      logger.error(`[adScrapperRepository] Error fetching run_id for competitor ${competitor_url}:`, error);
      return { run_id: null, error };
    }

    if (!data || data.length === 0) {
      // No completed scraping found for this competitor_url
      return { run_id: null, error: null };
    }

    return { run_id: data[0].run_id, error: null };
  } catch (e) {
    logger.error(`[adScrapperRepository] Exception getting run_id by competitor_url:`, e);
    return { run_id: null, error: e as PostgrestError };
  }
};

/**
 * Get competitor_url and organisation_id for a run_id
 */
export const getRunnerDataByRunId = async (
  run_id: string
): Promise<{ data: { competitor_url: string; organisation_id: string } | null; error: PostgrestError | null }> => {
  const supabase = getSupabaseClient();
  logger.info(`[adScrapperRepository] getting runner data for run_id ${run_id}`);

  try {
    const { data, error } = await supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .select('competitor_url, organisation_id')
      .eq('run_id', run_id)
      .single();

    if (error) {
      logger.error(`[adScrapperRepository] Error fetching runner data for run_id ${run_id}:`, error);
      return { data: null, error };
    }

    return { data: data, error: null };
  } catch (e) {
    logger.error(`[adScrapperRepository] Exception getting runner data by run_id:`, e);
    return { data: null, error: e as PostgrestError };
  }
};

/**
 * Check if the most recent scraping job for an organisation is active
 * Active means: ads_scraped = 0 (not completed) and completed_at is null
 */
export const getActiveScrapingJobsByOrganisation = async (
  organisation_id: string
): Promise<{ hasActiveJobs: boolean; activeCount: number; error: PostgrestError | null }> => {
  const supabase = getSupabaseClient();
  logger.info(`[adScrapperRepository] Checking if most recent scraping job is active for organisation ${organisation_id}`);

  try {
    const { data, error } = await supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .select('run_id, ads_scraped, completed_at, created_at')
      .eq('organisation_id', organisation_id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      logger.error(`[adScrapperRepository] Error checking most recent scraping job for organisation ${organisation_id}:`, error);
      return { hasActiveJobs: false, activeCount: 0, error };
    }

    if (!data || data.length === 0) {
      logger.info(`[adScrapperRepository] No scraping jobs found for organisation ${organisation_id}`);
      return { hasActiveJobs: false, activeCount: 0, error: null };
    }

    const mostRecentJob = data[0];
    const isActive = mostRecentJob.ads_scraped === 0 && mostRecentJob.completed_at === null;

    logger.info(`[adScrapperRepository] Most recent job ${mostRecentJob.run_id} for organisation ${organisation_id} is ${isActive ? 'active' : 'inactive'}`);

    return { 
      hasActiveJobs: isActive, 
      activeCount: isActive ? 1 : 0, 
      error: null 
    };
  } catch (e) {
    logger.error(`[adScrapperRepository] Exception checking most recent scraping job for organisation:`, e);
    return { hasActiveJobs: false, activeCount: 0, error: e as PostgrestError };
  }
};





