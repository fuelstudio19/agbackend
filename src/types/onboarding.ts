import { z } from 'zod';
export type CompanySize = '1-5' | '6-10' | '11-50' | '51-100' | '101-500' | 'above 500';

export interface OnboardingRequest {
    company_url: string;
    meta_ad_dashboard_url?: string;
    employee_count?: string;
    sector?: string;
}

export interface Competitor {
    name: string;
    url: string;
}

export interface ProductDetails {
    name: string;
    url: string;
    meta_ad_library_url: string;
    short_write_up?: string;
    product_image?: string;
}

export interface CompetitorDetails {
    meta_ad_library_url: string;
    name: string;
    url: string;
    short_write_up?: string;
    logo?: string;
}

export interface OnboardingResponse {
    company_url: string;
    company_name: string;
    company_logo: string;
    company_description: string;
    competitor_details: CompetitorDetails[];
    company_theme_color: string;
    meta_ad_dashboard_url?: string;
    employee_count?: string;
    sector?: string;
    mainJob?: string,
    differentiation?: string,
    howItHelps?: string,
    features?: string,
    benefits?: string
}

export interface ScrapedCompanyData {
    domain: string;
    description: string;
    themeColors: string[];
    otherColorPalette: string[];
    companyLogo: string;
    metaAdLibraryUrl: string;
    products: string[];
    competitors: Competitor[];
}

// Zod schemas for validation and langchain output parsing
export const productDetailsSchema = z.object({
    name: z.string().describe('The name of the product'),
    url: z.string().url().describe('The URL of the product page'),
    meta_ad_library_url: z.string().url().describe('Facebook Ad Library URL for this product'),
    short_write_up: z.string().optional().describe('Brief description of the product'),
    product_image: z.string().url().optional().describe('URL of the product image')
});

export const competitorDetailsSchema = z.object({
    name: z.string().describe('The name of the competitor company'),
    url: z.string().url().describe('The competitor company URL that is correct and will render in the UI'),
    meta_ad_library_url: z.string().url().describe('Facebook Ad Library URL for this competitor'),
    short_write_up: z.string().optional().describe('Brief description of the competitor'),
    logo: z.string().url().optional().describe('URL of the competitor logo')
});

export const onboardingResponseSchema = z.object({
    company_name: z.string().describe('The official name of the company'),
    company_url: z.string().url().describe('The company website URL'),
    company_logo: z.string().url().describe('URL of the company logo that is correct and will render in the UI'),
    company_description: z.string().describe('The description of the company'),
    company_theme_color: z.string().describe('Primary theme color of the company (hex code)'),
    competitor_details: z.array(competitorDetailsSchema).describe('Array of competitor information'),
    meta_ad_dashboard_url: z.string().url().optional().describe('Meta Ad Dashboard URL of the company'),

    // New fields
    mainJob: z.string().describe('Brief description of what the company does'),
    differentiation: z.string().describe('What makes the company unique from competitors'),
    howItHelps: z.string().describe("How the company's product/service helps customers"),
    features: z.string().describe('Key features of the product/service'),
    benefits: z.string().describe('Main benefits customers get')

});

export const onboardingSchema = z.object({
    company_url: z.string().url('Invalid company URL'),
    meta_ad_dashboard_url: z.string().url('Invalid Meta Ad Dashboard URL').optional(),
    employee_count: z.string().optional(),
    sector: z.string().optional(),
});

export const processCompetitorSchema = z.object({
    url: z.string().url('Invalid competitor URL'),
    name: z.string().min(1, 'Competitor name is required'),
    meta_ad_library_url: z.string().url('Invalid Meta Ad Library URL').refine(
        (url) => url.includes('facebook.com/ads/library'),
        { message: 'Must be a valid Facebook Ad Library URL' }
    ),
    short_write_up: z.string().optional(),
    logo: z.string().url('Invalid logo URL').optional().or(z.literal(''))
});

export type onBoardingBody=z.infer<typeof onboardingSchema>
export type ProcessCompetitorBody = z.infer<typeof processCompetitorSchema>
export type OnboardingResponseZod = z.infer<typeof onboardingResponseSchema>
export type ProductDetailsZod = z.infer<typeof productDetailsSchema>
export type CompetitorDetailsZod = z.infer<typeof competitorDetailsSchema>