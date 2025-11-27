import { logger } from '../utils/logger';
import { AdInsight } from '../types/graphApiTypes';
import { getSupabaseClient } from '../config/supabase';

// This will handle caching the insights data in the database
// Define the database schema for storing account insights
export interface DbAdAccountInsight {
    id: string; // Composite key of account_id + date_start + date_stop
    account_id: string;
    date_start: string;
    date_stop: string;
    metrics: Record<string, any>; // Stores the metrics in JSON format
    organisation_id: string;
    created_at?: string;
    updated_at?: string;
}

// Define the database schema for storing campaign insights
export interface DbCampaignInsight {
    id: string; // Composite key of campaign_id + date_start + date_stop
    campaign_id: string;
    account_id: string;
    date_start: string;
    date_stop: string;
    metrics: Record<string, any>; // Stores the metrics in JSON format
    organisation_id: string;
    created_at?: string;
    updated_at?: string;
}


const SCHEMA_NAME = 'adgraam';
/**
 * Upserts ad account insights into the database
 */
export const upsertAdAccountInsights = async (
    insights: AdInsight[],
    accountId: string,
    userId: string,
    organisationId: string
): Promise<{ data: DbAdAccountInsight[] | null, error: Error | null }> => {
    try {
        const supabase = getSupabaseClient();
        if (!insights || insights.length === 0) {
            return { data: [], error: null };
        }

        // Transform insights into DB format
        const dbInsights: DbAdAccountInsight[] = insights.map(insight => {
            // Create a unique ID based on account_id, date_start, and date_stop
            const id = `${accountId}_${insight.date_start}_${insight.date_stop}`;
            
            return {
                id,
                account_id: accountId,
                date_start: insight.date_start || '',
                date_stop: insight.date_stop || '',
                metrics: insight, // Store the entire insight object as JSON
                organisation_id: organisationId,
                updated_at: new Date().toISOString()
            };
        });

        const { data, error } = await supabase
            .schema(SCHEMA_NAME)
            .from('ad_account_insights')
            .upsert(dbInsights, {
                onConflict: 'id',
                ignoreDuplicates: false
            });

        if (error) {
            logger.error('[AdAccountInsightsRepository] Error upserting insights:', error);
            return { data: null, error };
        }

        return { data: dbInsights, error: null };
    } catch (error) {
        logger.error('[AdAccountInsightsRepository] Exception in upsertAdAccountInsights:', error);
        return { data: null, error: error instanceof Error ? error : new Error('Unknown error') };
    }
};

/**
 * Upserts campaign insights into the database
 */
export const upsertCampaignInsights = async (
    insights: AdInsight[],
    campaignId: string,
    accountId: string,
    userId: string,
    organisationId: string
): Promise<{ data: DbCampaignInsight[] | null, error: Error | null }> => {
    try {
        const supabase = getSupabaseClient();
        if (!insights || insights.length === 0) {
            return { data: [], error: null };
        }

        // Transform insights into DB format
        const dbInsights: DbCampaignInsight[] = insights.map(insight => {
            // Create a unique ID based on campaign_id, date_start, and date_stop
            const id = `${campaignId}_${insight.date_start}_${insight.date_stop}`;
            
            return {
                id,
                campaign_id: campaignId,
                account_id: accountId,
                date_start: insight.date_start || '',
                date_stop: insight.date_stop || '',
                metrics: insight, // Store the entire insight object as JSON
                organisation_id: organisationId,
                updated_at: new Date().toISOString()
            };
        });

        const { data, error } = await supabase
            .schema(SCHEMA_NAME)
            .from('campaign_insights')
            .upsert(dbInsights, {
                onConflict: 'id',
                ignoreDuplicates: false
            });

        if (error) {
            logger.error('[AdAccountInsightsRepository] Error upserting campaign insights:', error);
            return { data: null, error };
        }

        return { data: dbInsights, error: null };
    } catch (error) {
        logger.error('[AdAccountInsightsRepository] Exception in upsertCampaignInsights:', error);
        return { data: null, error: error instanceof Error ? error : new Error('Unknown error') };
    }
};

/**
 * Retrieves ad account insights from the database for a date range
 */
export const getAdAccountInsights = async (
    accountId: string,
    dateStart: string,
    dateStop: string,
    userId: string,
    organisationId: string
): Promise<{ data: AdInsight[] | null, error: Error | null }> => {
    try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
            .schema(SCHEMA_NAME)
            .from('ad_account_insights')
            .select('*')
            .eq('account_id', accountId)
            .eq('organisation_id', organisationId)
            .gte('date_start', dateStart)
            .lte('date_stop', dateStop)
            .order('date_start', { ascending: true });

        if (error) {
            logger.error('[AdAccountInsightsRepository] Error retrieving insights:', error);
            return { data: null, error };
        }

        if (!data || data.length === 0) {
            return { data: [], error: null };
        }

        // Transform database insights back to AdInsight format
        const adInsights: AdInsight[] = data.map((dbInsight: { metrics: AdInsight; }) => dbInsight.metrics as AdInsight);
        
        return { data: adInsights, error: null };
    } catch (error) {
        logger.error('[AdAccountInsightsRepository] Exception in getAdAccountInsights:', error);
        return { data: null, error: error instanceof Error ? error : new Error('Unknown error') };
    }
};

/**
 * Retrieves campaign insights from the database for a date range
 */
export const getCampaignInsights = async (
    campaignId: string,
    dateStart: string,
    dateStop: string,
    userId: string,
    organisationId: string
): Promise<{ data: AdInsight[] | null, error: Error | null }> => {
    try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
            .schema(SCHEMA_NAME)
            .from('campaign_insights')
            .select('*')
            .eq('campaign_id', campaignId)
            .eq('organisation_id', organisationId)
            .gte('date_start', dateStart)
            .lte('date_stop', dateStop)
            .order('date_start', { ascending: true });

        if (error) {
            logger.error('[AdAccountInsightsRepository] Error retrieving campaign insights:', error);
            return { data: null, error };
        }

        if (!data || data.length === 0) {
            return { data: [], error: null };
        }

        // Transform database insights back to AdInsight format
        const campaignInsights: AdInsight[] = data.map((dbInsight: { metrics: AdInsight; }) => dbInsight.metrics as AdInsight);
        
        return { data: campaignInsights, error: null };
    } catch (error) {
        logger.error('[AdAccountInsightsRepository] Exception in getCampaignInsights:', error);
        return { data: null, error: error instanceof Error ? error : new Error('Unknown error') };
    }
}; 