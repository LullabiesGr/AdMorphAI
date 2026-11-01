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
  "Create a premium, photorealistic, full-bleed editorial LIFESTYLE ENVIRONMENT for an ecommerce product hero.",
  "Depict a believable environment inspired by the advertisement and its use occasion; architectural spaces, natural landscapes or contextual props are allowed.",
  "DO NOT create, replicate, alter, illustrate or imply any specific merchandise. No identifiable merchandise, no brand logos, no words, no claims, no prices.",
  "The exact verified Shopify product photo will be composited as a separate foreground layer by the storefront. Leave generous clean central negative space for that image. Do not invent product details.",
  "Cinematic wide composition, convincing depth, coherent lighting, compelling scene, clear product-safe negative space, not an abstract texture.",
  "Premium campaign art direction and an unmistakable lifestyle atmosphere. Avoid confusing decorative objects with the offered product.",
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
