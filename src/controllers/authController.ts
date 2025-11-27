import { Request, Response, NextFunction } from 'express';
import * as AuthService from '../services/authService';
import { RegisterBodySchema, LoginBodySchema } from '../types/authTypes';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

export const handleRegister = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Validate request body
        const validatedBody = RegisterBodySchema.parse(req.body);

        const { user, error } = await AuthService.registerUser(validatedBody);

        if (error) {
            // Customize error response based on Supabase error type/message if needed
            res.status(400).json({ message: error.message || 'Registration failed' });
            return;
        }

        // Determine response based on email confirmation setting
        if (user?.identities?.length === 0) { // Heuristic: user created but needs verification
             res.status(201).json({ 
                message: 'Registration successful. Please check your email to confirm your account.', 
                userId: user.id 
            });
        } else if (user) {
             res.status(201).json({ 
                message: 'Registration successful.', // Assuming auto-confirmation or already confirmed
                userId: user.id 
                // You might not want to return a session here depending on flow
            });
        } else {
            // Fallback case, should ideally be covered by error handling
             res.status(400).json({ message: 'Registration failed. Could not create user.' });
        }

    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({ message: 'Invalid input', errors: error.errors });
        } else {
            logger.error('Register Controller Error:', error);
            next(error); // Pass to global error handler
        }
    }
};

export const handleLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Validate request body
        const validatedBody = LoginBodySchema.parse(req.body);

        const { session, error } = await AuthService.loginUser(validatedBody);

        if (error || !session) {
            res.status(401).json({ message: error?.message || 'Invalid login credentials' });
            return;
        }

        // Login successful, return session (contains tokens)
        res.status(200).json({ 
            message: 'Login successful', 
            session: session 
        });

    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({ message: 'Invalid input', errors: error.errors });
        } else {
            logger.error('Login Controller Error:', error);
            next(error); // Pass to global error handler
        }
    }
};

/**
 * Initiates Google OAuth login flow
 */
export const handleGoogleLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Get redirect URL from query parameters or use a default
        const redirectUrl = req.query.redirectUrl as string || process.env.FRONTEND_URL || 'http://localhost:3000';
        
        // Generate Google OAuth URL from Supabase
        const { url, error } = await AuthService.getGoogleAuthUrl(redirectUrl);
        
        if (error || !url) {
            res.status(500).json({ message: error?.message || 'Failed to generate Google login URL' });
            return;
        }
        
        // Option 1: Return the URL for the frontend to handle the redirect
        res.status(200).json({ url });
        
        // Option 2: Redirect the user directly (uncomment if you prefer this approach)
        // res.redirect(url);
        
    } catch (error) {
        logger.error('Google Login Controller Error:', error);
        next(error);
    }
};

/**
 * Handles OAuth callback from Google via Supabase
 * This endpoint will be called by Supabase after Google authentication
 */
export const handleOAuthCallback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Get the code from query string
        const code = req.query.code as string;
        if (!code) {
            res.status(400).json({ message: 'Missing authorization code' });
            return;
        }
        
        // Exchange code for session
        const { session, error } = await AuthService.handleOAuthCallback(code);
        
        if (error || !session) {
            logger.error('OAuth callback error:', error);
            // Redirect to frontend with error
            res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/error?message=${encodeURIComponent(error?.message || 'Authentication failed')}`);
            return;
        }
        
        // Successful authentication - redirect to frontend with tokens
        // In production, you might want a more secure approach than passing tokens in URL
        const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?access_token=${session.access_token}&refresh_token=${session.refresh_token}`;
        res.redirect(redirectUrl);
        
    } catch (error) {
        logger.error('OAuth Callback Controller Error:', error);
        // Redirect to frontend with error
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/error?message=${encodeURIComponent('Authentication failed')}`);
    }
}; 