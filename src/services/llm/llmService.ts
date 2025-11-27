/**
 * LLMService - Main service for interacting with LLMs (OpenRouter, OpenAI)
 */

import { logger } from '../../utils/logger';
import llmConfig from '../../config/llmConfig';
import {
  ModelType,
  MessageContent,
  CompletionOptions,
  ImageGenerationOptions,
  MediaAnalysisOptions,
  ModelResponse,
  ImageGenerationResponse,
  WebSearchOptions,
  WebSearchResponse,
  EnhancedWebSearchOptions,
  InputData,
  OutputParserOptions
} from '../../types/llmTypes';
import { OpenRouterClient } from './clients/openRouterClient';
import { OpenAIClient } from './clients/openAIClient';
import { LangChainHelper } from './langchainHelper';

/**
 * LLMService - Main service class for interacting with various LLM providers
 */
export class LLMService {
  private openRouterClient: OpenRouterClient;
  private openAIClient: OpenAIClient;
  private defaultModelType: ModelType;

  constructor() {
    // Initialize model clients
    this.openRouterClient = new OpenRouterClient(llmConfig.openrouter, llmConfig.webSearch);
    this.openAIClient = new OpenAIClient(llmConfig.openai);
    this.defaultModelType = llmConfig.defaultModel;

    logger.info(`LLMService initialized with default model: ${this.defaultModelType}`);
  }

  /**
   * Get the appropriate client based on model type
   */
  private getClient(modelType: ModelType = this.defaultModelType) {
    switch (modelType) {
      case ModelType.OPENROUTER:
        return this.openRouterClient;
      case ModelType.GEMINI:
        return this.openRouterClient; // Use OpenRouter for Gemini models
      case ModelType.OPENAI:
        return this.openAIClient;
      case ModelType.WEB_SEARCH:
        return this.openRouterClient; // Use OpenRouter with Perplexity for web search
      default:
        return this.openRouterClient;
    }
  }

  /**
   * Enhanced method to handle input data substitution and output parsing
   */
  private async processMessagesAndOptions(
    messages: MessageContent[],
    options: CompletionOptions = {}
  ): Promise<{
    processedMessages: MessageContent[];
    outputParser?: any;
    metadata: any;
  }> {
    let processedMessages = messages;
    let outputParser;
    const metadata: any = {
      inputDataUsed: false,
      parsedWithSchema: false,
      templateVariablesDetected: []
    };

    // Handle input data substitution if provided
    if (options.inputData) {
      const substitutionResult = await LangChainHelper.substituteVariables(
        messages,
        options.inputData
      );
      processedMessages = substitutionResult.messages;
      metadata.inputDataUsed = true;
      metadata.templateVariablesDetected = substitutionResult.templateVariables;

      // Validate input data
      const validation = LangChainHelper.validateInputData(
        options.inputData,
        substitutionResult.templateVariables
      );
      
      if (!validation.valid) {
        throw new Error(`Missing required variables: ${validation.missingVariables.join(', ')}`);
      }
    }

    // Handle output parser setup if provided
    if (options.outputParser) {
      outputParser = LangChainHelper.createOutputParser(options.outputParser);
      metadata.parsedWithSchema = true;

      // Add format instructions to the last message if parser provides them
      const formatInstructions = LangChainHelper.getFormatInstructions(outputParser);
      if (formatInstructions) {
        const lastMessage = processedMessages[processedMessages.length - 1];
        lastMessage.content += `\n\n${formatInstructions}`;
      }
    }

    return {
      processedMessages,
      outputParser,
      metadata
    };
  }

