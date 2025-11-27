/**
 * Types for the LLM (Large Language Model) service
 */

export enum ModelType {
  OPENROUTER = 'openrouter',
  GEMINI = 'gemini',
  OPENAI = 'openai',
  WEB_SEARCH = 'web_search',
}

export interface ModelConfig {
  model: string;
  apiKey: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMConfig {
  openrouter?: ModelConfig;
  gemini_flash?: ModelConfig;
  openai?: ModelConfig;
  webSearch?: ModelConfig;
  defaultModel: ModelType;
}

export interface MessageContent {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
    };
  }>;
}

export interface FunctionParameter {
  type: string;
  description?: string;
  enum?: string[];
  properties?: Record<string, FunctionParameter>;
  items?: FunctionParameter;
  required?: string[];
}

export interface FunctionDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: {
      type: 'object';
      properties: Record<string, FunctionParameter>;
      required?: string[];
    };
  };
}

export interface WebSearchTool {
  type: 'web_search';
  web_search: {
    url?: string;
  };
}

export interface WebSearchResponse {
  query?: string;
  results?: Array<{
    title: string;
    url: string;
    snippet: string;
    publishedDate?: string;
  }>;
  answer?: string;
}

// Enhanced interfaces for langchain integration
export interface InputData {
  [key: string]: any;
}

export interface VariableSubstitution {
  inputData: InputData;
  templateVariables?: string[];
}

export interface WebSearchOptions {
  messages: MessageContent[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: 'json_object' | 'text' };
  inputData?: InputData;
  outputParser?: OutputParserOptions;
}

// Langchain-specific types
export enum OutputParserType {
  JSON = 'json',
  CSV = 'csv',
  YAML = 'yaml',
  LIST = 'list',
  BOOLEAN = 'boolean',
  DATETIME = 'datetime',
  REGEX = 'regex',
  STRUCTURED = 'structured',
  ZOD = 'zod'
}

export interface JsonSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
  enum?: any[];
  description?: string;
}

export interface OutputParserOptions {
  type: OutputParserType;
  schema?: JsonSchema;
  zodSchema?: any; // For Zod schema support
  instructions?: string;
  examples?: Array<{ input: string; output: any }>;
  fallbackValue?: any;
  strictMode?: boolean;
}

export interface EnhancedCompletionOptions extends CompletionOptions {
  inputData?: InputData;
  outputParser?: OutputParserOptions;
}

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  tools?: (FunctionDefinition | WebSearchTool)[];
  responseFormat?: { type: 'json_object' | 'text' };
  outputParser?: OutputParserOptions;
  retryCount?: number;
  inputData?: InputData;
}

export interface ImageGenerationOptions {
  n?: number;
  model?: string;
  quality?: 'low' | 'medium' | 'high';
  outputFormat?: 'png' | 'jpeg' | 'webp';
  outputCompression?: number;
  returnFormat?: 'url' | 'b64_json';
  referenceImageUrls?: string[];
}

export interface MediaAnalysisOptions {
  mediaType: 'image' | 'video';
  mediaUrl?: string;
  mediaUrls?: string[]; // Support multiple images
  prompt: string;
  outputFormat?: Record<string, any>;
  outputParser?: OutputParserOptions;
  inputData?: InputData;
  temperature?: number;
  maxTokens?: number;
}

export type GeneratedImage = {
  url?: string;
  b64_json?: string;
};

export interface ImageGenerationResponse {
  created: number;
  images: GeneratedImage[];
  usage?: Record<string, any>;
  error?: string;
}

export interface ModelResponse<T> {
  data: T;
  error?: string;
  metadata?: {
    model?: string;
    usage?: any;
    processingTime?: number;
    parsingMethod?: string;
    parsedWithSchema?: boolean;
    inputDataUsed?: boolean;
    templateVariablesDetected?: string[];
    imagesProcessed?: number; // For multimodal analysis
    [key: string]: any; // Allow additional metadata properties
  };
}

// Enhanced web search options with langchain support
export interface EnhancedWebSearchOptions extends WebSearchOptions {
  promptTemplate?: string;
  inputData?: InputData;
  outputParser?: OutputParserOptions;
} 