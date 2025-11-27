/**
 * Client for OpenRouter API - provides access to various LLM models via a unified API using Langchain
 */
import { ChatOpenAI } from '@langchain/openai';
import { BaseLLMClient } from './baseLLMClient';
import {
  ModelConfig,
  MessageContent,
  CompletionOptions,
  ModelResponse,
  WebSearchOptions,
  MediaAnalysisOptions,
  OutputParserType
} from '../../../types/llmTypes';
import { logger } from '../../../utils/logger';

export class OpenRouterClient extends BaseLLMClient {
  private client: ChatOpenAI;
  private webSearchClient?: ChatOpenAI;

  constructor(config?: ModelConfig, webSearchConfig?: ModelConfig) {
    super(config);
    
    this.client = new ChatOpenAI({
      openAIApiKey: this.config.apiKey,
      configuration: {
        baseURL: this.config.baseURL || 'https://openrouter.ai/api/v1'
      },
      modelName: this.config.model,
      temperature: this.config.temperature ?? 0.1,
      maxTokens: this.config.maxTokens ?? 4096,
    });

    if (webSearchConfig) {
      this.webSearchClient = new ChatOpenAI({
        openAIApiKey: webSearchConfig.apiKey,
        configuration: {
          baseURL: webSearchConfig.baseURL || 'https://openrouter.ai/api/v1'
        },
        modelName: webSearchConfig.model,
        temperature: webSearchConfig.temperature ?? 0.1,
        maxTokens: webSearchConfig.maxTokens ?? 4096,
      });
    }
    
    logger.info(`OpenRouter client initialized with model: ${this.config.model}`);
    logger.info(`OpenRouter API key configured: ${this.config.apiKey ? 'Yes' : 'No'}`);
    
    if (webSearchConfig) {
      logger.info(`Web search enabled with model: ${webSearchConfig.model}`);
      logger.info(`Web search API key configured: ${webSearchConfig.apiKey ? 'Yes' : 'No'}`);
    }
  }

  /**
   * Generate text completion from a simple prompt
   */
  async generateText(
    prompt: string,
    options?: CompletionOptions
  ): Promise<ModelResponse<string>> {
    const startTime = Date.now();
    
    try {
      const parser = this.createOutputParser(options?.outputParser);
      
      // Create messages array
      const messages = this.convertMessages([
        { role: 'user', content: prompt }
      ]);

      // Create chain
      const chain = this.client.pipe(parser);
      
      // Invoke the chain
      const response = await chain.invoke(messages);

      const processingTime = Date.now() - startTime;
      
      // If output parser is specified, parse the response
      if (options?.outputParser) {
        const parseResult = await this.parseOutput<string>(
          typeof response === 'string' ? response : JSON.stringify(response),
          parser,
          options.outputParser.fallbackValue,
          options.retryCount ?? 2
        );

        return {
          data: parseResult.data,
          error: parseResult.error,
          metadata: {
            model: this.config.model,
            processingTime,
            parsingMethod: parseResult.parsingMethod
          }
        };
      }

      return {
        data: typeof response === 'string' ? response : JSON.stringify(response),
        metadata: {
          model: this.config.model,
          processingTime,
          parsingMethod: 'raw'
        }
      };
    } catch (error) {
      logger.error(`OpenRouter generateText error: ${(error as Error).message}`);
      return { 
        data: '', 
        error: (error as Error).message,
        metadata: {
          model: this.config.model,
          processingTime: Date.now() - startTime,
          parsingMethod: 'error'
        }
      };
    }
  }

