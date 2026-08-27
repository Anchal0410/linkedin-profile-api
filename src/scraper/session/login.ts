import type { Browser, Page } from "playwright";
import { logger } from "../../config/logger.js";
import { newContext } from "./browser.js";

export class CheckpointError extends Error {
  constructor() {
    super(
      "LinkedIn showed a checkpoint/CAPTCHA/2FA challenge. Re-run `npm run login` with " +
        "LOGIN_HEADLESS=false and solve it manually in the opened browser window.",
    );
  }
}

function isChallengeUrl(url: string): boolean {
  return url.includes("/checkpoint/") || url.includes("challengeId=");
}

// Parses the pathname rather than substring-matching the raw URL — a
// redirect chain's query string (e.g. an authwall's sessionRedirect param)
// can otherwise false-positive-match "/feed/" or "/in/" before LinkedIn has
// actually finished authenticating.
function isAuthenticatedUrl(url: string): boolean {
  const { pathname } = new URL(url);
  return pathname === "/feed/" || pathname.startsWith("/in/");
}

// LinkedIn can throw a "verify it's you" challenge at any point — before the
// login form even loads (recognized/flagged device), or after submitting
// credentials. Call this after every navigation rather than only once.
async function resolveAnyChallenge(page: Page, headless: boolean): Promise<void> {
  if (!isChallengeUrl(page.url())) return;

  if (headless) throw new CheckpointError();

  logger.warn(
    { url: page.url() },
    "Checkpoint/verification detected — solve it in the browser window. Waiting up to 5 minutes.",
  );
  await page.waitForURL((url) => !isChallengeUrl(url.toString()), { timeout: 5 * 60 * 1000 });
}

// Chromium's own DNS resolver can hiccup transiently (e.g. IPv6 flakiness)
// independently of the OS's — retry navigation itself before giving up.
async function gotoWithRetry(page: Page, url: string, attempts = 3): Promise<void> {
  for (let i = 1; i <= attempts; i++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isNetworkError = /ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|ERR_NETWORK_CHANGED|ERR_INTERNET_DISCONNECTED|Timeout/.test(
        message,
      );
      if (!isNetworkError || i === attempts) throw err;
      logger.warn({ url, attempt: i, message }, "Navigation failed, retrying");
      await page.waitForTimeout(2000 * i);
    }
  }
}

// Drives the real LinkedIn login form and returns a storageState (cookies +
// localStorage) the rest of the app reuses instead of logging in per request.
export async function login(
  browser: Browser,
  opts: { email: string; password: string; headless: boolean; proxyUrl?: string | null },
): Promise<string> {
  const context = await newContext(browser, { proxyUrl: opts.proxyUrl });
  const page = await context.newPage();

  await gotoWithRetry(page, "https://www.linkedin.com/login");
  await page.waitForTimeout(1500);
  await resolveAnyChallenge(page, opts.headless);

  // Only fill the form if one is actually there — a challenge can resolve
  // straight to the feed without ever showing #username again.
  const onLoginForm = (await page.locator("#username").count().catch(() => 0)) > 0;
  if (onLoginForm) {
    await page.fill("#username", opts.email);
    await page.fill("#password", opts.password);
    await page.click('button[type="submit"]');
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    await resolveAnyChallenge(page, opts.headless);
  }

  // Feed/home page redirect is a necessary signal but not sufficient on its
  // own (see isAuthenticatedUrl) — li_at actually being set is the real one.
  await page.waitForURL((url) => isAuthenticatedUrl(url.toString()), { timeout: 60_000 });
  await page.waitForTimeout(1500); // li_at can be set a beat after the redirect lands

  const cookies = await context.cookies();
  const hasAuthCookie = cookies.some((c) => c.name === "li_at" && c.domain.includes("linkedin.com"));
  if (!hasAuthCookie) {
    await context.close();
    throw new Error(
      `Reached ${page.url()} but no li_at auth cookie was issued — the session isn't actually ` +
        "authenticated yet. Re-run `npm run login`; if this repeats, wait a few seconds longer " +
        "after clearing the checkpoint before the script grabs the session.",
    );
  }

  const storageState = await context.storageState();
  await context.close();
  return JSON.stringify(storageState);
}
