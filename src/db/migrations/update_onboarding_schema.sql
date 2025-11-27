-- Drop existing columns
ALTER TABLE adgraam.onboarding_data
    DROP COLUMN IF EXISTS domain,
    DROP COLUMN IF EXISTS description,
    DROP COLUMN IF EXISTS theme_colors,
    DROP COLUMN IF EXISTS other_color_palette,
    DROP COLUMN IF EXISTS meta_ad_library_url,
    DROP COLUMN IF EXISTS products,
    DROP COLUMN IF EXISTS competitors;

-- Add new columns
ALTER TABLE adgraam.onboarding_data
    ADD COLUMN IF NOT EXISTS company_name TEXT,
    ADD COLUMN IF NOT EXISTS company_url TEXT,
    ADD COLUMN IF NOT EXISTS company_logo TEXT,
    ADD COLUMN IF NOT EXISTS product_details JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS competitor_details JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS company_theme_color TEXT;

-- Update indexes
DROP INDEX IF EXISTS adgraam.idx_onboarding_data_domain;
CREATE INDEX IF NOT EXISTS idx_onboarding_data_company_url ON adgraam.onboarding_data(company_url); 