  /**
   * Generate text completion from prompt
   */
  async generateText(
    prompt: string,
    modelType: ModelType = this.defaultModelType,
    options: CompletionOptions = {}
  ): Promise<ModelResponse<string>> {
    try {
      const messages: MessageContent[] = [{ role: 'user', content: prompt }];
      const { processedMessages, outputParser, metadata } = await this.processMessagesAndOptions(messages, options);
      
      const client = this.getClient(modelType);
      
      // Handle multimodal content for generateText - extract text only
      const firstMessage = processedMessages[0];
      let textContent: string;
      
      if (Array.isArray(firstMessage.content)) {
        // Extract text from multimodal content
        textContent = firstMessage.content
          .filter(part => part.type === 'text')
          .map(part => part.text || '')
          .join(' ');
      } else {
        textContent = firstMessage.content;
      }
      
      const result = await client.generateText(textContent, options);

      // Parse output if parser is provided
      if (outputParser && result.data) {
        const parseResult = await LangChainHelper.parseOutput(
          result.data,
          outputParser,
          options.outputParser?.fallbackValue
        );
        
        return {
          data: parseResult.data,
          error: parseResult.success ? result.error : parseResult.error,
          metadata: { ...result.metadata, ...metadata, parsedWithSchema: parseResult.success }
        };
      }

      return {
        ...result,
        metadata: { ...result.metadata, ...metadata }
      };
    } catch (error) {
      logger.error(`Error generating text: ${(error as Error).message}`);
      return { data: '', error: (error as Error).message };
    }
  }

  /**
   * Generate completion from a list of messages
   */
  async generateCompletion(
    messages: MessageContent[],
    modelType: ModelType = this.defaultModelType,
    options: CompletionOptions = {}
  ): Promise<ModelResponse<string>> {
    try {
      const { processedMessages, outputParser, metadata } = await this.processMessagesAndOptions(messages, options);
      
      const client = this.getClient(modelType);
      const result = await client.generateCompletion(processedMessages, options);

      // Parse output if parser is provided
      if (outputParser && result.data) {
        const parseResult = await LangChainHelper.parseOutput(
          result.data,
          outputParser,
          options.outputParser?.fallbackValue
        );
        
        return {
          data: parseResult.data,
          error: parseResult.success ? result.error : parseResult.error,
          metadata: { ...result.metadata, ...metadata, parsedWithSchema: parseResult.success }
        };
      }

      return {
        ...result,
        metadata: { ...result.metadata, ...metadata }
      };
    } catch (error) {
      logger.error(`Error generating completion: ${(error as Error).message}`);
      return { data: '', error: (error as Error).message };
    }
  }

  /**
   * Generate structured output based on schema
   */
  async generateStructuredOutput<T = Record<string, any>>(
    messages: MessageContent[],
    modelType: ModelType = this.defaultModelType,
    options: CompletionOptions = {}
  ): Promise<ModelResponse<T>> {
    try {
      const { processedMessages, outputParser, metadata } = await this.processMessagesAndOptions(messages, options);
      
      const client = this.getClient(modelType);
      // Ensure JSON output format is set
      options.responseFormat = { type: 'json_object' };
      const result = await client.generateStructuredOutput<T>(processedMessages, options);

      // Parse output if parser is provided
      if (outputParser && result.data) {
        const parseResult = await LangChainHelper.parseOutput<T>(
          typeof result.data === 'string' ? result.data : JSON.stringify(result.data),
          outputParser,
          options.outputParser?.fallbackValue
        );
        
        return {
          data: parseResult.data,
          error: parseResult.success ? result.error : parseResult.error,
          metadata: { ...result.metadata, ...metadata, parsedWithSchema: parseResult.success }
        };
      }

      return {
        ...result,
        metadata: { ...result.metadata, ...metadata }
      };
    } catch (error) {
      logger.error(`Error generating structured output: ${(error as Error).message}`);
      return { data: {} as T, error: (error as Error).message };
    }
  }

