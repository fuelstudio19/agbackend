import { getCampaigns, getCampaignById as getGraphCampaignById } from './graphApiService';
import { Campaign } from '../types/graphApiTypes';
import { CacheService } from './cacheService';
import * as campaignRepository from '../repositories/campaignRepository';
import { DbCampaign } from '../types/dbSchemaTypes';
import { safeGet } from '../utils/general';
import { logger } from '../utils/logger';
// Cache configuration - adjust TTL as needed
const campaignListCache = new CacheService<Campaign[]>(900); // Cache campaign lists for 15 minutes
const campaignCache = new CacheService<Campaign>(900); // Cache individual campaigns for 15 minutes

/**
 * Maps a Facebook Campaign object from the Graph API to our DbCampaign schema
 */
const mapApiCampaignToDbCampaign = (apiCampaign: Campaign): DbCampaign => {
    // Ensure required fields exist
    if (!apiCampaign.id) {
        logger.error(`[CampaignService] API Campaign is missing id field`);
        throw new Error('Cannot map API Campaign to database schema: missing id field');
    }
    if (!apiCampaign.account_id) {
        logger.error(`[CampaignService] API Campaign ${apiCampaign.id} is missing account_id`);
        throw new Error(`Cannot map Campaign ${apiCampaign.id} to database schema: missing account_id`);
    }

    // Ensure account_id has the 'act_' prefix to match the ad_accounts table's id field format
    const normalizedAccountId = apiCampaign.account_id.startsWith('act_')
        ? apiCampaign.account_id
        : `act_${apiCampaign.account_id}`;

    // Extract date range from insights if present
    let insights_date_start: string | undefined;
    let insights_date_stop: string | undefined;
    
    if (apiCampaign.insights && apiCampaign.insights.data && apiCampaign.insights.data.length > 0) {
        const insightsData = apiCampaign.insights.data[0];
        insights_date_start = insightsData.date_start;
        insights_date_stop = insightsData.date_stop;
    }

    return {
        id: apiCampaign.id,
        campaign_id: apiCampaign.id,
        account_id: normalizedAccountId, // Use the normalized account ID with 'act_' prefix
        name: apiCampaign.name || 'Unnamed Campaign', // Default value for required string field
        objective: safeGet(apiCampaign, 'objective'),
        status: safeGet(apiCampaign, 'status'),
        effective_status: safeGet(apiCampaign, 'effective_status'),
        buying_type: safeGet(apiCampaign, 'buying_type'),
        daily_budget: safeGet(apiCampaign, 'daily_budget'),
        lifetime_budget: safeGet(apiCampaign, 'lifetime_budget'),
        start_time: safeGet(apiCampaign, 'start_time'),
        stop_time: safeGet(apiCampaign, 'stop_time'),
        organisation_id: '', // Will be filled in by repository function
        insights: safeGet(apiCampaign, 'insights'),
        insights_date_start,
        insights_date_stop
    };
};

/**
 * Converts a database campaign object to the API format expected by clients
 */
function dbCampaignToApiCampaign(dbCampaign: DbCampaign): Campaign {
    // Create a base Campaign with required fields
    const campaign: Campaign = {
        id: dbCampaign.campaign_id || dbCampaign.id, // Use campaign_id (FB ID) for external API
        account_id: dbCampaign.account_id,
        name: dbCampaign.name,
    };

    // Add optional fields if present
    if (dbCampaign.objective !== undefined) {
        (campaign as any).objective = dbCampaign.objective;
    }
    if (dbCampaign.status !== undefined) {
        (campaign as any).status = dbCampaign.status;
    }
    if (dbCampaign.effective_status !== undefined) {
        (campaign as any).effective_status = dbCampaign.effective_status;
    }
    if (dbCampaign.buying_type !== undefined) {
        (campaign as any).buying_type = dbCampaign.buying_type;
    }
    if (dbCampaign.daily_budget !== undefined) {
        (campaign as any).daily_budget = dbCampaign.daily_budget;
    }
    if (dbCampaign.lifetime_budget !== undefined) {
        (campaign as any).lifetime_budget = dbCampaign.lifetime_budget;
    }
    if (dbCampaign.start_time !== undefined) {
        (campaign as any).start_time = dbCampaign.start_time;
    }
    if (dbCampaign.stop_time !== undefined) {
        (campaign as any).stop_time = dbCampaign.stop_time;
    }

    if (dbCampaign.insights !== undefined) {
        (campaign as any).insights = dbCampaign.insights;
    }
    
    if (dbCampaign.insights_date_start !== undefined) {
        (campaign as any).insights_date_start = dbCampaign.insights_date_start;
    }
    
    if (dbCampaign.insights_date_stop !== undefined) {
        (campaign as any).insights_date_stop = dbCampaign.insights_date_stop;
    }

    // Add internal DB id as a property for reference if needed
    (campaign as any).db_id = dbCampaign.id;

    return campaign;
}

