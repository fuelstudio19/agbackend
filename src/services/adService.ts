import {
    getAdsByAccount as graphGetAdsByAccount, // Alias to avoid name collision
    getAdsByAdSet as graphGetAdsByAdSet,
    getAdsByCampaign as graphGetAdsByCampaign,
    getSingleObject as graphGetSingleObject,
    getInsights as graphGetInsights,
    getInsightsWithBreakdown as graphGetInsightsWithBreakdown,
    getCreativeDetails as graphGetCreativeDetails
} from './graphApiService';
import { Ad, AdCreative, AdInsight, GetInsightsParams, DetailedAdInsight, GetDetailedInsightsParams, BreakdownInsight, FacebookApiResponse } from '../types/graphApiTypes'; // Import necessary types
import { CacheService } from './cacheService';
import { extractMinimalBreakdown } from '../utils/insightUtils'; // Import the utility function
import { logger } from '../utils/logger';
import * as adRepository from '../repositories/adRepository';
import * as creativeRepository from '../repositories/creativeRepository';
import * as breakdownInsightsRepository from '../repositories/breakdownInsightsRepository';
import { DbAd, DbCreative, DbBreakdownInsight } from '../types/dbSchemaTypes';
import { safeGet } from '../utils/general';
import { v4 as uuidv4 } from 'uuid';

// Instantiate caches
// Remove graphApi instantiation
// const graphApi = new GraphApiService();
const adListCache = new CacheService<Ad[]>(900); // Cache Ad lists for 15 minutes
const singleAdCache = new CacheService<Ad | null>(900);
// Cache insights with a key derived from params
const insightsCache = new CacheService<AdInsight[]>(300); // Cache insights for 5 minutes
const detailedInsightsCache = new CacheService<DetailedAdInsight>(300); // Cache detailed insights for 5 minutes
const creativeCache = new CacheService<AdCreative | null>(3600); // Cache creatives for 1 hour

// --- Service Functions ---

/**
 * Maps a Facebook Ad object from the Graph API to our DbAd schema
 */
const apiAdToDbAd = (apiAd: Ad): DbAd => {
    // Ensure required fields exist
    if (!apiAd.id) {
        logger.error(`[AdService] API Ad is missing id field`);
        throw new Error('Cannot map API Ad to database schema: missing id field');
    }
    if (!apiAd.account_id) {
        logger.error(`[AdService] API Ad ${apiAd.id} is missing account_id`);
        throw new Error(`Cannot map Ad ${apiAd.id} to database schema: missing account_id`);
    }
    if (!apiAd.campaign_id) {
        logger.error(`[AdService] API Ad ${apiAd.id} is missing campaign_id`);
        throw new Error(`Cannot map Ad ${apiAd.id} to database schema: missing campaign_id`);
    }
    if (!apiAd.adset_id) {
        logger.error(`[AdService] API Ad ${apiAd.id} is missing adset_id`);
        throw new Error(`Cannot map Ad ${apiAd.id} to database schema: missing adset_id`);
    }

    // Map Facebook's created_time and updated_time fields to our DB schema
    const created_at = apiAd.created_time ? apiAd.created_time : new Date().toISOString();
    const updated_at = apiAd.updated_time ? apiAd.updated_time : new Date().toISOString();

    // Extract date range from insights if present
    let insights_date_start: string | undefined;
    let insights_date_stop: string | undefined;
    
    if (apiAd.insights && apiAd.insights.data && apiAd.insights.data.length > 0) {
        const insightsData = apiAd.insights.data[0];
        insights_date_start = insightsData.date_start;
        insights_date_stop = insightsData.date_stop;
    }

    // Generate a UUID for the database ID
    // Note: This will be overridden by the repository if the ad already exists
    const uuid = uuidv4();

    return {
        id: uuid, // Use UUID for database primary key
        ad_id: apiAd.id, // Store original Facebook ID in ad_id field
        account_id: apiAd.account_id,
        campaign_id: apiAd.campaign_id,
        ad_set_id: apiAd.adset_id,
        name: apiAd.name || 'Unnamed Ad',
        status: safeGet(apiAd, 'status'),
        effective_status: safeGet(apiAd, 'effective_status'),
        creative_id: apiAd.creative?.id || null,
        preview_shareable_link: null, // To be populated if available
        tracking_data: {}, // To be populated if available
        insights: apiAd.insights, // Store insights data
        insights_date_start, // Store insights start date
        insights_date_stop, // Store insights stop date
        organisation_id: '', // Will be filled in by repository function
        created_at,
        updated_at,
    };
};

/**
 * Converts API creative object to database format
 */
const apiCreativeToDbCreative = (apiCreative: AdCreative): DbCreative => {
    // Ensure required fields exist
    if (!apiCreative.id) {
        logger.error(`[AdService] API Creative is missing id field`);
        throw new Error('Cannot map API Creative to database schema: missing id field');
    }
    if (!apiCreative.account_id) {
        logger.error(`[AdService] API Creative ${apiCreative.id} is missing account_id`);
        throw new Error(`Cannot map Creative ${apiCreative.id} to database schema: missing account_id`);
    }

    // Set timestamps (Facebook API might not provide these for creatives)
    const now = new Date().toISOString();

    return {
        id: apiCreative.id,
        creative_id: apiCreative.id,
        account_id: apiCreative.account_id,
        name: apiCreative.name || 'Unnamed Creative',
        title: safeGet(apiCreative, 'title'),
        body: safeGet(apiCreative, 'body'),
        image_url: safeGet(apiCreative, 'image_url'),
        video_url: apiCreative.video_source_url,
        image_hash: safeGet(apiCreative, 'image_hash'),
        object_type: '', // Set default or leave undefined
        thumbnail_url: safeGet(apiCreative, 'thumbnail_url'),
        object_story_spec: safeGet(apiCreative, 'object_story_spec'),
        asset_feed_spec: safeGet(apiCreative, 'asset_feed_spec'),
        call_to_action_type: safeGet(apiCreative, 'call_to_action_type'),
        organisation_id: '', // Will be filled in by repository function
        created_at: now,
        updated_at: now,
    };
};

/**
 * Stores Ad and its Creative data in the database
 */
