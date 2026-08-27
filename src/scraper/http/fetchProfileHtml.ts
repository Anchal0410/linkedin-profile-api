import { buildAuthHeaders } from "./authHeaders.js";

export class ProfileNotFoundError extends Error {
  constructor(publicIdentifier: string) {
    super(`No such LinkedIn profile: "${publicIdentifier}" (hit the guest/join wall, not a real profile)`);
  }
}

export class ProfileFetchBlockedError extends Error {
  constructor(public status: number) {
    super(`Profile page request returned ${status} (session likely expired or challenged)`);
  }
}

// The whole scrape, no browser: LinkedIn server-renders the profile page's
// visible content (name/headline/location/photo) directly into this HTML —
// verified by comparing this fetch's output against what a real browser
// renders. See normalizeProfileHtml.ts for what does and doesn't parse out
// of it, and README limitations for what LinkedIn loads client-side instead
// (about/experience/education/etc — not reachable this way yet).
export async function fetchProfileHtml(publicIdentifier: string, storageStateJson: string): Promise<string> {
  const res = await fetch(`https://www.linkedin.com/in/${publicIdentifier}/`, {
    headers: buildAuthHeaders(storageStateJson),
  });

  if (!res.ok) throw new ProfileFetchBlockedError(res.status);

  const html = await res.text();
  // A real profile always has <title>Name | LinkedIn</title> — an empty
  // title tag is the confirmed signal for a bad identifier (verified
  // against both a real nonexistent profile and two real valid ones —
  // "This page doesn't exist" was tried too but turned out to be generic
  // bundled JS boilerplate present on every page, not a real signal).
  // /authwall / "Join LinkedIn" covers the logged-out guest-wall case.
  const looksMissing = html.includes("<title></title>") || html.includes("Join LinkedIn");
  if (res.url.includes("/authwall") || looksMissing) {
    throw new ProfileNotFoundError(publicIdentifier);
  }

  return html;
}
