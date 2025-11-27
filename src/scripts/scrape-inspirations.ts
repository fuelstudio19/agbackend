#!/usr/bin/env tsx

import axios, { AxiosResponse } from 'axios';
import { logger } from '../utils/logger';
import { ExternalInspirationResponse, ExternalInspirationItem, DbInspiration } from '../types/dbSchemaTypes';
import { bulkUpsertInspirations, getInspirationsCount } from '../repositories/inspirationsRepository';

// Configuration constants
const API_BASE_URL = 'https://xgyj-ksqq-swgu.n7d.xano.io/api:FhhhhGhg/ad';
const BEARER_TOKEN = 'eyJhbGciOiJBMjU2S1ciLCJlbmMiOiJBMjU2Q0JDLUhTNTEyIiwiemlwIjoiREVGIn0.wMtojwRK1CVg6QvFg37jsuacW9S69eYfUyyrVpItTV1GD11eZRAfVdLISwPV3qF3tWB8MvqPFf9QqjBoXzL3RbrvXd85hiIt.3Y7xGPd1mksgCwVTduLFoA.NFENNl94jOGA2aXUC_AFtxyisLFN0uNj06L0GPZgz5gvkQnZ2iWFmFtRJM76DqMp07Gln4am-vu4sybbAF829Vt6tMcCfhZGqCdfjJqjb5qfXlCcKhw4dakiXsaxpy5vtqs5eD05sO0QgQZk3uFMPA.m-1mp3NkJVxmAb7IfwMhrccbY2DiTlBFZ9B9AwncG7M';

// Default parameters
const DEFAULT_PARAMS = {
  search: '',
  sort_by: 'new',
  dashboard_tab: 'creatives'
};

// Batch size for bulk operations
const BATCH_SIZE = 100;

// Rate limiting (requests per second)
const RATE_LIMIT = 2; // 2 requests per second to be respectful
const DELAY_MS = 1000 / RATE_LIMIT;

/**
 * Sleep for specified milliseconds
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Fetch a single page from the API
 */
const fetchPage = async (page: number): Promise<ExternalInspirationResponse | null> => {
  try {
    const url = `${API_BASE_URL}?page=${page}&search=${DEFAULT_PARAMS.search}&sort_by=${DEFAULT_PARAMS.sort_by}&dashboard_tab=${DEFAULT_PARAMS.dashboard_tab}`;
    
    logger.info(`[InspirationScraper] Fetching page ${page} from ${url}`);

    const response: AxiosResponse<ExternalInspirationResponse> = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Adgraam/1.0'
      },
      timeout: 30000 // 30 seconds timeout
    });

    if (response.status === 200) {
      logger.info(`[InspirationScraper] Successfully fetched page ${page}: ${response.data.itemsReceived} items`);
      return response.data;
    } else {
      logger.error(`[InspirationScraper] Unexpected status code ${response.status} for page ${page}`);
      return null;
    }
  } catch (error) {
    logger.error(`[InspirationScraper] Error fetching page ${page}:`, error);
    return null;
  }
};

/**
 * Transform external API item to database record
 */
const transformToDbRecord = (item: ExternalInspirationItem): Omit<DbInspiration, 'id' | 'created_at' | 'updated_at' | 'scraped_at'> => {
  // Extract ad platforms
  const ad_platforms = item.ad_platform_id.flat().map(platform => platform.name);
  
  // Extract ad topics
  const ad_topics = item.ad_topic_id.flat().map(topic => topic.name);
  
  // Extract brand industries
  const brand_industry = item._brand.brand_industry_id.flat().map(industry => industry.name);

  return {
    external_id: item.id,
    image_url: item.image.url,
    image_width: item.image.meta.width,
    image_height: item.image.meta.height,
    brand_name: item._brand.name,
    brand_id: item.brand_id,
    brand_business_model: item._brand._brand_business_model.name,
    brand_industry,
    ad_performance: item._ad_performance.name,
    ad_performance_id: item.ad_performance_id,
    ad_platforms,
    ad_topics,
    ad_aspect_ratio: item._ad_aspect_ratio.name,
    ad_aspect_ratio_id: item.ad_aspect_ratio_id,
    template_url: item.template_url,
    prompt_ready: item.prompt_ready,
    saved: item.saved,
    raw_data: item // Store the complete API response
  };
};

/**
 * Process and store a batch of items
 */
const processBatch = async (items: ExternalInspirationItem[]): Promise<boolean> => {
  try {
    const dbRecords = items.map(transformToDbRecord);
    
    const { data, error } = await bulkUpsertInspirations(dbRecords);
    
    if (error) {
      logger.error(`[InspirationScraper] Error storing batch:`, error);
      return false;
    }
    
    logger.info(`[InspirationScraper] Successfully stored ${data?.length || 0} records`);
    return true;
  } catch (error) {
    logger.error(`[InspirationScraper] Exception processing batch:`, error);
    return false;
  }
};

