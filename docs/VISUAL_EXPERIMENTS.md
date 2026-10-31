# AdMorph AI Visual Studio & A/B Experiment Release

## AI image backgrounds
- Generate AI Background creates a private draft WebP using OpenAI Image API. It is abstract decor only; no synthetic merchandise or people. Original Shopify product images stay separate.
- Click Refresh Image Preview, then Approve AI Image; until approval the storefront image is unchanged.
- Remove Live AI Image returns to the original no-background appearance.
- Images are stored in Postgres: at most one draft and one live per campaign, maximum 1.75 MB each.
- Each manual image generation call incurs OpenAI API usage. Model defaults to gpt-image-2.5-flare.

## A/B conversion events
- A is the unmodified product page, B is the AdMorph AI page. Assignment uses session storage only when Shopify analytics consent is granted.
- The Shopify Web Pixel listens for custom admorph:experiment_exposure and admorph:experiment_cta events, plus Shopify product_added_to_cart and checkout_completed standard events.
- Tracking is Shopify consent-aware. No consent means the AI experience is shown and analytics are not recorded.
- AdMorph stores campaign ID, arm, event type and a unique event key, without personal data, products or order identifiers.
- Event attribution lasts 24 hours and is best-effort across checkout sessions. Dashboard counts events, not audited order revenue or user-level purchase conversion.

## Shopify extension setup
- Preserve the existing linked Shopify app Client ID. Pull main and run: powershell -ExecutionPolicy Bypass -File .\scripts\enable-experiments.ps1
- The script changes only local shopify.app.toml, adding read_customer_events and write_pixels, after writing a backup.
- Run preflight then shopify app config validate and shopify app deploy. Approve updated merchant scopes if requested.
- In AI Campaigns click Connect Shopify Web Pixel. Confirm Shopify Settings > Customer events shows AdMorph connected.
- A/B requires a released extension and connected Web Pixel. Do not uninstall the app.

## Privacy / safety
- Public pixel POST events require short-lived signed tokens issued for published campaigns by authenticated Shopify App Proxy.
- Draft artwork is visible only through authenticated Shopify Admin endpoints. Only published artwork can be fetched via App Proxy.
- Per-campaign experiment is disabled by default. All existing campaigns remain unaffected until merchant enables it.
- Verify actual storefront manually after Shopify extension deployment.
