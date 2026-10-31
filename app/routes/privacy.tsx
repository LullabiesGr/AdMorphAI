export default function Privacy(){
 return <main style={{maxWidth:770,margin:"48px auto",padding:"0 24px",fontFamily:"Inter,system-ui",lineHeight:1.8}}>
 <h1>AdMorph AI — Privacy Policy</h1>
 <p>Last updated: 31 October 2026. Operated by AfterWin. Contact: <a href="mailto:hello@afterwin.co">hello@afterwin.co</a>.</p>
 <h2>Information processed</h2>
 <p>To operate the Shopify app, AdMorph processes the connected Shopify store domain, product catalog information, Meta ad account IDs, advertising creatives and the AI copy that merchants approve. Authorized Meta access tokens are encrypted at rest. The initial version does not request Shopify customer or order data.</p>
 <h2>How data is used</h2>
 <p>Information is used to connect merchant-authorized Meta advertising accounts, match advertisements to products, generate suggested storefront copy, and serve merchant-published content. Data is not sold to advertisers.</p>
 <h2>Third-party services</h2>
 <p>Shopify provides shop authentication and product data; Meta provides merchant-approved ad data; OpenAI processes product and ad creative information to generate suggested copy; hosted PostgreSQL stores app records. No Meta ad account password is collected.</p>
 <h2>Retention and deletion</h2>
 <p>Merchants can disconnect Meta from the AdMorph dashboard, which deletes the Meta connection and imported data, or uninstall the Shopify app. Shopify privacy redaction webhooks are supported. For deletion requests contact hello@afterwin.co.</p>
 <h2>Security</h2><p>Meta OAuth uses a single-use state. Access tokens are encrypted and stored server-side. Never send secrets through public support channels.</p>
 <p>This page describes the current MVP implementation and must be reviewed for legal, hosting and jurisdictional accuracy before public distribution.</p>
 </main>
}