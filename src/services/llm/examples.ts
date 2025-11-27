/**
 * Examples demonstrating how to use the LLM service
 */
import { llmService } from './llmService';
import { ModelType, MessageContent } from '../../types/llmTypes';
import { logger } from '../../utils/logger';

/**
 * Example of generating a simple text completion
 */
export async function exampleTextGeneration() {
  const prompt = 'Write a short paragraph explaining what artificial intelligence is.';
  
  const result = await llmService.generateText(prompt);
  
  if (result.error) {
    logger.error(`Error generating text: ${result.error}`);
    return;
  }
  
  logger.info('Generated Text:');
  logger.info(result.data);
}

/**
 * Example of generating a completion from a conversation with multiple messages
 */
export async function exampleChatCompletion() {
  const messages: MessageContent[] = [
    { role: 'system', content: 'You are a helpful marketing assistant.' },
    { role: 'user', content: 'What are 3 effective Facebook Ad strategies for a new e-commerce store?' }
  ];
  
  const result = await llmService.generateCompletion(messages);
  
  if (result.error) {
    logger.error(`Error generating chat completion: ${result.error}`);
    return;
  }
  
  logger.info('Generated Chat Completion:');
  logger.info(result.data);
}

/**
 * Example of generating structured JSON output
 */
export async function exampleStructuredOutput() {
  // Define the conversation for structured output
  const messages: MessageContent[] = [
    { role: 'system', content: 'You are a helpful assistant that responds with structured data.' },
    { role: 'user', content: 'Provide 3 social media content ideas for a fitness brand.' }
  ];
  
  // Define the expected structure
  interface ContentIdea {
    title: string;
    description: string;
    platform: 'Instagram' | 'Facebook' | 'TikTok' | 'LinkedIn';
    contentType: 'image' | 'video' | 'carousel' | 'text';
    targetAudience: string;
  }
  
  interface ContentIdeasResponse {
    ideas: ContentIdea[];
    recommendedHashtags: string[];
  }
  
  const result = await llmService.generateStructuredOutput<ContentIdeasResponse>(
    messages,
    ModelType.OPENROUTER,
    { temperature: 0.7 }
  );
  
  if (result.error) {
    logger.error(`Error generating structured output: ${result.error}`);
    return;
  }
  
  logger.info('Generated Structured Output:');
  logger.info(JSON.stringify(result.data, null, 2));
  
  // You can now access the structured data
  result.data.ideas.forEach((idea, index) => {
    logger.info(`Idea ${index + 1}: ${idea.title} (${idea.platform} ${idea.contentType})`);
  });
}

/**
 * Example of analyzing an image
 */
export async function exampleImageAnalysis() {
  const imageUrl = 'https://example.com/path/to/image.jpg';
  
  const result = await llmService.analyzeMedia({
    mediaType: 'image',
    mediaUrl: imageUrl,
    prompt: 'Describe what you see in this image and provide key insights for a marketing campaign.',
    // Optional: request structured output
    outputFormat: {
      description: 'string',
      subjects: 'array',
      emotions: 'array',
      marketingInsights: 'array',
      brandFit: 'number',
      potentialEngagementScore: 'number'
    }
  });
  
  if (result.error) {
    logger.error(`Error analyzing image: ${result.error}`);
    return;
  }
  
  logger.info('Image Analysis Results:');
  logger.info(JSON.stringify(result.data, null, 2));
}

/**
 * Example of generating an image
 */
export async function exampleImageGeneration() {
  const prompt = 'A professional product photo of a sleek fitness water bottle on a minimalist background, studio lighting, high-quality commercial photography';
  
  const result = await llmService.generateImage(prompt, {
    n: 1,
    quality: 'high',
    returnFormat: 'url'
  });
  
  if (result.error) {
    logger.error(`Error generating image: ${result.error}`);
    return;
  }
  
  logger.info('Generated Image URL:');
  result.data.images.forEach((image, index) => {
    logger.info(`Image ${index + 1}: ${image.url}`);
  });
} 