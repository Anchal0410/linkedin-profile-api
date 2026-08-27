import type { Browser } from "playwright";
import type { Account } from "@prisma/client";
import { logger } from "../config/logger.js";
import type { Profile } from "../normalize/types.js";
import { ProfileSchema } from "../normalize/types.js";
import { fetchVoyagerProfileView } from "./voyager/fetchProfile.js";
import { normalizeVoyagerProfileView } from "../normalize/normalizeVoyager.js";
import { scrapeProfileDom } from "./dom/domScraper.js";
import { normalizeDomProfile } from "../normalize/normalizeDom.js";
import { VoyagerBlockedError } from "./voyager/client.js";

function guessCompleteness(experienceCount: number, educationCount: number): Profile["dataCompleteness"] {
  return experienceCount === 0 && educationCount === 0 ? "limited-out-of-network" : "full";
}

// Voyager first (fast, structured JSON) with a DOM-render fallback when the
// session is challenged or the response shape doesn't match what we expect
// — see normalizeVoyager.ts and domScraper.ts for why either path can miss.
export async function scrapeProfile(
  browser: Browser,
  publicIdentifier: string,
  account: Account,
): Promise<Profile> {
  if (!account.cookieJson) throw new Error(`Account ${account.id} has no saved session`);

  try {
    const raw = await fetchVoyagerProfileView(publicIdentifier, account.cookieJson);
    const included = (raw as any)?.included;
    if (!Array.isArray(included) || included.length === 0) {
      throw new Error("Voyager response had no `included` entities — treating as unusable");
    }
    const profile = normalizeVoyagerProfileView(raw, publicIdentifier);
    profile.dataCompleteness = guessCompleteness(profile.experience.length, profile.education.length);
    return ProfileSchema.parse(profile);
  } catch (err) {
    const reason = err instanceof VoyagerBlockedError ? `blocked (${err.status})` : String(err);
    logger.warn({ publicIdentifier, reason }, "Voyager path failed, falling back to DOM scrape");
  }

  const domRaw = await scrapeProfileDom(browser, publicIdentifier, {
    storageState: account.cookieJson,
    proxyUrl: account.proxyUrl,
  });
  const profile = normalizeDomProfile(
    domRaw,
    publicIdentifier,
    guessCompleteness(domRaw.experience.length, domRaw.education.length),
  );
  return ProfileSchema.parse(profile);
}
