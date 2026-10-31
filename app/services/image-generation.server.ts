import {metaCreativeCopy} from "./meta.server";
const IMAGE_MAX_BYTES=1_750_000;
export async function generateCampaignBackdrop(input:{
 product:{title:string;description:string};
 adCreative:unknown;
 angle:string;
 palette:string;
 mood:string;
}):Promise<Buffer>{
 const key=process.env.OPENAI_API_KEY;
 if(!key)throw new Error("OPENAI_API_KEY is not configured");
 const ad=metaCreativeCopy(input.adCreative);
 const prompt=[
  "Create an original, sophisticated ABSTRACT ecommerce background texture.",
  "No products of any kind, no garments, no people, no skin, no objects, no logos, no words, no text, no symbols, no brands.",
  "This is background artwork only. The ACTUAL Shopify product photograph will be displayed separately and must remain unedited.",
  "Wide horizontal composition with gentle visual motion, nuanced light, sophisticated texture, generous negative space.",
  "Premium art direction, subtle, realistic materials or graphic shapes, no distracting details.",
  "Palette:",input.palette,"Mood:",input.mood,
  "Creative angle:",input.angle,
  "Product category context (only to select aesthetic):",input.product.title.slice(0,120),
  "Meta ad tone:",(ad.headline+" "+ad.body).slice(0,400)
 ].join(" ");
 const result=await fetch("https://api.openai.com/v1/images/generations",{
  method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
  body:JSON.stringify({
    model:process.env.OPENAI_IMAGE_MODEL||"gpt-image-2.5-flare",
    prompt, size:"1536x1024",n:1,quality:"medium",
    output_format:"webp",output_compression:65
  }),
  signal:AbortSignal.timeout(125000)
 });
 const json=await result.json();
 if(!result.ok)throw new Error("OpenAI image API: "+String(json?.error?.message||result.statusText).slice(0,250));
 const b64=json?.data?.[0]?.b64_json;
 if(typeof b64!=="string"||b64.length>3_000_000)throw new Error("AI image response missing or larger than supported.");
 const bytes=Buffer.from(b64,"base64");
 if(bytes.length>IMAGE_MAX_BYTES||bytes.length<1000)throw new Error("Generated image exceeds 1.75 MB limit.");
 if(bytes.toString("hex",0,4)!=="52494646"||bytes.toString("ascii",8,12)!=="WEBP")
   throw new Error("AI image output was not a valid WebP file.");
 return bytes;
}
