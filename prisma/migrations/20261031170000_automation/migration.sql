CREATE TABLE "AutomationSetting" (
  "shop" TEXT NOT NULL,
  "autoPublish" BOOLEAN NOT NULL DEFAULT false,
  "lastSyncAt" TIMESTAMP(3),
  "lastResult" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationSetting_pkey" PRIMARY KEY ("shop")
);
ALTER TABLE "AutomationSetting" ADD CONSTRAINT "AutomationSetting_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("domain") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE public."AutomationSetting" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."AutomationSetting" FROM anon, authenticated;
