import { Request, Response, NextFunction } from 'express';
import * as adSetService from '../services/adSetService'; // Import service functions
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { getUserAndOrgIds } from '../utils/general';
import { logger } from '../utils/logger';

/**
 * Handles request to list ad sets for a given account.
 */
export const listAdSetsByAccountHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { accountId } = req.params;
        // Handle refresh parameter (optional, defaults to false)
        const refresh = req.query.refresh === 'true';

        // Get user and org IDs
        const ids = getUserAndOrgIds(req as AuthenticatedRequest, res);
        if (!ids) return; // Error response already sent
        const { userId, organisationId } = ids;

        if (!accountId) {
            res.status(400).json({ message: "Account ID parameter is required." });
            return;
        }

        logger.info(`[AdSetController] User ${userId} (Org: ${organisationId}) listing ad sets for account ${accountId}. Refresh: ${refresh}`);
        const adSets = await adSetService.getAdSetsByAccount(accountId, userId, organisationId, refresh);
        res.json({ items: adSets });

    } catch (error) {
        logger.error(`[AdSetController] Error listing ad sets for account ${req.params.accountId}:`, error);
        next(error); // Pass to global error handler
    }
};

/**
 * Handles request to get a specific ad set by its ID.
 */
export const getAdSetHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { adSetId } = req.params;
        // Handle refresh parameter (optional, defaults to false)
        const refresh = req.query.refresh === 'true';
        
        // Get user and org IDs
        const ids = getUserAndOrgIds(req as AuthenticatedRequest, res);
        if (!ids) return; // Error response already sent
        const { userId, organisationId } = ids;

        if (!adSetId) {
            res.status(400).json({ message: "Ad Set ID parameter is required." });
            return;
        }
        
        logger.info(`[AdSetController] User ${userId} (Org: ${organisationId}) getting ad set ${adSetId}. Refresh: ${refresh}`);
        const adSet = await adSetService.getAdSetById(adSetId, userId, organisationId, refresh);

        if (!adSet) {
            res.status(404).json({ message: `Ad Set with ID ${adSetId} not found.` });
            return;
        }

        res.json(adSet);

    } catch (error) {
        logger.error(`[AdSetController] Error getting ad set ${req.params.adSetId}:`, error);
        next(error); // Pass to global error handler
    }
}; 