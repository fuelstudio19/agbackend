-- Remove competitor_details column from onboarding_data table
-- Competitors are now stored in the separate 'competitors' table

ALTER TABLE adgraam.onboarding_data 
    DROP COLUMN IF EXISTS competitor_details; 