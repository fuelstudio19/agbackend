import { PostgrestError } from '@supabase/supabase-js';
import { getSupabaseClient } from '../config/supabase';
import { Prompt } from '../types/prompt';
import { logger } from '../utils/logger';

const TABLE_NAME = 'prompts';
const SCHEMA_NAME = 'adgraam';

export class PromptRepository {
    async getPromptByName(name: string): Promise<{ result: Prompt | null, error: PostgrestError | null }> {
        const supabase = getSupabaseClient();
        logger.info(`[PromptRepository] Fetching prompt by name: ${name}`);
        
        try {
            const { data: record, error } = await supabase
                .schema(SCHEMA_NAME)
                .from(TABLE_NAME)
                .select('*')
                .eq('name', name)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No rows found
                    logger.warn(`[PromptRepository] Prompt not found: ${name}`);
                    return { result: null, error: null };
                }
                logger.error(`[PromptRepository] Error fetching prompt by name:`, error);
                return { result: null, error };
            }

            logger.info(`[PromptRepository] Successfully fetched prompt: ${name}`);
            return { result: record as Prompt, error: null };

        } catch (e) {
            logger.error(`[PromptRepository] Exception fetching prompt by name:`, e);
            return { result: null, error: e as PostgrestError };
        }
    }
} 