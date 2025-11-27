import { Request, Response, NextFunction } from 'express';
import { AdConceptService } from '../services/adConceptService';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { GenerateConceptsRequest, ListAdConceptsRequest } from '../types/adConceptTypes';
import { getUserAndOrgIds } from '../utils/general';
import { logger } from '../utils/logger';

const adConceptService = new AdConceptService();

/**
 * Generate ad concepts using AI multimodal analysis
 */
export const generateAdConcepts = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        logger.info(`[AdConceptController] generateAdConcepts called`);
        const { organisationId } = req.query as { organisationId: string };
        if (!organisationId) {
            res.status(400).json({
                success: false,
                message: 'Organisation ID is required'
            });
            return;
        }

        // Validate request body
        const request = req.body as GenerateConceptsRequest;
        
        if (!request.userImageUrls && !request.competitorImageUrls) {
            res.status(400).json({
                success: false,
                message: 'Request body must include userImageUrls and/or competitorImageUrls arrays'
            });
            return;
        }

        // Ensure arrays are present
        const generateRequest: GenerateConceptsRequest = {
            userImageUrls: Array.isArray(request.userImageUrls) ? request.userImageUrls : [],
            competitorImageUrls: Array.isArray(request.competitorImageUrls) ? request.competitorImageUrls : []
        };

        if (generateRequest.userImageUrls.length === 0 && generateRequest.competitorImageUrls.length === 0) {
            res.status(400).json({
                success: false,
                message: 'At least one image URL must be provided in userImageUrls or competitorImageUrls'
            });
            return;
        }

        logger.info(`[AdConceptController] Org: ${organisationId} generating concepts with ${generateRequest.userImageUrls.length} user images and ${generateRequest.competitorImageUrls.length} competitor images`);

        // Generate concepts
        const result = await adConceptService.generateAdConcepts(
            generateRequest,
            organisationId
        );

        if (!result.success) {
            res.status(400).json(result);
            return;
        }

        logger.info(`[AdConceptController] Successfully generated concepts for org: ${organisationId}`);
        res.status(200).json(result);

    } catch (error) {
        logger.error(`[AdConceptController] Error in generateAdConcepts:`, error);
        next(error);
    }
};

/**
 * Get paginated list of ad concepts
 */
export const getAdConcepts = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        logger.info(`[AdConceptController] getAdConcepts called`);

        // Get user and org IDs
        const ids = getUserAndOrgIds(req as AuthenticatedRequest, res);
        if (!ids) return; // Error response already sent
        const { userId, organisationId } = ids;

        // Parse query parameters
        const page = parseInt(req.query.page as string) || 1;
        const limit = Math.min(parseInt(req.query.limit as string) || 10, 50); // Max 50 per page
        const sortBy = (req.query.sortBy as string) || 'created_at';
        const sortOrder = (req.query.sortOrder as string) || 'desc';

        // Validate parameters
        if (page < 1) {
            res.status(400).json({
                success: false,
                message: 'Page must be greater than 0'
            });
            return;
        }

        if (limit < 1) {
            res.status(400).json({
                success: false,
                message: 'Limit must be greater than 0'
            });
            return;
        }

        if (!['created_at', 'updated_at'].includes(sortBy)) {
            res.status(400).json({
                success: false,
                message: 'sortBy must be either "created_at" or "updated_at"'
            });
            return;
        }

        if (!['asc', 'desc'].includes(sortOrder)) {
            res.status(400).json({
                success: false,
                message: 'sortOrder must be either "asc" or "desc"'
            });
            return;
        }

        const options: ListAdConceptsRequest = {
            page,
            limit,
            sortBy: sortBy as 'created_at' | 'updated_at',
            sortOrder: sortOrder as 'asc' | 'desc'
        };

        logger.info(`[AdConceptController] User ${userId} (Org: ${organisationId}) fetching concepts - page: ${page}, limit: ${limit}`);

        const result = await adConceptService.getAdConcepts(organisationId, options);

        logger.info(`[AdConceptController] Successfully fetched ${result.data.length} concepts for user ${userId}`);
        res.status(200).json(result);

    } catch (error) {
        logger.error(`[AdConceptController] Error in getAdConcepts:`, error);
        next(error);
    }
};

/**
 * Get ad concept by ID
 */
export const getAdConceptById = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { conceptId } = req.params;
        
        if (!conceptId) {
            res.status(400).json({
                success: false,
                message: 'Concept ID parameter is required'
            });
            return;
        }

        // Get user and org IDs
        const ids = getUserAndOrgIds(req as AuthenticatedRequest, res);
        if (!ids) return; // Error response already sent
        const { userId, organisationId } = ids;

        logger.info(`[AdConceptController] User ${userId} (Org: ${organisationId}) fetching concept: ${conceptId}`);

        const result = await adConceptService.getAdConceptById(conceptId, userId, organisationId);

        if (!result.success) {
            const statusCode = result.message === 'Ad concept not found' ? 404 : 400;
            res.status(statusCode).json(result);
            return;
        }

        logger.info(`[AdConceptController] Successfully fetched concept ${conceptId} for user ${userId}`);
        res.status(200).json(result);

    } catch (error) {
        logger.error(`[AdConceptController] Error in getAdConceptById:`, error);
        next(error);
    }
};

/**
 * Delete ad concept by ID
 */
export const deleteAdConcept = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { conceptId } = req.params;
        
        if (!conceptId) {
            res.status(400).json({
                success: false,
                message: 'Concept ID parameter is required'
            });
            return;
        }

        // Get user and org IDs
        const ids = getUserAndOrgIds(req as AuthenticatedRequest, res);
        if (!ids) return; // Error response already sent
        const { userId, organisationId } = ids;

        logger.info(`[AdConceptController] User ${userId} (Org: ${organisationId}) deleting concept: ${conceptId}`);

        const result = await adConceptService.deleteAdConcept(conceptId, userId, organisationId);

        if (!result.success) {
            res.status(400).json(result);
            return;
        }

        logger.info(`[AdConceptController] Successfully deleted concept ${conceptId} for user ${userId}`);
        res.status(200).json(result);

    } catch (error) {
        logger.error(`[AdConceptController] Error in deleteAdConcept:`, error);
        next(error);
    }
}; 