import { Worker } from "bullmq";
import { chromium, type Browser } from "playwright";
import { logger } from "../config/logger.js";
import { SCRAPE_QUEUE_NAME, redisConnection } from "./queue.js";
import { makeScrapeProcessor } from "./scrapeProcessor.js";

// Shared by both the standalone worker process (worker.ts, for a two-service
// deploy) and the single-process combined entrypoint (index.ts, for a
// one-service deploy) — same worker, different callers own shutdown.
export async function startWorker(): Promise<{ worker: Worker; browser: Browser }> {
  const browser = await chromium.launch({ headless: true });
  logger.info("Headless browser launched for DOM-fallback scraping");

  const worker = new Worker(SCRAPE_QUEUE_NAME, makeScrapeProcessor(browser), {
    connection: redisConnection,
    concurrency: 1, // one LinkedIn session in flight at a time (see accountPool/pool.ts)
  });

  worker.on("completed", (job) => logger.info({ jobId: job.id, data: job.data }, "Job completed"));
  worker.on("failed", (job, err) => logger.error({ jobId: job?.id, err: err.message }, "Job failed"));

  return { worker, browser };
}