/**
 * Fetches campaigns for a specific ad account, with option to refresh from API.
 * If refresh is true, fetches from Graph API and updates the database.
 * Otherwise, tries to retrieve from the database first.
 * 
 * @param accountId - The ad account ID
 * @param userId - User ID for permission checks and DB queries
 * @param organisationId - Organisation ID for DB queries
 * @param refresh - Whether to force refresh from Graph API
 * @param dateStart - Start date for campaign insights
 * @param dateStop - End date for campaign insights
 */
export const getCampaignsForAccount = async (
    accountId: string, 
    userId: string,
    organisationId: string,
    refresh: boolean = false,
    dateStart: string,
    dateStop: string
): Promise<Campaign[]> => {
    logger.info(`[CampaignService] Getting campaigns for account ${accountId}, user ${userId}, org ${organisationId}, refresh=${refresh}, dateStart=${dateStart}, dateStop=${dateStop}`);
    
    const normalizedAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
    
    if (refresh) {
        return await refreshAndStoreCampaigns(normalizedAccountId, userId, organisationId, dateStart, dateStop);
    }

    try {
        const { data: dbCampaigns, error } = await campaignRepository.getCampaignsByAccount(normalizedAccountId, userId, organisationId, dateStart, dateStop);
        
        if (error) {
            logger.error(`[CampaignService] Error fetching campaigns from DB:`, error);
            return await refreshAndStoreCampaigns(normalizedAccountId, userId, organisationId, dateStart, dateStop);
        }
        
        if (!dbCampaigns || dbCampaigns.length === 0) {
            logger.info(`[CampaignService] No campaigns found in DB for account ${accountId} with date range ${dateStart} to ${dateStop}, fetching from API`);
            return await refreshAndStoreCampaigns(normalizedAccountId, userId, organisationId, dateStart, dateStop);
        }
        
        logger.info(`[CampaignService] Returning ${dbCampaigns.length} campaigns from DB`);
        return dbCampaigns.map(dbCampaignToApiCampaign);
    } catch (e) {
        logger.error(`[CampaignService] Exception fetching campaigns from DB:`, e);
        return await refreshAndStoreCampaigns(normalizedAccountId, userId, organisationId, dateStart, dateStop);
    }
};

/**
 * Fetches a specific campaign by ID, with option to refresh from API.
 * 
 * @param campaignId - The campaign ID to fetch
 * @param userId - User ID for permission checks and DB queries
 * @param organisationId - Organisation ID for DB queries
 * @param refresh - Whether to force refresh from Graph API
 * @param dateStart - Start date for campaign insights
 * @param dateStop - End date for campaign insights
 */
export const getCampaignById = async (
    campaignId: string, 
    userId: string,
    organisationId: string,
    refresh: boolean = false,
    dateStart: string,
    dateStop: string
): Promise<Campaign | null> => {
    logger.info(`[CampaignService] Getting campaign ${campaignId} for user ${userId}, org ${organisationId}, refresh=${refresh}, dateStart=${dateStart}, dateStop=${dateStop}`);
    
    // If refresh=true, get from API and upsert to DB
    if (refresh) {
        return await refreshAndStoreCampaignById(campaignId, userId, organisationId, dateStart, dateStop);
    }
    
    // Try DB first
    try {
        const { data: dbCampaign, error } = await campaignRepository.getCampaignById(campaignId, userId, organisationId, dateStart, dateStop);
        
        if (error) {
            logger.error(`[CampaignService] Error fetching campaign ${campaignId} from DB:`, error);
            // Fall back to API
            return await refreshAndStoreCampaignById(campaignId, userId, organisationId, dateStart, dateStop);
        }
        
        if (!dbCampaign) {
            logger.info(`[CampaignService] Campaign ${campaignId} not found in DB with date range ${dateStart} to ${dateStop}, checking API`);
            // Not found in DB, try API
            return await refreshAndStoreCampaignById(campaignId, userId, organisationId, dateStart, dateStop);
        }
        
        // Found in DB, convert to API format and return
        return dbCampaignToApiCampaign(dbCampaign);
    } catch (e) {
        logger.error(`[CampaignService] Exception fetching campaign from DB:`, e);
        // Fall back to API refresh
        return await refreshAndStoreCampaignById(campaignId, userId, organisationId, dateStart, dateStop);
    }
};

// --- Helper Functions ---

/**
 * Refreshes all campaigns for an account from the Graph API and stores them in the database.
 * Also updates the cache.
 */
