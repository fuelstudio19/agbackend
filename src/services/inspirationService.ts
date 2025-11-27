import { logger } from '../utils/logger';
import { DbInspiration } from '../types/dbSchemaTypes';
import { 
  getInspirations,
  upsertInspiration,
  bulkUpsertInspirations
} from '../repositories/inspirationsRepository';

export interface InspirationFilters {
  brand_name?: string;
  ad_performance?: string;
  brand_industry?: string;
  ad_platforms?: string[];
}

export interface PaginatedInspirationsResponse {
  data: DbInspiration[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Get paginated inspirations with optional filters
 */
export const getInspirationsWithPagination = async (
  page: number = 1,
  pageSize: number = 100,
  filters?: InspirationFilters,
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'desc'
): Promise<{ data: PaginatedInspirationsResponse | null; error: string | null }> => {
  try {
    const { data, error, count } = await getInspirations(page, pageSize, filters, sortBy, sortOrder);
    
    if (error) {
      logger.error(`[InspirationService] Error fetching inspirations:`, error);
      return { data: null, error: error.message };
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize);

    const response: PaginatedInspirationsResponse = {
      data: data || [],
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };

    return { data: response, error: null };
  } catch (error) {
    logger.error(`[InspirationService] Exception in getInspirationsWithPagination:`, error);
    return { data: null, error: 'Internal server error' };
  }
};

/**
 * Update or create inspiration
 */
export const saveInspiration = async (
  inspirationData: Omit<DbInspiration, 'id' | 'created_at' | 'updated_at' | 'scraped_at'>
): Promise<{ data: DbInspiration | null; error: string | null }> => {
  try {
    const { data, error } = await upsertInspiration(inspirationData);
    
    if (error) {
      logger.error(`[InspirationService] Error saving inspiration:`, error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (error) {
    logger.error(`[InspirationService] Exception in saveInspiration:`, error);
    return { data: null, error: 'Internal server error' };
  }
};

/**
 * Bulk save inspirations
 */
export const saveBulkInspirations = async (
  inspirations: Omit<DbInspiration, 'id' | 'created_at' | 'updated_at' | 'scraped_at'>[]
): Promise<{ data: DbInspiration[] | null; error: string | null }> => {
  try {
    const { data, error } = await bulkUpsertInspirations(inspirations);
    
    if (error) {
      logger.error(`[InspirationService] Error bulk saving inspirations:`, error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (error) {
    logger.error(`[InspirationService] Exception in saveBulkInspirations:`, error);
    return { data: null, error: 'Internal server error' };
  }
};