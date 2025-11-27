# Refactored Self-Ads Implementation

## Overview

Successfully refactored the self-ads scraping system to eliminate code duplication by extending existing competitor ad services and routes rather than creating separate files. This follows DRY principles and makes the codebase more maintainable.

## Key Changes Made

### ✅ **Removed Duplicate Files**
- Deleted `src/controllers/selfAdScrapController.ts`
- Deleted `src/routes/selfAdScrapRoutes.ts` 
- Deleted `src/services/selfAdScrapServices.ts`
- Deleted `src/services/selfAdBackgroundPollingService.ts`

### ✅ **Extended Existing Services**

#### **1. Background Polling Service (`src/services/backgroundPollingService.ts`)**
- Added `AdType = 'competitor' | 'self'` type parameter
- Modified `startBackgroundPolling()` to accept `adType` parameter
- Updated `apiCreativeToDbRecord()` to handle both competitor and self ad types
- Enhanced `processScrapingResults()` to use appropriate repository based on type
- Uses `competitorBulkUpsert` or `selfAdBulkUpsert` based on `adType`

#### **2. Ad Scrap Services (`src/services/adScrapServices.ts`)**
- Added unified `UnifiedScrappingResult` interface
- Enhanced `getResultRunId()` to accept `adType` parameter and use appropriate repository
- Modified `checkResultByRunId()` to handle both types
- Created unified `startScrapperService()` function that works for both types
- Added convenience functions:
  - `startCompetitorScrapperService()` - maintains backwards compatibility
  - `startSelfAdScrapperService()` - new function for self ads
  - `getSelfAdResultRunId()` - for self ad results
  - `getCompetitorResultRunId()` - for competitor results (backwards compatibility)

#### **3. Onboarding Service (`src/services/onboardingService.ts`)**
- Added import for `startSelfAdScrapperService`
- Enhanced `saveOnboarding()` to automatically start self ad scraping when `meta_ad_dashboard_url` is provided
- Includes error handling for scraping failures (non-blocking)
- Re-enabled competitor ad scraping during onboarding
- Logs scraping initiation and results for monitoring

### ✅ **Extended Existing Controller**

#### **Ad Scrap Controller (`src/controllers/adScrapController.ts`)**
- Added `startSelfAdScraping()` function for self ad scraping initiation
- Added `getSelfAdScrapingResult()` function for retrieving self ad results
- Maintained existing functions with backwards compatibility
- Updated existing functions to use new service structure

### ✅ **Extended Existing Routes**

#### **Ad Scrap Routes (`src/routes/adScrapRoutes.ts`)**
- Added self ad endpoints:
  - `POST /api/scrap/self-ads/start` - Start self ad scraping
  - `POST /api/scrap/self-ads/result` - Get self ad results
- Maintained existing competitor ad endpoints:
  - `POST /api/scrap/meta-ads/start` - Start competitor ad scraping  
  - `POST /api/scrap/meta-ads/result` - Get competitor ad results
  - `GET /api/scrap/queue/status` - Monitor background polling (both types)
- Complete OpenAPI documentation for all endpoints

### ✅ **Updated Route Registration**

#### **Main Routes (`src/routes/index.ts`)**
- Removed separate self ad scraping router registration
- Updated comment to indicate scrap routes now handle both types
- Kept self ad CRUD routes separate (`/api/self-ads`)

## API Endpoints Summary

### **Scraping Endpoints (Consolidated)**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/scrap/meta-ads/start` | Start competitor ad scraping |
| POST | `/api/scrap/self-ads/start` | Start self ad scraping |
| POST | `/api/scrap/meta-ads/result` | Get competitor scraping results |
| POST | `/api/scrap/self-ads/result` | Get self ad scraping results |
| GET | `/api/scrap/queue/status` | Monitor background polling for both types |

### **CRUD Endpoints (Separate)**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/competitor-ads/` | List competitor ads |
| GET | `/api/competitor-ads/:id` | Get specific competitor ad |
| DELETE | `/api/competitor-ads/:id` | Delete competitor ad |
| GET | `/api/self-ads/` | List self ads |
| GET | `/api/self-ads/:id` | Get specific self ad |
| DELETE | `/api/self-ads/:id` | Delete self ad |

### **Onboarding Integration**
- **Automatic Scraping**: During onboarding, if `meta_ad_dashboard_url` is provided, self ad scraping is automatically initiated
- **Non-blocking**: Scraping failures don't prevent onboarding completion
- **Monitoring**: Full logging of scraping initiation and results

