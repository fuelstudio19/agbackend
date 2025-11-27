import { CampaignInsightsResponse, AdInsightsResponse, BreakdownInsight } from "./graphApiTypes";

/**
 * Represents the structure of the 'accounts' table in the 'adgraam' schema.
 */
export interface DbAccount {
    id: string; // Primary key, using the Facebook 'act_...' format
    account_id: string; // The numerical part of the ID
    name: string;
    account_status?: number; // Corresponds to Facebook's account_status enum
    business_name?: string | null;
    currency?: string;
    timezone_name?: string;
    timezone_offset_hours_utc?: number; // UTC offset in hours
    business_country_code?: string; // Two-letter country code for the business
    amount_spent?: string; // Total amount spent in account currency
    min_campaign_group_spend_cap?: string; // Minimum campaign group spend cap
    organisation_id: string; // Assuming UUID, adjust if different
    created_at?: string; // ISO 8601 timestamp string
    updated_at?: string; // ISO 8601 timestamp string
    // Add other relevant fields fetched from the API
}

/**
 * Represents the structure of the 'campaigns' table in the 'adgraam' schema.
 */
export interface DbCampaign {
    id: string; // Primary key, Facebook campaign ID
    campaign_id: string; // Facebook campaign ID
    account_id: string; // Foreign key reference to DbAccount.id ('act_...')
    name: string;
    objective?: string | null;
    status?: string; // e.g., 'ACTIVE', 'PAUSED', 'ARCHIVED'
    effective_status?: string;
    buying_type?: string | null;
    daily_budget?: number | null; // Store as number, handle potential string conversion from API
    lifetime_budget?: number | null;
    start_time?: string | null; // ISO 8601 timestamp string
    stop_time?: string | null; // ISO 8601 timestamp string
    organisation_id: string; // Assuming UUID
    created_at?: string; // ISO 8601 timestamp string
    updated_at?: string; // ISO 8601 timestamp string
    insights?: CampaignInsightsResponse; // Added for basic campaign insights
    insights_date_start?: string; // Store the start date of the insights data
    insights_date_stop?: string; // Store the end date of the insights data
    // Add other relevant fields
}

/**
 * Represents the structure of the 'ad_sets' table in the 'adgraam' schema.
 */
export interface DbAdSet {
    id: string; // Primary key, Facebook ad set ID
    ad_set_id: string; // Facebook ad set ID
    account_id: string; // Foreign key reference to DbAccount.id ('act_...')
    campaign_id: string; // Foreign key reference to DbCampaign.id
    name: string;
    status?: string;
    effective_status?: string;
    daily_budget?: number | null;
    lifetime_budget?: number | null;
    start_time?: string | null;
    stop_time?: string | null;
    optimization_goal?: string | null;
    billing_event?: string | null;
    targeting?: Record<string, any> | null; // Store as JSONB in Supabase
    organisation_id: string; // Assuming UUID
    created_at?: string; // ISO 8601 timestamp string
    updated_at?: string; // ISO 8601 timestamp string
    // Add other relevant fields
}

/**
 * Represents the structure of the 'ads' table in the 'adgraam' schema.
 */
export interface DbAd {
    id: string; // Primary key, Facebook ad ID
    ad_id: string; // Facebook ad ID
    account_id: string; // Foreign key reference to DbAccount.id ('act_...')
    campaign_id: string; // Foreign key reference to DbCampaign.id
    ad_set_id: string; // Foreign key reference to DbAdSet.id
    name: string;
    status?: string;
    effective_status?: string;
    creative_id?: string | null; // Reference to ad creative (make explicitly optional/nullable)
    preview_shareable_link?: string | null; // URL to preview the ad
    tracking_data?: Record<string, any> | null; // Store tracking specifications as JSONB
    insights?: AdInsightsResponse; // Store basic ad insights
    insights_date_start?: string; // Store the start date of the insights data
    insights_date_stop?: string; // Store the end date of the insights data
    organisation_id: string; // Assuming UUID
    created_at?: string; // ISO 8601 timestamp string
    updated_at?: string; // ISO 8601 timestamp string
}

/**
 * Represents the structure of the 'creatives' table in the 'adgraam' schema.
 */
