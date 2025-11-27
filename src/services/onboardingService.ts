import { OnboardingRequest, onboardingSchema, OnboardingResponse, ProductDetails, CompetitorDetails, onboardingResponseSchema } from '../types/onboarding';
import { z } from 'zod';
import { ModelType, MessageContent, OutputParserType } from '../types/llmTypes';
import dotenv from 'dotenv';
import * as onBoardingRepository from '../repositories/onboardingRepository';
import { PostgrestError } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { llmService } from './llm/llmService';
import * as competitorsRepository from '../repositories/competitorsRepository';
import { startScrapperService, startSelfAdScrapperService } from './adScrapServices';
import { OrganizationRepository } from '../repositories/organizationRepository';
import { OrganizationUsersRepository } from '../repositories/organizationUsersRepository';
import { PromptRepository } from '../repositories/promptRepository';
import { CreditsRepository } from '../repositories/creditsRepository';
import { CreateOrganizationRequest, Organization } from '../types/organization';
import { searchCompanies } from '../utils/scrapper';
import { extractDomainFromUrl, normalizeCompanyUrl } from '../utils/general';

dotenv.config();
const onBoardingRepo = new onBoardingRepository.OnboardingRepository()
const organizationRepo = new OrganizationRepository();
const organizationUsersRepo = new OrganizationUsersRepository();
const promptRepo = new PromptRepository();
const creditsRepo = new CreditsRepository();

export class OnboardingService {
    private async analyzeWithLLM(data: OnboardingRequest, isGuest: boolean): Promise<OnboardingResponse> {
        const systemPrompt: MessageContent = {
            role: 'system',
            content: `You are an expert market researcher and web analyst with access to real-time web search capabilities. 
            Your task is to search the web and analyze company websites to gather structured, accurate, and up-to-date information about their products, 
            competitors, and branding. Your responses must be clean, parseable JSON objects strictly following the given schema.`
        };

        // Fetch the user prompt from the database
        const promptResult = await promptRepo.getPromptByName('onboarding_analysis');
        
        let userPromptContent: string;
        userPromptContent = promptResult.result?.prompt_content || '';
            

        const userPrompt: MessageContent = {
            role: 'user',
            content: userPromptContent
        };

        try {
            // Use the enhanced web search with input data and output parser
            const result = await llmService.performWebSearch<OnboardingResponse>({
                messages: [systemPrompt, userPrompt],
                temperature: 0.1,
                maxTokens: 4096,
                responseFormat: { type: 'json_object' },
                inputData: {
                    company_url: data.company_url
                },
                outputParser: {
                    type: OutputParserType.ZOD,
                    zodSchema: onboardingResponseSchema,
                    strictMode: true
                }
            });

            if (result.error) {
                throw new Error(result.error);
            }

            const parsedResponse = result.data;

            // Log metadata for debugging
            if (result.metadata) {
                logger.info('LLM Analysis metadata:', {
                    inputDataUsed: result.metadata.inputDataUsed,
                    parsedWithSchema: result.metadata.parsedWithSchema,
                    templateVariablesDetected: result.metadata.templateVariablesDetected
                });
            }

            // Validate required fields
            if (!parsedResponse.company_url) {
                throw new Error('Response missing required company information');
            }

            return parsedResponse;
        } catch (error) {
            logger.error('Error in analyzeWithLLM:', error);
            throw new Error(`Failed to analyze company data: ${(error as Error).message}`);
        }
    }

