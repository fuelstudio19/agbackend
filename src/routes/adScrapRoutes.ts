import { Router } from "express";
import { authenticateToken } from "../middlewares/authMiddleware";
import { 
  startMetaAdScraping, 
  getQueueMonitoring,
  startSelfAdScraping,
  getAdScrapingResult
} from "../controllers/adScrapController";

const router = Router()

// Apply Authentication Middleware
router.use(authenticateToken)

/**
 * @openapi
 * /api/scrap/meta-ads/start:
 *   post:
 *     tags:
 *       - Meta Ad Scraping
 *     summary: Start scraping Meta ads for a competitor
 *     description: Initiates the scraping process for Meta ads library using competitor URL and Meta Ad Library URL. Always starts new scraping (overwrites existing results). Returns immediately with a run_id for tracking.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - competitor_url
 *               - meta_ad_library_url
 *             properties:
 *               competitor_url:
 *                 type: string
 *                 format: url
 *                 description: The competitor's website URL for identification
 *                 example: 'https://example-competitor.com'
 *               meta_ad_library_url:
 *                 type: string
 *                 format: url
 *                 description: Meta Ads Library URL to scrape
 *                 example: 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=Nike'
 *     responses:
 *       202:
 *         description: Scraping started successfully - use run_id to check progress
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Scraping initiated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     run_id:
 *                       type: string
 *                       example: "abc123-def456"
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized - missing or invalid authentication
 *       403:
 *         description: Forbidden - user not associated with an organization
 *       500:
 *         description: Internal server error
 */
router.post('/meta-ads/start', startMetaAdScraping)

/**
 * @openapi
 * /api/scrap/self-ads/start:
 *   post:
 *     tags:
 *       - Self Ad Scraping
 *     summary: Start scraping self ads from Meta Ad Dashboard
 *     description: Initiates the scraping process for organization's own ads from Meta Ad Dashboard URL. Always starts new scraping (overwrites existing results). Returns immediately with a run_id for tracking.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - meta_ad_dashboard_url
 *               - company_url
 *             properties:
 *               meta_ad_dashboard_url:
 *                 type: string
 *                 format: url
 *                 description: Meta Ad Dashboard URL to scrape organization's own ads
 *                 example: 'https://www.facebook.com/ads/manager/ads/?act=1234567890'
 *               company_url:
 *                 type: string
 *                 format: url
 *                 description: The organization's website URL for identification
 *                 example: 'https://example-company.com'
 *     responses:
 *       202:
 *         description: Self ad scraping started successfully - use run_id to check progress
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Self ad scraping initiated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     run_id:
 *                       type: string
 *                       example: "abc123-def456"
 *                     polling_status:
 *                       type: object
 *                       description: Background polling status information
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized - missing or invalid authentication
 *       403:
 *         description: Forbidden - user not associated with an organization
 *       500:
 *         description: Internal server error
 */
router.post('/self-ads/start', startSelfAdScraping)

/**
 * @openapi
 * /api/scrap/ads/result:
 *   post:
 *     tags:
 *       - Ad Scraping
 *     summary: Get scraping results by URL
 *     description: Retrieve the results of ad scraping operations for any URL. This endpoint automatically searches both competitor and self ad results and returns all matches.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 format: url
 *                 description: The website URL to retrieve ad scraping results for
 *                 example: 'https://example.com'
 *     responses:
 *       200:
 *         description: Scraping completed - results available or no results found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: false
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Ad scraping results retrieved successfully"
 *                 data:
 *                   type: array
 *                   nullable: true
 *                   items:
 *                     type: object
 *                     description: Scraped ad creative data (both competitor and self ads)
 *                 isScraping:
 *                   type: boolean
 *                   example: false
 *                   description: Whether scraping is currently in progress for this URL
 *       202:
 *         description: Scraping still in progress
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: false
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Ad scraper is still running. Background polling is handling the process. Try again later."
 *                 data:
 *                   type: null
 *                 isScraping:
 *                   type: boolean
 *                   example: true
 *                   description: Indicates that scraping is currently in progress
 *       400:
 *         description: Invalid input - missing url parameter
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: true
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Invalid input format - url is required."
 *                 data:
 *                   type: null
 *                 isScraping:
 *                   type: boolean
 *                   example: false
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: true
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 *                 data:
 *                   type: null
 *                 isScraping:
 *                   type: boolean
 *                   example: false
 */
router.post('/ads/result', getAdScrapingResult)

/**
 * @openapi
 * /api/scrap/queue/status:
 *   get:
 *     tags:
 *       - Meta Ad Scraping
 *     summary: Get background polling monitoring information
 *     description: Retrieve real-time information about active background polling processes for scraping jobs, including active job counts and current polling status for debugging and monitoring purposes.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Background polling monitoring information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Background polling monitoring information retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: object
 *                       properties:
 *                         activeCount:
 *                           type: number
 *                           description: Number of active background polling processes
 *                           example: 3
 *                         activeJobs:
 *                           type: array
 *                           description: Array of run_ids currently being polled
 *                           items:
 *                             type: string
 *                           example: ["abc123-def456", "xyz789-ghi012"]
 *                         timestamp:
 *                           type: string
 *                           format: date-time
 *                           example: "2024-01-15T10:30:00.000Z"
 *                     message:
 *                       type: string
 *                       example: "Currently 3 background polling processes active"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00.000Z"
 *       401:
 *         description: Unauthorized - missing or invalid authentication
 *       500:
 *         description: Internal server error
 */
router.get('/queue/status', getQueueMonitoring)

// Export the router using a specific name
export { router as metaAdScrapingRouter };