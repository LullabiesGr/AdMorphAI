import LegalPage,{Section} from "../components/legal-page";
export default function DataDeletion(){
 return <LegalPage title="Data Deletion Instructions">
  <p>AdMorph AI provides a way for merchants and Meta users to request deletion of their associated app data. You do not need to share your password, access token or API secret.</p>
  <Section title="Option A — Disconnect Meta from AdMorph">
   <ol>
    <li>Sign in to the Shopify Admin for the store where AdMorph AI is installed.</li>
    <li>Open <strong>Apps → AdMorph AI → Meta Ads</strong>.</li>
    <li>Choose <strong>Disconnect Meta and delete imported data</strong>.</li>
    <li>After the request is processed, AdMorph deletes the stored Meta connection, imported ads and related AI campaigns associated with that Shopify store. The Shopify app itself remains installed.</li>
   </ol>
  </Section>
  <Section title="Option B — Remove AdMorph entirely">
   <ol>
    <li>In Shopify Admin, open <strong>Settings → Apps and sales channels</strong>.</li>
    <li>Select <strong>AdMorph AI</strong> and uninstall it.</li>
    <li>The app's authenticated Shopify uninstall handling removes the associated shop data, authorization sessions, settings, Meta connection and generated campaign records from its application database.</li>
   </ol>
  </Section>
  <Section title="Option C — Request deletion by email">
   <p>Send an email to <a href="mailto:hello@afterwin.co">hello@afterwin.co</a> with the subject <strong>AdMorph AI — Data Deletion Request</strong>. Include the Shopify store domain or the Meta advertising account associated with your request and explain the records you want deleted. We may ask for proof of authorization before performing deletion.</p>
   <p>Requests from individuals who connected through Facebook Login can also be sent to the same email without logging into Shopify. We will evaluate the request and explain what information we can identify and delete.</p>
  </Section>
  <Section title="What happens next">
   <p>We will review and act on verified requests in accordance with applicable law and platform requirements. Application records can be removed directly; limited security logs or backup copies may follow separate provider retention periods. We will explain any applicable exceptions or limitations when responding.</p>
  </Section>
  <Section title="Additional information">
   <p>See the <a href="/privacy">AdMorph AI Privacy Policy</a> for categories of data processed and our service providers. Data deletion requests do not require disclosure of passwords or private access tokens.</p>
  </Section>
 </LegalPage>;
}