    private async analyzeWithLLMAndEnhanceWithSearch(data: OnboardingRequest, isGuest: boolean): Promise<OnboardingResponse> {
        // First, perform the LLM analysis
        const llmResponse = await this.analyzeWithLLM(data, isGuest);
        
        // Validate LLM response
        if (!llmResponse || !this.isValidOnboardingResponse(llmResponse)) {
            logger.warn("LLM returned invalid onboarding data:", llmResponse);
            throw new Error("Invalid onboarding data received from analysis");
        }

        try {
            // Prepare search queries for parallel execution
            const searchQueries: string[] = [];
            
            // Add company name to search queries
            if (llmResponse.company_name) {
                searchQueries.push(llmResponse.company_name);
            }
            
            // Add competitor names to search queries
            if (llmResponse.competitor_details && llmResponse.competitor_details.length > 0) {
                llmResponse.competitor_details.forEach(competitor => {
                    if (competitor.name) {
                        searchQueries.push(competitor.name);
                    }
                });
            }

            logger.info(`Making ${searchQueries.length} parallel company search calls for: ${searchQueries.join(', ')}`);

            // Make parallel search calls
            const searchPromises = searchQueries.map(query => 
                searchCompanies(query).catch(error => {
                    logger.warn(`Search failed for query "${query}":`, error.message);
                    return { searchResults: [] }; // Return empty results on failure
                })
            );

            const searchResults = await Promise.all(searchPromises);

            // Helper function to construct Meta Ad Library URL from page_id
            const constructMetaAdLibraryUrl = (pageId: string): string => {
                return `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=${pageId}`;
            };

            // Update company meta_ad_dashboard_url if company search was successful
            if (searchResults[0]?.searchResults?.length > 0) {
                const companyPageId = searchResults[0].searchResults[0].page_id;
                if (companyPageId) {
                    llmResponse.meta_ad_dashboard_url = constructMetaAdLibraryUrl(companyPageId);
                    logger.info(`✅ Updated company meta_ad_dashboard_url with page_id: ${companyPageId}`);
                }
            }

            // Update competitor meta_ad_library_url for each competitor
            if (llmResponse.competitor_details && llmResponse.competitor_details.length > 0) {
                let competitorIndex = 0;
                
                // Start from index 1 since index 0 was for company name
                for (let searchIndex = 1; searchIndex < searchResults.length; searchIndex++) {
                    const searchResult = searchResults[searchIndex];
                    
                    if (searchResult?.searchResults?.length > 0 && competitorIndex < llmResponse.competitor_details.length) {
                        const competitorPageId = searchResult.searchResults[0].page_id;
                        if (competitorPageId) {
                            llmResponse.competitor_details[competitorIndex].meta_ad_library_url = constructMetaAdLibraryUrl(competitorPageId);
                            logger.info(`✅ Updated competitor "${llmResponse.competitor_details[competitorIndex].name}" meta_ad_library_url with page_id: ${competitorPageId}`);
                        }
                    }
                    competitorIndex++;
                }
            }

            logger.info('Successfully enhanced LLM response with company search data');
            return llmResponse;

        } catch (error) {
            logger.error('Error enhancing LLM response with company search:', error);
            // Return original LLM response if enhancement fails
            logger.warn('Returning original LLM response due to search enhancement failure');
            return llmResponse;
        }
    }

    public async processOnboarding(
        data: OnboardingRequest
    ): Promise<{ data: OnboardingResponse | null, error: string | null }> {
        logger.info('Processing onboarding request:', data);

        try {
            // 1. Validate input
            const validatedData = onboardingSchema.parse(data);

            // 2. Check if the URL already exists in DB and return cached result
            const { result, error } = await onBoardingRepo.getOnboardingByCompanyUrl(data.company_url);
            if (error) return { data: null, error: error.message };
            if (result) return { data: result, error: null };

            // 3. Analyze with LLM using web search (single call)
            const llmResponse = await this.analyzeWithLLMAndEnhanceWithSearch(validatedData, false);

            // Return the analysis result without saving
            return { data: llmResponse, error: null };

        } catch (error) {
            logger.error('Error in processOnboarding:', error);
            return { data: null, error: (error as Error).message };
        }
    }

