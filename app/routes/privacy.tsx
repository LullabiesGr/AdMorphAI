import LegalPage,{Section} from "../components/legal-page";
export default function Privacy(){
 return <LegalPage title="Privacy Policy">
  <Section title="1. Who operates AdMorph AI">
   <p>AdMorph AI is operated by AfterWin (referred to as “AdMorph”, “we”, “our” or “us”). This policy describes the information handled when merchants use the AdMorph Shopify application and connect their Meta advertising accounts. Privacy enquiries and requests can be sent to <a href="mailto:hello@afterwin.co">hello@afterwin.co</a>.</p>
  </Section>
  <Section title="2. Data we receive and process">
   <ul>
    <li><strong>Shopify store and account data:</strong> store domain; product titles, descriptions, identifiers, handles and images; Shopify authorization sessions and, where included with those sessions, merchant administrator identifiers, names, email addresses, role or locale information.</li>
    <li><strong>Meta advertising data:</strong> authorized ad account identifiers and names, ad IDs, status, text, creative metadata, media URLs and destination URLs returned by the Meta Marketing API. We use Meta OAuth tokens to retrieve only data the merchant authorizes.</li>
    <li><strong>Generated content:</strong> AI-suggested headlines, descriptions and benefits, campaign associations, publishing settings and edits the merchant makes.</li>
    <li><strong>Technical data:</strong> operational request details, timestamps, error and security logs processed by our hosting infrastructure. These may include IP addresses and browser technical information.</li>
   </ul>
   <p>The current app does not request Shopify customer records or order data and does not install a separate Meta Pixel. Store visitors may request published content through the Shopify storefront app proxy, which can generate ordinary infrastructure request logs.</p>
  </Section>
  <Section title="3. Why we use the information">
   <p>We process information to authenticate shops, connect the merchant's selected Meta account, synchronize authorized ad creatives, match an advertisement to a Shopify product, generate and store AI content, publish approved product messaging and maintain security and reliability. Depending on the context, processing is necessary to provide our service, for legitimate operational and security interests, or based on the merchant's authorization. Merchants are responsible for customer-facing privacy notices and permissions relevant to their own storefronts.</p>
  </Section>
  <Section title="4. Meta permissions and AI processing">
   <p>AdMorph currently requests <code>ads_read</code> for its Meta integration. It does not post advertisements or modify Meta campaigns under this permission. To produce draft marketing copy, relevant product descriptions and advertising text—and, where available, creative images—may be sent to OpenAI's API for processing. Review the content before publication; AI output can be inaccurate.</p>
  </Section>
  <Section title="5. Providers and international processing">
   <p>AdMorph uses Shopify for app authentication and product data, Meta for authorized advertising data, OpenAI for AI generation, Supabase for PostgreSQL data storage, and Render for application hosting. These providers may process information in jurisdictions outside your country, subject to the applicable providers' terms and privacy safeguards.</p>
   <p>We do not sell merchant, Meta or customer data to advertisers or data brokers.</p>
  </Section>
  <Section title="6. Security and retention">
   <p>Meta OAuth tokens are encrypted before storage, and Shopify-admin requests are authenticated. Server-side application credentials are not intentionally made public. We keep connection, product, campaign and draft data while necessary to operate the app and until the relevant merchant action or deletion request. Operational logs and provider backups may have separate retention periods. No method of storage or transmission is entirely risk-free.</p>
  </Section>
  <Section title="7. Your choices, access and deletion">
   <p>Authorized merchants can disconnect Meta from within the AdMorph dashboard; this removes the stored Meta connection, imported ads and related generated campaigns. Uninstalling the Shopify app triggers removal of the application's shop records through authenticated app-uninstall handling. For access, correction, erasure, or other applicable privacy rights, write to <a href="mailto:hello@afterwin.co">hello@afterwin.co</a>. We may need to verify account ownership before responding. Detailed steps are available on our <a href="/data-deletion">Data Deletion Instructions page</a>.</p>
  </Section>
  <Section title="8. Changes to this policy">
   <p>We may update this policy as the service evolves, including when we introduce new integrations, analytics or billing. The effective date at the top identifies the current version. Significant changes will be communicated where required.</p>
  </Section>
 </LegalPage>;
}
