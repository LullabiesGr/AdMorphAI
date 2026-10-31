
CREATE TABLE "CampaignImage" (
 "campaignId" TEXT NOT NULL PRIMARY KEY,
 "shop" TEXT NOT NULL,
 "draftData" BYTEA,
 "publishedData" BYTEA,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "CampaignImage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "CampaignExperiment" (
 "campaignId" TEXT NOT NULL PRIMARY KEY,
 "shop" TEXT NOT NULL,
 "enabled" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "CampaignExperiment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "CampaignEvent" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "shop" TEXT NOT NULL,
 "campaignId" TEXT NOT NULL,
 "eventKey" TEXT NOT NULL,
 "arm" TEXT NOT NULL,
 "kind" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "CampaignEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CampaignEvent_eventKey_key" ON "CampaignEvent"("eventKey");
CREATE INDEX "CampaignEvent_campaignId_kind_arm_idx" ON "CampaignEvent"("campaignId","kind","arm");
CREATE INDEX "CampaignEvent_shop_createdAt_idx" ON "CampaignEvent"("shop","createdAt");