  /**
   * Generate completion from a list of messages
   */
  async generateCompletion(
    messages: MessageContent[],
    options?: CompletionOptions
  ): Promise<ModelResponse<string>> {
    const startTime = Date.now();
    
    try {
      const parser = this.createOutputParser(options?.outputParser);
      
      // Convert messages to Langchain format
      const langchainMessages = this.convertMessages(messages);

      // Create chain
      const chain = this.client.pipe(parser);
      
      // Invoke the chain
      const response = await chain.invoke(langchainMessages);

      const processingTime = Date.now() - startTime;
      
      // If output parser is specified, parse the response
      if (options?.outputParser) {
        const parseResult = await this.parseOutput<string>(
          typeof response === 'string' ? response : JSON.stringify(response),
          parser,
          options.outputParser.fallbackValue,
          options.retryCount ?? 2
        );

        return {
          data: parseResult.data,
          error: parseResult.error,
          metadata: {
            model: this.config.model,
            processingTime,
            parsingMethod: parseResult.parsingMethod
          }
        };
      }

      return {
        data: typeof response === 'string' ? response : JSON.stringify(response),
        metadata: {
          model: this.config.model,
          processingTime,
          parsingMethod: 'raw'
        }
      };
    } catch (error) {
      logger.error(`OpenRouter generateCompletion error: ${(error as Error).message}`);
      return { 
        data: '', 
        error: (error as Error).message,
        metadata: {
          model: this.config.model,
          processingTime: Date.now() - startTime,
          parsingMethod: 'error'
        }
      };
    }
  }

  /**
   * Generate structured output in JSON format
   */
  async generateStructuredOutput<T = Record<string, any>>(
    messages: MessageContent[],
    options?: CompletionOptions
  ): Promise<ModelResponse<T>> {
    const startTime = Date.now();
    
    try {
      // Force JSON output parser for structured output
      const jsonOptions = {
        ...options,
        outputParser: {
          type: OutputParserType.JSON,
          schema: options?.outputParser?.schema,
          fallbackValue: options?.outputParser?.fallbackValue || {} as T
        }
      };

      const parser = this.createOutputParser(jsonOptions.outputParser);
      
      // Add JSON format instruction to the last user message
      const modifiedMessages = [...messages];
      if (modifiedMessages.length > 0) {
        const lastMessage = modifiedMessages[modifiedMessages.length - 1];
        if (lastMessage.role === 'user') {
          lastMessage.content += '\n\nPlease respond with valid JSON only.';
        }
      }

      // Convert messages to Langchain format
      const langchainMessages = this.convertMessages(modifiedMessages);

      // Create chain
      const chain = this.client.pipe(parser);
      
      // Invoke the chain
      const response = await chain.invoke(langchainMessages);

      const processingTime = Date.now() - startTime;

      // Parse the output
      const parseResult = await this.parseOutput<T>(
        typeof response === 'string' ? response : JSON.stringify(response),
        parser,
        jsonOptions.outputParser.fallbackValue,
        options?.retryCount ?? 2
      );

      // Validate against schema if provided
      let validatedData = parseResult.data;
      let validationError: string | undefined = parseResult.error;

      if (jsonOptions.outputParser.schema) {
        const validation = this.validateOutput<T>(parseResult.data, jsonOptions.outputParser.schema);
        validatedData = validation.data;
        if (validation.error) {
          validationError = validationError 
            ? `${validationError}; ${validation.error}` 
            : validation.error;
        }
      }

      return {
        data: validatedData,
        error: validationError,
        metadata: {
          model: this.config.model,
          processingTime,
          parsingMethod: parseResult.parsingMethod
        }
      };
    } catch (error) {
      logger.error(`OpenRouter generateStructuredOutput error: ${(error as Error).message}`);
      return { 
        data: {} as T, 
        error: (error as Error).message,
        metadata: {
          model: this.config.model,
          processingTime: Date.now() - startTime,
          parsingMethod: 'error'
        }
      };
    }
  }

