import { getSupabaseClient } from '../config/supabase';
import { DbAccount } from '../types/dbSchemaTypes';
import { PostgrestError } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

const TABLE_NAME = 'ad_accounts';
const SCHEMA_NAME = 'adgraam';

/**
 * Upserts multiple Ad Account records into the database.
 * Uses the 'id' (Facebook Account ID 'act_...') as the conflict target.
 */
export const upsertAccounts = async (
    accounts: DbAccount[],
    userId: string,
    organisationId: string
): Promise<{ data: DbAccount[] | null, error: PostgrestError | null }> => {
    const supabase = getSupabaseClient();

    const recordsToUpsert = accounts.map(acc => {
        // Ensure ID has act_ prefix
        const fullId = acc.id.startsWith('act_') ? acc.id : `act_${acc.id}`;
        
        return {
            ...acc,
            id: fullId, // PK always with act_ prefix
            account_id: fullId, // Now also storing with act_ prefix
            name: acc.name,
            organisation_id: organisationId,
            // Add other relevant fields explicitly
            account_status: acc.account_status,
            business_name: acc.business_name,
            currency: acc.currency,
            timezone_name: acc.timezone_name,
            // Additional fields from API response
            timezone_offset_hours_utc: acc.timezone_offset_hours_utc,
            business_country_code: acc.business_country_code,
            amount_spent: acc.amount_spent,
            min_campaign_group_spend_cap: acc.min_campaign_group_spend_cap
        };
    });

    if (recordsToUpsert.length === 0) {
        logger.info('[AdAccountRepository] No valid account records to upsert.');
        return { data: [], error: null };
    }

    logger.info(`[AdAccountRepository] Upserting ${recordsToUpsert.length} ad accounts for user ${userId}, org ${organisationId}`);

    try {
        const { data, error } = await supabase
            .schema(SCHEMA_NAME)
            .from(TABLE_NAME)
            .upsert(recordsToUpsert, { onConflict: 'id' })
            .select();

        if (error) {
            logger.error(`[AdAccountRepository] Error upserting ad accounts for user ${userId}, org ${organisationId}:`, error);
        }

        return { data: data as DbAccount[] | null, error };
    } catch (e) {
        logger.error(`[AdAccountRepository] Exception upserting accounts:`, e);
        return { data: null, error: e as PostgrestError };
    }
};

/**
 * Gets a single Ad Account by its ID for a specific user and organisation.
 */
export const getAccountById = async (
    accountId: string, // Expecting 'act_...' format
    userId: string,
    organisationId: string
): Promise<{ data: DbAccount | null, error: PostgrestError | null }> => {
    const supabase = getSupabaseClient();
    
    logger.info(`[AdAccountRepository] Fetching ad account ${accountId} for user ${userId}, org ${organisationId}`);

    try {
        const { data, error } = await supabase
            .schema(SCHEMA_NAME)
            .from(TABLE_NAME)
            .select('*')
            .eq('id', accountId)
            .eq('organisation_id', organisationId)
            .maybeSingle(); // Returns one record or null

        if (error) {
            logger.error(`[AdAccountRepository] Error fetching ad account ${accountId}:`, error);
        }

        return { data: data as DbAccount | null, error };
    } catch (e) {
        logger.error(`[AdAccountRepository] Exception fetching account:`, e);
        return { data: null, error: e as PostgrestError };
    }
};

/**
 * Gets all Ad Accounts for a specific user and organisation.
 */
export const getAllAccounts = async (
    userId: string,
    organisationId: string
): Promise<{ data: DbAccount[] | null, error: PostgrestError | null }> => {
    const supabase = getSupabaseClient();
    
    logger.info(`[AdAccountRepository] Fetching all ad accounts for user ${userId}, org ${organisationId}`);

    try {
        const { data, error } = await supabase
            .schema(SCHEMA_NAME)
            .from(TABLE_NAME)
            .select('*')
            .eq('organisation_id', organisationId);

        if (error) {
            logger.error(`[AdAccountRepository] Error fetching all ad accounts for user ${userId}, org ${organisationId}:`, error);
        }

        return { data: data as DbAccount[] | null, error };
    } catch (e) {
        logger.error(`[AdAccountRepository] Exception fetching all accounts:`, e);
        return { data: null, error: e as PostgrestError };
    }
}; 