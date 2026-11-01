import type {LoaderFunctionArgs} from "react-router";
import {Link,useLoaderData} from "react-router";
import {authenticate} from "../shopify.server";
import {getMerchantOverview} from "../services/overview.server";
import {PageIntro,SetupChecklist,State,SectionHead} from "../components/dashboard";
export const loader=async({request}:LoaderFunctionArgs)=>{
 const {session}=await authenticate.admin(request);
 return await getMerchantOverview(session.shop);
};
export default function GettingStarted(){
 const d=useLoaderData<typeof loader>();
 const next=d.steps.find(s=>!s.done);
 return <s-page heading="Getting started">
  <div className="am-container">
   <PageIntro eyebrow="SETUP GUIDE" title="Launch your first personalized product page"
      description="Five focused steps. Your storefront stays unchanged until content is published and the theme block is saved.">
      <State text={d.completed===d.allSteps?"Setup complete":d.completed+" / "+d.allSteps+" completed"} kind={d.completed===d.allSteps?"success":"info"}/>
   </PageIntro>
   <div className="am-layout">
    <div className="am-main-column">
      <s-section>
        <div className="am-progress-heading"><strong>Setup progress</strong><span>{Math.round(d.completed/d.allSteps*100)}%</span></div>
        <div className="am-progress-track" role="progressbar" aria-label="Setup progress" aria-valuenow={d.completed} aria-valuemin={0} aria-valuemax={d.allSteps}>
          <div style={{width:(d.completed/d.allSteps*100)+"%"}}/>
        </div>
        <SetupChecklist steps={d.steps}/>
      </s-section>
      <s-section>
        <SectionHead title="How AdMorph works"/>
        <div className="am-explain-steps">
          <div><b>01</b><strong>Import your ads</strong><p>AdMorph reads permitted Meta creatives and identifies ads that link directly to your products.</p></div>
          <div><b>02</b><strong>Build an ad-matched product showcase</strong><p>AI creates campaign-specific messaging and visual direction using real Shopify product photos. The immersive hero can appear above the normal product section.</p></div>
          <div><b>03</b><strong>Review and activate Immersive Hero</strong><p>Approve your AI page, enable the immersive setting in the Theme Editor and Save. Native price, variants, cart and checkout remain intact.</p></div>
        </div>
      </s-section>
    </div>
    <aside className="am-side-column">
      <s-section>
        <SectionHead title="Your next step"/>
        {next?<div className="am-next-step"><State text="Action needed" kind="warning"/><h3>{next.name}</h3><p>{next.description}</p><Link className="ad-btn" to={next.href}>Continue setup</Link></div>:
         <div className="am-next-step"><State text="Ready" kind="success"/><h3>Setup steps complete</h3><p>Keep the content accurate and check storefront results regularly.</p><Link className="ad-btn" to="/app/autopilot">Open Autopilot</Link></div>}
      </s-section>
      <s-banner tone="info">The theme step is confirmed manually by the merchant. AdMorph does not yet read theme activation through Shopify.</s-banner>
    </aside>
   </div>
  </div>
 </s-page>;
}
