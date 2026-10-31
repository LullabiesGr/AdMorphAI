import type {ActionFunctionArgs,LoaderFunctionArgs} from "react-router";
import {Form,useActionData,useLoaderData} from "react-router";
import {authenticate} from "../shopify.server";
import prisma from "../db.server";
import {importMetaAds} from "../services/meta.server";
export const loader=async({request}:LoaderFunctionArgs)=>{
 const {session}=await authenticate.admin(request);
 const connection=await prisma.metaConnection.findUnique({where:{shop:session.shop},select:{
   selectedAccountId:true,accounts:true,tokenExpiresAt:true,connectedAt:true
 }});
 const count=await prisma.metaAd.count({where:{shop:session.shop}});
 return {connected:Boolean(connection),connection,adCount:count};
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
    return {ok:true,message:"Meta disconnected and imported ad data deleted."};
  }
  if(intent==="select") {
   const accountId=String(body.get("account")||"");
   const meta=await prisma.metaConnection.findUnique({where:{shop:session.shop}});
   const accounts=(meta?.accounts||[]) as Array<{id:string,name:string}>;
   if(!accounts.some(a=>a.id===accountId)) throw new Error("Selected account is not authorized");
   await prisma.metaConnection.update({where:{shop:session.shop},data:{selectedAccountId:accountId}});
   return {ok:true,message:"Account selected"};
  }
  if(intent==="import") {
   const result=await importMetaAds(session.shop);
   return {ok:true,message:"Imported "+result.count+" ads"+(result.hasMore?" (more available; first page only)":"")};
  }
  return {ok:false,message:"Unknown action"};
 }catch(e){return {ok:false,message:e instanceof Error?e.message:"Operation failed"};}
};
export default function MetaPage(){
 const data=useLoaderData<typeof loader>(),result=useActionData<typeof action>();
 const accounts=(data.connection?.accounts||[]) as Array<{id:string,name:string}>;
 return <s-page heading="Meta Ads connection">
  <s-button slot="primary-action" href="/app/meta/connect" target="_top">{data.connected?"Reconnect Meta":"Connect Meta account"}</s-button>
  {result&&<s-banner tone={result.ok?"success":"critical"}>{result.message}</s-banner>}
  <s-section heading="Connection status"><s-stack direction="block" gap="base">
    <s-paragraph>{data.connected?"Connected to Meta Marketing API.":"Connect your Meta account to import ad creatives securely."}</s-paragraph>
    <s-paragraph>{data.adCount} imported ad(s). Access is read-only (ads_read).</s-paragraph>
    {data.connection?.tokenExpiresAt&&<s-paragraph>Token expires: {new Date(data.connection.tokenExpiresAt).toLocaleDateString()}</s-paragraph>}
  </s-stack></s-section>
  {data.connected&&<s-section heading="Select advertising account">
    <Form method="post"><input type="hidden" name="intent" value="select"/>
     <select name="account" defaultValue={data.connection?.selectedAccountId||""} required style={{padding:12,minWidth:320,borderRadius:7,border:"1px solid #ccc"}}>
      <option value="" disabled>Select an ad account</option>
      {accounts.map(a=><option key={a.id} value={a.id}>{a.name} ({a.id})</option>)}
     </select> <button type="submit" className="ad-btn">Save account</button>
    </Form>
    <Form method="post"><input type="hidden" name="intent" value="import"/>
     <button type="submit" className="ad-btn" style={{marginTop:18}}>Sync Meta Ads</button>
    </Form>
  </s-section>}
  {data.connected&&<s-section heading="Disconnect and delete data">
    <s-paragraph>Remove the Meta connection, imported ad data and associated AI campaigns for this shop.</s-paragraph>
    <Form method="post"><input type="hidden" name="intent" value="disconnect"/><button className="ad-btn ghost" type="submit">Disconnect Meta and delete imported data</button></Form>
  </s-section>}
  <s-section heading="Automatic setup">
   <s-paragraph>After connecting, open Autopilot to import ads, match product destinations and generate content. A single available Meta ad account is selected automatically.</s-paragraph>
   <s-button href="/app/autopilot">Open AI Autopilot</s-button>
  </s-section>
  <s-section heading="Import scope"><s-paragraph>Imports the first 50 ads for the selected account. Does not modify campaigns, tracking parameters or Meta Pixel. Meta App Review may be required for third-party advertisers.</s-paragraph></s-section>
 </s-page>;
}
