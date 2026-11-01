import {Prisma} from "@prisma/client";
import {useMemo,useState} from "react";
import type {ActionFunctionArgs,LoaderFunctionArgs} from "react-router";
import {Form,Link,useActionData,useFetcher,useLoaderData,useNavigation} from "react-router";
import prisma from "../db.server";
import {authenticate} from "../shopify.server";
import {listProducts,getProduct} from "../services/products.server";
import {generateExperience,generateVisualDirection} from "../services/ai.server";
import {generateCampaignBackdrop} from "../services/image-generation.server";
import {experimentReport} from "../services/experiment.server";
import {ExperiencePreview,ExperienceEditor} from "../components/experience-preview";
import {variantSchema} from "../lib/variant";
import {experienceSchema,visualDirectionSchema,campaignContentSchema,hasValidCampaignContent,isExperience,resolveVisualDirection} from "../lib/experience";
import {metaCreativeCopy} from "../services/meta.server";
import {PageIntro,Stat,State,SectionHead,Empty} from "../components/dashboard";
import {selectPreviewContent,groupByImportedAd} from "../lib/campaign-preview";

export const loader=async({request}:LoaderFunctionArgs)=>{
 // Do not load Shopify products on page entry. Admin GraphQL can require session
 // refresh, and an API-level 200 Response must not blank the entire campaign UI.
 console.info("[AdMorph campaigns] loader entered");
 const {session}=await authenticate.admin(request);
 const [ads,campaigns,experiments,images]=await Promise.all([
  prisma.metaAd.findMany({where:{shop:session.shop},orderBy:{updatedAt:"desc"},take:200}),
  prisma.campaign.findMany({where:{shop:session.shop},orderBy:{updatedAt:"desc"},take:200}),
  prisma.campaignExperiment.findMany({where:{shop:session.shop},select:{campaignId:true,enabled:true}}),
  prisma.campaignImage.findMany({where:{shop:session.shop},select:{campaignId:true}})
 ]);
 console.info("[AdMorph campaigns] loader complete",{ads:ads.length,campaigns:campaigns.length});
 const experimentResults=await experimentReport(session.shop,campaigns.map(c=>c.id));
 return {
   shop:session.shop,
   ads:ads.map(ad=>({id:ad.adId,name:ad.name,status:ad.status,creative:metaCreativeCopy(ad.creative)})),
   campaigns,experiments,images,experimentResults
 };
};

