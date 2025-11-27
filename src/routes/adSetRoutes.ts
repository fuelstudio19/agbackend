import { Router } from 'express';
import {
    listAdSetsByAccountHandler,
    getAdSetHandler,
} from '../controllers/adSetController';
// Import authentication middleware
import { authenticateToken } from '../middlewares/authMiddleware';
// import { requireAuth } from '../middlewares/requireAuth'; // Example middleware

// Using mergeParams allows accessing parent router params (like :accountId)
const router = Router({ mergeParams: true });

// --- Middleware (Example) ---
// Apply auth middleware if needed for all ad set routes in this router
// router.use(requireAuth);

// --- Middleware ---
// Apply auth middleware to all ad set routes in this router
router.use(authenticateToken);

// --- Define Ad Set Routes ---
// These routes assume this router is mounted under a path like "/api/v1"

/**
 * @openapi
 * /api/v1/account/{accountId}/adsets:
 *   get:
 *     tags:
 *       - Ad Sets
 *     summary: List ad sets for an account
 *     description: Fetches all ad sets belonging to a specific ad account. Optionally refreshes data from the API.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the ad account (e.g., act_123456).
 *       - in: query
 *         name: refresh
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Set to true to force refresh data from the API.
 *     responses:
 *       200:
 *         description: A list of ad sets wrapped in an items object.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AdSet'
 *       400:
 *          description: Bad request (e.g., invalid account ID format).
 *          $ref: '#/components/responses/BadRequest'
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
router.get('/account/:accountId', listAdSetsByAccountHandler);

/**
 * @openapi
 * /api/v1/account/{accountId}/adsets/{adSetId}:
 *   get:
 *     tags:
 *       - Ad Sets
 *     summary: Get a specific ad set by ID
 *     description: Fetches details for a specific ad set by its ID within the context of an account. Optionally refreshes data from the API.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the ad account.
 *       - in: path
 *         name: adSetId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the ad set.
 *       - in: query
 *         name: refresh
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Set to true to force refresh data from the API.
 *     responses:
 *       200:
 *         description: Details of the specific ad set.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdSet'
 *       400:
 *          description: Bad request (e.g., invalid ID format).
 *          $ref: '#/components/responses/BadRequest'
 *       401:
 *         description: Unauthorized.
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Ad Set or Ad Account not found.
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         description: Internal server error.
 *         $ref: '#/components/responses/InternalServerError'
 */
// This route gets a specific Ad Set within the account specified in the path
router.get('/account/:accountId/:adSetId', getAdSetHandler);

// Export the router using a specific name
export { router as adSetRouter }; 