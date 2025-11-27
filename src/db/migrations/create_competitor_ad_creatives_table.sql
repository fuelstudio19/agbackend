-- Create competitor_ad_creatives table with updated schema for Apify data
CREATE TABLE IF NOT EXISTS adgraam.competitor_ad_creatives (
    id SERIAL PRIMARY KEY,
    competitor_id UUID,
    run_id VARCHAR(255) NOT NULL,
    organisation_id UUID NOT NULL,
    ad_archive_id VARCHAR(255) UNIQUE NOT NULL,
    page_id VARCHAR(255) NOT NULL,
    page_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    page_profile_picture_url TEXT,
    title TEXT,
    body TEXT,
    link_url TEXT,
    caption TEXT,
    cta_text VARCHAR(100),
    display_format VARCHAR(50),
    
    -- Arrays for storing multiple image and video URLs from cards
    resized_image_urls TEXT[],
    original_image_urls TEXT[],
    video_hd_urls TEXT[],
    video_sd_urls TEXT[],
    
    -- Legacy single image/video fields for backward compatibility
    image_urls TEXT[],
    video_urls TEXT[],
    
    publisher_platforms TEXT[],
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    
    -- Store the full snapshot as JSONB for future reference
    raw_data JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Foreign key constraints
    CONSTRAINT competitor_ad_creatives_organisation_fkey 
        FOREIGN KEY (organisation_id) REFERENCES public.organisations(id),
    CONSTRAINT competitor_ad_creatives_competitor_fkey 
        FOREIGN KEY (competitor_id) REFERENCES adgraam.competitors(id)
) TABLESPACE pg_default;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_competitor_ad_creatives_run_id 
    ON adgraam.competitor_ad_creatives(run_id);
CREATE INDEX IF NOT EXISTS idx_competitor_ad_creatives_organisation_id 
    ON adgraam.competitor_ad_creatives(organisation_id);
CREATE INDEX IF NOT EXISTS idx_competitor_ad_creatives_page_id 
    ON adgraam.competitor_ad_creatives(page_id);
CREATE INDEX IF NOT EXISTS idx_competitor_ad_creatives_is_active 
    ON adgraam.competitor_ad_creatives(is_active);
CREATE INDEX IF NOT EXISTS idx_competitor_ad_creatives_created_at 
    ON adgraam.competitor_ad_creatives(created_at);
CREATE INDEX IF NOT EXISTS idx_competitor_ad_creatives_competitor_id 
    ON adgraam.competitor_ad_creatives(competitor_id);

-- Add GIN index for raw_data JSONB queries
CREATE INDEX IF NOT EXISTS idx_competitor_ad_creatives_raw_data 
    ON adgraam.competitor_ad_creatives USING GIN (raw_data);

-- Enable Row Level Security
ALTER TABLE adgraam.competitor_ad_creatives ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their organisation's competitor ad creatives" 
    ON adgraam.competitor_ad_creatives FOR SELECT 
    USING (organisation_id IN (
        SELECT organisation_id FROM public.user_organisations 
        WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can insert their organisation's competitor ad creatives" 
    ON adgraam.competitor_ad_creatives FOR INSERT 
    WITH CHECK (organisation_id IN (
        SELECT organisation_id FROM public.user_organisations 
        WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update their organisation's competitor ad creatives" 
    ON adgraam.competitor_ad_creatives FOR UPDATE 
    USING (organisation_id IN (
        SELECT organisation_id FROM public.user_organisations 
        WHERE user_id = auth.uid()
    ));

CREATE POLICY "Service role has full access to competitor ad creatives" 
    ON adgraam.competitor_ad_creatives FOR ALL TO service_role USING (true);

-- Add trigger for updating updated_at timestamp
CREATE TRIGGER update_competitor_ad_creatives_updated_at 
    BEFORE UPDATE ON adgraam.competitor_ad_creatives 
    FOR EACH ROW EXECUTE FUNCTION adgraam.update_updated_at_column(); 