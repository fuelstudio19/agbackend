# Background Polling Guide

This document explains the background polling system that handles scraper result processing directly in the application without requiring Redis queues.

## Overview

The system now uses a direct background polling approach instead of Redis queues for handling scraper results. When you start a scraping job, the system immediately begins polling for results in the background.

## How It Works

### 1. Start Scraping Process

```
1. API call to start scraping
2. Apify scraper started → get run_id
3. Store run_id in database
4. Start background polling immediately
5. Return run_id to client
```

### 2. Background Polling Process

```
[BackgroundPoller] 🚀 Starting background polling for run_id: abc123
[BackgroundPoller] 📡 Polling attempt 1/25 for run_id: abc123
[BackgroundPoller] ⏸️ No results yet - scraper still running
[BackgroundPoller] ⏳ Scheduling next poll in 10000ms
[BackgroundPoller] 📡 Polling attempt 2/25 for run_id: abc123
[BackgroundPoller] ✅ Successfully fetched results on attempt 3
[BackgroundPoller] 📊 Result summary - Found 50 ads, First ad URL: https://...
[BackgroundPoller] 📝 Processing array of 50 ads for run_id: abc123
[BackgroundPoller] ✅ Found 50 valid ads out of 50 total ads
[BackgroundPoller] ✅ Step 1 completed: Transformed 50 ads successfully, 0 transform errors
[BackgroundPoller] 🔄 Step 2: Bulk upserting 50 ads for run_id: abc123
[BackgroundPoller] ✅ Step 2 completed: Bulk upserted 50 ads (took 245ms)
[BackgroundPoller] 🔄 Step 3: Marking scraper as completed
[BackgroundPoller] ✅ Step 3 completed: Runner status updated
[BackgroundPoller] 🎉 Background processing completed successfully!
[BackgroundPoller] 📈 Final summary - Run ID: abc123, Transformed: 50/50 ads, Inserted: 50, Transform errors: 0
```

## Key Features

### ✅ **No Redis Dependency**
- Eliminates Redis queue requirement for scraping
- Simplifies deployment and infrastructure
- Reduces external dependencies

### ✅ **Immediate Processing**
- Background polling starts immediately after getting run_id
- No queue delays or worker startup time
- Faster response to completed scraping

### ✅ **Comprehensive Logging**
- Step-by-step progress tracking with emojis
- Detailed timing information for each operation
- Clear success/failure indicators

### ✅ **Duplicate Prevention**
- Prevents multiple polling processes for same run_id
- Automatic cleanup when polling completes
- Memory-efficient tracking of active processes

### ✅ **Configurable Polling**
- Adjustable polling intervals (default: 10 seconds)
- Configurable max attempts (default: 25)
- Automatic timeout handling

### ✅ **Complete Ad Processing**
- Processes ALL ads from the dataset instead of just the first one
- Individual success/error tracking for each ad
- Continues processing even if some ads fail
- Detailed progress logging for each ad

### ✅ **Enhanced Media Extraction**
- Extracts multiple image URLs (resized and original) from cards array
- Extracts HD and SD video URLs from cards
- Fallback extraction from images/videos arrays if cards are empty
- Proper publisher platform mapping
- Comprehensive debugging for media extraction issues

### ✅ **High-Performance Database Operations**
- **Bulk upsert** instead of individual record insertions
- Single database transaction for all ads (50 ads in ~245ms vs 50 individual operations)
- Automatic conflict resolution using `ad_archive_id` as unique constraint
- Detailed insertion statistics and error tracking
- Transactional integrity - all ads succeed or fail together

## API Endpoints

### Start Scraping
**Endpoint:** `POST /api/scrap/meta-ads/start`

**Response:**
```json
{
  "success": true,
  "message": "Scraping initiated successfully with background polling started",
  "data": {
    "run_id": "abc123-def456",
    "polling_status": {
      "before": {
        "activeCount": 0,
        "activeJobs": [],
        "timestamp": "2024-01-15T10:30:00.000Z"
      },
      "after": {
        "activeCount": 1,
        "activeJobs": ["abc123-def456"],
        "timestamp": "2024-01-15T10:30:01.000Z"
      }
    }
  }
}
```

### Check Results
**Endpoint:** `POST /api/scrap/meta-ads/result`

**Response (still polling):**
```json
{
  "success": true,
  "message": "Scraper is still running. Background polling is handling the process. Try again later.",
  "data": null
}
```

