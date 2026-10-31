import { createHmac } from "node:crypto";
import db from "../db.server";
import { encrypt, decrypt } from "./crypto.server";

function config() {
 const appId=process.env.META_APP_ID, secret=process.env.META_APP_SECRET;
 if(!appId||!secret) throw new Error("Meta API is not configured");
 const version=process.env.META_GRAPH_VERSION || "v26.0";
 if(!/^v[0-9]+\.[0-9]+$/.test(version)) throw new Error("Invalid Meta Graph API version");
 return {appId,secret,version};
}
export function metaRedirectUri() {
 const url=process.env.SHOPIFY_APP_URL;
 if(!url||!url.startsWith("https://")) throw new Error("HTTPS SHOPIFY_APP_URL is required for Meta OAuth");
 return url.replace(/\/$/,"")+"/auth/meta/callback";
}
export function metaAuthorizeUrl(state:string) {
 const {appId,version}=config();
 const u=new URL("https://www.facebook.com/"+version+"/dialog/oauth");
 u.searchParams.set("client_id",appId);
 u.searchParams.set("redirect_uri",metaRedirectUri());
 u.searchParams.set("scope","ads_read");
 u.searchParams.set("state",state);
 u.searchParams.set("response_type","code");
 return u.toString();
}
async function graph(path:string,token?:string,params:Record<string,string>={}) {
 const {version,secret}=config();
 const u=new URL("https://graph.facebook.com/"+version+"/"+path.replace(/^\//,""));
 for(const [key,value] of Object.entries(params)) u.searchParams.set(key,value);
 const headers:Record<string,string>={"Accept":"application/json"};
 if(token) {
   headers.Authorization="Bearer "+token;
   u.searchParams.set("appsecret_proof",createHmac("sha256",secret).update(token).digest("hex"));
 }
 const res=await fetch(u,{headers,signal:AbortSignal.timeout(15000)});
 const data=await res.json();
 if(!res.ok||data.error) throw new Error("Meta API: "+(data.error?.message||res.statusText));
 return data;
}
export async function exchangeMetaCode(code:string) {
 const {appId,secret}=config();
 const short=await graph("oauth/access_token",undefined,{
    client_id:appId,client_secret:secret,redirect_uri:metaRedirectUri(),code
 });
 const long=await graph("oauth/access_token",undefined,{
    grant_type:"fb_exchange_token",client_id:appId,client_secret:secret,fb_exchange_token:short.access_token
 });
 const data=long.access_token ? long : short;
 if(!data.access_token) throw new Error("Meta did not return an access token");
 return {token:String(data.access_token),expiresAt:data.expires_in ? new Date(Date.now()+Number(data.expires_in)*1000):null};
}
export async function listMetaAccounts(token:string) {
 const d=await graph("me/adaccounts",token,{fields:"id,name,account_status",limit:"100"});
 return (d.data||[]).map((a:any)=>({id:String(a.id),name:String(a.name||a.id),status:Number(a.account_status||0)}));
}
export async function connectMeta(shop:string,code:string) {
 const {token,expiresAt}=await exchangeMetaCode(code);
 const accounts=await listMetaAccounts(token);
 await db.shop.upsert({where:{domain:shop},create:{domain:shop},update:{}});
 await db.metaConnection.upsert({
  where:{shop},
  create:{shop,encryptedToken:encrypt(token),tokenExpiresAt:expiresAt,accounts},
  update:{encryptedToken:encrypt(token),tokenExpiresAt:expiresAt,accounts,selectedAccountId:null}
 });
 return accounts;
}
export async function getMetaToken(shop:string) {
 const c=await db.metaConnection.findUnique({where:{shop}});
 if(!c) throw new Error("Connect Meta first");
 if(c.tokenExpiresAt && c.tokenExpiresAt.getTime()<=Date.now()+60000) throw new Error("Meta token expired. Reconnect Meta.");
 return {token:decrypt(c.encryptedToken),connection:c};
}
export function metaCreativeCopy(creative:any) {
 const story=creative?.object_story_spec||{};
 const link=story.link_data||{};
 const video=story.video_data||{};
 return {
   body:String(link.message||video.message||creative?.body||"").slice(0,3000),
   headline:String(link.name||video.title||creative?.title||"").slice(0,500),
   imageUrl:String(creative?.image_url||creative?.thumbnail_url||"").slice(0,2000),
   destination:String(link.link||video.call_to_action?.value?.link||"").slice(0,2000),
 };
}
export async function importMetaAds(shop:string) {
 const {token,connection}=await getMetaToken(shop);
 if(!connection.selectedAccountId) throw new Error("Select a Meta ad account first");
 const account=connection.selectedAccountId;
 if(!/^act_[0-9]+$/.test(account)) throw new Error("Invalid account ID");
 const d=await graph(account+"/ads",token,{
   fields:"id,name,effective_status,creative{id,name,title,body,image_url,thumbnail_url,object_story_spec}",
   limit:"50"
 });
 const ads=(d.data||[]) as any[];
 await db.$transaction(ads.map(ad=>db.metaAd.upsert({
    where:{shop_adId:{shop,adId:String(ad.id)}},
    create:{shop,adId:String(ad.id),accountId:account,name:String(ad.name||ad.id),status:String(ad.effective_status||"UNKNOWN"),creative:ad.creative||{}},
    update:{name:String(ad.name||ad.id),status:String(ad.effective_status||"UNKNOWN"),creative:ad.creative||{}}
 })));
 return {count:ads.length,hasMore:Boolean(d.paging?.next)};
}
