import { getSupabaseClient } from '../config/supabase';
import { DbCreative } from '../types/dbSchemaTypes';
import { PostgrestError } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

const TABLE_NAME = 'creatives';
const SCHEMA_NAME = 'adgraam';

/**
 * Upserts multiple Creative records into the database.
 * Uses the 'id' (Facebook Creative ID) as the conflict target.
 */
export const upsertCreatives = async (
    creatives: DbCreative[],
    userId: string,
    organisationId: string
): Promise<{ data: DbCreative[] | null, error: PostgrestError | null }> => {
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    const recordsToUpsert = creatives.map(creative => {
        // Ensure account_id has 'act_' prefix to match with ad_accounts table
        const normalizedAccountId = creative.account_id.startsWith('act_')
            ? creative.account_id
            : `act_${creative.account_id}`;
            
        return {
            ...creative,
            id: creative.id, // PK
            creative_id: creative.creative_id || creative.id, // Ensure creative_id exists
            account_id: normalizedAccountId, // Use normalized ID with act_ prefix
            name: creative.name,
            organisation_id: organisationId,
            // Add other relevant fields explicitly
            title: creative.title,
            body: creative.body,
            image_url: creative.image_url,
            video_url: creative.video_url,
            image_hash: creative.image_hash,
            object_type: creative.object_type,
            thumbnail_url: creative.thumbnail_url,
            object_story_spec: creative.object_story_spec,
            asset_feed_spec: creative.asset_feed_spec,
            call_to_action_type: creative.call_to_action_type,
            created_at: creative.created_at || now, // Set current time if not provided
            updated_at: now, // Always update the updated_at timestamp
        };
    });

    if (recordsToUpsert.length === 0) {
        logger.info('[CreativeRepository] No valid creative records to upsert.');
        return { data: [], error: null };
    }

    logger.info(`[CreativeRepository] Upserting ${recordsToUpsert.length} creatives for user ${userId}, org ${organisationId}`);

    try {
        const { data, error } = await supabase
            .schema(SCHEMA_NAME)
            .from(TABLE_NAME)
            .upsert(recordsToUpsert, { onConflict: 'id' })
            .select();

        if (error) {
            logger.error(`[CreativeRepository] Error upserting creatives for user ${userId}, org ${organisationId}:`, error);
        }

        return { data: data as DbCreative[] | null, error };
    } catch (e) {
        logger.error(`[CreativeRepository] Exception upserting creatives:`, e);
        return { data: null, error: e as PostgrestError };
    }
};

/**
 * Gets a single Creative by its ID for a specific user and organisation.
 */
export const getCreativeById = async (
    creativeId: string,
    userId: string,
    organisationId: string
): Promise<{ data: DbCreative | null, error: PostgrestError | null }> => {
    const supabase = getSupabaseClient();

    logger.info(`[CreativeRepository] Fetching creative ${creativeId} for user ${userId}, org ${organisationId}`);

    try {
        const { data, error } = await supabase
            .schema(SCHEMA_NAME)
            .from(TABLE_NAME)
            .select('*')
            .eq('id', creativeId)
            .eq('organisation_id', organisationId)
            .maybeSingle();

        if (error) {
            logger.error(`[CreativeRepository] Error fetching creative ${creativeId}:`, error);
        }

        return { data: data as DbCreative | null, error };
    } catch (e) {
        logger.error(`[CreativeRepository] Exception fetching creative:`, e);
        return { data: null, error: e as PostgrestError };
    }
};

/**
 * Gets all Creatives for a specific account, user, and organisation.
 */
export const getCreativesByAccount = async (
    accountId: string,
    userId: string,
    organisationId: string
): Promise<{ data: DbCreative[] | null, error: PostgrestError | null }> => {
    const supabase = getSupabaseClient();

    // Normalize account ID if necessary
    const normalizedAccountId = accountId.startsWith('act_')
        ? accountId
        : `act_${accountId}`;

    logger.info(`[CreativeRepository] Fetching creatives for account ${normalizedAccountId}, user ${userId}, org ${organisationId}`);

    try {
        const { data, error } = await supabase
            .schema(SCHEMA_NAME)
            .from(TABLE_NAME)
            .select('*')
            .eq('account_id', normalizedAccountId)
            .eq('organisation_id', organisationId);

        if (error) {
            logger.error(`[CreativeRepository] Error fetching creatives for account ${normalizedAccountId}:`, error);
        }

        return { data: data as DbCreative[] | null, error };
    } catch (e) {
        logger.error(`[CreativeRepository] Exception fetching creatives:`, e);
        return { data: null, error: e as PostgrestError };
    }
}; 