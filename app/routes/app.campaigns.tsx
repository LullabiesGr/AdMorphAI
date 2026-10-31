import {useMemo,useState} from "react";
import type {ActionFunctionArgs,LoaderFunctionArgs} from "react-router";
import {Form,Link,useActionData,useLoaderData} from "react-router";
import prisma from "../db.server";
import {authenticate} from "../shopify.server";
import {listProducts,getProduct} from "../services/products.server";
import {generateVariant} from "../services/ai.server";
import {variantSchema} from "../lib/variant";
import {metaCreativeCopy} from "../services/meta.server";
import {PageIntro,Stat,State,SectionHead,Empty} from "../components/dashboard";

export const loader=async({request}:LoaderFunctionArgs)=>{
 const {admin,session}=await authenticate.admin(request);
 const [ads,products,campaigns]=await Promise.all([
  prisma.metaAd.findMany({where:{shop:session.shop},orderBy:{updatedAt:"desc"},take:50}),
  listProducts(admin),
  prisma.campaign.findMany({where:{shop:session.shop},orderBy:{updatedAt:"desc"},take:100})
 ]);
 return {
   ads:ads.map(ad=>({id:ad.adId,name:ad.name,status:ad.status,creative:metaCreativeCopy(ad.creative)})),
   products,campaigns
 };
};

export const action=async({request}:ActionFunctionArgs)=>{
 const {admin,session}=await authenticate.admin(request);
 const data=await request.formData(),intent=String(data.get("intent")||"");
 const shop=session.shop;
 try {
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
      select:{id:true,content:true,status:true}});
    if(intent==="bulk_delete"){
      const result=await prisma.campaign.deleteMany({where:{shop,id:{in:records.map(r=>r.id)}}});
      return {ok:true,message:`Deleted ${result.count} campaign(s).`};
    }
    if(intent==="bulk_publish"){
      const valid=records.filter(c=>c.status==="DRAFT"&&variantSchema.safeParse(c.content).success).map(c=>c.id);
      const result=await prisma.campaign.updateMany({where:{shop,id:{in:valid}},data:{status:"PUBLISHED"}});
      return {ok:true,message:`Published ${result.count} valid draft(s). Drafts without AI content were skipped.`};
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
    await prisma.campaign.update({where:{id},data:{content:parsed.data,status:"DRAFT"}});
    return {ok:true,message:"Changes saved as draft. Review before publishing."};
  }
  if(["generate","publish","unpublish"].includes(intent)){
    const id=String(data.get("id")||"");
    const campaign=await prisma.campaign.findFirst({where:{id,shop}});
    if(!campaign)throw new Error("Campaign not found.");
    if(intent==="generate"){
      const ad=await prisma.metaAd.findUnique({where:{shop_adId:{shop,adId:campaign.metaAdId}}});
      if(!ad)throw new Error("Meta ad missing. Re-import ads.");
      const product=await getProduct(admin,campaign.productId);
      const content=await generateVariant({product,adCreative:ad.creative});
      await prisma.campaign.update({where:{id},data:{
        productHandle:product.handle,productTitle:product.title,content,status:"DRAFT"
      }});
      return {ok:true,message:"Draft generated. Review the copy before publishing."};
    }
    if(intent==="publish"){
      if(!variantSchema.safeParse(campaign.content).success)
        throw new Error("Generate valid AI content before publishing.");
      await prisma.campaign.update({where:{id},data:{status:"PUBLISHED"}});
      return {ok:true,message:"Experience published."};
    }
    await prisma.campaign.update({where:{id},data:{status:"DRAFT"}});
    return {ok:true,message:"Experience unpublished."};
  }
  return {ok:false,message:"Unsupported action."};
 }catch(e){return {ok:false,message:e instanceof Error?e.message:"Action failed."};}
};

