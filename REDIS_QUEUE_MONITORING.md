# Redis Queue Monitoring & Logging Guide

This document explains the enhanced monitoring and logging capabilities added to the Redis queue system for better visibility into scraping operations.

## Overview

The Redis queue system now includes comprehensive logging and monitoring features to help you understand what's happening during scraping operations.

## Enhanced Logging Features

### 1. Redis Connection Logging

The Redis client now logs all connection events:

```
[Redis] Attempting to connect to Redis at localhost:6379
[Redis] Connected to Redis server
[Redis] Redis server is ready to receive commands
```

### 2. Queue Event Logging

The queue system logs all job lifecycle events:

```
[ScraperQueue] Adding new scraping job: {"run_id":"abc123","organisation_id":"org-uuid"}
[ScraperQueue] Job scrape-abc123 added to queue successfully
[ScraperQueue] Queue Stats - Waiting: 1, Active: 0, Completed: 5, Failed: 0, Delayed: 0
```

### 3. Worker Process Logging

The worker provides detailed step-by-step logging with emojis for easy scanning:

```
[Worker] 🚀 Starting job scrape-abc123 - Processing run_id: abc123
[Worker] 📡 Polling attempt 1/15 for run_id: abc123
[Worker] ✅ Successfully fetched results for run_id: abc123 on attempt 3 (took 2150ms)
[Worker] 🔄 Step 1: Transforming API data to database format for run_id: abc123
[Worker] ✅ Step 1 completed: Data transformation successful (took 45ms)
[Worker] 🔄 Step 2: Marking scraper as completed for run_id: abc123
[Worker] ✅ Step 2 completed: Runner status updated (took 120ms)
[Worker] 🔄 Step 3: Storing ad creative data for run_id: abc123
[Worker] ✅ Step 3 completed: Ad data stored successfully (took 89ms)
[Worker] 🎉 Job scrape-abc123 completed successfully! Total processing time: 95,234ms
```

## Monitoring Endpoints

### Queue Status API

Monitor queue health and recent jobs in real-time:

**Endpoint:** `GET /api/scrap/queue/status`

**Authentication:** Required (Bearer token)

**Response:**
```json
{
  "success": true,
  "message": "Queue monitoring information retrieved successfully",
  "data": {
    "stats": {
      "waiting": 2,
      "active": 1,
      "completed": 15,
      "failed": 1,
      "delayed": 0,
      "total": 19
    },
    "recentJobs": [
      {
        "id": "scrape-abc123",
        "status": "completed",
        "data": {
          "run_id": "abc123",
          "organisation_id": "org-uuid"
        },
        "attempts": 1,
        "timestamp": 1640995200000,
        "processedOn": 1640995205000,
        "finishedOn": 1640995300000,
        "failedReason": null
      }
    ]
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Queue Statistics Interpretation

- **waiting**: Jobs queued but not yet started
- **active**: Jobs currently being processed by workers
- **completed**: Successfully finished jobs (kept for reference)
- **failed**: Jobs that failed after all retry attempts
- **delayed**: Jobs scheduled for future processing

## Development Mode Features

In development mode (`NODE_ENV=development`), additional features are enabled:

1. **Automatic Stats Logging**: Queue statistics are logged every 30 seconds
2. **Extended Job Retention**: More failed jobs are kept for debugging
3. **Verbose Debug Logging**: Additional debug information is logged

## Worker Configuration

The enhanced worker includes these features:

- **Concurrency**: Processes up to 3 jobs simultaneously
- **Retry Logic**: Up to 3 attempts with exponential backoff
- **Stall Detection**: Jobs marked as stalled after 30 seconds
- **Job Retention**: Keeps last 10 completed and 50 failed jobs

## Troubleshooting Common Issues

### Queue Not Processing Jobs

1. Check Redis connection:
   ```
   [Redis] Connected to Redis server
   [Redis] Redis server is ready to receive commands
   ```

2. Verify worker is running:
   ```
   [Worker] 🟢 Worker is ready and waiting for jobs
   ```

3. Check queue stats for stuck jobs

### Jobs Failing Repeatedly

1. Look for worker error logs:
   ```
   [Worker] 💥 Job failed during processing - error: API timeout
   [Worker] 🔍 Error stack trace: [detailed stack trace]
   ```

2. Check if Apify scraper is returning valid data

3. Verify database connectivity and permissions

### Slow Processing

1. Monitor step-by-step timing:
   ```
   [Worker] 📡 Polling attempt 5/15 for run_id: abc123 (took 5200ms)
   [Worker] ✅ Step 1 completed: Data transformation (took 1200ms)
   ```

2. Check if scraper is taking longer than expected

3. Consider increasing polling delay or timeout values

## Log Analysis

### Key Log Patterns to Watch

**Successful Flow:**
```
[ScraperQueue] Adding new scraping job
[Worker] 🚀 Starting job
[Worker] 📡 Polling attempt
[Worker] ✅ Successfully fetched results
[Worker] 🎉 Job completed successfully
```

**Failed Flow:**
```
[Worker] 🚀 Starting job
[Worker] 📡 Polling attempt (repeated)
[Worker] ❌ Scraping failed or timed out
[Worker] 💀 Job failed permanently
```

### Performance Monitoring

Monitor these timing metrics:
- API polling attempts and duration
- Data transformation time
- Database operation time
- Total job processing time

## Environment Variables

Ensure these Redis environment variables are set:

```bash
REDIS_HOST=localhost
REDIS_PORT_NUMBER=6379
REDIS_USERNAME=your_username
REDIS_PASSWORD=your_password
NODE_ENV=development  # For enhanced debugging
```

## Best Practices

1. **Monitor Queue Health**: Regularly check `/api/scrap/queue/status`
2. **Watch Log Patterns**: Look for recurring error patterns
3. **Set Alerts**: Monitor for high failure rates or stuck queues
4. **Resource Management**: Ensure adequate Redis memory and worker resources
5. **Cleanup**: Periodically clean old completed/failed jobs if needed

## Advanced Debugging

### Enable Debug Logging

The worker includes detailed debug logs for data processing:

```
[Worker] Processing 3 cards from snapshot for run_id: abc123
[Worker] Processing card 1 for run_id: abc123
[Worker] Extracted media URLs: 2 resized images, 2 original images, 1 HD videos, 0 SD videos
```

### Manual Queue Inspection

Use the monitoring endpoint to inspect individual job details and troubleshoot specific issues.

## Support

If you encounter issues not covered in this guide, check the application logs for detailed error messages and stack traces. The enhanced logging provides comprehensive visibility into every step of the scraping process. 