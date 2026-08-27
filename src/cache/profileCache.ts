import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import type { Profile } from "../normalize/types.js";
import { ProfileSchema } from "../normalize/types.js";

export async function getCachedProfile(publicIdentifier: string): Promise<Profile | null> {
  const row = await prisma.cachedProfile.findUnique({ where: { publicIdentifier } });
  if (!row || row.expiresAt < new Date()) return null;
  return ProfileSchema.parse(row.data);
}

export async function saveCachedProfile(profile: Profile): Promise<void> {
  const expiresAt = new Date(Date.now() + env.CACHE_TTL_HOURS * 60 * 60 * 1000);
  await prisma.cachedProfile.upsert({
    where: { publicIdentifier: profile.publicIdentifier },
    create: {
      publicIdentifier: profile.publicIdentifier,
      data: profile,
      dataCompleteness: profile.dataCompleteness,
      scrapedAt: new Date(profile.scrapedAt),
      expiresAt,
    },
    update: {
      data: profile,
      dataCompleteness: profile.dataCompleteness,
      scrapedAt: new Date(profile.scrapedAt),
      expiresAt,
    },
  });
}