export const action=async({request}:ActionFunctionArgs)=>{
 const {admin,session}=await authenticate.admin(request);
 const data=await request.formData(),intent=String(data.get("intent")||"");
 const shop=session.shop;
 try {
  if(intent==="preview_product"){
    const id=String(data.get("id")||"");
    const campaign=await prisma.campaign.findFirst({where:{id,shop},select:{id:true,productId:true}});
    if(!campaign)throw new Error("Campaign not found.");
    const product=await getProduct(admin,campaign.productId);
    return {ok:true,message:"Shopify product image loaded.",campaignId:id,productVisual:product.featuredImage};
  }
  if(intent==="generate_backdrop"){
    const id=String(data.get("id")||"");
    const campaign=await prisma.campaign.findFirst({where:{id,shop}});
    if(!campaign)throw new Error("Campaign not found");
    const experience=experienceSchema.safeParse(campaign.draftContent||campaign.content);
    if(!experience.success)throw new Error("Generate an Experience 2.0 first");
    const ad=await prisma.metaAd.findUnique({where:{shop_adId:{shop,adId:campaign.metaAdId}}});
    if(!ad)throw new Error("Meta ad not found");
    const product=await getProduct(admin,campaign.productId);
    const visual=resolveVisualDirection(experience.data);
    const bytes=await generateCampaignBackdrop({
      product,adCreative:ad.creative,angle:experience.data.angle,
      palette:visual.palette,mood:visual.mood
    });
    await prisma.campaignImage.upsert({
      where:{campaignId:id},create:{campaignId:id,shop,draftData:new Uint8Array(bytes)},
      update:{draftData:new Uint8Array(bytes)}
    });
    return {ok:true,message:"AI lifestyle scene generated as a draft. Preview the composition and approve it before publishing.",campaignId:id};
  }
  if(intent==="preview_backdrop"){
    const id=String(data.get("id")||"");
    const campaign=await prisma.campaign.findFirst({where:{id,shop},select:{id:true}});
    if(!campaign)throw new Error("Campaign not found");
    const image=await prisma.campaignImage.findUnique({where:{campaignId:id}});
    return {ok:true,message:"Visual assets loaded",campaignId:id,
      draftImage:image?.draftData?"data:image/webp;base64,"+Buffer.from(image.draftData).toString("base64"):null,
      publishedImage:image?.publishedData?"data:image/webp;base64,"+Buffer.from(image.publishedData).toString("base64"):null};
  }
  if(["approve_backdrop","discard_backdrop","remove_live_backdrop"].includes(intent)){
    const id=String(data.get("id")||"");
    const campaign=await prisma.campaign.findFirst({where:{id,shop}});
    if(!campaign)throw new Error("Campaign not found");
    if(intent==="approve_backdrop"){
      if(campaign.status!=="PUBLISHED")throw new Error("Publish the campaign copy before approving visual artwork.");
      const image=await prisma.campaignImage.findFirst({where:{campaignId:id,shop}});
      if(!image?.draftData)throw new Error("No pending AI image to approve");
      await prisma.campaignImage.update({where:{campaignId:id},data:{
        publishedData:image.draftData,draftData:null
      }});
      return {ok:true,message:"AI lifestyle scene published. The real Shopify product image remains the foreground product."};
    }
    await prisma.campaignImage.updateMany({where:{campaignId:id,shop},data:
      intent==="discard_backdrop"?{draftData:null}:{publishedData:null}});
    return {ok:true,message:intent==="discard_backdrop"?"AI draft discarded.":"Published AI image removed."};
  }
  if(intent==="set_experiment"){
    const id=String(data.get("id")||"");
    const campaign=await prisma.campaign.findFirst({where:{id,shop}});
    if(!campaign)throw new Error("Campaign not found");
    const enabled=data.get("enabled")==="true";
    if(enabled&&campaign.status!=="PUBLISHED")throw new Error("Publish the campaign before starting its experiment.");
    await prisma.campaignExperiment.upsert({
      where:{campaignId:id},create:{campaignId:id,shop,enabled},update:{enabled}
    });
    return {ok:true,message:enabled?"A/B experiment enabled. 50/50 allocation applies to analytics-consenting visitors.":"A/B experiment stopped. AdMorph experience resumes for all eligible visitors."};
  }
  if(intent==="activate_pixel"){
    const response=await admin.graphql(`#graphql
      mutation InstallAdMorphPixel($settings:JSON!){
       webPixelCreate(webPixel:{settings:$settings}){
        webPixel{id}
        userErrors{code message}
       }
      }`,{variables:{settings:JSON.stringify({shop})}});
    const result:any=await response.json();
    if(result.errors)throw new Error(result.errors.map((x:{message:string})=>x.message).join("; "));
    const mutation=result.data?.webPixelCreate;
    if(mutation?.userErrors?.length)throw new Error(mutation.userErrors.map((x:{message:string})=>x.message).join("; "));
    if(!mutation?.webPixel?.id)throw new Error("Shopify Pixel was not created");
    return {ok:true,message:"Shopify Web Pixel connected. Add-to-cart and completed checkout events are now eligible for consent-based attribution."};
  }
  if(intent==="load_products"){
    const products=await listProducts(admin);
    return {ok:true,message:products.length+" active Shopify products loaded.",products};
  }
  if(intent==="create"){
    const adId=String(data.get("adId")||""),productId=String(data.get("productId")||"");
    const ad=await prisma.metaAd.findUnique({where:{shop_adId:{shop,adId}}});
    if(!ad)throw new Error("Ad was not imported for this store.");
    const product=await getProduct(admin,productId);
    await prisma.campaign.upsert({
      where:{shop_metaAdId_productId:{shop,metaAdId:adId,productId}},
      create:{shop,metaAdId:adId,productId,productHandle:product.handle,productTitle:product.title},
      update:{productHandle:product.handle,productTitle:product.title}
    });
    return {ok:true,message:"Campaign created. Generate its draft next."};
  }
  if(["bulk_publish","bulk_unpublish","bulk_delete"].includes(intent)){
    const ids=data.getAll("ids").map(String).filter(id=>/^[a-z0-9]{8,40}$/i.test(id)).slice(0,100);
    if(ids.length===0)throw new Error("Select at least one campaign.");
    if(intent==="bulk_delete"&&data.get("confirmDelete")!=="yes")
      throw new Error("Deletion was not confirmed.");
    // All mutations are scoped to the authenticated Shopify tenant.
    const records=await prisma.campaign.findMany({where:{shop,id:{in:ids}},
      select:{id:true,content:true,draftContent:true,status:true}});
    if(intent==="bulk_delete"){
      const result=await prisma.campaign.deleteMany({where:{shop,id:{in:records.map(r=>r.id)}}});
      return {ok:true,message:`Deleted ${result.count} campaign(s).`};
    }
    if(intent==="bulk_publish"){
      const valid=records.filter(c=>(c.status==="DRAFT"||Boolean(c.draftContent))&&hasValidCampaignContent(selectPreviewContent(c)));
      await prisma.$transaction(valid.map(c=>prisma.campaign.update({
        where:{id:c.id},data:{
          status:"PUBLISHED",
          content:campaignContentSchema.parse(selectPreviewContent(c)),
          draftContent:Prisma.DbNull
        }
      })));
      return {ok:true,message:`Approved ${valid.length} valid experience(s). Missing or invalid drafts were skipped.`};
    }
    const valid=records.filter(c=>c.status==="PUBLISHED").map(c=>c.id);
    const result=await prisma.campaign.updateMany({where:{shop,id:{in:valid}},data:{status:"DRAFT"}});
    return {ok:true,message:`Unpublished ${result.count} campaign(s).`};
  }
  if(intent==="save"){
    const id=String(data.get("id")||"");
    const campaign=await prisma.campaign.findFirst({where:{id,shop}});
    if(!campaign)throw new Error("Campaign not found.");
    const proposed={
      headline:String(data.get("headline")||""),
      subheadline:String(data.get("subheadline")||""),
      benefits:[String(data.get("benefit1")||""),String(data.get("benefit2")||""),String(data.get("benefit3")||"")],
      cta:String(data.get("cta")||"")
    };
    const parsed=variantSchema.safeParse(proposed);
    if(!parsed.success)throw new Error("Invalid copy length or missing required fields.");
    if(campaign.status==="PUBLISHED"){
      await prisma.campaign.update({where:{id},data:{draftContent:parsed.data}});
      return {ok:true,message:"Edits saved for review. The published storefront experience is unchanged."};
    }
    await prisma.campaign.update({where:{id},data:{content:parsed.data,draftContent:Prisma.DbNull,status:"DRAFT"}});
    return {ok:true,message:"Changes saved as draft. Review before publishing."};
  }
  if(intent==="save_experience"){
    const id=String(data.get("id")||"");
    const campaign=await prisma.campaign.findFirst({where:{id,shop}});
    if(!campaign)throw new Error("Campaign not found.");
    const base=experienceSchema.safeParse(campaign.draftContent||campaign.content);
    if(!base.success)throw new Error("Generate a 2.0 experience first.");
    const string=(key:string)=>String(data.get(key)||"").trim();
    const edited={
      ...base.data,
      angle:string("angle"),
      layout:string("layout"),
      visual:{
        composition:string("visualComposition"),
        palette:string("visualPalette"),
        imageFit:string("visualImageFit"),
        mood:string("visualMood"),
        rationale:string("visualRationale")
      },
      hero:{eyebrow:string("eyebrow"),headline:string("headline"),subheadline:string("subheadline")},
      highlights:base.data.highlights.map((_,i)=>({title:string("highlight"+i+"Title"),text:string("highlight"+i+"Text")})),
      styleMoments:base.data.styleMoments.map((_,i)=>({label:string("moment"+i+"Label"),title:string("moment"+i+"Title"),text:string("moment"+i+"Text")})),
      adConnection:{title:string("connectionTitle"),text:string("connectionText")},
      cta:{primary:string("ctaPrimary"),secondary:string("ctaSecondary")}
    };
    const parsed=experienceSchema.safeParse(edited);
    if(!parsed.success)throw new Error("Invalid experience: check the required text and limits.");
    if(campaign.status==="PUBLISHED"){
      await prisma.campaign.update({where:{id},data:{draftContent:parsed.data}});
      return {ok:true,message:"Experience 2.0 saved for approval. Live content stays unchanged."};
    }
    await prisma.campaign.update({where:{id},data:{content:parsed.data,status:"DRAFT",draftContent:Prisma.DbNull}});
    return {ok:true,message:"Experience 2.0 draft saved."};
  }
  if(intent==="generate_visual"){
    const id=String(data.get("id")||"");
    const campaign=await prisma.campaign.findFirst({where:{id,shop}});
    if(!campaign)throw new Error("Campaign not found.");
    const existing=experienceSchema.safeParse(campaign.draftContent||campaign.content);
    if(!existing.success)throw new Error("Generate Experience 2.0 first.");
    const ad=await prisma.metaAd.findUnique({where:{shop_adId:{shop,adId:campaign.metaAdId}}});
    if(!ad)throw new Error("Meta ad missing. Re-import the ad before generating visual direction.");
    const product=await getProduct(admin,campaign.productId);
    const visual=await generateVisualDirection({product,adCreative:ad.creative,experience:existing.data});
    const updated=experienceSchema.parse({...existing.data,visual});
    if(campaign.status==="PUBLISHED"){
      await prisma.campaign.update({where:{id:campaign.id},data:{draftContent:updated}});
      return {ok:true,message:"AI visual direction generated as pending draft. The published storefront is unchanged."};
    }
    await prisma.campaign.update({where:{id:campaign.id},data:{content:updated,draftContent:Prisma.DbNull,status:"DRAFT"}});
    return {ok:true,message:"AI visual direction generated. Review and approve before publishing."};
  }
  if(intent==="discard_draft"){
    const id=String(data.get("id")||"");
    await prisma.campaign.updateMany({where:{id,shop,status:"PUBLISHED"},data:{draftContent:Prisma.DbNull}});
    return {ok:true,message:"Pending changes discarded. Published content was not changed."};
  }
  if(["generate","publish","unpublish"].includes(intent)){
    const id=String(data.get("id")||"");
    const campaign=await prisma.campaign.findFirst({where:{id,shop}});
    if(!campaign)throw new Error("Campaign not found.");
    if(intent==="generate"){
      const ad=await prisma.metaAd.findUnique({where:{shop_adId:{shop,adId:campaign.metaAdId}}});
      if(!ad)throw new Error("Meta ad missing. Re-import ads.");
      const product=await getProduct(admin,campaign.productId);
      const content=await generateExperience({product,adCreative:ad.creative});
      if(campaign.status==="PUBLISHED"){
        await prisma.campaign.update({where:{id},data:{
          productHandle:product.handle,productTitle:product.title,draftContent:content
        }});
        return {ok:true,message:"New AI Experience 2.0 staged. Existing published content remains live until you approve."};
      }
      await prisma.campaign.update({where:{id},data:{
        productHandle:product.handle,productTitle:product.title,content,draftContent:Prisma.DbNull,status:"DRAFT"
      }});
      return {ok:true,message:"Experience 2.0 generated. Preview and approve before publishing."};
    }
    if(intent==="publish"){
      const nextContent=campaign.draftContent||campaign.content;
      if(!hasValidCampaignContent(nextContent))
        throw new Error("Generate a valid experience before publishing.");
      await prisma.campaign.update({where:{id},data:{
        status:"PUBLISHED",content:campaignContentSchema.parse(nextContent),draftContent:Prisma.DbNull
      }});
      return {ok:true,message:"Approved experience published."};
    }
    await prisma.campaign.update({where:{id},data:{status:"DRAFT"}});
    return {ok:true,message:"Experience unpublished."};
  }
  return {ok:false,message:"Unsupported action."};
 }catch(e){
   console.error("[AdMorph campaigns] operation failed",e);
   // Never expose raw Zod issue objects or API stack traces in merchant-facing UI.
   if(e instanceof Error && e.name==="ZodError"){
      return {ok:false,message:"The AI generated text that was too long. Please retry. Your live campaign was not changed."};
   }
   return {ok:false,message:e instanceof Error?e.message:"This action could not be completed. Please try again."};
 }
};


