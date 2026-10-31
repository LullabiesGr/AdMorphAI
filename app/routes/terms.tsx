import LegalPage,{Section} from "../components/legal-page";
export default function Terms(){
 return <LegalPage title="Terms of Service">
  <Section title="1. The service">
   <p>AdMorph AI is a Shopify app operated by AfterWin. It helps merchants connect their own Meta advertising accounts, import ad creative information, match ads to Shopify products and generate personalized storefront experiences and optional abstract AI artwork using AI. It may offer optional automation that publishes variations according to the merchant's selected settings. Questions can be sent to <a href="mailto:hello@afterwin.co">hello@afterwin.co</a>.</p>
  </Section>
  <Section title="2. Authorization and permitted access">
   <p>By connecting a Shopify store or Meta advertising account, you confirm that you are authorized to access and use that account and its content. You must comply with applicable laws and the policies and terms of Shopify, Meta and other connected services. We may restrict functionality if authorization is revoked or a platform denies access.</p>
  </Section>
  <Section title="3. AI content and merchant responsibility">
   <p>AI-generated copy is a suggestion, not a verified representation of product characteristics. You are responsible for ensuring accuracy and compliance with advertising, consumer-protection, intellectual-property and other applicable requirements before publication. Autopilot publishes automatically only if you expressly enable that mode. AI-generated artwork is decorative and is not a verified product photograph; merchants must approve it separately. AdMorph does not intentionally change product prices, availability or checkout behavior. A/B experiments and Web Pixel tracking require merchant activation and follow customer analytics consent. Event-based reports do not guarantee order attribution or revenue outcomes.</p>
  </Section>
  <Section title="4. Availability and third-party services">
   <p>Some capabilities depend on access to Shopify, Meta, OpenAI and hosting providers. We may adjust features to remain compatible with their APIs and policies. We do not guarantee uninterrupted service, approval of third-party permissions, or any particular advertising or conversion result. AdMorph is not endorsed by Meta or Shopify.</p>
  </Section>
  <Section title="5. Acceptable use">
   <p>Do not use AdMorph to publish false or misleading claims, infringe third-party rights, attempt unauthorized access, circumvent platform permissions or process data unlawfully. We may suspend abusive use when necessary to protect the service or others.</p>
  </Section>
  <Section title="6. Fees and changes">
   <p>Any paid plan or usage charges, if introduced, will be disclosed through the applicable Shopify subscription approval flow before a charge is authorized. We may change app capabilities or these terms as necessary, subject to applicable law and notice requirements.</p>
  </Section>
  <Section title="7. Disconnecting and ending use">
   <p>You may disconnect Meta within the app or uninstall AdMorph from Shopify. Data-removal options and contact information appear in our <a href="/data-deletion">Data Deletion Instructions</a> and <a href="/privacy">Privacy Policy</a>.</p>
  </Section>
  <Section title="8. Contact">
   <p>For service or legal enquiries, contact <a href="mailto:hello@afterwin.co">hello@afterwin.co</a>.</p>
  </Section>
 </LegalPage>;
}
