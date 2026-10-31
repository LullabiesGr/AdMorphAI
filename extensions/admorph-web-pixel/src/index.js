import {register} from "@shopify/web-pixels-extension";

register(({analytics,browser,settings})=>{
 const key="admorph_active_experiment";
 const endpoint="https://admorphai.onrender.com/api/admorph-pixel";
 const shop=String(settings?.shop||"");
 if(!/^[a-z0-9-]+\.myshopify\.com$/.test(shop))return;

 async function report(kind,token,eventId){
  if(typeof token!=="string"||token.length>1024)return;
  const suffix=String(eventId||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,65);
  if(suffix.length<10)return;
  const payload={token,kind,key:kind+"-"+suffix};
  try{
   await fetch(endpoint,{method:"POST",mode:"cors",
     headers:{"Content-Type":"text/plain"},
     body:JSON.stringify(payload),keepalive:true});
  }catch(_){/* Tracking errors never affect the purchase journey. */}
 }
 analytics.subscribe("admorph:experiment_exposure",async event=>{
  const token=event.customData?.token;
  if(typeof token!=="string")return;
  await browser.sessionStorage.setItem(key,token);
  await report("view",token,event.id);
 });
 analytics.subscribe("admorph:experiment_cta",async event=>{
  const token=event.customData?.token;
  await report("cta",token,event.id);
 });
 analytics.subscribe("product_added_to_cart",async event=>{
  const token=await browser.sessionStorage.getItem(key);
  await report("cart",token,event.id);
 });
 analytics.subscribe("checkout_completed",async event=>{
  const token=await browser.sessionStorage.getItem(key);
  await report("purchase",token,event.id);
 });
});
