// src/services/adSetService.ts
// Import specific graph API functions
import { getAdSets, getSingleObject } from './graphApiService';
import { AdSet } from '../types/graphApiTypes';
import { CacheService } from './cacheService';
import * as adSetRepository from '../repositories/adSetRepository';
import { DbAdSet } from '../types/dbSchemaTypes';
import { safeGet } from '../utils/general';
import { logger } from '../utils/logger';

// Instantiate caches
// Remove graphApi instantiation
// const graphApi = new GraphApiService();
const adSetListCache = new CacheService<AdSet[]>(1800); // Cache AdSet lists for 30 minutes
const singleAdSetCache = new CacheService<AdSet | null>(1800); // Cache individual AdSets (including null for not found)

/**
 * Maps a Facebook AdSet object from the Graph API to our DbAdSet schema
 */
const mapApiAdSetToDbAdSet = (apiAdSet: AdSet): DbAdSet => {
    // Ensure required fields exist
    if (!apiAdSet.id) {
        logger.error(`[AdSetService] API AdSet is missing id field`);
        throw new Error('Cannot map API AdSet to database schema: missing id field');
    }
    if (!apiAdSet.account_id) {
        logger.error(`[AdSetService] API AdSet ${apiAdSet.id} is missing account_id`);
        throw new Error(`Cannot map AdSet ${apiAdSet.id} to database schema: missing account_id`);
    }
    if (!apiAdSet.campaign_id) {
        logger.error(`[AdSetService] API AdSet ${apiAdSet.id} is missing campaign_id`);
        throw new Error(`Cannot map AdSet ${apiAdSet.id} to database schema: missing campaign_id`);
    }

    // Note: We're now using the account_id directly from the API,
    // but adAccountRepository will store it with act_ prefix to match the schema

    return {
        id: apiAdSet.id,
        ad_set_id: apiAdSet.id,
        account_id: apiAdSet.account_id,
        campaign_id: apiAdSet.campaign_id,
        name: apiAdSet.name || 'Unnamed Ad Set', // Default value for required string field
        status: safeGet(apiAdSet, 'status'),
        effective_status: safeGet(apiAdSet, 'effective_status'),
        daily_budget: safeGet(apiAdSet, 'daily_budget'),
        lifetime_budget: safeGet(apiAdSet, 'lifetime_budget'),
        start_time: safeGet(apiAdSet, 'start_time'),
        stop_time: safeGet(apiAdSet, 'end_time'),
        optimization_goal: safeGet(apiAdSet, 'optimization_goal'),
        billing_event: safeGet(apiAdSet, 'billing_event'),
        targeting: safeGet(apiAdSet, 'targeting'),
        organisation_id: '', // Will be filled in by repository function
    };
};

/**
 * Converts a database ad set object to the API format expected by clients
 */
function dbAdSetToApiAdSet(dbAdSet: DbAdSet): AdSet {
    // Create a base AdSet with required fields
    const adSet: AdSet = {
        id: dbAdSet.id,
        account_id: dbAdSet.account_id,
        campaign_id: dbAdSet.campaign_id,
        name: dbAdSet.name,
    };

    // Add optional fields if present
    if (dbAdSet.status !== undefined) {
        (adSet as any).status = dbAdSet.status;
    }
    if (dbAdSet.effective_status !== undefined) {
        (adSet as any).effective_status = dbAdSet.effective_status;
    }
    if (dbAdSet.daily_budget !== undefined) {
        (adSet as any).daily_budget = dbAdSet.daily_budget;
    }
    if (dbAdSet.lifetime_budget !== undefined) {
        (adSet as any).lifetime_budget = dbAdSet.lifetime_budget;
    }
    if (dbAdSet.start_time !== undefined) {
        (adSet as any).start_time = dbAdSet.start_time;
    }
    if (dbAdSet.stop_time !== undefined) {
        (adSet as any).end_time = dbAdSet.stop_time;
    }
    if (dbAdSet.optimization_goal !== undefined) {
        (adSet as any).optimization_goal = dbAdSet.optimization_goal;
    }
    if (dbAdSet.billing_event !== undefined) {
        (adSet as any).billing_event = dbAdSet.billing_event;
    }
    if (dbAdSet.targeting !== undefined) {
        (adSet as any).targeting = dbAdSet.targeting;
    }

    return adSet;
}

