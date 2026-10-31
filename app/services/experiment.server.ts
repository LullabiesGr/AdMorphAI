import {createHmac,timingSafeEqual,randomBytes} from "node:crypto";
import prisma from "../db.server";
const secret=()=>process.env.SHOPIFY_API_SECRET||"";
type Arm="A"|"B";
type Kind="view"|"cta"|"cart"|"purchase";
type Token={id:string;shop:string;arm:Arm;exp:number;nonce:string};
function sign(v:string):string{return createHmac("sha256",secret()).update(v).digest("base64url");}
export function issueEventToken(campaign:{id:string;shop:string},arm:Arm):string{
 if(!secret())throw new Error("Shopify secret is not configured");
 const data:Token={id:campaign.id,shop:campaign.shop,arm,exp:Date.now()+24*60*60*1000,nonce:randomBytes(12).toString("hex")};
 const payload=Buffer.from(JSON.stringify(data)).toString("base64url");
 return payload+"."+sign(payload);
}
export function parseEventToken(token:unknown):Token|null{
 if(!secret()||typeof token!=="string"||token.length>1024)return null;
 const p=token.split(".");
 if(p.length!==2||p[1].length!==43)return null;
 const signed=sign(p[0]);
 if(signed.length!==p[1].length||!timingSafeEqual(Buffer.from(signed),Buffer.from(p[1])))return null;
 try{
  const value=JSON.parse(Buffer.from(p[0],"base64url").toString("utf8")) as Token;
  if(!/^[a-z0-9]{8,40}$/i.test(value.id)||!/^[a-z0-9.-]{5,120}$/i.test(value.shop)||!["A","B"].includes(value.arm))return null;
  if(!Number.isFinite(value.exp)||value.exp<Date.now()||value.exp>Date.now()+86_500_000)return null;
  if(!/^[a-f0-9]{24}$/.test(value.nonce))return null;
  return value;
 }catch{return null;}
}
export async function recordEvent(token:unknown,kind:unknown,key:unknown):Promise<boolean>{
 const parsed=parseEventToken(token);
 if(!parsed||!["view","cta","cart","purchase"].includes(String(kind)))return false;
 if(typeof key!=="string"||!/^[a-zA-Z0-9_:-]{10,130}$/.test(key))return false;
 const campaign=await prisma.campaign.findFirst({
  where:{id:parsed.id,shop:parsed.shop,status:"PUBLISHED"},
  select:{id:true,experiment:true}
 });
 if(!campaign||!campaign.experiment?.enabled)return false;
 try{
  await prisma.campaignEvent.create({data:{
    campaignId:campaign.id,shop:parsed.shop,arm:parsed.arm,kind:String(kind),eventKey:key
  }});
  return true;
 }catch(e){
  // Replayed client events are deduplicated by unique idempotency key.
  if((e as {code?:string}).code==="P2002")return true;
  throw e;
 }
}
export async function experimentReport(shop:string,ids:string[]){
 if(!ids.length)return {};
 const rows=await prisma.campaignEvent.groupBy({
  by:["campaignId","arm","kind"],where:{shop,campaignId:{in:ids}},
  _count:{_all:true}
 });
 const results:Record<string,Record<string,Record<string,number>>>={};
 for(const x of rows){
  results[x.campaignId]??={};
  results[x.campaignId][x.arm]??={};
  results[x.campaignId][x.arm][x.kind]=x._count._all;
 }
 return results;
}
