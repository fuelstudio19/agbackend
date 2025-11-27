-- Create runner_scrapers table if it doesn't exist
CREATE TABLE IF NOT EXISTS adgraam.runner_scrapers (
    run_id TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    organisation_id UUID NOT NULL,
    competitor_url TEXT,
    meta_ad_library_url TEXT,
    ads_scraped INTEGER DEFAULT 0,
    account_id TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_runner_scrapers_user_id ON adgraam.runner_scrapers(user_id);
CREATE INDEX IF NOT EXISTS idx_runner_scrapers_org_id ON adgraam.runner_scrapers(organisation_id);
CREATE INDEX IF NOT EXISTS idx_runner_scrapers_competitor_url ON adgraam.runner_scrapers(competitor_url);
CREATE INDEX IF NOT EXISTS idx_runner_scrapers_run_id ON adgraam.runner_scrapers(run_id);

-- Add RLS policies
ALTER TABLE adgraam.runner_scrapers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scraper runs" ON adgraam.runner_scrapers FOR
SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scraper runs" ON adgraam.runner_scrapers FOR
INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scraper runs" ON adgraam.runner_scrapers FOR
UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scraper runs" ON adgraam.runner_scrapers FOR DELETE USING (auth.uid() = user_id);

-- Service role policy
CREATE POLICY "Service role has full access to runner scrapers" ON adgraam.runner_scrapers FOR ALL TO service_role USING (true);

-- Add update_at trigger
CREATE TRIGGER update_runner_scrapers_updated_at BEFORE
UPDATE ON adgraam.runner_scrapers FOR EACH ROW EXECUTE FUNCTION adgraam.update_updated_at_column(); 