  /**
   * Enhanced perform web search with analysis using Perplexity Sonar Pro model
   * Now supports input data substitution and output parsing
   */
  async performWebSearch<T = any>(
    options: WebSearchOptions
  ): Promise<ModelResponse<T>> {
    try {
      const { processedMessages, outputParser, metadata } = await this.processMessagesAndOptions(
        options.messages,
        {
          inputData: options.inputData,
          outputParser: options.outputParser
        }
      );

      const enhancedOptions: WebSearchOptions = {
        ...options,
        messages: processedMessages
      };

      // Use OpenRouter client with Perplexity model for web search and analysis
      const result = await this.openRouterClient.performWebSearch<T>(enhancedOptions);

      // Parse output if parser is provided
      if (outputParser && result.data) {
        const parseResult = await LangChainHelper.parseOutput<T>(
          typeof result.data === 'string' ? result.data : JSON.stringify(result.data),
          outputParser,
          options.outputParser?.fallbackValue
        );
        
        return {
          data: parseResult.data,
          error: parseResult.success ? result.error : parseResult.error,
          metadata: { ...result.metadata, ...metadata, parsedWithSchema: parseResult.success }
        };
      }

      return {
        ...result,
        metadata: { ...result.metadata, ...metadata }
      };
    } catch (error) {
      logger.error(`Error performing web search: ${(error as Error).message}`);
      return {
        data: {} as T,
        error: (error as Error).message
      };
    }
  }

  /**
   * Analyze image or video content using OpenRouter's multimodal capabilities
   */
  async analyzeMedia(
    options: MediaAnalysisOptions
  ): Promise<ModelResponse<any>> {
    try {
      // Handle input data substitution for media analysis
      let processedPrompt = options.prompt;
      let metadata: any = { inputDataUsed: false, parsedWithSchema: false };

      if (options.inputData) {
        const messages = [{ role: 'user' as const, content: options.prompt }];
        const substitutionResult = await LangChainHelper.substituteVariables(
          messages,
          options.inputData
        );
        
        // Extract text from potentially multimodal content
        const firstMessage = substitutionResult.messages[0];
        if (Array.isArray(firstMessage.content)) {
          processedPrompt = firstMessage.content
            .filter(part => part.type === 'text')
            .map(part => part.text || '')
            .join(' ');
        } else {
          processedPrompt = firstMessage.content;
        }
        
        metadata.inputDataUsed = true;
        metadata.templateVariablesDetected = substitutionResult.templateVariables;
      }

      // Setup output parser if provided
      let outputParser;
      if (options.outputParser) {
        outputParser = LangChainHelper.createOutputParser(options.outputParser);
        metadata.parsedWithSchema = true;

        const formatInstructions = LangChainHelper.getFormatInstructions(outputParser);
        if (formatInstructions) {
          processedPrompt += `\n\n${formatInstructions}`;
        }
      }

      const enhancedOptions: MediaAnalysisOptions = {
        ...options,
        prompt: processedPrompt
      };

      // Use OpenRouter for multimodal analysis (supports Gemini and other vision models)
      const result = await this.openRouterClient.analyzeMedia(enhancedOptions);

      // Parse output if parser is provided
      if (outputParser && result.data) {
        const parseResult = await LangChainHelper.parseOutput(
          typeof result.data === 'string' ? result.data : JSON.stringify(result.data),
          outputParser,
          options.outputParser?.fallbackValue
        );
        
        return {
          data: parseResult.data,
          error: parseResult.success ? result.error : parseResult.error,
          metadata: { ...result.metadata, ...metadata, parsedWithSchema: parseResult.success }
        };
      }

      return {
        ...result,
        metadata: { ...result.metadata, ...metadata }
      };
    } catch (error) {
      logger.error(`Error analyzing media: ${(error as Error).message}`);
      return { data: {}, error: (error as Error).message };
    }
  }

  /**
   * Generate images using OpenAI's image generation models
   */
  async generateImage(
    prompt: string,
    options: ImageGenerationOptions = {}
  ): Promise<ModelResponse<ImageGenerationResponse>> {
    try {
      // OpenAI is best for image generation
      return await this.openAIClient.generateImage(prompt, options);
    } catch (error) {
      logger.error(`Error generating images: ${(error as Error).message}`);
      return { 
        data: { 
          created: Date.now(), 
          images: [] 
        }, 
        error: (error as Error).message 
      };
    }
  }
}

// Create singleton instance
export const llmService = new LLMService(); 