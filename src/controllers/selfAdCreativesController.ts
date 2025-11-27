import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { logger } from '../utils/logger';
import { getUserAndOrgIds, getOrgId } from '../utils/general';
import * as selfAdCreativesRepository from '../repositories/selfAdCreativesRepository';
import * as adScrapperService from '../services/adScrapServices';
import { z } from 'zod';

const getAdsByOrganisationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
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

export const getSelfAdsByOrganisation = async (req: Request, res: Response): Promise<void> => {
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

    // Use the unified function to get self ads with scraping status
    const response = await adScrapperService.getAdResultsByOrganizationId(
      organisationId, 
      limit, 
      offset,
      'self'
    );

    if (response.error) {
      logger.error(`[selfAdCreativesController] Error fetching self ads for organisation ${organisationId}:`, response.error);
      res.status(500).json({ 
        error: true,
        success: false, 
        message: 'Failed to fetch self ads',
        data: null,
        isScraping: response.isScraping || false
      });
      return;
    }

    res.status(200).json({
      error: false,
      success: true,
      message: 'Self ads retrieved successfully',
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

    logger.error('[selfAdCreativesController] Unexpected error in getSelfAdsByOrganisation:', err);
    res.status(500).json({ 
      error: true,
      success: false, 
      message: 'Internal server error',
      data: null,
      isScraping: false
    });
  }
};

export const getSelfAdById = async (req: Request, res: Response): Promise<void> => {
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

    const { data, error } = await selfAdCreativesRepository.getAdCreativeById(
      ad_archive_id, 
      organisationId
    );

    if (error) {
      logger.error(`[selfAdCreativesController] Error fetching self ad ${ad_archive_id}:`, error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch self ad', 
        error: error.message 
      });
      return;
    }

    if (!data) {
      res.status(404).json({
        success: false,
        message: 'Self ad not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Self ad retrieved successfully',
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

    logger.error('[selfAdCreativesController] Unexpected error in getSelfAdById:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};

export const deleteSelfAd = async (req: Request, res: Response): Promise<void> => {
  try {
    const ids = getUserAndOrgIds(req as AuthenticatedRequest, res);
    if (!ids) return;
    const { organisationId } = ids;

    const { ad_archive_id } = getAdByIdSchema.parse(req.params);

    const { success, error } = await selfAdCreativesRepository.deleteAdCreative(
      ad_archive_id, 
      organisationId
    );

    if (error) {
      logger.error(`[selfAdCreativesController] Error deleting self ad ${ad_archive_id}:`, error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to delete self ad', 
        error: error.message 
      });
      return;
    }

    if (!success) {
      res.status(404).json({
        success: false,
        message: 'Self ad not found or could not be deleted'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Self ad deleted successfully'
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

    logger.error('[selfAdCreativesController] Unexpected error in deleteSelfAd:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
}; 