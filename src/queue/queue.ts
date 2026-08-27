import { Queue } from "bullmq";
import { Redis as IORedis } from "ioredis";
import { env } from "../config/env.js";

export const redisConnection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const SCRAPE_QUEUE_NAME = "scrape-profile";

export interface ScrapeJobData {
  publicIdentifier: string;
}

export interface ScrapeJobResult {
  publicIdentifier: string;
  cacheHit: boolean;
}

export const scrapeQueue = new Queue<ScrapeJobData, ScrapeJobResult>(SCRAPE_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 24 * 3600 },
  },
});
