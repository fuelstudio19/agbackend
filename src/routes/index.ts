import { Router } from 'express';
import userRoutes from './userRoutes'; // Import user-specific routes
import authRoutes from './authRoutes'; // Import auth routes
import { adAccountRouter } from './adAccountRoutes'; // Import Ad Account routes (named import)
import { adRouter } from './adRoutes'; // Import Ad routes (named import)
import { campaignRouter } from './campaignRoutes'; // Import Campaign routes
import docsRoutes from './docsRoutes'; // Import API documentation routes
import { adSetRouter } from './adSetRoutes';
import { metaAdScrapingRouter } from './adScrapRoutes';
import { competitorCreativesRouter } from './competitorCreativesRoutes';
import { selfAdCreativesRouter } from './selfAdCreativesRoutes';
import onboardingRouter from './onboarding'; // Import onboarding routes
import inspirationsRouter from './inspirationsRoutes'; // Import inspirations routes
import { adConceptRouter } from './adConceptRoutes'; // Import ad concepts routes

const router = Router();

// Mount docs routes (e.g., /api/docs)
router.use('/docs', docsRoutes);

// Mount auth routes (e.g., /api/auth/register, /api/auth/login)
router.use('/auth', authRoutes);

// Mount user routes (e.g., /api/users/profile)
router.use('/users', userRoutes);

// Mount Ad Account routes (e.g., /api/accounts)
router.use('/ad-accounts', adAccountRouter);

// Mount Campaign routes (e.g., /api/campaigns)
router.use('/campaigns', campaignRouter);

// Mount Ad routes (e.g., /api/ads)
router.use('/ads', adRouter);

// Mount Ad Set routes (e.g., /api/ad-sets)
router.use('/ad-sets', adSetRouter);

// Mount Scrap ad routes (e.g., /api/scrap) - now includes both competitor and self ads
router.use('/scrap', metaAdScrapingRouter);

// Mount Competitor Ad Creatives routes (e.g., /api/competitor-ads)
router.use('/competitor-ads', competitorCreativesRouter);

// Mount Self Ad Creatives routes (e.g., /api/self-ads)
router.use('/self-ads', selfAdCreativesRouter);

// Mount Inspirations routes (e.g., /api/inspirations)
router.use('/inspirations', inspirationsRouter);

// Mount Ad Concepts routes (e.g., /api/ad-concepts)
router.use('/ad-concepts', adConceptRouter);

// Mount Onboarding routes (e.g., /api/onboarding)
router.use('/onboarding', onboardingRouter);

// Add other domain routes here
// router.use('/products', productRoutes);

export default router; 