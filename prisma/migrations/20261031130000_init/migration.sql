-- AdMorph AI initial PostgreSQL schema (Prisma 6)
CREATE TABLE "Session" (
 "id" TEXT NOT NULL, "shop" TEXT NOT NULL, "state" TEXT NOT NULL,
 "isOnline" BOOLEAN NOT NULL DEFAULT false, "scope" TEXT,
 "expires" TIMESTAMP(3), "accessToken" TEXT NOT NULL, "userId" BIGINT,
 "firstName" TEXT, "lastName" TEXT, "email" TEXT,
 "accountOwner" BOOLEAN NOT NULL DEFAULT false, "locale" TEXT,
 "collaborator" BOOLEAN DEFAULT false, "emailVerified" BOOLEAN DEFAULT false,
 "refreshToken" TEXT, "refreshTokenExpires" TIMESTAMP(3),
 CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Session_shop_idx" ON "Session"("shop");
CREATE TABLE "Shop" (
 "domain" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "Shop_pkey" PRIMARY KEY ("domain")
);
CREATE TABLE "MetaOauthState" (
 "nonce" TEXT NOT NULL, "shop" TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "MetaOauthState_pkey" PRIMARY KEY ("nonce")
);
CREATE INDEX "MetaOauthState_expiresAt_idx" ON "MetaOauthState"("expiresAt");
CREATE TABLE "MetaConnection" (
 "shop" TEXT NOT NULL, "encryptedToken" TEXT NOT NULL,
 "tokenExpiresAt" TIMESTAMP(3), "selectedAccountId" TEXT, "accounts" JSONB,
 "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "MetaConnection_pkey" PRIMARY KEY ("shop")
);
CREATE TABLE "MetaAd" (
 "id" TEXT NOT NULL, "shop" TEXT NOT NULL, "adId" TEXT NOT NULL,
 "accountId" TEXT NOT NULL, "name" TEXT NOT NULL, "status" TEXT NOT NULL,
 "creative" JSONB NOT NULL,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "MetaAd_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MetaAd_shop_adId_key" ON "MetaAd"("shop","adId");
CREATE INDEX "MetaAd_shop_accountId_idx" ON "MetaAd"("shop","accountId");
CREATE TABLE "Campaign" (
 "id" TEXT NOT NULL, "shop" TEXT NOT NULL,
 "metaAdId" TEXT NOT NULL, "productId" TEXT NOT NULL,
 "productHandle" TEXT NOT NULL, "productTitle" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'DRAFT', "content" JSONB,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Campaign_shop_metaAdId_productId_key" ON "Campaign"("shop","metaAdId","productId");
CREATE INDEX "Campaign_shop_status_idx" ON "Campaign"("shop","status");
ALTER TABLE "MetaConnection" ADD CONSTRAINT "MetaConnection_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("domain") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetaAd" ADD CONSTRAINT "MetaAd_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("domain") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("domain") ON DELETE CASCADE ON UPDATE CASCADE;
