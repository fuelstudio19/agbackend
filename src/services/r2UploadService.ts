import { S3Client, PutObjectCommand, PutObjectCommandInput } from '@aws-sdk/client-s3';
import axios from 'axios';
import { logger } from '../utils/logger';

export interface R2Config {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl: string;
  bucketName: string;
}

export interface UploadedMedia {
  originalUrl: string;
  r2Url: string;
  key: string;
  fileSize: number;
  contentType: string;
}

export interface BulkUploadResult {
  successful: UploadedMedia[];
  failed: { url: string; error: string }[];
  urlMapping: Map<string, string>; // originalUrl -> r2Url
}

export class R2UploadService {
  private s3Client: S3Client;
  private config: R2Config;

  constructor(config: R2Config) {
    this.config = config;
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  /**
   * Validate and sanitize URL
   */
  private isValidUrl(url: any): url is string {
    if (!url || typeof url !== 'string' || url.trim() === '' || url === 'null' || url === 'undefined') {
      return false;
    }
    
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate a unique key for the uploaded file
   */
  private generateKey(organisationId: string, adType: string, originalUrl: string): string {
    try {
      // Extract file extension from URL
      const urlParts = new URL(originalUrl);
      const pathname = urlParts.pathname;
      const extension = pathname.substring(pathname.lastIndexOf('.')) || '';
      
      // Clean extension (remove query parameters if they leaked through)
      const cleanExtension = extension.split('?')[0];
      
      // Generate timestamp and random string for uniqueness
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      
      // Create key in format: organisation_id/adType/timestamp_random.ext
      return `${organisationId}/${adType}/${timestamp}_${randomStr}${cleanExtension}`;
    } catch (error) {
      // Fallback for problematic URLs
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      return `${organisationId}/${adType}/${timestamp}_${randomStr}`;
    }
  }

  /**
   * Get content type from URL or default based on extension
   */
  private getContentType(url: string): string {
    try {
      const urlParts = new URL(url);
      const extension = urlParts.pathname.toLowerCase().split('.').pop()?.split('?')[0];
      
      const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'mp4': 'video/mp4',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo',
        'webm': 'video/webm',
      };

      return mimeTypes[extension || ''] || 'application/octet-stream';
    } catch {
      return 'application/octet-stream';
    }
  }

  /**
   * Download media from URL with better error handling for Facebook/Meta CDN
   */
  private async downloadMedia(url: string): Promise<Buffer> {
    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {        
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 45000, // Increased timeout for large video files
          maxRedirects: 5,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'video',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'cross-site',
          },
          validateStatus: (status) => status >= 200 && status < 300,
        });

