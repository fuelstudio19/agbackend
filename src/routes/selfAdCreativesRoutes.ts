import { Router } from 'express';
import { authenticateToken } from '../middlewares/authMiddleware';
import {
  getSelfAdsByOrganisation,
  getSelfAdById,
  deleteSelfAd
} from '../controllers/selfAdCreativesController';

const router = Router();

/**
 * @openapi
 * /api/self-ads:
 *   get:
 *     tags:
 *       - Self Ad Creatives
 *     summary: Get self ads by organisation with pagination
 *     description: Retrieve paginated self ad creatives for an organisation with scraping status information
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
 *         description: Self ads retrieved successfully
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
 *                   example: "Self ads retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SelfAdCreative'
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
router.get('/', getSelfAdsByOrganisation);

/**
 * @openapi
 * /api/self-ads/{ad_archive_id}:
 *   get:
 *     tags:
 *       - Self Ad Creatives
 *     summary: Get a specific self ad
 *     description: Retrieve a specific self ad creative by its archive ID. Authentication is optional - you can either authenticate with a token or provide organisation_id in query params.
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
 *         description: Self ad retrieved successfully
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
 *                   example: "Self ad retrieved successfully"
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid parameters or missing organisation_id
 *       404:
 *         description: Self ad not found
 *       500:
 *         description: Internal server error
 *   delete:
 *     tags:
 *       - Self Ad Creatives
 *     summary: Delete a specific self ad
 *     description: Delete a specific self ad creative by its archive ID. Authentication is required for this operation.
 *     parameters:
 *       - in: path
 *         name: ad_archive_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ad archive ID
 *     responses:
 *       200:
 *         description: Self ad deleted successfully
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
 *                   example: "Self ad deleted successfully"
 *       400:
 *         description: Invalid ad archive ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - user not associated with an organization
 *       404:
 *         description: Self ad not found
 *       500:
 *         description: Internal server error
 */
router.get('/:ad_archive_id', getSelfAdById);

// Apply authentication only to DELETE route
router.delete('/:ad_archive_id', authenticateToken, deleteSelfAd);

export { router as selfAdCreativesRouter }; 