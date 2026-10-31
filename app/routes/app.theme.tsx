import type {LoaderFunctionArgs,ActionFunctionArgs} from "react-router";
import {Form,useActionData,useLoaderData} from "react-router";
import prisma from "../db.server";
import {authenticate} from "../shopify.server";
import {themeEditorUrl} from "../services/overview.server";
import {PageIntro,State,SectionHead} from "../components/dashboard";
export const loader=async({request}:LoaderFunctionArgs)=>{
 const {session}=await authenticate.admin(request);
 const [setting,published]=await Promise.all([
  prisma.automationSetting.findUnique({where:{shop:session.shop},select:{themeConfirmedAt:true}}),
  prisma.campaign.count({where:{shop:session.shop,status:"PUBLISHED"}})
 ]);
 return {themeConfirmedAt:setting?.themeConfirmedAt||null,published,editorUrl:themeEditorUrl(session.shop)};
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
export default function Theme(){
 const d=useLoaderData<typeof loader>(),a=useActionData<typeof action>();
 return <s-page heading="Theme activation">
  <div className="am-container">
   <PageIntro eyebrow="STOREFRONT" title="Activate AdMorph on product pages"
    description="Add the Shopify theme app block once. AdMorph doesn't edit checkout, prices or product SEO.">
    <State text={d.themeConfirmedAt?"Merchant confirmed":"Confirmation pending"} kind={d.themeConfirmedAt?"success":"warning"}/>
   </PageIntro>
   {a&&<s-banner tone={a.ok?"success":"critical"}>{a.message}</s-banner>}
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
       <s-section><SectionHead title="Publishing status"/>
         <div className="am-detail-row"><span>Theme setup</span><State text={d.themeConfirmedAt?"Confirmed":"Not confirmed"} kind={d.themeConfirmedAt?"success":"warning"}/></div>
         <div className="am-detail-row"><span>Published experiences</span><strong>{d.published}</strong></div>
         <p className="ad-muted">Published content appears only when a visitor arrives with a matching Meta ad ID.</p>
       </s-section>
       <s-banner tone="info">Use <code>admorph_ad=&#123;&#123;ad.id&#125;&#125;</code> in Meta's URL parameters. Our current read-only Meta permission cannot add it automatically.</s-banner>
     </aside>
   </div>
  </div>
 </s-page>;
}
