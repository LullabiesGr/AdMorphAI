import {Link} from "react-router";
import {PageIntro,SectionHead} from "../components/dashboard";
export default function Help(){
 return <s-page heading="Help">
  <div className="am-container">
    <PageIntro eyebrow="SUPPORT CENTER" title="Everything you need to get started"
      description="Short answers about matching, publishing, and getting the most from AdMorph."/>
    <div className="am-layout">
      <div className="am-main-column">
       <s-section><SectionHead title="Common questions"/>
         <div className="am-faq">
           <details><summary>How does AdMorph find the correct product?</summary><p>The app compares the destination URL of an active Meta ad with verified domains belonging to your Shopify store. Ads pointing to a collection, external website, or multiple products require manual mapping.</p></details>
           <details><summary>Does AI content go live immediately?</summary><p>No. Review-first mode saves drafts. You can enable automatic publication explicitly in Settings after acknowledging your responsibility to review marketing claims.</p></details>
           <details><summary>Why are some ads skipped?</summary><p>Inactive ads, unsupported creative destinations, collections, multi-product carousels and products not found in Shopify cannot be automatically matched. You can create a manual campaign from AI Campaigns.</p></details>
           <details><summary>How does the visitor see the immersive AI product page?</summary><p>Enable Immersive Hero in AdMorph Auto Placement or the manual Shopify Theme Editor block, Save the theme and include <code>admorph_ad=&#123;&#123;ad.id&#125;&#125;</code> in your Meta ad's URL parameters. Published ad-matched visuals and messaging appear above the existing Shopify product section when visitors arrive from a known ad ID. Normal visits retain the original product page. Prices, variants and checkout are unchanged.</p></details>
           <details><summary>Why can't AdMorph add URL parameters automatically?</summary><p>Our current Meta permission is ads_read. Changing an existing ad's URL parameters requires ads_management approval and additional app functionality.</p></details>
           <details><summary>Is the Shopify theme changed by Autopilot?</summary><p>No. Shopify requires you to add and save the app block once. AdMorph does not modify prices, inventory, checkout or the original product title.</p></details>
           <details><summary>How do I disconnect Meta or delete data?</summary><p>Open Meta Ads and use Disconnect Meta and delete imported data. Additional privacy rights are described on our <a href="/data-deletion" target="_blank" rel="noopener noreferrer">data deletion page</a>.</p></details>
         </div>
       </s-section>
      </div>
      <aside className="am-side-column">
       <s-section><SectionHead title="Need assistance?"/>
        <p className="ad-muted">Contact AfterWin about authorization, app setup and Shopify integration.</p>
        <a href="mailto:hello@afterwin.co?subject=AdMorph%20AI%20Support" className="ad-btn am-standalone-action">Email support</a>
        <div className="am-divider"/>
        <p><Link className="am-text-link" to="/app/getting-started">Open setup guide</Link></p>
        <p><Link className="am-text-link" to="/app/theme">Theme activation instructions</Link></p>
       </s-section>
      </aside>
    </div>
  </div>
 </s-page>;
}
