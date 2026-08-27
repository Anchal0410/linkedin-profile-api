import { chromium, type Browser, type BrowserContext } from "playwright";

const REALISTIC_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export async function launchBrowser(opts: { headless: boolean }): Promise<Browser> {
  return chromium.launch({ headless: opts.headless });
}

export async function newContext(
  browser: Browser,
  opts: { storageState?: string; proxyUrl?: string | null },
): Promise<BrowserContext> {
  return browser.newContext({
    userAgent: REALISTIC_UA,
    viewport: { width: 1366, height: 900 },
    storageState: opts.storageState ? JSON.parse(opts.storageState) : undefined,
    proxy: opts.proxyUrl ? { server: opts.proxyUrl } : undefined,
  });
}
