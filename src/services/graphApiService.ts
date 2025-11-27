import axios, { AxiosInstance, AxiosError, AxiosResponse, isAxiosError } from 'axios';
import {
    FacebookApiResponse,
    AdAccount, 
    Campaign,
    AdSet,
    Ad,
    AdCreative,
    AdInsight,
    GetInsightsParams,
    VideoDetails,
    GetCreativeParams,
    GetImageParams,
    GetVideoParams,
    FacebookPaging
} from '../types/graphApiTypes';
import * as process from 'process'; // Ensure process is available for env vars
import { logger } from '../utils/logger';

// --- Configuration ---
// It's better to use a dedicated config management library (like dotenv + custom config file)
// but using process.env directly for simplicity here.
const API_VERSION = process.env.FACEBOOK_API_VERSION || 'v22.0';
const BASE_URL = process.env.FACEBOOK_API_BASE_URL || `https://graph.facebook.com/${API_VERSION}`;
const ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN || '';

if (!ACCESS_TOKEN) {
    logger.error("FATAL ERROR: FACEBOOK_ACCESS_TOKEN environment variable is not set.");
    throw new Error("FACEBOOK_ACCESS_TOKEN environment variable is required");
}

// --- Error Handling ---
class GraphApiError extends Error {
    public status?: number;
    public fbError?: any;

    constructor(message: string, status?: number, fbError?: any) {
        super(message);
        this.name = 'GraphApiError';
        this.status = status;
        this.fbError = fbError;
    }
}

// --- Axios Client Setup (Module Scope) ---
const client: AxiosInstance = axios.create({
    baseURL: BASE_URL,
    timeout: 30000, // 30 seconds timeout
});

// Apply interceptors directly to the module-scoped client
client.interceptors.response.use(
    (response: AxiosResponse) => {
        // Check for Facebook API errors within a successful HTTP response payload
        if (response.data && response.data.error) {
            logger.error("Facebook API Error (in 2xx response body):", response.data.error);
            // Throw a custom error to be caught by the calling function
            throw new GraphApiError(
                `Facebook API Error: ${response.data.error.message || JSON.stringify(response.data.error)}`,
                response.status,
                response.data.error
            );
        }
        return response; // Pass through successful responses
    },
    (error: Error | AxiosError) => { // Catch Axios and other errors
        let message = 'Graph API request failed';
        let status: number | undefined;
        let fbErrorPayload: any | undefined;

        // Use the imported type guard 'isAxiosError'
        if (isAxiosError(error)) {
            status = error.response?.status;
            const responseData = error.response?.data;
            // Safely access potential error structure within Axios response data
            fbErrorPayload = typeof responseData === 'object' && responseData !== null && 'error' in responseData ? (responseData as any).error : responseData;
            // Try to get a meaningful message from FB error structure
            const fbMessage = fbErrorPayload?.message || fbErrorPayload?.error_user_msg || fbErrorPayload?.error?.message || JSON.stringify(fbErrorPayload);
            message = `Graph API Error: ${status ?? 'Unknown Status'} - ${fbMessage}`;
            logger.error(`Graph API Axios Error (${status ?? 'N/A'}):`, responseData);
        } else {
            // Handle non-Axios errors (network issues, setup problems)
            message = `Graph API Network/Setup Error: ${error.message}`;
            logger.error(message, error);
        }
        // Reject with the custom error class, including status and FB error details
        return Promise.reject(new GraphApiError(message, status, fbErrorPayload));
    }
);

// --- Core Request Functions ---

/**
 * Makes a raw API request using the configured Axios client.
 * Prefer using higher-level functions like `getAllPages` or `getSingleObject` where possible.
 */
