import { prisma } from "../../db/prisma.js";
import type { Account } from "@prisma/client";

const DEFAULT_LABEL = "default";

export async function getOrCreateDefaultAccount(email: string): Promise<Account> {
  const existing = await prisma.account.findUnique({ where: { label: DEFAULT_LABEL } });
  if (existing) return existing;

  return prisma.account.create({
    data: { label: DEFAULT_LABEL, email, status: "inactive" },
  });
}

export async function saveSession(accountId: string, storageState: string): Promise<void> {
  await prisma.account.update({
    where: { id: accountId },
    data: { cookieJson: storageState, status: "active", lastLoginAt: new Date(), lastError: null },
  });
}

export async function markQuarantined(accountId: string, error: string): Promise<void> {
  await prisma.account.update({
    where: { id: accountId },
    data: { status: "quarantined", lastError: error },
  });
}

export async function touchLastUsed(accountId: string): Promise<void> {
  await prisma.account.update({ where: { id: accountId }, data: { lastUsedAt: new Date() } });
}
