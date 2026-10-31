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
 const autoEmbedEditor=new URL(base+"/admin/themes/current/editor");
 autoEmbedEditor.searchParams.set("context","apps");
 autoEmbedEditor.searchParams.set("template","product");
 autoEmbedEditor.searchParams.set("activateAppId",(process.env.SHOPIFY_API_KEY||"")+"/admorph-autopilot");
 const testLink=testCampaign ? base+"/products/"+encodeURIComponent(testCampaign.productHandle)+"?admorph_ad="+encodeURIComponent(testCampaign.metaAdId) : null;
 const proxyLink=testCampaign ? base+"/apps/admorph?ad_id="+encodeURIComponent(testCampaign.metaAdId)+"&product_handle="+encodeURIComponent(testCampaign.productHandle) : null;
 return {themeConfirmedAt:setting?.themeConfirmedAt||null,published,editorUrl:themeEditorUrl(session.shop),inlineEditorUrl:themeEditorUrl(session.shop,"mainSection"),autoEmbedEditorUrl:autoEmbedEditor.toString(),
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
     const ours=themes.flatMap(e=>e.activations||[]).filter(x=>x.handle==="admorph-product"||x.handle==="admorph-autopilot");
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
        <SectionHead title="Recommended: automatic placement" action={<State text="Works with custom themes" kind="info"/>}/>
        <p className="ad-muted">Use the AdMorph Auto Placement app embed for themes such as MELD. It adds personalized copy to the product information automatically when visitors arrive from a matching Meta ad. No manual theme section placement is needed.</p>
        <div className="am-guide-row"><span>01</span><div><strong>Enable the AdMorph Auto Placement app embed</strong><p>Open the published theme's App embeds panel. Enable AdMorph Auto Placement.</p></div></div>
        <div className="am-guide-row"><span>02</span><div><strong>Choose where the AI copy appears</strong><p>Below product title, below Add to Cart, or below product description. Default is below product title.</p></div></div>
        <div className="am-guide-row"><span>03</span><div><strong>Press Save in Shopify</strong><p>Then open the test product URL with <code>admorph_ad</code>. Without a matching ad ID, the normal product page stays unchanged.</p></div></div>
        <a className="ad-btn am-standalone-action" href={d.autoEmbedEditorUrl} target="_top">Enable automatic product personalization</a>
        <p className="ad-muted">If you already use the manual AdMorph block, the automatic integration detects it and avoids showing duplicate content.</p>
       </s-section>
       <s-section>
        <SectionHead title="Alternative: position a manual app block"/>
        <div className="am-guide-row"><span>01</span><div><strong>Open the Shopify Theme Editor</strong><p>Use the button below. AdMorph will open the product template and request to add its app block.</p></div></div>
        <div className="am-guide-row"><span>02</span><div><strong>Place the personalization block</strong><p>Position AdMorph near the product description, benefits or Add to Cart area.</p></div></div>
        <div className="am-guide-row"><span>03</span><div><strong>Save the theme</strong><p>Press Save in Shopify. Return to AdMorph and confirm the setup below.</p></div></div>
        <a className="ad-btn am-standalone-action" href={d.editorUrl} target="_top">Add AdMorph block to product page</a>
        <p className="ad-muted">This opens a dedicated Apps section in the published theme, which works even when a custom product section does not support app blocks. Press <strong>Save</strong> in Shopify.</p>
        <p className="ad-muted">Prefer the block directly beside the product description? <a href={d.inlineEditorUrl} target="_top">Try inserting inside the main product section</a> (requires theme support).</p>
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
       <s-section>
         <SectionHead title="App Proxy troubleshooting"/>
         <p className="ad-muted">If the test link above shows Shopify HTTP 404, Shopify has not routed <code>/apps/admorph</code> to this app yet. This is a Shopify app configuration issue, not an OpenAI issue.</p>
         <div className="am-guide-row"><span>01</span><div><strong>Check the installed app's proxy URL</strong><p>Shopify Admin → Settings → Apps and sales channels → AdMorph AI → App proxy. The path must be <code>/apps/admorph</code>. Merchants can customize this path per store.</p></div></div>
         <div className="am-guide-row"><span>02</span><div><strong>Publish the Shopify app configuration</strong><p>From the project folder run <code>git pull origin main</code>, then <code>shopify app config link</code> (select your existing AdMorph AI app), and <code>shopify app deploy</code>. The Render deploy does not configure Shopify App Proxy.</p></div></div>
         <div className="am-guide-row"><span>03</span><div><strong>Check permissions and retest</strong><p>Confirm that the installed app has <code>write_app_proxy</code> access, approve updated access if Shopify prompts, and reopen the Test Shopify App Proxy response link. A working response contains JSON with the published headline.</p></div></div>
       </s-section>
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