const makeApiRequest = async <T>(
    method: 'get' | 'post' | 'delete',
    endpoint: string,
    params: Record<string, any> = {},
    data?: Record<string, any>
): Promise<AxiosResponse<T>> => {
    if (!ACCESS_TOKEN) {
        throw new GraphApiError("Facebook Access Token is missing for API request.", 401);
    }
    // Ensure endpoint starts with / if it's not a full URL
    const urlPath = endpoint.startsWith('http') ? endpoint : (endpoint.startsWith('/') ? endpoint : `/${endpoint}`);
    const requestParams = { ...params, access_token: ACCESS_TOKEN };

    // Construct the full URL for logging
    const fullUrl = urlPath.startsWith('http') ? urlPath : `${client.defaults.baseURL}${urlPath}`;
    const queryString = new URLSearchParams(requestParams).toString();
    logger.info(`Making API Request: ${method.toUpperCase()} ${fullUrl}?${queryString}`);
    logger.info(`Using Base URL: ${client.defaults.baseURL}`); // Log the base URL to verify version

    try {
        const response: AxiosResponse<T> = await client.request<T>({
            method,
            url: urlPath, // Axios combines this with baseURL
            params: requestParams,
            data,
        });
        return response;
    } catch (error) {
        // Remove redundant logging here - interceptor already logged details
        // if (error instanceof GraphApiError) {
        //      logger.error(`GraphApiError in makeApiRequest (${method} ${urlPath}): Status ${error.status}, Msg: ${error.message}`);
        // } else if (error instanceof Error) {
        //     logger.error(`Non-GraphApiError in makeApiRequest (${method} ${urlPath}): ${error.message}`);
        //      // Wrap it for consistency, though interceptor should ideally handle this
        //      throw new GraphApiError(error.message);
        // } else {
        //     logger.error(`Unknown error in makeApiRequest (${method} ${urlPath}):`, error);
        //     throw new GraphApiError('Unknown error during API request.');
        // }
        throw error; // Re-throw the error (likely GraphApiError caught by interceptor)
    }
};

/**
 * Fetches all pages for endpoints returning the standard Facebook { data: T[], paging: ... } structure.
 * @param endpoint Initial API endpoint path.
 * @param params Query parameters for the initial request.
 * @param accessToken Optional access token override.
 * @returns Promise resolving to an array of all items fetched across pages.
 */
export const getAllPages = async <T>(
    endpoint: string,
    params: Record<string, any> = {},
): Promise<T[]> => {
    let allResults: T[] = [];
    let currentParams: Record<string, any> = { ...params, limit: params.limit || 100 };
    let nextUrl: string | undefined = endpoint;
    let isFirstRequest = true;

    logger.info(`Fetching all pages for: ${endpoint} with initial params: ${JSON.stringify(params)}`);

    while (nextUrl) {
        const requestUrl: string = nextUrl;
        const paramsForThisRequest = isFirstRequest ? currentParams : {};
        isFirstRequest = false;

        try {
            const response = await makeApiRequest<FacebookApiResponse<T>>(
                'get', requestUrl, paramsForThisRequest
            );
            const responseData = response.data;

            if (responseData?.data && Array.isArray(responseData.data) && responseData.data.length > 0) {
                allResults = allResults.concat(responseData.data);
                logger.info(`Fetched ${responseData.data.length} items (Total: ${allResults.length})`);
            } else {
                break; // No more data
            }

            nextUrl = responseData.paging?.next;
            if (nextUrl) {
                if (nextUrl.startsWith(BASE_URL)) nextUrl = nextUrl.substring(BASE_URL.length);
                if (nextUrl && !nextUrl.startsWith('/')) nextUrl = `/${nextUrl}`;
            } else {
                break; // No next page
            }
        } catch (error) {
            // logger.error(`Error fetching page URL ${requestUrl}:`, error); // Remove redundant log
            if (error instanceof GraphApiError) {
                // Log from interceptor is sufficient, just handle the logic here
                // logger.error(`GraphAPIError Status: ${error.status}, FB Error: ${JSON.stringify(error.fbError)}`);
                if (error.status === 400 || error.status === 401 || error.status === 403 || error.status === 404 || (error.status && error.status >= 500) ) {
                    logger.warn(`Stopping pagination due to critical error status ${error.status}.`);
                    break;
                }
            } else {
                logger.error("Unexpected non-GraphApiError encountered during pagination. Stopping.", error);
                break;
            }
            // Decide whether to throw or return partial results
            if (allResults.length === 0) throw error; // Throw if no results were fetched at all
            else { logger.warn("Error during pagination. Returning partial results."); break; } // Otherwise break and return what we have
        }
    }
    logger.info(`Finished fetching pages for ${endpoint}. Total items: ${allResults.length}`);
    return allResults;
};