/**
 * Fetches all ad sets for a specific ad account, with option to refresh from API.
 * If refresh is true, fetches from Graph API and updates the database.
 * Otherwise, tries to retrieve from the database first.
 *
 * @param accountId - The ad account ID
 * @param userId - User ID for permission checks and DB queries
 * @param organisationId - Organisation ID for DB queries
 * @param refresh - Whether to force refresh from Graph API
 */
export const getAdSetsByAccount = async (
    accountId: string, 
    userId: string,
    organisationId: string,
    refresh: boolean = false
): Promise<AdSet[]> => {
    logger.info(`[AdSetService] Getting ad sets for account ${accountId}, user ${userId}, org ${organisationId}, refresh=${refresh}`);
    
    // Normalize account ID if needed
    const normalizedAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
    
    // If refresh=true, get from API and upsert to DB
    if (refresh) {
        return await refreshAndStoreAdSets(normalizedAccountId, userId, organisationId);
    }
    
    // Try to get from DB first
    try {
        const { data: dbAdSets, error } = await adSetRepository.getAdSetsByCampaign(normalizedAccountId, userId, organisationId);
        
        if (error) {
            logger.error(`[AdSetService] Error fetching ad sets from DB:`, error);
            // Fall back to API refresh
            return await refreshAndStoreAdSets(normalizedAccountId, userId, organisationId);
        }
        
        if (!dbAdSets || dbAdSets.length === 0) {
            logger.info(`[AdSetService] No ad sets found in DB for account ${accountId}, fetching from API`);
            // No data in DB, fetch from API
            return await refreshAndStoreAdSets(normalizedAccountId, userId, organisationId);
        }
        
        // Data found in DB, convert DbAdSet[] to AdSet[] and return
        logger.info(`[AdSetService] Returning ${dbAdSets.length} ad sets from DB`);
        return dbAdSets.map(dbAdSetToApiAdSet);
    } catch (e) {
        logger.error(`[AdSetService] Exception fetching ad sets from DB:`, e);
        // Fall back to API refresh
        return await refreshAndStoreAdSets(normalizedAccountId, userId, organisationId);
    }
};

/**
 * Fetches a specific ad set by ID, with option to refresh from API.
 *
 * @param adSetId - The ad set ID to fetch
 * @param userId - User ID for permission checks and DB queries
 * @param organisationId - Organisation ID for DB queries
 * @param refresh - Whether to force refresh from Graph API
 */
export const getAdSetById = async (
    adSetId: string, 
    userId: string,
    organisationId: string,
    refresh: boolean = false
): Promise<AdSet | null> => {
    logger.info(`[AdSetService] Getting ad set ${adSetId} for user ${userId}, org ${organisationId}, refresh=${refresh}`);
    
    // If refresh=true, get from API and upsert to DB
    if (refresh) {
        return await refreshAndStoreAdSetById(adSetId, userId, organisationId);
    }
    
    // Try DB first
    try {
        const { data: dbAdSet, error } = await adSetRepository.getAdSetById(adSetId, userId, organisationId);
        
        if (error) {
            logger.error(`[AdSetService] Error fetching ad set ${adSetId} from DB:`, error);
            // Fall back to API
            return await refreshAndStoreAdSetById(adSetId, userId, organisationId);
        }
        
        if (!dbAdSet) {
            logger.info(`[AdSetService] Ad set ${adSetId} not found in DB, checking API`);
            // Not found in DB, try API
            return await refreshAndStoreAdSetById(adSetId, userId, organisationId);
        }
        
        // Found in DB, convert to API format and return
        return dbAdSetToApiAdSet(dbAdSet);
    } catch (e) {
        logger.error(`[AdSetService] Exception fetching ad set from DB:`, e);
        // Fall back to API refresh
        return await refreshAndStoreAdSetById(adSetId, userId, organisationId);
    }
};

