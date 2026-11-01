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
 const embedPanelUrl=new URL(base+"/admin/themes/current/editor");
 embedPanelUrl.searchParams.set("context","apps");
 embedPanelUrl.searchParams.set("template","product");
 autoEmbedEditor.searchParams.set("context","apps");
 autoEmbedEditor.searchParams.set("template","product");
 autoEmbedEditor.searchParams.set("activateAppId",(process.env.SHOPIFY_API_KEY||"")+"/admorph-autopilot");
 const testLink=testCampaign ? base+"/products/"+encodeURIComponent(testCampaign.productHandle)+"?admorph_ad="+encodeURIComponent(testCampaign.metaAdId) : null;
 const proxyLink=testCampaign ? base+"/apps/admorph?ad_id="+encodeURIComponent(testCampaign.metaAdId)+"&product_handle="+encodeURIComponent(testCampaign.productHandle) : null;
 return {themeConfirmedAt:setting?.themeConfirmedAt||null,published,editorUrl:themeEditorUrl(session.shop),inlineEditorUrl:themeEditorUrl(session.shop,"mainSection"),autoEmbedEditorUrl:autoEmbedEditor.toString(),embedPanelUrl:embedPanelUrl.toString(),
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
type ThemeStatus="checking"|"active"|"available"|"missing"|"unavailable"|"error";
type ThemeCheck={status:ThemeStatus;detail:string;manualStatus:ThemeStatus;embedStatus:ThemeStatus};
type ThemeActivation={handle:string;name?:string;status?:string;activations?:Array<{target?:string;themeId?:string}>};
type ThemeExtension={handle:string;type:string;activations?:ThemeActivation[]};
function getShopifyExtensions(){
 const bridge=(window as Window & {shopify?:{app?:{extensions?:()=>Promise<ThemeExtension[]>}}}).shopify;
 if(!bridge?.app?.extensions) throw new Error("Shopify App Bridge extension status is unavailable.");
 return bridge.app.extensions();
}
export default function Theme(){
 const d=useLoaderData<typeof loader>(),a=useActionData<typeof action>();
 const [check,setCheck]=useState<ThemeCheck>({status:"checking",detail:"Checking the published Shopify theme…",manualStatus:"checking",embedStatus:"checking"});
 const verify=useCallback(async()=>{
   setCheck({status:"checking",detail:"Checking Shopify theme activation…",manualStatus:"checking",embedStatus:"checking"});
   try{
     const ext=await getShopifyExtensions();
     const themes=ext.filter(e=>e.type==="theme_app_extension");
     const blocks=themes.flatMap(e=>e.activations||[]);
     const statusFor=(handle:string):ThemeStatus=>{
       const items=blocks.filter(x=>x.handle===handle);
       if(items.some(x=>x.status==="active"))return "active";
       if(items.some(x=>x.status==="available"))return "available";
       if(items.length)return "unavailable";
       return "missing";
     };
     const manualStatus=statusFor("admorph-product");
     const embedStatus=statusFor("admorph-autopilot");
     const available=manualStatus!=="missing"||embedStatus!=="missing";
     const active=manualStatus==="active"||embedStatus==="active";
     setCheck({
       status:active?"active":!available?"missing":embedStatus==="available"||manualStatus==="available"?"available":"unavailable",
       manualStatus,embedStatus,
       detail:!available
        ? "Shopify does not list either AdMorph theme integration in the currently installed app. Release a Shopify app version containing the Theme App Extension before activating it."
        : embedStatus==="missing"
        ? "The manual AdMorph block may be available, but the NEW Auto Placement embed was not included in the active Shopify version. Deploy the updated theme extension."
        : embedStatus==="active"
        ? "Shopify confirms AdMorph Auto Placement is active in the published theme."
        : manualStatus==="active"
        ? "The manual AdMorph block is active. Auto Placement is a separate integration and may still need deployment or activation."
        : "Shopify recognizes the AdMorph integration. Enable it in the published theme and click Save."
     });
   }catch(error){
     setCheck({status:"error",detail:error instanceof Error?error.message:"Unable to check the Shopify theme.",manualStatus:"error",embedStatus:"error"});
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
      {(check.embedStatus==="missing"||check.status==="missing")&&<s-banner tone="warning">
       AdMorph Auto Placement does not exist in the installed Shopify app version. It cannot be activated from the Theme Editor yet.
       Run <code>git pull origin main</code>, validate the linked configuration, and release the app extension with <code>shopify app deploy --config YOUR_LINKED_CONFIG</code>. Confirm the new version lists AdMorph Personalization and its app embed before returning here.
      </s-banner>}
   </s-section>
   <div className="am-layout">
     <div className="am-main-column">
       <s-section>
        <SectionHead title="Recommended: automatic placement" action={<State text="Works with custom themes" kind="info"/>}/>
        <p className="ad-muted">Use the AdMorph Auto Placement app embed for themes such as MELD. With Immersive Hero enabled, it places a large ad-matched product showcase above the existing Shopify product section. Native prices, images, variants and checkout remain unchanged. No manual theme code edits are required.</p>
        <div className="am-guide-row"><span>01</span><div><strong>Enable the AdMorph Auto Placement app embed</strong><p>Open the published theme's App embeds panel. Enable AdMorph Auto Placement.</p></div></div>
        <div className="am-guide-row"><span>02</span><div><strong>Turn on Immersive Hero</strong><p>Enable the new "Show immersive ad-matched hero before product" checkbox. It uses the real Shopify product photography and campaign-specific visual styling. Uncheck it to return to a smaller inline block.</p></div></div>
        <div className="am-guide-row"><span>03</span><div><strong>Press Save in Shopify</strong><p>Then open the test product URL with <code>admorph_ad</code>. Without a matching ad ID, the normal product page stays unchanged.</p></div></div>
        {check.embedStatus==="active"?<State text="Auto Placement active" kind="success"/>:
         check.embedStatus==="available"?
          <a className="ad-btn am-standalone-action" href={d.autoEmbedEditorUrl} target="_top">Enable AdMorph Auto Placement</a>:
         <a className="ad-btn ghost am-standalone-action" href={d.embedPanelUrl} target="_top">Open Shopify App Embeds panel</a>}
        {check.embedStatus==="missing"&&<p className="ad-muted">The Shopify app version has not registered Auto Placement. Deploy the extension before attempting activation; otherwise Shopify displays “App embed does not exist.”</p>}
        <p className="ad-muted">If you already use the manual AdMorph block, the automatic integration detects it and avoids duplicate content. The new Immersive Hero feature works for both the manual block and automatic embed.</p>
       </s-section>
       <s-section>
        <SectionHead title="Alternative: position a manual app block"/>
        <div className="am-guide-row"><span>01</span><div><strong>Open the Shopify Theme Editor</strong><p>Use the button below. AdMorph will open the product template and request to add its app block.</p></div></div>
        <div className="am-guide-row"><span>02</span><div><strong>Choose Immersive Hero or inline placement</strong><p>Enable the Immersive Hero checkbox for the large product showcase above the original product section. Disable it to keep AdMorph in the exact section position you choose.</p></div></div>
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
         <div className="am-detail-row"><span>Auto Placement embed</span><State text={check.embedStatus==="active"?"Active":check.embedStatus==="available"?"Available":check.embedStatus==="missing"?"Not deployed":check.embedStatus==="checking"?"Checking": "Unavailable"} kind={check.embedStatus==="active"?"success":"warning"}/></div>
         <div className="am-detail-row"><span>Manual product block</span><State text={check.manualStatus==="active"?"Active":check.manualStatus==="available"?"Available":check.manualStatus==="missing"?"Not deployed":check.manualStatus==="checking"?"Checking":"Unavailable"} kind={check.manualStatus==="active"?"success":"warning"}/></div>
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