type CampaignTab="all"|"live"|"review";
export default function Campaigns(){
 const d=useLoaderData<typeof loader>();
 const navigation=useNavigation();
 const runningIntent=navigation.state!=="idle"?navigation.formData?.get("intent"):null;
 const generatingVisual=runningIntent==="generate_backdrop";
 const feedback=useActionData<typeof action>();
 const catalog=useFetcher<typeof action>();
 const productPreview=useFetcher<typeof action>();
 const artwork=useFetcher<typeof action>();
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [search,setSearch]=useState("");
 const [tab,setTab]=useState<CampaignTab>("all");
 const [mappingAd,setMappingAd]=useState("");
 const [selectedBulk,setSelectedBulk]=useState<string[]>([]);
 const products=(catalog.data&&"products" in catalog.data&&Array.isArray(catalog.data.products))?catalog.data.products:[];
 const selected=d.campaigns.find(c=>c.id===selectedId);
 const selectedAI=campaignContentSchema.safeParse(selected?selectPreviewContent(selected):null);
 const liveAI=campaignContentSchema.safeParse(selected?.content);
 const originalAd=selected?d.ads.find(a=>a.id===selected.metaAdId):undefined;
 const otherAds=useMemo(()=>groupByImportedAd(d.ads,d.campaigns).filter(a=>a.linked.length===0),[d.ads,d.campaigns]);
 const liveCount=d.campaigns.filter(c=>c.status==="PUBLISHED").length;
 const reviewCount=d.campaigns.filter(c=>(c.status!=="PUBLISHED"||Boolean(c.draftContent))&&hasValidCampaignContent(selectPreviewContent(c))).length;
 const cards=useMemo(()=>d.campaigns.filter(c=>{
   const text=(c.productTitle+" "+c.metaAdId+" "+(d.ads.find(a=>a.id===c.metaAdId)?.name||"")).toLowerCase();
   const matches=text.includes(search.trim().toLowerCase());
   if(tab==="live"&&c.status!=="PUBLISHED")return false;
   if(tab==="review"&&(c.status==="PUBLISHED"&&!c.draftContent))return false;
   return matches;
 }),[d.campaigns,d.ads,search,tab]);
 const linkedImage=productPreview.data&&"campaignId" in productPreview.data&&productPreview.data.campaignId===selectedId&&
   "productVisual" in productPreview.data?productPreview.data.productVisual?.url:undefined;
 const artworkData=artwork.data&&"campaignId" in artwork.data&&artwork.data.campaignId===selectedId?artwork.data:null;
 const report=selected?d.experimentResults[selected.id]:undefined;
 const experimentOn=Boolean(selected&&d.experiments.find(e=>e.campaignId===selected.id)?.enabled);
 function openCampaign(id:string){
   if(selectedId===id){setSelectedId(null);return;}
   setSelectedId(id);
   productPreview.submit({intent:"preview_product",id},{method:"post"});
   artwork.submit({intent:"preview_backdrop",id},{method:"post"});
 }
 function selectBulk(id:string,checked:boolean){
  setSelectedBulk(prev=>checked?[...new Set([...prev,id])]:prev.filter(x=>x!==id));
 }
 function confirmBulk(event:React.FormEvent<HTMLFormElement>){
   const clicked=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
   if(clicked?.value==="bulk_delete"&&!window.confirm("Permanently delete selected campaigns?"))event.preventDefault();
 }
 const publicLink=selected?"https://"+d.shop+"/products/"+encodeURIComponent(selected.productHandle)+"?admorph_ad="+encodeURIComponent(selected.metaAdId):"";
 return <s-page heading="AI Campaigns">
   <s-button slot="primary-action" href="/app/autopilot" variant="primary">Import Meta ads</s-button>
   <div className="am-container am-simple-workspace">
     <PageIntro eyebrow="ADMORPH CONTENT STUDIO" title="Your AI product pages"
       description="Build a visual campaign experience that matches each Meta ad. Approve the content and AI lifestyle scene before publishing."/>
     {feedback&&<s-banner tone={feedback.ok?"success":"critical"}>{feedback.message}</s-banner>}
     {navigation.state!=="idle"&&<div role="status" aria-live="polite" className="am-ai-generating">
       <span className="am-ai-spinner" aria-hidden="true"/>
       <div><strong>{generatingVisual?"Creating your cinematic AI scene…":runningIntent==="generate"?"Creating your ad-matched product experience…":"Applying your campaign changes…"}</strong>
       <p>{generatingVisual?"Generating a photographic environment matched to the ad. The original Shopify product remains untouched.": "The storefront remains unchanged until you approve and publish."}</p></div>
     </div>}

     <div className="am-simple-steps" aria-label="How AdMorph works">
       <div><span>1</span><strong>Connect an ad</strong><small>Find its Shopify product</small></div>
       <div><span>2</span><strong>AI builds the page</strong><small>Preview the result</small></div>
       <div><span>3</span><strong>You approve</strong><small>Only then does it go live</small></div>
     </div>
     <div className="am-simple-summary">
       <div><strong>{d.campaigns.length}</strong><span>Matched product campaigns</span></div>
       <div><strong>{liveCount}</strong><span>Published on your store</span></div>
       <div><strong>{reviewCount}</strong><span>Waiting for your review</span></div>
     </div>
     <s-section>
       <div className="am-simple-section-heading">
         <div><span className="am-simple-step-label">STEP 1</span><h2>Choose a campaign</h2>
         <p>Each card connects one Meta advertisement to a Shopify product.</p></div>
       </div>
       <div className="am-simple-controls">
         <input className="ad-input" aria-label="Search campaigns" placeholder="Search ad or Shopify product..." value={search} onChange={e=>setSearch(e.target.value)}/>
         <div className="am-simple-filters">
           {([{id:"all",label:"All"},{id:"live",label:"Published"},{id:"review",label:"Needs review"}] as const).map(item=>
             <button key={item.id} type="button" aria-pressed={tab===item.id} className={tab===item.id?"active":""} onClick={()=>setTab(item.id)}>{item.label}</button>)}
         </div>
       </div>
       {d.campaigns.length===0?<Empty title="No product campaigns yet" description="Import Meta ads and connect each relevant ad to its Shopify product." href="/app/autopilot" label="Import Meta ads"/>:
        <div className="am-simple-cards">
         {cards.map(c=>{
           const copy=hasValidCampaignContent(selectPreviewContent(c));
           const ad=d.ads.find(a=>a.id===c.metaAdId);
           const state=c.draftContent?"Review update":c.status==="PUBLISHED"?"Published":copy?"Ready to review":"Generate AI page";
           return <button type="button" key={c.id} onClick={()=>openCampaign(c.id)} aria-expanded={selectedId===c.id}
             className={"am-simple-campaign-card"+(selectedId===c.id?" selected":"")}>
             <div className="am-simple-card-main">
               <small>Meta ad: {ad?.name||c.metaAdId}</small>
               <strong>{c.productTitle}</strong>
               <span>{copy?"AI page created":"AI page not created yet"}</span>
             </div>
             <div className="am-simple-card-side">
               <State text={state} kind={c.draftContent||c.status!=="PUBLISHED"?"warning":"success"}/>
               <span className="am-simple-view">{selectedId===c.id?"Close preview":"See AI page"}</span>
             </div>
            </button>;
         })}
         {!cards.length&&<p className="ad-muted">No campaigns match this filter. Select All to see everything.</p>}
        </div>}
     </s-section>
     {selected&&<s-section>
       <div className="am-simple-section-heading">
         <div><span className="am-simple-step-label">STEP 2</span><h2>{selectedAI.success?"See what AI created":"Create the AI page"}</h2>
           <p>{selected.productTitle} · {originalAd?.name||"Meta ad "+selected.metaAdId}</p></div>
         <button className="am-simple-close" type="button" onClick={()=>setSelectedId(null)}>Close</button>
       </div>
       {selected.draftContent?<div className="am-simple-notice">
        <strong>New version ready for review.</strong>
        <span>Your existing published page stays unchanged until you approve this update.</span>
       </div>:selected.status==="PUBLISHED"?<div className="am-simple-notice live">
        <strong>This AI page is published.</strong>
        <span>Visitors see it when arriving through the matching Meta ad URL.</span>
       </div>:<div className="am-simple-notice">
        <strong>{selectedAI.success?"This AI page is not live yet.":"No AI page exists yet."}</strong>
        <span>{selectedAI.success?"Review it below, then publish.":"Use the button below to generate the first version."}</span>
       </div>}
       <div className="am-simple-primary-actions">
         <Form method="post"><input type="hidden" name="intent" value="generate"/><input type="hidden" name="id" value={selected.id}/>
           <button className={selectedAI.success?"ad-btn ghost":"ad-btn"} type="submit">
             {selectedAI.success?"Regenerate AI page":"Generate AI page"}
           </button>
         </Form>
         {selectedAI.success&&(selected.status!=="PUBLISHED"||Boolean(selected.draftContent))&&
          <Form method="post"><input type="hidden" name="intent" value="publish"/><input type="hidden" name="id" value={selected.id}/>
           <button className="ad-btn" type="submit">Approve & publish</button>
          </Form>}
         {selected.status==="PUBLISHED"&&<a href={publicLink} target="_blank" rel="noopener noreferrer" className="ad-btn ghost">
          View live Shopify page
         </a>}
       </div>
       {selectedAI.success&&isExperience(selectedAI.data)&&<>
         <p className="am-simple-preview-label">PREVIEW — WHAT THE VISITOR WILL SEE</p>
         <ExperiencePreview content={selectedAI.data} productImageUrl={linkedImage} productImageAlt={selected.productTitle}/>
         <p className="am-simple-caption">The hero combines your approved AI environment with the genuine Shopify product photo. The actual theme layout is shown on your live preview URL after publishing.</p>
       </>}
       {selectedAI.success&&!isExperience(selectedAI.data)&&<div className="ad-preview">
          <h3>{selectedAI.data.headline}</h3><p>{selectedAI.data.subheadline}</p>
          <ul>{selectedAI.data.benefits.map((benefit,i)=><li key={i}>{benefit}</li>)}</ul>
          <small>Shopping button text: {selectedAI.data.cta}</small>
       </div>}
       {selected.draftContent&&liveAI.success&&<details className="am-simple-accordion">
        <summary>Compare with the version currently published</summary>
        <div className="am-simple-accordion-body">
         {isExperience(liveAI.data)?<ExperiencePreview content={liveAI.data} productImageUrl={linkedImage} productImageAlt={selected.productTitle}/>:
          <div className="ad-preview"><h3>{liveAI.data.headline}</h3><p>{liveAI.data.subheadline}</p>
           <ul>{liveAI.data.benefits.map((x,i)=><li key={i}>{x}</li>)}</ul></div>}
        </div>
       </details>}
       {selectedAI.success&&<details className="am-simple-accordion">
        <summary>Edit text, colors and design (optional)</summary>
        <div className="am-simple-accordion-body">
         <p className="ad-muted">These controls are optional. Your changes are saved as a draft and do not immediately replace the live page.</p>
         {isExperience(selectedAI.data)?<ExperienceEditor id={selected.id} content={selectedAI.data}/>:
          <Form method="post" className="am-edit-fields">
           <input type="hidden" name="intent" value="save"/><input type="hidden" name="id" value={selected.id}/>
           <label>Headline<input className="ad-input" name="headline" required defaultValue={selectedAI.data.headline}/></label>
           <label>Subheadline<textarea className="ad-input" name="subheadline" required defaultValue={selectedAI.data.subheadline}/></label>
           {selectedAI.data.benefits.map((x,i)=><label key={i}>Benefit {i+1}
             <input name={"benefit"+(i+1)} className="ad-input" required defaultValue={x}/></label>)}
           <label>Button text<input className="ad-input" name="cta" required defaultValue={selectedAI.data.cta}/></label>
           <button className="ad-btn" type="submit">Save draft</button>
          </Form>}
        </div>
       </details>}
       {selectedAI.success&&isExperience(selectedAI.data)&&<details className="am-simple-accordion">
        <summary>AI Visual Studio — cinematic campaign scenes</summary>
        <div className="am-simple-accordion-body">
         <p className="ad-muted">Generate a distinct photographic lifestyle environment for this Meta ad. AdMorph places the genuine Shopify product photo above the scene. Your customer always sees the original product; no AI-generated product claims.</p>
         <div className="am-simple-primary-actions">
          <Form method="post"><input type="hidden" name="intent" value="generate_visual"/><input type="hidden" name="id" value={selected.id}/>
           <button type="submit" className="ad-btn ghost">AI suggest a new design</button></Form>
          <Form method="post"><input type="hidden" name="intent" value="generate_backdrop"/><input type="hidden" name="id" value={selected.id}/>
           <button type="submit" className="ad-btn ghost" disabled={navigation.state!=="idle"}>{generatingVisual?"Generating scene…":"Generate WOW visual scene"}</button></Form>
          <artwork.Form method="post"><input type="hidden" name="intent" value="preview_backdrop"/><input type="hidden" name="id" value={selected.id}/>
           <button type="submit" className="ad-btn ghost" disabled={artwork.state!=="idle"}>Refresh image preview</button></artwork.Form>
         </div>
         {artworkData&&"draftImage" in artworkData&&artworkData.draftImage&&<div className="am-simple-art">
            <div className="am-ai-scene-preview"><img className="am-ai-scene-bg" src={artworkData.draftImage} alt="Draft AI lifestyle environment"/>{linkedImage&&<img className="am-ai-scene-product" src={linkedImage} alt={selected.productTitle}/>}<span>AI environment + real Shopify product</span></div>
            <strong>Draft image — not published</strong>
           </div>}
         {artworkData&&"publishedImage" in artworkData&&artworkData.publishedImage&&<div className="am-simple-art">
            <div className="am-ai-scene-preview"><img className="am-ai-scene-bg" src={artworkData.publishedImage} alt="Published AI lifestyle environment"/>{linkedImage&&<img className="am-ai-scene-product" src={linkedImage} alt={selected.productTitle}/>}<span>Live campaign composition</span></div>
            <strong>Published campaign environment</strong>
           </div>}
         <div className="am-simple-primary-actions">
          <Form method="post"><input type="hidden" name="intent" value="approve_backdrop"/><input type="hidden" name="id" value={selected.id}/>
           <button type="submit" disabled={selected.status!=="PUBLISHED"} className="ad-btn">Approve AI image</button></Form>
          <Form method="post"><input type="hidden" name="intent" value="discard_backdrop"/><input type="hidden" name="id" value={selected.id}/>
           <button type="submit" className="ad-btn ghost">Discard draft image</button></Form>
          <Form method="post"><input type="hidden" name="intent" value="remove_live_backdrop"/><input type="hidden" name="id" value={selected.id}/>
           <button type="submit" className="ad-btn ghost">Remove published image</button></Form>
         </div>
        </div>
       </details>}
       <details className="am-simple-accordion">
        <summary>Compare performance with A/B testing (advanced)</summary>
        <div className="am-simple-accordion-body">
         <p className="ad-muted">A shows the normal Shopify page. B shows the AdMorph AI experience. Tracking needs the Shopify Web Pixel and visitor analytics consent. Results count recorded events, not verified unique customers or revenue.</p>
         <div className="am-simple-results">
          {(["A","B"] as const).map(arm=>{
           const counts=report?.[arm]||{},views=counts.view||0,carts=counts.cart||0,purchases=counts.purchase||0;
           return <div key={arm}><strong>{arm==="A"?"A — Original Shopify page":"B — AdMorph AI page"}</strong>
             <p>{views} views · {counts.cta||0} CTA clicks</p><p>{carts} add-to-cart events · {purchases} completed checkout events</p>
             <span>Observed checkout event rate: {views?(100*purchases/views).toFixed(1)+"%":"Not enough data"}</span>
            </div>;
          })}
         </div>
         <Form method="post">
           <input type="hidden" name="intent" value="set_experiment"/><input type="hidden" name="id" value={selected.id}/>
           <input type="hidden" name="enabled" value={experimentOn?"false":"true"}/>
           <button className="ad-btn ghost" disabled={selected.status!=="PUBLISHED"} type="submit">
            {experimentOn?"Stop A/B test":"Start 50/50 A/B test"}
           </button>
         </Form>
         <p className="ad-muted">Before starting, connect the Shopify Web Pixel under Advanced setup at the bottom of this page.</p>
        </div>
       </details>
       <details className="am-simple-accordion">
        <summary>Original Meta ad and campaign controls</summary>
        <div className="am-simple-accordion-body">
         {originalAd?<div className="am-ad-creative-comparison">
           {originalAd.creative.imageUrl.startsWith("https://")&&<img src={originalAd.creative.imageUrl} loading="lazy" alt="Original Meta advertisement artwork"/>}
           <div><strong>{originalAd.name}</strong><p>{originalAd.creative.headline}</p><p>{originalAd.creative.body}</p></div>
         </div>:<p className="ad-muted">The original ad is not currently in the saved Meta import.</p>}
         <p className="ad-muted">Meta ad ID: {selected.metaAdId} · Shopify handle: {selected.productHandle}</p>
         <div className="am-simple-primary-actions">
          {selected.draftContent&&<Form method="post"><input type="hidden" name="intent" value="discard_draft"/><input type="hidden" name="id" value={selected.id}/>
           <button className="ad-btn ghost" type="submit">Discard pending changes</button></Form>}
          {selected.status==="PUBLISHED"&&<Form method="post"><input type="hidden" name="intent" value="unpublish"/><input type="hidden" name="id" value={selected.id}/>
           <button className="ad-btn ghost" type="submit">Unpublish AI page</button></Form>}
         </div>
        </div>
       </details>
     </s-section>}
     <s-section>
      <div className="am-simple-section-heading"><div><span className="am-simple-step-label">STEP 3 — ONLY IF NEEDED</span>
       <h2>Other Meta advertisements</h2>
       <p>{otherAds.length} imported ads do not have a connected Shopify product. This is normal for ads promoting other websites, collections or several products.</p>
      </div></div>
      <details className="am-simple-accordion">
       <summary>Show other Meta ads and connect a Shopify product ({otherAds.length})</summary>
       <div className="am-simple-accordion-body">
        <p className="ad-muted">Only connect an advertisement if it really promotes this Shopify product. Ads without an applicable product do not need any action.</p>
        {otherAds.length>0&&<div className="am-simple-other-ads">{otherAds.map(ad=>
         <button key={ad.id} type="button" className={mappingAd===ad.id?"active":""} onClick={()=>setMappingAd(ad.id)}>
          <strong>{ad.name||ad.id}</strong><small>{ad.status} · {ad.creative.headline||"No ad headline"}</small>
         </button>)}</div>}
        <catalog.Form method="post"><input type="hidden" name="intent" value="load_products"/>
          <button type="submit" className="ad-btn ghost" disabled={catalog.state!=="idle"}>
           {catalog.state==="idle"?"Load Shopify products":"Loading products..."}</button>
        </catalog.Form>
        <Form method="post" className="am-simple-map-form">
          <input type="hidden" name="intent" value="create"/>
          <label>Meta advertisement
           <select className="ad-input" name="adId" required value={mappingAd} onChange={e=>setMappingAd(e.target.value)}>
            <option value="">Select an ad</option>
            {d.ads.map(ad=><option value={ad.id} key={ad.id}>{ad.name||ad.id}</option>)}
           </select></label>
          <label>Actual Shopify product
           <select className="ad-input" name="productId" required disabled={!products.length}>
            <option value="">Select a product</option>
            {products.map((p:{id:string;title:string})=><option key={p.id} value={p.id}>{p.title}</option>)}
           </select></label>
          <button className="ad-btn" type="submit" disabled={!mappingAd||!products.length}>Connect ad to product</button>
        </Form>
       </div>
      </details>
     </s-section>
     <details className="am-simple-advanced">
      <summary>Advanced setup and bulk campaign actions</summary>
      <div className="am-simple-advanced-body">
       <h3>Conversion tracking setup</h3>
       <p className="ad-muted">Shopify Web Pixel must be released with the required permissions. Connect it once per store to measure consent-based experiment events.</p>
       <Form method="post"><input type="hidden" name="intent" value="activate_pixel"/>
        <button className="ad-btn ghost" type="submit">Connect Shopify Web Pixel</button></Form>
       <h3>Manage multiple campaigns</h3>
       <p className="ad-muted">These actions change several campaigns at once. Individual review is safer for AI-generated content.</p>
       <div className="am-simple-bulk-list">{d.campaigns.map(c=>
        <label key={c.id}><input type="checkbox" checked={selectedBulk.includes(c.id)} onChange={e=>selectBulk(c.id,e.target.checked)}/>
        {c.productTitle} <small>({d.ads.find(a=>a.id===c.metaAdId)?.name||c.metaAdId})</small></label>)}</div>
       <Form method="post" onSubmit={confirmBulk} className="am-simple-primary-actions">
        <input type="hidden" name="confirmDelete" value="yes"/>
        {selectedBulk.map(id=><input type="hidden" name="ids" value={id} key={id}/>)}
        <button type="submit" className="ad-btn ghost" name="intent" value="bulk_publish" disabled={!selectedBulk.length}>Publish selected drafts</button>
        <button type="submit" className="ad-btn ghost" name="intent" value="bulk_unpublish" disabled={!selectedBulk.length}>Unpublish selected</button>
        <button type="submit" className="ad-btn am-danger" name="intent" value="bulk_delete" disabled={!selectedBulk.length}>Delete selected</button>
       </Form>
      </div>
     </details>
   </div>
 </s-page>;
}
