import { Request, Response, NextFunction } from 'express';
import { getSupabaseClient } from '../config/supabase';
import { User, PostgrestError } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { OrganizationUsersRepository } from '../repositories/organizationUsersRepository';

// Extend Express Request interface to include user and organisationId
export interface AuthenticatedRequest extends Request {
    user?: User;
    organisationId?: string | null;
}

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        res.status(401).json({ message: 'Authentication token required.' });
        return;
    }

    try {
        const supabase = getSupabaseClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            logger.error('Auth Error:', authError?.message);
            // Use 401 for potentially expired/invalid token, 403 might imply valid token but forbidden resource
            res.status(401).json({ message: 'Invalid or expired token.' });
            return;
        }

        // Attach user information to the request object
        req.user = user;
        logger.info('Authenticated user:', user.id);

        // --- Fetch Organisation ID --- 
        // Use repository to fetch organization for the user
        const orgUsersRepo = new OrganizationUsersRepository();
        const { result: orgData, error: orgError } = await orgUsersRepo.getUserOrganizations(user.id);

        if (orgError) {
            logger.error(`Error fetching organisation for user ${user.id}:`, orgError.message);
            res.status(500).json({ message: 'Failed to retrieve organisation details.' });
            return;
        }

        if (orgData && orgData.length > 0) {
            // Take the first organization if user belongs to multiple
            req.organisationId = orgData[0].organization_id;
            logger.info(`User ${user.id} belongs to organisation ${orgData[0].organization_id}`);
        } else {
            // Handle case where user doesn't have an organisation
            logger.info(`User ${user.id} does not belong to any organisation.`);
            req.organisationId = null;
        }
        // --- End Fetch Organisation ID ---

        next(); // Proceed to the next middleware or route handler
    } catch (err) {
        logger.error('Token verification or organisation fetch failed:', err);
        res.status(500).json({ message: 'Internal server error during authentication process.' });
    }
}; 