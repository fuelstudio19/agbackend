import { getSupabaseClient } from '../config/supabase';
import { DbAdSet } from '../types/dbSchemaTypes';
import { PostgrestError } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

const TABLE_NAME = 'ad_sets';
const SCHEMA_NAME = 'adgraam';

/**
 * Upserts multiple Ad Set records into the database.
 * Uses the 'id' (Facebook Ad Set ID) as the conflict target.
 */
export const upsertAdSets = async (
    adSets: DbAdSet[],
    userId: string,
    organisationId: string
): Promise<{ data: DbAdSet[] | null, error: PostgrestError | null }> => {
    const supabase = getSupabaseClient();

    const recordsToUpsert = adSets.map(adSet => {
        // Ensure account_id has 'act_' prefix to match with ad_accounts table
        const normalizedAccountId = adSet.account_id.startsWith('act_')
            ? adSet.account_id
            : `act_${adSet.account_id}`;
            
        return {
            ...adSet,
            id: adSet.id, // PK
            ad_set_id: adSet.ad_set_id || adSet.id, // Ensure ad_set_id exists
            account_id: normalizedAccountId, // Use normalized ID with act_ prefix
            campaign_id: adSet.campaign_id,
            name: adSet.name,
            organisation_id: organisationId,
            // Add other relevant fields explicitly
            status: adSet.status,
            effective_status: adSet.effective_status,
            daily_budget: adSet.daily_budget,
            lifetime_budget: adSet.lifetime_budget,
            start_time: adSet.start_time,
            stop_time: adSet.stop_time,
            optimization_goal: adSet.optimization_goal,
            billing_event: adSet.billing_event,
            targeting: adSet.targeting, // Assuming targeting is already a JSON object
        };
    });

    if (recordsToUpsert.length === 0) {
        logger.info('[AdSetRepository] No valid ad set records to upsert.');
        return { data: [], error: null };
    }

    logger.info(`[AdSetRepository] Upserting ${recordsToUpsert.length} ad sets for user ${userId}, org ${organisationId}`);

    try {
        const { data, error } = await supabase
            .schema(SCHEMA_NAME)
            .from(TABLE_NAME)
            .upsert(recordsToUpsert, { onConflict: 'id' })
            .select();

        if (error) {
            logger.error(`[AdSetRepository] Error upserting ad sets for user ${userId}, org ${organisationId}:`, error);
        }

        return { data: data as DbAdSet[] | null, error };
    } catch (e) {
        logger.error(`[AdSetRepository] Exception upserting ad sets:`, e);
        return { data: null, error: e as PostgrestError };
    }
};

/**
 * Gets a single Ad Set by its ID for a specific user and organisation.
 */
export const getAdSetById = async (
    adSetId: string,
    userId: string,
    organisationId: string
): Promise<{ data: DbAdSet | null, error: PostgrestError | null }> => {
    const supabase = getSupabaseClient();

    logger.info(`[AdSetRepository] Fetching ad set ${adSetId} for user ${userId}, org ${organisationId}`);

    try {
        const { data, error } = await supabase
            .schema(SCHEMA_NAME)
            .from(TABLE_NAME)
            .select('*')
            .eq('id', adSetId)
            .eq('organisation_id', organisationId)
            .maybeSingle();

        if (error) {
            logger.error(`[AdSetRepository] Error fetching ad set ${adSetId}:`, error);
        }

        return { data: data as DbAdSet | null, error };
    } catch (e) {
        logger.error(`[AdSetRepository] Exception fetching ad set:`, e);
        return { data: null, error: e as PostgrestError };
    }
};

/**
 * Gets all Ad Sets for a specific campaign, user, and organisation.
 */
export const getAdSetsByCampaign = async (
    campaignId: string,
    userId: string,
    organisationId: string
): Promise<{ data: DbAdSet[] | null, error: PostgrestError | null }> => {
    const supabase = getSupabaseClient();

    logger.info(`[AdSetRepository] Fetching ad sets for campaign ${campaignId}, user ${userId}, org ${organisationId}`);

    try {
        const { data, error } = await supabase
            .schema(SCHEMA_NAME)
            .from(TABLE_NAME)
            .select('*')
            .eq('campaign_id', campaignId)
            .eq('organisation_id', organisationId);

        if (error) {
            logger.error(`[AdSetRepository] Error fetching ad sets for campaign ${campaignId}:`, error);
        }

        return { data: data as DbAdSet[] | null, error };
    } catch (e) {
        logger.error(`[AdSetRepository] Exception fetching ad sets:`, e);
        return { data: null, error: e as PostgrestError };
    }
}; 