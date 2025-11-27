import { getSupabaseClient } from "../config/supabase";
import { PostgrestError } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { DbSelfAdCreative, DbSelfAdCreativeSummary } from "../types/dbSchemaTypes";

const TABLE_NAME = 'self_ad_creatives'
const SCHEMA_NAME = 'adgraam';

const SELECTED_FIELDS = `
  organisation_id,
  ad_archive_id,
  page_id,
  page_name,
  is_active,
  page_profile_picture_url,
  title,
  body,
  link_url,
  caption,
  cta_text,
  display_format,
  resized_image_urls,
  original_image_urls,
  video_hd_urls,
  video_sd_urls,
  image_urls,
  video_urls,
  publisher_platforms,
  start_date,
  end_date
`.trim();

export const upsert_data = async (
  result: DbSelfAdCreative 
): Promise<{ success: boolean; error: PostgrestError | null }> => {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  logger.info(`[selfAdCreativesRepository] Upserting ad_archive_id: ${result.ad_archive_id}`);

  try {
    const { error } = await supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .upsert({
        ...result,
        updated_at: now
      }, { onConflict: 'ad_archive_id' }) // ad_archive_id is unique
      .select();

    if (error) {
      logger.error(`[selfAdCreativesRepository] Error upserting ad_archive_id:`, error);
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (e) {
    logger.error(`[selfAdCreativesRepository] Exception during upsert:`, e);
    return { success: false, error: e as PostgrestError };
  }
};

export const bulk_upsert_data = async (
  results: DbSelfAdCreative[]
): Promise<{ success: boolean; error: PostgrestError | null; inserted_count: number }> => {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  logger.info(`[selfAdCreativesRepository] Bulk upserting ${results.length} self ads`);

  if (results.length === 0) {
    logger.warn(`[selfAdCreativesRepository] No records to upsert`);
    return { success: true, error: null, inserted_count: 0 };
  }

  try {
    // Prepare all records with updated timestamp
    const recordsToUpsert = results.map(result => ({
      ...result,
      updated_at: now
    }));

    const { data, error } = await supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .upsert(recordsToUpsert, { onConflict: 'ad_archive_id' })
      .select('ad_archive_id');

    if (error) {
      logger.error(`[selfAdCreativesRepository] Error bulk upserting self ads:`, error);
      return { success: false, error, inserted_count: 0 };
    }

    const insertedCount = data?.length || 0;
    logger.info(`[selfAdCreativesRepository] Successfully bulk upserted ${insertedCount} self ads`);

    return { success: true, error: null, inserted_count: insertedCount };
  } catch (e) {
    logger.error(`[selfAdCreativesRepository] Exception during bulk upsert:`, e);
    return { success: false, error: e as PostgrestError, inserted_count: 0 };
  }
};

export const getScrapedAdsByRunId = async (
  run_id: string
): Promise<{ data: DbSelfAdCreativeSummary[] | null; error: PostgrestError | null }> => {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .select(SELECTED_FIELDS)
      .eq('run_id', run_id)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error(`[selfAdCreativesRepository] Error fetching self creatives for run_id ${run_id}`, error);
      return { data: null, error };
    }

    return { data: (data as unknown) as DbSelfAdCreativeSummary[], error: null };
  } catch (e) {
    logger.error(`[selfAdCreativesRepository] Exception fetching self creatives by run_id:`, e);
    return { data: null, error: e as PostgrestError };
  }
};

export const getScrapedAdsByRunIdWithPagination = async (
  run_id: string,
  limit: number = 100,
  offset: number = 0
): Promise<{ data: DbSelfAdCreativeSummary[] | null; error: PostgrestError | null; count?: number }> => {
  const supabase = getSupabaseClient();

  try {
    const { data, error, count } = await supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .select(SELECTED_FIELDS, { count: 'exact' })
      .eq('run_id', run_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error(`[selfAdCreativesRepository] Error fetching self creatives for run_id ${run_id} with pagination`, error);
      return { data: null, error };
    }

    return { data: (data as unknown) as DbSelfAdCreativeSummary[], error: null, count: count || 0 };
  } catch (e) {
    logger.error(`[selfAdCreativesRepository] Exception fetching self creatives by run_id with pagination:`, e);
    return { data: null, error: e as PostgrestError };
  }
};

export const getScrapedAdsByOrganisation = async (
  organisation_id: string,
  limit: number = 100,
  offset: number = 0
): Promise<{ data: DbSelfAdCreativeSummary[] | null; error: PostgrestError | null; count?: number }> => {
  const supabase = getSupabaseClient();

  try {
    const { data, error, count } = await supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .select(SELECTED_FIELDS, { count: 'exact' })
      .eq('organisation_id', organisation_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error(`[selfAdCreativesRepository] Error fetching self creatives for organisation ${organisation_id}`, error);
      return { data: null, error };
    }

    return { data: (data as unknown) as DbSelfAdCreativeSummary[], error: null, count: count || 0 };
  } catch (e) {
    logger.error(`[selfAdCreativesRepository] Exception fetching self creatives by organisation:`, e);
    return { data: null, error: e as PostgrestError };
  }
};

export const getScrapedAdsByPageId = async (
  page_id: string,
  organisation_id: string
): Promise<{ data: DbSelfAdCreativeSummary[] | null; error: PostgrestError | null }> => {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .select(SELECTED_FIELDS)
      .eq('page_id', page_id)
      .eq('organisation_id', organisation_id)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error(`[selfAdCreativesRepository] Error fetching self creatives for page_id ${page_id}`, error);
      return { data: null, error };
    }

    return { data: (data as unknown) as DbSelfAdCreativeSummary[], error: null };
  } catch (e) {
    logger.error(`[selfAdCreativesRepository] Exception fetching self creatives by page_id:`, e);
    return { data: null, error: e as PostgrestError };
  }
};

export const getAdCreativeById = async (
  ad_archive_id: string,
  organisation_id: string
): Promise<{ data: DbSelfAdCreativeSummary | null; error: PostgrestError | null }> => {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .select(SELECTED_FIELDS)
      .eq('ad_archive_id', ad_archive_id)
      .eq('organisation_id', organisation_id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      logger.error(`[selfAdCreativesRepository] Error fetching self creative ${ad_archive_id}`, error);
      return { data: null, error };
    }

    return { data: ((data as unknown) as DbSelfAdCreativeSummary) || null, error: null };
  } catch (e) {
    logger.error(`[selfAdCreativesRepository] Exception fetching self creative by id:`, e);
    return { data: null, error: e as PostgrestError };
  }
};

export const deleteAdCreative = async (
  ad_archive_id: string,
  organisation_id: string
): Promise<{ success: boolean; error: PostgrestError | null }> => {
  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .delete()
      .eq('ad_archive_id', ad_archive_id)
      .eq('organisation_id', organisation_id);

    if (error) {
      logger.error(`[selfAdCreativesRepository] Error deleting self creative ${ad_archive_id}`, error);
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (e) {
    logger.error(`[selfAdCreativesRepository] Exception deleting self creative:`, e);
    return { success: false, error: e as PostgrestError };
  }
}; 