## Benefits of Refactoring

### **1. Code Reuse**
- Single background polling service handles both types
- Unified scraping service with type parameters
- Shared data transformation logic

### **2. Maintainability**
- Changes to core scraping logic only need to be made in one place
- Consistent error handling and logging patterns
- Unified monitoring and status endpoints

### **3. Type Safety**
- Strong TypeScript typing with `AdType` unions
- Proper type guards and casting
- Compile-time error checking

### **4. Backwards Compatibility**
- All existing competitor ad functionality preserved
- Legacy function names maintained where needed
- No breaking changes to existing API contracts

### **5. Seamless User Experience**
- Automatic scraping initiation during onboarding
- Users don't need to manually trigger self ad scraping
- Immediate value delivery after onboarding completion

## Technical Implementation Details

### **Background Polling**
```typescript
// Unified polling that works for both types
startBackgroundPolling(run_id, organisation_id, 'competitor');
startBackgroundPolling(run_id, organisation_id, 'self');
```

### **Service Layer**
```typescript
// Type-aware result checking
checkResultByRunId(run_id, 'competitor'); // Uses competitor repository
checkResultByRunId(run_id, 'self');       // Uses self ad repository
```

### **Data Transformation**
```typescript
// Single function handles both types with appropriate casting
apiCreativeToDbRecord(apiData, run_id, org_id, 'competitor'); // → DbCompetitor
apiCreativeToDbRecord(apiData, run_id, org_id, 'self');       // → DbSelfAdCreative
```

### **Onboarding Integration**
```typescript
// Automatic self ad scraping during onboarding
if (data.meta_ad_dashboard_url) {
  const result = await startSelfAdScrapperService(
    data.meta_ad_dashboard_url,
    data.company_url,
    userId,
    organizationId
  );
}
```

## Database Schema Preserved

- **Competitor ads**: `adgraam.competitor_ad_creatives` table
- **Self ads**: `adgraam.self_ad_creatives` table  
- **Scraper tracking**: `adgraam.runner_scrapers` table (shared)

## Files Modified

1. `src/services/backgroundPollingService.ts` - Enhanced for both types
2. `src/services/adScrapServices.ts` - Unified service functions
3. `src/controllers/adScrapController.ts` - Added self ad endpoints
4. `src/routes/adScrapRoutes.ts` - Consolidated all scraping routes
5. `src/routes/index.ts` - Updated route registration
6. `src/services/onboardingService.ts` - Added automatic self ad scraping

## Files Preserved

1. `src/repositories/selfAdCreativesRepository.ts` - Self ad data access
2. `src/controllers/selfAdCreativesController.ts` - Self ad CRUD operations  
3. `src/routes/selfAdCreativesRoutes.ts` - Self ad CRUD endpoints
4. `src/db/migrations/create_self_ad_creatives_table.sql` - Database schema
5. `src/types/dbSchemaTypes.ts` - Type definitions

## Testing Status

✅ **TypeScript Compilation**: All files compile without errors
✅ **Code Structure**: Follows existing patterns and conventions  
✅ **Backwards Compatibility**: All existing functionality preserved
✅ **Onboarding Integration**: Self ad scraping automatically triggered when meta_ad_dashboard_url provided

## Usage Examples

### **Start Self Ad Scraping**
```bash
curl -X POST /api/scrap/self-ads/start \
  -H "Authorization: Bearer <token>" \
  -d '{
    "meta_ad_dashboard_url": "https://facebook.com/ads/manager/ads/?act=123",
    "company_url": "https://mycompany.com"
  }'
```

### **Get Self Ad Results**
```bash
curl -X POST /api/scrap/self-ads/result \
  -H "Authorization: Bearer <token>" \
  -d '{"run_id": "abc123-def456"}'
```

### **Monitor Background Polling**
```bash
curl -X GET /api/scrap/queue/status \
  -H "Authorization: Bearer <token>"
```

### **Onboarding with Automatic Self Ad Scraping**
```bash
curl -X POST /api/onboarding/save \
  -H "Authorization: Bearer <token>" \
  -d '{
    "company_url": "https://mycompany.com",
    "meta_ad_dashboard_url": "https://facebook.com/ads/manager/ads/?act=123",
    "company_name": "My Company",
    "company_logo": "https://mycompany.com/logo.png",
    ...
  }'
```

This refactored implementation successfully eliminates code duplication while maintaining full functionality for both competitor and self ad scraping systems, with seamless integration into the onboarding flow. 