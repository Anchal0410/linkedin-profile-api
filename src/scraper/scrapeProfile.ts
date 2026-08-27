import type { Account } from "@prisma/client";
import { ProfileSchema, type Profile } from "../normalize/types.js";
import { fetchProfileHtml } from "./http/fetchProfileHtml.js";
import { normalizeProfileHtml } from "../normalize/normalizeProfileHtml.js";

// No browser at runtime — the browser only ever runs once, interactively,
// for login (scripts/login.ts). This is a plain HTTP fetch + parse of
// whatever LinkedIn server-renders, reusing the session cookies login
// produced. See fetchProfileHtml.ts / normalizeProfileHtml.ts for what
// that does and doesn't cover.
export async function scrapeProfile(publicIdentifier: string, account: Account): Promise<Profile> {
  if (!account.cookieJson) throw new Error(`Account ${account.id} has no saved session`);

  const html = await fetchProfileHtml(publicIdentifier, account.cookieJson);
  const profile = normalizeProfileHtml(html, publicIdentifier);
  return ProfileSchema.parse(profile);
}