export interface DbCreative {
    id: string; // Primary key, Facebook creative ID
    creative_id: string; // Facebook creative ID
    account_id: string; // Foreign key reference to DbAccount.id ('act_...')
    name?: string;
    title?: string;
    body?: string;
    image_url?: string;
    video_url?: string;
    image_hash?: string;
    object_type?: string;
    thumbnail_url?: string;
    object_story_spec?: Record<string, any> | null; // Store as JSONB in Supabase
    asset_feed_spec?: Record<string, any> | null; // Store as JSONB in Supabase
    call_to_action_type?: string;
    organisation_id: string; // Assuming UUID
    created_at?: string; // ISO 8601 timestamp string
    updated_at?: string; // ISO 8601 timestamp string
}

/**
 * Represents the structure of the 'runner_scrapers' table in the 'adgraam' schema.
 */
export interface DbScrapper{
    run_id?:string,
    organistaion_id?:string
    competitor_url?:string,
    meta_ad_library_url?:string,
    ads_scraped?:number
    account_id?:string,
    completed_at?:string,
    created_at?:string,
    updated_at?:string
}

export interface DbBreakdownInsight {
    id: string; // Primary key, UUID
    ad_id: string; // Foreign key reference to ads table (original Facebook ad ID)
    category: string; // Breakdown category (e.g., 'audience', 'placement', 'geographic')
    subcategory: string; // Breakdown subcategory (e.g., 'age_gender', 'full_placement', 'region')
    breakdown_keys: string[]; // Array of breakdown dimension keys (e.g., ['age', 'gender'])
    insights_data: BreakdownInsight[]; // Array of processed breakdown insights
    date_start: string; // Start date of the insights data
    date_stop: string; // End date of the insights data
    organisation_id: string; // UUID reference to organisation
    created_at?: string; // ISO 8601 timestamp string
    updated_at?: string; // ISO 8601 timestamp string
}

export interface DbCompetitorProfile {
    id?: string;
    meta_ad_library_url: string;
    name: string;
    url: string;
    short_write_up?: string;
    logo?: string;
    organisation_id: string;
    created_at?: string;
    updated_at?: string;
}

/**
 * Represents the structure of the 'competitor_ad_creatives' table in the 'adgraam' schema.
 */
export interface DbCompetitor {
    id?: number;
    competitor_id?: string | null; // UUID
    run_id: string;
    organisation_id: string;
    ad_archive_id: string;
    page_id: string;
    page_name?: string;
    is_active?: boolean;
    page_profile_picture_url?: string;
    title?: string;
    body?: string;
    link_url?: string;
    caption?: string;
    cta_text?: string;
    display_format?: string;
    
    // New fields for handling multiple images/videos from cards
    resized_image_urls?: string[];
    original_image_urls?: string[];
    video_hd_urls?: string[];
    video_sd_urls?: string[];
    
    // Legacy fields for backward compatibility
    image_urls?: string[];
    video_urls?: string[];
    
    publisher_platforms?: string[];
    start_date?: string;
    end_date?: string;
    raw_data?: Record<string, any>;
    created_at?: string;
    updated_at?: string;
}

/**
 * Represents a subset of DbCompetitor fields for API responses
 * Excludes internal fields like id, competitor_id, run_id, raw_data, created_at, updated_at
 */
export interface DbCompetitorSummary {
    organisation_id: string;
    ad_archive_id: string;
    page_id: string;
    page_name?: string;
    is_active?: boolean;
    page_profile_picture_url?: string;
    title?: string;
    body?: string;
    link_url?: string;
    caption?: string;
    cta_text?: string;
    display_format?: string;
    resized_image_urls?: string[];
    competitor_id?: string | null;
    original_image_urls?: string[];
    video_hd_urls?: string[];
    video_sd_urls?: string[];
    image_urls?: string[];
    video_urls?: string[];
    publisher_platforms?: string[];
    start_date?: string;
    end_date?: string;
}

/**
 * Represents the structure of the 'self_ad_creatives' table in the 'adgraam' schema.
 */
