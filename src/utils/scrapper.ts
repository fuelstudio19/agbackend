import { MetaAdResponse, CompanySearchResponse } from '../types/scrapperTypes'
import dotenv from 'dotenv'
import axios from 'axios'
import { logger } from './logger'

dotenv.config()

const apifyKey=process.env.APIFY_API_TOKEN
const scrapeCreatorsApiKey = process.env.SCRAPE_CREATORS_API_KEY

export const startMetaScraper=async (url:string):Promise<string>=>{
const response = await fetch('https://api.apify.com/v2/acts/curious_coder~facebook-ads-library-scraper/runs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apifyKey}`,
      },
      body: JSON.stringify({
        "urls": [{ "url": url, "method": "GET" }],
        "count": 100,
        "scrapeAdDetails": false,
        "scrapePageAds": {
          "activeStatus": "all"
        }
      })
    })

    if (!response.ok) {
      const error = await response.json()
      logger.error('Scraper start error:', error)
      throw new Error(`Failed to start Meta Ad Library scraper: ${error.message || 'Unknown error'}`)
    }

    const result = await response.json()
    return result.data.id
}



  // Function to get dataset items
export const getDatasetItems = async (datasetId: string):Promise<MetaAdResponse[]> => {
    const response = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items`, {
      headers: {
        'Authorization': `Bearer ${apifyKey}`,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      logger.error('Dataset fetch error:', error)
      throw new Error(`Failed to fetch dataset items: ${error.message || 'Unknown error'}`)
    }

    const data:MetaAdResponse[] = await response.json()
    // console.log('Dataset items:', data)
    return data
  }

// Function to get scraper results
export const getScraperResults = async (runId: string):Promise<MetaAdResponse[]|null> => {
    // Get run details
    const runResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
      headers: {
        'Authorization': `Bearer ${apifyKey}`,
      },
    })

    if (!runResponse.ok) {
      const error = await runResponse.json()
      logger.error('Run details fetch error:', error)
      throw new Error(`Failed to fetch run details: ${error.message || 'Unknown error'}`)
    }

   const runDetails = await runResponse.json()

    // Check if run is finished by looking at finishedAt timestamp or status
    const isFinished = runDetails.data?.finishedAt || runDetails.data?.status === 'SUCCEEDED'
    if (!isFinished) {
      return null
    }

    if (!runDetails.data?.defaultDatasetId) {
      throw new Error('No dataset ID found in run details')
    }

    // Get dataset items
    const items = await getDatasetItems(runDetails.data.defaultDatasetId)
    if (!Array.isArray(items)) {
      logger.error('Unexpected dataset format:', items)
      throw new Error('Unexpected dataset format')
    }
    
    if (!items.length) {
      logger.info('No items found in dataset')
      return null
    }

    // Process all items instead of just the first one
    const processedAds: MetaAdResponse[] = items.map((item, index) => {
      if (!item.snapshot) {
        logger.warn(`No snapshot found in item ${index}:`, item)
      }

      // Enhanced mapping to extract data from the Apify response structure
      return {
        // Original Apify fields
        url: item.url,
        ad_id: item.ad_id,
        spend: item.spend,
        total: item.total,
        page_id: item.page_id,
        currency: item.currency,
        end_date: item.end_date,
        fev_info: item.fev_info,
        snapshot: item.snapshot,
        
        // Extracted/computed fields for easy access
        ad_archive_id: item.ad_id || item.ad_archive_id || undefined,
        is_active: true, // Default to true, you might need logic to determine this
        page_name: item.snapshot?.page_name || item.snapshot?.current_page_name,
        page_profile_picture_url: item.snapshot?.page_profile_picture_url,
        display_format: item.snapshot?.display_format,
        link_url: item.snapshot?.link_url,
        cta_text: item.snapshot?.cta_text,
        title: item.snapshot?.title,
        body: item.snapshot?.body?.text,
        caption: item.snapshot?.caption,
        start_date: undefined, // Not available in the provided structure
        
        // Legacy image_urls field for backward compatibility
        image_urls: item.snapshot?.cards?.length > 0 
          ? [item.snapshot.cards[0].original_image_url] 
          : undefined,
      }
    });
    
    logger.info(`Processed ${processedAds.length} ads from dataset`);
    return processedAds
}

// Function to search for companies using scrapecreators API
export const searchCompanies = async (query: string): Promise<CompanySearchResponse> => {
    if (!scrapeCreatorsApiKey) {
        throw new Error('SCRAPE_CREATORS_API_KEY is not configured')
    }

    try {
        const response = await axios.get(
            `https://api.scrapecreators.com/v1/facebook/adLibrary/search/companies?query=${encodeURIComponent(query)}`,
            {
                headers: { 
                    "x-api-key": scrapeCreatorsApiKey 
                }
            }
        );

        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            logger.error('Company search error:', error.response?.data || error.message);
            throw new Error(`Failed to search companies: ${error.response?.data?.message || error.message}`);
        }
        throw new Error('Unknown error occurred while searching companies');
    }
}
