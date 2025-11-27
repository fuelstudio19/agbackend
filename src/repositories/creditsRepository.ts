import { getSupabaseClient } from '../config/supabase';
import { PostgrestError } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

const TABLE_NAME = 'credits';
const SCHEMA_NAME = 'public'; // Credits table is in public schema

export interface DbCredit {
    id?: string;
    organization_id: string;
    subscription_id?: string | null;
    credit_type: 'ad_creative' | 'competitor_slot';
    total_credits: number;
    used_credits: number;
    expires_at?: string | null;
    is_add_on?: boolean;
    metadata?: Record<string, any>;
    created_at?: string;
    updated_at?: string;
}

export interface CreateCreditRequest {
    organization_id: string;
    subscription_id?: string | null;
    credit_type: 'ad_creative' | 'competitor_slot';
    total_credits: number;
    used_credits?: number;
    expires_at?: string | null;
    is_add_on?: boolean;
    metadata?: Record<string, any>;
}

export class CreditsRepository {
    async createCredits(credits: CreateCreditRequest[]): Promise<{ result: DbCredit[] | null, error: PostgrestError | null }> {
        const supabase = getSupabaseClient();
        logger.info(`[CreditsRepository] Creating ${credits.length} credit entries`);
        
        try {
            const recordsToInsert = credits.map(credit => ({
                organization_id: credit.organization_id,
                subscription_id: credit.subscription_id || null,
                credit_type: credit.credit_type,
                total_credits: credit.total_credits,
                used_credits: credit.used_credits || 0,
                expires_at: credit.expires_at || null,
                is_add_on: credit.is_add_on || false,
                metadata: credit.metadata || {}
            }));

            const { data: records, error } = await supabase
                .schema(SCHEMA_NAME)
                .from(TABLE_NAME)
                .insert(recordsToInsert)
                .select();

            if (error) {
                logger.error(`[CreditsRepository] Error creating credits:`, error);
                return { result: null, error };
            }

            logger.info(`[CreditsRepository] Successfully created ${records.length} credit entries`);
            return { result: records as DbCredit[], error: null };

        } catch (e) {
            logger.error(`[CreditsRepository] Exception creating credits:`, e);
            return { result: null, error: e as PostgrestError };
        }
    }

    async getCreditsByOrganization(organizationId: string): Promise<{ result: DbCredit[] | null, error: PostgrestError | null }> {
        const supabase = getSupabaseClient();
        logger.info(`[CreditsRepository] Fetching credits for organization: ${organizationId}`);
        
        try {
            const { data: records, error } = await supabase
                .schema(SCHEMA_NAME)
                .from(TABLE_NAME)
                .select('*')
                .eq('organization_id', organizationId)
                .order('created_at', { ascending: true });

            if (error) {
                logger.error(`[CreditsRepository] Error fetching credits for organization ${organizationId}:`, error);
                return { result: null, error };
            }

            return { result: records as DbCredit[], error: null };

        } catch (e) {
            logger.error(`[CreditsRepository] Exception fetching credits:`, e);
            return { result: null, error: e as PostgrestError };
        }
    }

    async updateCreditsUsage(creditId: string, usedCredits: number): Promise<{ result: DbCredit | null, error: PostgrestError | null }> {
        const supabase = getSupabaseClient();
        logger.info(`[CreditsRepository] Updating credits usage for credit ${creditId}, used_credits: ${usedCredits}`);
        
        try {
            const { data: record, error } = await supabase
                .schema(SCHEMA_NAME)
                .from(TABLE_NAME)
                .update({ 
                    used_credits: usedCredits,
                    updated_at: new Date().toISOString()
                })
                .eq('id', creditId)
                .select()
                .single();

            if (error) {
                logger.error(`[CreditsRepository] Error updating credits usage:`, error);
                return { result: null, error };
            }

            logger.info(`[CreditsRepository] Successfully updated credits usage for credit ${creditId}`);
            return { result: record as DbCredit, error: null };

        } catch (e) {
            logger.error(`[CreditsRepository] Exception updating credits usage:`, e);
            return { result: null, error: e as PostgrestError };
        }
    }

    async getCreditsByTypeAndOrganization(
        organizationId: string, 
        creditType: 'ad_creative' | 'competitor_slot'
    ): Promise<{ result: DbCredit[] | null, error: PostgrestError | null }> {
        const supabase = getSupabaseClient();
        logger.info(`[CreditsRepository] Fetching ${creditType} credits for organization: ${organizationId}`);
        
        try {
            const { data: records, error } = await supabase
                .schema(SCHEMA_NAME)
                .from(TABLE_NAME)
                .select('*')
                .eq('organization_id', organizationId)
                .eq('credit_type', creditType)
                .order('created_at', { ascending: true });

            if (error) {
                logger.error(`[CreditsRepository] Error fetching ${creditType} credits for organization ${organizationId}:`, error);
                return { result: null, error };
            }

            return { result: records as DbCredit[], error: null };

        } catch (e) {
            logger.error(`[CreditsRepository] Exception fetching ${creditType} credits:`, e);
            return { result: null, error: e as PostgrestError };
        }
    }
} 