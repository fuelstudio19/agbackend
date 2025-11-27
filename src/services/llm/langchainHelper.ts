/**
 * LangChain Helper Service for template substitution and output parsing
 */

import { PromptTemplate } from '@langchain/core/prompts';
import { OutputFixingParser } from 'langchain/output_parsers';
import { z } from 'zod';
import { 
  InputData, 
  OutputParserOptions, 
  OutputParserType, 
  MessageContent,
  VariableSubstitution 
} from '../../types/llmTypes';
import { logger } from '../../utils/logger';

export class LangChainHelper {
  
  /**
   * Substitute variables in prompt templates using LangChain
   */
  static async substituteVariables(
    messages: MessageContent[],
    inputData: InputData
  ): Promise<{ messages: MessageContent[]; templateVariables: string[] }> {
    try {
      const processedMessages: MessageContent[] = [];
      const allTemplateVariables: Set<string> = new Set();


      for (const message of messages) {
        // Handle multimodal content (array format)
        if (Array.isArray(message.content)) {
          // For multimodal content, only process text parts for variable substitution
          const processedContent = await Promise.all(
            message.content.map(async (part) => {
              if (part.type === 'text' && part.text) {
                const templateVariables = this.extractTemplateVariables(part.text);
                templateVariables.forEach(variable => allTemplateVariables.add(variable));

                if (templateVariables.length > 0) {
                  const substitutedText = this.performVariableSubstitution(part.text, inputData);
                  return { ...part, text: substitutedText };
                }
                return part;
              }
              return part; // Return image_url parts unchanged
            })
          );

          processedMessages.push({
            ...message,
            content: processedContent
          });
        } else {
          // Handle string content (legacy format)
          const content = message.content as string;
          const templateVariables = this.extractTemplateVariables(content);
          templateVariables.forEach(variable => allTemplateVariables.add(variable));

          if (templateVariables.length > 0) {
            // Perform targeted variable substitution
            const substitutedContent = this.performVariableSubstitution(content, inputData);
            
            processedMessages.push({
              ...message,
              content: substitutedContent
            });
          } else {
            // No template variables found, keep original message
            processedMessages.push(message);
          }
        }
      }

      return {
        messages: processedMessages,
        templateVariables: Array.from(allTemplateVariables)
      };
    } catch (error) {
      logger.error('Error substituting variables:', error);
      throw new Error(`Variable substitution failed: ${(error as Error).message}`);
    }
  }

  /**
   * Perform variable substitution without interfering with literal braces
   */
  private static performVariableSubstitution(content: string, inputData: InputData): string {
    let result = content;
    
    // Only substitute variables that exist in inputData
    Object.keys(inputData).forEach(key => {
      const placeholder = `{${key}}`;
      const value = String(inputData[key]);
      result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    });
    
    return result;
  }

