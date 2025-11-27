import { z } from 'zod';

export const urlSchema=z.object({
    url:z.string().url('Must be valid URL').includes('facebook.com/ads/library')
})

// New schema for starting scraping with competitor_url and meta_ad_library_url
export const startScrapingSchema = z.object({
    competitor_url: z.string().url('Must be valid competitor URL'),
    meta_ad_library_url: z.string().url('Must be valid Meta Ad Library URL').includes('facebook.com/ads/library')
})

// New schema for getting results - can use either run_id or competitor_url
export const getResultSchema = z.union([
    z.object({
        run_id: z.string().min(1, 'run_id cannot be empty')
    }),
    z.object({
        competitor_url: z.string().url('Must be valid competitor URL')
    })
])

// Interface representing a card from the Apify response
export interface ApifyAdCard {
    body: string;
    title: string;
    caption: string;
    cta_text: string;
    cta_type: string;
    link_url: string;
    image_crops: any[];
    video_hd_url: string | null;
    video_sd_url: string | null;
    link_description: string | null;
    resized_image_url: string;
    original_image_url: string;
    video_preview_image_url: string | null;
    watermarked_video_hd_url: string | null;
    watermarked_video_sd_url: string | null;
    watermarked_resized_image_url: string;
}

// Interface representing the snapshot object from Apify
export interface ApifySnapshot {
    body: {
        text: string;
    };
    cards: ApifyAdCard[];
    event: any | null;
    title: string;
    byline: string | null;
    images: any[];
    videos: any[];
    caption: string;
    page_id: string;
    cta_text: string;
    cta_type: string;
    link_url: string;
    page_name: string;
    extra_links: any[];
    extra_texts: any[];
    is_reshared: boolean;
    extra_images: any[];
    extra_videos: any[];
    brazil_tax_id: string | null;
    display_format: string;
    additional_info: any | null;
    branded_content: any | null;
    ec_certificates: any[];
    page_categories: string[];
    page_is_deleted: boolean;
    page_like_count: number;
    country_iso_code: string | null;
    disclaimer_label: string | null;
    link_description: string;
    page_entity_type: string;
    page_profile_uri: string;
    current_page_name: string;
    root_reshared_post: any | null;
    page_is_profile_page: boolean;
    page_profile_picture_url: string;
}

// Updated interface for the complete Apify response
export interface MetaAdResponse {
    url: string;
    ad_id: string | null;
    spend: string | null;
    total: number;
    page_id: string;
    currency: string;
    end_date: number;
    fev_info: any | null;
    snapshot: ApifySnapshot;
    publisher_platform?: string[]; // Array of platforms like ['FACEBOOK', 'INSTAGRAM', etc.]
    start_date?: number;
    
    // Extracted/computed fields for easy access
    ad_archive_id?: string;
    is_active?: boolean;
    page_name?: string;
    page_profile_picture_url?: string;
    display_format?: string;
    image_urls?: string[];
    link_url?: string;
    cta_text?: string;
    title?: string;
    body?: string;
    caption?: string;
}

export type urlBody=z.infer<typeof urlSchema>;
export type startScrapingBody = z.infer<typeof startScrapingSchema>;
export type getResultBody = z.infer<typeof getResultSchema>;

// Company search types for scrapecreators API
export interface CompanySearchResult {
    page_id: string;
    category: string;
    image_uri: string;
    likes: number;
    verification: string;
    name: string;
    country: string | null;
    entity_type: string;
    ig_username: string | null;
    ig_followers: number | null;
    ig_verification: boolean | null;
    page_alias: string;
    page_is_deleted: boolean;
}

export interface CompanySearchResponse {
    searchResults: CompanySearchResult[];
}

// Schema for company search query validation
export const companySearchSchema = z.object({
    query: z.string().min(1, 'Search query cannot be empty')
});

export type CompanySearchBody = z.infer<typeof companySearchSchema>;