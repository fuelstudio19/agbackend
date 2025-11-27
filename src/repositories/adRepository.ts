import { getSupabaseClient } from '../config/supabase';
import { DbAd } from '../types/dbSchemaTypes';
import { PostgrestError } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const TABLE_NAME = 'ads';
const SCHEMA_NAME = 'adgraam';

/**
 * Upserts multiple Ad records into the database.
 * Uses randomly generated UUIDs for the primary key (id) and
 * stores the original Facebook ad IDs in ad_id.
 */
export const upsertAds = async (
    ads: DbAd[],
    userId: string,
    organisationId: string
): Promise<{ data: DbAd[] | null, error: PostgrestError | null }> => {
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    if (ads.length === 0) {
        logger.info('[AdRepository] No valid ad records to upsert.');
        return { data: [], error: null };
    }

    // Preprocess all records to ensure correct formatting and required fields
    const recordsToUpsert = ads.map(ad => {
        // Ensure account_id has 'act_' prefix to match with ad_accounts table
        const normalizedAccountId = ad.account_id.startsWith('act_')
            ? ad.account_id
            : `act_${ad.account_id}`;
        
        // Generate a UUID for the primary key
        const uuid = uuidv4();
            
        return {
            ...ad,
            id: uuid, // Use UUID as primary key
            ad_id: ad.ad_id, // Store original Facebook ID in ad_id
            account_id: normalizedAccountId, // Use normalized ID with act_ prefix
            campaign_id: ad.campaign_id,
            ad_set_id: ad.ad_set_id,
            name: ad.name,
            organisation_id: organisationId,
            status: ad.status,
            effective_status: ad.effective_status,
            creative_id: ad.creative_id,
            preview_shareable_link: ad.preview_shareable_link,
            tracking_data: ad.tracking_data,
            insights: ad.insights,
            insights_date_start: ad.insights_date_start,
            insights_date_stop: ad.insights_date_stop,
            created_at: ad.created_at || now, // Set current time if not provided
            updated_at: now, // Always update the updated_at timestamp
        };
    });

    logger.info(`[AdRepository] Upserting ${recordsToUpsert.length} ads for user ${userId}, org ${organisationId}`);

    try {
        // We need to check which ads already exist in the database by their ad_id and date range
        // First, extract all ad_ids
        const adIds = [...new Set(ads.map(a => a.id))];
        
        if (adIds.length === 0) {
            return { data: [], error: null };
        }
        
        // Get all existing ads with these ad_ids
        const { data: existingAds, error: fetchError } = await supabase
            .schema(SCHEMA_NAME)
            .from(TABLE_NAME)
            .select('id, ad_id, insights_date_start, insights_date_stop')
            .in('ad_id', adIds)
            .eq('organisation_id', organisationId);
            
        if (fetchError) {
            logger.error(`[AdRepository] Error fetching existing ads:`, fetchError);
            return { data: null, error: fetchError };
        }
        
        // Create a map of existing ads for quick lookup
        const existingAdMap = new Map();
        existingAds?.forEach(ad => {
            const key = `${ad.ad_id}_${ad.insights_date_start || ''}_${ad.insights_date_stop || ''}`;
            existingAdMap.set(key, ad.id);
        });
        
        // Separate records that need to be inserted from those that need to be updated
        const recordsToInsert: DbAd[] = [];
        const recordsToUpdate: DbAd[] = [];
        
        recordsToUpsert.forEach(record => {
            const key = `${record.ad_id}_${record.insights_date_start || ''}_${record.insights_date_stop || ''}`;
            if (existingAdMap.has(key)) {
                // If it already exists, use the existing id for update
                record.id = existingAdMap.get(key);
                recordsToUpdate.push(record);
            } else {
                recordsToInsert.push(record);
            }
        });
        
        const results: DbAd[] = [];
        
        // Insert new records
        if (recordsToInsert.length > 0) {
            logger.info(`[AdRepository] Inserting ${recordsToInsert.length} new ads`);
            
            const { data, error } = await supabase
                .schema(SCHEMA_NAME)
                .from(TABLE_NAME)
                .insert(recordsToInsert)
                .select();
            
            if (error) {
                logger.error(`[AdRepository] Error inserting ads:`, error);
            } else if (data) {
                results.push(...data);
            }
        }
        
        // Update existing records
        if (recordsToUpdate.length > 0) {
            logger.info(`[AdRepository] Updating ${recordsToUpdate.length} existing ads`);
            
            // Update records one by one because Supabase doesn't support bulk updates
            for (const record of recordsToUpdate) {
                const { data, error } = await supabase
                    .schema(SCHEMA_NAME)
                    .from(TABLE_NAME)
                    .update(record)
                    .eq('id', record.id)
                    .select();
                
                if (error) {
                    logger.error(`[AdRepository] Error updating ad ${record.ad_id}:`, error);
                } else if (data) {
                    results.push(...data);
                }
            }
        }

        return { data: results as DbAd[] | null, error: null };
    } catch (e) {
        logger.error(`[AdRepository] Exception upserting ads:`, e);
        return { data: null, error: e as PostgrestError };
    }
};

/**
 * Gets a single Ad by its ID for a specific user and organisation.
 * Optionally can filter by date range for insights.
 */
