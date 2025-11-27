import { Request, Response, NextFunction } from 'express';
import { OnboardingService } from '../services/onboardingService';
import { OnboardingRequest, OnboardingResponse, ProcessCompetitorBody, processCompetitorSchema } from '../types/onboarding';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { logger } from '../utils/logger';
import { getUserAndOrgIds, getUserInfo } from '../utils/general';
import { ZodError } from 'zod';
import { OrganizationUsersRepository } from '../repositories/organizationUsersRepository';
import { searchCompanies } from '../utils/scrapper';
import { companySearchSchema } from '../types/scrapperTypes';

const onboardingService = new OnboardingService();

/**
 * Analyze company data using web search - returns analysis without saving
 */
export const processOnboarding = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const data: OnboardingRequest = req.body;
        const { data: result, error } = await onboardingService.processOnboarding(data);

        if (error) {
            res.status(400).json({ error });
            return;
        }

        if (!result) {
            res.status(400).json({ error: 'Failed to analyze company data' });
            return;
        }

        res.status(200).json(result);
    } catch (error) {
        if (error instanceof Error) {
            res.status(400).json({ error: error.message });
        } else {
            logger.error('Onboarding Analysis Controller Error:', error);
            next(error);
        }
    }
};

/**
 * Save analyzed onboarding data to database
 */
export const saveOnboarding = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const ids = getUserInfo(req as AuthenticatedRequest, res);
    if (!ids) return;

    const { userId } = ids;

    try {
        const data: OnboardingResponse = req.body;
        const { data: result, error } = await onboardingService.saveOnboarding(data, userId);

        if (error) {
            res.status(400).json({ error: error.message || error });
            return;
        }

        if (!result) {
            res.status(400).json({ error: 'Failed to save onboarding data' });
            return;
        }

        res.status(201).json({
            message: 'Onboarding data saved successfully',
            data: result
        });
    } catch (error) {
        if (error instanceof Error) {
            res.status(400).json({ error: error.message });
        } else {
            logger.error('Save Onboarding Controller Error:', error);
            next(error);
        }
    }
};

/**
 * Get existing onboarding data by company URL
 */
export const getOnboardingByUrl = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { companyUrl } = req.params;
        
        if (!companyUrl) {
            res.status(400).json({ error: 'Company URL is required' });
            return;
        }

        // For now, we can call the service method directly since it's a simple lookup
        // You might want to create a separate method in the service for this
        const { data: result, error } = await onboardingService.processOnboarding({ 
            company_url: decodeURIComponent(companyUrl) 
        });

        if (error) {
            res.status(404).json({ error: 'Onboarding data not found' });
            return;
        }

        if (!result) {
            res.status(404).json({ error: 'No onboarding data found for this URL' });
            return;
        }

        res.status(200).json(result);
    } catch (error) {
        if (error instanceof Error) {
            res.status(400).json({ error: error.message });
        } else {
            logger.error('Get Onboarding Controller Error:', error);
            next(error);
        }
    }
};

/**
 * Process a new competitor
 */
export const processCompetitor = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const ids = getUserAndOrgIds(req as AuthenticatedRequest, res);
    if (!ids) return;

    const { userId, organisationId } = ids;

    try {
        // Validate input
        const competitorData = processCompetitorSchema.parse(req.body);
        
        const { data: result, error } = await onboardingService.processCompetitor(
            competitorData, 
            userId, 
            organisationId
        );

        if (error) {
            res.status(400).json({ error });
            return;
        }

        if (!result) {
            res.status(400).json({ error: 'Failed to process competitor' });
            return;
        }

        res.status(201).json({
            message: 'Competitor processed and saved successfully',
            data: result
        });
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({ error: error.errors });
            return;
        }
        if (error instanceof Error) {
            res.status(400).json({ error: error.message });
        } else {
            logger.error('Process Competitor Controller Error:', error);
            next(error);
        }
    }
};

/**
 * Process onboarding for non-logged-in users (guest users)
 * Creates organization without associating it with a user
 */
export const processOnboardingForGuest = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { company_url } = req.body;
        
        if (!company_url) {
            res.status(400).json({ error: 'Company URL is required' });
            return;
        }

        const data: OnboardingRequest = { company_url };
        const { data: result, error } = await onboardingService.processOnboardingForGuest(data);

        if (error) {
            res.status(400).json({ error });
            return;
        }

        if (!result) {
            res.status(400).json({ error: 'Failed to process onboarding for guest user' });
            return;
        }

        res.status(201).json({
            message: 'Onboarding processed successfully for guest user',
            data: result
        });
    } catch (error) {
        if (error instanceof Error) {
            res.status(400).json({ error: error.message });
        } else {
            logger.error('Process Onboarding For Guest Controller Error:', error);
            next(error);
        }
    }
};

/**
 * Associate logged-in user with an organization
 * Checks if user is already associated, creates association if not
 */
export const associateUserWithOrganization = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const userInfo = getUserInfo(req as AuthenticatedRequest, res);
    if (!userInfo) return;

    const { userId } = userInfo;

    try {
        const { organisationId } = req.body;
        
        if (!organisationId) {
            res.status(400).json({ error: 'Organisation ID is required' });
            return;
        }

        const orgUsersRepo = new OrganizationUsersRepository();

        // Check if user is already associated with the organization
        const { result: existingMembership, error: membershipError } = await orgUsersRepo.getUserOrganizationMembership(organisationId, userId);

        if (membershipError) {
            logger.error(`Error checking user membership for user ${userId} and org ${organisationId}:`, membershipError);
            res.status(500).json({ error: 'Failed to check organization membership' });
            return;
        }

        if (existingMembership) {
            res.status(200).json({
                message: 'User is already associated with this organization',
                data: existingMembership
            });
            return;
        }

        // Create new association
        const { result: newMembership, error: addError } = await orgUsersRepo.addUserToOrganization(organisationId, userId, 'member');

        if (addError) {
            logger.error(`Error adding user ${userId} to organization ${organisationId}:`, addError);
            res.status(500).json({ error: 'Failed to associate user with organization' });
            return;
        }

        if (!newMembership) {
            res.status(500).json({ error: 'Failed to create organization association' });
            return;
        }

        res.status(201).json({
            message: 'User successfully associated with organization',
            data: newMembership
        });
    } catch (error) {
        if (error instanceof Error) {
            res.status(400).json({ error: error.message });
        } else {
            logger.error('Associate User with Organization Controller Error:', error);
            next(error);
        }
    }
};

/**
 * Search for companies using Facebook Ad Library
 */
export const searchCompaniesEndpoint = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { query } = req.query;

        // Validate query parameter
        const validatedQuery = companySearchSchema.parse({ query });

        const result = await searchCompanies(validatedQuery.query);

        res.status(200).json({
            message: 'Companies searched successfully',
            data: result
        });
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({ error: error.errors });
            return;
        }
        if (error instanceof Error) {
            res.status(400).json({ error: error.message });
        } else {
            logger.error('Search Companies Controller Error:', error);
            next(error);
        }
    }
};
