import type { LoaderFunctionArgs } from "react-router";
import { Link,useLoaderData } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
export const loader=async({request}:LoaderFunctionArgs)=>{
 const {session}=await authenticate.admin(request);
 await prisma.shop.upsert({where:{domain:session.shop},create:{domain:session.shop},update:{}});
 const [meta,ads,total,published,settings]=await Promise.all([
  prisma.metaConnection.findUnique({where:{shop:session.shop},select:{connectedAt:true,selectedAccountId:true}}),
  prisma.metaAd.count({where:{shop:session.shop}}),
  prisma.campaign.count({where:{shop:session.shop}}),
  prisma.campaign.count({where:{shop:session.shop,status:"PUBLISHED"}}),
  prisma.automationSetting.findUnique({where:{shop:session.shop},select:{autoPublish:true,lastSyncAt:true}})
 ]);
 return {shop:session.shop,meta:Boolean(meta),selected:Boolean(meta?.selectedAccountId),ads,total,published,settings};
};
export default function Dashboard(){
 const d=useLoaderData<typeof loader>();
 return <s-page heading="AdMorph AI">
  <div className="ad-hero">
   <div className="ad-chip">ADAPT EVERY AD. CONVERT EVERY VISIT.</div>
   <h1>Turn Meta traffic into the right product experience.</h1>
   <p>AdMorph reads your Meta creatives, identifies the Shopify product and generates relevant product-page messaging. No copy-pasting ads or manual product setup.</p>
   <div className="auto-cta">
     <Link to={d.meta?"/app/autopilot":"/app/meta"} className="ad-btn" style={{background:"#fff",color:"#17263f",textDecoration:"none",display:"inline-block"}}>{d.meta?"Run AI Autopilot":"Connect Meta Ads"}</Link>
     <span>{d.meta?"Connected to Meta":"Connect once to get started"}</span>
   </div>
  </div>
  <div className="ad-grid">
    <div className="ad-card"><div className="ad-muted">Connection</div><div className="ad-stat" style={{fontSize:21}}>{d.meta?"Meta connected":"Action needed"}</div><div className="ad-muted">{d.selected?"Ready for automatic processing":"Choose an ad account to continue"}</div></div>
    <div className="ad-card"><div className="ad-muted">Imported advertisements</div><div className="ad-stat">{d.ads}</div><div className="ad-muted">Linked to your Meta ad account</div></div>
    <div className="ad-card"><div className="ad-muted">Published experiences</div><div className="ad-stat">{d.published}<span style={{fontSize:16,color:"#8993a3"}}> / {d.total}</span></div><div className="ad-muted">{d.settings?.autoPublish?"Auto-publish is on":"Merchant approval enabled"}</div></div>
  </div>
  <s-section heading="One setup. Automated product copy.">
   <div className="auto-steps">
    <div className="auto-step"><strong>01 · Connect Meta</strong><span>Authorize read-only ad access</span></div>
    <div className="auto-step"><strong>02 · AI Autopilot</strong><span>Match, generate, prepare</span></div>
    <div className="auto-step"><strong>03 · Activate theme</strong><span>Save the product-page block</span></div>
    <div className="auto-step"><strong>04 · Track results</strong><span>Ad-specific landing message</span></div>
   </div>
   <p className="ad-muted">AdMorph matches only active Meta ads with verifiable links to active products. Ambiguous links are left for review. Shopify requires the merchant to save the storefront block once.</p>
   <p><Link to="/app/autopilot">Open Autopilot Studio</Link> · <Link to="/app/campaigns">Review AI Campaigns</Link></p>
  </s-section>
  <s-section heading="Important: ad tracking">
   <s-paragraph>For exact visitor matching, Meta destination URLs must include <code>admorph_ad=&#123;&#123;ad.id&#125;&#125;</code>. The current Meta ads_read permission cannot edit ad URLs. This last setup step remains manual until ads_management is authorized.</s-paragraph>
  </s-section>
 </s-page>;
}