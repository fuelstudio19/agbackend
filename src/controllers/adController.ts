import { Request, Response, NextFunction } from 'express';
import * as adService from '../services/adService';
import { AuthenticatedRequest } from '../middlewares/authMiddleware'; // Import AuthenticatedRequest
import { logger } from '../utils/logger';

// Helper to get user ID from authenticated request
const getUserId = (req: AuthenticatedRequest): string | undefined => {
    return req.user?.id;
};

// Helper to get organisation ID from authenticated request
const getOrganisationId = (req: AuthenticatedRequest): string | undefined => {
    return req.organisationId || undefined;
};

// Helper to ensure both IDs are present and handle errors
const getUserAndOrgIds = (req: AuthenticatedRequest, res: Response): { userId: string; organisationId: string } | null => {
    const userId = getUserId(req);
    const organisationId = getOrganisationId(req);

    if (!userId) {
        // This should technically not happen if authMiddleware runs first and succeeds
        logger.error('[AdController] User ID missing from authenticated request.');
        res.status(401).json({ message: "Unauthorized: User identifier missing." });
        return null;
    }
    if (!organisationId) {
        // This happens if the user isn't linked to an organisation
        logger.error(`[AdController] Organisation ID missing for user ${userId}.`);
        // Send 403 Forbidden as the user is authenticated but lacks permission/association
        res.status(403).json({ message: "Forbidden: User not associated with an organisation." });
        return null;
    }
    return { userId, organisationId };
}

// Add utility function for default dates
const getDefaultDates = (): { dateStart: string, dateStop: string } => {
    const today = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(today.getDate() - 7);
    
    // Format dates as YYYY-MM-DD
    const formatDate = (date: Date): string => {
        return date.toISOString().split('T')[0];
    };
    
    return {
        dateStart: formatDate(oneWeekAgo),
        dateStop: formatDate(today)
    };
};

/**
 * List Ads by Account ID
 */
export const listAdsByAccountHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { accountId } = req.params;
        const refresh = req.query.refresh === 'true';
        if (!accountId) {
            res.status(400).json({ message: "Account ID parameter is required." });
            return;
        }
        
        const ids = getUserAndOrgIds(req as AuthenticatedRequest, res);
        if (!ids) return; // Error response already sent
        const { userId, organisationId } = ids;

        // Get date parameters from query or use defaults
        let { dateStart, dateStop } = req.query as { dateStart?: string, dateStop?: string };
        if (!dateStart || !dateStop) {
            const defaultDates = getDefaultDates();
            dateStart = dateStart || defaultDates.dateStart;
            dateStop = dateStop || defaultDates.dateStop;
        }

        logger.info(`[AdController] User ${userId} (Org: ${organisationId}) listing ads for account ${accountId} from ${dateStart} to ${dateStop}`);
        const ads = await adService.getAdsByAccount(accountId, userId, organisationId, refresh, dateStart, dateStop);
        res.json({ items: ads });
    } catch (error) {
        logger.error(`[AdController] Error listing ads for account ${req.params.accountId}:`, error);
        next(error);
    }
};

/**
 * List Ads by Ad Set ID
 */
export const listAdsByAdSetHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { adSetId, accountId } = req.params;
        const refresh = req.query.refresh === 'true';
        if (!adSetId) {
            res.status(400).json({ message: "Ad Set ID parameter is required." });
            return;
        }
        
        const ids = getUserAndOrgIds(req as AuthenticatedRequest, res);
        if (!ids) return; // Error response already sent
        const { userId, organisationId } = ids;
        
        // Get date parameters from query or use defaults
        let { dateStart, dateStop } = req.query as { dateStart?: string, dateStop?: string };
        if (!dateStart || !dateStop) {
            const defaultDates = getDefaultDates();
            dateStart = dateStart || defaultDates.dateStart;
            dateStop = dateStop || defaultDates.dateStop;
        }
        
        logger.info(`[AdController] User ${userId} (Org: ${organisationId}) listing ads for ad set ${adSetId}${accountId ? ` in account ${accountId}` : ''} from ${dateStart} to ${dateStop}`);
        const ads = await adService.getAdsByAdSet(adSetId, userId, organisationId, refresh, dateStart, dateStop);
        res.json({ items: ads });
    } catch (error) {
        logger.error(`[AdController] Error listing ads for ad set ${req.params.adSetId}:`, error);
        next(error);
    }
};

/**
 * List Ads by Campaign ID
 */
