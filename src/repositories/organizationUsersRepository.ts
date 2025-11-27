import { PostgrestError } from '@supabase/supabase-js';
import { getSupabaseClient } from '../config/supabase';
import { OrganizationUser } from '../types/organization';
import { logger } from '../utils/logger';

const TABLE_NAME = 'organization_users';
const SCHEMA_NAME = 'adgraam';

export class OrganizationUsersRepository {
    async addUserToOrganization(organizationId: string, userId: string, role: string = 'member'): Promise<{ result: OrganizationUser | null, error: PostgrestError | null }> {
        const supabase = getSupabaseClient();
        logger.info(`[OrganizationUsersRepository] Adding user ${userId} to organization ${organizationId}`);
        
        try {
            const { data: record, error } = await supabase
                .schema(SCHEMA_NAME)
                .from(TABLE_NAME)
                .insert({
                    organization_id: organizationId,
                    user_id: userId,
                    role: role
                })
                .select()
                .single();

            if (error) {
                logger.error(`[OrganizationUsersRepository] Error adding user to organization:`, error);
                return { result: null, error };
            }

            logger.info(`[OrganizationUsersRepository] Successfully added user to organization`);
            return { result: record as OrganizationUser, error: null };

        } catch (e) {
            logger.error(`[OrganizationUsersRepository] Exception adding user to organization:`, e);
            return { result: null, error: e as PostgrestError };
        }
    }

    async getUserOrganizations(userId: string): Promise<{ result: OrganizationUser[] | null, error: PostgrestError | null }> {
        const supabase = getSupabaseClient();
        logger.info(`[OrganizationUsersRepository] Fetching organizations for user: ${userId}`);
        
        try {
            const { data: records, error } = await supabase
                .schema(SCHEMA_NAME)
                .from(TABLE_NAME)
                .select('*')
                .eq('user_id', userId);

            if (error) {
                logger.error(`[OrganizationUsersRepository] Error fetching user organizations:`, error);
                return { result: null, error };
            }

            return { result: records as OrganizationUser[], error: null };

        } catch (e) {
            logger.error(`[OrganizationUsersRepository] Exception fetching user organizations:`, e);
            return { result: null, error: e as PostgrestError };
        }
    }

    async getOrganizationUsers(organizationId: string): Promise<{ result: OrganizationUser[] | null, error: PostgrestError | null }> {
        const supabase = getSupabaseClient();
        logger.info(`[OrganizationUsersRepository] Fetching users for organization: ${organizationId}`);
        
        try {
            const { data: records, error } = await supabase
                .schema(SCHEMA_NAME)
                .from(TABLE_NAME)
                .select('*')
                .eq('organization_id', organizationId);

            if (error) {
                logger.error(`[OrganizationUsersRepository] Error fetching organization users:`, error);
                return { result: null, error };
            }

            return { result: records as OrganizationUser[], error: null };

        } catch (e) {
            logger.error(`[OrganizationUsersRepository] Exception fetching organization users:`, e);
            return { result: null, error: e as PostgrestError };
        }
    }

    async getUserOrganizationMembership(organizationId: string, userId: string): Promise<{ result: OrganizationUser | null, error: PostgrestError | null }> {
        const supabase = getSupabaseClient();
        logger.info(`[OrganizationUsersRepository] Fetching membership for user ${userId} in organization ${organizationId}`);
        
        try {
            const { data: record, error } = await supabase
                .schema(SCHEMA_NAME)
                .from(TABLE_NAME)
                .select('*')
                .eq('organization_id', organizationId)
                .eq('user_id', userId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return { result: null, error: null };
                }
                logger.error(`[OrganizationUsersRepository] Error fetching membership:`, error);
                return { result: null, error };
            }

            return { result: record as OrganizationUser, error: null };

        } catch (e) {
            logger.error(`[OrganizationUsersRepository] Exception fetching membership:`, e);
            return { result: null, error: e as PostgrestError };
        }
    }

    async updateUserRole(organizationId: string, userId: string, role: string): Promise<{ result: OrganizationUser | null, error: PostgrestError | null }> {
        const supabase = getSupabaseClient();
        logger.info(`[OrganizationUsersRepository] Updating role for user ${userId} in organization ${organizationId}`);
        
        try {
            const { data: record, error } = await supabase
                .schema(SCHEMA_NAME)
                .from(TABLE_NAME)
                .update({ role })
                .eq('organization_id', organizationId)
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                logger.error(`[OrganizationUsersRepository] Error updating user role:`, error);
                return { result: null, error };
            }

            return { result: record as OrganizationUser, error: null };

        } catch (e) {
            logger.error(`[OrganizationUsersRepository] Exception updating user role:`, e);
            return { result: null, error: e as PostgrestError };
        }
    }

    async removeUserFromOrganization(organizationId: string, userId: string): Promise<{ error: PostgrestError | null }> {
        const supabase = getSupabaseClient();
        logger.info(`[OrganizationUsersRepository] Removing user ${userId} from organization ${organizationId}`);
        
        try {
            const { error } = await supabase
                .schema(SCHEMA_NAME)
                .from(TABLE_NAME)
                .delete()
                .eq('organization_id', organizationId)
                .eq('user_id', userId);

            if (error) {
                logger.error(`[OrganizationUsersRepository] Error removing user from organization:`, error);
                return { error };
            }

            return { error: null };

        } catch (e) {
            logger.error(`[OrganizationUsersRepository] Exception removing user from organization:`, e);
            return { error: e as PostgrestError };
        }
    }
} 