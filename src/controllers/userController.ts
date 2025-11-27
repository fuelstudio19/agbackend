import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware'; // Import the extended Request type
import * as UserService from '../services/userService';
import { logger } from '../utils/logger';

export const getUserProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    // The authenticateToken middleware should have already attached the user object
    if (!req.user) {
        // This case should ideally not be reached if middleware is applied correctly
        res.status(401).json({ message: 'User not authenticated.' });
        return; // Return void
    }

    try {
        // Example: Fetch additional profile data using the user ID from the token
        const userId = req.user.id;
        const userProfile = await UserService.fetchUserProfile(userId);

        // Return the profile data (or just the user object from the token for simplicity)
        // res.json(userProfile); 
        res.json({ user: req.user }); // Sending back the user object from JWT

    } catch (error) {
        logger.error('Error fetching user profile:', error);
        next(error); // Pass error to the global error handler
    }
};

// Add other controller functions for user actions here 