export const storeAdData = async (
    ad: Ad,
    userId: string,
    organisationId: string
): Promise<void> => {
    try {
        // Convert API ad to DB format and store it
        const dbAd = apiAdToDbAd(ad);
        await adRepository.upsertAds([dbAd], userId, organisationId);
        
        // If ad has a creative with details, store that too
        if (ad.creative_details) {
            const dbCreative = apiCreativeToDbCreative(ad.creative_details);
            await creativeRepository.upsertCreatives([dbCreative], userId, organisationId);
        }
    } catch (error) {
        logger.error(`[AdService] Error storing ad data for ad ${ad.id}:`, error);
        throw error;
    }
};

/**
 * Stores multiple ads and their creatives in the database
 */
export const storeAdsData = async (
    ads: Ad[],
    userId: string,
    organisationId: string
): Promise<void> => {
    try {
        // Convert API ads to DB format
        const dbAds = ads.map(ad => apiAdToDbAd(ad));
        await adRepository.upsertAds(dbAds, userId, organisationId);
        
        // Extract and store creatives that have details
        const creatives = ads
            .filter(ad => ad.creative_details)
            .map(ad => apiCreativeToDbCreative(ad.creative_details!));
        
        if (creatives.length > 0) {
            await creativeRepository.upsertCreatives(creatives, userId, organisationId);
        }
    } catch (error) {
        logger.error(`[AdService] Error batch storing ad data:`, error);
        throw error;
    }
};

/**
 * Retrieves ads from database by account ID
 * Optionally can filter by date range for insights
 */
export const getAdsByAccountFromDb = async (
    accountId: string,
    userId: string,
    organisationId: string,
    dateStart?: string,
    dateStop?: string
): Promise<Ad[]> => {
    try {
        // Normalize account ID if necessary
        const normalizedAccountId = accountId.startsWith('act_')
            ? accountId
            : `act_${accountId}`;
            
        // Fetch ads from DB with date parameters
        const { data: dbAds, error } = await adRepository.getAdsByAccount(
            normalizedAccountId, 
            userId, 
            organisationId,
            dateStart,
            dateStop
        );
        
        if (error) {
            throw error;
        }
        
        if (!dbAds || dbAds.length === 0) {
            return [];
        }
        
        // Convert to API format
        return dbAds.map((dbAd: DbAd) => {
            // Check if status is valid
            const validStatus = (dbAd.status && ['ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED', 'IN_PROCESS', 'WITH_ISSUES'].includes(dbAd.status)) 
                ? dbAd.status as Ad['status']
                : undefined;
                
            // Create Ad object with fields from DbAd
            const ad: Ad = {
                id: dbAd.ad_id || dbAd.id, // Use original Facebook ID (ad_id) for external API
                account_id: dbAd.account_id,
                campaign_id: dbAd.campaign_id,
                adset_id: dbAd.ad_set_id,
                name: dbAd.name,
                status: validStatus,
                effective_status: dbAd.effective_status,
                creative: dbAd.creative_id ? { id: dbAd.creative_id } : undefined,
                insights: dbAd.insights, // Include insights data
                insights_date_start: dbAd.insights_date_start,
                insights_date_stop: dbAd.insights_date_stop
            };

            // Add internal DB id as a property for reference if needed
            (ad as any).db_id = dbAd.id;

            return ad;
        });
    } catch (error) {
        logger.error(`[AdService] Error retrieving ads from database for account ${accountId}:`, error);
        throw error;
    }
};

/**
 * Fetches ads for a specific ad account, with optional refresh from API.
 * If refresh is false/not provided, tries to get data from DB first.
 * 
 * @param accountId - Ad Account ID.
 * @param userId - User ID for authentication and DB queries
 * @param organisationId - Organisation ID for DB queries
 * @param refresh - Whether to refresh data from API (defaults to false)
 * @param dateStart - Optional start date for ad insights
 * @param dateStop - Optional end date for ad insights
 * @returns Promise resolving to an array of Ads.
 */
export const getAdsByAccount = async (
    accountId: string, 
    userId: string,
    organisationId: string,
    refresh: boolean = false,
    dateStart?: string,
    dateStop?: string
): Promise<Ad[]> => {
    const cacheKey = `ads_account_${accountId}_user_${userId || 'shared'}${dateStart ? `_from_${dateStart}` : ''}${dateStop ? `_to_${dateStop}` : ''}`;
    
    // Try cache first (regardless of refresh parameter)
    const cachedData = adListCache.get(cacheKey);
    if (cachedData && !refresh) {
        logger.info(`[AdService] Cache hit for ads by account: ${cacheKey}`);
        return cachedData;
    }
    
    // If not refreshing and not in cache, try database
    if (!refresh) {
        try {
            logger.info(`[AdService] Attempting to retrieve ads from database for account ${accountId}${dateStart ? ` from ${dateStart}` : ''}${dateStop ? ` to ${dateStop}` : ''}`);
            
            const ads = await getAdsByAccountFromDb(accountId, userId, organisationId, dateStart, dateStop);
            
            if (ads && ads.length > 0) {
                logger.info(`[AdService] Found ${ads.length} ads in database for account ${accountId}${dateStart ? ` from ${dateStart}` : ''}${dateStop ? ` to ${dateStop}` : ''}`);
                
                // Fetch creative details for each ad
                const apiAds = await Promise.all(ads.map(async (ad) => {
                    if (ad.creative?.id) {
                        try {
                            const creative = await getAdCreativeDetails(ad.id, userId, ad.creative.id, refresh, organisationId);
                            if (creative) {
                                ad.creative_details = creative;
                            }
                        } catch (err) {
                            logger.error(`[AdService] Error fetching creative details for ad ${ad.id}, creative ${ad.creative.id}:`, err);
                        }
                    }
                    
                    return ad;
                }));
                
                // Cache the result for future use
                adListCache.set(cacheKey, apiAds);
                return apiAds;
            }
            
            logger.info(`[AdService] No ads found in database for account ${accountId}${dateStart ? ` from ${dateStart}` : ''}${dateStop ? ` to ${dateStop}` : ''}, will fetch from API`);
        } catch (error) {
            logger.error(`[AdService] Error retrieving ads from database:`, error);
            // Continue to API fetch if DB retrieval fails
        }
    }

    // Fetch from API if:
    // 1. refresh=true, OR
    // 2. No data in cache or database
    logger.info(`[AdService] ${refresh ? 'Refreshing' : 'Fetching'} ads from API for account ${accountId}${dateStart ? ` from ${dateStart}` : ''}${dateStop ? ` to ${dateStop}` : ''}`);
    try {
        // Use imported & aliased function to get data from API with date parameters
        const ads = await graphGetAdsByAccount(accountId, dateStart, dateStop);
        
        // Fetch creative details for each ad and store in DB
        const adsWithCreatives = await Promise.all(
            ads.map(async (ad) => {
                if (ad.creative?.id) {
                    // Get creative either from DB or API
                    const creative = await getAdCreativeDetails(ad.id, userId, ad.creative.id, refresh, organisationId);
                    ad.creative_details = creative;
                }
                
                // Store dates explicitly
                if (dateStart && dateStop) {
                    ad.insights_date_start = dateStart;
                    ad.insights_date_stop = dateStop;
                } else {
                    ad.insights_date_start = ad.insights?.data[0]?.date_start;
                    ad.insights_date_stop = ad.insights?.data[0]?.date_stop;
                }
                
                // Store the ad in DB
                await storeAdData(ad, userId, organisationId);
                return ad;
            })
        );
        
        // Update cache with fresh data
        adListCache.set(cacheKey, adsWithCreatives);
        return adsWithCreatives;
    } catch (error) {
        logger.error(`[AdService] Error in getAdsByAccount (${accountId}):`, error);
        throw error;
    }
};

