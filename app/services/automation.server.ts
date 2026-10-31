import prisma from "../db.server";
import { importMetaAds } from "./meta.server";
import { getShopStorefrontDomains, getActiveProductByHandle, type ShopifyAdmin } from "./products.server";
import { productHandleFromAd } from "../lib/ad-matching";
import { generateVariant } from "./ai.server";
import { variantSchema } from "../lib/variant";

export type BatchStats={
 processed:number; matched:number; generated:number; published:number;
 existing:number; unmatched:number; inactive:number; failed:number;
};
const freshStats=():BatchStats=>({processed:0,matched:0,generated:0,published:0,existing:0,unmatched:0,inactive:0,failed:0});

export async function startAutomation(shop:string){
 const setting=await prisma.automationSetting.upsert({
   where:{shop},create:{shop},update:{},
 });
 const connection=await prisma.metaConnection.findUnique({where:{shop}});
 if(!connection?.selectedAccountId)throw new Error("Connect Meta and select an ad account first.");
 const result=await importMetaAds(shop);
 return {ok:true,hasMore:result.count>0,nextCursor:"",stats:freshStats(),
    message:result.count>0 ? `Imported ${result.count} ads. Automatically matching products and generating copy.` : "No ads found in this account.",
    autoPublish:setting.autoPublish,hasAdditionalPages:result.hasMore};
}

/** Each batch is small enough for Render HTTP requests and OpenAI API limits.
 * A Shopify merchant starts the run; the UI submits following batches automatically.
 * No background work or implicit publication occurs outside this workflow.
 */
export async function runAutomationBatch(shop:string,admin:ShopifyAdmin,cursor:string){
 if(cursor && !/^[a-z0-9]{8,40}$/i.test(cursor))throw new Error("Invalid batch cursor");
 const setting=await prisma.automationSetting.findUnique({where:{shop}});
 const connection=await prisma.metaConnection.findUnique({where:{shop}});
 if(!connection?.selectedAccountId)throw new Error("No Meta account selected");
 const ads=await prisma.metaAd.findMany({
   where:{shop,accountId:connection.selectedAccountId,...(cursor?{id:{gt:cursor}}:{})},
   orderBy:{id:"asc"},take:3
 });
 const stats=freshStats();
 const domains=await getShopStorefrontDomains(admin,shop);
 for(const ad of ads){
   stats.processed++;
   if(ad.status!=="ACTIVE"){stats.inactive++;continue;}
   const handle=productHandleFromAd(ad.creative,domains);
   if(!handle){stats.unmatched++;continue;}
   try {
     const product=await getActiveProductByHandle(admin,handle);
     if(!product){stats.unmatched++;continue;}
     stats.matched++;
     const key={shop,metaAdId:ad.adId,productId:product.id};
     const existing=await prisma.campaign.findUnique({where:{shop_metaAdId_productId:key}});
     if(existing?.content && variantSchema.safeParse(existing.content).success){
       stats.existing++;continue;
     }
     const campaign=existing || await prisma.campaign.create({data:{
       shop,metaAdId:ad.adId,productId:product.id,productHandle:product.handle,productTitle:product.title
     }});
     // No storefront changes occur until publishing.
     const content=await generateVariant({product,adCreative:ad.creative});
     await prisma.campaign.update({where:{id:campaign.id},data:{
       content,productHandle:product.handle,productTitle:product.title,
       status:setting?.autoPublish ? "PUBLISHED" : "DRAFT"
     }});
     stats.generated++;
     if(setting?.autoPublish)stats.published++;
   }catch(e){
     stats.failed++;
     console.error("AdMorph auto-processing failed",{shop,adId:ad.adId,error:e instanceof Error?e.message:"unknown"});
   }
 }
 const last=ads.at(-1)?.id || cursor;
 const more=ads.length===3 && !!await prisma.metaAd.findFirst({
   where:{shop,accountId:connection.selectedAccountId,id:{gt:last}},select:{id:true}
 });
 if(!more){
   await prisma.automationSetting.upsert({
      where:{shop},create:{shop,lastSyncAt:new Date(),lastResult:stats},update:{lastSyncAt:new Date(),lastResult:stats}
   });
 }
 return {ok:true,hasMore:more,nextCursor:last,stats,message:more?"Processing next batch...":"Automatic import and generation finished."};
}

export async function publishAllDrafts(shop:string){
 const records=await prisma.campaign.findMany({where:{shop,status:"DRAFT"},select:{id:true,content:true},take:100});
 const ids=records.filter(r=>variantSchema.safeParse(r.content).success).map(r=>r.id);
 if(ids.length)await prisma.campaign.updateMany({where:{shop,id:{in:ids}},data:{status:"PUBLISHED"}});
 return ids.length;
}
