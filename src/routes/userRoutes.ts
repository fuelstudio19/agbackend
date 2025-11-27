import { Router } from 'express';
import { getUserProfile } from '../controllers/userController';
import { authenticateToken } from '../middlewares/authMiddleware'; // Import the auth middleware

const router = Router();

/**
 * @openapi
 * /api/users/profile:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get user profile
 *     description: Retrieves the authenticated user's profile information.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfileResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
// Example Protected Route
// Apply the authentication middleware *before* the controller function
router.get('/profile', authenticateToken, getUserProfile);

// Add other user-related routes here (e.g., update profile, etc.)

export default router; 