import {metaCreativeCopy} from "./meta.server";
import {experienceSchema,type Experience,type VisualDirection} from "../lib/experience";
import {normalizeVisualDirection} from "../lib/visual-direction";

const textField={type:"string"} as const;
const jsonSchema={
 type:"object",additionalProperties:false,
 properties:{
   version:{type:"string",enum:["2.0"]},
   angle:textField,
   layout:{type:"string",enum:["editorial","minimal","bold"]},
   visual:{type:"object",additionalProperties:false,properties:{
     composition:{type:"string",enum:["split","spotlight","gallery"]},
     palette:{type:"string",enum:["sand","slate","rose","sage","midnight"]},
     imageFit:{type:"string",enum:["cover","contain"]},
     mood:textField,rationale:textField
   },required:["composition","palette","imageFit","mood","rationale"]},
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
 required:["version","angle","layout","visual","hero","highlights","styleMoments","adConnection","cta"]
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
  "Design the VISUAL direction according to the ad image and ad text: composition split (balanced), spotlight (image-led), or gallery (image first with text below).",
  "Choose palette sand, slate, rose, sage or midnight; imageFit cover or contain based on the product image, and a short mood and rationale describing why the visual direction matches the ad.",
  "Visual direction always uses the real verified Shopify product image. It must never invent a different product or imply that an AI-generated lifestyle photograph is the actual product.",
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
   const generated=JSON.parse(text);
   if(generated&&typeof generated==="object"&&generated.visual)
     generated.visual=normalizeVisualDirection(generated.visual);
   return experienceSchema.parse(generated);
 }
 try{return await request(baseContent);}
 catch(error){
   if(baseContent.length===1)throw error;
   // Meta image URLs can expire; text-only retry is safe and preserves behavior.
   return await request(baseContent.slice(0,1));
 }
}

/** Regenerate ONLY the visual direction, preserving all merchant-approved text. */
export async function generateVisualDirection(input:{
 product:{title:string,description:string},
 adCreative:unknown,
 experience:Experience
}):Promise<VisualDirection>{
 const key=process.env.OPENAI_API_KEY;
 if(!key)throw new Error("OPENAI_API_KEY is not configured");
 const ad=metaCreativeCopy(input.adCreative);
 const prompt=[
   "You are an art director for a Shopify store. Choose an editorial visual system for one existing ad-matched campaign.",
   "Respond with short design mood, rationale, composition, palette and imageFit.",
   "IMPORTANT: mood must be at most 65 characters, rationale at most 200 characters.",
   "The ACTUAL product photo from Shopify will be used, not AI-generated or altered merchandise.",
   "Only use the palette values sand, slate, rose, sage, midnight.",
   "Only use composition split, spotlight or gallery. Only use imageFit cover or contain.",
   "Preserve product accuracy; do not describe imaginary colors, people, styling or photographic properties.",
   JSON.stringify({product:{title:input.product.title,description:input.product.description.slice(0,2000)},
     ad:{headline:ad.headline,body:ad.body},
     experience:{angle:input.experience.angle,headline:input.experience.hero.headline}})
 ].join("\n");
 const content:Array<{type:"input_text";text:string}|{type:"input_image";image_url:string;detail:"low"}>=[
   {type:"input_text",text:prompt}
 ];
 if(/^https:\/\//.test(ad.imageUrl)&&ad.imageUrl.length<2000)
   content.push({type:"input_image",image_url:ad.imageUrl,detail:"low"});
 const schema={
   type:"object",additionalProperties:false,
   properties:{
     composition:{type:"string",enum:["split","spotlight","gallery"]},
     palette:{type:"string",enum:["sand","slate","rose","sage","midnight"]},
     imageFit:{type:"string",enum:["cover","contain"]},
     mood:{type:"string"},rationale:{type:"string"}
   },required:["composition","palette","imageFit","mood","rationale"]
 };
 const run=async(parts:typeof content)=>{
   const response=await fetch("https://api.openai.com/v1/responses",{
     method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},
     body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4.1-mini",
       input:[{role:"user",content:parts}],max_output_tokens:550,
       text:{format:{type:"json_schema",name:"admorph_visual_direction",strict:true,schema}}}),
     signal:AbortSignal.timeout(60000)
   });
   const data=await response.json();
   if(!response.ok)throw new Error("OpenAI visual direction: "+(data.error?.message||response.statusText));
   const text=(data.output||[]).flatMap((x:{content?:Array<{type:string;text?:string}>})=>x.content||[])
     .find((x:{type:string})=>x.type==="output_text")?.text;
   if(!text)throw new Error("OpenAI did not provide art direction");
   return normalizeVisualDirection(JSON.parse(text));
 };
 try{return await run(content);}catch(error){
   if(content.length===1)throw error;
   return await run(content.slice(0,1));
 }
}
