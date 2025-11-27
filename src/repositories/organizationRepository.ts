import { PostgrestError } from '@supabase/supabase-js';
import { getSupabaseClient } from '../config/supabase';
import { Organization, CreateOrganizationRequest } from '../types/organization';
import { logger } from '../utils/logger';

const TABLE_NAME = 'organizations';
const SCHEMA_NAME = 'adgraam';

export class OrganizationRepository {
    async createOrganization(data: CreateOrganizationRequest): Promise<{ result: Organization | null, error: PostgrestError | null }> {
        const supabase = getSupabaseClient();
        logger.info(`[OrganizationRepository] Creating organization for domain: ${data.domain_url}`);
        
        try {
            const { data: record, error } = await supabase
                .schema(SCHEMA_NAME)
                .from(TABLE_NAME)
                .insert({
                    name: data.name,
                    domain_url: data.domain_url,
                    meta_dashboard_url: data.meta_dashboard_url,
                    sector: data.sector,
                    employee_count: data.employee_count,
                    description: data.description,
                    plan_tier: 'Free',
                    status: 'active',
                    credits_balance: 0,
                    currency_preference: 'USD',
                    settings: {}
                })
                .select()
                .single();

            if (error) {
                logger.error(`[OrganizationRepository] Error creating organization:`, error);
                return { result: null, error };
            }

            logger.info(`[OrganizationRepository] Successfully created organization with id: ${record.id}`);
            return { result: record as Organization, error: null };

        } catch (e) {
            logger.error(`[OrganizationRepository] Exception creating organization:`, e);
            return { result: null, error: e as PostgrestError };
        }
    }

    async getOrganizationByDomain(domain_url: string): Promise<{ result: Organization | null, error: PostgrestError | null }> {
        const supabase = getSupabaseClient();
        logger.info(`[OrganizationRepository] Fetching organization by domain: ${domain_url}`);
        
        try {
            const { data: record, error } = await supabase
                .schema(SCHEMA_NAME)
                .from(TABLE_NAME)
                .select('*')
                .eq('domain_url', domain_url)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No rows found
                    return { result: null, error: null };
                }
                logger.error(`[OrganizationRepository] Error fetching organization by domain:`, error);
                return { result: null, error };
            }

            return { result: record as Organization, error: null };

        } catch (e) {
            logger.error(`[OrganizationRepository] Exception fetching organization by domain:`, e);
            return { result: null, error: e as PostgrestError };
        }
    }

    async getOrganizationById(id: string): Promise<{ result: Organization | null, error: PostgrestError | null }> {
        const supabase = getSupabaseClient();
        logger.info(`[OrganizationRepository] Fetching organization by id: ${id}`);
        
        try {
            const { data: record, error } = await supabase
                .schema(SCHEMA_NAME)
                .from(TABLE_NAME)
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return { result: null, error: null };
                }
                logger.error(`[OrganizationRepository] Error fetching organization by id:`, error);
                return { result: null, error };
            }

            return { result: record as Organization, error: null };

        } catch (e) {
            logger.error(`[OrganizationRepository] Exception fetching organization by id:`, e);
            return { result: null, error: e as PostgrestError };
        }
    }

    async updateOrganization(id: string, data: Partial<Organization>): Promise<{ result: Organization | null, error: PostgrestError | null }> {
        const supabase = getSupabaseClient();
        logger.info(`[OrganizationRepository] Updating organization: ${id}`);
        
        try {
            const { data: record, error } = await supabase
                .schema(SCHEMA_NAME)
                .from(TABLE_NAME)
                .update(data)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                logger.error(`[OrganizationRepository] Error updating organization:`, error);
                return { result: null, error };
            }

            return { result: record as Organization, error: null };

        } catch (e) {
            logger.error(`[OrganizationRepository] Exception updating organization:`, e);
            return { result: null, error: e as PostgrestError };
        }
    }

    async deleteOrganization(id: string): Promise<{ error: PostgrestError | null }> {
        const supabase = getSupabaseClient();
        logger.info(`[OrganizationRepository] Deleting organization: ${id}`);
        
        try {
            const { error } = await supabase
                .schema(SCHEMA_NAME)
                .from(TABLE_NAME)
                .delete()
                .eq('id', id);

            if (error) {
                logger.error(`[OrganizationRepository] Error deleting organization:`, error);
                return { error };
            }

            return { error: null };

        } catch (e) {
            logger.error(`[OrganizationRepository] Exception deleting organization:`, e);
            return { error: e as PostgrestError };
        }
    }
} 