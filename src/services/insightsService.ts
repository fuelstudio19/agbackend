import { getAdAccountInsights as fetchAccountInsightsFromApi, getCampaignInsights as fetchCampaignInsightsFromApi } from './graphApiService';
import { AdInsight, GetInsightsParams } from '../types/graphApiTypes';
import { CacheService } from './cacheService';
import * as adAccountInsightsRepository from '../repositories/adAccountInsightsRepository';
import { logger } from '../utils/logger';

// Cache settings
const insightsCache = new CacheService<AdInsight[]>(900); // Cache insights for 15 minutes

/**
 * Fetches insights for an ad account, with option to refresh from API.
 * 
 * @param accountId - The ad account ID
 * @param userId - User ID for permission checks and DB queries
 * @param organisationId - Organisation ID for DB queries
 * @param refresh - Whether to force refresh from Graph API
 * @param dateStart - Start date in YYYY-MM-DD format
 * @param dateEnd - End date in YYYY-MM-DD format
 * @param breakdowns - Optional array of breakdown dimensions
 * @param timeIncrement - Optional time increment (1 for daily, 'monthly', 'all_days')
 * @returns Promise resolving to array of insights
 */
export const getAdAccountInsights = async (
    accountId: string,
    userId: string,
    organisationId: string,
    refresh: boolean = false,
    dateStart: string,
    dateEnd: string,
    breakdowns?: string[],
    timeIncrement?: 1 | 'monthly' | 'all_days'
): Promise<AdInsight[]> => {
    logger.info(`[InsightsService] Getting insights for account ${accountId}, date range ${dateStart} - ${dateEnd}, refresh=${refresh}`);
    
    // Normalize the account ID
    const numericIdPart = accountId.startsWith('act_') ? accountId.substring(4) : accountId;
    const prefixedId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
    
    // Create cache key based on parameters
    const cacheKey = `insights_${prefixedId}_${dateStart}_${dateEnd}_${breakdowns?.join('_') || ''}_${timeIncrement || ''}`;
    
    // Check cache if not refreshing
    if (!refresh) {
        const cachedInsights = insightsCache.get(cacheKey);
        if (cachedInsights) {
            logger.info(`[InsightsService] Returning cached insights for account ${accountId}`);
            return cachedInsights;
        }
    }
    
    // Try DB before API if not refreshing
    if (!refresh) {
        const { data: dbInsights, error } = await adAccountInsightsRepository.getAdAccountInsights(
            prefixedId,
            dateStart,
            dateEnd,
            userId,
            organisationId
        );
        
        if (!error && dbInsights && dbInsights.length > 0) {
            logger.info(`[InsightsService] Retrieved ${dbInsights.length} insights from DB for account ${accountId}`);
            insightsCache.set(cacheKey, dbInsights);
            return dbInsights;
        }
    }
    
    // If refresh=true or DB fetch fails/empty, get from API
    try {
        logger.info(`[InsightsService] Fetching insights from Graph API for account ${accountId}`);
        
        // Prepare parameters for API call
        const params: GetInsightsParams = {
            level: 'account',
            fields: [
                'account_id',
                'account_name', 
                'date_start',
                'date_stop',
                'impressions',
                'clicks',
                'spend',
                'reach',
                'cpm',
                'cpc',
                'ctr',
                'frequency',
                'actions',
                'cost_per_action_type',
                'unique_actions',
                'video_p25_watched_actions',
                'video_p50_watched_actions',
                'video_p75_watched_actions',
                'video_p95_watched_actions',
                'video_p100_watched_actions',
                'video_avg_time_watched_actions'
            ],
            // Always set time_range since we now always have dateStart and dateEnd
            time_range: { since: dateStart, until: dateEnd }
        };
        
        // Add optional parameters
        if (breakdowns && breakdowns.length > 0) {
            params.breakdowns = breakdowns;
        }
        
        if (timeIncrement) {
            params.time_increment = timeIncrement;
        }
        
        // Fetch from API
        const apiInsights = await fetchAccountInsightsFromApi(prefixedId, params);
        
        if (apiInsights && apiInsights.length > 0) {
            logger.info(`[InsightsService] Successfully fetched ${apiInsights.length} insights from API`);
            
            // Store in DB for future use
            await adAccountInsightsRepository.upsertAdAccountInsights(
                apiInsights,
                prefixedId,
                userId,
                organisationId
            );
            
            // Update cache
            insightsCache.set(cacheKey, apiInsights);
            
            return apiInsights;
        } else {
            logger.info(`[InsightsService] No insights found from API for account ${accountId}`);
            return [];
        }
    } catch (error) {
        logger.error(`[InsightsService] Error fetching insights for account ${accountId}:`, error);
        throw error;
    }
};

