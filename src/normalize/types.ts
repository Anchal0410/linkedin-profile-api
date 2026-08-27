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
  source: z.enum(["voyager", "dom"]),
  // "full" when the scraping account is in-network with the profile;
  // LinkedIn truncates experience/education/skills for out-of-network views.
  dataCompleteness: z.enum(["full", "limited-out-of-network"]),
  scrapedAt: z.string(),
});

export type Profile = z.infer<typeof ProfileSchema>;
