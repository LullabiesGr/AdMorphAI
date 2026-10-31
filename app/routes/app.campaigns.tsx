import type {ActionFunctionArgs,LoaderFunctionArgs} from "react-router";
import {Form,useActionData,useLoaderData} from "react-router";
import prisma from "../db.server";
import {authenticate} from "../shopify.server";
import {listProducts,getProduct} from "../services/products.server";
import {generateVariant,variantSchema} from "../services/ai.server";
import {metaCreativeCopy} from "../services/meta.server";
export const loader=async({request}:LoaderFunctionArgs)=>{
 const {admin,session}=await authenticate.admin(request);
 const [ads,products,campaigns]=await Promise.all([
  prisma.metaAd.findMany({where:{shop:session.shop},orderBy:{updatedAt:"desc"},take:50}),
  listProducts(admin),
  prisma.campaign.findMany({where:{shop:session.shop},orderBy:{updatedAt:"desc"},take:100})
 ]);
 return {ads:ads.map(ad=>({id:ad.adId,name:ad.name,status:ad.status,creative:metaCreativeCopy(ad.creative)})),products,campaigns};
};
export const action=async({request}:ActionFunctionArgs)=>{
 const {admin,session}=await authenticate.admin(request);
 const data=await request.formData(),intent=String(data.get("intent")||"");
 try {
  if(intent==="create"){
   const adId=String(data.get("adId")||""),productId=String(data.get("productId")||"");
   const ad=await prisma.metaAd.findUnique({where:{shop_adId:{shop:session.shop,adId}}});
   if(!ad) throw new Error("Ad not imported for this store");
   const product=await getProduct(admin,productId);
   await prisma.campaign.upsert({
    where:{shop_metaAdId_productId:{shop:session.shop,metaAdId:adId,productId}},
    create:{shop:session.shop,metaAdId:adId,productId,productHandle:product.handle,productTitle:product.title},
    update:{productHandle:product.handle,productTitle:product.title}
   });
   return {ok:true,message:"Campaign created. Generate its copy next."};
  }
  if(intent==="generate"||intent==="publish"||intent==="unpublish"){
   const id=String(data.get("id")||"");
   const campaign=await prisma.campaign.findFirst({where:{id,shop:session.shop}});
   if(!campaign) throw new Error("Campaign not found");
   if(intent==="generate"){
     const ad=await prisma.metaAd.findUnique({where:{shop_adId:{shop:session.shop,adId:campaign.metaAdId}}});
     if(!ad) throw new Error("Meta ad missing, please re-import");
     const product=await getProduct(admin,campaign.productId);
     const content=await generateVariant({product,adCreative:ad.creative});
     await prisma.campaign.update({where:{id},data:{
      productHandle:product.handle,productTitle:product.title,content,status:"DRAFT"
     }});
     return {ok:true,message:"AI generated a draft. Review the copy before publishing."};
   }
   if(intent==="publish"){
     const parsed=variantSchema.safeParse(campaign.content);
     if(!parsed.success) throw new Error("Generate valid AI copy first");
     await prisma.campaign.update({where:{id},data:{status:"PUBLISHED"}});
     return {ok:true,message:"Campaign published to storefront."};
   }
   await prisma.campaign.update({where:{id},data:{status:"DRAFT"}});
   return {ok:true,message:"Campaign unpublished."};
  }
  return {ok:false,message:"Unsupported action"};
 }catch(error){return {ok:false,message:error instanceof Error?error.message:"Action failed"};}
};
export default function Campaigns(){
 const d=useLoaderData<typeof loader>(),a=useActionData<typeof action>();
 return <s-page heading="AI Campaign Studio">
  <s-button slot="primary-action" href="/app/meta">Meta Ads connection</s-button>
  {a&&<s-banner tone={a.ok?"success":"critical"}>{a.message}</s-banner>}
  <s-section heading="1. Match a Meta ad to a product">
   <p className="ad-muted">Create a draft from one imported ad and one active Shopify product.</p>
   {!d.ads.length&&<p>No ads imported yet. Visit Meta Ads and sync your account.</p>}
   <Form method="post">
    <input type="hidden" name="intent" value="create"/>
    <div className="ad-form-row">
     <div><label className="ad-label" htmlFor="adId">Meta advertisement</label><select className="ad-input" id="adId" name="adId" required>
      <option value="">Choose an ad</option>{d.ads.map(x=><option key={x.id} value={x.id}>{x.name} ({x.id})</option>)}
     </select></div>
     <div><label className="ad-label" htmlFor="productId">Shopify product</label><select className="ad-input" id="productId" name="productId" required>
      <option value="">Choose a product</option>{d.products.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}
     </select></div>
    </div>
    <button disabled={!d.ads.length||!d.products.length} className="ad-btn" type="submit">Create campaign</button>
   </Form>
  </s-section>
  <s-section heading="2. Generate, review and publish">
   {!d.campaigns.length&&<p className="ad-muted">Your AI drafts will appear here.</p>}
   {d.campaigns.map(c=>{
    const content=variantSchema.safeParse(c.content),ad=d.ads.find(x=>x.id===c.metaAdId);
    return <div className="ad-card" key={c.id} style={{marginBottom:16}}>
      <div style={{display:"flex",alignItems:"start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
       <div><h3 style={{fontSize:17,margin:"0 0 5px"}}>{c.productTitle}</h3><span className="ad-muted">{ad?.name||c.metaAdId}</span></div>
       <span className={"ad-status "+(c.status==="PUBLISHED"?"published":"")}>{c.status}</span>
      </div>
      {content.success&&<div className="ad-preview">
       <h3>{content.data.headline}</h3><p>{content.data.subheadline}</p>
       <ul>{content.data.benefits.map((b,i)=><li key={i}>{b}</li>)}</ul>
       <p className="ad-muted">CTA: {content.data.cta}</p>
      </div>}
      <div className="ad-row-actions">
       <Form method="post"><input type="hidden" name="intent" value="generate"/><input type="hidden" name="id" value={c.id}/><button className="ad-btn ghost" type="submit">{content.success?"Regenerate draft":"Generate AI draft"}</button></Form>
       {content.success&&<Form method="post"><input type="hidden" name="intent" value={c.status==="PUBLISHED"?"unpublish":"publish"}/><input type="hidden" name="id" value={c.id}/><button className="ad-btn" type="submit">{c.status==="PUBLISHED"?"Unpublish":"Approve & publish"}</button></Form>}
      </div>
      <p className="ad-muted" style={{marginBottom:0}}>Ad ID: {c.metaAdId} · Product: /products/{c.productHandle}</p>
     </div>;
   })}
  </s-section>
  <s-section heading="3. Activate your storefront">
   <p>Add the AdMorph Personalization block in Shopify Theme Editor on your product template. To match a visitor to an ad, its destination URL needs the parameter <code>admorph_ad=&#123;&#123;ad.id&#125;&#125;</code> configured in Meta Ads Manager. We do not edit ads using read-only permissions.</p>
  </s-section>
 </s-page>;
}
