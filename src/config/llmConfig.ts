/**
 * Configuration for the LLM (Large Language Model) service
 * Loads settings from environment variables
 */
import dotenv from 'dotenv';
import { LLMConfig, ModelType } from '../types/llmTypes';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

// Validate required environment variables
const validateEnv = () => {
  const requiredVars = [
    'OPENROUTER_API_KEY',
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    logger.warn(`Missing required environment variables for LLM service: ${missingVars.join(', ')}`);
  }
};

validateEnv();

// Default configuration
const llmConfig: LLMConfig = {
  // OpenRouter configuration (for accessing various models including Gemini)
  gemini_flash: {
    model: process.env.OPENROUTER_GEMINI_MODEL_FLASH || 'google/gemini-2.5-flash',
    apiKey: process.env.OPENROUTER_API_KEY || '',
    baseURL: 'https://openrouter.ai/api/v1',
    temperature: parseFloat(process.env.OPENROUTER_GEMINI_TEMPERATURE || '0.4'),
    maxTokens: parseInt(process.env.OPENROUTER_GEMINI_MAX_TOKENS || '4096'),
  },

  openrouter: {
    model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
    apiKey: process.env.OPENROUTER_API_KEY || '',
    baseURL: 'https://openrouter.ai/api/v1',
    temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE || '0.4'),
    maxTokens: parseInt(process.env.OPENROUTER_MAX_TOKENS || '4096'),
  },

  // OpenAI configuration (primarily for image generation)
  openai: {
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY || '',
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.1'),
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4096'),
  },

  // Web Search configuration (using Perplexity Sonar Pro via OpenRouter)
  webSearch: {
    model: process.env.WEB_SEARCH_MODEL || 'perplexity/sonar-pro',
    apiKey: process.env.OPENROUTER_API_KEY || '',
    baseURL: 'https://openrouter.ai/api/v1',
    temperature: parseFloat(process.env.WEB_SEARCH_TEMPERATURE || '0.1'),
    maxTokens: parseInt(process.env.WEB_SEARCH_MAX_TOKENS || '4096'),
  },
  
  // Default model to use
  defaultModel: (process.env.DEFAULT_LLM_MODEL as ModelType) || ModelType.OPENROUTER,
};

export default llmConfig; 