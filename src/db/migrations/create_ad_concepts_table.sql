-- Create ad_concepts table for storing generated advertising concepts
CREATE TABLE IF NOT EXISTS adgraam.ad_concepts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    organisation_id UUID NOT NULL,
    concept_json JSONB NOT NULL,
    user_image_urls TEXT[] DEFAULT '{}',
    competitor_image_urls TEXT[] DEFAULT '{}',
    model_used VARCHAR(100),
    processing_time_ms INTEGER,
    generation_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Foreign key constraints
    CONSTRAINT ad_concepts_user_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT ad_concepts_organisation_fkey 
        FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ad_concepts_user_id 
    ON adgraam.ad_concepts(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_concepts_organisation_id 
    ON adgraam.ad_concepts(organisation_id);
CREATE INDEX IF NOT EXISTS idx_ad_concepts_created_at 
    ON adgraam.ad_concepts(created_at);

-- Add GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_ad_concepts_concept_json 
    ON adgraam.ad_concepts USING gin(concept_json);
CREATE INDEX IF NOT EXISTS idx_ad_concepts_metadata 
    ON adgraam.ad_concepts USING gin(generation_metadata);

-- Enable RLS
ALTER TABLE adgraam.ad_concepts ENABLE ROW LEVEL SECURITY;

-- Create policies for ad_concepts
CREATE POLICY "Users can view their own ad concepts" ON adgraam.ad_concepts FOR
    SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ad concepts" ON adgraam.ad_concepts FOR
    INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ad concepts" ON adgraam.ad_concepts FOR
    UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ad concepts" ON adgraam.ad_concepts FOR 
    DELETE USING (auth.uid() = user_id);

-- Service role policy
CREATE POLICY "Service role has full access to ad concepts" ON adgraam.ad_concepts FOR 
    ALL TO service_role USING (true);

-- Add update_at trigger
CREATE TRIGGER update_ad_concepts_updated_at BEFORE
    UPDATE ON adgraam.ad_concepts FOR EACH ROW EXECUTE FUNCTION adgraam.update_updated_at_column();

-- Grant permissions
GRANT ALL ON TABLE adgraam.ad_concepts TO anon, authenticated, service_role; 