/**
 * Retrieves ads from database by ad set ID
 * Optionally can filter by date range for insights
 */
export const getAdsByAdSetFromDb = async (
    adSetId: string,
    userId: string,
    organisationId: string,
    dateStart?: string,
    dateStop?: string
): Promise<Ad[]> => {
    try {
        // Fetch ads from DB with date parameters
        const { data: dbAds, error } = await adRepository.getAdsByAdSet(
            adSetId, 
            userId, 
            organisationId,
            dateStart,
            dateStop
        );
        
        if (error) {
            throw error;
        }
        
        if (!dbAds || dbAds.length === 0) {
            return [];
        }
        
        // Convert DB format to API format
        return dbAds.map((dbAd: DbAd) => {
            // Check if status is valid
            const validStatus = (dbAd.status && ['ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED', 'IN_PROCESS', 'WITH_ISSUES'].includes(dbAd.status)) 
                ? dbAd.status as Ad['status']
                : undefined;
                
            // Create Ad object with fields from DbAd
            const ad: Ad = {
                id: dbAd.id,
                account_id: dbAd.account_id,
                campaign_id: dbAd.campaign_id,
                adset_id: dbAd.ad_set_id,
                name: dbAd.name,
                status: validStatus,
                effective_status: dbAd.effective_status,
                creative: dbAd.creative_id ? { id: dbAd.creative_id } : undefined,
                insights: dbAd.insights, // Include insights data
                insights_date_start: dbAd.insights_date_start,
                insights_date_stop: dbAd.insights_date_stop
            };

            return ad;
        });
    } catch (error) {
        logger.error(`[AdService] Error retrieving ads from database for ad set ${adSetId}:`, error);
        throw error;
    }
};

/**
 * Fetches ads for a specific ad set, with optional refresh from API.
 * 
 * @param adSetId - Ad Set ID.
 * @param userId - User ID for authentication and DB queries
 * @param organisationId - Organisation ID for DB queries
 * @param refresh - Whether to refresh data from API (defaults to false)
 * @param dateStart - Optional start date for ad insights
 * @param dateStop - Optional end date for ad insights
 * @returns Promise resolving to an array of Ads.
 */
export const getAdsByAdSet = async (
    adSetId: string, 
    userId: string,
    organisationId: string,
    refresh: boolean = false,
    dateStart?: string,
    dateStop?: string
): Promise<Ad[]> => {
    const cacheKey = `ads_adSet_${adSetId}_user_${userId || 'shared'}${dateStart ? `_from_${dateStart}` : ''}${dateStop ? `_to_${dateStop}` : ''}`;
    
    // Try cache first
    const cachedData = adListCache.get(cacheKey);
    if (cachedData && !refresh) {
        logger.info(`[AdService] Cache hit for ads by ad set: ${cacheKey}`);
        return cachedData;
    }
    
    // If not refreshing and not in cache, try database
    if (!refresh) {
        try {
            logger.info(`[AdService] Attempting to retrieve ads from database for ad set ${adSetId}${dateStart ? ` from ${dateStart}` : ''}${dateStop ? ` to ${dateStop}` : ''}`);
            
            const ads = await getAdsByAdSetFromDb(adSetId, userId, organisationId, dateStart, dateStop);
            
            if (ads && ads.length > 0) {
                logger.info(`[AdService] Found ${ads.length} ads in database for ad set ${adSetId}${dateStart ? ` from ${dateStart}` : ''}${dateStop ? ` to ${dateStop}` : ''}`);
                
                // Fetch creative details for each ad
                const apiAds = await Promise.all(ads.map(async (ad) => {
                    if (ad.creative?.id) {
                        try {
                            const creative = await getAdCreativeDetails(ad.id, userId, ad.creative.id, refresh, organisationId);
                            if (creative) {
                                ad.creative_details = creative;
                            }
                        } catch (err) {
                            logger.error(`[AdService] Error fetching creative details for ad ${ad.id}, creative ${ad.creative.id}:`, err);
                        }
                    }
                    
                    return ad;
                }));
                
                // Cache the result for future use
                adListCache.set(cacheKey, apiAds);
                return apiAds;
            }
            
            logger.info(`[AdService] No ads found in database for ad set ${adSetId}${dateStart ? ` from ${dateStart}` : ''}${dateStop ? ` to ${dateStop}` : ''}, will fetch from API`);
        } catch (error) {
            logger.error(`[AdService] Error retrieving ads from database:`, error);
            // Continue to API fetch if DB retrieval fails
        }
    }

    // Fetch from API if refresh=true or no data in cache/DB
    logger.info(`[AdService] ${refresh ? 'Refreshing' : 'Fetching'} ads from API for ad set ${adSetId}${dateStart ? ` from ${dateStart}` : ''}${dateStop ? ` to ${dateStop}` : ''}`);
    try {
        // Use imported & aliased function with date parameters
        const ads = await graphGetAdsByAdSet(adSetId, dateStart, dateStop);
        
        // Fetch creative details and store in DB
        const adsWithCreatives = await Promise.all(
            ads.map(async (ad) => {
                if (ad.creative?.id) {
                    const creative = await getAdCreativeDetails(ad.id, userId, ad.creative.id, refresh, organisationId);
                    ad.creative_details = creative;
                }
                
                // Store dates explicitly
                if (dateStart && dateStop) {
                    ad.insights_date_start = dateStart;
                    ad.insights_date_stop = dateStop;
                } else {
                    ad.insights_date_start = ad.insights?.data[0]?.date_start;
                    ad.insights_date_stop = ad.insights?.data[0]?.date_stop;
                }
                
                // Store the ad in DB
                await storeAdData(ad, userId, organisationId);
                return ad;
            })
        );
        
        // Update cache with fresh data
        adListCache.set(cacheKey, adsWithCreatives);
        return adsWithCreatives;
    } catch (error) {
        logger.error(`[AdService] Error in getAdsByAdSet (${adSetId}):`, error);
        throw error;
    }
};

