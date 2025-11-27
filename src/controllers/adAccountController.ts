import { Request, Response, NextFunction } from 'express';
import { getAllAdAccounts, getAdAccountById } from '../services/adAccountService';
import { getAdAccountInsights } from '../services/insightsService';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { getDefaultDates, getUserAndOrgIds } from '../utils/general';
import { logger } from '../utils/logger';

/**
 * Handles request to list ad accounts.
 */
export const listAdAccountsHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Handle refresh parameter (optional, defaults to false)
        const refresh = req.query.refresh === 'true';
        
        // Get user and org IDs
        const ids = getUserAndOrgIds(req as AuthenticatedRequest, res);
        if (!ids) return; // Error response already sent
        const { userId, organisationId } = ids;
        
        logger.info(`[AdAccountController] User ${userId} (Org: ${organisationId}) requested listAdAccounts. Refresh: ${refresh}`);

        const accounts = await getAllAdAccounts(userId, organisationId, refresh);
        res.json({ items: accounts });

    } catch (error) {
        logger.error("[AdAccountController] Error in listAdAccounts:", error);
        next(error); // Pass to global error handler
    }
};

/**
 * Handles request to get a specific ad account by ID.
 */
export const getAdAccountHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { accountId } = req.params;
        // Handle refresh parameter (optional, defaults to false)
        const refresh = req.query.refresh === 'true';
        
        if (!accountId) {
             res.status(400).json({ message: "Account ID parameter is required." });
             return;
        }
        
        // Get user and org IDs
        const ids = getUserAndOrgIds(req as AuthenticatedRequest, res);
        if (!ids) return; // Error response already sent
        const { userId, organisationId } = ids;

        logger.info(`[AdAccountController] User ${userId} (Org: ${organisationId}) getting ad account ${accountId}. Refresh: ${refresh}`);
        const account = await getAdAccountById(accountId, userId, organisationId, refresh);

        if (!account) {
            res.status(404).json({ message: `Ad account with ID ${accountId} not found.` });
            return;
        }

        res.json(account);

    } catch (error) {
         logger.error(`[AdAccountController] Error in getAdAccount (ID: ${req.params.accountId}):`, error);
        next(error); // Pass to global error handler
    }
};

/**
 * Handles request to get insights for an ad account.
 * Makes date parameters optional with defaults.
 */
export const getAdAccountInsightsHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { accountId } = req.params;
        
        // Get date parameters from query or use defaults
        let { date_start: dateStart, date_end: dateEnd } = req.query as { date_start?: string, date_end?: string };
        if (!dateStart || !dateEnd) {
            const defaultDates = getDefaultDates();
            dateStart = dateStart || defaultDates.dateStart;
            dateEnd = dateEnd || defaultDates.dateStop;
        }
        
        // Optional query parameters
        const refresh = req.query.refresh === 'true';
        const breakdowns = req.query.breakdowns ? (req.query.breakdowns as string).split(',') : undefined;
        const timeIncrement = req.query.time_increment as '1' | 'monthly' | 'all_days' | undefined;
        
        // Validation
        if (!accountId) {
            res.status(400).json({ message: "Account ID parameter is required." });
            return;
        }
        
        // Validate date format if provided (YYYY-MM-DD)
        if (dateStart && dateEnd) {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(dateStart) || !dateRegex.test(dateEnd)) {
                res.status(400).json({ message: "date_start and date_end must be in YYYY-MM-DD format." });
                return;
            }
        }
        
        // Get user and org IDs
        const ids = getUserAndOrgIds(req as AuthenticatedRequest, res);
        if (!ids) return; // Error response already sent
        const { userId, organisationId } = ids;
        
        logger.info(`[AdAccountController] User ${userId} (Org: ${organisationId}) requested insights for account ${accountId}. Date range: ${dateStart} to ${dateEnd}, Refresh: ${refresh}`);
        
        const incrementValue = timeIncrement === '1' ? 1 : timeIncrement;
        
        const insights = await getAdAccountInsights(
            accountId,
            userId,
            organisationId,
            refresh,
            dateStart,
            dateEnd,
            breakdowns,
            incrementValue as 1 | 'monthly' | 'all_days' | undefined
        );
        
        res.json({ 
            items: insights,
            meta: {
                account_id: accountId,
                date_start: dateStart,
                date_end: dateEnd,
                count: insights.length,
                breakdowns: breakdowns,
                time_increment: timeIncrement
            }
        });
        
    } catch (error) {
        logger.error(`[AdAccountController] Error in getAdAccountInsights (ID: ${req.params.accountId}):`, error);
        next(error); // Pass to global error handler
    }
}; 