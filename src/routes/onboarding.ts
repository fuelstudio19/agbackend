import { Router } from 'express';
import { processOnboarding, saveOnboarding, getOnboardingByUrl, processCompetitor, processOnboardingForGuest, associateUserWithOrganization, searchCompaniesEndpoint } from '../controllers/onboardingController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

/**
 * @openapi
 * /api/v1/onboarding/analyze:
 *   post:
 *     summary: Analyze company data using web search
 *     description: Uses AI web search to analyze company information without saving to database
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - company_url
 *             properties:
 *               company_url:
 *                 type: string
 *                 format: uri
 *                 description: Company website URL to analyze
 *     responses:
 *       200:
 *         description: Company analysis completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OnboardingResponse'
 *       400:
 *         description: Invalid input data or analysis failed
 *       500:
 *         description: Server error
 */
router.post('/analyze', processOnboarding);

/**
 * @openapi
 * /api/v1/onboarding/save:
 *   post:
 *     summary: Save analyzed onboarding data
 *     description: Saves the analyzed company data to the database (requires authentication)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OnboardingResponse'
 *     responses:
 *       201:
 *         description: Onboarding data saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/OnboardingResponse'
 *       400:
 *         description: Invalid data or save failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - user not associated with organization
 *       500:
 *         description: Server error
 */
router.post('/save', authenticateToken, saveOnboarding);

/**
 * @openapi
 * /api/v1/onboarding/guest:
 *   post:
 *     summary: Process onboarding for guest users (non-logged-in)
 *     description: Analyzes company data using LLM search, creates organization without user association, and returns data with organization ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - company_url
 *             properties:
 *               company_url:
 *                 type: string
 *                 format: uri
 *                 description: Company website URL to analyze
 *                 example: 'https://example.com'
 *     responses:
 *       201:
 *         description: Guest onboarding completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'Onboarding processed successfully for guest user'
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/OnboardingResponse'
 *                     - type: object
 *                       properties:
 *                         organizationId:
 *                           type: string
 *                           format: uuid
 *                           description: The created organization ID
 *       400:
 *         description: Invalid input data or processing failed
 *       500:
 *         description: Server error
 */
router.post('/guest', processOnboardingForGuest);

/**
 * @openapi
 * /api/v1/onboarding/competitor:
 *   post:
 *     summary: Process and save a new competitor
 *     description: Saves competitor details directly to the database without AI analysis
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *               - name
 *               - meta_ad_library_url
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: Competitor's website URL
 *                 example: 'https://competitor.com'
 *               name:
 *                 type: string
 *                 description: Competitor's company name
 *                 example: 'Competitor Inc'
 *               meta_ad_library_url:
 *                 type: string
 *                 format: uri
 *                 description: Meta Ads Library URL for this competitor
 *                 example: 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=Competitor%20Inc'
 *               short_write_up:
 *                 type: string
 *                 description: Optional brief description of the competitor company
 *                 example: 'A leading company in the tech industry known for innovative solutions.'
 *               logo:
 *                 type: string
 *                 format: uri
 *                 description: Optional URL of the competitor's logo
 *                 example: 'https://competitor.com/logo.png'
 *     responses:
 *       201:
 *         description: Competitor saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'Competitor processed and saved successfully'
 *                 data:
 *                   type: object
 *                   description: Saved competitor data
 *       400:
 *         description: Invalid input data or save failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - user not associated with organization
 *       500:
 *         description: Server error
 */
router.post('/competitor', authenticateToken, processCompetitor);

/**
 * @openapi
 * /api/v1/onboarding/associate:
 *   post:
 *     summary: Associate logged-in user with an organization
 *     description: Associates the authenticated user with the specified organization. If the association already exists, returns the existing association. If not, creates a new association.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - organisationId
 *             properties:
 *               organisationId:
 *                 type: string
 *                 format: uuid
 *                 description: The organization ID to associate the user with
 *                 example: '123e4567-e89b-12d3-a456-426614174000'
 *     responses:
 *       200:
 *         description: User is already associated with this organization
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'User is already associated with this organization'
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     organization_id:
 *                       type: string
 *                       format: uuid
 *                     user_id:
 *                       type: string
 *                       format: uuid
 *                     role:
 *                       type: string
 *                       example: 'member'
 *                     joined_at:
 *                       type: string
 *                       format: date-time
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       201:
 *         description: User successfully associated with organization
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'User successfully associated with organization'
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     organization_id:
 *                       type: string
 *                       format: uuid
 *                     user_id:
 *                       type: string
 *                       format: uuid
 *                     role:
 *                       type: string
 *                       example: 'member'
 *                     joined_at:
 *                       type: string
 *                       format: date-time
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid input data - organisation ID missing
 *       401:
 *         description: Unauthorized - authentication required
 *       500:
 *         description: Server error
 */
router.post('/associate', authenticateToken, associateUserWithOrganization);

/**
 * @openapi
 * /api/v1/onboarding/search/companies:
 *   get:
 *     summary: Search for companies in Facebook Ad Library
 *     description: Search for companies using their names or brands to find their Facebook pages and ad presence
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *         description: Company name or brand to search for
 *         example: 'nike'
 *     responses:
 *       200:
 *         description: Company search completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'Companies searched successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     searchResults:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           page_id:
 *                             type: string
 *                             example: '15087023444'
 *                           category:
 *                             type: string
 *                             example: 'Sportswear Store'
 *                           image_uri:
 *                             type: string
 *                             format: uri
 *                             example: 'https://scontent-sea1-1.xx.fbcdn.net/v/t39.30808-1/...'
 *                           likes:
 *                             type: number
 *                             example: 39583888
 *                           verification:
 *                             type: string
 *                             example: 'BLUE_VERIFIED'
 *                           name:
 *                             type: string
 *                             example: 'Nike'
 *                           country:
 *                             type: string
 *                             nullable: true
 *                             example: null
 *                           entity_type:
 *                             type: string
 *                             example: 'PERSON_PROFILE'
 *                           ig_username:
 *                             type: string
 *                             nullable: true
 *                             example: 'nike'
 *                           ig_followers:
 *                             type: number
 *                             nullable: true
 *                             example: 300362328
 *                           ig_verification:
 *                             type: boolean
 *                             nullable: true
 *                             example: true
 *                           page_alias:
 *                             type: string
 *                             example: 'nike'
 *                           page_is_deleted:
 *                             type: boolean
 *                             example: false
 *       400:
 *         description: Invalid query parameter or search failed
 *       500:
 *         description: Server error
 */
router.get('/search/companies', searchCompaniesEndpoint);

/**
 * @openapi
 * /api/v1/onboarding/{companyUrl}:
 *   get:
 *     summary: Get onboarding data by company URL
 *     description: Retrieves existing onboarding data for a company URL
 *     parameters:
 *       - in: path
 *         name: companyUrl
 *         required: true
 *         schema:
 *           type: string
 *         description: URL-encoded company URL
 *     responses:
 *       200:
 *         description: Onboarding data found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OnboardingResponse'
 *       404:
 *         description: No onboarding data found for this URL
 *       400:
 *         description: Invalid company URL
 *       500:
 *         description: Server error
 */
router.get('/:companyUrl', getOnboardingByUrl);

export default router; 