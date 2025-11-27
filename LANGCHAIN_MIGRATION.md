# Langchain Migration and Output Parser Implementation

This document outlines the migration from direct API calls to Langchain-based implementations with integrated output parsers for more predictable and structured outputs.

## Overview

The LLM service has been completely refactored to use Langchain with the following key improvements:

1. **Unified API**: All model providers (OpenRouter, Gemini, OpenAI) now use Langchain
2. **Output Parsers**: Built-in support for various output formats with automatic parsing
3. **Error Handling**: Robust error handling with fallback mechanisms
4. **Retry Logic**: Automatic retry with output cleaning for failed parsing attempts
5. **Schema Validation**: Optional schema validation for structured outputs
6. **Metadata**: Detailed response metadata including processing time and parsing methods

## New Dependencies

The following Langchain packages have been added:

```bash
npm install langchain @langchain/openai @langchain/google-genai @langchain/community
```

## Key Features

### 1. Output Parser Types

The service now supports multiple output parser types:

```typescript
enum OutputParserType {
  JSON = 'json',
  CSV = 'csv', 
  YAML = 'yaml',
  LIST = 'list',
  BOOLEAN = 'boolean',
  DATETIME = 'datetime',
  REGEX = 'regex',
  STRUCTURED = 'structured'
}
```

### 2. Enhanced Response Metadata

All responses now include detailed metadata:

```typescript
interface ModelResponse<T> {
  data: T;
  error?: string;
  metadata?: {
    model?: string;
    usage?: any;
    processingTime?: number;
    parsingMethod?: string; // 'parser', 'json_fallback', 'fallback', 'raw', 'error'
  };
}
```

### 3. Schema Validation

You can now define JSON schemas for structured output validation:

```typescript
const schema: JsonSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Person name' },
    age: { type: 'number', description: 'Person age' },
    skills: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of skills'
    }
  },
  required: ['name', 'age']
};
```

## Usage Examples

### Basic Text Generation

```typescript
import { llmService } from './services/llm/llmService';
import { ModelType } from './types/llmTypes';

const result = await llmService.generateText(
  'Explain quantum computing',
  ModelType.OPENROUTER
);

console.log(result.data); // Generated text
console.log(result.metadata?.processingTime); // Processing time in ms
```

### Structured JSON Output

```typescript
import { OutputParserType } from './types/llmTypes';

const result = await llmService.generateStructuredOutput(
  [{ role: 'user', content: 'Analyze Tesla as a company' }],
  ModelType.OPENROUTER,
  {
    outputParser: {
      type: OutputParserType.JSON,
      schema: {
        type: 'object',
        properties: {
          company_name: { type: 'string' },
          industry: { type: 'string' },
          founded_year: { type: 'number' },
          key_products: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['company_name', 'industry']
      },
      fallbackValue: { company_name: 'Unknown', industry: 'Unknown' }
    },
    retryCount: 3
  }
);

console.log(result.data); // Parsed JSON object
console.log(result.metadata?.parsingMethod); // How the output was parsed
```

### List Output Parsing

```typescript
const result = await llmService.generateCompletion(
  [{ role: 'user', content: 'List the top 5 programming languages' }],
  ModelType.OPENROUTER,
  {
    outputParser: {
      type: OutputParserType.LIST,
      instructions: 'Return only a JSON array of language names',
      fallbackValue: []
    }
  }
);

console.log(result.data); // Array of programming languages
```

### Web Search with Structured Output

```typescript
const result = await llmService.performWebSearch({
  messages: [
    { role: 'user', content: 'Find recent AI developments and summarize key trends' }
  ],
  responseFormat: { type: 'json_object' },
  temperature: 0.1
});

console.log(result.data); // Structured search results
```

### Error Handling and Fallbacks

The service includes robust error handling:

```typescript
const result = await llmService.generateStructuredOutput(
  [{ role: 'user', content: 'Some request that might fail' }],
  ModelType.OPENROUTER,
  {
    outputParser: {
      type: OutputParserType.JSON,
      schema: { /* your schema */ },
      fallbackValue: { status: 'error', data: null },
      instructions: 'Return valid JSON'
    },
    retryCount: 2
  }
);

if (result.error) {
  console.log('Parsing failed:', result.error);
  console.log('Used fallback:', result.data); // fallbackValue will be used
}

console.log('Parsing method:', result.metadata?.parsingMethod);
// Possible values: 'parser', 'json_fallback', 'fallback', 'raw', 'error'
```