/** Fetches a single object by its ID, expecting the object directly in response.data */
export const getSingleObject = async <T>(
    endpoint: string,
    params: Record<string, any>,
): Promise<T | null> => {
    try {
        const response = await makeApiRequest<T>('get', endpoint, params);
        return response.data ?? null;
    } catch (error) {
        logger.error(`Error fetching single object from ${endpoint}:`, (error instanceof Error ? error.message : error));
        if (error instanceof GraphApiError && error.status === 404) {
            logger.info(`Object not found at ${endpoint}.`);
            return null;
        }
        throw error; // Re-throw other errors
    }
};

// --- Specific Entity Fetching Functions ---EXPORTED---

export const getAdAccounts = (): Promise<AdAccount[]> => {
    const fields = "id,account_id,name,currency,timezone_name,timezone_offset_hours_utc,business_country_code,amount_spent,min_campaign_group_spend_cap";
    return getAllPages<AdAccount>('/me/adaccounts', { fields });
};

export const getCampaigns = (accountId: string, dateStart?: string, dateStop?: string): Promise<Campaign[]> => {
    const actAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
    let insightsFields = "cpc,ctr,impressions,spend,date_start,date_stop";
    let insightsQuery = `insights.fields(${insightsFields})`;

    if (dateStart && dateStop) {
        // Ensure date format is YYYY-MM-DD if necessary, though FB API is usually flexible
        const timeRange = JSON.stringify({ since: dateStart, until: dateStop });
        insightsQuery = `insights.time_range(${timeRange}).fields(${insightsFields})`;
    }

    const fields = `id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time,account_id,${insightsQuery}`;
    return getAllPages<Campaign>(`/${actAccountId}/campaigns`, { fields });
};

export const getCampaignById = (campaignId: string, dateStart?: string, dateStop?: string): Promise<Campaign | null> => {
    let insightsFields = "cpc,ctr,impressions,date_start,date_stop";
    let insightsQuery = `insights.fields(${insightsFields})`;

    if (dateStart && dateStop) {
        // Ensure date format is YYYY-MM-DD if necessary, though FB API is usually flexible
        const timeRange = JSON.stringify({ since: dateStart, until: dateStop });
        insightsQuery = `insights.time_range(${timeRange}).fields(${insightsFields})`;
    }

    const fields = `id,name,status,effective_status,objective,buying_type,daily_budget,lifetime_budget,spend_cap,start_time,end_time,account_id,${insightsQuery}`;
    return getSingleObject<Campaign>(`/${campaignId}`, { fields });
};

export const getAdSets = (accountId: string): Promise<AdSet[]> => {
    const actAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
    const fields = "id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,optimization_goal,billing_event,bid_amount,start_time,end_time,targeting,account_id";
    return getAllPages<AdSet>(`/${actAccountId}/adsets`, { fields });
};

export const getAdsByAccount = (accountId: string, dateStart?: string, dateStop?: string): Promise<Ad[]> => {
    const actAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
    
    let insightsFields = "cpc,ctr,impressions,clicks,spend,reach,date_start,date_stop";
    let insightsQuery = `insights.fields(${insightsFields})`;

    if (dateStart && dateStop) {
        // Ensure date format is YYYY-MM-DD if necessary, though FB API is usually flexible
        const timeRange = JSON.stringify({ since: dateStart, until: dateStop });
        insightsQuery = `insights.time_range(${timeRange}).fields(${insightsFields})`;
    }

    const fields = `id,name,adset_id,campaign_id,status,effective_status,bid_type,created_time,updated_time,account_id,creative{id},${insightsQuery}`;
    return getAllPages<Ad>(`/${actAccountId}/ads`, { fields });
};

