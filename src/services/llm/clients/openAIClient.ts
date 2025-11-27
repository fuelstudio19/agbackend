/**
 * Client for OpenAI API - primarily used for image generation and text completions using Langchain
 */
import { OpenAI } from 'openai';
import { ChatOpenAI } from '@langchain/openai';
import { RunnableSequence } from '@langchain/core/runnables';
import axios from 'axios';
import { BaseLLMClient } from './baseLLMClient';
import {
  ModelConfig,
  MessageContent,
  CompletionOptions,
  ImageGenerationOptions,
  ModelResponse,
  ImageGenerationResponse,
  OutputParserType
} from '../../../types/llmTypes';
import { logger } from '../../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class OpenAIClient extends BaseLLMClient {
  private chatClient: ChatOpenAI;
  private imageClient: OpenAI;
  private isConfigured: boolean;

  constructor(config?: ModelConfig) {
    super(config);
    
    this.isConfigured = !!this.config.apiKey;
    
    // Chat client using Langchain
    this.chatClient = new ChatOpenAI({
      openAIApiKey: this.config.apiKey || '',
      modelName: this.config.model || 'gpt-4o',
      temperature: this.config.temperature ?? 0.1,
      maxTokens: this.config.maxTokens ?? 4096,
    });

    // Direct OpenAI client for image generation
    this.imageClient = new OpenAI({
      apiKey: this.config.apiKey || '',
    });
    
    if (this.isConfigured) {
      logger.info(`OpenAI client initialized with model: ${this.config.model}`);
    } else {
      logger.warn('OpenAI client not fully configured - API key missing');
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
    
    if (!this.isConfigured) {
      return {
        data: '',
        error: 'OpenAI client not configured - API key missing',
        metadata: {
          model: this.config.model,
          processingTime: Date.now() - startTime,
          parsingMethod: 'error'
        }
      };
    }

    try {
      const parser = this.createOutputParser(options?.outputParser);
      
      // Create messages array
      const messages = this.convertMessages([
        { role: 'user', content: prompt }
      ]);

      // Create chain using RunnableSequence
      const chain = RunnableSequence.from([this.chatClient, parser]);
      
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
      logger.error(`OpenAI generateText error: ${(error as Error).message}`);
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
    
    if (!this.isConfigured) {
      return {
        data: '',
        error: 'OpenAI client not configured - API key missing',
        metadata: {
          model: this.config.model,
          processingTime: Date.now() - startTime,
          parsingMethod: 'error'
        }
      };
    }

    try {
      const parser = this.createOutputParser(options?.outputParser);
      
      // Convert messages to Langchain format
      const langchainMessages = this.convertMessages(messages);

      // Create chain
      const chain = this.chatClient.pipe(parser);
      
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
      logger.error(`OpenAI generateCompletion error: ${(error as Error).message}`);
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
    
    if (!this.isConfigured) {
      return {
        data: {} as T,
        error: 'OpenAI client not configured - API key missing',
        metadata: {
          model: this.config.model,
          processingTime: Date.now() - startTime,
          parsingMethod: 'error'
        }
      };
    }

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
      const chain = this.chatClient.pipe(parser);
      
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
      logger.error(`OpenAI generateStructuredOutput error: ${(error as Error).message}`);
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
   * Generate images using OpenAI's DALL-E models (using direct OpenAI SDK)
   */
  async generateImage(
    prompt: string,
    options: ImageGenerationOptions = {}
  ): Promise<ModelResponse<ImageGenerationResponse>> {
    const startTime = Date.now();
    
    if (!this.isConfigured) {
      return {
        data: {
          created: Date.now(),
          images: []
        },
        error: 'OpenAI client not configured - API key missing',
        metadata: {
          model: this.config.model,
          processingTime: Date.now() - startTime,
          parsingMethod: 'error'
        }
      };
    }

    try {
      logger.info(`Generating image with prompt: ${prompt.slice(0, 100)}...`);
      
      const response = await this.imageClient.images.generate({
        prompt,
        n: options.n || 1,
        model: options.model || 'dall-e-3',
        quality: options.quality === 'high' ? 'hd' : 'standard',
        response_format: options.returnFormat || 'url',
        size: '1024x1024'
      });

      const processingTime = Date.now() - startTime;

      const images = response.data?.map(img => ({
        url: img.url,
        b64_json: img.b64_json
      })) || [];

      return {
        data: {
          created: response.created,
          images,
          usage: response.usage
        },
        metadata: {
          model: options.model || 'dall-e-3',
          processingTime,
          parsingMethod: 'direct'
        }
      };
    } catch (error) {
      logger.error(`OpenAI image generation error: ${(error as Error).message}`);
      return {
        data: {
          created: Date.now(),
          images: []
        },
        error: (error as Error).message,
        metadata: {
          model: options.model || 'dall-e-3',
          processingTime: Date.now() - startTime,
          parsingMethod: 'error'
        }
      };
    }
  }
} 