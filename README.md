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

## AI Autopilot MVP
- Connect one Meta ad account: the app selects it automatically; a multi-account merchant chooses one before Autopilot starts.
- One-click batch processing imports the first 50 ads, verifies active product URLs against merchant-owned Shopify domains, generates factual AI draft copy and updates the dashboard.
- The merchant can opt in to auto-publish future AI content. Default is drafts pending review. Existing drafts can be published through the dashboard.
- Deep link to Shopify Theme Editor preselects the AdMorph product block; the merchant still must click Save once.
- Meta ad-click identification still requires `admorph_ad={{ad.id}}` tracking in ads' destination URLs. `ads_read` cannot edit ad URLs, so automatic tracking configuration requires separate `ads_management` authorization and implementation.
- The run auto-continues through small batches while the dashboard tab is open. Continuous scheduled background synchronization is not yet enabled.
- `shopify.app.toml` has the production Render URL; it still needs the real `client_id` from `shopify app config link` before the next Shopify CLI app/extension deployment.

## Next
- Build authenticated Shopify Web Pixel Extension and consent-aware conversion analytics.
- Add billing, advanced experimentation and robust Meta pagination/synchronization.
- Meta `ads_management` permission only if merchant explicitly requests in-app editing of ad URLs.
- Add integration tests, CI, and monitoring before App Store submission.

### Proxy registration reset for persistent Shopify 404

Shopify documented a previous Dev Dashboard migration issue in which a correctly configured app proxy still returned Shopify HTTP 404. Its workaround was to release one app version without `[app_proxy]` and then a second version with `[app_proxy]` restored. See: https://community.shopify.dev/t/after-new-dev-platform-update-3-84-proxy-doesnt-work-anymore/22752/2

**Only try this after confirming that the active Shopify app version already includes the correct proxy and the installed store has no customized app proxy path.**

A guarded PowerShell script is provided at `scripts/repair-shopify-app-proxy.ps1`. Before running, execute `shopify app config link` and select the EXISTING AdMorph AI app. The script refuses an empty `client_id` and prompts before doing anything. It runs `shopify app deploy` twice with the proxy temporarily removed and restored; it always restores the local original file. If the second deployment fails, the storefront proxy can remain unregistered until `shopify app deploy` succeeds with the restored config. Do not uninstall the app, because this app processes uninstall webhooks.

## Troubleshooting Shopify App Proxy HTTP 404 (storefront)
A Shopify-branded 404 at `https://YOUR-STORE/apps/admorph` means the storefront route is not currently registered as this app's proxy; a working request should be forwarded to `https://admorphai.onrender.com/apps/admorph` with Shopify's signed query parameters. The proxy backend exists in `app/routes/apps.admorph.tsx`; the frontend expects JSON on `/apps/admorph?ad_id=...&product_handle=...`.

1. In the Shopify Dev Dashboard select the *existing* AdMorph AI app and inspect the **active version**. Verify it includes an **App proxy** with destination `https://admorphai.onrender.com/apps/admorph`, prefix `apps`, and subpath `admorph`, plus `read_products,write_app_proxy` access scopes.
2. From a current checkout of the repo, run `shopify app config link` and explicitly select the **existing installed app**. This populates the `client_id` missing in the checked-in starter TOML; never link a newly created app by mistake.
3. Run `shopify app deploy` to publish the app configuration and Theme App Extension to Shopify (separate from Render). Approve new access scopes if Shopify asks.
4. In the merchant's Shopify Admin, check **Settings → Apps and sales channels → AdMorph AI → App proxy → Customize URL**, because any previously customized prefix/subpath is not overwritten by new Shopify versions. Confirm the effective storefront path is `/apps/admorph`. Do not uninstall or reinstall the app casually; the uninstall webhook deletes its shop data.
5. Open `https://YOUR-STORE/apps/admorph?ad_id=KNOWN_PUBLISHED_AD&product_handle=KNOWN_PRODUCT` in a browser. The expected response is JSON `{"content":{"headline":"...",...}}`. An HTTP 404 points to Shopify proxy registration/path, while a successful HTTP response containing `{"content":null}` indicates a backend session/lookup/validation issue.
6. After the proxy responds with AI copy, activate the AdMorph product Theme App Block in the published product template and use `?admorph_ad=KNOWN_PUBLISHED_AD` on the product URL. **Do not attempt to bypass Shopify proxy signatures or expose an unauthenticated cross-store API.**

Shopify reference: https://shopify.dev/docs/apps/build/online-store/app-proxies

### Prevent App Proxy regression on Shopify extension deploy

Shopify CLI may have more than one `shopify.app.*.toml` file. `shopify app config link` can generate a second, named configuration pulled from the Dev Dashboard, and it becomes the default; that config can omit a proxy even while `shopify.app.toml` contains one. A future `shopify app deploy` then releases the wrong configuration and the storefront returns HTTP 404 despite a working Render backend.

- Use `powershell -ExecutionPolicy Bypass -File .\\scripts\\check-shopify-config.ps1` BEFORE each `shopify app deploy`. It checks all Shopify config files, never prints the Client ID or a secret, and reports missing proxy configuration, `write_app_proxy`, and URL substitution protection.
- The actual config used for the deploy MUST contain `[app_proxy]` with `url = "https://admorphai.onrender.com/apps/admorph"`, `prefix = "apps"` and `subpath = "admorph"`. It must also contain `[build] automatically_update_urls_on_dev = false`, plus the correct nonempty `client_id` linked to the existing AdMorph AI app.
- Run `shopify app deploy --config <actual-filename>` using the exact verified config, not an ambiguous default. Review the CLI deployment summary and make sure it includes the app proxy and the correct Shopify Client ID.
- If `shopify app config link` creates a second config file, add `[app_proxy]` and `[build]` to THAT file before deploying; do not assume changing the checked-in starter `shopify.app.toml` affects the active config.
- Do not run `shopify app dev` with automatic URL updates enabled on production AdMorph AI. Shopify confirmed this can rewrite the proxy target to a temporary tunnel even when the TOML appears unchanged.

Official Shopify docs: https://shopify.dev/docs/apps/build/cli-for-apps/manage-app-config-files and https://shopify.dev/docs/apps/build/online-store/app-proxies .
