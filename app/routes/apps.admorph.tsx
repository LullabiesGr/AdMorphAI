import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { campaignContentSchema } from "../lib/experience";
export const loader=async({request}:LoaderFunctionArgs)=>{
 const {session}=await authenticate.public.appProxy(request);
 const url=new URL(request.url);
 const shop=session?.shop;
 const adId=url.searchParams.get("ad_id")||"";
 const handle=url.searchParams.get("product_handle")||"";
 const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
 if(!shop||!/^[0-9]{5,30}$/.test(adId)||!/^[a-z0-9][a-z0-9-]{0,250}$/.test(handle)){
  return new Response(JSON.stringify({content:null}),{headers});
 }
 const campaign=await prisma.campaign.findFirst({
   where:{shop,metaAdId:adId,productHandle:handle,status:"PUBLISHED"},
   orderBy:{updatedAt:"desc"},select:{content:true}
 });
 const parsed=campaignContentSchema.safeParse(campaign?.content);
 console.info("[AdMorph proxy] request handled",{shop,matched:parsed.success,hasAd:Boolean(adId),hasProduct:Boolean(handle)});
 return new Response(JSON.stringify({content:parsed.success?parsed.data:null}),{headers});
};