/**
 * Retrieves ads from database by campaign ID
 * Optionally can filter by date range for insights
 */
export const getAdsByCampaignFromDb = async (
    campaignId: string,
    userId: string,
    organisationId: string,
    dateStart?: string,
    dateStop?: string
): Promise<Ad[]> => {
    try {
        // Fetch ads from DB with date parameters
        const { data: dbAds, error } = await adRepository.getAdsByCampaign(
            campaignId, 
            userId, 
            organisationId,
            dateStart,
            dateStop
        );
        
        if (error) {
            throw error;
        }
        
        if (!dbAds || dbAds.length === 0) {
            return [];
        }
        
        // Convert DB format to API format
        return dbAds.map((dbAd: DbAd) => {
            // Check if status is valid
            const validStatus = (dbAd.status && ['ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED', 'IN_PROCESS', 'WITH_ISSUES'].includes(dbAd.status)) 
                ? dbAd.status as Ad['status']
                : undefined;
                
            // Create Ad object with fields from DbAd
            const ad: Ad = {
                id: dbAd.id,
                account_id: dbAd.account_id,
                campaign_id: dbAd.campaign_id,
                adset_id: dbAd.ad_set_id,
                name: dbAd.name,
                status: validStatus,
                effective_status: dbAd.effective_status,
                creative: dbAd.creative_id ? { id: dbAd.creative_id } : undefined,
                insights: dbAd.insights, // Include insights data
                insights_date_start: dbAd.insights_date_start,
                insights_date_stop: dbAd.insights_date_stop
            };

            return ad;
        });
    } catch (error) {
        logger.error(`[AdService] Error retrieving ads from database for campaign ${campaignId}:`, error);
        throw error;
    }
};

/**
 * Fetches ads for a specific campaign, with optional refresh from API.
 * 
 * @param campaignId - Campaign ID.
 * @param userId - User ID for authentication and DB queries
 * @param organisationId - Organisation ID for DB queries
 * @param refresh - Whether to refresh data from API (defaults to false)
 * @param dateStart - Optional start date for ad insights
 * @param dateStop - Optional end date for ad insights
 * @returns Promise resolving to an array of Ads.
 */
export const getAdsByCampaign = async (
    campaignId: string, 
    userId: string,
    organisationId: string,
    refresh: boolean = false,
    dateStart?: string,
    dateStop?: string
): Promise<Ad[]> => {
    const cacheKey = `ads_campaign_${campaignId}_user_${userId || 'shared'}${dateStart ? `_from_${dateStart}` : ''}${dateStop ? `_to_${dateStop}` : ''}`;
    
    // Try cache first
    const cachedData = adListCache.get(cacheKey);
    if (cachedData && !refresh) {
        logger.info(`[AdService] Cache hit for ads by campaign: ${cacheKey}`);
        return cachedData;
    }
    
    // If not refreshing and not in cache, try database
    if (!refresh) {
        try {
            logger.info(`[AdService] Attempting to retrieve ads from database for campaign ${campaignId}${dateStart ? ` from ${dateStart}` : ''}${dateStop ? ` to ${dateStop}` : ''}`);
            
            const ads = await getAdsByCampaignFromDb(campaignId, userId, organisationId, dateStart, dateStop);
            
            if (ads && ads.length > 0) {
                logger.info(`[AdService] Found ${ads.length} ads in database for campaign ${campaignId}${dateStart ? ` from ${dateStart}` : ''}${dateStop ? ` to ${dateStop}` : ''}`);
                
                // Fetch creative details for each ad
                const apiAds = await Promise.all(ads.map(async (ad) => {
                    if (ad.creative?.id) {
                        try {
                            const creative = await getAdCreativeDetails(ad.id, userId, ad.creative.id, refresh, organisationId);
                            if (creative) {
                                ad.creative_details = creative;
                            }
                        } catch (err) {
                            logger.error(`[AdService] Error fetching creative details for ad ${ad.id}, creative ${ad.creative.id}:`, err);
                        }
                    }
                    
                    return ad;
                }));
                
                // Cache the result for future use
                adListCache.set(cacheKey, apiAds);
                return apiAds;
            }
            
            logger.info(`[AdService] No ads found in database for campaign ${campaignId}${dateStart ? ` from ${dateStart}` : ''}${dateStop ? ` to ${dateStop}` : ''}, will fetch from API`);
        } catch (error) {
            logger.error(`[AdService] Error retrieving ads from database:`, error);
            // Continue to API fetch if DB retrieval fails
        }
    }

    // Fetch from API if refresh=true or no data in cache/DB
    logger.info(`[AdService] ${refresh ? 'Refreshing' : 'Fetching'} ads from API for campaign ${campaignId}${dateStart ? ` from ${dateStart}` : ''}${dateStop ? ` to ${dateStop}` : ''}`);
    try {
        // Use imported & aliased function with date parameters
        const ads = await graphGetAdsByCampaign(campaignId, dateStart, dateStop);
        
        // Fetch creative details and store in DB
        const adsWithCreatives = await Promise.all(
            ads.map(async (ad) => {
                if (ad.creative?.id) {
                    const creative = await getAdCreativeDetails(ad.id, userId, ad.creative.id, refresh, organisationId);
                    ad.creative_details = creative;
                }
                
                // Store dates explicitly
                if (dateStart && dateStop) {
                    ad.insights_date_start = dateStart;
                    ad.insights_date_stop = dateStop;
                } else {
                    ad.insights_date_start = ad.insights?.data[0]?.date_start;
                    ad.insights_date_stop = ad.insights?.data[0]?.date_stop;
                }
                
                // Store the ad in DB
                await storeAdData(ad, userId, organisationId);
                return ad;
            })
        );
        
        // Update cache with fresh data
        adListCache.set(cacheKey, adsWithCreatives);
        return adsWithCreatives;
    } catch (error) {
        logger.error(`[AdService] Error in getAdsByCampaign (${campaignId}):`, error);
        throw error;
    }
};

