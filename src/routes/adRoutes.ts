import { Router } from 'express';
import {
    listAdsByAccountHandler,
    listAdsByAdSetHandler,
    listAdsByCampaignHandler,
    getAdHandler,
    getAdInsightsHandler,
    getAdCreativeHandler,
    getDetailedAdInsightsHandler
} from '../controllers/adController';
// Import authentication middleware
import { authenticateToken } from '../middlewares/authMiddleware';
// import { requireAuth } from '../middlewares/requireAuth'; // Example middleware

const router = Router({ mergeParams: true }); // Merge params if nested

// --- Middleware ---
// Apply auth middleware to all Ad routes if needed
// router.use(requireAuth);

// Apply auth middleware to all Ad routes
router.use(authenticateToken);

// --- Define Ad Routes ---

// Note on Routing Strategy:
// You have several options for organizing these routes:
// 1. Mount this router at /api/v1/ads and include full paths like /account/:accountId
// 2. Mount different parts under respective parent entities (e.g., mount list by account under account router)
// The current setup assumes this router might be mounted at /api/v1/ads, requiring full paths in handlers.

// List Ads by different contexts
/**
 * @openapi
 * /api/v1/ads/account/{accountId}:
 *   get:
 *     tags: [Ads]
 *     summary: List ads for an account
 *     description: Fetches ads belonging to a specific ad account with optional insights for a date range.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: accountId, in: path, required: true, schema: { type: string }, description: "Ad Account ID (act_... or numeric)" }
 *       - { name: refresh, in: query, required: false, schema: { type: boolean }, description: "Whether to force refresh from API instead of using cached data" }
 *       - { name: dateStart, in: query, required: false, schema: { type: string, format: date }, description: "Start date for insights data in YYYY-MM-DD format. Defaults to one week ago." }
 *       - { name: dateStop, in: query, required: false, schema: { type: string, format: date }, description: "End date for insights data in YYYY-MM-DD format. Defaults to today." }
 *     responses:
 *       200: { $ref: '#/components/responses/AdListResponse' } # Define reusable response
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       500: { $ref: '#/components/responses/InternalServerError' }
 */
router.get('/account/:accountId', listAdsByAccountHandler);

/**
 * @openapi
 * /api/v1/ads/account/{accountId}/ad-set/{adSetId}:
 *   get:
 *     tags: [Ads]
 *     summary: List ads for an ad set
 *     description: Fetches ads belonging to a specific ad set within an account with optional insights for a date range.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: accountId, in: path, required: true, schema: { type: string }, description: "Ad Account ID (act_... or numeric)" }
 *       - { name: adSetId, in: path, required: true, schema: { type: string }, description: "Ad Set ID" }
 *       - { name: refresh, in: query, required: false, schema: { type: boolean }, description: "Whether to force refresh from API instead of using cached data" }
 *       - { name: dateStart, in: query, required: false, schema: { type: string, format: date }, description: "Start date for insights data in YYYY-MM-DD format. Defaults to one week ago." }
 *       - { name: dateStop, in: query, required: false, schema: { type: string, format: date }, description: "End date for insights data in YYYY-MM-DD format. Defaults to today." }
 *     responses:
 *       200: { $ref: '#/components/responses/AdListResponse' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       500: { $ref: '#/components/responses/InternalServerError' }
 */
router.get('/account/:accountId/ad-set/:adSetId', listAdsByAdSetHandler);

/**
 * @openapi
 * /api/v1/ads/account/{accountId}/campaign/{campaignId}:
 *   get:
 *     tags: [Ads]
 *     summary: List ads for a campaign
 *     description: Fetches ads belonging to a specific campaign within an account with optional insights for a date range.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: accountId, in: path, required: true, schema: { type: string }, description: "Ad Account ID (act_... or numeric)" }
 *       - { name: campaignId, in: path, required: true, schema: { type: string }, description: "Campaign ID" }
 *       - { name: refresh, in: query, required: false, schema: { type: boolean }, description: "Whether to force refresh from API instead of using cached data" }
 *       - { name: dateStart, in: query, required: false, schema: { type: string, format: date }, description: "Start date for insights data in YYYY-MM-DD format. Defaults to one week ago." }
 *       - { name: dateStop, in: query, required: false, schema: { type: string, format: date }, description: "End date for insights data in YYYY-MM-DD format. Defaults to today." }
 *     responses:
 *       200: { $ref: '#/components/responses/AdListResponse' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       500: { $ref: '#/components/responses/InternalServerError' }
 */
