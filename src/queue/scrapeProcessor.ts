import type { Browser } from "playwright";
import type { Job } from "bullmq";
import { logger } from "../config/logger.js";
import { prisma } from "../db/prisma.js";
import { getCachedProfile, saveCachedProfile } from "../cache/profileCache.js";
import { checkoutAccount } from "../scraper/accountPool/pool.js";
import { markQuarantined } from "../scraper/session/sessionStore.js";
import { scrapeProfile } from "../scraper/scrapeProfile.js";
import type { ScrapeJobData, ScrapeJobResult } from "./queue.js";

export function makeScrapeProcessor(browser: Browser) {
  return async function processScrapeJob(job: Job<ScrapeJobData, ScrapeJobResult>): Promise<ScrapeJobResult> {
    const { publicIdentifier } = job.data;

    const cached = await getCachedProfile(publicIdentifier);
    if (cached) {
      logger.info({ publicIdentifier }, "Serving from cache, skipping scrape");
      return { publicIdentifier, cacheHit: true };
    }

    const account = await checkoutAccount();
    try {
      const profile = await scrapeProfile(browser, publicIdentifier, account);
      await saveCachedProfile(profile);
      await prisma.auditLog.create({
        data: { accountId: account.id, event: "scrape_success", detail: { publicIdentifier, source: profile.source } },
      });
      return { publicIdentifier, cacheHit: false };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ publicIdentifier, err: message }, "Scrape failed");
      await prisma.auditLog.create({
        data: { accountId: account.id, event: "scrape_failure", detail: { publicIdentifier, message } },
      });
      // Conservative: any failure quarantines the account rather than
      // retrying against LinkedIn blind — a human should look at lastError
      // before this account scrapes again.
      await markQuarantined(account.id, message);
      throw err;
    }
  };
}
