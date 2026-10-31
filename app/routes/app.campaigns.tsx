import {Prisma} from "@prisma/client";
import {useMemo,useState} from "react";
import type {ActionFunctionArgs,LoaderFunctionArgs} from "react-router";
import {Form,Link,useActionData,useFetcher,useLoaderData} from "react-router";
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
    return {ok:true,message:"AI background generated as a draft. Review the image before approving it.",campaignId:id};
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
      return {ok:true,message:"AI background approved and published. The original product photograph stays unchanged."};
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

type Filter="all"|"review"|"published"|"generate";
export default function Campaigns(){
 const d=useLoaderData<typeof loader>(),a=useActionData<typeof action>();
 const catalog=useFetcher<typeof action>();
 const visual=useFetcher<typeof action>();
 const backdrop=useFetcher<typeof action>();
 const products=(catalog.data && "products" in catalog.data && Array.isArray(catalog.data.products)) ? catalog.data.products : [];
 const [filter,setFilter]=useState<Filter>("all");
 const [search,setSearch]=useState("");
 const [selected,setSelected]=useState<string[]>([]);
 const [expanded,setExpanded]=useState<string|null>(null);
 const [manualAdId,setManualAdId]=useState("");
 const adInventory=useMemo(()=>groupByImportedAd(d.ads,d.campaigns).map(ad=>({
   ...ad,hasAI:ad.linked.some(c=>hasValidCampaignContent(selectPreviewContent(c)))
 })),[d.ads,d.campaigns]);
 const unmatchedAds=adInventory.filter(ad=>!ad.linked.length);
 function openExperience(id:string){
   setExpanded(id);
   setFilter("all");
   setSearch("");
   visual.submit({intent:"preview_product",id},{method:"post"});
   backdrop.submit({intent:"preview_backdrop",id},{method:"post"});
   document.getElementById("campaign-library")?.scrollIntoView({behavior:"smooth",block:"start"});
 }
 function chooseAdForMapping(adId:string){
   setManualAdId(adId);
   document.getElementById("manual-ad-match")?.scrollIntoView({behavior:"smooth",block:"start"});
 }
 const draft=d.campaigns.filter(c=>(c.status==="DRAFT"||Boolean(c.draftContent))&&hasValidCampaignContent(selectPreviewContent(c))).length;
 const published=d.campaigns.filter(c=>c.status==="PUBLISHED").length;
 const pending=d.campaigns.filter(c=>!hasValidCampaignContent(selectPreviewContent(c))).length;
 const visible=useMemo(()=>d.campaigns.filter(c=>{
    const valid=hasValidCampaignContent(selectPreviewContent(c));
    if(filter==="review"&&!(c.status==="DRAFT"&&valid||c.draftContent&&valid))return false;
    if(filter==="published"&&c.status!=="PUBLISHED")return false;
    if(filter==="generate"&&valid)return false;
    const ad=d.ads.find(a=>a.id===c.metaAdId);
    return (c.productTitle+" "+(ad?.name||"")+" "+c.metaAdId).toLowerCase().includes(search.trim().toLowerCase());
 }),[d.campaigns,d.ads,filter,search]);
 const selectedVisible=visible.map(c=>c.id).filter(id=>selected.includes(id));
 const allVisible=visible.length>0&&selectedVisible.length===visible.length;
 function toggle(id:string,checked:boolean){setSelected(prev=>checked?[...new Set([...prev,id])]:prev.filter(x=>x!==id));}
 function confirmDelete(e:React.FormEvent<HTMLFormElement>){
   const clicked=(e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
   if(clicked?.value==="bulk_delete" && !window.confirm("Delete selected campaigns permanently? This cannot be undone."))e.preventDefault();
 }
 return <s-page heading="AI campaigns">
   <s-button slot="primary-action" href="/app/autopilot" variant="primary">Run AI Autopilot</s-button>
   <div className="am-container">
    <PageIntro eyebrow="CONTENT STUDIO" title="Review and publish your AI experiences"
      description="See every imported Meta ad, inspect its AI-generated experience, and review any ads that still need product matching."/>
    {a&&<s-banner tone={a.ok?"success":"critical"}>{a.message}</s-banner>}
    {unmatchedAds.length>0&&<s-banner tone="info">{unmatchedAds.length} imported Meta ads do not yet have an associated Shopify product. Their AI previews cannot exist until you match a product and generate content. See All Meta Ads below.</s-banner>}
    <div className="am-stats am-stats-three">
      <Stat label="Matched campaigns" value={d.campaigns.length} note="Linked Shopify products"/>
      <Stat label="Needs product matching" value={unmatchedAds.length} note="Imported ads without campaign"/>
      <Stat label="Published experiences" value={published} note="Available on the matched product" tone="success"/>
    </div>
    <s-section>
      <SectionHead title="Conversion tracking setup"/>
      <p className="ad-muted">A/B measurement requires the AdMorph Shopify Web Pixel to be released with read_customer_events and write_pixels permissions, then connected once per store. Tracking respects Shopify Customer Privacy settings.</p>
      <Form method="post"><input type="hidden" name="intent" value="activate_pixel"/>
        <button className="ad-btn ghost" type="submit">Connect Shopify Web Pixel</button>
      </Form>
    </s-section>
    <div id="campaign-library"/>
    <s-section>
      <SectionHead title="Campaign library" action={<State text={pending+" need AI copy"} kind={pending?"warning":"success"}/>}/>
      {d.campaigns.length===0 ? <Empty title="No AI campaigns yet" description="Connect Meta and run Autopilot to create your first personalized draft." href="/app/autopilot" label="Go to Autopilot"/> : <>
        <div className="am-table-toolbar">
          <label className="am-search-label" htmlFor="campaignSearch">Search campaigns
            <input id="campaignSearch" className="ad-input" placeholder="Search ad or product" value={search} onChange={e=>setSearch(e.target.value)}/>
          </label>
          <label className="am-filter-label" htmlFor="campaignFilter">Status
            <select id="campaignFilter" className="ad-input" value={filter} onChange={e=>setFilter(e.target.value as Filter)}>
              <option value="all">All campaigns</option>
              <option value="review">Ready for review</option>
              <option value="published">Published</option>
              <option value="generate">Needs AI content</option>
            </select>
          </label>
        </div>
        <Form method="post" onSubmit={confirmDelete}>
         <div className="am-bulk-bar">
          <strong>{selected.length} selected</strong>
          <button type="submit" name="intent" value="bulk_publish" className="ad-btn ghost" disabled={!selected.length}>Publish</button>
          <button type="submit" name="intent" value="bulk_unpublish" className="ad-btn ghost" disabled={!selected.length}>Unpublish</button>
          <button type="submit" name="intent" value="bulk_delete" className="ad-btn am-danger" disabled={!selected.length}>Delete</button>
          <input type="hidden" name="confirmDelete" value="yes"/>
          {selected.map(id=><input type="hidden" name="ids" key={id} value={id}/>)}
         </div>
        </Form>
        <div className="am-table-scroll">
         <table className="ad-table am-campaign-table">
          <thead><tr>
           <th scope="col"><input aria-label="Select all displayed campaigns" type="checkbox" checked={allVisible} onChange={e=>setSelected(prev=>e.target.checked?[...new Set([...prev,...visible.map(c=>c.id)])]:prev.filter(id=>!visible.some(c=>c.id===id)))}/></th>
           <th scope="col">Meta advertisement</th><th scope="col">Product</th><th scope="col">Status</th><th scope="col">Updated</th><th scope="col">Actions</th>
          </tr></thead>
          <tbody>
           {visible.map(c=>{
            const valid=campaignContentSchema.safeParse(selectPreviewContent(c));
            const ad=d.ads.find(ad=>ad.id===c.metaAdId);
            return <tr key={c.id}>
              <td><input type="checkbox" aria-label={"Select "+c.productTitle} checked={selected.includes(c.id)} onChange={e=>toggle(c.id,e.target.checked)}/></td>
              <td><strong>{ad?.name||"Ad "+c.metaAdId}</strong><small className="am-table-subtitle">{c.metaAdId}</small></td>
              <td>{c.productTitle}<small className="am-table-subtitle">/products/{c.productHandle}</small></td>
              <td><State text={c.draftContent?"Pending approval":c.status==="PUBLISHED"?"Published":valid.success?"Review draft":"Needs generation"} kind={c.draftContent?"warning":c.status==="PUBLISHED"?"success":valid.success?"warning":"neutral"}/></td>
              <td>{new Date(c.updatedAt).toLocaleDateString("en-GB")}</td>
              <td><button type="button" className="am-table-toggle" aria-expanded={expanded===c.id} onClick={()=>expanded===c.id?setExpanded(null):openExperience(c.id)}>{expanded===c.id?"Close":"View AI"}</button></td>
             </tr>;
           })}
          </tbody>
         </table>
         {visible.length===0&&<div className="am-empty"><h3>No matching campaigns</h3><p>Try a different search or filter.</p></div>}
        </div>
        {expanded&&(()=>{
          const c=d.campaigns.find(c=>c.id===expanded);
          if(!c)return null;
          // A v2 content object does not satisfy the legacy variant schema.
          // Prefer a pending merchant draft but keep the published version available.
          const valid=campaignContentSchema.safeParse(selectPreviewContent(c));
          const publishedContent=campaignContentSchema.safeParse(c.content);
          const originAd=d.ads.find(ad=>ad.id===c.metaAdId);
          return <div className="am-detail-panel">
            <div className="am-section-head"><h3>{c.productTitle}</h3><button type="button" className="am-table-toggle" onClick={()=>setExpanded(null)}>Close</button></div>
            <p className="ad-muted">Meta ad: {c.metaAdId}{originAd?.name?" · "+originAd.name:""}</p>
            {originAd&&<div className="am-ad-source">
              <strong>Source Meta creative</strong>
              <div className="am-ad-creative-comparison">
                {originAd.creative.imageUrl.startsWith("https://")&&<img src={originAd.creative.imageUrl} alt="Original Meta ad creative" loading="lazy"/>}
                <div><p>{originAd.creative.headline||originAd.creative.body||"No ad copy supplied by Meta."}</p>
                  {originAd.creative.headline&&originAd.creative.body&&<p>{originAd.creative.body}</p>}
                  <small>Compare the source creative above with the generated experience below. Verify that both refer to the actual Shopify product.</small>
                </div>
              </div>
            </div>}
            {c.status==="PUBLISHED"&&<a className="am-text-link" target="_blank" rel="noopener noreferrer" href={`https://${d.shop}/products/${encodeURIComponent(c.productHandle)}?admorph_ad=${encodeURIComponent(c.metaAdId)}`}>View published product experience</a>}
            {c.draftContent&&publishedContent.success&&<details className="am-editor-details">
              <summary>View current live experience (before pending changes)</summary>
              {isExperience(publishedContent.data)?<ExperiencePreview content={publishedContent.data}/>:
                <div className="ad-preview"><h3>{publishedContent.data.headline}</h3><p>{publishedContent.data.subheadline}</p><ul>{publishedContent.data.benefits.map((b,i)=><li key={i}>{b}</li>)}</ul></div>}
            </details>}
            {!valid.success&&<s-banner tone="warning">No AI content generated for this campaign. Match a relevant Shopify product, then use Generate Experience 2.0 to create a draft.</s-banner>}
            {c.draftContent&&<s-banner tone="info">This is an unpublished update. The existing experience remains live until you approve the draft.</s-banner>}
            {valid.success && isExperience(valid.data) && <>
              {visual.state!=="idle"&&<p role="status" className="ad-muted">Loading verified Shopify product image…</p>}
              {visual.data&&"campaignId" in visual.data&&visual.data.campaignId===c.id&&!visual.data.ok&&<p className="ad-muted">Product visual unavailable; showing generated copy preview instead.</p>}
              <ExperiencePreview content={valid.data} productImageUrl={
                visual.data&&"campaignId" in visual.data&&visual.data.campaignId===c.id&&"productVisual" in visual.data ?
                visual.data.productVisual?.url||undefined:undefined
              } productImageAlt={c.productTitle}/>
              <details className="am-editor-details"><summary>Edit Experience 2.0 content</summary>
                <ExperienceEditor id={c.id} content={valid.data}/>
              </details>
            </>}
            {valid.success && !isExperience(valid.data) && <>
              <div className="ad-preview"><h3>{valid.data.headline}</h3><p>{valid.data.subheadline}</p>
                <ul>{valid.data.benefits.map((b,i)=><li key={i}>{b}</li>)}</ul>
                <small>CTA: {valid.data.cta}</small>
              </div>
              <details className="am-editor-details"><summary>Edit legacy AI copy</summary>
                <Form method="post" className="am-edit-fields">
                  <input type="hidden" name="intent" value="save"/><input type="hidden" name="id" value={c.id}/>
                  <label>Headline<input name="headline" className="ad-input" maxLength={130} defaultValue={valid.data.headline} required/></label>
                  <label>Subheadline<textarea name="subheadline" className="ad-input" rows={3} maxLength={240} defaultValue={valid.data.subheadline} required/></label>
                  {valid.data.benefits.map((benefit,i)=><label key={i}>Benefit {i+1}<input name={"benefit"+(i+1)} className="ad-input" maxLength={150} defaultValue={benefit} required/></label>)}
                  <label>CTA<input name="cta" className="ad-input" maxLength={50} defaultValue={valid.data.cta} required/></label>
                  <button className="ad-btn" type="submit">Save changes for review</button>
                </Form>
              </details>
            </>}
            {valid.success&&isExperience(valid.data)&&<section className="am-visual-studio-panel">
              <h3>AI Image Studio</h3>
              <p className="ad-muted">Generate original abstract background artwork matched to this Meta ad. Your verified Shopify product photograph remains separate and unchanged. Image generation uses the OpenAI API and may incur usage charges.</p>
              {backdrop.state!=="idle"&&<p className="ad-muted">Loading visual asset…</p>}
              {backdrop.data&&"campaignId" in backdrop.data&&backdrop.data.campaignId===c.id&&"draftImage" in backdrop.data&&
               backdrop.data.draftImage&&<div className="am-image-review">
                <img src={backdrop.data.draftImage} alt="Generated AI backdrop awaiting approval"/>
                <p>AI GENERATED BACKGROUND — unpublished</p>
               </div>}
              {backdrop.data&&"campaignId" in backdrop.data&&backdrop.data.campaignId===c.id&&"publishedImage" in backdrop.data&&
               backdrop.data.publishedImage&&<div className="am-image-review">
                <img src={backdrop.data.publishedImage} alt="Published AI background art"/>
                <p>Published background artwork</p>
               </div>}
              <div className="am-inline-actions">
                <Form method="post"><input type="hidden" name="intent" value="generate_backdrop"/><input type="hidden" name="id" value={c.id}/>
                 <button type="submit" className="ad-btn ghost">Generate AI Background</button></Form>
                <backdrop.Form method="post"><input type="hidden" name="intent" value="preview_backdrop"/><input type="hidden" name="id" value={c.id}/>
                 <button type="submit" className="ad-btn ghost" disabled={backdrop.state!=="idle"}>Refresh Image Preview</button></backdrop.Form>
                <Form method="post"><input type="hidden" name="intent" value="approve_backdrop"/><input type="hidden" name="id" value={c.id}/>
                 <button type="submit" className="ad-btn" disabled={c.status!=="PUBLISHED"}>Approve AI Image</button></Form>
                <Form method="post"><input type="hidden" name="intent" value="discard_backdrop"/><input type="hidden" name="id" value={c.id}/>
                 <button type="submit" className="ad-btn ghost">Discard Draft Image</button></Form>
                <Form method="post"><input type="hidden" name="intent" value="remove_live_backdrop"/><input type="hidden" name="id" value={c.id}/>
                 <button type="submit" className="ad-btn ghost">Remove Live AI Image</button></Form>
              </div>
             </section>}
            <section className="am-experiment-panel">
             <h3>A/B Conversion Experiment</h3>
             <p className="ad-muted">A = original Shopify product page. B = AdMorph AI experience. Shopify Web Pixel tracks consented views, CTA interactions, confirmed add-to-cart events, and checkout completed signals where attribution persists.</p>
             {(()=>{
              const enabled=d.experiments.find(e=>e.campaignId===c.id)?.enabled||false;
              const stats=d.experimentResults[c.id]||{};
              const a=stats.A||{},b=stats.B||{};
              return <div>
               <div className="am-experiment-grid">{(["A","B"] as const).map(arm=>{
                const counts=arm==="A"?a:b;
                const views=counts.view||0,carts=counts.cart||0,purchases=counts.purchase||0;
                return <div key={arm}>
                  <strong>{arm==="A"?"A — Control":"B — AdMorph AI"}</strong>
                  <p>{views} recorded views · {counts.cta||0} CTA clicks</p>
                  <p>{carts} Shopify add-to-cart events · {purchases} checkout-completed events</p>
                  <p>Cart event rate: {views?(100*carts/views).toFixed(1)+"%":"—"} · Purchase event rate: {views?(100*purchases/views).toFixed(1)+"%":"—"}</p>
                </div>;
               })}</div>
               <Form method="post"><input type="hidden" name="intent" value="set_experiment"/><input type="hidden" name="id" value={c.id}/>
                <input type="hidden" name="enabled" value={enabled?"false":"true"}/>
                <button type="submit" disabled={c.status!=="PUBLISHED"} className="ad-btn ghost">{enabled?"Stop A/B Experiment":"Start A/B Experiment (50/50)"}</button>
               </Form>
              </div>;
             })()}
            </section>
            <div className="am-edit-actions">
              <Form method="post"><input type="hidden" name="intent" value="generate"/><input type="hidden" name="id" value={c.id}/>
                <button type="submit" className="ad-btn ghost">{valid.success?"Generate Experience 2.0":"Generate first AI experience"}</button></Form>
              {valid.success&&isExperience(valid.data)&&<Form method="post">
                <input type="hidden" name="intent" value="generate_visual"/>
                <input type="hidden" name="id" value={c.id}/>
                <button type="submit" className="ad-btn ghost">AI Suggest New Visual Direction</button>
              </Form>}
              {valid.success&&((c.status==="DRAFT")||Boolean(c.draftContent))&&<Form method="post">
                 <input type="hidden" name="intent" value="publish"/><input type="hidden" name="id" value={c.id}/>
                 <button type="submit" className="ad-btn">Approve & publish {isExperience(valid.data)?"Experience 2.0":"draft"}</button></Form>}
              {c.status==="PUBLISHED"&&<Form method="post"><input type="hidden" name="intent" value="unpublish"/><input type="hidden" name="id" value={c.id}/>
                <button type="submit" className="ad-btn ghost">Unpublish</button></Form>}
              {c.draftContent&&<Form method="post"><input type="hidden" name="intent" value="discard_draft"/><input type="hidden" name="id" value={c.id}/>
                <button type="submit" className="ad-btn ghost">Discard pending update</button></Form>}
            </div>
          </div>;
        })()}
        <p className="ad-muted">Showing up to 200 recent campaigns. Bulk actions only apply to your selected campaigns. Every campaign with generated AI content has an Open preview.</p>
      </>}
    </s-section>
    <s-section>
      <SectionHead title="All Meta Ads" action={<State text={unmatchedAds.length+" without a product"} kind={unmatchedAds.length?"warning":"success"}/>}/>
      <p className="ad-muted">Every imported ad from Meta appears here, including paused ads and those that promote a non-Shopify destination. A Meta ad is not itself an AI campaign until a Shopify product has been matched.</p>
      {!adInventory.length?<Empty title="No Meta ads imported" description="Connect Meta and run Autopilot to import advertising creatives." href="/app/meta" label="Open Meta connection"/>:
       <div className="am-table-scroll"><table className="ad-table am-campaign-table">
        <thead><tr><th scope="col">Meta ad</th><th scope="col">Meta status</th><th scope="col">AI experience</th><th scope="col">Action</th></tr></thead>
        <tbody>{adInventory.map(ad=><tr key={ad.id}>
           <td><strong>{ad.name||"Untitled ad"}</strong><small className="am-table-subtitle">{ad.id}</small>
            {(ad.creative.headline||ad.creative.body)&&<small className="am-table-subtitle">{(ad.creative.headline||ad.creative.body).slice(0,125)}</small>}
           </td>
           <td><State text={ad.status==="ACTIVE"?"Active":ad.status.replace(/_/g," ").toLowerCase()} kind={ad.status==="ACTIVE"?"success":"neutral"}/></td>
           <td>{ad.linked.length? <span>{ad.linked.length} linked campaign{ad.linked.length===1?"":"s"}{ad.hasAI?" · AI generated":" · Awaiting generation"}</span> :
             <State text="Not matched to Shopify" kind="warning"/>}</td>
           <td><div className="am-inline-actions">
             {ad.linked.map(c=><button key={c.id} type="button" className="am-table-toggle" onClick={()=>openExperience(c.id)}>{hasValidCampaignContent(selectPreviewContent(c))?"View AI experience":"Open campaign"}</button>)}
             <button type="button" className="am-table-toggle" onClick={()=>chooseAdForMapping(ad.id)}>Match to product</button>
           </div></td>
        </tr>)}</tbody>
       </table></div>}
      <p className="ad-muted">Ads with no verified product link are never matched automatically. Manual matching requires choosing the actual promoted Shopify product; unrelated external website ads should not be paired.</p>
    </s-section>
    <div id="manual-ad-match"/>
    <s-section>
      <SectionHead title="Manually match an ad"/>
      <p className="ad-muted">Use this only when the ad genuinely promotes a product in this Shopify store. Load products, select the Meta ad and product, then generate the experience in Campaign library.</p>
      <catalog.Form method="post" style={{margin:"14px 0"}}>
        <input type="hidden" name="intent" value="load_products"/>
        <button type="submit" className="ad-btn ghost" disabled={catalog.state!=="idle"}>{catalog.state==="idle"?"Load Shopify products":"Loading products..."}</button>
        {catalog.data&&<span className="ad-muted" style={{marginLeft:12}} role="status">{catalog.data.message}</span>}
      </catalog.Form>
      <Form method="post">
        <input type="hidden" name="intent" value="create"/>
        <div className="ad-form-row">
          <label className="ad-label" htmlFor="adId">Meta advertisement
            <select className="ad-input" id="adId" name="adId" value={manualAdId} onChange={e=>setManualAdId(e.target.value)} required>
              <option value="">Select ad</option>{d.ads.map(ad=><option key={ad.id} value={ad.id}>{ad.name} ({ad.id})</option>)}
            </select>
          </label>
          <label className="ad-label" htmlFor="productId">Shopify product
            <select className="ad-input" id="productId" name="productId" required>
              <option value="">Select product</option>{products.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
        </div>
        <button type="submit" className="ad-btn ghost" disabled={!d.ads.length||!products.length}>Create draft campaign</button>
      </Form>
      <p className="ad-muted">Then generate, review and publish copy. Activate the <Link to="/app/theme">theme block</Link> for storefront display.</p>
    </s-section>
   </div>
 </s-page>;
}