router.get('/account/:accountId/campaign/:campaignId', listAdsByCampaignHandler);

// Routes for a specific Ad ID
/**
 * @openapi
 * /api/v1/ads/account/{accountId}/{adId}:
 *   get:
 *     tags: [Ads]
 *     summary: Get a specific ad by ID
 *     description: Fetches details for a specific ad within an account, with optional insights for a date range.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: accountId, in: path, required: true, schema: { type: string }, description: "Ad Account ID (act_... or numeric)" }
 *       - { name: adId, in: path, required: true, schema: { type: string }, description: "Ad ID" }
 *       - { name: refresh, in: query, required: false, schema: { type: boolean }, description: "Whether to force refresh from API instead of using cached data" }
 *       - { name: dateStart, in: query, required: false, schema: { type: string, format: date }, description: "Start date for insights data in YYYY-MM-DD format. Defaults to one week ago." }
 *       - { name: dateStop, in: query, required: false, schema: { type: string, format: date }, description: "End date for insights data in YYYY-MM-DD format. Defaults to today." }
 *     responses:
 *       200: { description: "Ad details", content: { application/json: { schema: { $ref: '#/components/schemas/Ad' }}}} # Single Ad response
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/InternalServerError' }
 */
router.get('/account/:accountId/:adId', getAdHandler);

/**
 * @openapi
 * /api/v1/ads/account/{accountId}/{adId}/creative:
 *   get:
 *     tags: [Ads, Creatives]
 *     summary: Get creative details for an ad
 *     description: Fetches the detailed creative information associated with a specific ad within an account.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: accountId, in: path, required: true, schema: { type: string }, description: "Ad Account ID (act_... or numeric)" }
 *       - { name: adId, in: path, required: true, schema: { type: string }, description: "Ad ID" }
 *     responses:
 *       200: { description: "Ad creative details", content: { application/json: { schema: { $ref: '#/components/schemas/AdCreative' }}}} # Single Creative response
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' } # For creative not found
 *       500: { $ref: '#/components/responses/InternalServerError' }
 */
router.get('/account/:accountId/:adId/creative', getAdCreativeHandler);

/**
 * @openapi
 * /api/v1/ads/account/{accountId}/{adId}/insights/detailed:
 *   post:
 *     tags: [Ads, Insights]
 *     summary: Get detailed insights for an ad
 *     description: >
 *       Fetches comprehensive performance insights for a specific ad with various breakdown options.
 *       Supports audience, placement, geographic, action, device and hourly breakdowns.
 *       Insights fields are predefined by the API and include all standard metrics.
 *       If refresh=false (default), data will be retrieved from the database if available.
 *       If refresh=true, data will be fetched from the Facebook API and stored in the database.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: accountId, in: path, required: true, schema: { type: string }, description: "Ad Account ID (act_... or numeric)" }
 *       - { name: adId, in: path, required: true, schema: { type: string }, description: "Ad ID" }
 *       - { name: refresh, in: query, required: false, schema: { type: boolean }, description: "Whether to force refresh from API instead of using stored data. Defaults to false." }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GetDetailedAdInsightsRequest'
 *           example:
 *             time_range: { since: "2024-01-01", until: "2024-01-31" }
 *             include_placement_breakdown: true
 *             include_audience_breakdown: true
 *     responses:
 *       200:
 *         description: Detailed ad insights including requested breakdowns.
 *         content:
 *           application/json:
 *             schema: 
 *               $ref: '#/components/schemas/DetailedAdInsightResponse'
 *       400:
 *         description: Bad request (e.g., missing time_range or invalid format).
 *         $ref: '#/components/responses/BadRequest' # Use standard ref
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Ad not found.
 *         $ref: '#/components/responses/NotFound' # Add NotFound possibility
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/account/:accountId/:adId/insights/detailed', getDetailedAdInsightsHandler);

// Export the router
export { router as adRouter };