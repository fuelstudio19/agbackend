# AG Backend

A comprehensive backend service for AI-powered advertising and company analysis.

## Features

- **LLM Integration**: Support for multiple LLM providers (OpenRouter, Gemini, OpenAI)
- **Web Search**: Real-time web search capabilities using Perplexity Sonar Pro model
- **Company Analysis**: Automated onboarding with company, product, and competitor analysis
- **Ad Management**: Facebook/Meta advertising campaign management
- **User Authentication**: Secure user management and authentication

## Recent Updates

### Web Search Integration
- Added Perplexity Sonar Pro model integration via OpenRouter for real-time web search
- Single-call API that combines web search with AI analysis
- Separated analysis from data persistence for better flexibility
- Enhanced onboarding service with current company information gathering
- Improved accuracy of company analysis through web search results

## Environment Variables

Add these environment variables to your `.env` file:

```env
# Required
OPENROUTER_API_KEY=your_openrouter_api_key

# Optional - Model Configuration
OPENROUTER_MODEL=google/gemini-2.5-pro-preview-03-25
WEB_SEARCH_MODEL=perplexity/sonar-pro
OPENROUTER_TEMPERATURE=0.1
OPENROUTER_MAX_TOKENS=4096
WEB_SEARCH_TEMPERATURE=0.1
WEB_SEARCH_MAX_TOKENS=4096

# Other API Keys (optional)
GOOGLE_API_KEY=your_google_api_key
OPENAI_API_KEY=your_openai_api_key

# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# App Configuration
APP_URL=http://localhost:3000
APP_NAME=Company Analysis Tool
```

## Usage

### Web Search API

The service includes web search capabilities that combine real-time web search with AI analysis in a single call:

```typescript
import { llmService } from './src/services/llm/llmService';
import { MessageContent } from './src/types/llmTypes';

// Basic web search with analysis
const messages: MessageContent[] = [
  {
    role: 'system',
    content: 'You are a research assistant with web search capabilities.'
  },
  {
    role: 'user',
    content: 'Search the web for latest AI developments and summarize key trends.'
  }
];

const result = await llmService.performWebSearch<string>({
  messages,
  temperature: 0.1,
  maxTokens: 2000,
  responseFormat: { type: 'text' }
});

// Structured JSON output
const structuredResult = await llmService.performWebSearch<{
  company: string;
  products: string[];
  competitors: string[];
}>({
  messages: [
    { role: 'system', content: 'Research assistant with web search.' },
    { 
      role: 'user', 
      content: 'Search for Microsoft info and return JSON: {"company": "name", "products": [], "competitors": []}' 
    }
  ],
  responseFormat: { type: 'json_object' }
});
```

### Enhanced Onboarding Workflow

The new onboarding system separates analysis from data persistence:

```typescript
// Step 1: Analyze company (no authentication required)
const analysisResponse = await fetch('/api/v1/onboarding/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    company_url: 'https://example.com'
  })
});
const analysisData = await analysisResponse.json();

// Step 2: Save analyzed data (authentication required)
const saveResponse = await fetch('/api/v1/onboarding/save', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(analysisData)
});
const savedData = await saveResponse.json();
```

## Installation

```bash
npm install
npm run build
npm start
```

## Development

```bash
npm run dev
```

## API Endpoints

### Onboarding Endpoints
- `POST /api/v1/onboarding/analyze` - Analyze company data using web search (no auth required)
- `POST /api/v1/onboarding/save` - Save analyzed data to database (auth required)
- `GET /api/v1/onboarding/:companyUrl` - Get existing onboarding data
- `POST /api/v1/onboarding` - Legacy endpoint (deprecated - analyzes and saves in one call)

### Other Endpoints
- Additional endpoints for ad management and user operations

## Architecture

### LLM Service Layer
- **OpenRouter Client**: Access to various models including Perplexity Sonar Pro
- **Gemini Client**: Multimodal analysis capabilities
- **OpenAI Client**: Image generation and advanced reasoning
- **Web Search**: Real-time information gathering with AI analysis

### Updated Data Flow
1. **Analysis Phase** (Public):
   - User submits company URL to `/analyze` endpoint
   - System constructs analysis prompt with web search instructions
   - **Single API call** to Perplexity Sonar Pro performs web search AND analysis
   - Structured JSON response returned to user
   - No database interaction, no authentication required

2. **Persistence Phase** (Authenticated):
   - User decides to save the analyzed data
   - Authenticated request to `/save` endpoint
   - Data validation and duplicate checking
   - Results stored in database
   - Confirmation returned to user

### Key Benefits
- **Separation of Concerns**: Analysis vs. persistence are independent
- **Public Analysis**: Users can analyze companies without signing up
- **Authenticated Saving**: Data persistence requires user authentication
- **Single Call Efficiency**: Reduced from 2 API calls to 1 for analysis
- **Better UX**: Users can review analysis before deciding to save
- **Cost Optimization**: Fewer API calls and tokens used

## Example Analysis Response

```json
{
  "company_name": "Deconstruct",
  "company_url": "https://thedeconstruct.in",
  "company_logo": "https://thedeconstruct.in/cdn/shop/files/Deconstruct_Logo_1_180x.png",
  "product_details": [
    {
      "name": "Deconstruct Vitamin C Serum",
      "url": "https://thedeconstruct.in/products/vitamin-c-serum",
      "meta_ad_library_url": "https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=Deconstruct%20Vitamin%20C%20Serum&search_type=page",
      "short_write_up": "A science-backed serum formulated with Vitamin C to target dullness, pigmentation, and uneven skin tone.",
      "product_image": "https://thedeconstruct.in/cdn/shop/products/VitaminCSerum_1_600x.png"
    }
  ],
  "competitor_details": [
    {
      "meta_ad_library_url": "https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=Minimalist%20Skincare&search_type=page",
      "name": "Minimalist",
      "short_write_up": "Leading Indian skincare brand known for transparent, science-driven formulations.",
      "logo": "https://beminimalist.co/cdn/shop/files/Minimalist_Logo_180x.png"
    }
  ],
  "company_theme_color": "#F9B233"
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

[MIT](LICENSE)
