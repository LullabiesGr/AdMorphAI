import type {LoaderFunctionArgs} from "react-router";
import {Link,useLoaderData} from "react-router";
import prisma from "../db.server";
import {authenticate} from "../shopify.server";
import {getMerchantOverview} from "../services/overview.server";
import {PageIntro,Stat,State,SetupChecklist,SectionHead,Empty} from "../components/dashboard";

export const loader=async({request}:LoaderFunctionArgs)=>{
 const {session}=await authenticate.admin(request);
 await prisma.shop.upsert({where:{domain:session.shop},create:{domain:session.shop},update:{}});
 return {shop:session.shop,...await getMerchantOverview(session.shop)};
};
export default function Overview(){
 const d=useLoaderData<typeof loader>();
 return <s-page heading="Overview">
  <s-button href="/app/autopilot" slot="primary-action" variant="primary">Run Autopilot</s-button>
  <div className="am-container">
   <PageIntro eyebrow="YOUR CONVERSION WORKSPACE" title="Your ads. A better shopping experience."
      description="Keep your Meta campaigns, AI-generated content, and Shopify product experiences in sync.">
      <State text={d.meta?"Meta connected":"Meta not connected"} kind={d.meta?"success":"warning"}/>
   </PageIntro>
   <div className="am-stats">
     <Stat label="Meta advertising" value={d.meta?"Connected":"Not connected"}
       note={d.meta?.selectedAccountId?"Ad account selected":"Connection setup"} tone={d.meta?"success":"warning"}/>
     <Stat label="Imported ads" value={d.ads} note="From your connected Meta account"/>
     <Stat label="Draft experiences" value={d.drafts} note="Waiting for approval"/>
     <Stat label="Published experiences" value={d.published} note="Personalizations currently published" tone="success"/>
   </div>
   <div className="am-layout">
     <div className="am-main-column">
       <s-section>
         <SectionHead title="Getting started" action={<Link to="/app/getting-started" className="am-text-link">View setup guide</Link>}/>
         <div className="am-progress-heading"><strong>{d.completed} of {d.allSteps} steps completed</strong><span>{Math.round(d.completed/d.allSteps*100)}%</span></div>
         <div className="am-progress-track" role="progressbar" aria-label="Onboarding progress" aria-valuemin={0} aria-valuemax={d.allSteps} aria-valuenow={d.completed}>
           <div style={{width:(d.completed/d.allSteps*100)+"%"}}/>
         </div>
         <SetupChecklist steps={d.steps} compact/>
       </s-section>
       <s-section>
         <SectionHead title="Recent campaigns" action={<Link to="/app/campaigns" className="am-text-link">All campaigns</Link>}/>
         {d.recent.length===0?<Empty title="No campaigns yet" description="Run Autopilot to match ads with Shopify products and create your first draft." href="/app/autopilot" label="Open Autopilot"/>:
           <div className="am-activity-list">{d.recent.map(c=><div key={c.id} className="am-activity-row">
             <div><strong>{c.productTitle}</strong><small>Meta ad {c.metaAdId} · {new Date(c.updatedAt).toLocaleDateString("en-GB")}</small></div>
             <State text={c.status==="PUBLISHED"?"Published":"Draft"} kind={c.status==="PUBLISHED"?"success":"warning"}/>
           </div>)}</div>}
       </s-section>
     </div>
     <aside className="am-side-column">
       <s-section>
         <SectionHead title="Quick actions"/>
         <div className="am-action-links">
           <Link to="/app/autopilot"><span>✦</span><strong>Generate AI content</strong><small>Match and draft Meta ads</small></Link>
           <Link to="/app/theme"><span>▤</span><strong>Activate storefront</strong><small>Open your Theme Editor</small></Link>
           <Link to="/app/campaigns"><span>✓</span><strong>Review drafts</strong><small>Check and publish copy</small></Link>
         </div>
       </s-section>
       <s-section>
         <SectionHead title="Workspace status"/>
         <div className="am-detail-row"><span>Ad account</span><State text={d.meta?.selectedAccountId?"Selected":"Pending"} kind={d.meta?.selectedAccountId?"success":"warning"}/></div>
         <div className="am-detail-row"><span>Theme block</span><State text={d.settings?.themeConfirmedAt?"Merchant confirmed":"Not confirmed"} kind={d.settings?.themeConfirmedAt?"success":"warning"}/></div>
         <div className="am-detail-row"><span>Publishing mode</span><State text={d.settings?.autoPublish?"Automatic":"Review first"} kind={d.settings?.autoPublish?"info":"neutral"}/></div>
         <div className="am-detail-row"><span>Last sync</span><strong>{d.settings?.lastSyncAt?new Date(d.settings.lastSyncAt).toLocaleDateString("en-GB"):"Not yet"}</strong></div>
       </s-section>
       <s-banner tone="info">
         Ad click matching requires <code>admorph_ad=&#123;&#123;ad.id&#125;&#125;</code> in your Meta URL parameters. <Link to="/app/help">Learn how it works</Link>.
       </s-banner>
     </aside>
   </div>
  </div>
 </s-page>;
}
