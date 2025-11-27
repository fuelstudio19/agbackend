/**
 * Utility functions for handling JSON in LLM responses
 */
import { logger } from '../../../utils/logger';

/**
 * Safely parse JSON from a string that might contain JSON
 * inside markdown code blocks or other text.
 * 
 * @param text - The text to parse
 * @param defaultValue - Default value to return if parsing fails
 * @returns The parsed JSON or default value if parsing fails
 */
export function parseJsonFromText<T = any>(text: string, defaultValue: T): T {
  try {
    // Try to parse the input directly as JSON
    return JSON.parse(text) as T;
  } catch (directError) {
    // If direct parsing fails, try to extract JSON from markdown code blocks
    try {
      if (text.includes('```json')) {
        // Extract JSON from ```json code blocks
        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          return JSON.parse(jsonMatch[1]) as T;
        }
      } else if (text.includes('```')) {
        // Try to extract from generic code blocks
        const codeMatch = text.match(/```\s*([\s\S]*?)\s*```/);
        if (codeMatch && codeMatch[1]) {
          return JSON.parse(codeMatch[1]) as T;
        }
      }
      
      // Look for JSON-like content between curly braces (more aggressive approach)
      const curlyBraceMatch = text.match(/(\{[\s\S]*\})/);
      if (curlyBraceMatch && curlyBraceMatch[1]) {
        return JSON.parse(curlyBraceMatch[1]) as T;
      }
      
      // If all extraction attempts fail, log and return default
      logger.error(`Could not extract valid JSON from response: ${(directError as Error).message}`);
      return defaultValue;
    } catch (extractError) {
      logger.error(`Failed to parse extracted content as JSON: ${(extractError as Error).message}`);
      return defaultValue;
    }
  }
}

/**
 * Ensures a response is in valid JSON format by parsing and stringifying
 * 
 * @param data - The data to validate
 * @returns The validated and formatted JSON string
 */
export function ensureValidJson(data: any): string {
  try {
    // If it's already a string, try to parse and re-stringify to validate
    if (typeof data === 'string') {
      const parsed = JSON.parse(data);
      return JSON.stringify(parsed, null, 2);
    }
    
    // If it's an object, just stringify it
    return JSON.stringify(data, null, 2);
  } catch (error) {
    logger.error(`Failed to ensure valid JSON: ${(error as Error).message}`);
    throw new Error(`Invalid JSON format: ${(error as Error).message}`);
  }
} 