import type {LoaderFunctionArgs,ActionFunctionArgs} from "react-router";
import {Form,useActionData,useLoaderData} from "react-router";
import {useCallback,useEffect,useState} from "react";
import prisma from "../db.server";
import {authenticate} from "../shopify.server";
import {themeEditorUrl} from "../services/overview.server";
import {PageIntro,State,SectionHead} from "../components/dashboard";
export const loader=async({request}:LoaderFunctionArgs)=>{
 const {session}=await authenticate.admin(request);
 const [setting,published,testCampaign]=await Promise.all([
  prisma.automationSetting.findUnique({where:{shop:session.shop},select:{themeConfirmedAt:true}}),
  prisma.campaign.count({where:{shop:session.shop,status:"PUBLISHED"}}),
  prisma.campaign.findFirst({where:{shop:session.shop,status:"PUBLISHED"},orderBy:{updatedAt:"desc"},select:{productHandle:true,metaAdId:true,productTitle:true}})
 ]);
 const base="https://"+session.shop;
 const testLink=testCampaign ? base+"/products/"+encodeURIComponent(testCampaign.productHandle)+"?admorph_ad="+encodeURIComponent(testCampaign.metaAdId) : null;
 const proxyLink=testCampaign ? base+"/apps/admorph?ad_id="+encodeURIComponent(testCampaign.metaAdId)+"&product_handle="+encodeURIComponent(testCampaign.productHandle) : null;
 return {themeConfirmedAt:setting?.themeConfirmedAt||null,published,editorUrl:themeEditorUrl(session.shop),
  testProduct:testCampaign?.productTitle||null,testLink,proxyLink};
};
export const action=async({request}:ActionFunctionArgs)=>{
 const {session}=await authenticate.admin(request);
 const body=await request.formData();
 const intent=String(body.get("intent")||"");
 if(!["confirm","reset"].includes(intent))return {ok:false,message:"Invalid action."};
 if(intent==="confirm"&&body.get("saved")!=="yes")return {ok:false,message:"Confirm that you saved the block in the Theme Editor."};
 await prisma.automationSetting.upsert({where:{shop:session.shop},
  create:{shop:session.shop,themeConfirmedAt:intent==="confirm"?new Date():null},
  update:{themeConfirmedAt:intent==="confirm"?new Date():null}});
 return {ok:true,message:intent==="confirm"?"Theme setup marked as confirmed.":"Theme setup marked as not confirmed."};
};
type ThemeCheck={status:"checking"|"active"|"available"|"missing"|"unavailable"|"error";detail:string;};
type ThemeActivation={handle:string;name?:string;status?:string;activations?:Array<{target?:string;themeId?:string}>};
type ThemeExtension={handle:string;type:string;activations?:ThemeActivation[]};
function getShopifyExtensions(){
 const bridge=(window as Window & {shopify?:{app?:{extensions?:()=>Promise<ThemeExtension[]>}}}).shopify;
 if(!bridge?.app?.extensions) throw new Error("Shopify App Bridge extension status is unavailable.");
 return bridge.app.extensions();
}
export default function Theme(){
 const d=useLoaderData<typeof loader>(),a=useActionData<typeof action>();
 const [check,setCheck]=useState<ThemeCheck>({status:"checking",detail:"Checking the published Shopify theme…"});
 const verify=useCallback(async()=>{
   setCheck({status:"checking",detail:"Checking Shopify theme activation…"});
   try{
     const ext=await getShopifyExtensions();
     const themes=ext.filter(e=>e.type==="theme_app_extension");
     const ours=themes.flatMap(e=>e.activations||[]).filter(x=>x.handle==="admorph-product");
     if(ours.some(x=>x.status==="active")){
       setCheck({status:"active",detail:"Shopify confirms the AdMorph personalization block is active in the published theme."});
     }else if(ours.some(x=>x.status==="available")){
       setCheck({status:"available",detail:"Shopify recognizes the AdMorph block, but it is not active in the published theme. Add it to the product template and Save."});
     }else if(ours.length){
       setCheck({status:"unavailable",detail:"Shopify found the AdMorph block but reports it unavailable. Check the published theme template and block compatibility."});
     }else{
       setCheck({status:"missing",detail:"Shopify does not report an AdMorph personalization block in this app version. The theme extension may not have been deployed to Shopify."});
     }
   }catch(error){
     setCheck({status:"error",detail:error instanceof Error?error.message:"Unable to check the Shopify theme."});
   }
 },[]);
 useEffect(()=>{void verify();},[verify]);
 return <s-page heading="Theme activation">
  <div className="am-container">
   <PageIntro eyebrow="STOREFRONT" title="Activate AdMorph on product pages"
    description="Add the Shopify theme app block once. AdMorph doesn't edit checkout, prices or product SEO.">
    <State text={d.themeConfirmedAt?"Merchant confirmed":"Confirmation pending"} kind={d.themeConfirmedAt?"success":"warning"}/>
   </PageIntro>
   {a&&<s-banner tone={a.ok?"success":"critical"}>{a.message}</s-banner>}
   <s-section>
      <div className="am-theme-check">
        <div className="am-theme-check-copy">
          <strong>Published theme: Shopify verification</strong>
          <span className={"am-theme-check-state am-"+(check.status==="active"?"success":check.status==="checking"?"info":"warning")}>
             {check.status==="active"?"Active":check.status==="checking"?"Checking…":check.status==="available"?"Not activated":check.status==="missing"?"Extension not detected":check.status==="unavailable"?"Unavailable":"Cannot verify"}
          </span>
          <p>{check.detail}</p>
          {d.themeConfirmedAt&&check.status!=="active"&&check.status!=="checking"&&<p className="ad-muted">Your previous manual confirmation does not verify the live theme. Only Shopify's published-theme status is authoritative.</p>}
        </div>
        <button type="button" className="ad-btn ghost" onClick={()=>void verify()} disabled={check.status==="checking"}>Check again</button>
      </div>
      {check.status==="missing"&&<s-banner tone="warning">The Shopify Theme App Extension must be deployed separately from Render using <code>shopify app deploy</code> from your linked AdMorphAI project. Once published, return here and run Check again.</s-banner>}
   </s-section>
   <div className="am-layout">
     <div className="am-main-column">
       <s-section>
        <SectionHead title="Activate in three steps"/>
        <div className="am-guide-row"><span>01</span><div><strong>Open the Shopify Theme Editor</strong><p>Use the button below. AdMorph will open the product template and request to add its app block.</p></div></div>
        <div className="am-guide-row"><span>02</span><div><strong>Place the personalization block</strong><p>Position AdMorph near the product description, benefits or Add to Cart area.</p></div></div>
        <div className="am-guide-row"><span>03</span><div><strong>Save the theme</strong><p>Press Save in Shopify. Return to AdMorph and confirm the setup below.</p></div></div>
        <a className="ad-btn am-standalone-action" href={d.editorUrl} target="_top">Open Shopify Theme Editor</a>
       </s-section>
       <s-section>
        <SectionHead title="Mark setup complete"/>
        <p className="ad-muted">This records your confirmation, not an automatic theme verification. Check the actual product page after saving.</p>
        <Form method="post" className="am-form-stack">
         <input type="hidden" name="intent" value="confirm"/>
         <label className="am-checkbox"><input type="checkbox" name="saved" value="yes" required/>
          I added the AdMorph block to the product template and saved the theme.</label>
         <button type="submit" className="ad-btn">Confirm theme setup</button>
        </Form>
        {d.themeConfirmedAt&&<Form method="post" className="am-inline-form">
           <input type="hidden" name="intent" value="reset"/>
           <button className="ad-btn ghost" type="submit">Mark as not confirmed</button>
         </Form>}
       </s-section>
     </div>
     <aside className="am-side-column">
       {d.testLink&&<s-section>
         <SectionHead title="Test a published experience"/>
         <p className="ad-muted">Testing with your published AI campaign: <strong>{d.testProduct}</strong>.</p>
         <a className="ad-btn am-standalone-action" href={d.testLink} target="_blank" rel="noopener noreferrer">Open personalized product URL</a>
         <p className="ad-muted">If the page remains unchanged, inspect the proxy response. It should contain the AI headline and benefits as JSON.</p>
         <a href={d.proxyLink||"#"} target="_blank" rel="noopener noreferrer" className="am-text-link">Test Shopify App Proxy response</a>
       </s-section>}
       <s-section><SectionHead title="Publishing status"/>
         <div className="am-detail-row"><span>Published theme</span><State text={check.status==="active"?"Active":check.status==="checking"?"Checking":check.status==="error"?"Unknown":"Not active"} kind={check.status==="active"?"success":"warning"}/></div>
         <div className="am-detail-row"><span>Merchant confirmation</span><State text={d.themeConfirmedAt?"Confirmed":"Pending"} kind={d.themeConfirmedAt?"success":"neutral"}/></div>
         <div className="am-detail-row"><span>Published experiences</span><strong>{d.published}</strong></div>
         <p className="ad-muted">Published content appears only when a visitor arrives with a matching Meta ad ID.</p>
       </s-section>
       <s-banner tone="info">Use <code>admorph_ad=&#123;&#123;ad.id&#125;&#125;</code> in Meta's URL parameters. Our current read-only Meta permission cannot add it automatically.</s-banner>
     </aside>
   </div>
  </div>
 </s-page>;
}
