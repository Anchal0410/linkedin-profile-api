import type { Browser, Locator, Page } from "playwright";
import { newContext } from "../session/browser.js";

// LinkedIn's profile page (as of this build) is server-driven UI: section
// wrappers get dynamically-generated URN-based ids
// (e.g. "com.linkedin.sdui.profile.card.ref<urn>About"), not stable
// classes/ids. There is no reliable CSS selector for "the About section"
// anymore. What *is* stable: visible heading text ("About", "Experience", ...)
// and document order. So extraction here is heading-anchored + positional
// text parsing, verified against a real live profile — see README
// limitations for what that verification did and didn't cover.
export interface DomProfileRaw {
  name: string | null;
  headline: string | null;
  location: string | null;
  about: string | null;
  profileImageUrl: string | null;
  bannerImageUrl: string | null;
  experience: Array<{
    title: string | null;
    company: string | null;
    employmentType: string | null;
    location: string | null;
    dateRange: string | null;
    description: string | null;
  }>;
  education: Array<{
    school: string | null;
    degree: string | null;
    field: string | null;
    dateRange: string | null;
    description: string | null;
  }>;
  skills: string[];
  certifications: Array<{ name: string | null; issuer: string | null; date: string | null }>;
  languages: Array<{ name: string; proficiency: string | null }>;
}

const PRONOUN_LINE = /^(he\/him|she\/her|they\/them)$/i;
const SKIP_LINE = /^(·|contact info)$/i;

// LinkedIn's SDUI cards hydrate asynchronously after the initial render —
// Locator.count() is an instant snapshot and doesn't wait, so it can race a
// section that hasn't mounted yet. Wait for actual appearance instead.
// 12s, not 4s: a resource-constrained host (small cloud instance) renders
// the page meaningfully slower than a dev machine — confirmed in production
// (name/headline/about came back null while image extraction, which uses
// Playwright's own much longer default actionability wait, succeeded).
async function existsWithin(locator: Locator, timeout = 12000): Promise<boolean> {
  try {
    await locator.first().waitFor({ state: "attached", timeout });
    return true;
  } catch {
    return false;
  }
}

// Climbs from `anchor` until an ancestor's innerText satisfies `predicate` —
// the smallest container that actually scopes the section we want, without
// hardcoding a DOM-depth number that LinkedIn can (and does) change.
async function climbToAncestorWhere(
  anchor: Locator,
  predicate: (text: string) => boolean,
  maxLevels = 16,
): Promise<string | null> {
  for (let level = 1; level <= maxLevels; level++) {
    const text = await anchor
      .locator(`xpath=ancestor::*[${level}]`)
      .innerText()
      .catch(() => "");
    if (text && predicate(text)) return text;
  }
  return null;
}

async function extractTopCard(page: Page): Promise<{
  name: string | null;
  headline: string | null;
  location: string | null;
}> {
  const nameHeading = page.locator("main").getByRole("heading", { level: 2 }).first();
  if (!(await existsWithin(nameHeading))) return { name: null, headline: null, location: null };

  const blockText = await climbToAncestorWhere(
    nameHeading,
    (t) => /connections|followers/i.test(t) && !t.includes("Analytics"),
  );
  if (!blockText) return { name: (await nameHeading.innerText().catch(() => null)) || null, headline: null, location: null };

  const lines = blockText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !SKIP_LINE.test(l));

  const name = lines[0] ?? null;
  let i = 1;
  if (lines[i] && PRONOUN_LINE.test(lines[i])) i++;
  const headline = lines[i] ?? null;
  i++;
  const location = lines[i] ?? null;

  return { name, headline, location };
}

// Heading-anchored: find the section by its visible title, scope to the
// smallest ancestor that has real content beyond just the heading, strip
// LinkedIn's trailing "… more" truncation control.
async function extractSectionText(page: Page, headingText: string): Promise<string | null> {
  const heading = page.getByRole("heading", { name: headingText, exact: true }).first();
  if (!(await existsWithin(heading))) return null;

  const text = await climbToAncestorWhere(heading, (t) => t.length > headingText.length + 15);
  if (!text) return null;

  return text
    .replace(new RegExp(`^${headingText}\\s*`), "")
    .replace(/…\s*more\s*$/i, "")
    .trim();
}

export async function scrapeProfileDom(
  browser: Browser,
  publicIdentifier: string,
  opts: { storageState: string; proxyUrl?: string | null },
): Promise<DomProfileRaw> {
  const context = await newContext(browser, opts);
  const page = await context.newPage();

  await page.goto(`https://www.linkedin.com/in/${publicIdentifier}/`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(3000);

  const { name, headline, location } = await extractTopCard(page);
  const about = await extractSectionText(page, "About");

  const profileImageUrl = await page
    .locator("img[src*='profile-displayphoto']")
    .first()
    .getAttribute("src")
    .catch(() => null);
  const bannerImageUrl = await page
    .locator("img[src*='profile-displaybackgroundimage']")
    .first()
    .getAttribute("src")
    .catch(() => null);

  // Experience/Education/Skills/Certifications/Languages: same
  // heading-anchored approach, but unverified against a populated example
  // (the profile this was built against didn't have them filled in — see
  // README). Returns a best-effort single blob per entry, not reliably
  // split into individual roles/degrees.
  async function extractListSection(headingText: string): Promise<string[]> {
    const blob = await extractSectionText(page, headingText);
    if (!blob) return [];
    return blob
      .split(/\n{2,}/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const experienceBlocks = await extractListSection("Experience");
  const educationBlocks = await extractListSection("Education");
  const certificationBlocks = await extractListSection("Licenses & certifications");
  const languageBlocks = await extractListSection("Languages");
  const skillsBlob = await extractSectionText(page, "Skills");

  await context.close();

  return {
    name,
    headline,
    location,
    about,
    profileImageUrl: profileImageUrl ?? null,
    bannerImageUrl: bannerImageUrl ?? null,
    experience: experienceBlocks.map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      return {
        title: lines[0] ?? null,
        company: lines[1] ?? null,
        employmentType: null,
        dateRange: lines[2] ?? null,
        location: lines[3] ?? null,
        description: lines.slice(4).join(" ") || null,
      };
    }),
    education: educationBlocks.map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      return {
        school: lines[0] ?? null,
        degree: lines[1] ?? null,
        field: null,
        dateRange: lines[2] ?? null,
        description: lines.slice(3).join(" ") || null,
      };
    }),
    skills: skillsBlob ? skillsBlob.split("\n").map((s) => s.trim()).filter(Boolean) : [],
    certifications: certificationBlocks.map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      return { name: lines[0] ?? null, issuer: lines[1] ?? null, date: lines[2] ?? null };
    }),
    languages: languageBlocks.map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      return { name: lines[0] ?? "", proficiency: lines[1] ?? null };
    }),
  };
}
