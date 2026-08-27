import type { Account } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { touchLastUsed } from "../session/sessionStore.js";

export class NoAccountAvailableError extends Error {
  constructor() {
    super('No active LinkedIn account. Run "npm run login" first.');
  }
}

function randomDelayMs(): number {
  const { SCRAPE_MIN_DELAY_MS, SCRAPE_MAX_DELAY_MS } = env;
  return SCRAPE_MIN_DELAY_MS + Math.random() * (SCRAPE_MAX_DELAY_MS - SCRAPE_MIN_DELAY_MS);
}

// Single-account today; querying by status:"active" instead of a fixed label
// is what lets this grow into round-robin over multiple rows later without
// touching call sites.
export async function checkoutAccount(): Promise<Account> {
  const account = await prisma.account.findFirst({
    where: { status: "active", cookieJson: { not: null } },
    orderBy: { lastUsedAt: "asc" },
  });
  if (!account) throw new NoAccountAvailableError();

  if (account.lastUsedAt) {
    const elapsed = Date.now() - account.lastUsedAt.getTime();
    const wait = randomDelayMs() - elapsed;
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  }

  await touchLastUsed(account.id);
  return account;
}
