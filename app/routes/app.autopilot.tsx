import { useEffect, useRef, useState } from "react";
import type {ActionFunctionArgs,LoaderFunctionArgs} from "react-router";
import {Form,useActionData,useFetcher,useLoaderData} from "react-router";
import prisma from "../db.server";
import {authenticate} from "../shopify.server";
import {startAutomation,runAutomationBatch,publishAllDrafts, type BatchStats} from "../services/automation.server";

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
 function launch(){
   setProgress(blank());setMessage("Importing your latest Meta ads...");setHasFinished(false);
   lastHandled.current=null;setRunning(true);
   fetcher.submit({intent:"sync"},{method:"post"});
 }
 const accounts=(d.meta?.accounts||[]) as Array<{id:string,name:string}>;
 return <s-page heading="AdMorph Autopilot">
  <div className="auto-banner">
    <span className="auto-kicker">AD-TO-STOREFRONT AUTOMATION</span>
    <h1>Launch relevant product experiences automatically.</h1>
    <p>Import Meta ads, detect linked products, and generate AI versions in one run. You control when content goes live.</p>
    <div className="auto-cta">
      <button type="button" className="ad-btn auto-btn" disabled={!d.meta?.selectedAccountId||running} onClick={launch}>{running?"Autopilot working...":"Run AI Autopilot"}</button>
      <span>{!d.meta?"Connect Meta first":!d.meta.selectedAccountId?"Choose your ad account":d.meta.selectedAccountId}</span>
    </div>
  </div>
  <div className="auto-steps">
   <div className="auto-step"><strong>01 · Connect</strong><span>{d.meta?"Meta connected":"Awaiting authorization"}</span></div>
   <div className="auto-step"><strong>02 · Match</strong><span>Exact product destinations</span></div>
   <div className="auto-step"><strong>03 · Generate</strong><span>OpenAI product-safe copy</span></div>
   <div className="auto-step"><strong>04 · Publish</strong><span>Merchant-controlled</span></div>
  </div>
  {(message||hasFinished)&&<div className="auto-results" role="status">
    <strong>{running?"Working through your ads":"Automation run"}</strong>
    <p>{message}</p>
    <div className="auto-metrics">
    {([["processed","Processed"],["matched","Matched"],["generated","Generated"],["published","Published"],["unmatched","Needs mapping"],["failed","Errors"]] as const).map(([key,label])=><div key={key}><strong>{progress[key]}</strong><span>{label}</span></div>)}
    </div>
    {hasFinished&&<p className="ad-muted">Ads with non-product destinations, carousel links, or non-active status are not modified. See AI Campaigns for manual mapping.</p>}
   </div>}
  <div className="auto-panel-grid">
    <div className="ad-card">
      <div className="auto-section-title">Publication mode</div>
      <p className="ad-muted">By default, generated content stays in Draft until you approve it. Auto-publish requires explicit consent.</p>
      <Form method="post">
       <input type="hidden" name="intent" value="setting"/>
       <label className="auto-toggle"><input type="checkbox" name="autoPublish" defaultChecked={d.settings?.autoPublish||false}/> Automatically publish new AI variations</label>
       <p className="ad-muted">Only enable this when you trust your product descriptions and accept responsibility for verifying marketing claims. Prices, discounts and checkout never change.</p>
       <button type="submit" className="ad-btn ghost">Save publication mode</button>
      </Form>
      {a&&<p className="ad-muted" role="status">{a.message}</p>}
    </div>
    <div className="ad-card">
      <div className="auto-section-title">Storefront activation</div>
      <p className="ad-muted">Open your theme with the AdMorph block preselected. Shopify requires you to Save the theme once.</p>
      <a className="ad-btn" style={{display:"inline-block",textDecoration:"none"}} href={d.themeUrl} target="_top">Add AdMorph to product pages</a>
      <p className="ad-muted">Only visitors with a recognized Meta ad ID in their URL see published personalized copy.</p>
    </div>
  </div>
  <div className="auto-panel-grid">
    <div className="ad-card">
      <div className="auto-section-title">Your content</div>
      <div className="auto-summary-number">{d.ads} <span>imported ads</span></div>
      <div className="auto-summary-number">{d.drafts} <span>draft variants</span></div>
      <div className="auto-summary-number">{d.published} <span>published variants</span></div>
      <Form method="post"><input type="hidden" name="intent" value="publish_all"/>
      <button className="ad-btn ghost" type="submit" disabled={d.drafts===0}>Publish all valid drafts</button></Form>
      <p className="ad-muted">For individual edits and approvals, open <a href="/app/campaigns">AI Campaigns</a>.</p>
    </div>
    <div className="ad-card">
      <div className="auto-section-title">Meta account</div>
      <p className="ad-muted">{d.meta?"Connected":"Not connected"} · {accounts.length} available account(s)</p>
      <p className="ad-muted">The initial import handles up to 50 Meta ads per run. Active ads with directly linked Shopify products are eligible for auto-matching.</p>
      <a href="/app/meta" className="ad-btn ghost" style={{display:"inline-block",textDecoration:"none"}}>{d.meta?"Manage Meta connection":"Connect Meta Ads"}</a>
      <p className="ad-muted">Current permission is ads_read. Tracking URLs cannot be edited automatically until Meta approves ads_management.</p>
    </div>
  </div>
 </s-page>;
}
