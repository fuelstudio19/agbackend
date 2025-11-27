import { Queue } from "bullmq";
import redis from "../utils/redisClient";
import { logger } from "../utils/logger";

export const scraperQueue = new Queue('scraperQueue', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 10, // Keep last 10 completed jobs for debugging
    removeOnFail: 50,     // Keep last 50 failed jobs for debugging
    attempts: 3,          // Retry failed jobs up to 3 times
    backoff: {
      type: 'exponential',
      delay: 5000,        // Start with 5 second delay
    },
  }
});

// Basic queue event logging (using safe events)
scraperQueue.on('error', (err: Error) => {
  logger.error('[ScraperQueue] Queue error:', err);
});

// Function to get queue stats for monitoring
export const getQueueStats = async () => {
  try {
    const waiting = await scraperQueue.getWaiting();
    const active = await scraperQueue.getActive();
    const completed = await scraperQueue.getCompleted();
    const failed = await scraperQueue.getFailed();
    const delayed = await scraperQueue.getDelayed();

    const stats = {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      total: waiting.length + active.length + completed.length + failed.length + delayed.length
    };

    logger.info(`[ScraperQueue] Queue Stats - Waiting: ${stats.waiting}, Active: ${stats.active}, Completed: ${stats.completed}, Failed: ${stats.failed}, Delayed: ${stats.delayed}`);
    
    return stats;
  } catch (error) {
    logger.error('[ScraperQueue] Error getting queue stats:', error);
    return null;
  }
};

// Function to add job with enhanced logging
export const addScrapingJob = async (jobData: { run_id: string; organisation_id: string }) => {
  try {
    logger.info(`[ScraperQueue] Adding new scraping job: ${JSON.stringify(jobData)}`);
    
    const job = await scraperQueue.add('scrape-job', jobData, {
      jobId: `scrape-${jobData.run_id}`, // Use run_id as job ID to prevent duplicates
    });
    
    logger.info(`[ScraperQueue] Job ${job.id} added to queue successfully`);
    return job;
  } catch (error) {
    logger.error(`[ScraperQueue] Error adding job to queue:`, error);
    throw error;
  }
};

// Initialize queue logging
logger.info('[ScraperQueue] Scraper queue initialized with monitoring');

// Log queue stats every 30 seconds in development
if (process.env.NODE_ENV === 'development') {
  setInterval(async () => {
    await getQueueStats();
  }, 30000);
}