/**
 * Fetches insights for a campaign, with option to refresh from API.
 * 
 * @param campaignId - The campaign ID
 * @param accountId - The ad account ID (needed for DB storage)
 * @param userId - User ID for permission checks and DB queries
 * @param organisationId - Organisation ID for DB queries
 * @param refresh - Whether to force refresh from Graph API
 * @param dateStart - Start date in YYYY-MM-DD format
 * @param dateEnd - End date in YYYY-MM-DD format
 * @param breakdowns - Optional array of breakdown dimensions
 * @param timeIncrement - Optional time increment (1 for daily, 'monthly', 'all_days')
 * @returns Promise resolving to array of insights
 */
export const getCampaignInsights = async (
    campaignId: string,
    accountId: string,
    userId: string,
    organisationId: string,
    refresh: boolean = false,
    dateStart: string,
    dateEnd: string,
    breakdowns?: string[],
    timeIncrement?: 1 | 'monthly' | 'all_days'
): Promise<AdInsight[]> => {
    logger.info(`[InsightsService] Getting insights for campaign ${campaignId}, date range ${dateStart} - ${dateEnd}, refresh=${refresh}`);
    
    // Create cache key based on parameters
    const cacheKey = `campaign_insights_${campaignId}_${dateStart}_${dateEnd}_${breakdowns?.join('_') || ''}_${timeIncrement || ''}`;
    
    // Check cache if not refreshing
    if (!refresh) {
        const cachedInsights = insightsCache.get(cacheKey);
        if (cachedInsights) {
            logger.info(`[InsightsService] Returning cached insights for campaign ${campaignId}`);
            return cachedInsights;
        }
    }
    
    // Try DB before API
    if (!refresh) {
        const { data: dbInsights, error } = await adAccountInsightsRepository.getCampaignInsights(
            campaignId,
            dateStart,
            dateEnd,
            userId,
            organisationId
        );
        
        if (!error && dbInsights && dbInsights.length > 0) {
            logger.info(`[InsightsService] Retrieved ${dbInsights.length} insights from DB for campaign ${campaignId}`);
            insightsCache.set(cacheKey, dbInsights);
            return dbInsights;
        }
    }
    
    // If refresh=true or DB fetch fails/empty, get from API
    try {
        logger.info(`[InsightsService] Fetching insights from Graph API for campaign ${campaignId}`);
        
        // Prepare parameters for API call
        const params: GetInsightsParams = {
            level: 'campaign',
            fields: [
                'account_id',
                'account_name',
                'campaign_id',
                'campaign_name',
                'date_start',
                'date_stop',
                'impressions',
                'clicks',
                'spend',
                'reach',
                'cpm',
                'cpc',
                'ctr',
                'frequency',
                'actions',
                'cost_per_action_type',
                'unique_actions',
                'video_p25_watched_actions',
                'video_p50_watched_actions',
                'video_p75_watched_actions',
                'video_p95_watched_actions',
                'video_p100_watched_actions',
                'video_avg_time_watched_actions'
            ],
            // Always set time_range since we now always have dateStart and dateEnd
            time_range: { since: dateStart, until: dateEnd }
        };
        
        // Add optional parameters
        if (breakdowns && breakdowns.length > 0) {
            params.breakdowns = breakdowns;
        }
        
        if (timeIncrement) {
            params.time_increment = timeIncrement;
        }
        
        // Fetch from API
        const apiInsights = await fetchCampaignInsightsFromApi(campaignId, params);
        
        if (apiInsights && apiInsights.length > 0) {
            logger.info(`[InsightsService] Successfully fetched ${apiInsights.length} insights from API`);
            
            // Store in DB for future use
            await adAccountInsightsRepository.upsertCampaignInsights(
                apiInsights,
                campaignId,
                accountId,
                userId,
                organisationId
            );
            
            // Update cache
            insightsCache.set(cacheKey, apiInsights);
            
            return apiInsights;
        } else {
            logger.info(`[InsightsService] No insights found from API for campaign ${campaignId}`);
            return [];
        }
    } catch (error) {
        logger.error(`[InsightsService] Error fetching insights for campaign ${campaignId}:`, error);
        throw error;
    }
}; 