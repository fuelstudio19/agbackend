export type PlanTier = 'Free' | 'Starter' | 'Professional' | 'Enterprise';
export type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'INR';

export interface Organization {
    id: string;
    name: string;
    domain_url: string;
    meta_dashboard_url?: string;
    sector?: string;
    employee_count?: string;
    ad_spend_range?: string;
    plan_tier: PlanTier;
    created_at: string;
    current_plan_tier?: PlanTier;
    subscription_id?: string;
    credits_balance?: number;
    currency_preference?: Currency;
    billing_email?: string;
    tax_id?: string;
    billing_address?: Record<string, any>;
    description?: string;
    status?: string;
    onboarding_completed_at?: string;
    updated_at?: string;
    settings?: Record<string, any>;
}

export interface OrganizationUser {
    id: string;
    organization_id: string;
    user_id: string;
    role: string;
    joined_at: string;
    created_at: string;
    updated_at: string;
}

export interface CreateOrganizationRequest {
    name: string;
    domain_url: string;
    meta_dashboard_url?: string;
    sector?: string;
    employee_count?: string;
    description?: string;
} 