export const getAdsByCampaign = (campaignId: string, dateStart?: string, dateStop?: string): Promise<Ad[]> => {
    let insightsFields = "cpc,ctr,impressions,clicks,spend,reach,date_start,date_stop";
    let insightsQuery = `insights.fields(${insightsFields})`;

    if (dateStart && dateStop) {
        // Ensure date format is YYYY-MM-DD if necessary, though FB API is usually flexible
        const timeRange = JSON.stringify({ since: dateStart, until: dateStop });
        insightsQuery = `insights.time_range(${timeRange}).fields(${insightsFields})`;
    }

    const fields = `id,name,adset_id,campaign_id,status,effective_status,bid_type,created_time,updated_time,account_id,creative{id},${insightsQuery}`;
    return getAllPages<Ad>(`/${campaignId}/ads`, { fields });
};

export const getAdsByAdSet = (adSetId: string, dateStart?: string, dateStop?: string): Promise<Ad[]> => {
    let insightsFields = "cpc,ctr,impressions,clicks,spend,reach,date_start,date_stop";
    let insightsQuery = `insights.fields(${insightsFields})`;

    if (dateStart && dateStop) {
        // Ensure date format is YYYY-MM-DD if necessary, though FB API is usually flexible
        const timeRange = JSON.stringify({ since: dateStart, until: dateStop });
        insightsQuery = `insights.time_range(${timeRange}).fields(${insightsFields})`;
    }

    const fields = `id,name,adset_id,campaign_id,status,effective_status,bid_type,created_time,updated_time,account_id,creative{id},${insightsQuery}`;
    return getAllPages<Ad>(`/${adSetId}/ads`, { fields });
};

export const getAdCreatives = (adId: string, params?: GetCreativeParams): Promise<AdCreative[]> => {
    const defaultFields = 'id,name,title,body,image_url,image_hash,object_story_spec,thumbnail_url,video_id,call_to_action_type,effective_object_story_id,asset_feed_spec,account_id';
    const fields = params?.fields?.join(',') || defaultFields;
    return getAllPages<AdCreative>(`/${adId}/adcreatives`, { fields });
};

export const getInsights = (objectId: string, params: GetInsightsParams): Promise<AdInsight[]> => {
    const endpoint = `/${objectId}/insights`;
    const requestParams: Record<string, any> = { level: params.level };
    requestParams['fields'] = params.fields?.join(',') || 'impressions,clicks,reach,spend,cpm,cpc,ctr,account_id,campaign_id,adset_id,ad_id,account_name,campaign_name,adset_name,ad_name,date_start,date_stop';
    if (params.time_range) requestParams['time_range'] = JSON.stringify(params.time_range);
    if (params.breakdowns?.length) requestParams['breakdowns'] = params.breakdowns.join(',');
    if (params.time_increment) requestParams['time_increment'] = params.time_increment;
    if (params.filtering) requestParams['filtering'] = JSON.stringify(params.filtering);
    if (params.limit) requestParams['limit'] = params.limit;
    if (params.use_unified_attribution_setting !== undefined) requestParams['use_unified_attribution_setting'] = params.use_unified_attribution_setting;
    return getAllPages<AdInsight>(endpoint, requestParams);
};

/**
 * Get insights with a specific breakdown combination.
 * Helper function for detailed insights.
 */
export const getInsightsWithBreakdown = (
    objectId: string, 
    breakdowns: string[], 
    params: GetInsightsParams
): Promise<AdInsight[]> => {
    // Clone params to avoid mutating the original
    const breakdownParams: GetInsightsParams = { 
        ...params,
        breakdowns
    };
    
    return getInsights(objectId, breakdownParams);
};