## Migration Guide

### From Old Implementation

**Before:**
```typescript
const response = await openAIClient.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }],
  response_format: { type: 'json_object' }
});

const content = response.choices[0].message.content;
const parsed = JSON.parse(content); // Manual parsing with no error handling
```

**After:**
```typescript
const result = await llmService.generateStructuredOutput(
  [{ role: 'user', content: 'Hello' }],
  ModelType.OPENAI,
  {
    outputParser: {
      type: OutputParserType.JSON,
      fallbackValue: {},
      retryCount: 2
    }
  }
);

// Automatic parsing with error handling and fallbacks
const parsed = result.data;
const success = !result.error;
```

### Model-Specific Changes

#### OpenRouter Client
- Now uses `ChatOpenAI` from `@langchain/openai` with custom baseURL
- Supports all Langchain output parsers
- Maintains web search capabilities with Perplexity models

#### Gemini Client  
- Uses `ChatGoogleGenerativeAI` from `@langchain/google-genai`
- Simplified multimodal support (basic implementation)
- Better JSON output handling

#### OpenAI Client
- Uses `ChatOpenAI` for text completions
- Keeps direct OpenAI SDK for image generation
- Enhanced structured output support

## Benefits

1. **More Predictable Outputs**: Consistent parsing across all models
2. **Better Error Handling**: Automatic retries and fallback mechanisms
3. **Schema Validation**: Ensure outputs match expected formats
4. **Performance Monitoring**: Built-in timing and metadata collection
5. **Standardized Interface**: Same API across all model providers
6. **Extensibility**: Easy to add new output parsers and models

## Output Parser Details

### JSON Parser
- Automatic JSON validation and parsing
- Schema validation support
- Fallback to raw text if parsing fails
- Handles malformed JSON with cleaning attempts

### List Parser
- Parses responses into arrays
- Can extract lists from natural language
- Configurable with custom instructions

### Error Recovery
1. **Primary Parser**: Attempts to parse with specified parser
2. **Retry with Cleaning**: Cleans output and retries parsing
3. **JSON Fallback**: Falls back to JSON parsing if applicable
4. **Fallback Value**: Uses provided fallback value
5. **Raw Output**: Returns raw text as last resort

## Running Examples

To see the new implementation in action:

```bash
# Run the example file
npm run dev -- src/examples/langchainUsageExample.ts

# Or use ts-node directly
npx ts-node src/examples/langchainUsageExample.ts
```

The examples demonstrate:
- Basic text generation
- Structured JSON output
- List parsing
- Web search integration
- Media analysis
- Error handling
- Model comparison

## Configuration

No changes to environment variables are required. The existing configuration in `llmConfig.ts` works with the new Langchain implementation.

## Backward Compatibility

The public API of `llmService` remains the same, but now supports additional options for output parsing. Existing code will continue to work, but you can gradually adopt the new output parser features.

## Best Practices

1. **Always provide fallback values** for structured outputs
2. **Use appropriate retry counts** (2-3 for most cases)
3. **Define clear schemas** for JSON parsing
4. **Monitor parsing methods** in metadata for optimization
5. **Handle errors gracefully** with fallback mechanisms
6. **Use schema validation** for critical structured data

## Troubleshooting

### Common Issues

1. **Parsing Failures**: Check schema requirements and provide fallback values
2. **Performance**: Monitor `processingTime` in metadata and adjust retry counts
3. **Model Compatibility**: Some output parsers work better with certain models
4. **Rate Limits**: Langchain respects the same rate limits as direct API calls

### Debug Information

The `metadata.parsingMethod` field provides insight into how outputs were processed:
- `parser`: Successfully parsed with primary parser
- `json_fallback`: Primary parser failed, used JSON fallback
- `fallback`: All parsing failed, used fallback value
- `raw`: Returned raw output without parsing
- `error`: Request failed completely

This helps identify and fix parsing issues in your applications. 