import { Router } from 'express';
import { handleRegister, handleLogin, handleGoogleLogin, handleOAuthCallback } from '../controllers/authController';

const router = Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Register a new user
 *     description: Create a new user account with email and password.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully (check email for confirmation if enabled)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RegisterResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
// POST /api/auth/register
router.post('/register', handleRegister);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Login to existing account
 *     description: Authenticate a user with email and password.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
// POST /api/auth/login
router.post('/login', handleLogin);

/**
 * @openapi
 * /api/auth/google:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Initiate Google OAuth login
 *     description: Get a URL to redirect the user to for Google authentication.
 *     parameters:
 *       - in: query
 *         name: redirectUrl
 *         schema:
 *           type: string
 *         description: URL to redirect to after successful authentication
 *     responses:
 *       200:
 *         description: Google OAuth URL generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   description: URL to redirect the user to for Google authentication
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
// GET /api/auth/google
router.get('/google', handleGoogleLogin);

/**
 * @openapi
 * /api/auth/callback:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Handle OAuth callback
 *     description: Process the callback from Google OAuth and redirect to the frontend.
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         required: true
 *         description: Authorization code from OAuth provider
 *     responses:
 *       302:
 *         description: Redirect to frontend with authentication result
 *       400:
 *         description: Bad request (missing code)
 *       500:
 *         description: Internal server error during authentication
 */
// GET /api/auth/callback
router.get('/callback', handleOAuthCallback);

// Add other auth-related routes here (e.g., password reset, refresh token)

export default router; 