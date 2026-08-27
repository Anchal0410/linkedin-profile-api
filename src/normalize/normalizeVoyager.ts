import type { Profile } from "./types.js";

// Voyager's normalized-json responses put every entity — profile, each
// position, each degree, each skill — as a flat item in "included",
// distinguished by "$type". This is the piece most likely to need
// adjustment after a real test run: LinkedIn changes these type strings
// and nesting across releases without notice (see README limitations).
interface IncludedEntity {
  $type?: string;
  [key: string]: unknown;
}

function byType(included: IncludedEntity[], typeSuffix: string): IncludedEntity[] {
  return included.filter((e) => typeof e.$type === "string" && e.$type.endsWith(typeSuffix));
}

function largestImageUrl(picture: unknown): string | null {
  const ref = (picture as any)?.displayImageReference?.vectorImage;
  if (!ref?.artifacts?.length) return null;
  const best = [...ref.artifacts].sort(
    (a: any, b: any) => (b.width ?? 0) - (a.width ?? 0),
  )[0] as any;
  return best ? `${ref.rootUrl}${best.fileIdentifyingUrlPathSegment}` : null;
}

function dateRangeToString(dr: any): string | null {
  if (!dr) return null;
  const fmt = (d: any) => (d ? [d.month, d.year].filter(Boolean).join("/") : null);
  const start = fmt(dr.start);
  const end = fmt(dr.end) ?? (dr.start ? "Present" : null);
  return [start, end].filter(Boolean).join(" - ") || null;
}

// dataCompleteness is a placeholder here — scrapeProfile.ts overwrites it
// once experience/education counts are known.
export function normalizeVoyagerProfileView(raw: unknown, publicIdentifier: string): Profile {
  const dataCompleteness: Profile["dataCompleteness"] = "full";
  const included = ((raw as any)?.included ?? []) as IncludedEntity[];

  const profile = byType(included, "identity.profile.Profile")[0] as any;
  const positions = byType(included, "identity.profile.Position");
  const educations = byType(included, "identity.profile.Education");
  const skills = byType(included, "identity.profile.Skill");
  const certifications = byType(included, "identity.profile.Certification");
  const languages = byType(included, "identity.profile.Language");

  return {
    publicIdentifier,
    name: profile ? [profile.firstName, profile.lastName].filter(Boolean).join(" ") || null : null,
    headline: profile?.headline ?? null,
    location: profile?.geoLocationName ?? profile?.locationName ?? null,
    about: profile?.summary ?? null,
    profileImageUrl: largestImageUrl(profile?.profilePicture),
    bannerImageUrl: largestImageUrl(profile?.backgroundImage),
    experience: positions.map((p: any) => ({
      title: p.title ?? null,
      company: p.companyName ?? p.company?.name ?? null,
      employmentType: p.employmentType ?? null,
      location: p.locationName ?? null,
      dateRange: dateRangeToString(p.dateRange ?? p.timePeriod),
      description: p.description ?? null,
    })),
    education: educations.map((e: any) => ({
      school: e.schoolName ?? null,
      degree: e.degreeName ?? null,
      field: e.fieldOfStudy ?? null,
      dateRange: dateRangeToString(e.dateRange ?? e.timePeriod),
      description: e.description ?? null,
    })),
    skills: skills.map((s: any) => s.name).filter(Boolean),
    certifications: certifications.map((c: any) => ({
      name: c.name ?? null,
      issuer: c.authority ?? null,
      date: dateRangeToString(c.timePeriod) ?? c.timePeriod?.start?.year?.toString() ?? null,
    })),
    languages: languages.map((l: any) => ({
      name: l.name,
      proficiency: l.proficiency ?? null,
    })),
    source: "voyager",
    dataCompleteness,
    scrapedAt: new Date().toISOString(),
  };
}