export const listAdsByCampaignHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { campaignId, accountId } = req.params;
        const refresh = req.query.refresh === 'true';
         if (!campaignId) {
            res.status(400).json({ message: "Campaign ID parameter is required." });
            return;
        }
        
        const ids = getUserAndOrgIds(req as AuthenticatedRequest, res);
        if (!ids) return; // Error response already sent
        const { userId, organisationId } = ids;

        // Get date parameters from query or use defaults
        let { dateStart, dateStop } = req.query as { dateStart?: string, dateStop?: string };
        if (!dateStart || !dateStop) {
            const defaultDates = getDefaultDates();
            dateStart = dateStart || defaultDates.dateStart;
            dateStop = dateStop || defaultDates.dateStop;
        }

        logger.info(`[AdController] User ${userId} (Org: ${organisationId}) listing ads for campaign ${campaignId}${accountId ? ` in account ${accountId}` : ''} from ${dateStart} to ${dateStop}`);
        const ads = await adService.getAdsByCampaign(campaignId, userId, organisationId, refresh, dateStart, dateStop);
        res.json({ items: ads });
    } catch (error) {
        logger.error(`[AdController] Error listing ads for campaign ${req.params.campaignId}:`, error);
        next(error);
    }
};

/**
 * Get Ad by ID
 */
export const getAdHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { adId, accountId } = req.params;
        const refresh = req.query.refresh === 'true';
         if (!adId) {
            res.status(400).json({ message: "Ad ID parameter is required." });
            return;
        }
        
        const ids = getUserAndOrgIds(req as AuthenticatedRequest, res);
        if (!ids) return; // Error response already sent
        const { userId, organisationId } = ids;
        
        // Get date parameters from query or use defaults
        let { dateStart, dateStop } = req.query as { dateStart?: string, dateStop?: string };
        if (!dateStart || !dateStop) {
            const defaultDates = getDefaultDates();
            dateStart = dateStart || defaultDates.dateStart;
            dateStop = dateStop || defaultDates.dateStop;
        }
        
        logger.info(`[AdController] User ${userId} (Org: ${organisationId}) getting ad ${adId}${accountId ? ` from account ${accountId}` : ''} from ${dateStart} to ${dateStop}`);
        // Pass date parameters to the service
        const ad = await adService.getAdById(adId, userId, organisationId, refresh, dateStart, dateStop);
        
        if (!ad) {
            // Service should handle not found for the given user/org
            res.status(404).json({ message: `Ad with ID ${adId} not found.` });
            return;
        }
        
        // Account ID verification (if provided in route) should ideally happen in the service 
        // after retrieving the ad, comparing ad.account_id
        if (accountId && ad.account_id && ad.account_id !== accountId && 'act_' + ad.account_id !== accountId) {
            res.status(404).json({ 
                message: `Ad with ID ${adId} not found in account ${accountId}.`
            });
            return;
        }
        
        res.json(ad);
    } catch (error) {
        logger.error(`[AdController] Error getting ad ${req.params.adId}:`, error);
        next(error);
    }
};

/**
 * Get Ad Insights
 * Expects insight parameters in the request body.
 */
export const getAdInsightsHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { adId, accountId } = req.params;
         if (!adId) {
            res.status(400).json({ message: "Ad ID parameter is required." });
            return;
        }
        
        const ids = getUserAndOrgIds(req as AuthenticatedRequest, res);
        if (!ids) return; // Error response already sent
        const { userId, organisationId } = ids;
        
        const insightsParams = req.body;
         if (typeof insightsParams !== 'object' || insightsParams === null || Object.keys(insightsParams).length === 0) {
             res.status(400).json({ message: "Insights parameters object required in the request body." });
            return;
         }

         logger.info(`[AdController] User ${userId} (Org: ${organisationId}) getting insights for ad ${adId}${accountId ? ` in account ${accountId}` : ''} with params:`, JSON.stringify(insightsParams));

        // Hardcoded fields remain the same
        const hardcodedFields = [
            "impressions", "clicks", "reach", "spend", "cpm", "cpc", "ctr", 
            "frequency", "unique_clicks", "actions", "conversions", 
            "video_play_actions", "video_p25_watched_actions", 
            "video_p50_watched_actions", "video_p75_watched_actions", 
            "video_p100_watched_actions", "cost_per_action_type", 
            "cost_per_unique_click", "outbound_clicks", "website_ctr",
            "objective", "date_start", "date_stop"
        ];
        
        const modifiedParams = {
            ...insightsParams,
            fields: hardcodedFields
        };

        // Pass userId and potentially organisationId if needed by the service/API call logic
        const insights = await adService.getAdInsights(adId, modifiedParams, userId);
        res.json({ items: insights }); 

    } catch (error) {
         logger.error(`[AdController] Error getting insights for ad ${req.params.adId}:`, error);
         if (error instanceof Error && error.message.startsWith('Invalid insights request parameters:')) {
             res.status(400).json({ message: "Invalid request body.", details: error.message });
         } else {
            next(error); 
         }
    }
};