**Response (completed):**
```json
{
  "success": true,
  "message": "Scraper result fetched successfully.",
  "data": [
    {
      "run_id": "abc123-def456",
      "ad_archive_id": "ad123",
      "page_name": "Example Page",
      "title": "Ad Title",
      "resized_image_urls": ["url1", "url2"],
      "original_image_urls": ["url3", "url4"]
    }
  ]
}
```

### Monitor Background Polling
**Endpoint:** `GET /api/scrap/queue/status`

**Response:**
```json
{
  "success": true,
  "message": "Background polling monitoring information retrieved successfully",
  "data": {
    "status": {
      "activeCount": 2,
      "activeJobs": ["abc123-def456", "xyz789-ghi012"],
      "timestamp": "2024-01-15T10:30:00.000Z"
    },
    "message": "Currently 2 background polling processes active"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Configuration

### Polling Settings

You can customize polling behavior when starting the background process:

```typescript
startBackgroundPolling(
  run_id,           // Required: scraper run ID
  organisation_id,  // Required: organisation ID
  25,              // Optional: max attempts (default: 25)
  10000            // Optional: delay between attempts in ms (default: 10000)
);
```

### Default Settings
- **Max Attempts:** 25 (about 4 minutes with 10s delay)
- **Delay Between Attempts:** 10000ms (10 seconds)
- **Timeout:** Automatic after max attempts reached
- **Error Handling:** Stops polling immediately on critical processing errors

## Advantages Over Redis Queue

### 🚀 **Simpler Architecture**
- No Redis server required
- Fewer moving parts
- Easier to debug and monitor

### ⚡ **Faster Processing**
- No queue delays
- Immediate polling start
- Direct in-memory processing

### 💰 **Cost Effective**
- No Redis hosting costs
- Reduced infrastructure complexity
- Lower operational overhead

### 🔧 **Easier Development**
- No Redis setup required locally
- Simpler testing and debugging
- Direct log visibility

## Monitoring & Debugging

### Active Process Tracking
Check which scraping jobs are currently being polled:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/scrap/queue/status
```

### Log Patterns

**Successful Processing:**
```
[BackgroundPoller] 🚀 Starting background polling
[BackgroundPoller] 📡 Polling attempt 1/15
[BackgroundPoller] ✅ Successfully fetched results
[BackgroundPoller] 🎉 Background processing completed
```

**Failed/Timeout:**
```
[BackgroundPoller] 🚀 Starting background polling
[BackgroundPoller] 📡 Polling attempt 1/25
[BackgroundPoller] ⚠️ API fetch error for run_id abc123 on attempt 5
[BackgroundPoller] ❌ Polling timeout after 25 attempts
```

**Critical Processing Error (stops immediately):**
```
[BackgroundPoller] 🚀 Starting background polling
[BackgroundPoller] 📡 Polling attempt 3/25
[BackgroundPoller] ✅ Successfully fetched results
[BackgroundPoller] 💀 Critical processing error, stopping polling: No valid ads found
```

## Error Handling

The system includes comprehensive error handling with smart retry logic:

- **API Fetch Errors:** Logged and retried on next polling attempt (temporary network issues, scraper not ready)
- **Critical Processing Errors:** Stop polling immediately (invalid data structure, database schema mismatches)
- **Database Errors:** Detailed error logging with stack traces, stops polling
- **Timeout Handling:** Automatic cleanup after max attempts reached
- **Duplicate Prevention:** Prevents multiple polling for same run_id
- **Array Handling:** Properly processes both single ads and arrays of ads from the scraper

## Best Practices

1. **Monitor Active Polling:** Regularly check `/api/scrap/queue/status`
2. **Watch Logs:** Monitor background poller logs for issues
3. **Handle Timeouts:** Implement client-side retry logic for failed scraping
4. **Resource Management:** Monitor memory usage with many concurrent polling processes

## Migration from Redis Queue

If migrating from the Redis queue approach:

1. **Remove Redis Dependencies:** No longer need Redis for scraping
2. **Update Client Code:** Response structure slightly changed
3. **Monitor Differently:** Use new polling status endpoint
4. **Keep Redis for Other Features:** Redis still available for other queue needs

The background polling approach provides a simpler, more direct way to handle scraper results while maintaining all the reliability and monitoring capabilities of the previous queue-based system. 