  /**
   * Extract template variables from content (e.g., {variable_name})
   */
  private static extractTemplateVariables(content: string): string[] {
    const variablePattern = /\{([^}]+)\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variablePattern.exec(content)) !== null) {
      variables.push(match[1]);
    }

    return variables;
  }

  /**
   * Create output parser based on options
   */
  static createOutputParser(options: OutputParserOptions): any {
    try {
      switch (options.type) {
        case OutputParserType.JSON:
          return this.createJsonOutputParser(options);
        
        case OutputParserType.ZOD:
          return this.createZodOutputParser(options);
        
        case OutputParserType.STRUCTURED:
          return this.createStructuredOutputParser(options);
        
        default:
          logger.warn(`Unsupported output parser type: ${options.type}`);
          return null;
      }
    } catch (error) {
      logger.error('Error creating output parser:', error);
      throw new Error(`Output parser creation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Create JSON output parser
   */
  private static createJsonOutputParser(options: OutputParserOptions) {
    const { OutputFixingParser } = require('langchain/output_parsers');
    const { JsonOutputParser } = require('@langchain/core/output_parsers');
    
    const baseParser = new JsonOutputParser();
    
    if (options.strictMode) {
      return OutputFixingParser.fromLLM(baseParser);
    }
    
    return baseParser;
  }

  /**
   * Create Zod output parser
   */
  private static createZodOutputParser(options: OutputParserOptions) {
    if (!options.zodSchema) {
      throw new Error('Zod schema is required for ZOD output parser type');
    }

    const { StructuredOutputParser } = require('langchain/output_parsers');
    return StructuredOutputParser.fromZodSchema(options.zodSchema);
  }

  /**
   * Create structured output parser from JSON schema
   */
  private static createStructuredOutputParser(options: OutputParserOptions) {
    if (!options.schema) {
      throw new Error('JSON schema is required for STRUCTURED output parser type');
    }

    const { StructuredOutputParser } = require('langchain/output_parsers');
    return StructuredOutputParser.fromJsonSchema(options.schema);
  }

  /**
   * Clean empty strings for optional URL fields to prevent Zod validation errors
   * Converts empty strings to undefined for optional fields
   */
  private static cleanEmptyStringsForOptionalFields(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const cleaned = { ...data };
    
    // List of optional URL fields that should be undefined instead of empty strings
    const optionalUrlFields = [
      'meta_ad_dashboard_url',
      'company_logo',
      'logo',
      'product_image'
    ];

    optionalUrlFields.forEach(field => {
      if (cleaned[field] === '') {
        cleaned[field] = undefined;
      }
    });

    // Also clean nested arrays (like competitor_details)
    if (Array.isArray(cleaned.competitor_details)) {
      cleaned.competitor_details = cleaned.competitor_details.map((item: any) => 
        this.cleanEmptyStringsForOptionalFields(item)
      );
    }

    if (Array.isArray(cleaned.product_details)) {
      cleaned.product_details = cleaned.product_details.map((item: any) => 
        this.cleanEmptyStringsForOptionalFields(item)
      );
    }

    return cleaned;
  }

  /**
   * Parse output using the specified parser
   */
  static async parseOutput<T = any>(
    output: string,
    parser: any,
    fallbackValue?: any
  ): Promise<{ data: T; success: boolean; error?: string }> {
    try {
      // First, try to parse as JSON and clean empty strings for optional fields
      let cleanedOutput = output;
      try {
        const jsonData = JSON.parse(output);
        const cleanedData = this.cleanEmptyStringsForOptionalFields(jsonData);
        cleanedOutput = JSON.stringify(cleanedData);
      } catch {
        // If not valid JSON, keep original output
      }

      const parsedData = await parser.parse(cleanedOutput);
      return {
        data: parsedData,
        success: true
      };
    } catch (error) {
      logger.warn('Output parsing failed, using fallback:', error);
      
      if (fallbackValue !== undefined) {
        return {
          data: fallbackValue,
          success: false,
          error: (error as Error).message
        };
      }

      // Try to parse as JSON as last resort
      try {
        const jsonData = JSON.parse(output);
        // Clean empty strings for optional fields before returning
        const cleanedData = this.cleanEmptyStringsForOptionalFields(jsonData);
        return {
          data: cleanedData,
          success: false,
          error: `Parser failed, but JSON parsing succeeded: ${(error as Error).message}`
        };
      } catch (jsonError) {
        throw new Error(`Both parsing and JSON fallback failed: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Get format instructions for the parser
   */
  static getFormatInstructions(parser: any): string {
    try {
      if (parser && typeof parser.getFormatInstructions === 'function') {
        return parser.getFormatInstructions();
      }
      return '';
    } catch (error) {
      logger.warn('Could not get format instructions:', error);
      return '';
    }
  }

  /**
   * Validate input data against template variables
   */
  static validateInputData(
    inputData: InputData,
    templateVariables: string[]
  ): { valid: boolean; missingVariables: string[] } {
    const missingVariables = templateVariables.filter(
      variable => !(variable in inputData)
    );

    return {
      valid: missingVariables.length === 0,
      missingVariables
    };
  }
} 