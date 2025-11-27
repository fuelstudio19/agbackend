import { Request, Response } from 'express';
import * as adScrapperService from '../services/adScrapServices';
import { urlSchema, startScrapingSchema, getResultSchema } from '../types/scrapperTypes';
import { ZodError, z } from 'zod';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { logger } from '../utils/logger';
import { getUserAndOrgIds } from '../utils/general';

// Schema for starting self ad scraping
const startSelfAdScrapingSchema = z.object({
  meta_ad_dashboard_url: z.string().url('Invalid Meta Ad Dashboard URL'),
  company_url: z.string().url('Invalid company URL'),
});

export const startMetaAdScraping = async (req: Request, res: Response): Promise<void> => {
  const { competitor_url, meta_ad_library_url } = startScrapingSchema.parse(req.body);
  const ids = getUserAndOrgIds(req as AuthenticatedRequest, res);
  if (!ids) return;
  const { organisationId } = ids;

  try {
    // Start scraping directly - always overwrite existing results
    const { run_id, polling_status } = await adScrapperService.startCompetitorScrapperService(
      meta_ad_library_url, 
      competitor_url, 
      organisationId
    );
    res.status(202).json({ 
      message: 'Scraping initiated successfully with background polling started', 
      data: { run_id, polling_status }, 
      success: true 
    });
    return

  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: 'Invalid input', data: null });
      return
    }
    console.log(error)
    res.status(500).json({ message: error, data: null })
    return

  }
}

export const startSelfAdScraping = async (req: Request, res: Response): Promise<void> => {
  try {
    const { meta_ad_dashboard_url, company_url } = startSelfAdScrapingSchema.parse(req.body);
    const ids = getUserAndOrgIds(req as AuthenticatedRequest, res);
    if (!ids) return;
    const { organisationId } = ids;

    logger.info(`[AdController] Starting self ad scraping for company: ${company_url}, org: ${organisationId}`);

    const { run_id, polling_status } = await adScrapperService.startSelfAdScrapperService(
      meta_ad_dashboard_url,
      company_url,
      organisationId
    );

    res.status(202).json({
      success: true,
      message: 'Self ad scraping initiated successfully with background polling started',
      data: {
        run_id,
        polling_status
      }
    });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ 
        success: false, 
        message: 'Invalid input format', 
        errors: err.errors 
      });
      return;
    }

    logger.error('[AdController] Unexpected error in startSelfAdScraping:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: err instanceof Error ? err.message : 'Unknown error'
    });
  }
};

export const getAdScrapingResult = async (req: Request, res: Response): Promise<void> => {
  try {
    const { url } = req.body;

    // Validate required parameters
    if (!url) {
      res.status(400).json({ 
        error: true,
        success: false,
        message: 'Invalid input format - url is required.',
        data: null,
        isScraping: false
      });
      return;
    }

    // Use the unified function to get results from both competitor and self ads tables
    const response = await adScrapperService.getAdResultsByUrl(url, 50, 0);
    
    if (response.error) {
      res.status(500).json({ 
        error: true,
        success: false,
        message: 'Error fetching ad scraping results',
        data: null,
        isScraping: response.isScraping || false
      });
      return;
    }

    // If scraping is in progress
    if (response.isScraping) {
      res.status(202).json({ 
        error: false,
        success: true,
        message: response.message || 'Ad scraper is still running. Background polling is handling the process. Try again later.',
        data: null,
        isScraping: true
      });
      return;
    }

    // If no results found but scraping is complete
    if (!response.result || response.result.length === 0) {
      res.status(200).json({ 
        error: false,
        success: true,
        message: response.message || 'No ad results found for this URL.',
        data: null,
        isScraping: false
      });
      return;
    }

    // Success with results
    res.status(200).json({ 
      error: false,
      success: true,
      message: 'Ad scraping results retrieved successfully.',
      data: response.result,
      isScraping: false
    });
  } catch (err) {
    logger.error('[AdController] Unexpected error in getAdScrapingResult:', err);
    res.status(500).json({ 
      error: true,
      success: false,
      message: 'Internal server error',
      data: null,
      isScraping: false
    });
  }
};

export const getQueueMonitoring = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('[AdController] Background polling monitoring endpoint accessed');
    
    const monitoringInfo = await adScrapperService.getPollingMonitoringInfo();
    
    res.status(200).json({
      success: true,
      message: 'Background polling monitoring information retrieved successfully',
      data: monitoringInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[AdController] Error in background polling monitoring endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve background polling monitoring information',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};


