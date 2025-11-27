import { getSupabaseClient } from '../config/supabase';
import { DbBreakdownInsight } from '../types/dbSchemaTypes';
import { BreakdownInsight } from '../types/graphApiTypes';
import { PostgrestError } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const TABLE_NAME = 'breakdown_insights';
const SCHEMA_NAME = 'adgraam';

/**
 * Upserts multiple breakdown insight records into the database.
 * Uses a composite unique key (ad_id, category, subcategory, date_start, date_stop) for conflict resolution.
 */
export const upsertBreakdownInsights = async (
    breakdownInsights: DbBreakdownInsight[],
    userId: string,
    organisationId: string
): Promise<{ data: DbBreakdownInsight[] | null, error: PostgrestError | null }> => {
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    if (breakdownInsights.length === 0) {
        logger.info('[BreakdownInsightsRepository] No breakdown insights to upsert.');
        return { data: [], error: null };
    }

    // Preprocess all records to ensure correct formatting and required fields
    const recordsToUpsert = breakdownInsights.map(insight => {
        // Generate a UUID for the primary key if not provided
        const uuid = insight.id || uuidv4();
            
        return {
            ...insight,
            id: uuid,
            organisation_id: organisationId,
            created_at: insight.created_at || now,
            updated_at: now, // Always update the updated_at timestamp
        };
    });

    logger.info(`[BreakdownInsightsRepository] Upserting ${recordsToUpsert.length} breakdown insights for user ${userId}, org ${organisationId}`);

    try {
        // We need to check which breakdown insights already exist in the database
        // Create a map to track existing records
        const existingRecordsMap = new Map<string, string>();
        
        // Get all existing breakdown insights for the ads in question
        const adIds = [...new Set(breakdownInsights.map(insight => insight.ad_id))];
        
        if (adIds.length > 0) {
            const { data: existingInsights, error: fetchError } = await supabase
                .schema(SCHEMA_NAME)
                .from(TABLE_NAME)
                .select('id, ad_id, category, subcategory, date_start, date_stop')
                .in('ad_id', adIds)
                .eq('organisation_id', organisationId);
                
            if (fetchError) {
                logger.error(`[BreakdownInsightsRepository] Error fetching existing breakdown insights:`, fetchError);
                return { data: null, error: fetchError };
            }
            
            // Create a map of existing insights for quick lookup
            existingInsights?.forEach(insight => {
                const key = `${insight.ad_id}_${insight.category}_${insight.subcategory}_${insight.date_start}_${insight.date_stop}`;
                existingRecordsMap.set(key, insight.id);
            });
        }
        
        // Separate records that need to be inserted from those that need to be updated
        const recordsToInsert: DbBreakdownInsight[] = [];
        const recordsToUpdate: DbBreakdownInsight[] = [];
        
        recordsToUpsert.forEach(record => {
            const key = `${record.ad_id}_${record.category}_${record.subcategory}_${record.date_start}_${record.date_stop}`;
            if (existingRecordsMap.has(key)) {
                // If it already exists, use the existing id for update
                record.id = existingRecordsMap.get(key)!;
                recordsToUpdate.push(record);
            } else {
                recordsToInsert.push(record);
            }
        });
        
        const results: DbBreakdownInsight[] = [];
        
        // Insert new records
        if (recordsToInsert.length > 0) {
            logger.info(`[BreakdownInsightsRepository] Inserting ${recordsToInsert.length} new breakdown insights`);
            
            const { data, error } = await supabase
                .schema(SCHEMA_NAME)
                .from(TABLE_NAME)
                .insert(recordsToInsert)
                .select();
            
            if (error) {
                logger.error(`[BreakdownInsightsRepository] Error inserting breakdown insights:`, error);
                return { data: null, error };
            } else if (data) {
                results.push(...data);
            }
        }
        
        // Update existing records
        if (recordsToUpdate.length > 0) {
            logger.info(`[BreakdownInsightsRepository] Updating ${recordsToUpdate.length} existing breakdown insights`);
            
            // Update records one by one because Supabase doesn't support bulk updates
            for (const record of recordsToUpdate) {
                const { data, error } = await supabase
                    .schema(SCHEMA_NAME)
                    .from(TABLE_NAME)
                    .update(record)
                    .eq('id', record.id)
                    .select();
                
                if (error) {
                    logger.error(`[BreakdownInsightsRepository] Error updating breakdown insight ${record.id}:`, error);
                } else if (data) {
                    results.push(...data);
                }
            }
        }

        return { data: results as DbBreakdownInsight[] | null, error: null };
    } catch (e) {
        logger.error(`[BreakdownInsightsRepository] Exception upserting breakdown insights:`, e);
        return { data: null, error: e as PostgrestError };
    }
};

