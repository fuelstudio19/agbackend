import { logger } from '../utils/logger';

/**
 * A simple in-memory cache service with Time-To-Live (TTL) support.
 * Can be replaced with a more robust solution like Redis or node-cache later.
 */
export class CacheService<T> {
    private cache: Map<string, { data: T; expiry: number }> = new Map();
    private defaultTtlSeconds: number;

    /**
     * Creates an instance of CacheService.
     * @param defaultTtlSeconds Default TTL for cache entries in seconds. Defaults to 3600 (1 hour).
     */
    constructor(defaultTtlSeconds: number = 3600) {
        if (defaultTtlSeconds <= 0) {
            logger.warn("[CacheService] TTL must be positive. Using default of 3600 seconds.");
            this.defaultTtlSeconds = 3600;
        } else {
            this.defaultTtlSeconds = defaultTtlSeconds;
        }
    }

    /**
     * Stores a value in the cache.
     * @param key The cache key.
     * @param value The value to store.
     * @param ttlSeconds Optional TTL for this specific key in seconds. Uses default TTL if not provided.
     */
    set(key: string, value: T, ttlSeconds: number = this.defaultTtlSeconds): void {
        const expiry = Date.now() + ttlSeconds * 1000;
        this.cache.set(key, { data: value, expiry });
        logger.info(`[CacheService] Set key: ${key}, TTL: ${ttlSeconds}s`);
    }

    /**
     * Retrieves a value from the cache.
     * Returns null if the key doesn't exist or the item has expired.
     * @param key The cache key.
     * @returns The cached value or null.
     */
    get(key: string): T | null {
        const item = this.cache.get(key);
        if (item) {
            if (Date.now() < item.expiry) {
                logger.info(`[CacheService] Cache hit: ${key}`);
                return item.data;
            } else {
                logger.info(`[CacheService] Cache expired: ${key}`);
                this.cache.delete(key); // Eagerly remove expired item
            }
        }
        // logger.info(`[CacheService] Cache miss: ${key}`); // Reduce noise, log hit/set/expired instead
        return null;
    }

    /**
     * Deletes a specific key from the cache.
     * @param key The cache key to delete.
     */
    delete(key: string): void {
        const deleted = this.cache.delete(key);
        if (deleted) {
            logger.info(`[CacheService] Deleted key: ${key}`);
        }
    }

    /**
     * Clears the entire cache.
     */
    clear(): void {
        this.cache.clear();
        logger.info(`[CacheService] Cache cleared.`);
    }
} 