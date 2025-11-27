-- Remove company_name and company_size columns from onboarding_data table
ALTER TABLE adgraam.onboarding_data
    DROP COLUMN IF EXISTS company_name,
    DROP COLUMN IF EXISTS company_size;

-- Drop the index for company_name since it's no longer needed
DROP INDEX IF EXISTS adgraam.idx_onboarding_data_company_name; 