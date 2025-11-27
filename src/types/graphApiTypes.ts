// src/types/graphApiTypes.ts
export interface FacebookPaging {
  cursors?: {
    before?: string;
    after?: string;
  };
  next?: string;
  previous?: string;
}

export interface FacebookApiResponse<T> {
  data: T[];
  paging?: FacebookPaging;
  summary?: any; // Depending on the endpoint, a summary might be included
  error?: any; // Representing Facebook API error structure
}

// Basic structure, can be expanded with more fields as needed
export interface AdAccount {
  id: string; // The Ad Account ID (prefixed with 'act_')
  account_id: string; // The numeric Ad Account ID
  name?: string;
  currency?: string;
  timezone_name?: string;
  timezone_offset_hours_utc?: number;
  business_country_code?: string;
  amount_spent?: string; // Often returned as string
  min_campaign_group_spend_cap?: string; // Often returned as string
  // Add other relevant fields
}

export interface Campaign {
  id: string;
  account_id: string; // Need this for context
  name?: string;
  status?: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED' | 'IN_PROCESS' | 'WITH_ISSUES';
  effective_status?: string; // More detailed status
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string; // ISO 8601 date string
  stop_time?: string; // ISO 8601 date string
  insights?: CampaignInsightsResponse; // Updated type for basic campaign insights
  insights_date_start?: string; // Start date for insights data
  insights_date_stop?: string; // End date for insights data
  // Add other relevant fields
}

// Renamed from BasicCampaignInsights and added date fields
export interface CampaignInsightData {
  cpc?: string;
  ctr?: string;
  impressions?: string;
  date_start?: string; // Added
  date_stop?: string;  // Added
  // Add any other basic insights you might need
}

// New interface for the structure of the 'insights' field
export interface CampaignInsightsResponse {
  data: CampaignInsightData[];
  paging?: FacebookPaging;
}

export interface AdSetTargeting {
  // Define structure based on Graph API documentation for targeting
  // Example:
  geo_locations?: { countries?: string[] };
  age_min?: number;
  age_max?: number;
  // ... other targeting fields
}

export interface AdSet {
  id: string;
  account_id: string; // Need this for context
  campaign_id: string;
  name?: string;
  status?: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED' | 'IN_PROCESS' | 'WITH_ISSUES';
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  optimization_goal?: string;
  billing_event?: string;
  bid_amount?: number; // Often returned as number or string
  start_time?: string; // ISO 8601 date string
  end_time?: string; // ISO 8601 date string
  targeting?: AdSetTargeting;
  // Add other relevant fields
}

export interface Ad {
  id: string;
  account_id: string; // Need this for context
  campaign_id: string;
  adset_id: string;
  name?: string;
  status?: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED' | 'IN_PROCESS' | 'WITH_ISSUES';
  effective_status?: string;
  bid_type?: string; // e.g., 'CPC', 'CPM'
  created_time?: string; // ISO 8601 date string
  updated_time?: string; // ISO 8601 date string
  // Add nested creative object if requested with creative{id}
  creative?: {
      id: string;
  };
  // Add creative details object to store full creative information
  creative_details?: AdCreative | null;
  // Add insights field for basic ad metrics
  insights?: AdInsightsResponse;
  insights_date_start?: string;
  insights_date_stop?: string;
  // Add other relevant fields like tracking_specs etc.
}

// Basic ad insight data - similar to CampaignInsightData
export interface AdInsightData {
  cpc?: string;
  ctr?: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  reach?: string;
  date_start?: string;
  date_stop?: string;
}

// Structure for ad insights response - similar to CampaignInsightsResponse
export interface AdInsightsResponse {
  data: AdInsightData[];
  paging?: FacebookPaging;
}

// Basic structure for AdCreative
export interface AdCreative {
    id: string;
    name?: string;
    title?: string;
    body?: string;
    image_url?: string;
    image_hash?: string;
    thumbnail_url?: string;
    account_id?: string;
    video_id?: string;
    call_to_action_type?: string;
    object_story_spec?: any; // Complex object, define more specifically if needed
    asset_feed_spec?: any;  // Complex object for dynamic creatives
    effective_object_story_id?: string;
    // Video details might be fetched separately or included
    video_source_url?: string;
    video_details?: VideoDetails;
}

export interface VideoDetails {
    id: string;
    source?: string; // URL to the video file
    permalink_url?: string;
    title?: string;
    description?: string;
    length?: number; // in seconds
    published?: boolean;
    // other video fields
}


// Basic structure for AdInsight - VERY customizable
export interface AdInsight {
  // Common dimensions (from breakdowns)
  date_start?: string;
  date_stop?: string;
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  account_id?: string;
  account_name?: string;
  // Potential breakdown dimensions
  age?: string;
  gender?: string;
  country?: string;
  region?: string;
  publisher_platform?: string;
  platform_position?: string;
  impression_device?: string;
  hourly_stats_aggregated_by_advertiser_time_zone?: string; // Example hourly breakdown
  // Common metrics
  impressions?: string; // Often returned as string
  clicks?: string;
  reach?: string;
  spend?: string;
  cpm?: string;
  cpc?: string;
  ctr?: string;
  frequency?: string;
  // Actions/Conversions (array or specific fields)
  actions?: { action_type: string; value: string }[];
  cost_per_action_type?: { action_type: string; value: string }[];
  // ... many other possible fields depending on 'fields' parameter
  [key: string]: any; // Allow for dynamic fields based on request
}

// --- Input Types ---
// For passing parameters to GraphAPIService methods

export interface GetInsightsParams {
  level: 'ad' | 'adset' | 'campaign' | 'account';
  fields?: string[];
  time_range?: { since: string; until: string }; // YYYY-MM-DD format
  breakdowns?: string[];
  time_increment?: 1 | 'monthly' | 'all_days'; // 1 for daily
  filtering?: any[]; // Facebook filtering structure
  limit?: number; // Page size limit
  use_unified_attribution_setting?: boolean;
}

export interface GetDetailedInsightsParams extends GetInsightsParams {
  include_placement_breakdown?: boolean;
  include_audience_breakdown?: boolean;
  include_geo_breakdown?: boolean;
  include_action_breakdown?: boolean;
  include_device_breakdown?: boolean;
  include_hourly_breakdown?: boolean;
  analyze_creatives?: boolean;
}

export interface BreakdownInsight {
  [key: string]: any; // Dynamic breakdown keys and values
}

export interface DetailedAdInsight {
  ad_details?: Ad;
  ad_set?: any; // AdSet details
  insights?: AdInsight[];
  breakdown_insights?: {
    [category: string]: {
      [subcategory: string]: BreakdownInsight[];
    };
  };
  creatives?: any[]; // Creative details
  creative_analyses?: any; // Optional AI-powered creative analysis
  time_period?: {
    start_date: string;
    end_date: string;
    breakdown?: string;
    breakdowns?: string[];
  };
}

export interface GetCreativeParams {
    fields?: string[];
}

export interface GetImageParams {
    hashes: string[];
    fields?: string[];
}

export interface GetVideoParams {
    fields?: string[];
} 