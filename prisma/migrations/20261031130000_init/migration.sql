-- AdMorph AI initial PostgreSQL schema (Prisma 6)
CREATE TABLE IF NOT EXISTS "Session" (
 "id" TEXT NOT NULL, "shop" TEXT NOT NULL, "state" TEXT NOT NULL,
 "isOnline" BOOLEAN NOT NULL DEFAULT false, "scope" TEXT,
 "expires" TIMESTAMP(3), "accessToken" TEXT NOT NULL, "userId" BIGINT,
 "firstName" TEXT, "lastName" TEXT, "email" TEXT,
 "accountOwner" BOOLEAN NOT NULL DEFAULT false, "locale" TEXT,
 "collaborator" BOOLEAN DEFAULT false, "emailVerified" BOOLEAN DEFAULT false,
 "refreshToken" TEXT, "refreshTokenExpires" TIMESTAMP(3),
 CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Session_shop_idx" ON "Session"("shop");
CREATE TABLE IF NOT EXISTS "Shop" (
 "domain" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "Shop_pkey" PRIMARY KEY ("domain")
);
CREATE TABLE IF NOT EXISTS "MetaOauthState" (
 "nonce" TEXT NOT NULL, "shop" TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "MetaOauthState_pkey" PRIMARY KEY ("nonce")
);
CREATE INDEX IF NOT EXISTS "MetaOauthState_expiresAt_idx" ON "MetaOauthState"("expiresAt");
CREATE TABLE IF NOT EXISTS "MetaConnection" (
 "shop" TEXT NOT NULL, "encryptedToken" TEXT NOT NULL,
 "tokenExpiresAt" TIMESTAMP(3), "selectedAccountId" TEXT, "accounts" JSONB,
 "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "MetaConnection_pkey" PRIMARY KEY ("shop")
);
CREATE TABLE IF NOT EXISTS "MetaAd" (
 "id" TEXT NOT NULL, "shop" TEXT NOT NULL, "adId" TEXT NOT NULL,
 "accountId" TEXT NOT NULL, "name" TEXT NOT NULL, "status" TEXT NOT NULL,
 "creative" JSONB NOT NULL,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "MetaAd_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MetaAd_shop_adId_key" ON "MetaAd"("shop","adId");
CREATE INDEX IF NOT EXISTS "MetaAd_shop_accountId_idx" ON "MetaAd"("shop","accountId");
CREATE TABLE IF NOT EXISTS "Campaign" (
 "id" TEXT NOT NULL, "shop" TEXT NOT NULL,
 "metaAdId" TEXT NOT NULL, "productId" TEXT NOT NULL,
 "productHandle" TEXT NOT NULL, "productTitle" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'DRAFT', "content" JSONB,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Campaign_shop_metaAdId_productId_key" ON "Campaign"("shop","metaAdId","productId");
CREATE INDEX IF NOT EXISTS "Campaign_shop_status_idx" ON "Campaign"("shop","status");
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MetaConnection_shop_fkey') THEN ALTER TABLE "MetaConnection" ADD CONSTRAINT "MetaConnection_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("domain") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MetaAd_shop_fkey') THEN ALTER TABLE "MetaAd" ADD CONSTRAINT "MetaAd_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("domain") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Campaign_shop_fkey') THEN ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("domain") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

-- All app records are accessed only via authenticated Shopify server routes / Prisma.
-- Prevent access through Supabase Data API's anon and authenticated roles.
ALTER TABLE public."Session" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."Session" FROM anon, authenticated;
ALTER TABLE public."Shop" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."Shop" FROM anon, authenticated;
ALTER TABLE public."MetaOauthState" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."MetaOauthState" FROM anon, authenticated;
ALTER TABLE public."MetaConnection" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."MetaConnection" FROM anon, authenticated;
ALTER TABLE public."MetaAd" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."MetaAd" FROM anon, authenticated;
ALTER TABLE public."Campaign" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."Campaign" FROM anon, authenticated;