export interface DbSelfAdCreative {
    id?: number;
    run_id: string;
    organisation_id: string;
    ad_archive_id: string;
    page_id: string;
    page_name?: string;
    is_active?: boolean;
    page_profile_picture_url?: string;
    title?: string;
    body?: string;
    link_url?: string;
    caption?: string;
    cta_text?: string;
    display_format?: string;
    
    // New fields for handling multiple images/videos from cards
    resized_image_urls?: string[];
    original_image_urls?: string[];
    video_hd_urls?: string[];
    video_sd_urls?: string[];
    
    // Legacy fields for backward compatibility
    image_urls?: string[];
    video_urls?: string[];
    
    publisher_platforms?: string[];
    start_date?: string;
    end_date?: string;
    raw_data?: Record<string, any>;
    created_at?: string;
    updated_at?: string;
}

/**
 * Represents a subset of DbSelfAdCreative fields for API responses
 * Excludes internal fields like id, run_id, raw_data, created_at, updated_at
 */
export interface DbSelfAdCreativeSummary {
    organisation_id: string;
    ad_archive_id: string;
    page_id: string;
    page_name?: string;
    is_active?: boolean;
    page_profile_picture_url?: string;
    title?: string;
    body?: string;
    link_url?: string;
    caption?: string;
    cta_text?: string;
    display_format?: string;
    resized_image_urls?: string[];
    original_image_urls?: string[];
    video_hd_urls?: string[];
    video_sd_urls?: string[];
    image_urls?: string[];
    video_urls?: string[];
    publisher_platforms?: string[];
    start_date?: string;
    end_date?: string;
}

/**
 * Represents the structure of the 'inspirations' table in the 'adgraam' schema.
 */
export interface DbInspiration {
    id?: number;
    external_id: number; // The id from the external API
    image_url: string;
    image_width?: number;
    image_height?: number;
    brand_name?: string;
    brand_id?: number;
    brand_business_model?: string;
    brand_industry?: string[];
    ad_performance?: string;
    ad_performance_id?: number;
    ad_platforms?: string[];
    ad_topics?: string[];
    ad_aspect_ratio?: string;
    ad_aspect_ratio_id?: number;
    template_url?: string;
    prompt_ready?: boolean;
    saved?: number;
    raw_data?: Record<string, any>; // Store the complete API response
    scraped_at?: string; // ISO 8601 timestamp string
    created_at?: string; // ISO 8601 timestamp string
    updated_at?: string; // ISO 8601 timestamp string
}

/**
 * Represents the structure of the 'ad_concepts' table in the 'adgraam' schema.
 */
export interface DbAdConcept {
    id?: string;
    user_id: string;
    organisation_id: string;
    concept_json: Record<string, any>; // JSON structure containing the generated concepts
    user_image_urls?: string[];
    competitor_image_urls?: string[];
    model_used?: string;
    processing_time_ms?: number;
    generation_metadata?: Record<string, any>;
    created_at?: string; // ISO 8601 timestamp string
    updated_at?: string; // ISO 8601 timestamp string
}

/**
 * Represents the API response structure from the external inspiration API
 */
export interface ExternalInspirationItem {
    id: number;
    created_at: number;
    brand_id: number;
    ad_performance_id: number;
    ad_platform_id: Array<Array<{ id: number; name: string }>>;
    ad_topic_id: Array<Array<{ id: number; name: string }>>;
    ad_aspect_ratio_id: number;
    template_url: string;
    prompt_ready: boolean;
    saved: number;
    image: {
        meta: {
            width: number;
            height: number;
        };
        url: string;
    };
    _ad_performance: {
        id: number;
        name: string;
    };
    _brand: {
        id: number;
        name: string;
        brand_business_model_id: number;
        brand_industry_id: Array<Array<{ id: number; name: string }>>;
        _brand_business_model: {
            id: number;
            name: string;
        };
    };
    _ad_aspect_ratio: {
        id: number;
        name: string;
    };
}

/**
 * Represents the API response structure from the external inspiration API
 */
export interface ExternalInspirationResponse {
    itemsReceived: number;
    curPage: number;
    nextPage: number | null;
    prevPage: number | null;
    offset: number;
    itemsTotal: number;
    pageTotal: number;
    items: ExternalInspirationItem[];
}

// You might also want types for Creative, Insights etc. if storing them 