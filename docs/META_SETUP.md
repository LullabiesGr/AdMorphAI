# Meta Developers setup for AdMorph
1. Visit https://developers.facebook.com/apps/ and select **Create App**.
2. Select the Marketing API use case, often shown as **Measure ad performance data with Marketing API**. UI labeling may change. Use the Business type if asked.
3. Name **AdMorph AI**, add your contact email, attach the correct business portfolio.
4. Add/enable Marketing API and Facebook Login for Business/standard Facebook Login as shown by the Meta dashboard. Set **Valid OAuth Redirect URIs** to **https://YOUR_REAL_HOST/auth/meta/callback**. The redirect URL must match exactly the META OAuth integration.
5. In App Settings > Basic, find **App ID** and **App Secret**. Store privately in environment variables META_APP_ID and META_APP_SECRET. Never commit them or paste App Secret in chat.
6. Request **ads_read** with access for other businesses if the app will be offered publicly. Under App Review > Permissions and Features, submit for Advanced Access where required. Meta Business Verification and App Review are separate requirements; follow the statuses in Meta Dashboard.
7. For App Review, explain: merchant signs in, connects their own ad account, reads owned ads and creatives to personalize copy on their Shopify product pages. Provide video showing connect, account selection, ad import and AI review.
8. Add publicly accessible Privacy Policy URL, Terms and Data Deletion Instructions URL (AfterWin app-specific pages are suitable when created).
9. During development, add yourself as a tester/admin of the Meta App and use an ad account you administer. Unapproved permissions usually cannot be used on arbitrary merchant accounts.
10. Configure Meta ads with URL parameter `admorph_ad={{ad.id}}`. Read-only ads_read does **not** allow AdMorph to edit URL tracking. This setup is manual until ads_management is separately approved and implemented.
11. For live launch, switch Meta App to Live when permissions, verification, policies and tested flows are ready.

**Do not create or rotate any token in public code.** Meta user access tokens are stored encrypted with TOKEN_ENCRYPTION_KEY. Losing this key requires merchants to reconnect.
