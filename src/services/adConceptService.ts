import { AdConceptRepository } from '../repositories/adConceptRepository';
import { PromptRepository } from '../repositories/promptRepository';
import { OnboardingRepository } from '../repositories/onboardingRepository';
import { llmService } from './llm/llmService';
import { 
    GenerateConceptsRequest, 
    GenerateConceptsResponse, 
    GeneratedConceptsData,
    DbAdConcept,
    ListAdConceptsRequest,
    ListAdConceptsResponse
} from '../types/adConceptTypes';
import { ModelType, OutputParserType } from '../types/llmTypes';
import { logger } from '../utils/logger';

export class AdConceptService {
    private adConceptRepo: AdConceptRepository;
    private promptRepo: PromptRepository;
    private onboardingRepo: OnboardingRepository;

    constructor() {
        this.adConceptRepo = new AdConceptRepository();
        this.promptRepo = new PromptRepository();
        this.onboardingRepo = new OnboardingRepository();
    }

    /**
     * Generate ad concepts using AI multimodal analysis
     */
    async generateAdConcepts(
        request: GenerateConceptsRequest,
        organisationId: string
    ): Promise<GenerateConceptsResponse> {
        const startTime = Date.now();
        
        try {
            logger.info(`[AdConceptService] Starting ad concept generation for org: ${organisationId}`);
            logger.info(`[AdConceptService] Request: ${request.userImageUrls.length} user images, ${request.competitorImageUrls.length} competitor images`);

            // Validate input
            if (!request.userImageUrls?.length && !request.competitorImageUrls?.length) {
                return {
                    success: false,
                    message: 'At least one user or competitor image URL is required'
                };
            }

            const userUrls = request.userImageUrls || [];
            const competitorUrls = request.competitorImageUrls || [];
            const allImageUrls = [...userUrls, ...competitorUrls];

            logger.info(`[AdConceptService] Using ${userUrls.length} user URLs and ${competitorUrls.length} competitor URLs`);

            // Get the prompt from database
            const promptResult = await this.promptRepo.getPromptByName('ad_concepts_generation');
            if (!promptResult.result) {
                logger.error(`[AdConceptService] Ad concepts generation prompt not found in database`);
                return {
                    success: false,
                    message: 'Ad concepts generation prompt not configured'
                };
            }

            // Get company description from onboarding data
            let companyDescription = '';
            try {
                const onboardingData = await this.onboardingRepo.getOnboardingByOrganisationId(organisationId);
                if (onboardingData?.company_description) {
                    companyDescription = onboardingData.company_description;
                    logger.info(`[AdConceptService] Found company description for org ${organisationId}: ${companyDescription.substring(0, 100)}...`);
                } else {
                    logger.warn(`[AdConceptService] No company description found in onboarding data for org ${organisationId}`);
                    companyDescription = 'No company description available';
                }
            } catch (error) {
                logger.error(`[AdConceptService] Error fetching company description for org ${organisationId}:`, error);
                companyDescription = 'No company description available';
            }

            // Prepare prompt variables
            const totalReferenceImages = userUrls.length + competitorUrls.length;
            const promptVariables = {
                company_description: companyDescription,
                user_image_count: userUrls.length,
                competitor_image_count: competitorUrls.length,
                total_reference_images: totalReferenceImages
            };

            // Generate concepts using multimodal LLM
            logger.info(`[AdConceptService] Generating concepts using AI multimodal analysis...`);
            const result = await llmService.analyzeMedia({
                mediaType: 'image',
                mediaUrls: allImageUrls,
                prompt: promptResult.result.prompt_content,
                inputData: promptVariables,
                temperature: 0.8, // Higher temperature for more creative concepts
                maxTokens: 8000,
                outputParser: {
                    type: OutputParserType.JSON,
                    fallbackValue: { concepts: [] }
                }
            });

            if (result.error) {
                logger.error(`[AdConceptService] Error generating concepts:`, result.error);
                return {
                    success: false,
                    message: `Failed to generate ad concepts: ${result.error}`
                };
            }

            // Validate the generated data
            const generatedData = result.data as GeneratedConceptsData;
            if (!generatedData?.concepts || !Array.isArray(generatedData.concepts) || generatedData.concepts.length === 0) {
                logger.error(`[AdConceptService] Invalid or empty concepts generated:`, generatedData);
                return {
                    success: false,
                    message: 'No valid ad concepts were generated'
                };
            }

            // Validate each concept has required fields
            const validConcepts = generatedData.concepts.filter(concept => 
                concept.id && concept.title && concept.audience && concept.hook && 
                concept.styleType && concept.description
            );

            if (validConcepts.length === 0) {
                logger.error(`[AdConceptService] No valid concepts after validation:`, generatedData.concepts);
                return {
                    success: false,
                    message: 'Generated concepts failed validation'
                };
            }

            const finalConceptsData: GeneratedConceptsData = {
                concepts: validConcepts
            };

            // Save to database
            const processingTime = Date.now() - startTime;
            const dbRecord: Omit<DbAdConcept, 'id' | 'created_at' | 'updated_at'> = {
                organisation_id: organisationId,
                concept_json: finalConceptsData,
                user_image_urls: userUrls,
                competitor_image_urls: competitorUrls,
                model_used: result.metadata?.model || 'unknown',
                processing_time_ms: processingTime,
                generation_metadata: {
                    totalImages: allImageUrls.length,
                    userImages: userUrls.length,
                    competitorImages: competitorUrls.length,
                    conceptsGenerated: validConcepts.length,
                    originalRequest: {
                        userImageCount: request.userImageUrls?.length || 0,
                        competitorImageCount: request.competitorImageUrls?.length || 0
                    },
                    llmMetadata: result.metadata
                }
            };

            const saveResult = await this.adConceptRepo.createAdConcept(dbRecord);
            if (saveResult.error) {
                logger.error(`[AdConceptService] Error saving concepts to database:`, saveResult.error);
                // Don't fail the request if save fails, just log the error
            } else {
                logger.info(`[AdConceptService] Successfully saved concepts to database with ID: ${saveResult.data?.id}`);
            }

            logger.info(`[AdConceptService] Successfully generated ${validConcepts.length} ad concepts in ${processingTime}ms`);

            return {
                success: true,
                data: finalConceptsData,
                message: `Successfully generated ${validConcepts.length} ad concepts`,
                metadata: {
                    model: result.metadata?.model,
                    processingTime,
                    conceptsGenerated: validConcepts.length
                }
            };

        } catch (error) {
            const processingTime = Date.now() - startTime;
            logger.error(`[AdConceptService] Exception during concept generation:`, error);
            
            return {
                success: false,
                message: `Ad concept generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                metadata: {
                    processingTime
                }
            };
        }
    }

    /**
     * Get paginated list of ad concepts for a user/organisation
     */
    async getAdConcepts(
        organisationId: string,
        options: ListAdConceptsRequest = {}
    ): Promise<ListAdConceptsResponse> {
        try {
            logger.info(`[AdConceptService] Fetching ad concepts for org: ${organisationId}`);

            const result = await this.adConceptRepo.getAdConceptsByOrganisation(
                organisationId,
                options
            );

            if (result.error) {
                logger.error(`[AdConceptService] Error fetching ad concepts:`, result.error);
                return {
                    success: false,
                    data: [],
                    pagination: {
                        page: options.page || 1,
                        limit: options.limit || 10,
                        total: 0,
                        totalPages: 0,
                        hasNext: false,
                        hasPrev: false
                    },
                    message: `Failed to fetch ad concepts: ${result.error.message}`
                };
            }

            const { page = 1, limit = 10 } = options;
            const total = result.count || 0;
            const totalPages = Math.ceil(total / limit);

            logger.info(`[AdConceptService] Successfully fetched ${result.data?.length || 0} ad concepts (page ${page}/${totalPages})`);

            return {
                success: true,
                data: result.data || [],
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            };

        } catch (error) {
            logger.error(`[AdConceptService] Exception fetching ad concepts:`, error);
            
            return {
                success: false,
                data: [],
                pagination: {
                    page: options.page || 1,
                    limit: options.limit || 10,
                    total: 0,
                    totalPages: 0,
                    hasNext: false,
                    hasPrev: false
                },
                message: `Failed to fetch ad concepts: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Get ad concept by ID
     */
    async getAdConceptById(
        conceptId: string,
        userId: string,
        organisationId: string
    ): Promise<{
        success: boolean;
        data?: DbAdConcept;
        message?: string;
    }> {
        try {
            logger.info(`[AdConceptService] Fetching ad concept: ${conceptId} for user: ${userId}, org: ${organisationId}`);

            const result = await this.adConceptRepo.getAdConceptById(conceptId, userId, organisationId);

            if (result.error) {
                logger.error(`[AdConceptService] Error fetching ad concept:`, result.error);
                return {
                    success: false,
                    message: `Failed to fetch ad concept: ${result.error.message}`
                };
            }

            if (!result.data) {
                logger.warn(`[AdConceptService] Ad concept not found: ${conceptId}`);
                return {
                    success: false,
                    message: 'Ad concept not found'
                };
            }

            logger.info(`[AdConceptService] Successfully fetched ad concept: ${conceptId}`);
            return {
                success: true,
                data: result.data
            };

        } catch (error) {
            logger.error(`[AdConceptService] Exception fetching ad concept:`, error);
            return {
                success: false,
                message: `Failed to fetch ad concept: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Delete ad concept
     */
    async deleteAdConcept(
        conceptId: string,
        userId: string,
        organisationId: string
    ): Promise<{
        success: boolean;
        message?: string;
    }> {
        try {
            logger.info(`[AdConceptService] Deleting ad concept: ${conceptId} for user: ${userId}, org: ${organisationId}`);

            const result = await this.adConceptRepo.deleteAdConcept(conceptId, userId, organisationId);

            if (result.error) {
                logger.error(`[AdConceptService] Error deleting ad concept:`, result.error);
                return {
                    success: false,
                    message: `Failed to delete ad concept: ${result.error.message}`
                };
            }

            logger.info(`[AdConceptService] Successfully deleted ad concept: ${conceptId}`);
            return {
                success: true,
                message: 'Ad concept deleted successfully'
            };

        } catch (error) {
            logger.error(`[AdConceptService] Exception deleting ad concept:`, error);
            return {
                success: false,
                message: `Failed to delete ad concept: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
} 