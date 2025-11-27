import { Router } from 'express';
// Import the functional handlers directly
import {
    listAdAccountsHandler,
    getAdAccountHandler,
    getAdAccountInsightsHandler
} from '../controllers/adAccountController';
// Import the correct authentication middleware
import { authenticateToken } from '../middlewares/authMiddleware';
import { adSetRouter } from './adSetRoutes'; // Import AdSet router
import { campaignRouter } from './campaignRoutes';

const router = Router();
// No controller instance needed anymore
// const adAccountController = new AdAccountController();

// --- Apply Authentication Middleware ---
// All routes defined after this will require authentication
router.use(authenticateToken);

// --- Define Ad Account Routes ---

/**
 * @openapi
 * /api/v1/accounts:
 *   get:
 *     tags:
 *       - Ad Accounts
 *     summary: List all available ad accounts
 *     description: Fetches a list of ad accounts associated with the authenticated user. Optionally refreshes data from the API.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: refresh
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Set to true to force refresh data from the API.
 *     responses:
 *       200:
 *         description: A list of ad accounts wrapped in an items object.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AdAccount'
 *       401:
 *         description: Unauthorized.
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         description: Internal server error.
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
    '/',
    listAdAccountsHandler
);

/**
 * @openapi
 * /api/v1/accounts/{accountId}:
 *   get:
 *     tags:
 *       - Ad Accounts
 *     summary: Get a specific ad account by ID
 *     description: Fetches details for a specific ad account by its ID (e.g., act_12345 or 12345). Optionally refreshes data from the API.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the ad account (can be with or without 'act_' prefix).
 *       - in: query
 *         name: refresh
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Set to true to force refresh data from the API.
 *     responses:
 *       200:
 *         description: Details of the specific ad account.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdAccount'
 *       400:
 *         description: Bad request (e.g., missing accountId).
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         description: Unauthorized.
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Ad account not found.
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         description: Internal server error.
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
    '/:accountId',
    getAdAccountHandler
);

/**
 * @openapi
 * /api/v1/accounts/{accountId}/insights:
 *   get:
 *     tags:
 *       - Ad Accounts
 *     summary: Get insights for a specific ad account
 *     description: Fetches insights data for a specific ad account. If date range isn't provided, defaults to the last 7 days. Supports optional breakdowns and time increment parameters.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the ad account (can be with or without 'act_' prefix).
 *       - in: query
 *         name: date_start
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for insights in YYYY-MM-DD format. If not provided, defaults to 7 days ago.
 *       - in: query
 *         name: date_end
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for insights in YYYY-MM-DD format. If not provided, defaults to today.
 *       - in: query
 *         name: refresh
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Set to true to force refresh data from the API.
 *       - in: query
 *         name: breakdowns
 *         required: false
 *         schema:
 *           type: string
 *         description: Comma-separated list of breakdown dimensions (e.g., age,gender,country).
 *       - in: query
 *         name: time_increment
 *         required: false
 *         schema:
 *           type: string
 *           enum: [1, monthly, all_days]
 *         description: Time increment for data aggregation. Use 1 for daily, monthly for monthly, or all_days for the entire period.
 *     responses:
 *       200:
 *         description: Ad account insights data.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AdInsight'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     account_id:
 *                       type: string
 *                     date_start:
 *                       type: string
 *                     date_end:
 *                       type: string
 *                     count:
 *                       type: integer
 *                     breakdowns:
 *                       type: array
 *                       items:
 *                         type: string
 *                     time_increment:
 *                       type: string
 *       400:
 *         description: Bad request (e.g., invalid date format).
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         description: Unauthorized.
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Ad account not found.
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         description: Internal server error.
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
    '/:accountId/insights',
    getAdAccountInsightsHandler
);

export { router as adAccountRouter };