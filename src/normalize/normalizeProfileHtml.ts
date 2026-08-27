import type { Profile } from "./types.js";

// Extraction anchors here are verified against a real logged-in fetch of a
// live profile (see sniff4.ts-style investigation, README "Approach") —
// not guessed. LinkedIn's classes are hashed per-build, so nothing here
// selects by class; each anchor is either a fixed string LinkedIn itself
// can't easily obfuscate (the <title> tag, the contact-info overlay URL)
// or a fixed structural relationship to one of those.
const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&#x27;": "'",
  "&quot;": '"',
  "&lt;": "<",
  "&gt;": ">",
  "&#39;": "'",
};

function decodeEntities(text: string): string {
  return text.replace(/&(amp|#x27|quot|lt|gt|#39);/g, (m) => HTML_ENTITIES[m] ?? m);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractName(html: string): string | null {
  const match = html.match(/<title>([^|]+)\|\s*LinkedIn<\/title>/);
  return match ? decodeEntities(match[1].trim()) : null;
}

function extractHeadline(html: string, name: string): string | null {
  const pattern = new RegExp(`>${escapeRegExp(name)}</p><div[^>]*><p[^>]*><span>([^<]+)</span>`);
  const match = html.match(pattern);
  return match ? decodeEntities(match[1].trim()) : null;
}

function extractLocation(html: string): string | null {
  // <p>LOCATION</p><p>·</p><p><a href=".../overlay/contact-info/">Contact info</a></p>
  const match = html.match(/<p[^>]*>([^<]+)<\/p><p[^>]*>·<\/p><p[^>]*><a[^>]*\/overlay\/contact-info\/"/);
  return match ? decodeEntities(match[1].trim()) : null;
}

function extractImage(html: string, kind: "profile-displayphoto" | "profile-displaybackgroundimage"): string | null {
  // These URLs live inside a srcset (comma/space-separated list of
  // variants with width descriptors, e.g. "url1 100w, url2 200w") — the
  // character class has to stop at whitespace/comma too, not just quotes,
  // or it captures the whole srcset as one malformed "URL".
  const pattern = new RegExp(`https://media\\.licdn\\.com/dms/image/[^"'\\\\\\s,]*${kind}[^"'\\\\\\s,]*`);
  const match = html.match(pattern);
  return match ? decodeEntities(match[0]) : null;
}

// Pure HTTP, no browser: this parses whatever LinkedIn server-renders into
// the initial page load. Name/headline/location/profile image come from
// there and are verified working. About/experience/education/skills/
// certifications/languages load client-side afterward via endpoints not
// yet reverse-engineered — see README limitations. Returned as empty
// rather than attempted, so callers get an honest signal, not silence
// dressed up as a real answer.
export function normalizeProfileHtml(html: string, publicIdentifier: string): Profile {
  const name = extractName(html);

  return {
    publicIdentifier,
    name,
    headline: name ? extractHeadline(html, name) : null,
    location: extractLocation(html),
    about: null,
    profileImageUrl: extractImage(html, "profile-displayphoto"),
    bannerImageUrl: extractImage(html, "profile-displaybackgroundimage"),
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    source: "http",
    dataCompleteness: "partial-fields-only",
    scrapedAt: new Date().toISOString(),
  };
}
