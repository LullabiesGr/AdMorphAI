import type {ActionFunctionArgs,LoaderFunctionArgs} from "react-router";
import prisma from "../db.server";
import {authenticate} from "../shopify.server";
import {campaignContentSchema} from "../lib/experience";
import {issueEventToken,recordEvent} from "../services/experiment.server";

const jsonHeaders={
 "Content-Type":"application/json; charset=utf-8",
 "Cache-Control":"no-store","X-Content-Type-Options":"nosniff"
};
export const loader=async({request}:LoaderFunctionArgs)=>{
 const {session}=await authenticate.public.appProxy(request);
 const url=new URL(request.url),shop=session?.shop;
 const adId=url.searchParams.get("ad_id")||"";
 const handle=url.searchParams.get("product_handle")||"";
 if(!shop||!/^[0-9]{5,30}$/.test(adId)||!/^[a-z0-9][a-z0-9-]{0,250}$/.test(handle)){
   return Response.json({content:null},{headers:jsonHeaders});
 }
 const campaign=await prisma.campaign.findFirst({
   where:{shop,metaAdId:adId,productHandle:handle,status:"PUBLISHED"},
   orderBy:{updatedAt:"desc"},
   select:{id:true,shop:true,content:true,experiment:{select:{enabled:true}},image:{select:{publishedData:true}}}
 });
 if(url.searchParams.get("image")==="1"){
   if(!campaign?.image?.publishedData){
     return new Response(null,{status:404,headers:{"Cache-Control":"no-store"}});
   }
   return new Response(Buffer.from(campaign.image.publishedData),{
     headers:{"Content-Type":"image/webp","Cache-Control":"public, max-age=60",
       "X-Content-Type-Options":"nosniff"}
   });
 }
 const parsed=campaignContentSchema.safeParse(campaign?.content);
 const enabled=Boolean(campaign?.experiment?.enabled)&&parsed.success;
 const experiment=enabled&&campaign?{
   enabled:true,
   tokens:{A:issueEventToken(campaign,"A"),B:issueEventToken(campaign,"B")}
 }:{enabled:false};
 console.info("[AdMorph proxy] personalized request",{shop,matched:parsed.success});
 return Response.json({
   content:parsed.success?parsed.data:null,
   imageAvailable:Boolean(campaign?.image?.publishedData),
   experiment
 },{headers:jsonHeaders});
};
export const action=async({request}:ActionFunctionArgs)=>{
 const {session}=await authenticate.public.appProxy(request);
 if(!session?.shop||request.method!=="POST")return Response.json({ok:false},{status:403,headers:jsonHeaders});
 const size=Number(request.headers.get("content-length")||0);
 if(size>4096)return Response.json({ok:false},{status:413,headers:jsonHeaders});
 try{
   const raw=await request.text();
   if(raw.length>4096)return Response.json({ok:false},{status:413,headers:jsonHeaders});
   const data=JSON.parse(raw);
   // Token signature binds shop, campaign, assigned arm and expiration.
   const ok=await recordEvent(data.token,data.kind,data.key,session.shop);
   return Response.json({ok},{headers:jsonHeaders});
 }catch{return Response.json({ok:false},{status:400,headers:jsonHeaders});}
};