  /**
   * Perform web search with analysis using Perplexity Sonar Pro model
   */
  async performWebSearch<T = any>(
    options: WebSearchOptions
  ): Promise<ModelResponse<T>> {
    const startTime = Date.now();
    
    if (!this.webSearchClient) {
      return {
        data: {} as T,
        error: 'Web search not configured',
        metadata: {
          model: 'none',
          processingTime: Date.now() - startTime,
          parsingMethod: 'error'
        }
      };
    }

    try {
      logger.info(`Making web search request with Langchain`);
      
      // Create parser based on response format
      const parser = options.responseFormat?.type === 'json_object' 
        ? this.createOutputParser({ type: OutputParserType.JSON })
        : this.createOutputParser();
      
      // Convert messages to Langchain format
      const langchainMessages = this.convertMessages(options.messages);

      // Create chain
      const chain = this.webSearchClient.pipe(parser);
      
      // Invoke the chain
      const response = await chain.invoke(langchainMessages);

      const processingTime = Date.now() - startTime;
      
      logger.info(`Web search response received: ${JSON.stringify(response).length} characters`);

      // Parse the output based on format
      if (options.responseFormat?.type === 'json_object') {
        const parseResult = await this.parseOutput<T>(
          typeof response === 'string' ? response : JSON.stringify(response),
          parser,
          {} as T,
          2
        );

        return {
          data: parseResult.data,
          error: parseResult.error,
          metadata: {
            model: this.webSearchClient.modelName,
            processingTime,
            parsingMethod: parseResult.parsingMethod
          }
        };
      } else {
        return {
          data: response as T,
          metadata: {
            model: this.webSearchClient.modelName,
            processingTime,
            parsingMethod: 'raw'
          }
        };
      }
    } catch (error) {
      logger.error(`Web search error: ${(error as Error).message}`);
      return {
        data: {} as T,
        error: (error as Error).message,
        metadata: {
          model: this.webSearchClient?.modelName || 'unknown',
          processingTime: Date.now() - startTime,
          parsingMethod: 'error'
        }
      };
    }
  }

  /**
   * Analyze image or video content using OpenRouter's multimodal capabilities
   */
  async analyzeMedia(
    options: MediaAnalysisOptions
  ): Promise<ModelResponse<any>> {
    const startTime = Date.now();
    
    try {
      const parser = this.createOutputParser(options.outputParser);

      // Create content parts for multimodal input
      const contentParts: any[] = [
        {
          type: 'text',
          text: options.prompt
        }
      ];

      // Handle image URLs
      if (options.mediaUrls && options.mediaUrls.length > 0) {
        for (const imageUrl of options.mediaUrls) {
          contentParts.push({
            type: 'image_url',
            image_url: {
              url: imageUrl
            }
          });
        }
      }
      // Handle single media URL (legacy support)
      else if (options.mediaUrl) {
        contentParts.push({
          type: 'image_url',
          image_url: {
            url: options.mediaUrl
          }
        });
      }

      // Create message with multimodal content
      const message = {
        role: 'user' as const,
        content: contentParts
      };

      // Create a new client instance with updated configuration if temperature or maxTokens are provided
      let clientToUse = this.client;
      if (options.temperature !== undefined || options.maxTokens !== undefined) {
        clientToUse = new ChatOpenAI({
          openAIApiKey: this.config.apiKey,
          configuration: {
            baseURL: this.config.baseURL || 'https://openrouter.ai/api/v1'
          },
          modelName: this.config.model,
          temperature: options.temperature ?? this.config.temperature ?? 0.1,
          maxTokens: options.maxTokens ?? this.config.maxTokens ?? 4096,
        });
      }

      // Convert to Langchain messages
      const langchainMessages = this.convertMessages([message]);

      // Create chain
      const chain = clientToUse.pipe(parser);
      
      // Invoke the chain
      const response = await chain.invoke(langchainMessages);

      const processingTime = Date.now() - startTime;

      // Parse the output
      if (options.outputParser) {
        const parseResult = await this.parseOutput<any>(
          typeof response === 'string' ? response : JSON.stringify(response),
          parser,
          options.outputParser.fallbackValue,
          2
        );

        return {
          data: parseResult.data,
          error: parseResult.error,
          metadata: {
            model: this.config.model,
            processingTime,
            parsingMethod: parseResult.parsingMethod,
            imagesProcessed: (options.mediaUrls?.length || 0) + (options.mediaUrl ? 1 : 0)
          }
        };
      }

      return {
        data: typeof response === 'string' ? response : response,
        metadata: {
          model: this.config.model,
          processingTime,
          parsingMethod: 'raw',
          imagesProcessed: (options.mediaUrls?.length || 0) + (options.mediaUrl ? 1 : 0)
        }
      };
    } catch (error) {
      logger.error(`OpenRouter analyzeMedia error: ${(error as Error).message}`);
      return { 
        data: {}, 
        error: (error as Error).message,
        metadata: {
          model: this.config.model,
          processingTime: Date.now() - startTime,
          parsingMethod: 'error'
        }
      };
    }
  }
} 