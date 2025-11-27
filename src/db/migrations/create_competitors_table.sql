-- Create competitors table
CREATE TABLE IF NOT EXISTS adgraam.competitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meta_ad_library_url TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    short_write_up TEXT,
    logo TEXT,
    user_id UUID NOT NULL,
    organisation_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    FOREIGN KEY (user_id) REFERENCES auth.users(id),
    FOREIGN KEY (organisation_id) REFERENCES public.organisations(id)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_competitors_user_id ON adgraam.competitors(user_id);
CREATE INDEX IF NOT EXISTS idx_competitors_org_id ON adgraam.competitors(organisation_id);
CREATE INDEX IF NOT EXISTS idx_competitors_url ON adgraam.competitors(url);
CREATE INDEX IF NOT EXISTS idx_competitors_name ON adgraam.competitors(name);

-- Add unique constraint to prevent duplicate competitors per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_competitors_unique_url_org ON adgraam.competitors(url, organisation_id);

-- Add RLS policies
ALTER TABLE adgraam.competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own competitors" ON adgraam.competitors FOR
SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own competitors" ON adgraam.competitors FOR
INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own competitors" ON adgraam.competitors FOR
UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own competitors" ON adgraam.competitors FOR DELETE USING (auth.uid() = user_id);

-- Service role policy
CREATE POLICY "Service role has full access to competitors" ON adgraam.competitors FOR ALL TO service_role USING (true);

-- Add update_at trigger
CREATE TRIGGER update_competitors_updated_at BEFORE
UPDATE ON adgraam.competitors FOR EACH ROW EXECUTE FUNCTION adgraam.update_updated_at_column(); 