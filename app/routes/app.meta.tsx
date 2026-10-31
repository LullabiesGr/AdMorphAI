import { useEffect, useState } from "react";
import { randomBytes } from "node:crypto";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useActionData, useLoaderData, useNavigate, useRevalidator } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { importMetaAds, metaAuthorizeUrl } from "../services/meta.server";

export const loader=async({request}:LoaderFunctionArgs)=>{
  const {session}=await authenticate.admin(request);
  const shop=session.shop;
  const [connection,adCount]=await Promise.all([
    prisma.metaConnection.findUnique({where:{shop},select:{
      selectedAccountId:true,accounts:true,tokenExpiresAt:true,connectedAt:true
    }}),
    prisma.metaAd.count({where:{shop}})
  ]);

  // Issue a durable, short-lived OAuth state while the merchant is securely
  // authenticated inside Shopify. The actual Meta URL can open outside the iframe.
  // Reuse the state while the original tab polls to detect a successful connection.
  let oauthUrl:string|null=null;
  let oauthError:string|null=null;
  try {
    const existing=await prisma.metaOauthState.findFirst({
      where:{shop,expiresAt:{gt:new Date(Date.now()+90_000)}},
      orderBy:{createdAt:"desc"},select:{nonce:true}
    });
    let nonce=existing?.nonce;
    if(!nonce){
      nonce=randomBytes(32).toString("hex");
      await prisma.metaOauthState.create({data:{
        nonce,shop,expiresAt:new Date(Date.now()+10*60_000)
      }});
    }
    oauthUrl=metaAuthorizeUrl(nonce);
  } catch(e){
    console.error("AdMorph Meta OAuth setup unavailable",e instanceof Error?e.message:"unknown");
    oauthError="Meta connection is not configured. Check META_APP_ID, META_APP_SECRET, META_LOGIN_CONFIG_ID and SHOPIFY_APP_URL in Render.";
  }
  return {connected:Boolean(connection),connection,adCount,oauthUrl,oauthError};
};

export const action=async({request}:ActionFunctionArgs)=>{
  const {session}=await authenticate.admin(request);
  const body=await request.formData();
  const intent=String(body.get("intent")||"");
  try {
    if(intent==="disconnect"){
      await prisma.$transaction([
        prisma.campaign.deleteMany({where:{shop:session.shop}}),
        prisma.metaAd.deleteMany({where:{shop:session.shop}}),
        prisma.metaConnection.deleteMany({where:{shop:session.shop}})
      ]);
      return {ok:true,message:"Meta disconnected; imported ads and associated campaigns deleted."};
    }
    if(intent==="select"){
      const accountId=String(body.get("account")||"");
      const meta=await prisma.metaConnection.findUnique({where:{shop:session.shop}});
      const accounts=(meta?.accounts||[]) as Array<{id:string,name:string}>;
      if(!accounts.some(a=>a.id===accountId))throw new Error("Selected account is not authorized");
      await prisma.metaConnection.update({where:{shop:session.shop},data:{selectedAccountId:accountId}});
      return redirect("/app/autopilot?run=1");
    }
    if(intent==="import"){
      const result=await importMetaAds(session.shop);
      return {ok:true,message:"Imported "+result.count+" ads"+(result.hasMore?" (first page only)":"")};
    }
    return {ok:false,message:"Unknown action"};
  }catch(e){
    return {ok:false,message:e instanceof Error?e.message:"Operation failed"};
  }
};

export default function MetaPage(){
  const data=useLoaderData<typeof loader>();
  const result=useActionData<typeof action>();
  const [waiting,setWaiting]=useState(false);
  const revalidator=useRevalidator();
  const navigate=useNavigate();
  const accounts=(data.connection?.accounts||[]) as Array<{id:string,name:string}>;

  // Meta OAuth requires top-level navigation. The merchant authorizes in a new
  // tab; the embedded Shopify page polls its own authenticated loader for success.
  useEffect(()=>{
    if(!waiting)return;
    const timer=window.setInterval(()=>revalidator.revalidate(),4000);
    return ()=>window.clearInterval(timer);
  },[waiting]);

  useEffect(()=>{
    if(!waiting || !data.connected)return;
    setWaiting(false);
    if(data.connection?.selectedAccountId)navigate("/app/autopilot?run=1");
  },[waiting,data.connected,data.connection?.selectedAccountId,navigate]);

  return <s-page heading="Meta Ads connection">
    <s-section heading="Connect your advertising account">
      <p className="ad-muted" style={{marginBottom:16}}>
        Connect once to import ad creatives and generate AI storefront experiences automatically.
      </p>
      {data.oauthError&&<s-banner tone="critical">{data.oauthError}</s-banner>}
      {data.oauthUrl&&<a
        className="ad-btn" style={{display:"inline-block",textDecoration:"none"}}
        href={data.oauthUrl} target="_blank" rel="noopener noreferrer"
        onClick={()=>setWaiting(true)}
      >{data.connected?"Reconnect Meta account":"Connect Meta account"}</a>}
      {waiting&&<p role="status" style={{marginTop:16}}>
        Complete the authorization in the new Meta tab. AdMorph will detect your connection automatically.
      </p>}
      <p className="ad-muted">Meta authorization opens in a separate browser tab because it cannot run inside the Shopify iframe.</p>
    </s-section>
    {result&&<s-banner tone={result.ok?"success":"critical"}>{result.message}</s-banner>}
    <s-section heading="Connection status">
      <s-stack direction="block" gap="base">
        <s-paragraph>{data.connected?"Connected to Meta Marketing API.":"Not connected yet."}</s-paragraph>
        <s-paragraph>{data.adCount} imported ad(s). Read-only ads_read permission.</s-paragraph>
        {data.connection?.tokenExpiresAt&&<s-paragraph>
          Token expires: {new Date(data.connection.tokenExpiresAt).toLocaleDateString()}
        </s-paragraph>}
      </s-stack>
    </s-section>
    {data.connected&&<s-section heading="Select advertising account">
      <Form method="post">
        <input type="hidden" name="intent" value="select"/>
        <select name="account" defaultValue={data.connection?.selectedAccountId||""} required className="ad-input">
          <option value="" disabled>Select an ad account</option>
          {accounts.map(a=><option key={a.id} value={a.id}>{a.name} ({a.id})</option>)}
        </select>
        <button type="submit" className="ad-btn">Select and run Autopilot</button>
      </Form>
      <Form method="post" style={{marginTop:18}}>
        <input type="hidden" name="intent" value="import"/>
        <button className="ad-btn ghost" type="submit">Sync ads manually</button>
      </Form>
    </s-section>}
    {data.connected&&<s-section heading="Automated setup">
      <p>Autopilot imports eligible ads, matches active products and generates AI content.</p>
      <a className="ad-btn" style={{display:"inline-block",textDecoration:"none"}} href="/app/autopilot">Open AI Autopilot</a>
    </s-section>}
    {data.connected&&<s-section heading="Disconnect and delete data">
      <s-paragraph>Remove the connection, imported ads and generated campaigns for this store.</s-paragraph>
      <Form method="post"><input type="hidden" name="intent" value="disconnect"/>
        <button className="ad-btn ghost" type="submit">Disconnect Meta and delete imported data</button>
      </Form>
    </s-section>}
  </s-page>;
}