/**
 * Fetches a specific ad by its ID, with optional refresh from API.
 * 
 * @param adId - Ad ID.
 * @param userId - User ID for authentication and DB queries
 * @param organisationId - Organisation ID for DB queries
 * @param refresh - Whether to refresh data from API (defaults to false)
 * @param dateStart - Optional start date for ad insights
 * @param dateStop - Optional end date for ad insights
 * @returns Promise resolving to the Ad object or null if not found.
 */
export const getAdById = async (
    adId: string, 
    userId: string,
    organisationId: string,
    refresh: boolean = false,
    dateStart?: string,
    dateStop?: string
): Promise<Ad | null> => {
    const cacheKey = `ad_${adId}_user_${userId || 'shared'}${dateStart ? `_from_${dateStart}` : ''}${dateStop ? `_to_${dateStop}` : ''}`;
    
    // Try cache first
    const cachedData = singleAdCache.get(cacheKey);
    if (cachedData !== null && !refresh) {
        logger.info(`[AdService] Cache hit for ad ${adId}: ${cacheKey}`);
        return cachedData;
    }
    
    // If requesting specific date range for insights without refresh, force refresh
    if ((dateStart || dateStop) && !refresh) {
        logger.warn(`[AdService] Requesting specific date range for ad insights without refresh=true. Forcing refresh.`);
        refresh = true;
    }
    
    // If not refreshing and not in cache, try database
    if (!refresh) {
        try {
            logger.info(`[AdService] Attempting to retrieve ad ${adId} from database`);
            const { data: dbAd, error } = await adRepository.getAdById(adId, userId, organisationId);
            
            if (dbAd && !error) {
                logger.info(`[AdService] Found ad ${adId} in database`);
                
                // Convert DB format to API format
                const validStatus = (dbAd.status && ['ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED', 'IN_PROCESS', 'WITH_ISSUES'].includes(dbAd.status)) 
                    ? dbAd.status as Ad['status']
                    : undefined;
                
                const apiAd: Ad = {
                    id: dbAd.id,
                    account_id: dbAd.account_id,
                    campaign_id: dbAd.campaign_id,
                    adset_id: dbAd.ad_set_id,
                    name: dbAd.name,
                    status: validStatus,
                    effective_status: dbAd.effective_status,
                    creative: dbAd.creative_id ? { id: dbAd.creative_id } : undefined,
                    insights: dbAd.insights,
                    insights_date_start: dbAd.insights_date_start,
                    insights_date_stop: dbAd.insights_date_stop
                };
                
                // If we have a creative ID, try to get the creative details
                if (dbAd.creative_id) {
                    const creative = await getAdCreativeDetails(adId, userId, dbAd.creative_id, refresh, organisationId);
                    if (creative) {
                        apiAd.creative_details = creative;
                    }
                }
                
                // Cache the result for future use
                singleAdCache.set(cacheKey, apiAd);
                return apiAd;
            }
            
            logger.info(`[AdService] Ad ${adId} not found in database, will fetch from API`);
        } catch (error) {
            logger.error(`[AdService] Error retrieving ad from database:`, error);
            // Continue to API fetch if DB retrieval fails
        }
    }

    // Fetch from API if refresh=true or no data in cache/DB
    logger.info(`[AdService] ${refresh ? 'Refreshing' : 'Fetching'} ad ${adId} from API${dateStart && dateStop ? ` with insights from ${dateStart} to ${dateStop}` : ''}`);
    try {
        // Define fields needed, including nested creative ID
        const fields = "id,name,adset_id,campaign_id,account_id,status,effective_status,bid_type,created_time,updated_time,creative{id}";
        
        // Add insights fields with optional date range
        let insightsFields = "cpc,ctr,impressions,clicks,spend,reach,date_start,date_stop";
        let insightsQuery = `insights.fields(${insightsFields})`;

        if (dateStart && dateStop) {
            // Ensure date format is YYYY-MM-DD if necessary, though FB API is usually flexible
            const timeRange = JSON.stringify({ since: dateStart, until: dateStop });
            insightsQuery = `insights.time_range(${timeRange}).fields(${insightsFields})`;
        }
        
        const fieldsWithInsights = `${fields},${insightsQuery}`;
        const ad = await graphGetSingleObject<Ad>(`/${adId}`, { fields: fieldsWithInsights });

        if (ad) {
            // Get creative details if available
            if (ad.creative?.id) {
                const creative = await getAdCreativeDetails(adId, userId, ad.creative.id, refresh, organisationId);
                if (creative) {
                    ad.creative_details = creative;
                }
            }
            
            // Store dates explicitly
            if (dateStart && dateStop) {
                ad.insights_date_start = dateStart;
                ad.insights_date_stop = dateStop;
            } else {
                ad.insights_date_start = ad.insights?.data[0]?.date_start;
                ad.insights_date_stop = ad.insights?.data[0]?.date_stop;
            }
            
            // Store the ad in DB
            await storeAdData(ad, userId, organisationId);
        }

        // Cache the result
        const ttl = ad ? 900 : 60; // 15 mins for found, 1 min for not found
        singleAdCache.set(cacheKey, ad, ttl);
        return ad;
    } catch (error) {
        logger.error(`[AdService] Error in getAdById (${adId}):`, error);
        // Handle errors based on their type
        if (error instanceof Error && !(error.message.includes('404') || error.message.includes('not found'))) {
            throw new Error(`Failed to fetch ad ${adId}: ${error.message}`);
        } else if (!(error instanceof Error)) {
            throw new Error(`Failed to fetch ad ${adId} due to an unknown error.`);
        }
        return null;
    }
};

/**
 * Fetches insights for a specific ad. Parameters are passed directly.
 * @param adId - Ad ID.
 * @param params - Insights parameters object matching GetInsightsParams structure.
 * @param userId - Optional user ID for cache key.
 * @param accessToken - Optional: User-specific access token.
 * @returns Promise resolving to an array of AdInsight objects.
 */