/**
 * Gets breakdown insights for a specific ad, user, and organisation.
 * Optionally can filter by category, subcategory, and date range.
 */
export const getBreakdownInsightsByAd = async (
    adId: string,
    userId: string,
    organisationId: string,
    category?: string,
    subcategory?: string,
    dateStart?: string,
    dateStop?: string
): Promise<{ data: DbBreakdownInsight[] | null, error: PostgrestError | null }> => {
    const supabase = getSupabaseClient();

    logger.info(`[BreakdownInsightsRepository] Fetching breakdown insights for ad ${adId}, user ${userId}, org ${organisationId}${category ? `, category ${category}` : ''}${subcategory ? `, subcategory ${subcategory}` : ''}${dateStart ? ` from ${dateStart}` : ''}${dateStop ? ` to ${dateStop}` : ''}`);

    try {
        // Start building the query
        let query = supabase
            .schema(SCHEMA_NAME)
            .from(TABLE_NAME)
            .select('*')
            .eq('ad_id', adId)
            .eq('organisation_id', organisationId);
            
        // Add optional filters
        if (category) {
            query = query.eq('category', category);
        }
        
        if (subcategory) {
            query = query.eq('subcategory', subcategory);
        }
            
        // If date range is provided, add filters
        if (dateStart && dateStop) {
            query = query
                .eq('date_start', dateStart)
                .eq('date_stop', dateStop);
        }
            
        const { data, error } = await query;

        if (error) {
            logger.error(`[BreakdownInsightsRepository] Error fetching breakdown insights for ad ${adId}:`, error);
            return { data: null, error };
        }

        return { data: data as DbBreakdownInsight[] | null, error };
    } catch (e) {
        logger.error(`[BreakdownInsightsRepository] Exception fetching breakdown insights:`, e);
        return { data: null, error: e as PostgrestError };
    }
};

/**
 * Gets a single breakdown insight by its ID for a specific user and organisation.
 */
export const getBreakdownInsightById = async (
    id: string,
    userId: string,
    organisationId: string
): Promise<{ data: DbBreakdownInsight | null, error: PostgrestError | null }> => {
    const supabase = getSupabaseClient();
    
    logger.info(`[BreakdownInsightsRepository] Fetching breakdown insight ${id} for user ${userId}, org ${organisationId}`);

    try {
        const { data, error } = await supabase
            .schema(SCHEMA_NAME)
            .from(TABLE_NAME)
            .select('*')
            .eq('id', id)
            .eq('organisation_id', organisationId)
            .maybeSingle(); // Returns one record or null

        if (error) {
            logger.error(`[BreakdownInsightsRepository] Error fetching breakdown insight ${id}:`, error);
        }

        return { data: data as DbBreakdownInsight | null, error };
    } catch (e) {
        logger.error(`[BreakdownInsightsRepository] Exception fetching breakdown insight:`, e);
        return { data: null, error: e as PostgrestError };
    }
};

/**
 * Deletes breakdown insights for a specific ad, optionally filtered by category and date range.
 */
export const deleteBreakdownInsights = async (
    adId: string,
    userId: string,
    organisationId: string,
    category?: string,
    dateStart?: string,
    dateStop?: string
): Promise<{ error: PostgrestError | null }> => {
    const supabase = getSupabaseClient();
    
    logger.info(`[BreakdownInsightsRepository] Deleting breakdown insights for ad ${adId}, user ${userId}, org ${organisationId}${category ? `, category ${category}` : ''}${dateStart ? ` from ${dateStart}` : ''}${dateStop ? ` to ${dateStop}` : ''}`);

    try {
        // Start building the query
        let query = supabase
            .schema(SCHEMA_NAME)
            .from(TABLE_NAME)
            .delete()
            .eq('ad_id', adId)
            .eq('organisation_id', organisationId);
            
        // Add optional filters
        if (category) {
            query = query.eq('category', category);
        }
            
        // If date range is provided, add filters
        if (dateStart && dateStop) {
            query = query
                .eq('date_start', dateStart)
                .eq('date_stop', dateStop);
        }
            
        const { error } = await query;

        if (error) {
            logger.error(`[BreakdownInsightsRepository] Error deleting breakdown insights for ad ${adId}:`, error);
        }

        return { error };
    } catch (e) {
        logger.error(`[BreakdownInsightsRepository] Exception deleting breakdown insights:`, e);
        return { error: e as PostgrestError };
    }
}; 