import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { getInspirationsWithPagination, InspirationFilters } from '../services/inspirationService';

/**
 * Get paginated inspirations with optional filters and sorting
 */
export const getInspirations = async (req: Request, res: Response): Promise<void> => {
  try {
    // Extract query parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Max 100 items per page
    const sortBy = req.query.sort_by as string;
    const sortOrder = (req.query.sort_order as 'asc' | 'desc') || 'desc';

    // Extract filter parameters
    const filters: InspirationFilters = {};
    
    if (req.query.brand_name) {
      filters.brand_name = req.query.brand_name as string;
    }
    
    if (req.query.ad_performance) {
      filters.ad_performance = req.query.ad_performance as string;
    }
    
    if (req.query.brand_industry) {
      filters.brand_industry = req.query.brand_industry as string;
    }
    
    if (req.query.ad_platforms) {
      const platforms = req.query.ad_platforms as string;
      filters.ad_platforms = platforms.split(',').map(p => p.trim());
    }

    // Validate page and limit
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

    // Validate sort order
    if (sortOrder && !['asc', 'desc'].includes(sortOrder)) {
      res.status(400).json({
        success: false,
        message: 'Sort order must be "asc" or "desc"'
      });
      return;
    }

    logger.info(`[inspirationsController] Fetching inspirations - Page: ${page}, Limit: ${limit}, SortBy: ${sortBy || 'scraped_at'}, SortOrder: ${sortOrder}`);

    // Get inspirations from service
    const { data, error } = await getInspirationsWithPagination(
      page,
      limit,
      Object.keys(filters).length > 0 ? filters : undefined,
      sortBy,
      sortOrder
    );

    if (error) {
      logger.error(`[inspirationsController] Error fetching inspirations:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch inspirations',
        error: error
      });
      return;
    }

    if (!data) {
      res.status(500).json({
        success: false,
        message: 'No data returned from service'
      });
      return;
    }

    logger.info(`[inspirationsController] Successfully fetched ${data.data.length} inspirations (${data.pagination.total} total)`);

    res.status(200).json({
      success: true,
      message: 'Inspirations retrieved successfully',
      data: data.data,
      pagination: {
        page: data.pagination.page,
        limit: data.pagination.pageSize,
        total: data.pagination.total,
        totalPages: data.pagination.totalPages,
        hasNext: data.pagination.hasNext,
        hasPrev: data.pagination.hasPrev
      },
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      sorting: {
        sortBy: sortBy || 'scraped_at',
        sortOrder
      }
    });

  } catch (error) {
    logger.error(`[inspirationsController] Exception in getInspirations:`, error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}; 