export const getAdInsights = async (
    adId: string,
    params: GetInsightsParams, // Expect the correct type directly
    userId?: string
): Promise<AdInsight[]> => {

     // Ensure 'level' is set correctly if not passed in params
     // The Graph API requires the 'level' parameter for insights.
     const apiParams: GetInsightsParams = {
         ...params, // Pass provided params
         level: 'ad' // Ensure level is set to 'ad' for this ad-specific insights call
     };


    // Generate a cache key based on adId and stringified parameters
    // Use the potentially modified apiParams for the key
    const paramString = JSON.stringify(apiParams);
    const cacheKey = `insights_ad_${adId}_params_${paramString}_user_${userId || 'shared'}`;
    const cachedData = insightsCache.get(cacheKey);
    if (cachedData) {
        logger.info(`[AdService] Cache hit for insights: ${cacheKey}`);
        return cachedData;
    }

    logger.info(`[AdService] Cache miss for insights: ${cacheKey}. Fetching...`);
    try {
        // Use imported & aliased function, pass token
        const insights = await graphGetInsights(adId, apiParams);
        insightsCache.set(cacheKey, insights); // Use default TTL
        return insights;
    } catch (error) {
        logger.error(`[AdService] Error fetching insights for ad ${adId} with params ${paramString}:`, error);
        throw error; // Re-throw for controller/handler
    }
};

/**
 * Fetches detailed insights for a specific ad including various breakdowns.
 * @param adId - Ad ID.
 * @param params - Detailed insights parameters object.
 * @param userId - User ID for DB queries and cache key 
 * @param organisationId - Organisation ID for DB queries
 * @param refresh - Whether to refresh data from Graph API
 * @returns Promise resolving to a DetailedAdInsight object.
 */
export const getDetailedAdInsights = async (
    adId: string,
    params: GetDetailedInsightsParams,
    userId?: string,
    organisationId?: string,
    refresh: boolean = false
): Promise<DetailedAdInsight> => {
    // Ensure 'level' is set correctly if not passed in params
    const apiParams: GetDetailedInsightsParams = {
        ...params,
        level: 'ad' // Ensure level is set to 'ad' for this ad-specific insights call
    };

    // Generate a cache key based on adId and stringified parameters
    const paramString = JSON.stringify(apiParams);
    const cacheKey = `detailed_insights_ad_${adId}_params_${paramString}_user_${userId || 'shared'}`;
    const cachedData = detailedInsightsCache.get(cacheKey);
    if (cachedData && !refresh) {
        logger.info(`[AdService] Cache hit for detailed insights: ${cacheKey}`);
        return cachedData;
    }

    logger.info(`[AdService] ${refresh ? 'Refreshing' : 'Fetching'} detailed insights for ad ${adId}`);
    try {
        // Create a result object
        const detailedInsight: DetailedAdInsight = {
            breakdown_insights: {},
            time_period: {
                start_date: params.time_range?.since || '',
                end_date: params.time_range?.until || '',
                breakdowns: params.breakdowns
            }
        };

        // Fetch the ad details
        const adDetails = await getAdById(adId, userId || '', organisationId || userId || '', refresh);
        if (adDetails) {
            detailedInsight.ad_details = adDetails;
        }

        // Fetch basic insights (using the non-detailed GetInsightsParams for the basic call)
        const basicInsightsParams: GetInsightsParams = { 
            level: 'ad',
            time_range: apiParams.time_range,
            time_increment: apiParams.time_increment,
            fields: apiParams.fields,
            filtering: apiParams.filtering,
            limit: apiParams.limit,
            use_unified_attribution_setting: apiParams.use_unified_attribution_setting
            // Exclude breakdown parameters for the main insight fetch
        };
        const basicInsights = await getAdInsights(adId, basicInsightsParams, userId);
        detailedInsight.insights = basicInsights;

        // Extract date range for breakdown insights storage/retrieval
        const dateStart = params.time_range?.since || '';
        const dateStop = params.time_range?.until || '';

        // If not refreshing and we have user context, try to get breakdown insights from database first
        if (!refresh && userId && organisationId && dateStart && dateStop) {
            try {
                const dbBreakdownInsights = await getBreakdownInsightsFromDb(
                    adId,
                    userId,
                    organisationId,
                    dateStart,
                    dateStop
                );

                // Check if we have any breakdown insights in the database
                const hasDbBreakdownData = Object.keys(dbBreakdownInsights).length > 0;

                if (hasDbBreakdownData) {
                    logger.info(`[AdService] Found breakdown insights in database for ad ${adId}, using stored data`);
                    detailedInsight.breakdown_insights = dbBreakdownInsights;

                    // Fetch creative details if available
                    if (adDetails?.creative?.id) {
                        try {
                            const creative = await getAdCreativeDetails(adId, userId, undefined, refresh, organisationId);
                            detailedInsight.creatives = creative ? [creative] : [];
                        } catch (error) {
                            logger.error(`[AdService] Error fetching creative details for ad ${adId}:`, error);
                            detailedInsight.creatives = [];
                        }
                    }

                    // Cache the result and return
                    detailedInsightsCache.set(cacheKey, detailedInsight);
                    return detailedInsight;
                }

                logger.info(`[AdService] No breakdown insights found in database for ad ${adId}, will fetch from API`);
            } catch (error) {
                logger.error(`[AdService] Error retrieving breakdown insights from database for ad ${adId}:`, error);
                // Continue to API fetch if DB retrieval fails
            }
        }

        // If refresh=true or no data in database, fetch from API and store
        logger.info(`[AdService] ${refresh ? 'Refreshing' : 'Fetching'} breakdown insights from API for ad ${adId}`);

        // Parallel requests array for breakdowns
        const breakdownRequests: Array<{
            category: string;
            subcategory: string;
            promise: Promise<AdInsight[]>;
            breakdownKeys: string[];
        }> = [];

        // Add audience breakdown if requested
        if (apiParams.include_audience_breakdown) {
            breakdownRequests.push({
                category: 'audience',
                subcategory: 'age_gender',
                promise: graphGetInsightsWithBreakdown(adId, ['age', 'gender'], apiParams),
                breakdownKeys: ['age', 'gender']
            });
        }

        // Add placement breakdown if requested
        if (apiParams.include_placement_breakdown) {
            breakdownRequests.push({
                category: 'placement',
                subcategory: 'full_placement',
                promise: graphGetInsightsWithBreakdown(adId, ['publisher_platform', 'platform_position', 'impression_device'], apiParams),
                breakdownKeys: ['publisher_platform', 'platform_position', 'impression_device']
            });
        }

        // Add geographic breakdown if requested
        if (apiParams.include_geo_breakdown) {
            breakdownRequests.push({
                category: 'geographic',
                subcategory: 'region',
                promise: graphGetInsightsWithBreakdown(adId, ['region'], apiParams),
                breakdownKeys: ['region']
            });
        }

        // Add action breakdown if requested
        if (apiParams.include_action_breakdown) {
            breakdownRequests.push({
                category: 'action',
                subcategory: 'action_type',
                promise: graphGetInsightsWithBreakdown(adId, ['action_type'], apiParams),
                breakdownKeys: ['action_type']
            });
        }

        // Add device breakdown if requested
        if (apiParams.include_device_breakdown) {
            breakdownRequests.push({
                category: 'device',
                subcategory: 'impression_device',
                promise: graphGetInsightsWithBreakdown(adId, ['impression_device'], apiParams),
                breakdownKeys: ['impression_device']
            });
        }

        // Add hourly breakdown if requested
        if (apiParams.include_hourly_breakdown) {
            breakdownRequests.push({
                category: 'hourly',
                subcategory: 'audience_timezone',
                promise: graphGetInsightsWithBreakdown(adId, ['hourly_stats_aggregated_by_audience_time_zone'], apiParams),
                breakdownKeys: ['hourly_stats_aggregated_by_audience_time_zone']
            });
        }

        // Execute all breakdown requests in parallel
        if (breakdownRequests.length > 0) {
            // Run all breakdown requests in parallel
            const breakdownResults = await Promise.allSettled(
                breakdownRequests.map(req => req.promise)
            );

            // Prepare data structures for processing and storage
            const breakdownRequestsForStorage: Array<{
                category: string;
                subcategory: string;
                insights: AdInsight[];
                breakdownKeys: string[];
            }> = [];

            // Process the results
            breakdownResults.forEach((result, index) => {
                const { category, subcategory, breakdownKeys } = breakdownRequests[index];
                
                if (!detailedInsight.breakdown_insights![category]) {
                    detailedInsight.breakdown_insights![category] = {};
                }

                if (result.status === 'fulfilled') {
                    const rawInsights = result.value;
                    
                    // Process each insight using the imported utility function
                    const processedMinimalInsights: BreakdownInsight[] = [];
                    if (Array.isArray(rawInsights)) {
                        rawInsights.forEach(insight => {
                            if (typeof insight === 'object' && insight !== null) {
                                // Use the imported utility function
                                const minimalInsight = extractMinimalBreakdown(insight, breakdownKeys);
                                processedMinimalInsights.push(minimalInsight);
                            } else {
                                logger.warn(`[AdService] Skipping non-object item in breakdown result for ${category}/${subcategory}`);
                            }
                        });
                    } else {
                        logger.warn(`[AdService] Unexpected format for ${category}/${subcategory} breakdown result for ad ${adId}: ${typeof rawInsights}`);
                    }
                    
                    detailedInsight.breakdown_insights![category][subcategory] = processedMinimalInsights;

                    // Prepare for storage (keep raw insights for database)
                    if (rawInsights && Array.isArray(rawInsights)) {
                        breakdownRequestsForStorage.push({
                            category,
                            subcategory,
                            insights: rawInsights,
                            breakdownKeys
                        });
                    }
                } else {
                    logger.error(`[AdService] Error in ${category}/${subcategory} breakdown:`, result.reason);
                    // Add empty array for failed requests to maintain structure
                    detailedInsight.breakdown_insights![category][subcategory] = [];
                }
            });

            // Store breakdown insights in database if we have user context and valid date range
            if (userId && organisationId && dateStart && dateStop && breakdownRequestsForStorage.length > 0) {
                try {
                    await storeBreakdownInsightsData(
                        adId,
                        breakdownRequestsForStorage,
                        dateStart,
                        dateStop,
                        userId,
                        organisationId
                    );
                    logger.info(`[AdService] Successfully stored ${breakdownRequestsForStorage.length} breakdown insight categories for ad ${adId}`);
                } catch (error) {
                    logger.error(`[AdService] Error storing breakdown insights for ad ${adId}:`, error);
                    // Don't throw here - we still want to return the API data even if storage fails
                }
            }
        }

        // Fetch creative details if available
        if (adDetails?.creative?.id) {
            try {
                const creative = await getAdCreativeDetails(adId, userId, undefined, refresh, organisationId || userId);
                detailedInsight.creatives = creative ? [creative] : [];
            } catch (error) {
                logger.error(`[AdService] Error fetching creative details for ad ${adId}:`, error);
                detailedInsight.creatives = [];
            }
        }

        // Cache the result
        detailedInsightsCache.set(cacheKey, detailedInsight);
        return detailedInsight;
    } catch (error) {
        logger.error(`[AdService] Error fetching detailed insights for ad ${adId} with params ${paramString}:`, error);
        throw error;
    }
};

