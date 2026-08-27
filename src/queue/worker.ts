import { Worker } from "bullmq";
import { chromium } from "playwright";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { SCRAPE_QUEUE_NAME, redisConnection } from "./queue.js";
import { makeScrapeProcessor } from "./scrapeProcessor.js";

async function main() {
  const browser = await chromium.launch({ headless: true });
  logger.info("Headless browser launched for DOM-fallback scraping");

  const worker = new Worker(SCRAPE_QUEUE_NAME, makeScrapeProcessor(browser), {
    connection: redisConnection,
    concurrency: 1, // one LinkedIn session in flight at a time (see accountPool/pool.ts)
  });

  worker.on("completed", (job) => logger.info({ jobId: job.id, data: job.data }, "Job completed"));
  worker.on("failed", (job, err) => logger.error({ jobId: job?.id, err: err.message }, "Job failed"));

  const shutdown = async () => {
    await worker.close();
    await browser.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error(err, "Worker crashed on startup");
  process.exit(1);
});

void env; // ensures env is validated at startup even though unused directly here
