import type {LoaderFunctionArgs,ActionFunctionArgs} from "react-router";
import {Form,useActionData,useLoaderData} from "react-router";
import prisma from "../db.server";
import {authenticate} from "../shopify.server";
import {PageIntro,SectionHead,State} from "../components/dashboard";
export const loader=async({request}:LoaderFunctionArgs)=>{
 const {session}=await authenticate.admin(request);
 const [settings,meta]=await Promise.all([
  prisma.automationSetting.findUnique({where:{shop:session.shop},select:{autoPublish:true,themeConfirmedAt:true,lastSyncAt:true}}),
  prisma.metaConnection.findUnique({where:{shop:session.shop},select:{selectedAccountId:true}})
 ]);
 return {settings,metaConnected:Boolean(meta),shop:session.shop};
};
export const action=async({request}:ActionFunctionArgs)=>{
 const {session}=await authenticate.admin(request);
 const form=await request.formData();
 if(form.get("intent")!=="publication")return {ok:false,message:"Unsupported action."};
 const autoPublish=form.get("autoPublish")==="on";
 if(autoPublish && form.get("acknowledge")!=="yes")
   return {ok:false,message:"Confirm that you accept responsibility for AI marketing claims before enabling auto-publish."};
 await prisma.automationSetting.upsert({where:{shop:session.shop},
  create:{shop:session.shop,autoPublish},update:{autoPublish}});
 return {ok:true,message:autoPublish?"Automatic publication enabled.":"New AI content will be saved as drafts."};
};
export default function Settings(){
 const d=useLoaderData<typeof loader>(),a=useActionData<typeof action>();
 return <s-page heading="Settings">
  <div className="am-container">
   <PageIntro eyebrow="PREFERENCES" title="Control how AdMorph works"
     description="Manage your publication workflow, connected services, and privacy settings."/>
   {a&&<s-banner tone={a.ok?"success":"critical"}>{a.message}</s-banner>}
   <div className="am-layout">
    <div className="am-main-column">
      <s-section>
       <SectionHead title="AI publishing"/>
       <p className="ad-muted">Review-first is the recommended mode. AI content can contain mistakes; approving claims is the merchant's responsibility.</p>
       <Form method="post" className="am-form-stack">
        <input type="hidden" name="intent" value="publication"/>
        <label className="am-checkbox">
          <input type="checkbox" name="autoPublish" defaultChecked={d.settings?.autoPublish||false}/>
          <span><strong>Automatically publish new AI variations</strong><small>When disabled, new variations remain drafts until reviewed.</small></span>
        </label>
        <label className="am-checkbox">
          <input type="checkbox" name="acknowledge" value="yes"/>
          <span>I understand that I am responsible for verifying marketing claims before automated publication.</span>
        </label>
        <button type="submit" className="ad-btn">Save settings</button>
       </Form>
      </s-section>
      <s-section>
       <SectionHead title="Data and connected services"/>
       <div className="am-detail-row"><span>Meta Ads connection</span><State text={d.metaConnected?"Connected":"Not connected"} kind={d.metaConnected?"success":"warning"}/></div>
       <p className="ad-muted">AdMorph only requests read-only Meta ad access for importing creative data.</p>
       <a href="/app/meta" className="ad-btn ghost am-standalone-action">Manage Meta connection</a>
       <div className="am-divider"/>
       <strong>Disconnect and delete imported data</strong>
       <p className="ad-muted">Use the Meta Ads connection page to remove the encrypted Meta token, imported creatives, and related campaigns. This action is destructive.</p>
       <a href="/app/meta" className="am-text-link">Open Meta connection and data controls</a>
      </s-section>
    </div>
    <aside className="am-side-column">
     <s-section><SectionHead title="Current configuration"/>
      <div className="am-detail-row"><span>Auto-publish</span><State text={d.settings?.autoPublish?"On":"Off"} kind={d.settings?.autoPublish?"info":"neutral"}/></div>
      <div className="am-detail-row"><span>Theme confirmation</span><State text={d.settings?.themeConfirmedAt?"Yes":"Pending"} kind={d.settings?.themeConfirmedAt?"success":"warning"}/></div>
      <div className="am-detail-row"><span>Shop</span><strong className="am-break">{d.shop}</strong></div>
     </s-section>
     <s-section><SectionHead title="Legal & support"/>
       <p><a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a></p>
       <p><a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a></p>
       <p><a href="/data-deletion" target="_blank" rel="noopener noreferrer">Data Deletion Instructions</a></p>
       <p><a href="mailto:hello@afterwin.co">Contact support</a></p>
     </s-section>
    </aside>
   </div>
  </div>
 </s-page>;
}
