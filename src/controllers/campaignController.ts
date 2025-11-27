import { Request, Response, NextFunction } from 'express';
import { 
    getCampaignById, 
    getCampaignsForAccount 
} from '../services/campaignService';
import { getCampaignInsights } from '../services/insightsService';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { getDefaultDates, getUserAndOrgIds } from '../utils/general';
import { logger } from '../utils/logger';


/**
 * Handles request to list campaigns for a specific ad account.
 * Can optionally filter by date range for insights.
 */
export const listCampaignsForAccountHandler = async (
    req: Request, 
    res: Response, 
    next: NextFunction
): Promise<void> => {
    try {
        logger.info(`[CampaignController] listCampaignsForAccountHandler called`, req.params, req.query);
        const { accountId } = req.params;
        // Handle refresh parameter (optional, defaults to false)
        const refresh = req.query.refresh === 'true';
        
        // Get date parameters from query or use defaults
        let { date_start: dateStart, date_end: dateStop } = req.query as { date_start?: string, date_end?: string };
        if (!dateStart || !dateStop) {
            const defaultDates = getDefaultDates();
            dateStart = dateStart || defaultDates.dateStart;
            dateStop = dateStop || defaultDates.dateStop;
        }

        // Get user and org IDs
        const ids = getUserAndOrgIds(req as AuthenticatedRequest, res);
        if (!ids) return; // Error response already sent
        const { userId, organisationId } = ids;

        if (!accountId) {
            res.status(400).json({ message: "Account ID parameter is required." });
            return;
        }
        
        // Validate date format if provided (YYYY-MM-DD)
        if (dateStart && dateStop) {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(dateStart) || !dateRegex.test(dateStop)) {
                res.status(400).json({ message: "date_start and date_end must be in YYYY-MM-DD format." });
                return;
            }
        }

        logger.info(`[CampaignController] User ${userId} (Org: ${organisationId}) requested campaigns for account ${accountId}. Refresh: ${refresh}, date range: ${dateStart} to ${dateStop}`);
        
        const campaigns = await getCampaignsForAccount(accountId, userId, organisationId, refresh, dateStart, dateStop);
        res.json({ items: campaigns });

    } catch (error) {
        logger.error(`[CampaignController] Error in listCampaignsForAccount (Account ID: ${req.params.accountId}):`, error);
        next(error);
    }
};

/**
 * Handles request to get a specific campaign by ID.
 * Can optionally filter by date range for insights.
 */
export const getCampaignHandler = async (
    req: Request, 
    res: Response, 
    next: NextFunction
): Promise<void> => {
    try {
        const { campaignId } = req.params;
        // Handle refresh parameter (optional, defaults to false)
        const refresh = req.query.refresh === 'true';
        
        // Get date parameters from query or use defaults
        let { date_start: dateStart, date_end: dateStop } = req.query as { date_start?: string, date_end?: string };
        if (!dateStart || !dateStop) {
            const defaultDates = getDefaultDates();
            dateStart = dateStart || defaultDates.dateStart;
            dateStop = dateStop || defaultDates.dateStop;
        }
        
        // Get user and org IDs
        const ids = getUserAndOrgIds(req as AuthenticatedRequest, res);
        if (!ids) return; // Error response already sent
        const { userId, organisationId } = ids;

        if (!campaignId) {
            res.status(400).json({ message: "Campaign ID parameter is required." });
            return;
        }
        
        // Validate date format if provided (YYYY-MM-DD)
        if (dateStart && dateStop) {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(dateStart) || !dateRegex.test(dateStop)) {
                res.status(400).json({ message: "date_start and date_end must be in YYYY-MM-DD format." });
                return;
            }
        }

        logger.info(`[CampaignController] User ${userId} (Org: ${organisationId}) getting campaign ${campaignId}. Refresh: ${refresh}, date range: ${dateStart} to ${dateStop}`);
        
        const campaign = await getCampaignById(campaignId, userId, organisationId, refresh, dateStart, dateStop);

        if (!campaign) {
            res.status(404).json({ message: `Campaign with ID ${campaignId} not found.` });
            return;
        }

        res.json(campaign);

    } catch (error) {
        logger.error(`[CampaignController] Error in getCampaign (ID: ${req.params.campaignId}):`, error);
        next(error);
    }
};

/**
 * Handles request to get insights for a specific campaign.
 * Makes date parameters optional with defaults.
 */
export const getCampaignInsightsHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Get both accountId and campaignId from path parameters
        const { accountId, campaignId } = req.params;

        console.log('req.params', req.params);
        console.log('req.query', req.query);
        
        // Log the raw request parameters for debugging
        logger.info(`[CampaignController] Debug - Route params:`, req.params);
        
        // Get date parameters from query or use defaults
        let { date_start: dateStart, date_end: dateStop } = req.query as { date_start?: string, date_end?: string };
        if (!dateStart || !dateStop) {
            const defaultDates = getDefaultDates();
            dateStart = dateStart || defaultDates.dateStart;
            dateStop = dateStop || defaultDates.dateStop;
        }
        
        // Optional query parameters
        const refresh = req.query.refresh === 'true';
        const breakdowns = req.query.breakdowns ? (req.query.breakdowns as string).split(',') : undefined;
        const timeIncrement = req.query.time_increment as '1' | 'monthly' | 'all_days' | undefined;
        
        // Validation
        if (!campaignId) {
            res.status(400).json({ message: "Campaign ID parameter is required." });
            return;
        }
        
        if (!accountId) {
            res.status(400).json({ message: "Account ID parameter is required." });
            return;
        }
        
        // Validate date format if provided (YYYY-MM-DD)
        if (dateStart && dateStop) {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(dateStart) || !dateRegex.test(dateStop)) {
                res.status(400).json({ message: "date_start and date_end must be in YYYY-MM-DD format." });
                return;
            }
        }
        
        // Get user and org IDs
        const ids = getUserAndOrgIds(req as AuthenticatedRequest, res);
        if (!ids) return; // Error response already sent
        const { userId, organisationId } = ids;
        
        logger.info(`[CampaignController] User ${userId} (Org: ${organisationId}) requested insights for campaign ${campaignId} in account ${accountId}. Date range: ${dateStart} to ${dateStop}, Refresh: ${refresh}`);
        
        const incrementValue = timeIncrement === '1' ? 1 : timeIncrement;
        
        const insights = await getCampaignInsights(
            campaignId, // Make sure this is the actual campaign ID, not "insights" 
            accountId,
            userId,
            organisationId,
            refresh,
            dateStart,
            dateStop,
            breakdowns,
            incrementValue as 1 | 'monthly' | 'all_days' | undefined
        );
        
        res.json({ 
            items: insights,
            meta: {
                campaign_id: campaignId,
                account_id: accountId,
                date_start: dateStart,
                date_end: dateStop,
                count: insights.length,
                breakdowns: breakdowns,
                time_increment: timeIncrement
            }
        });
        
    } catch (error) {
        logger.error(`[CampaignController] Error in getCampaignInsights (Campaign ID: ${req.params.campaignId}, Account ID: ${req.params.accountId}):`, error);
        next(error); // Pass to global error handler
    }
}; 