    public async saveOnboarding(
        data: OnboardingResponse,
        userId: string
    ): Promise<{ data: OnboardingResponse | null, error: PostgrestError | null }> {
        try {
            // 1. Validate the data structure
            if (!this.isValidOnboardingResponse(data)) {
                logger.warn("Invalid onboarding data provided for saving:", data);
                return { data: null, error: { message: "Invalid onboarding data structure" } as PostgrestError };
            }

            // 2. Normalize the company URL and extract domain
            const normalizedCompanyUrl = normalizeCompanyUrl(data.company_url);
            const domain_url = extractDomainFromUrl(normalizedCompanyUrl);

            logger.info(`Saving onboarding - Normalized URL: ${normalizedCompanyUrl}, Domain: ${domain_url}`);

            // 3. Check if organization already exists by domain
            const existingOrgResult = await organizationRepo.getOrganizationByDomain(domain_url);
            if (existingOrgResult.error) {
                return { data: null, error: existingOrgResult.error };
            }

            let organizationId: string;
            
            if (existingOrgResult.result) {
                // Organization exists, use existing organization
                organizationId = existingOrgResult.result.id;
                logger.info(`Using existing organization: ${organizationId} for domain: ${domain_url}`);
            } else {
                // 4. Create new organization with additional fields from the onboarding data
                const organizationData: CreateOrganizationRequest = {
                    name: data.company_name,
                    domain_url: domain_url,
                    meta_dashboard_url: data.meta_ad_dashboard_url,
                    sector: data.sector,
                    employee_count: data.employee_count,
                    description: data.company_description || `Organization created during onboarding for ${data.company_name}`
                };

                const createOrgResult = await organizationRepo.createOrganization(organizationData);
                if (createOrgResult.error) {
                    logger.error("Failed to create organization:", createOrgResult.error);
                    return { data: null, error: createOrgResult.error };
                }

                organizationId = createOrgResult.result!.id;
                logger.info(`Created new organization: ${organizationId} for domain: ${domain_url}`);

                // 4.1. Save onboarding data to onboarding_data table with normalized URL
                const onboardingData = {
                    company_name: data.company_name,
                    company_url: normalizedCompanyUrl, // Use normalized URL
                    company_logo: data.company_logo || '',
                    company_theme_color: data.company_theme_color || '',
                    company_description: data.company_description || '',
                    meta_ad_dashboard_url: data.meta_ad_dashboard_url,
                    employee_count: data.employee_count,
                    sector: data.sector,
                    // New Fields
                    mainJob: data.mainJob || '',
                    differentiation: data.differentiation || '',
                    howItHelps: data.howItHelps || '',
                    features: data.features || '',
                    benefits: data.benefits || ''
                };

                const saveOnboardingResult = await onBoardingRepo.createOnboarding(organizationId, onboardingData, userId);
                if (saveOnboardingResult.error) {
                    logger.error("Failed to save onboarding data:", saveOnboardingResult.error);
                    // Continue execution - organization was created successfully
                } else {
                    logger.info("✅ Saved onboarding data for organization");
                }

                // 4.2. Create free tier credits for new organization
                try {
                    const freeCredits = [
                        {
                            organization_id: organizationId,
                            credit_type: 'competitor_slot' as const,
                            total_credits: 3,
                            used_credits: 0,
                            is_add_on: false,
                            metadata: { tier: 'free', created_during: 'onboarding' }
                        },
                        {
                            organization_id: organizationId,
                            credit_type: 'ad_creative' as const,
                            total_credits: 10,
                            used_credits: 0,
                            is_add_on: false,
                            metadata: { tier: 'free', created_during: 'onboarding' }
                        }
                    ];

                    const creditsResult = await creditsRepo.createCredits(freeCredits);
                    if (creditsResult.error) {
                        logger.error("Failed to create free tier credits for new organization:", creditsResult.error);
                        // Continue execution - don't fail the entire onboarding if credits creation fails
                    } else {
                        logger.info(`✅ Created free tier credits for organization ${organizationId}: 3 competitor_slot + 10 ad_creative credits`);
                    }
                } catch (creditError) {
                    logger.error("Exception while creating free tier credits:", creditError);
                    // Continue execution - don't fail the entire onboarding if credits creation fails
                }
            }

            // 5. Check if user is already part of the organization
            const membershipResult = await organizationUsersRepo.getUserOrganizationMembership(organizationId, userId);
            if (membershipResult.error) {
                logger.error("Error checking user membership:", membershipResult.error);
                return { data: null, error: membershipResult.error };
            }

            if (!membershipResult.result) {
                // 6. Add user to organization
                const addUserResult = await organizationUsersRepo.addUserToOrganization(organizationId, userId, 'admin');
                if (addUserResult.error) {
                    logger.error("Failed to add user to organization:", addUserResult.error);
                    return { data: null, error: addUserResult.error };
                }
                logger.info(`Added user ${userId} to organization ${organizationId}`);
            } else {
                logger.info(`User ${userId} is already a member of organization ${organizationId}`);
            }

            // 7. Update organization's onboarding completion status
            const updateOrgResult = await organizationRepo.updateOrganization(organizationId, {
                onboarding_completed_at: new Date().toISOString()
            });
            if (updateOrgResult.error) {
                logger.warn("Failed to update organization onboarding status:", updateOrgResult.error);
                // Continue execution - this is not critical
            }

            // 8. Save competitor details to competitors table if provided
            if (data.competitor_details && data.competitor_details.length > 0) {
                const competitorSaveResult = await competitorsRepository.bulkUpsertCompetitors(
                    data.competitor_details,
                    organizationId
                );
                
                if (competitorSaveResult.error) {
                    logger.error("Failed to save competitors, but organization was created:", competitorSaveResult.error);
                    // Continue execution - don't fail the entire onboarding if competitor save fails
                } else {
                    // 9. Start scraping process for each competitor
                    logger.info(`Starting scraping process for ${data.competitor_details.length} competitors`);
                    
                    for (const competitor of data.competitor_details) {
                        try {
                            logger.info(`Starting scraper for competitor: ${competitor.name} (${competitor.url})`);
                            
                            const scrapingResult = await startScrapperService(
                                competitor.meta_ad_library_url,
                                competitor.url,
                                organizationId,
                                'competitor'
                            );
                            
                            logger.info(`✅ Scraping started successfully for ${competitor.name} with run_id: ${scrapingResult.run_id}`);
                        } catch (scrapingError) {
                            logger.error(`❌ Failed to start scraping for competitor ${competitor.name}:`, scrapingError);
                            // Continue with other competitors even if one fails
                        }
                    }
                }
            }

            // 10. Start self ad scraping if meta_ad_dashboard_url is provided
            if (data.meta_ad_dashboard_url) {
                try {
                    logger.info(`Starting self ad scraping for organization: ${organizationId}`);
                    
                    const selfAdScrapingResult = await startSelfAdScrapperService(
                        data.meta_ad_dashboard_url,
                        data.company_url,
                        organizationId
                    );
                    
                    logger.info(`✅ Self ad scraping started successfully for ${data.company_name} with run_id: ${selfAdScrapingResult.run_id}`);
                } catch (scrapingError) {
                    logger.error(`❌ Failed to start self ad scraping for ${data.company_name}:`, scrapingError);
                    // Continue execution - don't fail the entire onboarding if self ad scraping fails
                }
            }

            logger.info("Onboarding completed successfully for organization:", organizationId);
            return { data: data, error: null };

        } catch (error) {
            logger.error('Error in saveOnboarding:', error);
            return { data: null, error: { message: (error as Error).message } as PostgrestError };
        }
    }