// --- Helper Functions ---

/**
 * Refreshes all ad sets for an account from the Graph API and stores them in the database.
 * Also updates the cache.
 */
async function refreshAndStoreAdSets(
    accountId: string,
    userId: string,
    organisationId: string
): Promise<AdSet[]> {
    logger.info(`[AdSetService] Refreshing ad sets from Graph API for account ${accountId}, user ${userId}`);
    
    try {
        // Fetch from Graph API
        const apiAdSets = await getAdSets(accountId);
        
        if (!apiAdSets || apiAdSets.length === 0) {
            logger.info(`[AdSetService] No ad sets returned from Graph API`);
            return [];
        }
        
        // Map API ad sets to DB schema
        const dbAdSets = apiAdSets.map(mapApiAdSetToDbAdSet);
        
        // Upsert to database
        const { data: upsertedAdSets, error } = await adSetRepository.upsertAdSets(
            dbAdSets,
            userId,
            organisationId
        );
        
        if (error) {
            logger.error(`[AdSetService] Error upserting ad sets to DB:`, error);
            // Still return the API data even if DB upsert failed
        }
        
        // Update cache
        const cacheKey = `adSets_account_${accountId}_user_${userId}`;
        adSetListCache.set(cacheKey, apiAdSets);
        
        logger.info(`[AdSetService] Refreshed and stored ${apiAdSets.length} ad sets for account ${accountId}, user ${userId}`);
        return apiAdSets;
    } catch (error) {
        logger.error(`[AdSetService] Error in refreshAndStoreAdSets:`, error);
        if (error instanceof Error) {
            throw new Error(`Failed to refresh ad sets: ${error.message}`);
        } else {
            throw new Error('Failed to refresh ad sets due to an unknown error');
        }
    }
}

/**
 * Refreshes a specific ad set by ID from the Graph API and stores it in the database.
 * Also updates the cache.
 */
async function refreshAndStoreAdSetById(
    adSetId: string,
    userId: string,
    organisationId: string
): Promise<AdSet | null> {
    logger.info(`[AdSetService] Refreshing ad set ${adSetId} from Graph API for user ${userId}`);
    
    try {
        // Define the fields required for a single ad set view
        const fields = "id,name,campaign_id,account_id,status,effective_status,daily_budget,lifetime_budget,optimization_goal,billing_event,bid_amount,start_time,end_time,targeting";
        
        // Use the imported getSingleObject function
        const apiAdSet = await getSingleObject<AdSet>(`/${adSetId}`, { fields });
        
        if (!apiAdSet) {
            logger.info(`[AdSetService] Ad set ${adSetId} not found via API`);
            return null;
        }
        
        // Map API ad set to DB schema
        const dbAdSet = mapApiAdSetToDbAdSet(apiAdSet);
        
        // Upsert to database
        const { error } = await adSetRepository.upsertAdSets(
            [dbAdSet],
            userId,
            organisationId
        );
        
        if (error) {
            logger.error(`[AdSetService] Error upserting ad set ${adSetId} to DB:`, error);
            // Still return the API data even if DB upsert failed
        }
        
        // Update cache
        const cacheKey = `adSet_${adSetId}_user_${userId}`;
        singleAdSetCache.set(cacheKey, apiAdSet);
        
        return apiAdSet;
    } catch (error) {
        logger.error(`[AdSetService] Error in refreshAndStoreAdSetById:`, error);
        if (error instanceof Error) {
            throw new Error(`Failed to refresh ad set ${adSetId}: ${error.message}`);
        } else {
            throw new Error(`Failed to refresh ad set ${adSetId} due to an unknown error`);
        }
    }
}

// Example of another potential function:
// export const getAdSetsByCampaign = async (campaignId: string, userId?: string): Promise<AdSet[]> => {
//     const cacheKey = `adSets_campaign_${campaignId}_user_${userId || 'shared'}`;
//     // ... implementation using graphApi.getAllPages or a dedicated method ...
// }; 