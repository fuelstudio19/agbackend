-- Create adgraam schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS adgraam;
-- Grant necessary permissions to the service role
GRANT USAGE ON SCHEMA adgraam TO anon,
    authenticated,
    service_role;
-- Set the search path to include the adgraam schema
ALTER DATABASE postgres
SET search_path TO public,
    adgraam;
-- Ad Accounts Table
CREATE TABLE IF NOT EXISTS adgraam.ad_accounts (
    id TEXT PRIMARY KEY,
    -- Facebook format 'act_123456789'
    account_id TEXT,
    -- The numeric part of the ID without 'act_' prefix
    name TEXT NOT NULL,
    account_status INT,
    business_name TEXT,
    currency TEXT,
    timezone_name TEXT,
    user_id UUID NOT NULL,
    organisation_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Campaigns Table
CREATE TABLE IF NOT EXISTS adgraam.campaigns (
    id TEXT PRIMARY KEY,
    -- Facebook campaign ID
    campaign_id TEXT,
    -- Alternative ID format if needed
    account_id TEXT NOT NULL,
    -- Reference to ad_accounts.id
    name TEXT NOT NULL,
    objective TEXT,
    status TEXT,
    effective_status TEXT,
    buying_type TEXT,
    daily_budget TEXT,
    lifetime_budget TEXT,
    start_time TIMESTAMPTZ,
    stop_time TIMESTAMPTZ,
    user_id UUID NOT NULL,
    organisation_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (account_id) REFERENCES adgraam.ad_accounts(id) ON DELETE CASCADE
);
-- Ad Sets Table
CREATE TABLE IF NOT EXISTS adgraam.ad_sets (
    id TEXT PRIMARY KEY,
    -- Facebook ad set ID
    ad_set_id TEXT,
    -- Alternative ID format if needed
    account_id TEXT NOT NULL,
    -- Reference to ad_accounts.id
    campaign_id TEXT NOT NULL,
    -- Reference to campaigns.id
    name TEXT NOT NULL,
    status TEXT,
    effective_status TEXT,
    daily_budget TEXT,
    lifetime_budget TEXT,
    start_time TIMESTAMPTZ,
    stop_time TIMESTAMPTZ,
    optimization_goal TEXT,
    billing_event TEXT,
    targeting JSONB,
    user_id UUID NOT NULL,
    organisation_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (account_id) REFERENCES adgraam.ad_accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES adgraam.campaigns(id) ON DELETE CASCADE
);
-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_ad_accounts_user_org ON adgraam.ad_accounts(user_id, organisation_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_org ON adgraam.campaigns(user_id, organisation_id);
CREATE INDEX IF NOT EXISTS idx_ad_sets_user_org ON adgraam.ad_sets(user_id, organisation_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_account ON adgraam.campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_ad_sets_campaign ON adgraam.ad_sets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_sets_account ON adgraam.ad_sets(account_id);
-- Add update_at trigger function
CREATE OR REPLACE FUNCTION adgraam.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Create triggers to automatically update updated_at
CREATE TRIGGER update_ad_accounts_updated_at BEFORE
UPDATE ON adgraam.ad_accounts FOR EACH ROW EXECUTE FUNCTION adgraam.update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE
UPDATE ON adgraam.campaigns FOR EACH ROW EXECUTE FUNCTION adgraam.update_updated_at_column();
CREATE TRIGGER update_ad_sets_updated_at BEFORE
UPDATE ON adgraam.ad_sets FOR EACH ROW EXECUTE FUNCTION adgraam.update_updated_at_column();
-- Grant permissions on all tables in adgraam schema
GRANT ALL ON ALL TABLES IN SCHEMA adgraam TO anon,
    authenticated,
    service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA adgraam TO anon,
    authenticated,
    service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA adgraam TO anon,
    authenticated,
    service_role;
-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA adgraam
GRANT ALL ON TABLES TO anon,
    authenticated,
    service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA adgraam
GRANT ALL ON SEQUENCES TO anon,
    authenticated,
    service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA adgraam
GRANT ALL ON ROUTINES TO anon,
    authenticated,
    service_role;
-- Add row level security policies
ALTER TABLE adgraam.ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE adgraam.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE adgraam.ad_sets ENABLE ROW LEVEL SECURITY;
-- Create policies for ad_accounts
CREATE POLICY "Users can view their own ad accounts" ON adgraam.ad_accounts FOR
SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own ad accounts" ON adgraam.ad_accounts FOR
INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own ad accounts" ON adgraam.ad_accounts FOR
UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own ad accounts" ON adgraam.ad_accounts FOR DELETE USING (auth.uid() = user_id);
-- Create policies for campaigns
CREATE POLICY "Users can view their own campaigns" ON adgraam.campaigns FOR
SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own campaigns" ON adgraam.campaigns FOR
INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own campaigns" ON adgraam.campaigns FOR
UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own campaigns" ON adgraam.campaigns FOR DELETE USING (auth.uid() = user_id);
-- Create policies for ad_sets
CREATE POLICY "Users can view their own ad sets" ON adgraam.ad_sets FOR
SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own ad sets" ON adgraam.ad_sets FOR
INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own ad sets" ON adgraam.ad_sets FOR
UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own ad sets" ON adgraam.ad_sets FOR DELETE USING (auth.uid() = user_id);
-- Bypass RLS for service role
ALTER TABLE adgraam.ad_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE adgraam.campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE adgraam.ad_sets FORCE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to ad accounts" ON adgraam.ad_accounts FOR ALL TO service_role USING (true);
CREATE POLICY "Service role has full access to campaigns" ON adgraam.campaigns FOR ALL TO service_role USING (true);
CREATE POLICY "Service role has full access to ad sets" ON adgraam.ad_sets FOR ALL TO service_role USING (true);
-- Schema for the adgraam.ads table
CREATE TABLE IF NOT EXISTS adgraam.ads (
    id TEXT PRIMARY KEY,
    ad_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    campaign_id TEXT NOT NULL,
    ad_set_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT,
    effective_status TEXT,
    creative_id TEXT,
    preview_shareable_link TEXT,
    tracking_data JSONB,
    user_id UUID NOT NULL,
    organisation_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    FOREIGN KEY (account_id) REFERENCES adgraam.ad_accounts(id),
    FOREIGN KEY (campaign_id) REFERENCES adgraam.campaigns(id),
    FOREIGN KEY (ad_set_id) REFERENCES adgraam.ad_sets(id),
    FOREIGN KEY (user_id) REFERENCES auth.users(id),
    FOREIGN KEY (organisation_id) REFERENCES public.organisations(id)
);
-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ads_account_id ON adgraam.ads(account_id);
CREATE INDEX IF NOT EXISTS idx_ads_campaign_id ON adgraam.ads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ads_ad_set_id ON adgraam.ads(ad_set_id);
CREATE INDEX IF NOT EXISTS idx_ads_user_id ON adgraam.ads(user_id);
CREATE INDEX IF NOT EXISTS idx_ads_org_id ON adgraam.ads(organisation_id);
-- Schema for the adgraam.creatives table
CREATE TABLE IF NOT EXISTS adgraam.creatives (
    id TEXT PRIMARY KEY,
    creative_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    name TEXT,
    title TEXT,
    body TEXT,
    image_url TEXT,
    video_url TEXT,
    image_hash TEXT,
    object_type TEXT,
    thumbnail_url TEXT,
    object_story_spec JSONB,
    asset_feed_spec JSONB,
    call_to_action_type TEXT,
    user_id UUID NOT NULL,
    organisation_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    FOREIGN KEY (account_id) REFERENCES adgraam.ad_accounts(id),
    FOREIGN KEY (user_id) REFERENCES auth.users(id),
    FOREIGN KEY (organisation_id) REFERENCES public.organisations(id)
);
-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_creatives_account_id ON adgraam.creatives(account_id);
CREATE INDEX IF NOT EXISTS idx_creatives_user_id ON adgraam.creatives(user_id);
CREATE INDEX IF NOT EXISTS idx_creatives_org_id ON adgraam.creatives(organisation_id);
CREATE INDEX IF NOT EXISTS idx_creatives_org_id ON adgraam.creatives(organisation_id);
-- Schema for the adgraam.breakdown_insights table
CREATE TABLE IF NOT EXISTS adgraam.breakdown_insights (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    ad_id TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT NOT NULL,
    breakdown_keys TEXT [] NOT NULL,
    insights_data JSONB NOT NULL,
    date_start DATE NOT NULL,
    date_stop DATE NOT NULL,
    user_id UUID NOT NULL,
    organisation_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    FOREIGN KEY (user_id) REFERENCES auth.users(id),
    FOREIGN KEY (organisation_id) REFERENCES public.organisations(id)
);
-- Add indexes for better query performance (breakdown_insights)
CREATE INDEX IF NOT EXISTS idx_breakdown_insights_ad_id ON adgraam.breakdown_insights(ad_id);
CREATE INDEX IF NOT EXISTS idx_breakdown_insights_category ON adgraam.breakdown_insights(category);
CREATE INDEX IF NOT EXISTS idx_breakdown_insights_subcategory ON adgraam.breakdown_insights(subcategory);
CREATE INDEX IF NOT EXISTS idx_breakdown_insights_user_id ON adgraam.breakdown_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_breakdown_insights_org_id ON adgraam.breakdown_insights(organisation_id);
CREATE INDEX IF NOT EXISTS idx_breakdown_insights_date_range ON adgraam.breakdown_insights(date_start, date_stop);
CREATE INDEX IF NOT EXISTS idx_breakdown_insights_category_subcategory ON adgraam.breakdown_insights(category, subcategory);
-- Add a composite unique constraint to prevent duplicate breakdown insights
CREATE UNIQUE INDEX IF NOT EXISTS idx_breakdown_insights_unique ON adgraam.breakdown_insights(
    ad_id,
    category,
    subcategory,
    date_start,
    date_stop
);
-- Schema for the adgraam.onboarding_data table
CREATE TABLE IF NOT EXISTS adgraam.onboarding_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_url TEXT NOT NULL,
    company_logo TEXT,
    company_theme_color TEXT,
    product_details JSONB NOT NULL DEFAULT '[]'::jsonb,
    competitor_details JSONB NOT NULL DEFAULT '[]'::jsonb,
    user_id UUID NOT NULL,
    organisation_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    FOREIGN KEY (user_id) REFERENCES auth.users(id),
    FOREIGN KEY (organisation_id) REFERENCES public.organisations(id)
);
-- Add indexes for better query performance (onboarding_data)
CREATE INDEX IF NOT EXISTS idx_onboarding_data_user_id ON adgraam.onboarding_data(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_data_org_id ON adgraam.onboarding_data(organisation_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_data_company_url ON adgraam.onboarding_data(company_url);
-- Add RLS policies for onboarding_data
ALTER TABLE adgraam.onboarding_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own onboarding data" ON adgraam.onboarding_data FOR
SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own onboarding data" ON adgraam.onboarding_data FOR
INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own onboarding data" ON adgraam.onboarding_data FOR
UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own onboarding data" ON adgraam.onboarding_data FOR DELETE USING (auth.uid() = user_id);
-- Service role policy for onboarding_data
CREATE POLICY "Service role has full access to onboarding data" ON adgraam.onboarding_data FOR ALL TO service_role USING (true);
-- Add update_at trigger for onboarding_data
CREATE TRIGGER update_onboarding_data_updated_at BEFORE
UPDATE ON adgraam.onboarding_data FOR EACH ROW EXECUTE FUNCTION adgraam.update_updated_at_column();
-- Grant permissions
GRANT ALL ON TABLE adgraam.onboarding_data TO anon,
    authenticated,
    service_role;