        return Buffer.from(response.data);

      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          logger.warn(`[R2UploadService] Download failed (attempt ${attempt}), retrying in ${delay}ms: ${(error as Error).message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Download failed after retries');
  }

  /**
   * Upload media buffer to R2
   */
  private async uploadToR2(buffer: Buffer, key: string, contentType: string): Promise<void> {
    const uploadParams: PutObjectCommandInput = {
      Bucket: this.config.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000', // Cache for 1 year
    };

    const command = new PutObjectCommand(uploadParams);
    await this.s3Client.send(command);
  }

  /**
   * Upload a single media URL to R2
   */
  async uploadSingleMedia(
    url: string,
    organisationId: string,
    adType: 'competitor' | 'self'
  ): Promise<UploadedMedia> {
    if (!this.isValidUrl(url)) {
      throw new Error(`Invalid URL provided: ${url}`);
    }

    const key = this.generateKey(organisationId, adType, url);
    const contentType = this.getContentType(url);
    
    const buffer = await this.downloadMedia(url);
    await this.uploadToR2(buffer, key, contentType);

    const r2Url = `${this.config.publicUrl}/${key}`;
    
    return {
      originalUrl: url,
      r2Url,
      key,
      fileSize: buffer.length,
      contentType,
    };
  }

  /**
   * Bulk upload multiple unique URLs to R2
   */
  async bulkUploadMedia(
    urls: string[],
    organisationId: string,
    adType: 'competitor' | 'self',
    maxConcurrency: number = 3 // Reduced for better stability
  ): Promise<BulkUploadResult> {
    // Filter and deduplicate URLs
    const validUrls = urls.filter(url => this.isValidUrl(url));
    const uniqueUrls = Array.from(new Set(validUrls));
    
    logger.info(`[R2UploadService] Starting bulk upload: ${uniqueUrls.length} unique URLs from ${urls.length} total URLs for org: ${organisationId}, type: ${adType}`);

    if (uniqueUrls.length === 0) {
      return {
        successful: [],
        failed: [],
        urlMapping: new Map(),
      };
    }

    const successful: UploadedMedia[] = [];
    const failed: { url: string; error: string }[] = [];
    
    // Process uploads in smaller batches to avoid overwhelming the service
    for (let i = 0; i < uniqueUrls.length; i += maxConcurrency) {
      const batch = uniqueUrls.slice(i, i + maxConcurrency);
      
      logger.info(`[R2UploadService] Processing batch ${Math.floor(i / maxConcurrency) + 1}/${Math.ceil(uniqueUrls.length / maxConcurrency)}: ${batch.length} URLs`);
      
      const batchPromises = batch.map(async (url): Promise<{ success: true; result: UploadedMedia; url: string } | { success: false; error: string; url: string }> => {
        try {
          const result = await this.uploadSingleMedia(url, organisationId, adType);
          return { success: true as const, result, url };
        } catch (error) {
          const errorMessage = (error as Error).message;
          logger.error(`[R2UploadService] Failed to upload ${url.substring(0, 100)}...: ${errorMessage}`);
          return { success: false as const, error: errorMessage, url };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      // Process batch results
      for (const result of batchResults) {
        if (result.success) {
          successful.push(result.result);
        } else {
          failed.push({ url: result.url, error: result.error });
        }
      }
      
      logger.info(`[R2UploadService] Batch ${Math.floor(i / maxConcurrency) + 1} completed: ${batchResults.filter(r => r.success).length}/${batch.length} successful`);
      
      // Add small delay between batches to be respectful to external services
      if (i + maxConcurrency < uniqueUrls.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Create URL mapping for quick lookups
    const urlMapping = new Map<string, string>();
    successful.forEach(media => {
      urlMapping.set(media.originalUrl, media.r2Url);
    });

    logger.info(`[R2UploadService] Bulk upload completed: ${successful.length}/${uniqueUrls.length} successful uploads, ${failed.length} failures`);

    return {
      successful,
      failed,
      urlMapping,
    };
  }

  /**
   * Upload multiple media URLs to R2 in parallel (legacy method for backward compatibility)
   */
  async uploadMultipleMedia(
    urls: string[],
    organisationId: string,
    adType: 'competitor' | 'self',
    maxConcurrency: number = 3
  ): Promise<UploadedMedia[]> {
    const result = await this.bulkUploadMedia(urls, organisationId, adType, maxConcurrency);
    return result.successful;
  }
}

// Create singleton instance
let r2Service: R2UploadService | null = null;

export const getR2Service = (): R2UploadService => {
  if (!r2Service) {
    const config: R2Config = {
      endpoint: process.env.VITE_CLOUDFLARE_R2_ENDPOINT || '',
      accessKeyId: process.env.VITE_CLOUDFLARE_R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
      publicUrl: process.env.VITE_CLOUDFLARE_R2_PUBLIC_URL || '',
      bucketName: process.env.VITE_CLOUDFLARE_R2_BUCKET_NAME || '',
    };

    // Validate configuration
    const missingVars = [];
    if (!config.endpoint) missingVars.push('VITE_CLOUDFLARE_R2_ENDPOINT');
    if (!config.accessKeyId) missingVars.push('VITE_CLOUDFLARE_R2_ACCESS_KEY_ID');
    if (!config.secretAccessKey) missingVars.push('VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY');
    if (!config.publicUrl) missingVars.push('VITE_CLOUDFLARE_R2_PUBLIC_URL');
    if (!config.bucketName) missingVars.push('VITE_CLOUDFLARE_R2_BUCKET_NAME');

    if (missingVars.length > 0) {
      throw new Error(`Missing required R2 configuration environment variables: ${missingVars.join(', ')}`);
    }

    r2Service = new R2UploadService(config);
    logger.info('[R2UploadService] R2 upload service initialized successfully');
  }

  return r2Service;
};

/**
 * Helper function to upload media URLs and return the new R2 URLs (legacy)
 */
export const uploadMediaUrlsToR2 = async (
  urls: string[],
  organisationId: string,
  adType: 'competitor' | 'self'
): Promise<string[]> => {
  if (urls.length === 0) {
    return [];
  }

  try {
    const r2Service = getR2Service();
    const result = await r2Service.bulkUploadMedia(urls, organisationId, adType);
    
    // Return R2 URLs in the same order as original URLs, fallback to original URL if upload failed
    return urls.map(originalUrl => result.urlMapping.get(originalUrl) || originalUrl);
  } catch (error) {
    logger.error(`[R2UploadService] Error in uploadMediaUrlsToR2:`, error);
    // Return original URLs if upload fails
    return urls;
  }
};

/**
 * New bulk upload function that returns detailed results
 */
export const bulkUploadMediaToR2 = async (
  urls: string[],
  organisationId: string,
  adType: 'competitor' | 'self'
): Promise<BulkUploadResult> => {
  if (urls.length === 0) {
    return {
      successful: [],
      failed: [],
      urlMapping: new Map(),
    };
  }

  try {
    const r2Service = getR2Service();
    return await r2Service.bulkUploadMedia(urls, organisationId, adType);
  } catch (error) {
    logger.error(`[R2UploadService] Error in bulkUploadMediaToR2:`, error);
    return {
      successful: [],
      failed: urls.map(url => ({ url, error: (error as Error).message })),
      urlMapping: new Map(),
    };
  }
}; 