export const getImagesByHashes = async (accountId: string, params: GetImageParams): Promise<Record<string, any>> => {
    const actAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
    const defaultFields = "hash,url,permalink_url,name,width,height";
    const fields = params.fields?.join(',') || defaultFields;
    const hashesParam = JSON.stringify(params.hashes);
    try {
        const allImageData = await getAllPages<{ hash: string; [key: string]: any }>(
            `/${actAccountId}/adimages`, { hashes: hashesParam, fields: fields }
        );
        const resultMap: Record<string, any> = {};
        allImageData.forEach(imgData => { if (imgData.hash) resultMap[imgData.hash] = imgData; });
        return resultMap;
    } catch (error) {
        logger.error(`Error in getImagesByHashes for account ${actAccountId}:`, error);
        throw error;
    }
};

// This function now needs getSingleObject, which is exported.
// It also calls getImagesByHashes and getVideoDetails, which are exported.
export const getCreativeDetails = async (creativeId: string, params?: GetCreativeParams): Promise<AdCreative | null> => {
    const defaultFields = [
        'id', 'name', 'account_id', 'object_story_spec{video_data, photo_data, link_data}',
        'asset_feed_spec{images, videos, bodies, titles, descriptions}',
        'image_url', 'image_hash', 'call_to_action_type', 'thumbnail_url',
        'title', 'body', 'video_id', 'effective_object_story_id'
    ].join(',');
    const fields = params?.fields?.join(',') || defaultFields;

    // Use the exported getSingleObject function
    const creativeData = await getSingleObject<AdCreative>(`/${creativeId}`, { fields });
    if (!creativeData) return null;

    const accountId = creativeData.account_id;
    const imageHashes = new Set<string>();
    if (creativeData.image_hash) imageHashes.add(creativeData.image_hash);
    creativeData.asset_feed_spec?.images?.forEach((img: any) => img.hash && imageHashes.add(img.hash));

    if (accountId && imageHashes.size > 0) {
        try {
            // Use the exported getImagesByHashes function
            const imageDetailsMap = await getImagesByHashes(accountId, { hashes: Array.from(imageHashes) });
            if (creativeData.image_hash && imageDetailsMap[creativeData.image_hash]?.url) {
                creativeData.image_url = imageDetailsMap[creativeData.image_hash].url;
            }
        } catch (imgError) { logger.warn(`Could not process image details for creative ${creativeId}:`, imgError); }
    }

    const videoIds = new Set<string>();
    if (creativeData.video_id) videoIds.add(creativeData.video_id);
    creativeData.asset_feed_spec?.videos?.forEach((vid: any) => vid.video_id && videoIds.add(vid.video_id));

    if (videoIds.size > 0) {
        for (const videoId of videoIds) {
            try {
                // Use the exported getVideoDetails function
                const videoDetails = await getVideoDetails(videoId);
                if (videoDetails) {
                    if (creativeData.video_id === videoId) {
                        creativeData.video_details = videoDetails;
                        creativeData.video_source_url = videoDetails.source;
                    }
                }
            } catch (vidError) { logger.warn(`Could not process video details for ${videoId}:`, vidError); }
        }
    }
    return creativeData;
};

export const getVideoDetails = (videoId: string, params?: GetVideoParams): Promise<VideoDetails | null> => {
    const defaultFields = "id,source,permalink_url,title,description,length,published";
    const fields = params?.fields?.join(',') || defaultFields;
    // Use the exported getSingleObject function
    return getSingleObject<VideoDetails>(`/${videoId}`, { fields });
};

export const getAdTargeting = (adSetId: string): Promise<any | null> => {
    // Use the exported getSingleObject function
    return getSingleObject<{ targeting?: any }>(`/${adSetId}`, { fields: 'targeting' })
        .then(response => response?.targeting ?? null); // Extract targeting from result
};

