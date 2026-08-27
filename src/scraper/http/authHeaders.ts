interface StorageStateCookie {
  name: string;
  value: string;
  domain: string;
}

interface StorageState {
  cookies: StorageStateCookie[];
}

const REALISTIC_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

// Turns a saved Playwright storageState (from the one-time browser login)
// into plain HTTP headers — everything after login is cookie-based fetch(),
// no browser involved.
export function buildAuthHeaders(storageStateJson: string): Record<string, string> {
  const state = JSON.parse(storageStateJson) as StorageState;
  const linkedinCookies = state.cookies.filter((c) => c.domain.includes("linkedin.com"));

  const cookieHeader = linkedinCookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const jsessionId = linkedinCookies.find((c) => c.name === "JSESSIONID")?.value ?? "";
  const csrfToken = jsessionId.replace(/"/g, "");

  return {
    Cookie: cookieHeader,
    "csrf-token": csrfToken,
    "User-Agent": REALISTIC_UA,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };
}
