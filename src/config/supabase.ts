import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and Anon Key must be provided in .env file');
}

// The default schema is 'public'
const supabase = createClient(supabaseUrl, supabaseAnonKey);

logger.info('Supabase client initialized.');

// Export a function to get the initialized client instance
export const getSupabaseClient = (): SupabaseClient => {
    return supabase;
};

// For backward compatibility
export const initializeSupabase = (): SupabaseClient => {
    return supabase;
}; 