-- Stores merchant self-attestation only; not Shopify theme API verification.
ALTER TABLE "AutomationSetting"
  ADD COLUMN "themeConfirmedAt" TIMESTAMP(3);
