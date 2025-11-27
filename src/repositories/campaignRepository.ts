import { getSupabaseClient } from '../config/supabase';
import { DbCampaign } from '../types/dbSchemaTypes';
import { PostgrestError } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const TABLE_NAME = 'campaigns';
const SCHEMA_NAME = 'adgraam';

/**
 * Upserts multiple Campaign records into the database.
 * Uses randomly generated UUIDs for the primary key (id) and
 * stores the original Facebook campaign IDs in campaign_id.
 */
export const upsertCampaigns = async (
    campaigns: DbCampaign[],
    userId: string,
    organisationId: string
): Promise<{ data: DbCampaign[] | null, error: PostgrestError | null }> => {
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    if (campaigns.length === 0) {
        logger.info('[CampaignRepository] No valid campaign records to upsert.');
        return { data: [], error: null };
    }

    // Preprocess all records to ensure correct formatting and required fields
    const recordsToUpsert = campaigns.map(camp => {
        // Ensure account_id has 'act_' prefix to match with ad_accounts table
        const normalizedAccountId = camp.account_id.startsWith('act_')
            ? camp.account_id
            : `act_${camp.account_id}`;
        
        // Generate a UUID for the primary key
        const uuid = uuidv4();
            
        return {
            ...camp,
            id: uuid, // Use UUID as primary key
            campaign_id: camp.id, // Store original Facebook ID in campaign_id
            account_id: normalizedAccountId, // Use normalized ID with act_ prefix
            name: camp.name,
            organisation_id: organisationId,
            // Add other relevant fields explicitly
            objective: camp.objective,
            status: camp.status,
            effective_status: camp.effective_status,
            buying_type: camp.buying_type,
            daily_budget: camp.daily_budget,
            lifetime_budget: camp.lifetime_budget,
            start_time: camp.start_time,
            stop_time: camp.stop_time,
            insights: camp.insights,
            insights_date_start: camp.insights_date_start,
            insights_date_stop: camp.insights_date_stop,
            created_at: camp.created_at || now, // Set current time if not provided
            updated_at: now, // Always update the updated_at timestamp
        };
    });

    logger.info(`[CampaignRepository] Upserting ${recordsToUpsert.length} campaigns for user ${userId}, org ${organisationId}`);

    try {
        // We need to check which campaigns already exist in the database by their campaign_id and date range
        // First, extract all campaign_ids
        const campaignIds = [...new Set(campaigns.map(c => c.id))];
        
        if (campaignIds.length === 0) {
            return { data: [], error: null };
        }
        
        // Get all existing campaigns with these campaign_ids
        const { data: existingCampaigns, error: fetchError } = await supabase
            .schema(SCHEMA_NAME)
            .from(TABLE_NAME)
            .select('id, campaign_id, insights_date_start, insights_date_stop')
            .in('campaign_id', campaignIds)
            .eq('organisation_id', organisationId);
            
        if (fetchError) {
            logger.error(`[CampaignRepository] Error fetching existing campaigns:`, fetchError);
            return { data: null, error: fetchError };
        }
        
        // Create a map of existing campaigns for quick lookup
        const existingCampaignMap = new Map();
        existingCampaigns?.forEach(campaign => {
            const key = `${campaign.campaign_id}_${campaign.insights_date_start || ''}_${campaign.insights_date_stop || ''}`;
            existingCampaignMap.set(key, campaign.id);
        });
        
        // Separate records that need to be inserted from those that need to be updated
        const recordsToInsert: DbCampaign[] = [];
        const recordsToUpdate: DbCampaign[] = [];
        
        recordsToUpsert.forEach(record => {
            const key = `${record.campaign_id}_${record.insights_date_start || ''}_${record.insights_date_stop || ''}`;
            if (existingCampaignMap.has(key)) {
                // If it already exists, use the existing id for update
                record.id = existingCampaignMap.get(key);
                recordsToUpdate.push(record);
            } else {
                recordsToInsert.push(record);
            }
        });
        
        const results: DbCampaign[] = [];
        
        // Insert new records
        if (recordsToInsert.length > 0) {
            logger.info(`[CampaignRepository] Inserting ${recordsToInsert.length} new campaigns`);
            
            const { data, error } = await supabase
                .schema(SCHEMA_NAME)
                .from(TABLE_NAME)
                .insert(recordsToInsert)
                .select();
            
            if (error) {
                logger.error(`[CampaignRepository] Error inserting campaigns:`, error);
            } else if (data) {
                results.push(...data);
            }
        }
        
        // Update existing records
        if (recordsToUpdate.length > 0) {
            logger.info(`[CampaignRepository] Updating ${recordsToUpdate.length} existing campaigns`);
            
            // Update records one by one because Supabase doesn't support bulk updates
            for (const record of recordsToUpdate) {
                const { data, error } = await supabase
                    .schema(SCHEMA_NAME)
                    .from(TABLE_NAME)
                    .update(record)
                    .eq('id', record.id)
                    .select();
                
                if (error) {
                    logger.error(`[CampaignRepository] Error updating campaign ${record.campaign_id}:`, error);
                } else if (data) {
                    results.push(...data);
                }
            }
        }

        return { data: results as DbCampaign[] | null, error: null };
    } catch (e) {
        logger.error(`[CampaignRepository] Exception upserting campaigns:`, e);
        return { data: null, error: e as PostgrestError };
    }
};

