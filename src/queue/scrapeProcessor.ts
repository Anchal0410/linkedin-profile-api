import type { Job } from "bullmq";
import { logger } from "../config/logger.js";
import { prisma } from "../db/prisma.js";
import { getCachedProfile, saveCachedProfile } from "../cache/profileCache.js";
import { checkoutAccount } from "../scraper/accountPool/pool.js";
import { markQuarantined } from "../scraper/session/sessionStore.js";
import { scrapeProfile } from "../scraper/scrapeProfile.js";
import { ProfileNotFoundError } from "../scraper/http/fetchProfileHtml.js";
import type { ScrapeJobData, ScrapeJobResult } from "./queue.js";

export function makeScrapeProcessor() {
  return async function processScrapeJob(job: Job<ScrapeJobData, ScrapeJobResult>): Promise<ScrapeJobResult> {
    const { publicIdentifier } = job.data;

    const cached = await getCachedProfile(publicIdentifier);
    if (cached) {
      logger.info({ publicIdentifier }, "Serving from cache, skipping scrape");
      return { publicIdentifier, cacheHit: true };
    }

    const account = await checkoutAccount();
    try {
      const profile = await scrapeProfile(publicIdentifier, account);
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
      // A bad/nonexistent identifier is a caller-input problem, not a
      // session problem — don't burn the account's standing over it.
      // Anything else (blocked, network, unexpected shape) genuinely might
      // mean the session is compromised, so quarantine for a human look.
      if (!(err instanceof ProfileNotFoundError)) {
        await markQuarantined(account.id, message);
      }
      throw err;
    }
  };
}