/**
 * Fetches creative details for a specific ad, with optional refresh from API.
 * Checks if creative exists in DB before making API calls.
 * 
 * @param adId - Ad ID.
 * @param userId - User ID for DB queries
 * @param creativeId - Optional creative ID if already known
 * @param refresh - Whether to refresh data from API (defaults to false)
 * @param organisationId - Organisation ID for DB queries
 * @returns Promise resolving to the AdCreative object or null if not found
 */
export const getAdCreativeDetails = async (
    adId: string, 
    userId?: string, 
    creativeId?: string,
    refresh: boolean = false,
    organisationId?: string
): Promise<AdCreative | null> => {
    // If creativeId is not provided, try to get it from the ad
    if (!creativeId) {
        try {
            const fields = "creative{id}";
            const adInfo = await graphGetSingleObject<{creative?: {id: string}}>(`/${adId}`, { fields });
            creativeId = adInfo?.creative?.id;
        } catch (error) {
            logger.error(`[AdService] Failed to get creative ID for ad ${adId}:`, error);
            return null;
        }
    }

    if (!creativeId) {
        logger.info(`[AdService] Ad ${adId} found, but no linked creative ID. Cannot fetch creative details.`);
        return null;
    }

    // Try cache first
    const cacheKey = `creative_${creativeId}_user_${userId || 'shared'}`;
    const cachedData = creativeCache.get(cacheKey);
    if (cachedData !== null && !refresh) {
        logger.info(`[AdService] Cache hit for creative details: ${cacheKey}`);
        return cachedData;
    }

    // If not refreshing and not in cache, try database
    if (!refresh && userId) {
        try {
            // Use provided organisationId or fallback to userId if not provided
            const orgId = organisationId || userId;
            logger.info(`[AdService] Attempting to retrieve creative ${creativeId} from database for org ${orgId}`);
            const { data: dbCreative, error } = await creativeRepository.getCreativeById(creativeId, userId, orgId);
            
            if (dbCreative && !error) {
                logger.info(`[AdService] Found creative ${creativeId} in database`);
                
                // Convert DB format to API format
                const apiCreative: AdCreative = {
                    id: dbCreative.id,
                    account_id: dbCreative.account_id,
                    name: dbCreative.name || undefined,
                    title: dbCreative.title || undefined,
                    body: dbCreative.body || undefined,
                    image_url: dbCreative.image_url || undefined,
                    image_hash: dbCreative.image_hash || undefined,
                    thumbnail_url: dbCreative.thumbnail_url || undefined,
                    object_story_spec: dbCreative.object_story_spec || undefined,
                    asset_feed_spec: dbCreative.asset_feed_spec || undefined,
                    call_to_action_type: dbCreative.call_to_action_type || undefined,
                    video_source_url: dbCreative.video_url || undefined
                };
                
                // Cache the result for future use
                creativeCache.set(cacheKey, apiCreative);
                return apiCreative;
            }
            
            logger.info(`[AdService] Creative ${creativeId} not found in database, will fetch from API`);
        } catch (error) {
            logger.error(`[AdService] Error retrieving creative from database:`, error);
            // Continue to API fetch if DB retrieval fails
        }
    }

    // Fetch from API if refresh=true or no data in cache/DB
    logger.info(`[AdService] ${refresh ? 'Refreshing' : 'Fetching'} creative ${creativeId} from API`);
    try {
        const creative = await graphGetCreativeDetails(creativeId);
        
        // Store in DB if we have user context and creative was found
        if (creative && userId) {
            const orgId = organisationId || userId; // Use provided org ID or fallback to userId
            const dbCreative = apiCreativeToDbCreative(creative);
            await creativeRepository.upsertCreatives([dbCreative], userId, orgId);
        }
        
        // Cache the result
        const ttl = creative ? 3600 : 60; // 1 hour for found, 1 min for not found
        creativeCache.set(cacheKey, creative, ttl);
        return creative;
    } catch (error) {
        logger.error(`[AdService] Error fetching creative details for ID ${creativeId} (from ad ${adId}):`, error);
        if (error instanceof Error && !(error.message.includes('404') || error.message.includes('not found'))) {
            throw new Error(`Failed to fetch creative ${creativeId}: ${error.message}`);
        } else if (!(error instanceof Error)) {
            throw new Error(`Failed to fetch creative ${creativeId} due to an unknown error.`);
        }
        return null;
    }
};

