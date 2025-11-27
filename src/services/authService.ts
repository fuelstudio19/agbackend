import { getSupabaseClient } from '../config/supabase';
import { AuthError, Session, User } from '@supabase/supabase-js';
import { RegisterBody, LoginBody } from '../types/authTypes';
import { logger } from '../utils/logger';

export const registerUser = async (userData: RegisterBody): Promise<{ user: User | null; error: AuthError | null }> => {
    const supabase = getSupabaseClient();
    const { email, password } = userData;

    // Supabase `signUp` handles email confirmation based on your project settings
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        // options: { // Optional: Add user metadata or redirect URLs
        //     data: { 
        //         full_name: userData.data?.fullName, 
        //         // other metadata...
        //     },
        //     emailRedirectTo: 'http://localhost:3000/welcome', // Example redirect URL after confirmation
        // }
    });

    if (error) {
        logger.error('Supabase registration error:', error.message);
    }

    // Depending on your Supabase settings (email confirmation required?), 
    // data.user might be null until the email is confirmed.
    // The session might also be null initially.
    return { user: data.user, error }; 
};

export const loginUser = async (credentials: LoginBody): Promise<{ session: Session | null; error: AuthError | null }> => {
    const supabase = getSupabaseClient();
    const { email, password } = credentials;

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        logger.error('Supabase login error:', error.message);
    }

    // `data.session` contains the JWT access_token and refresh_token upon successful login
    return { session: data.session, error };
};

/**
 * Generates a Google OAuth sign-in URL
 * @param redirectUrl The frontend URL to redirect to after successful authentication
 * @returns URL to redirect user to for Google login
 */
export const getGoogleAuthUrl = async (redirectUrl: string): Promise<{ url: string; error: AuthError | null }> => {
    try {
        const supabase = getSupabaseClient();
        
        // Construct the Supabase redirect URL
        // When a user completes the OAuth flow, they'll be sent to this URL
        // You'll need to configure this URL in your Supabase dashboard's Auth settings
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl,
                // You can request additional scopes if needed
                // scopes: 'email profile',
            }
        });

        if (error) {
            logger.error('Error generating Google OAuth URL:', error);
            return { url: '', error };
        }

        return { url: data.url, error: null };
    } catch (error) {
        logger.error('Unexpected error in getGoogleAuthUrl:', error);
        return { 
            url: '', 
            error: new AuthError('Failed to generate Google auth URL') 
        };
    }
};

/**
 * Exchanges an OAuth code for a session
 * This is used on your backend callback endpoint
 * Note: Supabase handles most of this flow automatically,
 * but this is useful if you need to perform custom handling
 */
export const handleOAuthCallback = async (
    code: string,
): Promise<{ session: Session | null; error: AuthError | null }> => {
    try {
        const supabase = getSupabaseClient();
        
        // Exchange code for session
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        
        if (error) {
            logger.error('Error exchanging OAuth code for session:', error);
            return { session: null, error };
        }
        
        return { session: data.session, error: null };
    } catch (error) {
        logger.error('Unexpected error in handleOAuthCallback:', error);
        return { 
            session: null, 
            error: error instanceof AuthError ? error : new AuthError('Failed to handle OAuth callback') 
        };
    }
}; 