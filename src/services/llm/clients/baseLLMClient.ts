/**
 * Abstract base class for all LLM clients using Langchain
 */

import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import {
  ModelConfig,
  MessageContent,
  CompletionOptions,
  ImageGenerationOptions,
  MediaAnalysisOptions,
  ModelResponse,
  ImageGenerationResponse,
  WebSearchOptions,
  OutputParserType,
  OutputParserOptions,
  JsonSchema
} from '../../../types/llmTypes';
import { logger } from '../../../utils/logger';

/**
 * Base abstract class that all LLM clients must implement
 */
export abstract class BaseLLMClient {
  protected config: ModelConfig;
  protected model?: BaseLanguageModel;

  constructor(config?: ModelConfig) {
    this.config = config || {
      model: '',
      apiKey: '',
    };
  }

  /**
   * Convert MessageContent to Langchain BaseMessage format
   */
  protected convertMessages(messages: MessageContent[]): BaseMessage[] {
    return messages.map(msg => {
      // Handle multimodal content (array format)
      if (Array.isArray(msg.content)) {
        // For multimodal content, we need to serialize it for Langchain
        // This is a simplified approach - in a real implementation, you'd handle this properly
        const textContent = msg.content
          .map(part => {
            if (part.type === 'text') return part.text || '';
            if (part.type === 'image_url') return `[Image: ${part.image_url?.url || 'unknown'}]`;
            return '';
          })
          .join(' ');

        switch (msg.role) {
          case 'system':
            return new SystemMessage(textContent);
          case 'assistant':
            return new AIMessage(textContent);
          default:
            return new HumanMessage(textContent);
        }
      } else {
        // Handle string content (legacy format)
        const content = msg.content as string;
        switch (msg.role) {
          case 'system':
            return new SystemMessage(content);
          case 'assistant':
            return new AIMessage(content);
          default:
            return new HumanMessage(content);
        }
      }
    });
  }

  /**
   * Create output parser based on options
   */
  protected createOutputParser(options?: OutputParserOptions) {
    if (!options) {
      return new JsonOutputParser();
    }

    switch (options.type) {
      case OutputParserType.JSON:
        return new JsonOutputParser();
      
      case OutputParserType.LIST:
        // For list parsing, we'll use JSON parser with instructions
        return new JsonOutputParser();
      
      case OutputParserType.STRUCTURED:
        if (!options.schema) {
          logger.warn('Structured parser requires a schema, falling back to JSON parser');
          return new JsonOutputParser();
        }
        // Use JSON parser with schema validation in post-processing
        return new JsonOutputParser();
      
      default:
        return new JsonOutputParser();
    }
  }

  /**
   * Parse output with retry logic and fallback
   */
  protected async parseOutput<T>(
    output: string,
    parser: any,
    fallbackValue?: any,
    retryCount: number = 2
  ): Promise<{ data: T; error?: string; parsingMethod: string }> {
    let lastError: Error | null = null;

    // Try parsing with the specified parser
    for (let i = 0; i <= retryCount; i++) {
      try {
        const parsed = await parser.parse(output);
        return { data: parsed, parsingMethod: 'parser' };
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Parsing attempt ${i + 1} failed: ${lastError.message}`);
        
        if (i < retryCount) {
          // Try to clean the output for next attempt
          output = this.cleanOutput(output);
        }
      }
    }

    // Fallback to JSON parsing if original parser failed
    try {
      const jsonParsed = JSON.parse(this.cleanOutput(output));
      return { 
        data: jsonParsed, 
        error: `Primary parser failed, used JSON fallback: ${lastError?.message}`,
        parsingMethod: 'json_fallback'
      };
    } catch (jsonError) {
      logger.warn(`JSON fallback parsing failed: ${(jsonError as Error).message}`);
    }

    // Return fallback value or raw output
    if (fallbackValue !== undefined) {
      return { 
        data: fallbackValue, 
        error: `All parsing failed, used fallback: ${lastError?.message}`,
        parsingMethod: 'fallback'
      };
    }

    return { 
      data: output as T, 
      error: `All parsing failed, returned raw output: ${lastError?.message}`,
      parsingMethod: 'raw'
    };
  }

  /**
   * Clean output string for better parsing
   */
  private cleanOutput(output: string): string {
    // Remove markdown code blocks
    output = output.replace(/```json\s*\n?/g, '').replace(/```\s*\n?/g, '');
    
    // Remove leading/trailing whitespace
    output = output.trim();
    
    // Try to extract JSON from text using a more ES2015 compatible regex
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }
    
    return output;
  }

  /**
   * Validate output against schema if provided
   */
  protected validateOutput<T>(data: any, schema?: JsonSchema): { data: T; error?: string } {
    if (!schema) {
      return { data };
    }

    try {
      // Simple schema validation for basic types
      if (schema.type === 'object' && schema.properties) {
        const validated: any = {};
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          const prop = propSchema as JsonSchema;
          if (schema.required?.includes(key) && !(key in data)) {
            return { data, error: `Required property '${key}' is missing` };
          }
          if (key in data) {
            validated[key] = data[key];
          }
        }
        return { data: validated };
      }
      
      return { data };
    } catch (error) {
      return { data, error: `Schema validation failed: ${(error as Error).message}` };
    }
  }

  /**
   * Generate completion from a simple text prompt
   */
  abstract generateText(
    prompt: string,
    options?: CompletionOptions
  ): Promise<ModelResponse<string>>;

  /**
   * Generate completion from a list of messages
   */
  abstract generateCompletion(
    messages: MessageContent[],
    options?: CompletionOptions
  ): Promise<ModelResponse<string>>;

  /**
   * Generate structured output in JSON format
   */
  abstract generateStructuredOutput<T = Record<string, any>>(
    messages: MessageContent[],
    options?: CompletionOptions
  ): Promise<ModelResponse<T>>;

  /**
   * Analyze image or video content
   * Supported by clients with multimodal capabilities (e.g. OpenRouter with vision models)
   */
  async analyzeMedia(
    _options: MediaAnalysisOptions
  ): Promise<ModelResponse<any>> {
    return {
      data: {},
      error: 'Media analysis not supported by this model'
    };
  }

  /**
   * Generate images from a text prompt
   * Optional method that may be implemented by specific clients (e.g. DALL-E)
   */
  async generateImage(
    _prompt: string,
    _options?: ImageGenerationOptions
  ): Promise<ModelResponse<ImageGenerationResponse>> {
    return {
      data: {
        created: Date.now(),
        images: []
      },
      error: 'Image generation not supported by this model'
    };
  }

  /**
   * Perform web search with analysis
   * Optional method that may be implemented by specific clients (e.g. Perplexity via OpenRouter)
   */
  async performWebSearch<T = any>(
    _options: WebSearchOptions
  ): Promise<ModelResponse<T>> {
    return {
      data: {} as T,
      error: 'Web search not supported by this model'
    };
  }
} 