import { Router } from 'express';
import { 
    generateAdConcepts, 
    getAdConcepts, 
    getAdConceptById, 
    deleteAdConcept 
} from '../controllers/adConceptController';
// import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

// Apply Authentication Middleware
// router.use(authenticateToken);

/**
 * @openapi
 * /api/ad-concepts/generate:
 *   post:
 *     tags:
 *       - Ad Concepts
 *     summary: Generate ad concepts using AI multimodal analysis
 *     description: Analyze user and competitor images to generate strategic ad concepts using AI
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userImageUrls:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *                 description: Array of user's own ad image URLs
 *                 example: ["https://example.com/user-ad-1.jpg", "https://example.com/user-ad-2.jpg"]
 *               competitorImageUrls:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *                 description: Array of competitor ad image URLs
 *                 example: ["https://example.com/competitor-ad-1.jpg", "https://example.com/competitor-ad-2.jpg"]
 *             required:
 *               - userImageUrls
 *               - competitorImageUrls
 *             note: At least one of userImageUrls or competitorImageUrls must contain valid URLs
 *     responses:
 *       200:
 *         description: Ad concepts generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     concepts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "concept-1"
 *                           title:
 *                             type: string
 *                             example: "Urban Confidence"
 *                           audience:
 *                             type: string
 *                             example: "Urban Millennials"
 *                           hook:
 *                             type: string
 *                             example: "Transform your daily routine with premium quality"
 *                           styleType:
 *                             type: string
 *                             example: "Minimalist Premium"
 *                           description:
 *                             type: string
 *                             example: "Clean aesthetic focusing on product quality and lifestyle elevation"
 *                           visualHint:
 *                             type: string
 *                             example: "Golden hour lighting with minimalist composition"
 *                 message:
 *                   type: string
 *                   example: "Successfully generated 4 ad concepts"
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     model:
 *                       type: string
 *                       example: "gemini-1.5-pro-latest"
 *                     processingTime:
 *                       type: number
 *                       example: 15420
 *                     conceptsGenerated:
 *                       type: number
 *                       example: 4
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/generate', generateAdConcepts);

/**
 * @openapi
 * /api/ad-concepts:
 *   get:
 *     tags:
 *       - Ad Concepts
 *     summary: Get paginated list of ad concepts
 *     description: Retrieve ad concepts generated for the authenticated user's organization
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of concepts per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created_at, updated_at]
 *           default: created_at
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Ad concepts retrieved successfully
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/', getAdConcepts);

/**
 * @openapi
 * /api/ad-concepts/{conceptId}:
 *   get:
 *     tags:
 *       - Ad Concepts
 *     summary: Get ad concept by ID
 *     description: Retrieve a specific ad concept by its ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conceptId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Ad concept ID
 *     responses:
 *       200:
 *         description: Ad concept retrieved successfully
 *       404:
 *         description: Ad concept not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/:conceptId', getAdConceptById);

/**
 * @openapi
 * /api/ad-concepts/{conceptId}:
 *   delete:
 *     tags:
 *       - Ad Concepts
 *     summary: Delete ad concept by ID
 *     description: Delete a specific ad concept by its ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conceptId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Ad concept ID
 *     responses:
 *       200:
 *         description: Ad concept deleted successfully
 *       404:
 *         description: Ad concept not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete('/:conceptId', deleteAdConcept);

export { router as adConceptRouter }; 