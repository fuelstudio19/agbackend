-- Create enums for the organizations table
CREATE TYPE public.plan_tier_enum AS ENUM ('Free', 'Starter', 'Professional', 'Enterprise');
CREATE TYPE public.currency_enum AS ENUM ('USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR');

-- Create organizations table
CREATE TABLE IF NOT EXISTS adgraam.organizations (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain_url TEXT NOT NULL,
    meta_dashboard_url TEXT NULL,
    sector TEXT NULL,
    employee_count TEXT NULL,
    ad_spend_range TEXT NULL,
    plan_tier public.plan_tier_enum NOT NULL DEFAULT 'Free'::plan_tier_enum,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    current_plan_tier public.plan_tier_enum NULL DEFAULT 'Free'::plan_tier_enum,
    subscription_id UUID NULL,
    credits_balance INTEGER NULL DEFAULT 0,
    currency_preference public.currency_enum NULL DEFAULT 'USD'::currency_enum,
    billing_email TEXT NULL,
    tax_id TEXT NULL,
    billing_address JSONB NULL,
    description TEXT NULL,
    status TEXT NULL DEFAULT 'active'::TEXT,
    onboarding_completed_at TIMESTAMP WITH TIME ZONE NULL,
    updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),
    settings JSONB NULL DEFAULT '{}'::JSONB,
    CONSTRAINT organizations_pkey PRIMARY KEY (id),
    CONSTRAINT organizations_domain_url_key UNIQUE (domain_url)
);

-- Create organization_users table
CREATE TABLE IF NOT EXISTS adgraam.organization_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT organization_users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES adgraam.organizations (id) ON DELETE CASCADE,
    CONSTRAINT organization_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
    CONSTRAINT organization_users_org_user_unique UNIQUE (organization_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_organizations_domain_url ON adgraam.organizations(domain_url);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON adgraam.organizations(status);
CREATE INDEX IF NOT EXISTS idx_organizations_plan_tier ON adgraam.organizations(plan_tier);
CREATE INDEX IF NOT EXISTS idx_organization_users_org_id ON adgraam.organization_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_users_user_id ON adgraam.organization_users(user_id);

-- Add update_at trigger for organizations
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON adgraam.organizations
FOR EACH ROW EXECUTE FUNCTION adgraam.update_updated_at_column();

-- Add update_at trigger for organization_users
CREATE TRIGGER update_organization_users_updated_at BEFORE UPDATE ON adgraam.organization_users
FOR EACH ROW EXECUTE FUNCTION adgraam.update_updated_at_column();

-- Enable RLS for organizations
ALTER TABLE adgraam.organizations ENABLE ROW LEVEL SECURITY;

-- RLS policies for organizations
CREATE POLICY "Users can view organizations they belong to" ON adgraam.organizations FOR SELECT
USING (id IN (
    SELECT organization_id FROM adgraam.organization_users WHERE user_id = auth.uid()
));

CREATE POLICY "Service role has full access to organizations" ON adgraam.organizations FOR ALL TO service_role USING (true);

-- Enable RLS for organization_users
ALTER TABLE adgraam.organization_users ENABLE ROW LEVEL SECURITY;

-- RLS policies for organization_users
CREATE POLICY "Users can view their own organization memberships" ON adgraam.organization_users FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert themselves into organizations" ON adgraam.organization_users FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role has full access to organization_users" ON adgraam.organization_users FOR ALL TO service_role USING (true);

-- Grant permissions
GRANT ALL ON TABLE adgraam.organizations TO anon, authenticated, service_role;
GRANT ALL ON TABLE adgraam.organization_users TO anon, authenticated, service_role; 