import { getSupabaseClient } from '../config/supabase';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Script to insert the ad concepts generation prompt into the database
 */
async function insertAdConceptsPrompt() {
    try {
        logger.info('[InsertPrompt] Starting ad concepts prompt insertion...');

        // Read the prompt content from file
        const promptPath = path.join(__dirname, '../../prompts/ad_concepts_generation_prompt.txt');
        
        if (!fs.existsSync(promptPath)) {
            throw new Error(`Prompt file not found: ${promptPath}`);
        }

        const promptContent = fs.readFileSync(promptPath, 'utf-8');

        if (!promptContent.trim()) {
            throw new Error('Prompt content is empty');
        }

        logger.info(`[InsertPrompt] Read prompt content (${promptContent.length} characters)`);

        const supabase = getSupabaseClient();

        // Check if prompt already exists
        const { data: existing, error: checkError } = await supabase
            .schema('adgraam')
            .from('prompts')
            .select('id, name')
            .eq('name', 'ad_concepts_generation')
            .single();

        if (checkError && checkError.code !== 'PGRST116') {
            throw new Error(`Error checking existing prompt: ${checkError.message}`);
        }

        if (existing) {
            logger.info(`[InsertPrompt] Prompt 'ad_concepts_generation' already exists (ID: ${existing.id}). Updating...`);
            
            // Update existing prompt
            const { error: updateError } = await supabase
                .schema('adgraam')
                .from('prompts')
                .update({
                    prompt_content: promptContent,
                    description: 'Prompt for generating advertising concepts using AI multimodal analysis of user and competitor images',
                    updated_at: new Date().toISOString()
                })
                .eq('name', 'ad_concepts_generation');

            if (updateError) {
                throw new Error(`Error updating prompt: ${updateError.message}`);
            }

            logger.info('[InsertPrompt] ✅ Successfully updated ad concepts generation prompt');
        } else {
            logger.info('[InsertPrompt] Inserting new ad concepts generation prompt...');
            
            // Insert new prompt
            const { data: inserted, error: insertError } = await supabase
                .schema('adgraam')
                .from('prompts')
                .insert({
                    name: 'ad_concepts_generation',
                    prompt_content: promptContent,
                    description: 'Prompt for generating advertising concepts using AI multimodal analysis of user and competitor images'
                })
                .select()
                .single();

            if (insertError) {
                throw new Error(`Error inserting prompt: ${insertError.message}`);
            }

            logger.info(`[InsertPrompt] ✅ Successfully inserted ad concepts generation prompt (ID: ${inserted.id})`);
        }

        logger.info('[InsertPrompt] Ad concepts prompt insertion completed successfully');

    } catch (error) {
        logger.error('[InsertPrompt] ❌ Error inserting ad concepts prompt:', error);
        throw error;
    }
}

// Run the script if executed directly
if (require.main === module) {
    insertAdConceptsPrompt()
        .then(() => {
            logger.info('[InsertPrompt] Script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('[InsertPrompt] Script failed:', error);
            process.exit(1);
        });
}

export { insertAdConceptsPrompt }; 