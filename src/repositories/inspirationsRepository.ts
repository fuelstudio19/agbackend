import { getSupabaseClient } from "../config/supabase";
import { PostgrestError } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { DbInspiration } from "../types/dbSchemaTypes";

const TABLE_NAME = 'inspirations';
const SCHEMA_NAME = 'adgraam';
/**
 * Upsert inspiration (create or update based on external_id)
 */
export const upsertInspiration = async (
  inspirationData: Omit<DbInspiration, 'id' | 'created_at' | 'updated_at' | 'scraped_at'>
): Promise<{ data: DbInspiration | null; error: PostgrestError | null }> => {
  const supabase = getSupabaseClient();
  
  logger.info(`[inspirationsRepository] Upserting inspiration with external_id: ${inspirationData.external_id}`);

  try {
    const { data, error } = await supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .upsert(inspirationData, { onConflict: 'external_id' })
      .select()
      .single();

    if (error) {
      logger.error(`[inspirationsRepository] Error upserting inspiration:`, error);
      return { data: null, error };
    }

    return { data: data as DbInspiration, error: null };
  } catch (e) {
    logger.error(`[inspirationsRepository] Exception during inspiration upsert:`, e);
    return { data: null, error: e as PostgrestError };
  }
};

/**
 * Bulk upsert inspirations
 */
export const bulkUpsertInspirations = async (
  inspirations: Omit<DbInspiration, 'id' | 'created_at' | 'updated_at' | 'scraped_at'>[]
): Promise<{ data: DbInspiration[] | null; error: PostgrestError | null }> => {
  const supabase = getSupabaseClient();
  
  logger.info(`[inspirationsRepository] Bulk upserting ${inspirations.length} inspirations`);

  try {
    const { data, error } = await supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .upsert(inspirations, { onConflict: 'external_id' })
      .select();

    if (error) {
      logger.error(`[inspirationsRepository] Error bulk upserting inspirations:`, error);
      return { data: null, error };
    }

    return { data: data as DbInspiration[], error: null };
  } catch (e) {
    logger.error(`[inspirationsRepository] Exception during bulk upsert:`, e);
    return { data: null, error: e as PostgrestError };
  }
};

/**
 * Get all inspirations with pagination
 */
export const getInspirations = async (
  page: number = 1,
  pageSize: number = 100,
  filters?: {
    brand_name?: string;
    ad_performance?: string;
    brand_industry?: string;
    ad_platforms?: string[];
  },
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'desc'
): Promise<{ data: DbInspiration[] | null; error: PostgrestError | null; count?: number }> => {
  const supabase = getSupabaseClient();

  try {
    let query = supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .select('*', { count: 'exact' });

    // Apply filters
    if (filters?.brand_name) {
      query = query.ilike('brand_name', `%${filters.brand_name}%`);
    }
    if (filters?.ad_performance) {
      query = query.eq('ad_performance', filters.ad_performance);
    }
    if (filters?.brand_industry) {
      query = query.contains('brand_industry', [filters.brand_industry]);
    }
    if (filters?.ad_platforms && filters.ad_platforms.length > 0) {
      query = query.overlaps('ad_platforms', filters.ad_platforms);
    }

    // Apply sorting
    const validSortFields = ['ad_performance_id', 'scraped_at', 'brand_name', 'external_id', 'created_at'];
    const sortField = validSortFields.includes(sortBy || '') ? sortBy : 'scraped_at';
    const ascending = sortOrder === 'asc';
    
    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    const { data, error, count } = await query
      .range(from, to)
      .order(sortField!, { ascending });

    if (error) {
      logger.error(`[inspirationsRepository] Error fetching inspirations:`, error);
      return { data: null, error };
    }

    return { data: data as DbInspiration[], error: null, count: count || 0 };
  } catch (e) {
    logger.error(`[inspirationsRepository] Exception fetching inspirations:`, e);
    return { data: null, error: e as PostgrestError };
  }
};



/**
 * Get inspirations count
 */
export const getInspirationsCount = async (): Promise<{ count: number | null; error: PostgrestError | null }> => {
  const supabase = getSupabaseClient();

  try {
    const { count, error } = await supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .select('*', { count: 'exact', head: true });

    if (error) {
      logger.error(`[inspirationsRepository] Error getting inspirations count:`, error);
      return { count: null, error };
    }

    return { count: count || 0, error: null };
  } catch (e) {
    logger.error(`[inspirationsRepository] Exception getting inspirations count:`, e);
    return { count: null, error: e as PostgrestError };
  }
};