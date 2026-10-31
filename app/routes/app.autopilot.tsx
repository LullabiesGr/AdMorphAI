import { useEffect, useRef, useState } from "react";
import type {ActionFunctionArgs,LoaderFunctionArgs} from "react-router";
import {Form,useActionData,useFetcher,useLoaderData,useLocation} from "react-router";
import prisma from "../db.server";
import {authenticate} from "../shopify.server";
import {startAutomation,runAutomationBatch,publishAllDrafts, type BatchStats} from "../services/automation.server";
import {PageIntro,Stat,State,SectionHead} from "../components/dashboard";

export const loader=async({request}:LoaderFunctionArgs)=>{
 const {session}=await authenticate.admin(request);
 const shop=session.shop;
 const [meta,settings,ads,drafts,published]=await Promise.all([
  prisma.metaConnection.findUnique({where:{shop},select:{selectedAccountId:true,accounts:true,connectedAt:true}}),
  prisma.automationSetting.findUnique({where:{shop}}),
  prisma.metaAd.count({where:{shop}}),
  prisma.campaign.count({where:{shop,status:"DRAFT"}}),
  prisma.campaign.count({where:{shop,status:"PUBLISHED"}})
 ]);
 const shopifyKey=process.env.SHOPIFY_API_KEY || "";
 const themeUrl="https://"+shop+"/admin/themes/current/editor?template=product&addAppBlockId="+encodeURIComponent(shopifyKey+"/admorph-product")+"&target=mainSection";
 return {shop,meta,settings,ads,drafts,published,themeUrl};
};
export const action=async({request}:ActionFunctionArgs)=>{
 const {session,admin}=await authenticate.admin(request);
 const data=await request.formData(),intent=String(data.get("intent")||"");
 const shop=session.shop;
 try {
  if(intent==="setting"){
    const enabled=data.get("autoPublish")==="on";
    await prisma.shop.upsert({where:{domain:shop},create:{domain:shop},update:{}});
    await prisma.automationSetting.upsert({
      where:{shop},create:{shop,autoPublish:enabled},update:{autoPublish:enabled}
    });
    return {ok:true,hasMore:false,message:enabled?"Auto-publish enabled for new AI content.":"New AI content will be saved for approval."};
  }
  if(intent==="publish_all"){
    const count=await publishAllDrafts(shop);
    return {ok:true,hasMore:false,message:`Published ${count} approved-format drafts.`};
  }
  if(intent==="sync")return await startAutomation(shop);
  if(intent==="step")return await runAutomationBatch(shop,admin,String(data.get("cursor")||""));
  return {ok:false,hasMore:false,message:"Unknown action."};
 }catch(error){
   console.error("AdMorph autopilot action failed",error);
   return {ok:false,hasMore:false,message:error instanceof Error?error.message:"An unexpected error occurred."};
 }
};
const blank=():BatchStats=>({processed:0,matched:0,generated:0,published:0,existing:0,unmatched:0,inactive:0,failed:0});
export default function Autopilot(){
 const d=useLoaderData<typeof loader>(),a=useActionData<typeof action>();
 const location=useLocation();
 const startedAfterConnect=useRef(false);
 const fetcher=useFetcher<typeof action>();
 const [running,setRunning]=useState(false);
 const [progress,setProgress]=useState<BatchStats>(blank);
 const [message,setMessage]=useState("");
 const [hasFinished,setHasFinished]=useState(false);
 const lastHandled=useRef<unknown>(null);
 useEffect(()=>{
   if(!running||fetcher.state!=="idle"||!fetcher.data||lastHandled.current===fetcher.data)return;
   const result=fetcher.data;
   lastHandled.current=result;
   if(!result.ok){setRunning(false);setMessage(result.message);return;}
   if("stats" in result && result.stats){
     const stats=result.stats;
     setProgress(prev=>Object.fromEntries(Object.keys(prev).map(k=>[k,prev[k as keyof BatchStats]+(stats[k as keyof BatchStats]||0)])) as BatchStats);
   }
   setMessage(result.message);
   if(result.hasMore){
     fetcher.submit({intent:"step",cursor:("nextCursor" in result ? result.nextCursor : "") || ""},{method:"post"});
   }else{
     setRunning(false);setHasFinished(true);
   }
 },[fetcher.data,fetcher.state,running]);
 useEffect(()=>{
   if(startedAfterConnect.current||!d.meta?.selectedAccountId)return;
   if(new URLSearchParams(location.search).get("run")==="1"){
     startedAfterConnect.current=true;
     launch();
   }
 },[location.search,d.meta?.selectedAccountId]);
 function launch(){
   setProgress(blank());setMessage("Importing your latest Meta ads...");setHasFinished(false);
   lastHandled.current=null;setRunning(true);
   fetcher.submit({intent:"sync"},{method:"post"});
 }
 const accounts=(d.meta?.accounts||[]) as Array<{id:string,name:string}>;
 return <s-page heading="Autopilot">
  <s-button slot="primary-action" variant="primary" disabled={!d.meta?.selectedAccountId||running} onClick={launch}>
    {running?"Processing Meta ads...":"Run Autopilot"}
  </s-button>
  <div className="am-container">
   <PageIntro eyebrow="AUTOMATION ENGINE" title="From Meta ads to AI product experiences"
     description="Import your ad creatives, find the linked Shopify products and generate storefront copy in one guided workflow.">
     <State text={d.meta?.selectedAccountId?"Ad account connected":"Connect an ad account"} kind={d.meta?.selectedAccountId?"success":"warning"}/>
   </PageIntro>
   <div className="am-stats">
     <Stat label="Imported Meta ads" value={d.ads} note="Across saved imports"/>
     <Stat label="Draft experiences" value={d.drafts} note="Awaiting review"/>
     <Stat label="Published experiences" value={d.published} note="Approved content" tone="success"/>
     <Stat label="Publishing mode" value={d.settings?.autoPublish?"Automatic":"Review first"} note="Configured by merchant"/>
   </div>
   {!d.meta?.selectedAccountId&&<s-banner tone="warning">Select a Meta advertising account to run Autopilot. <a href="/app/meta">Go to Meta Ads</a>.</s-banner>}
   <div className="am-layout">
    <div className="am-main-column">
     <s-section>
      <SectionHead title="Run AI Autopilot" action={d.meta?.selectedAccountId?<State text="Ready" kind="success"/>:<State text="Setup needed" kind="warning"/>}/>
      <p className="ad-muted">One run imports up to 50 Meta ads and automatically processes ads with verifiable product links. Existing valid drafts are kept unchanged.</p>
      <div className="am-operation-list">
       <div><span>01</span><strong>Read Meta ad creatives</strong><small>Read-only access to your selected ad account</small></div>
       <div><span>02</span><strong>Match Shopify products</strong><small>Validate destination URLs against this store</small></div>
       <div><span>03</span><strong>Generate AI product copy</strong><small>Create accurate draft headlines and benefits</small></div>
       <div><span>04</span><strong>Publish when ready</strong><small>Review first unless auto-publish is enabled</small></div>
      </div>
      <div className="am-run-footer">
       <button type="button" className="ad-btn" disabled={!d.meta?.selectedAccountId||running} onClick={launch}>
         {running?"Running Autopilot...":"Run AI Autopilot"}
       </button>
       <a className="am-text-link" href="/app/meta">Manage ad account</a>
      </div>
     </s-section>
     {(message||hasFinished)&&<s-section>
        <div role="status" aria-live="polite">
          <SectionHead title={running?"Checking your Meta ads":hasFinished&&progress.processed>0&&progress.matched===0?"No eligible Shopify product ads found":hasFinished?"Autopilot finished":"Run status"}/>
          <p className="ad-muted">{message}</p>
          <div className="auto-metrics">
           {([["processed","Ads checked"],["inactive","Paused / inactive"],["unmatched","Not matched"],["matched","Products matched"],["generated","AI drafts created"],["published","Published"],["failed","Errors"]] as const).map(([key,label])=><div key={key}><strong>{progress[key]}</strong><span>{label}</span></div>)}
          </div>
          {hasFinished&&progress.processed>0&&progress.matched===0&&<div className="am-autopilot-guidance">
            <strong>Why wasn't AI content generated?</strong>
            <p>{progress.inactive} ads were inactive and skipped. {progress.unmatched} active ads did not link directly to a product belonging to this Shopify store. No Shopify product could be selected automatically.</p>
            <strong>What to do next</strong>
            <p>Use a Meta ad linking to a Shopify product page such as <code>https://YOUR-STORE/products/product-handle</code>, or manually match a relevant ad with an actual product in AI Campaigns. Ads promoting unrelated websites cannot produce a meaningful Shopify product experience.</p>
            <a href="/app/campaigns" className="ad-btn ghost">Review ads & manually match a product</a>
          </div>}
          {hasFinished&&progress.matched>0&&<p className="ad-muted">Check AI Campaigns to review generated drafts and approve storefront content. Skipped ads may require manual product matching.</p>}
          {hasFinished&&progress.processed===0&&<p className="ad-muted">No ads were imported from this account. Select another Meta ad account or check your ad campaigns.</p>}
        </div>
     </s-section>}
     <s-section>
      <SectionHead title="Publish and review"/>
      <p className="ad-muted">New AI content stays in draft mode by default. Review product claims before publication.</p>
      <div className="am-detail-row"><span>Current mode</span><State text={d.settings?.autoPublish?"Auto publish enabled":"Manual review"} kind={d.settings?.autoPublish?"info":"neutral"}/></div>
      <div className="am-run-footer">
        <a className="ad-btn ghost" href="/app/settings">Publishing settings</a>
        <a className="ad-btn ghost" href="/app/campaigns">Review campaigns</a>
      </div>
      <Form method="post" className="am-inline-form">
       <input type="hidden" name="intent" value="publish_all"/>
       <button type="submit" className="ad-btn" disabled={d.drafts===0}>Publish all valid drafts ({d.drafts})</button>
      </Form>
      {a&&<s-banner tone={a.ok?"success":"critical"}>{a.message}</s-banner>}
     </s-section>
    </div>
    <aside className="am-side-column">
      <s-section>
       <SectionHead title="Selected ad account"/>
       <p className="ad-muted">{d.meta?.selectedAccountId||"Not selected"}</p>
       <p className="ad-muted">{((d.meta?.accounts||[]) as Array<{id:string,name:string}>).length} available accounts</p>
       <a className="ad-btn ghost am-standalone-action" href="/app/meta">Manage Meta Ads</a>
      </s-section>
      <s-section>
       <SectionHead title="Storefront setup"/>
       <p className="ad-muted">Add the AdMorph product block through Shopify Theme Editor and save once. Only matching published campaigns are shown.</p>
       <a className="ad-btn am-standalone-action" href="/app/theme">Theme activation guide</a>
      </s-section>
      <s-banner tone="info">AdMorph can import Meta ads, but <code>ads_read</code> cannot change campaign URLs. Add the <code>admorph_ad</code> parameter in Meta Ads Manager for visitor matching.</s-banner>
    </aside>
   </div>
  </div>
 </s-page>;
}
