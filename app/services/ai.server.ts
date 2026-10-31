import {metaCreativeCopy} from "./meta.server";
import {experienceSchema,type Experience} from "../lib/experience";

const textField={type:"string"} as const;
const jsonSchema={
 type:"object",additionalProperties:false,
 properties:{
   version:{type:"string",enum:["2.0"]},
   angle:textField,
   layout:{type:"string",enum:["editorial","minimal","bold"]},
   hero:{type:"object",additionalProperties:false,properties:{
     eyebrow:textField,headline:textField,subheadline:textField
   },required:["eyebrow","headline","subheadline"]},
   highlights:{type:"array",items:{type:"object",additionalProperties:false,
     properties:{title:textField,text:textField},required:["title","text"]}},
   styleMoments:{type:"array",items:{type:"object",additionalProperties:false,
     properties:{label:textField,title:textField,text:textField},required:["label","title","text"]}},
   adConnection:{type:"object",additionalProperties:false,
     properties:{title:textField,text:textField},required:["title","text"]},
   cta:{type:"object",additionalProperties:false,
     properties:{primary:textField,secondary:textField},required:["primary","secondary"]}
 },
 required:["version","angle","layout","hero","highlights","styleMoments","adConnection","cta"]
};
export async function generateExperience(input:{
 product:{title:string,description:string},
 adCreative:unknown
}):Promise<Experience>{
 const key=process.env.OPENAI_API_KEY;
 if(!key)throw new Error("OPENAI_API_KEY is not configured");
 const ad=metaCreativeCopy(input.adCreative);
 const context=JSON.stringify({
  verifiedProduct:{title:input.product.title,description:input.product.description.slice(0,5200)},
  metaAd:{body:ad.body,headline:ad.headline}
 });
 const prompt=[
  "You design high-quality, ad-matched Shopify product-page experiences, not ordinary descriptions.",
  "Generate a premium, structured experience that continues the specific creative angle of the Meta advertisement.",
  "A clean editorial layout should communicate the product's value visually through a headline, 3 distinct benefit cards, 3 relevant style/use-case moments, and an ad-to-product connection.",
  "Choose layout: editorial for fashion/lifestyle, minimal for straightforward products, bold for energetic campaigns. Keep sections useful, not repetitive.",
  "All statements must be supported by the VERIFIED PRODUCT title/description. The ad can define tone and audience intent but is not proof of a product feature.",
  "Never invent fabric, fit, materials, dimensions, usage guarantees, prices, shipping, scarcity, discounts, ratings, reviews, or testimonials.",
  "Style moments are suggestions for use or pairing, NOT claims about the product; avoid specific claims not established by the merchant.",
  "Avoid duplicating the original product title. Write short differentiated copy. Match the ad's language. No fake urgency or manipulative tactics.",
  "The CTA text is only for an optional scroll-to-purchase link, not a new checkout. secondary may be an empty string.",
  "Return exactly 3 highlights and exactly 3 styleMoments. Merchant approval is required before publication.",
  "Context:",context
 ].join("\n");
 const baseContent:Array<{type:"input_text";text:string}|{type:"input_image";image_url:string;detail:"low"}>=[
  {type:"input_text",text:prompt}
 ];
 if(/^https:\/\//.test(ad.imageUrl)&&ad.imageUrl.length<2000){
   baseContent.push({type:"input_image",image_url:ad.imageUrl,detail:"low"});
 }
 async function request(content:typeof baseContent):Promise<Experience>{
   const response=await fetch("https://api.openai.com/v1/responses",{
     method:"POST",
     headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},
     body:JSON.stringify({
       model:process.env.OPENAI_MODEL||"gpt-4.1-mini",
       input:[{role:"user",content}],
       max_output_tokens:2000,
       text:{format:{type:"json_schema",name:"admorph_experience_v2",strict:true,schema:jsonSchema}}
     }),
     signal:AbortSignal.timeout(60000)
   });
   const data=await response.json();
   if(!response.ok)throw new Error("OpenAI: "+(data.error?.message||response.statusText));
   const text=(data.output||[]).flatMap((o:{content?:Array<{type:string;text?:string}>})=>o.content||[]).find((c:{type:string})=>c.type==="output_text")?.text;
   if(!text)throw new Error("OpenAI did not return generated experience");
   return experienceSchema.parse(JSON.parse(text));
 }
 try{return await request(baseContent);}
 catch(error){
   if(baseContent.length===1)throw error;
   // Meta image URLs can expire; text-only retry is safe and preserves behavior.
   return await request(baseContent.slice(0,1));
 }
}