async function refreshAndStoreCampaigns(
    accountId: string,
    userId: string,
    organisationId: string,
    dateStart?: string,
    dateStop?: string
): Promise<Campaign[]> {
    logger.info(`[CampaignService] Refreshing campaigns from Graph API for account ${accountId}, user ${userId}, dateStart=${dateStart}, dateStop=${dateStop}`);
    
    try {
        // Fetch from Graph API, now passing dateStart and dateStop
        const apiCampaigns = await getCampaigns(accountId, dateStart, dateStop);
        
        if (!apiCampaigns || apiCampaigns.length === 0) {
            logger.info(`[CampaignService] No campaigns returned from Graph API`);
            return [];
        }
        
        // Explicitly store date range with each campaign
        if (dateStart && dateStop) {
            apiCampaigns.forEach(campaign => {
                campaign.insights_date_start = dateStart;
                campaign.insights_date_stop = dateStop;
            });
        } else {
            // Extract dates from insights if available
            apiCampaigns.forEach(campaign => {
                if (campaign.insights && campaign.insights.data && campaign.insights.data.length > 0) {
                    campaign.insights_date_start = campaign.insights.data[0].date_start;
                    campaign.insights_date_stop = campaign.insights.data[0].date_stop;
                }
            });
        }
        
        // Map API campaigns to DB schema
        const dbCampaigns = apiCampaigns.map(mapApiCampaignToDbCampaign);
        
        // Log the first campaign to check date fields
        if (dbCampaigns.length > 0) {
            logger.info(`[CampaignService] First campaign date range: ${dbCampaigns[0].insights_date_start} to ${dbCampaigns[0].insights_date_stop}`);
        }
        
        // Upsert to database
        const { data: upsertedCampaigns, error } = await campaignRepository.upsertCampaigns(
            dbCampaigns,
            userId,
            organisationId
        );
        
        if (error) {
            logger.error(`[CampaignService] Error upserting campaigns to DB:`, error);
            // Still return the API data even if DB upsert failed
        }
        
        // Update cache
        const cacheKey = userId ? `campaigns_${accountId}_${userId}` : `campaigns_${accountId}`;
        campaignListCache.set(cacheKey, apiCampaigns);
        
        logger.info(`[CampaignService] Refreshed and stored ${apiCampaigns.length} campaigns for account ${accountId}, user ${userId}`);
        return apiCampaigns;
    } catch (error) {
        logger.error(`[CampaignService] Error in refreshAndStoreCampaigns:`, error);
        if (error instanceof Error) {
            throw new Error(`Failed to refresh campaigns: ${error.message}`);
        } else {
            throw new Error('Failed to refresh campaigns due to an unknown error');
        }
    }
}

/**
 * Refreshes a specific campaign by ID from the Graph API and stores it in the database.
 * Also updates the cache.
 */
async function refreshAndStoreCampaignById(
    campaignId: string,
    userId: string,
    organisationId: string,
    dateStart?: string,
    dateStop?: string
): Promise<Campaign | null> {
    logger.info(`[CampaignService] Refreshing campaign ${campaignId} from Graph API for user ${userId}${dateStart ? `, dateStart=${dateStart}` : ''}${dateStop ? `, dateStop=${dateStop}` : ''}`);
    
    try {
        // Use the imported getGraphCampaignById function
        // Need to modify this to accept date parameters if not already supported
        const apiCampaign = await getGraphCampaignById(campaignId, dateStart, dateStop);
        
        if (!apiCampaign) {
            logger.info(`[CampaignService] Campaign ${campaignId} not found via API`);
            return null;
        }
        
        // Store date information explicitly if provided
        if (dateStart && dateStop) {
            apiCampaign.insights_date_start = dateStart;
            apiCampaign.insights_date_stop = dateStop;
        } else if (apiCampaign.insights && apiCampaign.insights.data && apiCampaign.insights.data.length > 0) {
            apiCampaign.insights_date_start = apiCampaign.insights.data[0].date_start;
            apiCampaign.insights_date_stop = apiCampaign.insights.data[0].date_stop;
        }
        
        // Map API campaign to DB schema
        const dbCampaign = mapApiCampaignToDbCampaign(apiCampaign);
        
        // Upsert to database
        const { error } = await campaignRepository.upsertCampaigns(
            [dbCampaign],
            userId,
            organisationId
        );
        
        if (error) {
            logger.error(`[CampaignService] Error upserting campaign ${campaignId} to DB:`, error);
            // Still return the API data even if DB upsert failed
        }
        
        // Update cache
        const cacheKey = userId ? `campaign_${campaignId}_${userId}${dateStart ? `_from_${dateStart}` : ''}${dateStop ? `_to_${dateStop}` : ''}` : `campaign_${campaignId}`;
        campaignCache.set(cacheKey, apiCampaign);
        
        return apiCampaign;
    } catch (error) {
        logger.error(`[CampaignService] Error in refreshAndStoreCampaignById:`, error);
        if (error instanceof Error) {
            throw new Error(`Failed to refresh campaign ${campaignId}: ${error.message}`);
        } else {
            throw new Error(`Failed to refresh campaign ${campaignId} due to an unknown error`);
        }
    }
} 