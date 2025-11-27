# Enhanced LLM Service Features

This document describes the enhanced LLM service features that support input data variable substitution and output parsing using LangChain.

## Features Overview

### 1. Input Data Variable Substitution
- Automatic template variable detection and substitution using LangChain
- Support for multiple variables in prompts using `{variable_name}` syntax
- Validation to ensure all required variables are provided

### 2. Output Parser Schema
- Structured output parsing using Zod schemas or JSON schemas
- Automatic fallback handling for parsing failures
- Support for strict mode validation

## Usage Examples

### Basic Variable Substitution

```typescript
import { llmService } from '../services/llm/llmService';
import { OutputParserType } from '../types/llmTypes';

const messages = [
  {
    role: 'system',
    content: 'You are a helpful assistant.'
  },
  {
    role: 'user',
    content: 'Analyze the company at {company_url} and provide insights about {focus_area}.'
  }
];

const result = await llmService.generateCompletion(messages, undefined, {
  inputData: {
    company_url: 'https://example.com',
    focus_area: 'competitive analysis'
  },
  temperature: 0.1
});
```

### Using Zod Schema for Output Parsing

```typescript
import { z } from 'zod';

const responseSchema = z.object({
  company_name: z.string().describe('The official company name'),
  industry: z.string().describe('Primary industry sector'),
  competitors: z.array(z.string()).describe('Main competitors'),
  strengths: z.array(z.string()).describe('Key competitive strengths')
});

const result = await llmService.performWebSearch({
  messages: [
    {
      role: 'user',
      content: 'Analyze {company_name} and provide structured insights.'
    }
  ],
  inputData: {
    company_name: 'OpenAI'
  },
  outputParser: {
    type: OutputParserType.ZOD,
    zodSchema: responseSchema,
    strictMode: true,
    fallbackValue: {
      company_name: 'Unknown',
      industry: 'Technology',
      competitors: [],
      strengths: []
    }
  }
});
```

### Using JSON Schema for Output Parsing

```typescript
const jsonSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'Brief summary' },
    key_points: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of key points'
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 }
  },
  required: ['summary', 'key_points', 'confidence']
};

const result = await llmService.generateStructuredOutput(messages, undefined, {
  inputData: { topic: 'AI trends' },
  outputParser: {
    type: OutputParserType.STRUCTURED,
    schema: jsonSchema,
    strictMode: false
  }
});
```

## API Reference

### InputData Interface
```typescript
interface InputData {
  [key: string]: any;
}
```

### OutputParserOptions Interface
```typescript
interface OutputParserOptions {
  type: OutputParserType;
  schema?: JsonSchema;
  zodSchema?: any;
  instructions?: string;
  examples?: Array<{ input: string; output: any }>;
  fallbackValue?: any;
  strictMode?: boolean;
}
```

### Enhanced Method Signatures

All LLM service methods now support these enhanced options:

```typescript
// Generate completion with enhanced features
llmService.generateCompletion(
  messages: MessageContent[],
  modelType?: ModelType,
  options?: {
    inputData?: InputData;
    outputParser?: OutputParserOptions;
    // ... other options
  }
)

// Perform web search with enhanced features
llmService.performWebSearch({
  messages: MessageContent[];
  inputData?: InputData;
  outputParser?: OutputParserOptions;
  // ... other options
})

// Generate structured output
llmService.generateStructuredOutput(
  messages: MessageContent[],
  modelType?: ModelType,
  options?: {
    inputData?: InputData;
    outputParser?: OutputParserOptions;
    // ... other options
  }
)
```

## Response Metadata

Enhanced responses include additional metadata:

```typescript
interface ModelResponse<T> {
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
  };
}
```

## Best Practices

### 1. Variable Naming
- Use descriptive variable names: `{company_url}` instead of `{url}`
- Use snake_case for consistency
- Avoid special characters in variable names

### 2. Schema Design
- Use descriptive field descriptions for better LLM understanding
- Include fallback values for critical fields
- Consider using optional fields for non-essential data

### 3. Error Handling
- Always check for parsing errors in the response
- Implement appropriate fallback logic
- Log metadata for debugging purposes

### 4. Performance Optimization
- Use `strictMode: false` for faster parsing when appropriate
- Provide reasonable fallback values to avoid parsing failures
- Cache frequently used schemas

## Migration Guide

### From Manual String Replacement
**Before:**
```typescript
const userPrompt = `Analyze ${companyUrl} and provide insights.`;
```

**After:**
```typescript
const userPrompt = 'Analyze {company_url} and provide insights.';
const options = {
  inputData: { company_url: companyUrl }
};
```

### From Manual JSON Parsing
**Before:**
```typescript
const result = await llmService.generateCompletion(messages);
const parsedData = JSON.parse(result.data);
```

**After:**
```typescript
const result = await llmService.generateCompletion(messages, undefined, {
  outputParser: {
    type: OutputParserType.ZOD,
    zodSchema: mySchema
  }
});
// result.data is already parsed and validated
```

## Troubleshooting

### Common Issues

1. **Missing Variables Error**
   - Ensure all variables in templates are provided in inputData
   - Check variable names for typos

2. **Parsing Failures**
   - Verify schema matches expected output format
   - Use fallback values for graceful degradation
   - Check logs for parsing error details

3. **Performance Issues**
   - Disable strict mode if not required
   - Optimize schema complexity
   - Consider caching for repeated operations

### Debug Logging

Enable detailed logging to troubleshoot issues:

```typescript
logger.info('LLM Response metadata:', {
  inputDataUsed: result.metadata?.inputDataUsed,
  parsedWithSchema: result.metadata?.parsedWithSchema,
  templateVariablesDetected: result.metadata?.templateVariablesDetected
});
``` 