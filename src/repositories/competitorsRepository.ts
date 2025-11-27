import { getSupabaseClient } from "../config/supabase";
import { PostgrestError } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { DbCompetitorProfile } from "../types/dbSchemaTypes";
import { CompetitorDetails } from "../types/onboarding";

const TABLE_NAME = 'competitors';
const SCHEMA_NAME = 'adgraam';

/**
 * Create a new competitor
 */
export const createCompetitor = async (
  competitorData: Omit<DbCompetitorProfile, 'id' | 'created_at' | 'updated_at'>
): Promise<{ data: DbCompetitorProfile | null; error: PostgrestError | null }> => {
  const supabase = getSupabaseClient();
  
  logger.info(`[competitorsRepository] Creating competitor: ${competitorData.name}`);

  try {
    const { data, error } = await supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .insert(competitorData)
      .select()
      .single();

    if (error) {
      logger.error(`[competitorsRepository] Error creating competitor:`, error);
      return { data: null, error };
    }

    return { data: data as DbCompetitorProfile, error: null };
  } catch (e) {
    logger.error(`[competitorsRepository] Exception during competitor creation:`, e);
    return { data: null, error: e as PostgrestError };
  }
};

/**
 * Upsert competitor (create or update based on url and organisation_id)
 */
export const upsertCompetitor = async (
  competitorData: Omit<DbCompetitorProfile, 'id' | 'created_at' | 'updated_at'>
): Promise<{ data: DbCompetitorProfile | null; error: PostgrestError | null }> => {
  const supabase = getSupabaseClient();
  
  logger.info(`[competitorsRepository] Upserting competitor: ${competitorData.name}`);

  try {
    const { data, error } = await supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .upsert(competitorData, { onConflict: 'url,organisation_id' })
      .select()
      .single();

    if (error) {
      logger.error(`[competitorsRepository] Error upserting competitor:`, error);
      return { data: null, error };
    }

    return { data: data as DbCompetitorProfile, error: null };
  } catch (e) {
    logger.error(`[competitorsRepository] Exception during competitor upsert:`, e);
    return { data: null, error: e as PostgrestError };
  }
};

/**
 * Get competitors by organisation
 */
export const getCompetitorsByOrganisation = async (
  organisationId: string
): Promise<{ data: DbCompetitorProfile[] | null; error: PostgrestError | null }> => {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .select('*')
      .eq('organisation_id', organisationId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error(`[competitorsRepository] Error fetching competitors for org ${organisationId}:`, error);
      return { data: null, error };
    }

    return { data: data as DbCompetitorProfile[], error: null };
  } catch (e) {
    logger.error(`[competitorsRepository] Exception fetching competitors:`, e);
    return { data: null, error: e as PostgrestError };
  }
};

/**
 * Get competitor by URL and organisation
 */
export const getCompetitorByUrl = async (
  url: string,
  organisationId: string
): Promise<{ data: DbCompetitorProfile | null; error: PostgrestError | null }> => {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .select('*')
      .eq('url', url)
      .eq('organisation_id', organisationId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      logger.error(`[competitorsRepository] Error fetching competitor by URL:`, error);
      return { data: null, error };
    }

    return { data: data as DbCompetitorProfile || null, error: null };
  } catch (e) {
    logger.error(`[competitorsRepository] Exception fetching competitor by URL:`, e);
    return { data: null, error: e as PostgrestError };
  }
};

/**
 * Bulk upsert competitors from onboarding data
 */
export const bulkUpsertCompetitors = async (
  competitors: CompetitorDetails[],
  organisationId: string
): Promise<{ data: DbCompetitorProfile[] | null; error: PostgrestError | null }> => {
  const supabase = getSupabaseClient();
  
  const competitorRecords = competitors.map(competitor => ({
    meta_ad_library_url: competitor.meta_ad_library_url,
    name: competitor.name,
    url: competitor.url,
    short_write_up: competitor.short_write_up,
    logo: competitor.logo,
    organisation_id: organisationId
  }));

  logger.info(`[competitorsRepository] Bulk upserting ${competitors.length} competitors`);

  try {
    const { data, error } = await supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .upsert(competitorRecords, { onConflict: 'url,organisation_id' })
      .select();

    if (error) {
      logger.error(`[competitorsRepository] Error bulk upserting competitors:`, error);
      return { data: null, error };
    }

    return { data: data as DbCompetitorProfile[], error: null };
  } catch (e) {
    logger.error(`[competitorsRepository] Exception during bulk upsert:`, e);
    return { data: null, error: e as PostgrestError };
  }
}; 