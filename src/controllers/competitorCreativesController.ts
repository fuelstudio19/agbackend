import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { logger } from '../utils/logger';
import { getUserAndOrgIds, getOrgId } from '../utils/general';
import * as competitorCreativesRepository from '../repositories/adCompetitorCreativesRepository';
import { z } from 'zod';
import * as adScrapperService from '../services/adScrapServices';

const getAdsByOrganisationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  organisation_id: z.string().optional()
});

const getAdsByPageSchema = z.object({
  page_id: z.string().min(1, 'Page ID is required'),
  organisation_id: z.string().optional()
});

const getAdByIdSchema = z.object({
  ad_archive_id: z.string().min(1, 'Ad archive ID is required'),
  organisation_id: z.string().optional()
});

// Helper function to get organisation ID from query params or auth
const getOrganisationId = (req: Request | AuthenticatedRequest, res: Response, queryOrganisationId?: string): string | null => {
  // If organisation_id is provided in query params, use it
  if (queryOrganisationId) {
    return queryOrganisationId;
  }
  
  // Otherwise, try to get from authenticated request
  const authReq = req as AuthenticatedRequest;
  if (authReq.organisationId) {
    return authReq.organisationId;
  }
  
  return null;
};

export const getCompetitorAdsByOrganisation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { organisation_id } = getAdsByOrganisationSchema.parse(req.query);

    let limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    let offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    const organisationId = getOrganisationId(req, res, organisation_id);
    if (!organisationId) {
      res.status(400).json({ 
        error: true,
        success: false, 
        message: 'Organisation ID is required. Please provide organisation_id in query params or authenticate with a valid token.',
        data: null,
        isScraping: false
      });
      return;
    }

    // Use the unified function to get competitor ads with scraping status
    const response = await adScrapperService.getAdResultsByOrganizationId(
      organisationId, 
      limit, 
      offset,
      'competitor'
    );

    if (response.error) {
      logger.error(`[competitorCreativesController] Error fetching ads for organisation ${organisationId}:`, response.error);
      res.status(500).json({ 
        error: true,
        success: false, 
        message: 'Failed to fetch competitor ads',
        data: null,
        isScraping: response.isScraping || false
      });
      return;
    }

    res.status(200).json({
      error: false,
      success: true,
      message: 'Competitor ads retrieved successfully',
      data: response.result || [],
      isScraping: response.isScraping || false,
      pagination: {
        limit,
        offset,
        total: response.count || 0
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ 
        error: true,
        success: false, 
        message: 'Invalid query parameters',
        data: null,
        isScraping: false
      });
      return;
    }

    logger.error('[competitorCreativesController] Unexpected error in getCompetitorAdsByOrganisation:', err);
    res.status(500).json({ 
      error: true,
      success: false, 
      message: 'Internal server error',
      data: null,
      isScraping: false
    });
  }
};

export const getCompetitorAdsByPage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page_id } = getAdsByPageSchema.parse(req.params);
    const { organisation_id } = getAdsByPageSchema.parse(req.query);

    const organisationId = getOrganisationId(req, res, organisation_id);
    if (!organisationId) {
      res.status(400).json({ 
        success: false, 
        message: 'Organisation ID is required. Please provide organisation_id in query params or authenticate with a valid token.' 
      });
      return;
    }

    const { data, error } = await competitorCreativesRepository.getScrapedAdsByPageId(
      page_id, 
      organisationId
    );

    if (error) {
      logger.error(`[competitorCreativesController] Error fetching ads for page ${page_id}:`, error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch competitor ads for page', 
        error: error.message 
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Competitor ads for page retrieved successfully',
      data: data || []
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ 
        success: false, 
        message: 'Invalid parameters', 
        errors: err.errors 
      });
      return;
    }

    logger.error('[competitorCreativesController] Unexpected error in getCompetitorAdsByPage:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};

export const getCompetitorAdById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ad_archive_id } = getAdByIdSchema.parse(req.params);
    const { organisation_id } = getAdByIdSchema.parse(req.query);

    const organisationId = getOrganisationId(req, res, organisation_id);
    if (!organisationId) {
      res.status(400).json({ 
        success: false, 
        message: 'Organisation ID is required. Please provide organisation_id in query params or authenticate with a valid token.' 
      });
      return;
    }

    const { data, error } = await competitorCreativesRepository.getAdCreativeById(
      ad_archive_id, 
      organisationId
    );

    if (error) {
      logger.error(`[competitorCreativesController] Error fetching ad ${ad_archive_id}:`, error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch competitor ad', 
        error: error.message 
      });
      return;
    }

    if (!data) {
      res.status(404).json({
        success: false,
        message: 'Competitor ad not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Competitor ad retrieved successfully',
      data: data
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ 
        success: false, 
        message: 'Invalid parameters', 
        errors: err.errors 
      });
      return;
    }

    logger.error('[competitorCreativesController] Unexpected error in getCompetitorAdById:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};

export const deleteCompetitorAd = async (req: Request, res: Response): Promise<void> => {
  try {
    const ids = getUserAndOrgIds(req as AuthenticatedRequest, res);
    if (!ids) return;
    const { organisationId } = ids;

    const { ad_archive_id } = getAdByIdSchema.parse(req.params);

    const { success, error } = await competitorCreativesRepository.deleteAdCreative(
      ad_archive_id, 
      organisationId
    );

    if (error) {
      logger.error(`[competitorCreativesController] Error deleting ad ${ad_archive_id}:`, error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to delete competitor ad', 
        error: error.message 
      });
      return;
    }

    if (!success) {
      res.status(404).json({
        success: false,
        message: 'Competitor ad not found or could not be deleted'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Competitor ad deleted successfully'
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ 
        success: false, 
        message: 'Invalid ad archive ID', 
        errors: err.errors 
      });
      return;
    }

    logger.error('[competitorCreativesController] Unexpected error in deleteCompetitorAd:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
}; 