/**
 * Get Ad Creative Details
 */
export const getAdCreativeHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { adId, accountId } = req.params;
         if (!adId) {
            res.status(400).json({ message: "Ad ID parameter is required." });
            return;
        }
        
        const ids = getUserAndOrgIds(req as AuthenticatedRequest, res);
        if (!ids) return; // Error response already sent
        const { userId, organisationId } = ids;
        
        logger.info(`[AdController] User ${userId} (Org: ${organisationId}) getting creative for ad ${adId}${accountId ? ` in account ${accountId}` : ''}`);
        // Pass userId and potentially organisationId
        const creative = await adService.getAdCreativeDetails(adId, userId);
        if (!creative) {
            res.status(404).json({ message: `Creative details not found for Ad with ID ${adId}.` });
            return;
        }
        res.json(creative);
    } catch (error) {
        logger.error(`[AdController] Error getting creative for ad ${req.params.adId}:`, error);
        next(error);
    }
};

/**
 * Get Detailed Ad Insights
 * Expects detailed insight parameters in the request body.
 */
export const getDetailedAdInsightsHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { adId, accountId } = req.params;
        if (!adId) {
            res.status(400).json({ message: "Ad ID parameter is required." });
            return;
        }
        
        const ids = getUserAndOrgIds(req as AuthenticatedRequest, res);
        if (!ids) return; // Error response already sent
        const { userId, organisationId } = ids;
        
        // Handle refresh parameter (optional, defaults to false)
        const refresh = req.query.refresh === 'true';
        
        const insightsParams = req.body;
        if (typeof insightsParams !== 'object' || insightsParams === null || Object.keys(insightsParams).length === 0) {
            res.status(400).json({ message: "Detailed insights parameters object required in the request body." });
            return;
        }
        
        // Date validation remains the same
        if (insightsParams.time_range) {
            const { since, until } = insightsParams.time_range;
            if (!since || !until) {
                res.status(400).json({ 
                    message: "Invalid time_range parameters. Both since and until must be provided in YYYY-MM-DD format." 
                });
                return;
            }
            const sinceDate = new Date(since);
            const untilDate = new Date(until);
            if (isNaN(sinceDate.getTime()) || isNaN(untilDate.getTime())) {
                res.status(400).json({ 
                    message: "Invalid date format in time_range. Use YYYY-MM-DD format."
                });
                return;
            }
            if (sinceDate > untilDate) {
                res.status(400).json({ 
                    message: "End date (until) must be equal to or after start date (since)."
                });
                return;
            }
        }

        logger.info(`[AdController] User ${userId} (Org: ${organisationId}) getting detailed insights for ad ${adId}${accountId ? ` in account ${accountId}` : ''} with params:`, JSON.stringify(insightsParams), `Refresh: ${refresh}`);

        // Hardcoded fields remain the same
        const hardcodedFields = [
            "impressions", "clicks", "reach", "spend", "cpm", "cpc", "ctr", 
            "frequency", "unique_clicks", "actions", "conversions", 
            "video_play_actions", "video_p25_watched_actions", 
            "video_p50_watched_actions", "video_p75_watched_actions", 
            "video_p100_watched_actions", "cost_per_action_type", 
            "cost_per_unique_click", "outbound_clicks", "website_ctr",
            "objective", "date_start", "date_stop"
        ];
        
        const modifiedParams = {
            ...insightsParams,
            fields: hardcodedFields
        };

        // Pass userId, organisationId, and refresh parameter
        const detailedInsights = await adService.getDetailedAdInsights(adId, modifiedParams, userId, organisationId, refresh);
        res.json(detailedInsights);
    } catch (error) {
        logger.error(`[AdController] Error getting detailed insights for ad ${req.params.adId}:`, error);
        
        if (error instanceof Error && error.message.includes('Invalid')) {
            res.status(400).json({ 
                message: "Invalid request parameters.", 
                details: error.message 
            });
        } else {
            next(error); 
        }
    }
}; 