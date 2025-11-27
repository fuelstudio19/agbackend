import { Router } from "express";
import { authenticateToken } from "../middlewares/authMiddleware";
import { 
  getCompetitorAdsByOrganisation,
  getCompetitorAdsByPage,
  getCompetitorAdById,
  deleteCompetitorAd
} from "../controllers/competitorCreativesController";

const router = Router();

/**
 * @openapi
 * /api/competitor-ads:
 *   get:
 *     tags:
 *       - Competitor Ad Creatives
 *     summary: Get competitor ads by organisation with pagination
 *     description: Retrieve paginated competitor ad creatives for an organisation with scraping status information
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 100
 *         description: Number of ads to retrieve
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of ads to skip
 *       - in: query
 *         name: organisation_id
 *         schema:
 *           type: string
 *         description: Organisation ID (optional if authenticated)
 *     responses:
 *       200:
 *         description: Competitor ads retrieved successfully
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
 *                   example: "Competitor ads retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CompetitorAdCreative'
 *                 isScraping:
 *                   type: boolean
 *                   example: false
 *                   description: Whether there are active scraping processes for this organisation
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *                     total:
 *                       type: integer
 *       400:
 *         description: Invalid query parameters or missing organisation_id
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
 *                 data:
 *                   type: null
 *                 isScraping:
 *                   type: boolean
 *                   example: false
 */
router.get('/', getCompetitorAdsByOrganisation);

/**
 * @openapi
 * /api/competitor-ads/page/{page_id}:
 *   get:
 *     tags:
 *       - Competitor Ad Creatives
 *     summary: Get competitor ads for a specific page
 *     description: Retrieve all competitor ad creatives for a specific Facebook page. Authentication is optional - you can either authenticate with a token or provide organisation_id in query params.
 *     parameters:
 *       - in: path
 *         name: page_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Facebook page ID
 *       - in: query
 *         name: organisation_id
 *         schema:
 *           type: string
 *         description: Organisation ID (required if not authenticated)
 *     responses:
 *       200:
 *         description: Competitor ads for page retrieved successfully
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
 *                   example: "Competitor ads for page retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Invalid parameters or missing organisation_id
 *       500:
 *         description: Internal server error
 */
router.get('/page/:page_id', getCompetitorAdsByPage);

/**
 * @openapi
 * /api/competitor-ads/{ad_archive_id}:
 *   get:
 *     tags:
 *       - Competitor Ad Creatives
 *     summary: Get a specific competitor ad
 *     description: Retrieve a specific competitor ad creative by its archive ID. Authentication is optional - you can either authenticate with a token or provide organisation_id in query params.
 *     parameters:
 *       - in: path
 *         name: ad_archive_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ad archive ID
 *       - in: query
 *         name: organisation_id
 *         schema:
 *           type: string
 *         description: Organisation ID (required if not authenticated)
 *     responses:
 *       200:
 *         description: Competitor ad retrieved successfully
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
 *                   example: "Competitor ad retrieved successfully"
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid parameters or missing organisation_id
 *       404:
 *         description: Competitor ad not found
 *       500:
 *         description: Internal server error
 *   delete:
 *     tags:
 *       - Competitor Ad Creatives
 *     summary: Delete a specific competitor ad
 *     description: Delete a specific competitor ad creative by its archive ID. Authentication is required for this operation.
 *     parameters:
 *       - in: path
 *         name: ad_archive_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ad archive ID
 *     responses:
 *       200:
 *         description: Competitor ad deleted successfully
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
 *                   example: "Competitor ad deleted successfully"
 *       400:
 *         description: Invalid ad archive ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - user not associated with an organization
 *       404:
 *         description: Competitor ad not found
 *       500:
 *         description: Internal server error
 */
router.get('/:ad_archive_id', getCompetitorAdById);

// Apply authentication only to DELETE route
router.delete('/:ad_archive_id', authenticateToken, deleteCompetitorAd);

export { router as competitorCreativesRouter }; 