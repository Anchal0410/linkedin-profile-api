import { z } from "zod";

export const ExperienceSchema = z.object({
  title: z.string().nullable(),
  company: z.string().nullable(),
  employmentType: z.string().nullable(),
  location: z.string().nullable(),
  dateRange: z.string().nullable(),
  description: z.string().nullable(),
});

export const EducationSchema = z.object({
  school: z.string().nullable(),
  degree: z.string().nullable(),
  field: z.string().nullable(),
  dateRange: z.string().nullable(),
  description: z.string().nullable(),
});

export const CertificationSchema = z.object({
  name: z.string().nullable(),
  issuer: z.string().nullable(),
  date: z.string().nullable(),
});

export const LanguageSchema = z.object({
  name: z.string(),
  proficiency: z.string().nullable(),
});

export const ProfileSchema = z.object({
  publicIdentifier: z.string(),
  name: z.string().nullable(),
  headline: z.string().nullable(),
  location: z.string().nullable(),
  about: z.string().nullable(),
  profileImageUrl: z.string().url().nullable(),
  bannerImageUrl: z.string().url().nullable(),
  experience: z.array(ExperienceSchema),
  education: z.array(EducationSchema),
  skills: z.array(z.string()),
  certifications: z.array(CertificationSchema),
  languages: z.array(LanguageSchema),
  source: z.enum(["http"]),
  // "partial-fields-only": name/headline/location/images are real
  // (server-rendered into the page LinkedIn sends back); about/experience/
  // education/skills/certifications/languages are always empty because
  // that path — LinkedIn's client-side React Server Component endpoints —
  // isn't reverse-engineered yet, not because this specific profile lacks
  // them. See README limitations before treating an empty array as "this
  // person has no experience listed."
  dataCompleteness: z.enum(["partial-fields-only"]),
  scrapedAt: z.string(),
});

export type Profile = z.infer<typeof ProfileSchema>;
