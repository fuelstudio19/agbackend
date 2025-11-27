import {Redis} from 'ioredis'
import dotenv from 'dotenv';
import { logger } from './logger';

dotenv.config()

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT_NUMBER || '6379', 10),
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true
});

// Redis connection event logging
redis.on('connect', () => {
  logger.info('[Redis] Connected to Redis server');
});

export default redis