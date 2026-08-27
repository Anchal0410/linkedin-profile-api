import type { DomProfileRaw } from "../scraper/dom/domScraper.js";
import type { Profile } from "./types.js";

export function normalizeDomProfile(
  raw: DomProfileRaw,
  publicIdentifier: string,
  dataCompleteness: Profile["dataCompleteness"],
): Profile {
  return {
    publicIdentifier,
    ...raw,
    source: "dom",
    dataCompleteness,
    scrapedAt: new Date().toISOString(),
  };
}
