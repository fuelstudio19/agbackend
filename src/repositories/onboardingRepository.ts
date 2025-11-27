import { PostgrestError } from '@supabase/supabase-js';
import { getSupabaseClient } from '../config/supabase';
import { OnboardingResponse } from '../types/onboarding';
import { logger } from '../utils/logger';

// Special guest user ID for guest onboarding
const GUEST_USER_ID = '00000000-0000-0000-0000-000000000001';

const TABLE_NAME = 'onboarding_data';
const SCHEMA_NAME = 'adgraam';

export class OnboardingRepository {
  private mapToResponse(record: any): OnboardingResponse {
    return {
      company_name: record.company_name,
      company_url: record.company_url,
      company_logo: record.company_logo,
      company_description: record.company_description || '',
      competitor_details: [],
      company_theme_color: record.company_theme_color || '',
      mainJob: record.mainJob || '',
      differentiation: record.differentiation || '',
      howItHelps: record.howItHelps || '',
      features: record.features || '',
      benefits: record.benefits || '',
    };
  }

  private mapToResponseWithOrgId(record: any): OnboardingResponse & { organizationId: string } {
    return {
      company_name: record.company_name,
      company_url: record.company_url,
      company_logo: record.company_logo,
      company_description: record.company_description || '',
      competitor_details: [],
      company_theme_color: record.company_theme_color || '',
      organizationId: record.organisation_id
    };
  }

  async createOnboarding(
    organisationId: string,
    data: Omit<OnboardingResponse, 'competitor_details'>,
    userId?: string
  ): Promise<{ result: OnboardingResponse | null, error: PostgrestError | null }> {
    const supabase = getSupabaseClient();
    logger.info(`[onboardingRepository] Adding onboarding for url user ${userId}}`)
    const now = new Date().toISOString();
    try {
      const { data: record, error } = await supabase
        .schema(SCHEMA_NAME)
        .from(TABLE_NAME)
        .insert({
          organisation_id: organisationId,
          company_url: data.company_url,
          company_logo: data.company_logo,
          company_name: data.company_name,
          company_theme_color: data.company_theme_color,
          company_description: data.company_description || '',
          // New Fields
          mainJob: data.mainJob || '',
          differentiation: data.differentiation || '',
          howItHelps: data.howItHelps || '',
          features: data.features || '',
          benefits: data.benefits || '',
          user_id: userId,
          created_at: now,
          updated_at: now
        })
        .select()
        .single();

      if (error) {
        return { result: null, error };
      }
      return { result: this.mapToResponse(record), error: null }

    } catch (e) {
      logger.error(`[onboardingRepository] Exception adding data:`, e);
      return { result: null, error: e as PostgrestError };
    }
  }

  async upsertOnboardingForGuest(
    organisationId: string,
    data: Omit<OnboardingResponse, 'competitor_details'>
  ): Promise<{ result: OnboardingResponse | null, error: PostgrestError | null }> {
    const supabase = getSupabaseClient();
    logger.info(`[onboardingRepository] Upserting onboarding for guest with org ${organisationId}`)
    const now = new Date().toISOString();
    try {
      const { data: record, error } = await supabase
        .schema(SCHEMA_NAME)
        .from(TABLE_NAME)
        .upsert({
          organisation_id: organisationId,
          company_url: data.company_url,
          company_logo: data.company_logo || '',
          company_name: data.company_name,
          company_theme_color: data.company_theme_color || '',
          company_description: data.company_description || '',
          created_at: now,
          updated_at: now
        }, {
          onConflict: 'organisation_id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) {
        return { result: null, error };
      }
      return { result: this.mapToResponse(record), error: null }

    } catch (e) {
      logger.error(`[onboardingRepository] Exception upserting guest data:`, e);
      return { result: null, error: e as PostgrestError };
    }
  }

  async getOnboardingById(id: string): Promise<OnboardingResponse | null> {
    const supabase = getSupabaseClient();
    const { data: record, error } = await supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .select()
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapToResponse(record);
  }

  async getOnboardingByOrganisationId(organisationId: string): Promise<OnboardingResponse | null> {
    const supabase = getSupabaseClient();
    const { data: record, error } = await supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .select()
      .eq('organisation_id', organisationId);

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapToResponse(record);
  }

  async getOnboardingByCompanyUrl(url: string): Promise<{ result: OnboardingResponse | null, error: PostgrestError | null }> {
    const supabase = getSupabaseClient();
    logger.info(`[onboardingRepository] Fetching onboarding for url set ${url}}`)
    try {
      const { data: record, error } = await supabase
        .schema(SCHEMA_NAME)
        .from(TABLE_NAME)
        .select('*')
        .eq('company_url', url);

      if (error) {
        logger.error(`[onboardingRepository] Error fetching onboarding for url  ${url}:`, error);
        return { result: null, error };
      }
      if (record && record.length > 0) {
        return { result: this.mapToResponse(record[0]), error: null };
      }
      return { result: null, error: null }
    } catch (e) {
      logger.error(`[onboardingRepository] Exception fetching url:`, e);
      return { result: null, error: e as PostgrestError };
    }

  }

  async updateOnboarding(id: string, data: Partial<OnboardingResponse>): Promise<OnboardingResponse> {
    const supabase = getSupabaseClient();
    const { data: record, error } = await supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .update({
        company_url: data.company_url,
        company_logo: data.company_logo,
        company_theme_color: data.company_theme_color
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToResponse(record);
  }

  async deleteOnboarding(id: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .schema(SCHEMA_NAME)
      .from(TABLE_NAME)
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getOnboardingWithOrgIdByCompanyUrl(url: string): Promise<{ result: (OnboardingResponse & { organizationId: string }) | null, error: PostgrestError | null }> {
    const supabase = getSupabaseClient();
    logger.info(`[onboardingRepository] Fetching onboarding with org ID for url ${url}`)
    try {
      const { data: record, error } = await supabase
        .schema(SCHEMA_NAME)
        .from(TABLE_NAME)
        .select('*')
        .eq('company_url', url);

      if (error) {
        logger.error(`[onboardingRepository] Error fetching onboarding for url ${url}:`, error);
        return { result: null, error };
      }
      if (record && record.length > 0) {
        return { result: this.mapToResponseWithOrgId(record[0]), error: null };
      }
      return { result: null, error: null }
    } catch (e) {
      logger.error(`[onboardingRepository] Exception fetching url:`, e);
      return { result: null, error: e as PostgrestError };
    }
  }
} 