/**
 * Main scraping function
 */
const scrapeAllInspirations = async (): Promise<void> => {
  logger.info(`[InspirationScraper] Starting inspiration scraping process`);
  
  try {
    // Get initial count for tracking progress
    const { count: initialCount } = await getInspirationsCount();
    logger.info(`[InspirationScraper] Current records in database: ${initialCount || 0}`);

    // Fetch first page to get total page count
    const firstPage = await fetchPage(1);
    if (!firstPage) {
      logger.error(`[InspirationScraper] Failed to fetch first page, aborting`);
      return;
    }

    const totalPages = firstPage.pageTotal;
    const totalItems = firstPage.itemsTotal;
    
    logger.info(`[InspirationScraper] Total pages to scrape: ${totalPages}`);
    logger.info(`[InspirationScraper] Total items available: ${totalItems}`);

    let processedItems = 0;
    let errorCount = 0;
    let batch: ExternalInspirationItem[] = [];

    // Process first page
    batch.push(...firstPage.items);
    processedItems += firstPage.items.length;

    // Process remaining pages
    for (let page = 2; page <= totalPages; page++) {
      // Rate limiting
      await sleep(DELAY_MS);

      const pageData = await fetchPage(page);
      
      if (!pageData) {
        errorCount++;
        logger.warn(`[InspirationScraper] Failed to fetch page ${page}, continuing with next page`);
        
        // If too many errors, stop
        if (errorCount > 10) {
          logger.error(`[InspirationScraper] Too many errors (${errorCount}), stopping scrape`);
          break;
        }
        continue;
      }

      batch.push(...pageData.items);
      processedItems += pageData.items.length;

      // Process batch when it reaches the batch size
      if (batch.length >= BATCH_SIZE) {
        const success = await processBatch(batch);
        if (!success) {
          errorCount++;
        }
        batch = []; // Clear the batch
      }

      // Log progress
      const progress = (page / totalPages * 100).toFixed(1);
      logger.info(`[InspirationScraper] Progress: ${progress}% (${page}/${totalPages} pages, ${processedItems} items)`);
    }

    // Process remaining items in the last batch
    if (batch.length > 0) {
      await processBatch(batch);
    }

    // Get final count
    const { count: finalCount } = await getInspirationsCount();
    const newRecords = (finalCount || 0) - (initialCount || 0);

    logger.info(`[InspirationScraper] Scraping completed!`);
    logger.info(`[InspirationScraper] Total items processed: ${processedItems}`);
    logger.info(`[InspirationScraper] New records added: ${newRecords}`);
    logger.info(`[InspirationScraper] Total records in database: ${finalCount || 0}`);
    logger.info(`[InspirationScraper] Errors encountered: ${errorCount}`);

  } catch (error) {
    logger.error(`[InspirationScraper] Fatal error during scraping:`, error);
    throw error;
  }
};

/**
 * Test function to scrape just a few pages for testing
 */
const testScrape = async (pages: number = 3): Promise<void> => {
  logger.info(`[InspirationScraper] Starting test scrape of ${pages} pages`);

  let batch: ExternalInspirationItem[] = [];

  for (let page = 1; page <= pages; page++) {
    await sleep(DELAY_MS);

    const pageData = await fetchPage(page);
    if (!pageData) {
      logger.warn(`[InspirationScraper] Failed to fetch test page ${page}`);
      continue;
    }

    batch.push(...pageData.items);
    logger.info(`[InspirationScraper] Test page ${page}: ${pageData.items.length} items`);
  }

  if (batch.length > 0) {
    const success = await processBatch(batch);
    logger.info(`[InspirationScraper] Test batch processing ${success ? 'succeeded' : 'failed'}`);
  }

  const { count } = await getInspirationsCount();
  logger.info(`[InspirationScraper] Test completed. Total records: ${count || 0}`);
};

// CLI handling - Simple approach that works when script is executed
const args = process.argv.slice(2);

if (args.includes('--test')) {
  const pages = parseInt(args[args.indexOf('--test') + 1]) || 3;
  testScrape(pages).catch(error => {
    logger.error(`[InspirationScraper] Test failed:`, error);
    process.exit(1);
  });
} else if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: tsx src/scripts/scrape-inspirations.ts [options]

Options:
  --test [pages]    Run a test scrape of specified pages (default: 3)
  --help, -h        Show this help message

Examples:
  tsx src/scripts/scrape-inspirations.ts              # Scrape all pages
  tsx src/scripts/scrape-inspirations.ts --test       # Test with 3 pages
  tsx src/scripts/scrape-inspirations.ts --test 5     # Test with 5 pages
    `);
} else {
  scrapeAllInspirations().catch(error => {
    logger.error(`[InspirationScraper] Scraping failed:`, error);
    process.exit(1);
  });
}

// Export functions for use in other modules
export {
  scrapeAllInspirations,
  testScrape,
  fetchPage,
  transformToDbRecord,
  processBatch
}; 