/**
 * Gets a single Campaign by its ID for a specific user and organisation.
 * Optionally can filter by date range for insights.
 */
export const getCampaignById = async (
    campaignId: string,
    userId: string,
    organisationId: string,
    dateStart?: string,
    dateStop?: string
): Promise<{ data: DbCampaign | null, error: PostgrestError | null }> => {
    const supabase = getSupabaseClient();

    logger.info(`[CampaignRepository] Fetching campaign ${campaignId} for user ${userId}, org ${organisationId}${dateStart ? ` from ${dateStart}` : ''}${dateStop ? ` to ${dateStop}` : ''}`);

    try {
        // Start building the query
        let query = supabase
            .schema(SCHEMA_NAME)
            .from(TABLE_NAME)
            .select('*')
            .eq('id', campaignId)
            .eq('organisation_id', organisationId);
        
        // If date range is provided, add filters
        if (dateStart && dateStop) {
            query = query
                .eq('insights_date_start', dateStart)
                .eq('insights_date_stop', dateStop);
        }
        
        const { data, error } = await query.maybeSingle();

        if (error) {
            logger.error(`[CampaignRepository] Error fetching campaign ${campaignId}:`, error);
            return { data: null, error };
        }

        return { data: data as DbCampaign | null, error };
    } catch (e) {
        logger.error(`[CampaignRepository] Exception fetching campaign:`, e);
        return { data: null, error: e as PostgrestError };
    }
};

/**
 * Gets all Campaigns for a specific account, user, and organisation.
 * Optionally can filter by date range for insights.
 */
export const getCampaignsByAccount = async (
    accountId: string, // Expecting 'act_...' format
    userId: string,
    organisationId: string,
    dateStart?: string,
    dateStop?: string
): Promise<{ data: DbCampaign[] | null, error: PostgrestError | null }> => {
    const supabase = getSupabaseClient();

    logger.info(`[CampaignRepository] Fetching campaigns for account ${accountId}, user ${userId}, org ${organisationId}${dateStart ? ` from ${dateStart}` : ''}${dateStop ? ` to ${dateStop}` : ''}`);

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
            logger.error(`[CampaignRepository] Error fetching campaigns for account ${accountId}:`, error);
            return { data: null, error };
        }

        return { data: data as DbCampaign[] | null, error };
    } catch (e) {
        logger.error(`[CampaignRepository] Exception fetching campaigns:`, e);
        return { data: null, error: e as PostgrestError };
    }
}; 