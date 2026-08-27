-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "proxyUrl" TEXT,
    "cookieJson" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CachedProfile" (
    "id" TEXT NOT NULL,
    "publicIdentifier" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "dataCompleteness" TEXT NOT NULL,
    "scrapedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CachedProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "event" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_label_key" ON "Account"("label");

-- CreateIndex
CREATE UNIQUE INDEX "CachedProfile_publicIdentifier_key" ON "CachedProfile"("publicIdentifier");