export const getAdById = async (
    adId: string,
    userId: string,
    organisationId: string,
    dateStart?: string,
    dateStop?: string
): Promise<{ data: DbAd | null, error: PostgrestError | null }> => {
    const supabase = getSupabaseClient();

    logger.info(`[AdRepository] Fetching ad ${adId} for user ${userId}, org ${organisationId}${dateStart ? ` from ${dateStart}` : ''}${dateStop ? ` to ${dateStop}` : ''}`);

    try {
        // Start building the query
        let query = supabase
            .schema(SCHEMA_NAME)
            .from(TABLE_NAME)
            .select('*')
            .eq('id', adId)
            .eq('organisation_id', organisationId);
        
        // If date range is provided, add filters
        if (dateStart && dateStop) {
            query = query
                .eq('insights_date_start', dateStart)
                .eq('insights_date_stop', dateStop);
        }
        
        const { data, error } = await query.maybeSingle();

        if (error) {
            logger.error(`[AdRepository] Error fetching ad ${adId}:`, error);
            return { data: null, error };
        }

        return { data: data as DbAd | null, error };
    } catch (e) {
        logger.error(`[AdRepository] Exception fetching ad:`, e);
        return { data: null, error: e as PostgrestError };
    }
};

/**
 * Gets all Ads for a specific ad set, user, and organisation.
 * Optionally can filter by date range for insights.
 */
export const getAdsByAdSet = async (
    adSetId: string,
    userId: string,
    organisationId: string,
    dateStart?: string,
    dateStop?: string
): Promise<{ data: DbAd[] | null, error: PostgrestError | null }> => {
    const supabase = getSupabaseClient();

    logger.info(`[AdRepository] Fetching ads for ad set ${adSetId}, user ${userId}, org ${organisationId}${dateStart ? ` from ${dateStart}` : ''}${dateStop ? ` to ${dateStop}` : ''}`);

    try {
        // Start building the query
        let query = supabase
            .schema(SCHEMA_NAME)
            .from(TABLE_NAME)
            .select('*')
            .eq('ad_set_id', adSetId)
            .eq('organisation_id', organisationId);
            
        // If date range is provided, add filters
        if (dateStart && dateStop) {
            query = query
                .eq('insights_date_start', dateStart)
                .eq('insights_date_stop', dateStop);
        }
            
        const { data, error } = await query;

        if (error) {
            logger.error(`[AdRepository] Error fetching ads for ad set ${adSetId}:`, error);
            return { data: null, error };
        }

        return { data: data as DbAd[] | null, error };
    } catch (e) {
        logger.error(`[AdRepository] Exception fetching ads:`, e);
        return { data: null, error: e as PostgrestError };
    }
};

/**
 * Gets all Ads for a specific campaign, user, and organisation.
 * Optionally can filter by date range for insights.
 */
export const getAdsByCampaign = async (
    campaignId: string,
    userId: string,
    organisationId: string,
    dateStart?: string,
    dateStop?: string
): Promise<{ data: DbAd[] | null, error: PostgrestError | null }> => {
    const supabase = getSupabaseClient();

    logger.info(`[AdRepository] Fetching ads for campaign ${campaignId}, user ${userId}, org ${organisationId}${dateStart ? ` from ${dateStart}` : ''}${dateStop ? ` to ${dateStop}` : ''}`);

    try {
        // Start building the query
        let query = supabase
            .schema(SCHEMA_NAME)
            .from(TABLE_NAME)
            .select('*')
            .eq('campaign_id', campaignId)
            .eq('organisation_id', organisationId);
            
        // If date range is provided, add filters
        if (dateStart && dateStop) {
            query = query
                .eq('insights_date_start', dateStart)
                .eq('insights_date_stop', dateStop);
        }
            
        const { data, error } = await query;

        if (error) {
            logger.error(`[AdRepository] Error fetching ads for campaign ${campaignId}:`, error);
            return { data: null, error };
        }

        return { data: data as DbAd[] | null, error };
    } catch (e) {
        logger.error(`[AdRepository] Exception fetching ads:`, e);
        return { data: null, error: e as PostgrestError };
    }
};

/**
 * Gets all Ads for a specific account, user, and organisation.
 * Optionally can filter by date range for insights.
 */
export const getAdsByAccount = async (
    accountId: string,
    userId: string,
    organisationId: string,
    dateStart?: string,
    dateStop?: string
): Promise<{ data: DbAd[] | null, error: PostgrestError | null }> => {
    const supabase = getSupabaseClient();

    logger.info(`[AdRepository] Fetching ads for account ${accountId}, user ${userId}, org ${organisationId}${dateStart ? ` from ${dateStart}` : ''}${dateStop ? ` to ${dateStop}` : ''}`);

    try {
        // Start building the query
        let query = supabase
            .schema(SCHEMA_NAME)
            .from(TABLE_NAME)
            .select('*')
            .eq('account_id', accountId)
            .eq('organisation_id', organisationId);
            
        // If date range is provided, add filters
        if (dateStart && dateStop) {
            query = query
                .eq('insights_date_start', dateStart)
                .eq('insights_date_stop', dateStop);
        }
            
        const { data, error } = await query;

        if (error) {
            logger.error(`[AdRepository] Error fetching ads for account ${accountId}:`, error);
            return { data: null, error };
        }

        return { data: data as DbAd[] | null, error };
    } catch (e) {
        logger.error(`[AdRepository] Exception fetching ads:`, e);
        return { data: null, error: e as PostgrestError };
    }
}; 