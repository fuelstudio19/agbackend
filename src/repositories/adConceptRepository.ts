import { PostgrestError } from '@supabase/supabase-js';
import { getSupabaseClient } from '../config/supabase';
import { DbAdConcept, ListAdConceptsRequest } from '../types/adConceptTypes';
import { logger } from '../utils/logger';

const TABLE_NAME = 'ad_concepts';
const SCHEMA_NAME = 'adgraam';

export class AdConceptRepository {
    /**
     * Create a new ad concept record
     */
    async createAdConcept(adConcept: Omit<DbAdConcept, 'id' | 'created_at' | 'updated_at'>): Promise<{
        data: DbAdConcept | null;
        error: PostgrestError | null;
    }> {
        const supabase = getSupabaseClient();
        logger.info(`[AdConceptRepository] Creating ad concept for org: ${adConcept.organisation_id}`);
        
        try {
            const { data, error } = await supabase
                .schema(SCHEMA_NAME)
                .from(TABLE_NAME)
                .insert(adConcept)
                .select()
                .single();

            if (error) {
                logger.error(`[AdConceptRepository] Error creating ad concept:`, error);
                return { data: null, error };
            }

            logger.info(`[AdConceptRepository] Successfully created ad concept with ID: ${data.id}`);
            return { data: data as DbAdConcept, error: null };

        } catch (e) {
            logger.error(`[AdConceptRepository] Exception creating ad concept:`, e);
            return { data: null, error: e as PostgrestError };
        }
    }

    /**
     * Get ad concepts by user and organisation with pagination
     */
    async getAdConceptsByOrganisation(
        organisationId: string,
        options: ListAdConceptsRequest = {}
    ): Promise<{
        data: DbAdConcept[] | null;
        error: PostgrestError | null;
        count: number | null;
    }> {
        const supabase = getSupabaseClient();
        const { page = 1, limit = 10, sortBy = 'created_at', sortOrder = 'desc' } = options;
        
        logger.info(`[AdConceptRepository] Fetching ad concepts for org: ${organisationId}, page: ${page}, limit: ${limit}`);
        
        try {
            const from = (page - 1) * limit;
            const to = from + limit - 1;

            const { data, error, count } = await supabase
                .schema(SCHEMA_NAME)
                .from(TABLE_NAME)
                .select('*', { count: 'exact' })
                .eq('organisation_id', organisationId)
                .order(sortBy, { ascending: sortOrder === 'asc' })
                .range(from, to);

            if (error) {
                logger.error(`[AdConceptRepository] Error fetching ad concepts:`, error);
                return { data: null, error, count: null };
            }

            logger.info(`[AdConceptRepository] Successfully fetched ${data?.length || 0} ad concepts (total: ${count})`);
            return { data: data as DbAdConcept[], error: null, count };

        } catch (e) {
            logger.error(`[AdConceptRepository] Exception fetching ad concepts:`, e);
            return { data: null, error: e as PostgrestError, count: null };
        }
    }

    /**
     * Get ad concept by ID
     */
    async getAdConceptById(
        conceptId: string,
        userId: string,
        organisationId: string
    ): Promise<{
        data: DbAdConcept | null;
        error: PostgrestError | null;
    }> {
        const supabase = getSupabaseClient();
        logger.info(`[AdConceptRepository] Fetching ad concept: ${conceptId} for user: ${userId}, org: ${organisationId}`);
        
        try {
            const { data, error } = await supabase
                .schema(SCHEMA_NAME)
                .from(TABLE_NAME)
                .select('*')
                .eq('id', conceptId)
                .eq('user_id', userId)
                .eq('organisation_id', organisationId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No rows found
                    logger.warn(`[AdConceptRepository] Ad concept not found: ${conceptId}`);
                    return { data: null, error: null };
                }
                logger.error(`[AdConceptRepository] Error fetching ad concept:`, error);
                return { data: null, error };
            }

            logger.info(`[AdConceptRepository] Successfully fetched ad concept: ${conceptId}`);
            return { data: data as DbAdConcept, error: null };

        } catch (e) {
            logger.error(`[AdConceptRepository] Exception fetching ad concept:`, e);
            return { data: null, error: e as PostgrestError };
        }
    }

    /**
     * Update ad concept
     */
    async updateAdConcept(
        conceptId: string,
        userId: string,
        organisationId: string,
        updates: Partial<Omit<DbAdConcept, 'id' | 'user_id' | 'organisation_id' | 'created_at' | 'updated_at'>>
    ): Promise<{
        data: DbAdConcept | null;
        error: PostgrestError | null;
    }> {
        const supabase = getSupabaseClient();
        logger.info(`[AdConceptRepository] Updating ad concept: ${conceptId} for user: ${userId}, org: ${organisationId}`);
        
        try {
            const { data, error } = await supabase
                .schema(SCHEMA_NAME)
                .from(TABLE_NAME)
                .update(updates)
                .eq('id', conceptId)
                .eq('user_id', userId)
                .eq('organisation_id', organisationId)
                .select()
                .single();

            if (error) {
                logger.error(`[AdConceptRepository] Error updating ad concept:`, error);
                return { data: null, error };
            }

            logger.info(`[AdConceptRepository] Successfully updated ad concept: ${conceptId}`);
            return { data: data as DbAdConcept, error: null };

        } catch (e) {
            logger.error(`[AdConceptRepository] Exception updating ad concept:`, e);
            return { data: null, error: e as PostgrestError };
        }
    }

    /**
     * Delete ad concept
     */
    async deleteAdConcept(
        conceptId: string,
        userId: string,
        organisationId: string
    ): Promise<{
        success: boolean;
        error: PostgrestError | null;
    }> {
        const supabase = getSupabaseClient();
        logger.info(`[AdConceptRepository] Deleting ad concept: ${conceptId} for user: ${userId}, org: ${organisationId}`);
        
        try {
            const { error } = await supabase
                .schema(SCHEMA_NAME)
                .from(TABLE_NAME)
                .delete()
                .eq('id', conceptId)
                .eq('user_id', userId)
                .eq('organisation_id', organisationId);

            if (error) {
                logger.error(`[AdConceptRepository] Error deleting ad concept:`, error);
                return { success: false, error };
            }

            logger.info(`[AdConceptRepository] Successfully deleted ad concept: ${conceptId}`);
            return { success: true, error: null };

        } catch (e) {
            logger.error(`[AdConceptRepository] Exception deleting ad concept:`, e);
            return { success: false, error: e as PostgrestError };
        }
    }

    /**
     * Get concept count by organisation
     */
    async getConceptCountByOrganisation(
        organisationId: string
    ): Promise<{
        count: number;
        error: PostgrestError | null;
    }> {
        const supabase = getSupabaseClient();
        logger.info(`[AdConceptRepository] Getting concept count for org: ${organisationId}`);
        
        try {
            const { count, error } = await supabase
                .schema(SCHEMA_NAME)
                .from(TABLE_NAME)
                .select('*', { count: 'exact', head: true })
                .eq('organisation_id', organisationId);

            if (error) {
                logger.error(`[AdConceptRepository] Error getting concept count:`, error);
                return { count: 0, error };
            }

            logger.info(`[AdConceptRepository] Successfully got concept count: ${count} for org: ${organisationId}`);
            return { count: count || 0, error: null };

        } catch (e) {
            logger.error(`[AdConceptRepository] Exception getting concept count:`, e);
            return { count: 0, error: e as PostgrestError };
        }
    }
} 