type Filter="all"|"review"|"published"|"generate";
export default function Campaigns(){
 const d=useLoaderData<typeof loader>(),a=useActionData<typeof action>();
 const [filter,setFilter]=useState<Filter>("all");
 const [search,setSearch]=useState("");
 const [selected,setSelected]=useState<string[]>([]);
 const [expanded,setExpanded]=useState<string|null>(null);
 const draft=d.campaigns.filter(c=>c.status==="DRAFT"&&variantSchema.safeParse(c.content).success).length;
 const published=d.campaigns.filter(c=>c.status==="PUBLISHED").length;
 const pending=d.campaigns.filter(c=>!variantSchema.safeParse(c.content).success).length;
 const visible=useMemo(()=>d.campaigns.filter(c=>{
    const valid=variantSchema.safeParse(c.content).success;
    if(filter==="review"&&!(c.status==="DRAFT"&&valid))return false;
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
      description="Inspect the copy behind each Meta ad and keep control of what appears in your store."/>
    {a&&<s-banner tone={a.ok?"success":"critical"}>{a.message}</s-banner>}
    <div className="am-stats am-stats-three">
      <Stat label="Campaigns" value={d.campaigns.length} note="Latest 100"/>
      <Stat label="Ready for review" value={draft} note="Valid AI drafts"/>
      <Stat label="Published" value={published} note="Live personalized content" tone="success"/>
    </div>
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
            const valid=variantSchema.safeParse(c.content);
            const ad=d.ads.find(ad=>ad.id===c.metaAdId);
            return <tr key={c.id}>
              <td><input type="checkbox" aria-label={"Select "+c.productTitle} checked={selected.includes(c.id)} onChange={e=>toggle(c.id,e.target.checked)}/></td>
              <td><strong>{ad?.name||"Ad "+c.metaAdId}</strong><small className="am-table-subtitle">{c.metaAdId}</small></td>
              <td>{c.productTitle}<small className="am-table-subtitle">/products/{c.productHandle}</small></td>
              <td><State text={c.status==="PUBLISHED"?"Published":valid.success?"Review draft":"Needs generation"} kind={c.status==="PUBLISHED"?"success":valid.success?"warning":"neutral"}/></td>
              <td>{new Date(c.updatedAt).toLocaleDateString("en-GB")}</td>
              <td><button type="button" className="am-table-toggle" aria-expanded={expanded===c.id} onClick={()=>setExpanded(expanded===c.id?null:c.id)}>{expanded===c.id?"Close":"Open"}</button></td>
             </tr>;
           })}
          </tbody>
         </table>
         {visible.length===0&&<div className="am-empty"><h3>No matching campaigns</h3><p>Try a different search or filter.</p></div>}
        </div>
        {expanded&&(()=>{
          const c=d.campaigns.find(c=>c.id===expanded);
          if(!c)return null;
          const valid=variantSchema.safeParse(c.content);
          return <div className="am-detail-panel">
            <div className="am-section-head"><h3>{c.productTitle}</h3><button type="button" className="am-table-toggle" onClick={()=>setExpanded(null)}>Close</button></div>
            <p className="ad-muted">Meta ad: {c.metaAdId}</p>
            {valid.success&&<div className="ad-preview"><h3>{valid.data.headline}</h3><p>{valid.data.subheadline}</p><ul>{valid.data.benefits.map((b,i)=><li key={i}>{b}</li>)}</ul><small>CTA: {valid.data.cta}</small></div>}
            {valid.success&&<details className="am-editor-details"><summary>Edit AI-generated copy</summary>
              <Form method="post" className="am-edit-fields">
               <input type="hidden" name="intent" value="save"/><input type="hidden" name="id" value={c.id}/>
               <label>Headline<input name="headline" className="ad-input" maxLength={130} defaultValue={valid.data.headline} required/></label>
               <label>Subheadline<textarea name="subheadline" className="ad-input" rows={3} maxLength={240} defaultValue={valid.data.subheadline} required/></label>
               {valid.data.benefits.map((benefit,i)=><label key={i}>Benefit {i+1}<input name={"benefit"+(i+1)} className="ad-input" maxLength={150} defaultValue={benefit} required/></label>)}
               <label>CTA<input name="cta" className="ad-input" maxLength={50} defaultValue={valid.data.cta} required/></label>
               <button className="ad-btn" type="submit">Save as draft</button>
              </Form>
            </details>}
            <div className="am-edit-actions">
              <Form method="post"><input type="hidden" name="intent" value="generate"/><input type="hidden" name="id" value={c.id}/>
                <button type="submit" className="ad-btn ghost">{valid.success?"Regenerate draft":"Generate AI draft"}</button></Form>
              {valid.success&&<Form method="post"><input type="hidden" name="intent" value={c.status==="PUBLISHED"?"unpublish":"publish"}/><input type="hidden" name="id" value={c.id}/>
                <button type="submit" className="ad-btn">{c.status==="PUBLISHED"?"Unpublish":"Approve & publish"}</button></Form>}
            </div>
          </div>;
        })()}
        <p className="ad-muted">Showing up to 100 latest campaigns. Bulk actions only apply to the selected campaigns.</p>
      </>}
    </s-section>
    <s-section>
      <SectionHead title="Manually match an ad"/>
      <p className="ad-muted">For ads that Autopilot cannot match, choose the correct product yourself.</p>
      <Form method="post">
        <input type="hidden" name="intent" value="create"/>
        <div className="ad-form-row">
          <label className="ad-label" htmlFor="adId">Meta advertisement
            <select className="ad-input" id="adId" name="adId" required>
              <option value="">Select ad</option>{d.ads.map(ad=><option key={ad.id} value={ad.id}>{ad.name} ({ad.id})</option>)}
            </select>
          </label>
          <label className="ad-label" htmlFor="productId">Shopify product
            <select className="ad-input" id="productId" name="productId" required>
              <option value="">Select product</option>{d.products.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
        </div>
        <button type="submit" className="ad-btn ghost" disabled={!d.ads.length||!d.products.length}>Create draft campaign</button>
      </Form>
      <p className="ad-muted">Then generate, review and publish copy. Activate the <Link to="/app/theme">theme block</Link> for storefront display.</p>
    </s-section>
   </div>
 </s-page>;
}
