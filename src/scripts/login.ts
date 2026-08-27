import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { launchBrowser } from "../scraper/session/browser.js";
import { login } from "../scraper/session/login.js";
import { getOrCreateDefaultAccount, saveSession } from "../scraper/session/sessionStore.js";

// One-time (or re-run-after-quarantine) interactive login. Keep
// LOGIN_HEADLESS=false the first time so you're present to clear any
// checkpoint/2FA prompt LinkedIn shows a new device — this script cannot
// do that for you.
async function main() {
  const account = await getOrCreateDefaultAccount(env.LINKEDIN_EMAIL);
  const browser = await launchBrowser({ headless: env.LOGIN_HEADLESS });

  try {
    const storageState = await login(browser, {
      email: env.LINKEDIN_EMAIL,
      password: env.LINKEDIN_PASSWORD,
      headless: env.LOGIN_HEADLESS,
      proxyUrl: account.proxyUrl,
    });
    await saveSession(account.id, storageState);
    logger.info({ accountId: account.id }, "Login succeeded, session saved");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  logger.error(err, "Login failed");
  process.exit(1);
});