/**
 * Fetches insights for an ad account with given parameters
 * 
 * @param accountId - The ad account ID (with or without 'act_' prefix)
 * @param params - Parameters for insights API call
 * @returns Promise resolving to array of insights
 */
export const getAdAccountInsights = async (
    accountId: string, 
    params: GetInsightsParams
): Promise<AdInsight[]> => {
    // Normalize the account ID
    const actAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
    
    // Make sure level is set to 'account'
    const insightsParams: GetInsightsParams = {
        ...params,
        level: 'account',
    };
    
    // Set default fields if not provided
    if (!insightsParams.fields || insightsParams.fields.length === 0) {
        insightsParams.fields = [
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
            'cost_per_action_type'
        ];
    }
    
    // Prepare parameters for API call
    const apiParams: Record<string, any> = {
        level: insightsParams.level,
        fields: insightsParams.fields.join(','),
    };


    if (insightsParams.time_range) {
        apiParams.time_range = JSON.stringify(insightsParams.time_range);
    }
    
    // Add optional parameters if they exist
    if (insightsParams.breakdowns && insightsParams.breakdowns.length > 0) {
        apiParams.breakdowns = insightsParams.breakdowns.join(',');
    }
    
    if (insightsParams.time_increment) {
        apiParams.time_increment = insightsParams.time_increment;
    }
    
    if (insightsParams.filtering) {
        apiParams.filtering = JSON.stringify(insightsParams.filtering);
    }
    
    if (insightsParams.limit) {
        apiParams.limit = insightsParams.limit;
    }
    
    if (insightsParams.use_unified_attribution_setting) {
        apiParams.use_unified_attribution_setting = insightsParams.use_unified_attribution_setting;
    }
    
    // Make the API call
    logger.info(`[GraphApiService] Fetching insights for account ${actAccountId} with params:`, apiParams);
    return await getAllPages<AdInsight>(`/${actAccountId}/insights`, apiParams);
};

/**
 * Fetches insights for a campaign with given parameters
 * 
 * @param campaignId - The campaign ID
 * @param params - Parameters for insights API call
 * @returns Promise resolving to array of insights
 */
export const getCampaignInsights = async (
    campaignId: string, 
    params: GetInsightsParams
): Promise<AdInsight[]> => {
    // Make sure level is set to 'campaign'
    const insightsParams: GetInsightsParams = {
        ...params,
        level: 'campaign',
    };
    
    // Set default fields if not provided
    if (!insightsParams.fields || insightsParams.fields.length === 0) {
        insightsParams.fields = [
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
            'cost_per_action_type'
        ];
    }
    
    // Prepare parameters for API call
    const apiParams: Record<string, any> = {
        fields: insightsParams.fields.join(','),
        level: insightsParams.level
    };
    
    // Add time range if specified
    if (insightsParams.time_range) {
        apiParams.time_range = JSON.stringify(insightsParams.time_range);
    }
    
    // Add optional parameters if they exist
    if (insightsParams.breakdowns && insightsParams.breakdowns.length > 0) {
        apiParams.breakdowns = insightsParams.breakdowns.join(',');
    }
    
    if (insightsParams.time_increment) {
        apiParams.time_increment = insightsParams.time_increment;
    }
    
    if (insightsParams.filtering) {
        apiParams.filtering = JSON.stringify(insightsParams.filtering);
    }
    
    if (insightsParams.limit) {
        apiParams.limit = insightsParams.limit;
    }
    
    if (insightsParams.use_unified_attribution_setting) {
        apiParams.use_unified_attribution_setting = insightsParams.use_unified_attribution_setting;
    }
    
    // Make the API call
    logger.info(`[GraphApiService] Fetching insights for campaign ${campaignId} with params:`, apiParams);
    return await getAllPages<AdInsight>(`/${campaignId}/insights`, apiParams);
};

// Optional: Export a singleton instance if appropriate for your application
// export const graphApiService = new GraphApiService(); 