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

export class VoyagerBlockedError extends Error {
  constructor(public status: number) {
    super(`Voyager API returned ${status} (session likely expired or challenged)`);
  }
}

function buildAuthHeaders(storageStateJson: string): Record<string, string> {
  const state = JSON.parse(storageStateJson) as StorageState;
  const linkedinCookies = state.cookies.filter((c) => c.domain.includes("linkedin.com"));

  const cookieHeader = linkedinCookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const jsessionId = linkedinCookies.find((c) => c.name === "JSESSIONID")?.value ?? "";
  // JSESSIONID is stored quoted, e.g. "ajax:1234567890"; csrf-token wants it unquoted.
  const csrfToken = jsessionId.replace(/"/g, "");

  return {
    Cookie: cookieHeader,
    "csrf-token": csrfToken,
    "x-restli-protocol-version": "2.0.0",
    "x-li-lang": "en_US",
    Accept: "application/vnd.linkedin.normalized+json+2.1",
    "User-Agent": REALISTIC_UA,
    Referer: "https://www.linkedin.com/",
  };
}

export async function voyagerGet(path: string, storageStateJson: string): Promise<unknown> {
  const res = await fetch(`https://www.linkedin.com/voyager/api${path}`, {
    headers: buildAuthHeaders(storageStateJson),
  });

  if (!res.ok) throw new VoyagerBlockedError(res.status);
  return res.json();
}
