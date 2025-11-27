import { Router } from 'express';
import {
    getCampaignHandler,
    listCampaignsForAccountHandler,
    getCampaignInsightsHandler
} from '../controllers/campaignController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

// Apply Authentication Middleware
router.use(authenticateToken);

/**
 * @openapi
 * /api/v1/campaigns/account/{accountId}/{campaignId}/insights:
 *   get:
 *     tags:
 *       - Campaigns
 *     summary: Get insights for a specific campaign
 *     description: Fetches insights data for a specific campaign within an account. If date range isn't provided, defaults to the last 7 days. Supports optional breakdowns and time increment parameters.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the ad account (can be with or without 'act_' prefix) that the campaign belongs to.
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the campaign to fetch insights for.
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
 *         description: Campaign insights data.
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
 *                     campaign_id:
 *                       type: string
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
 *         description: Bad request (e.g., missing campaign ID or invalid date format).
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         description: Unauthorized.
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Campaign not found.
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         description: Internal server error.
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/account/:accountId/:campaignId/insights', getCampaignInsightsHandler);

/**
 * @openapi
 * /api/v1/campaigns/account/{accountId}/{campaignId}:
 *   get:
 *     tags:
 *       - Campaigns
 *     summary: Get a specific campaign by ID
 *     description: Fetches details for a specific campaign within a given ad account. Optionally refreshes data from the API and can filter insights by date range. If date range isn't provided, defaults to the last 7 days.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the ad account (act_xxxxxxxx) containing the campaign.
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the campaign to fetch.
 *       - in: query
 *         name: refresh
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Set to true to force refresh data from the API.
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
 *     responses:
 *       200:
 *         description: Campaign details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Campaign'
 *       400:
 *         description: Bad request (e.g., invalid ID format).
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         description: Unauthorized.
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Campaign or Ad account not found.
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         description: Internal server error.
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/account/:accountId/:campaignId', getCampaignHandler);

/**
 * @openapi
 * /api/v1/campaigns/account/{accountId}:
 *   get:
 *     tags:
 *       - Campaigns
 *     summary: List campaigns for a specific ad account
 *     description: Fetches a list of campaigns for a specified ad account. Optionally refreshes data from the API and can filter insights by date range. If date range isn't provided, defaults to the last 7 days.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the ad account (act_xxxxxxxx) to fetch campaigns for.
 *       - in: query
 *         name: refresh
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Set to true to force refresh data from the API.
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
 *     responses:
 *       200:
 *         description: A list of campaigns for the specified account.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Campaign'
 *       400:
 *         description: Bad request (e.g., invalid account ID format).
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         description: Unauthorized.
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Ad account not found or no campaigns associated.
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         description: Internal server error.
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/account/:accountId', listCampaignsForAccountHandler);

export { router as campaignRouter }; 