/**
 * Transforms raw breakdown insights into the structured format for database storage
 */
const transformBreakdownInsightsForStorage = (
    adId: string,
    breakdownRequests: Array<{
        category: string;
        subcategory: string;
        insights: AdInsight[];
        breakdownKeys: string[];
    }>,
    dateStart: string,
    dateStop: string
): DbBreakdownInsight[] => {
    const dbBreakdownInsights: DbBreakdownInsight[] = [];

    breakdownRequests.forEach(({ category, subcategory, insights, breakdownKeys }) => {
        if (insights && insights.length > 0) {
            // Process insights using the utility function
            const processedInsights: BreakdownInsight[] = insights.map(insight => 
                extractMinimalBreakdown(insight, breakdownKeys)
            );

            dbBreakdownInsights.push({
                id: uuidv4(),
                ad_id: adId,
                category,
                subcategory,
                breakdown_keys: breakdownKeys,
                insights_data: processedInsights,
                date_start: dateStart,
                date_stop: dateStop,
                organisation_id: '', // Will be filled in by repository function
            });
        }
    });

    return dbBreakdownInsights;
};

/**
 * Transforms stored breakdown insights from DB format to API response format
 */
const transformStoredBreakdownInsights = (
    dbBreakdownInsights: DbBreakdownInsight[]
): { [category: string]: { [subcategory: string]: BreakdownInsight[] } } => {
    const result: { [category: string]: { [subcategory: string]: BreakdownInsight[] } } = {};

    dbBreakdownInsights.forEach(dbInsight => {
        if (!result[dbInsight.category]) {
            result[dbInsight.category] = {};
        }
        result[dbInsight.category][dbInsight.subcategory] = dbInsight.insights_data;
    });

    return result;
};

/**
 * Stores breakdown insights data in the database
 */
const storeBreakdownInsightsData = async (
    adId: string,
    breakdownRequests: Array<{
        category: string;
        subcategory: string;
        insights: AdInsight[];
        breakdownKeys: string[];
    }>,
    dateStart: string,
    dateStop: string,
    userId: string,
    organisationId: string
): Promise<void> => {
    try {
        const dbBreakdownInsights = transformBreakdownInsightsForStorage(
            adId,
            breakdownRequests,
            dateStart,
            dateStop
        );

        if (dbBreakdownInsights.length > 0) {
            await breakdownInsightsRepository.upsertBreakdownInsights(
                dbBreakdownInsights,
                userId,
                organisationId
            );
        }
    } catch (error) {
        logger.error(`[AdService] Error storing breakdown insights for ad ${adId}:`, error);
        throw error;
    }
};

/**
 * Retrieves breakdown insights from database
 */
const getBreakdownInsightsFromDb = async (
    adId: string,
    userId: string,
    organisationId: string,
    dateStart?: string,
    dateStop?: string
): Promise<{ [category: string]: { [subcategory: string]: BreakdownInsight[] } }> => {
    try {
        logger.info(`[AdService] Attempting to retrieve breakdown insights from database for ad ${adId}`);
        
        const { data: dbBreakdownInsights, error } = await breakdownInsightsRepository.getBreakdownInsightsByAd(
            adId,
            userId,
            organisationId,
            undefined, // category filter
            undefined, // subcategory filter
            dateStart,
            dateStop
        );
        
        if (error) {
            logger.error(`[AdService] Error retrieving breakdown insights from database:`, error);
            return {};
        }
        
        if (!dbBreakdownInsights || dbBreakdownInsights.length === 0) {
            logger.info(`[AdService] No breakdown insights found in database for ad ${adId}`);
            return {};
        }
        
        logger.info(`[AdService] Found ${dbBreakdownInsights.length} breakdown insight records in database for ad ${adId}`);
        return transformStoredBreakdownInsights(dbBreakdownInsights);
    } catch (error) {
        logger.error(`[AdService] Error retrieving breakdown insights from database for ad ${adId}:`, error);
        return {};
    }
}; 