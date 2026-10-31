# AdMorph AI
Professional Shopify embedded app to personalize product pages based on Meta Ads creative. Stack: Shopify React Router, Prisma/Postgres (Supabase), Meta Marketing API, OpenAI Responses API, Theme App Extension.

## Status
Core foundation and end-to-end draft/approve/publish workflow implemented. Not production launched or connected until credentials and Shopify/Meta approval are completed. Campaign attribution currently uses a configured `admorph_ad` URL parameter. No automatic Meta ad URL editing or pixel-based conversion attribution is claimed.

## Setup
1. Create Shopify app in the Dev Dashboard, and run `npm run config:link` to populate `shopify.app.toml`. Shopify CLI controls extension registration and app configuration.
2. Create Supabase PostgreSQL project. Copy `.env.example` to `.env` and use pooler URL for DATABASE_URL and direct connection for DIRECT_URL.
3. Run `npm install`, `npm run setup` (committed PostgreSQL migration included), then `npm run dev`. Run `npm run setup` on every fresh production deployment before server startup.
4. In Meta Developers create a Business app/use case **Measure ad performance data with Marketing API**, request `ads_read`, configure Facebook Login for Business (if shown) and valid redirect `https://HOST/auth/meta/callback`. Configure META_APP_ID, META_APP_SECRET and TOKEN_ENCRYPTION_KEY. For third-party ad accounts apply for Advanced Access and complete applicable verification/App Review.
5. Configure OPENAI_API_KEY on the host; model defaults to `gpt-4.1-mini`.
6. Run `npm run deploy` for Shopify extension/config after production URL is configured. Deploy the Node web server separately on a provider that supports persistent server-side Node/React Router SSR and environment secrets. Bolt-hosted static Vite alone is insufficient; confirm your Bolt deployment supports React Router SSR and Shopify OAuth callbacks before choosing it.

## How it works
- Merchant authenticates via official Shopify app library.
- Merchant connects Meta, authorizes `ads_read`, selects an ad account, imports up to 50 ads, maps an ad to a Shopify product.
- OpenAI produces factual storefront copy and saves it as a DRAFT. Merchant reviews, optionally edits and publishes.
- Merchant adds the **AdMorph personalization** app block to the product template. Meta ad destination should include `admorph_ad={{ad.id}}` (or an equivalent manually supplied ID).
- Shopify-signed app proxy returns published content. No unsupported campaign shows alternate claims. Theme keeps price, checkout, inventory and product SEO unchanged.

## Security
Meta token is encrypted at rest with AES-256-GCM and is never returned to the browser. Shopify Admin and app proxy requests are authenticated by Shopify. Meta OAuth state is a one-time database nonce. Production requires HTTPS, merchant disclosure of personalized content, private environment configuration, webhooks and deletion compliance. No second Meta pixel is installed.

## Deployment note
Bolt.new can develop this repository, but first confirm its chosen production hosting executes Node React Router SSR (`npm run start`), persists environment secrets and can receive Shopify OAuth/webhooks. Static SPA hosting cannot run Shopify Admin authentication, Meta OAuth callback or Prisma. If Bolt deployment is static-only, host the Node server on a supported service and use Bolt for editing.

## Next
- Build authenticated Shopify Web Pixel Extension and consent-aware conversion analytics.
- Add billing, advanced experimentation and robust Meta pagination/synchronization.
- Meta `ads_management` permission only if merchant explicitly requests in-app editing of ad URLs.
- Add integration tests, CI, and monitoring before App Store submission.
