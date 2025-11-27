import { Router } from "express";
import { authenticateToken } from "../middlewares/authMiddleware";
import { getInspirations } from "../controllers/inspirationsController";

const router = Router();

// Apply Authentication Middleware
router.use(authenticateToken);

/**
 * @openapi
 * /api/inspirations:
 *   get:
 *     tags:
 *       - Inspirations
 *     summary: Get paginated inspirations
 *     description: Retrieve paginated ad creative inspirations with optional filtering and sorting
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
 *           maximum: 100
 *           default: 100
 *         description: Number of inspirations per page
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [ad_performance_id, scraped_at, brand_name, external_id, created_at]
 *           default: scraped_at
 *         description: Field to sort by
 *       - in: query
 *         name: sort_order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *       - in: query
 *         name: brand_name
 *         schema:
 *           type: string
 *         description: Filter by brand name (partial match)
 *       - in: query
 *         name: ad_performance
 *         schema:
 *           type: string
 *         description: Filter by ad performance category
 *       - in: query
 *         name: brand_industry
 *         schema:
 *           type: string
 *         description: Filter by brand industry
 *       - in: query
 *         name: ad_platforms
 *         schema:
 *           type: string
 *         description: Filter by ad platforms (comma-separated, e.g., "Facebook,Instagram")
 *     responses:
 *       200:
 *         description: Inspirations retrieved successfully
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
 *                   example: "Inspirations retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       external_id:
 *                         type: integer
 *                         example: 4756
 *                       image_url:
 *                         type: string
 *                         example: "https://example.com/image.jpg"
 *                       image_width:
 *                         type: integer
 *                         example: 600
 *                       image_height:
 *                         type: integer
 *                         example: 600
 *                       brand_name:
 *                         type: string
 *                         example: "Atolea Jewelry"
 *                       brand_id:
 *                         type: integer
 *                         example: 617
 *                       brand_business_model:
 *                         type: string
 *                         example: "DTC"
 *                       brand_industry:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["Fashion & Apparel"]
 *                       ad_performance:
 *                         type: string
 *                         example: "Promising (30-90 days live)"
 *                       ad_performance_id:
 *                         type: integer
 *                         example: 2
 *                       ad_platforms:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["Facebook", "Instagram"]
 *                       ad_topics:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["Product Spotlight", "Social Proof"]
 *                       ad_aspect_ratio:
 *                         type: string
 *                         example: "1:1"
 *                       ad_aspect_ratio_id:
 *                         type: integer
 *                         example: 3
 *                       template_url:
 *                         type: string
 *                         example: ""
 *                       prompt_ready:
 *                         type: boolean
 *                         example: false
 *                       saved:
 *                         type: integer
 *                         example: 0
 *                       scraped_at:
 *                         type: string
 *                         format: date-time
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 50
 *                     total:
 *                       type: integer
 *                       example: 4800
 *                     totalPages:
 *                       type: integer
 *                       example: 96
 *                     hasNext:
 *                       type: boolean
 *                       example: true
 *                     hasPrev:
 *                       type: boolean
 *                       example: false
 *                 filters:
 *                   type: object
 *                   description: Applied filters (only present if filters were used)
 *                 sorting:
 *                   type: object
 *                   properties:
 *                     sortBy:
 *                       type: string
 *                       example: "ad_performance_id"
 *                     sortOrder:
 *                       type: string
 *                       example: "desc"
 *       400:
 *         description: Invalid query parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Page must be greater than 0"
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/', authenticateToken, getInspirations);

export default router; 