    public async processOnboardingForGuest(
        data: OnboardingRequest
    ): Promise<{ data: (OnboardingResponse & { organizationId: string }) | null, error: string | null }> {
        logger.info('Processing onboarding request for guest user:', data);

        try {
            // 1. Validate input
            const validatedData = onboardingSchema.parse(data);

            // 2. Normalize the company URL for consistent storage and comparison
            const normalizedCompanyUrl = normalizeCompanyUrl(validatedData.company_url);
            const domain_url = extractDomainFromUrl(normalizedCompanyUrl);

            logger.info(`Normalized URL: ${normalizedCompanyUrl}, Domain: ${domain_url}`);

            // 3. Check if onboarding data already exists for this normalized company URL
            const existingOnboardingResult = await onBoardingRepo.getOnboardingWithOrgIdByCompanyUrl(normalizedCompanyUrl);
            if (existingOnboardingResult.error) {
                logger.error("Error checking existing onboarding data:", existingOnboardingResult.error);
                return { data: null, error: existingOnboardingResult.error.message };
            }

            if (existingOnboardingResult.result) {
                logger.info(`Found existing onboarding data for normalized URL: ${normalizedCompanyUrl}`);
                
                const organizationId = existingOnboardingResult.result.organizationId;

                // Fetch competitors for this organization  
                const competitorsResult = await competitorsRepository.getCompetitorsByOrganisation(organizationId);
                const competitors = competitorsResult.data || [];

                // Construct response from existing data
                const response: OnboardingResponse = {
                    ...existingOnboardingResult.result,
                    competitor_details: competitors.map((comp: any) => ({
                        name: comp.name,
                        url: comp.url,
                        meta_ad_library_url: comp.meta_ad_library_url,
                        short_write_up: comp.short_write_up || undefined,
                        logo: comp.logo || undefined
                    }))
                };

                logger.info("Returning existing onboarding data for guest");
                return { 
                    data: { 
                        ...response, 
                        organizationId 
                    }, 
                    error: null 
                };
            }

            // 4. No existing onboarding data found, check if organization exists by domain (fallback)
            const existingOrgResult = await organizationRepo.getOrganizationByDomain(domain_url);
            if (existingOrgResult.error) {
                return { data: null, error: existingOrgResult.error.message };
            }

            if (existingOrgResult.result) {
                // Organization exists but no onboarding data - construct response from organization data
                const organization = existingOrgResult.result;
                const organizationId = organization.id;
                logger.info(`Found existing organization: ${organizationId} for domain: ${domain_url}. Constructing response from organization data.`);

                // Fetch competitors for this organization
                const competitorsResult = await competitorsRepository.getCompetitorsByOrganisation(organizationId);
                const competitors = competitorsResult.data || [];

                // Construct OnboardingResponse from existing organization data
                const onboardingResponse: OnboardingResponse = {
                    company_name: organization.name,
                    company_url: normalizedCompanyUrl, // Use the normalized URL
                    company_logo: '', // Not stored in organization table
                    company_theme_color: '', // Not stored in organization table
                    company_description: organization.description || '',
                    competitor_details: competitors.map((comp: any) => ({
                        name: comp.name,
                        url: comp.url,
                        meta_ad_library_url: comp.meta_ad_library_url,
                        short_write_up: comp.short_write_up || undefined,
                        logo: comp.logo || undefined
                    })),
                    meta_ad_dashboard_url: organization.meta_dashboard_url || undefined,
                    employee_count: organization.employee_count || undefined,
                    sector: organization.sector || undefined
                };

                logger.info("Returning existing organization data for guest:", organizationId);
                
                // Return the existing data with organization ID
                return { 
                    data: { 
                        ...onboardingResponse, 
                        organizationId 
                    }, 
                    error: null 
                };
            }

            // 5. No existing data found, proceed with LLM analysis using normalized URL
            const llmAnalysisData = { ...validatedData, company_url: normalizedCompanyUrl };
            const llmResponse = await this.analyzeWithLLMAndEnhanceWithSearch(llmAnalysisData, true);
            
            // 6. Create new organization with data from LLM analysis
            const organizationData: CreateOrganizationRequest = {
                name: llmResponse.company_name,
                domain_url: domain_url,
                meta_dashboard_url: llmResponse.meta_ad_dashboard_url,
                sector: llmResponse.sector,
                employee_count: llmResponse.employee_count,
                description: llmResponse.company_description || `Organization created during guest onboarding for ${llmResponse.company_name}`
            };

            const createOrgResult = await organizationRepo.createOrganization(organizationData);
            if (createOrgResult.error) {
                logger.error("Failed to create organization for guest:", createOrgResult.error);
                return { data: null, error: createOrgResult.error.message };
            }

            const organizationId = createOrgResult.result!.id;
            logger.info(`Created new organization for guest: ${organizationId} for domain: ${domain_url}`);

            // 7. Save onboarding data to onboarding_data table with normalized URL
            const onboardingData = {
                company_name: llmResponse.company_name,
                company_url: normalizedCompanyUrl, // Use normalized URL
                company_logo: llmResponse.company_logo || '',
                company_theme_color: llmResponse.company_theme_color || '',
                company_description: llmResponse.company_description || '',
                meta_ad_dashboard_url: llmResponse.meta_ad_dashboard_url,
                employee_count: llmResponse.employee_count,
                sector: llmResponse.sector
            };

            const saveOnboardingResult = await onBoardingRepo.upsertOnboardingForGuest(organizationId, onboardingData);
            if (saveOnboardingResult.error) {
                logger.error("Failed to save onboarding data for guest:", saveOnboardingResult.error);
                // Continue execution - organization was created successfully
            } else {
                logger.info("✅ Saved onboarding data for guest organization");
            }

            // 8. Create free tier credits for new organization
            try {
                const freeCredits = [
                    {
                        organization_id: organizationId,
                        credit_type: 'competitor_slot' as const,
                        total_credits: 10,
                        used_credits: 0,
                        is_add_on: false,
                        metadata: { tier: 'free', created_during: 'guest_onboarding' }
                    },
                    {
                        organization_id: organizationId,
                        credit_type: 'ad_creative' as const,
                        total_credits: 3,
                        used_credits: 0,
                        is_add_on: false,
                        metadata: { tier: 'free', created_during: 'guest_onboarding' }
                    }
                ];

                const creditsResult = await creditsRepo.createCredits(freeCredits);
                if (creditsResult.error) {
                    logger.error("Failed to create free tier credits for guest organization:", creditsResult.error);
                    // Continue execution - don't fail the entire onboarding if credits creation fails
                } else {
                    logger.info(`✅ Created free tier credits for guest organization ${organizationId}: 10 competitor_slot + 3 ad_creative credits`);
                }
            } catch (creditError) {
                logger.error("Exception while creating free tier credits for guest:", creditError);
                // Continue execution - don't fail the entire onboarding if credits creation fails
            }

            // 9. Mark organization's onboarding completion status
            const updateOrgResult = await organizationRepo.updateOrganization(organizationId, {
                onboarding_completed_at: new Date().toISOString()
            });
            if (updateOrgResult.error) {
                logger.warn("Failed to update guest organization onboarding status:", updateOrgResult.error);
                // Continue execution - this is not critical
            }

            // 10. Save competitor details to competitors table if provided
            if (llmResponse.competitor_details && llmResponse.competitor_details.length > 0) {
                const competitorSaveResult = await competitorsRepository.bulkUpsertCompetitors(
                    llmResponse.competitor_details,
                    organizationId
                );
                
                if (competitorSaveResult.error) {
                    logger.error("Failed to save competitors for guest, but organization was created:", competitorSaveResult.error);
                    // Continue execution - don't fail the entire onboarding if competitor save fails
                } else {
                    logger.info(`✅ Saved ${llmResponse.competitor_details.length} competitors for guest organization`);
                    
                    // 11. Start scraping process for each competitor
                    logger.info(`Starting scraping process for ${llmResponse.competitor_details.length} competitors`);
                    
                    for (const competitor of llmResponse.competitor_details) {
                        try {
                            logger.info(`Starting scraper for competitor: ${competitor.name} (${competitor.url})`);
                            
                            const scrapingResult = await startScrapperService(
                                competitor.meta_ad_library_url,
                                competitor.url,
                                organizationId,
                                'competitor'
                            );
                            
                            logger.info(`✅ Scraping started successfully for ${competitor.name} with run_id: ${scrapingResult.run_id}`);
                        } catch (scrapingError) {
                            logger.error(`❌ Failed to start scraping for competitor ${competitor.name}:`, scrapingError);
                            // Continue with other competitors even if one fails
                        }
                    }
                }
            }

            // 12. Start self ad scraping if meta_ad_dashboard_url is provided
            if (llmResponse.meta_ad_dashboard_url) {
                try {
                    logger.info(`Starting self ad scraping for guest organization: ${organizationId}`);
                    
                    const selfAdScrapingResult = await startSelfAdScrapperService(
                        llmResponse.meta_ad_dashboard_url,
                        llmResponse.company_url,
                        organizationId
                    );
                    
                    logger.info(`✅ Self ad scraping started successfully for ${llmResponse.company_name} with run_id: ${selfAdScrapingResult.run_id}`);
                } catch (scrapingError) {
                    logger.error(`❌ Failed to start self ad scraping for ${llmResponse.company_name}:`, scrapingError);
                    // Continue execution - don't fail the entire onboarding if self ad scraping fails
                }
            }

            logger.info("Guest onboarding completed successfully for organization:", organizationId);
            
            // Return the analysis result along with the organization ID
            return { 
                data: { 
                    ...llmResponse, 
                    organizationId 
                }, 
                error: null 
            };

        } catch (error) {
            logger.error('Error in processOnboardingForGuest:', error);
            return { data: null, error: (error as Error).message };
        }
    }

    public isValidProductDetailsArray(arr: any): arr is ProductDetails[] {
        return (
            Array.isArray(arr) &&
            arr.every(item =>
                typeof item.name === 'string' &&
                typeof item.url === 'string' &&
                typeof item.meta_ad_library_url === 'string' &&
                (item.short_write_up === undefined || item.short_write_up === null || typeof item.short_write_up === 'string') &&
                (item.product_image === undefined || item.product_image === null || typeof item.product_image === 'string')
            )
        );
    }

    public isValidCompetitorDetailsArray(arr: any): arr is CompetitorDetails[] {
        return (
            Array.isArray(arr) &&
            arr.every(item =>
                typeof item.name === 'string' &&
                typeof item.meta_ad_library_url === 'string' &&
                typeof item.url === 'string' &&
                (item.short_write_up === undefined || item.short_write_up === null || typeof item.short_write_up === 'string') &&
                (item.logo === undefined || item.logo === null || typeof item.logo === 'string')
            )
        );
    }

    public isValidOnboardingResponse(data: any): data is OnboardingResponse {
        return (
            typeof data === 'object' &&
            data !== null &&
            typeof data.company_name === 'string' &&
            typeof data.company_url === 'string' &&
            (data.company_logo === undefined || data.company_logo === null || typeof data.company_logo === 'string') &&
            (data.company_theme_color === undefined || data.company_theme_color === null || typeof data.company_theme_color === 'string') &&
            this.isValidCompetitorDetailsArray(data.competitor_details) &&
            // Check optional fields - they should be undefined, null, or string
            (data.meta_ad_dashboard_url === undefined || data.meta_ad_dashboard_url === null || typeof data.meta_ad_dashboard_url === 'string') &&
            (data.employee_count === undefined || data.employee_count === null || typeof data.employee_count === 'string') &&
            (data.sector === undefined || data.sector === null || typeof data.sector === 'string')
        );
    }

    public async processCompetitor(
        competitorData: { 
            url: string; 
            name: string; 
            meta_ad_library_url: string;
            short_write_up?: string;
            logo?: string;
        },
        userId: string,
        organisationId: string
    ): Promise<{ data: any | null, error: string | null }> {
        try {
            logger.info('Processing competitor:', competitorData);

            // Save to competitors table directly without LLM analysis
            const saveResult = await competitorsRepository.upsertCompetitor({
                meta_ad_library_url: competitorData.meta_ad_library_url,
                name: competitorData.name,
                url: competitorData.url,
                short_write_up: competitorData.short_write_up || '',
                logo: competitorData.logo || '',
                organisation_id: organisationId
            });

            if (saveResult.error) {
                throw new Error(`Failed to save competitor: ${saveResult.error.message}`);
            }

            logger.info('Competitor saved successfully:', competitorData.name);
            return { data: saveResult.data, error: null };

        } catch (error) {
            logger.error('Error in processCompetitor:', error);
            return { data: null, error: (error as Error).message };
        }
    }
} 