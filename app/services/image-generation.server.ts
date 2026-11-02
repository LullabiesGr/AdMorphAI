import {metaCreativeCopy} from "./meta.server";
import {randomInt,randomUUID} from "node:crypto";
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

/**
 * Reference-driven campaign product photoshoot.
 * AI output is a creative visualization, never proof of exact product fidelity.
 */
export async function generateProductPhotoshoot(input:{
 product:{title:string;description:string;featuredImage?:{url:string}|null};
 adCreative:unknown;angle:string;palette:string;mood:string;
}):Promise<Buffer>{
 const key=process.env.OPENAI_API_KEY;
 if(!key)throw new Error("OPENAI_API_KEY is not configured");
 const source=input.product.featuredImage?.url;
 if(!source||!/^https:\/\/[^\s"'<>]+$/.test(source))throw new Error("This product needs a valid Shopify featured image for an AI photoshoot.");
 const creative=metaCreativeCopy(input.adCreative);
 const directions=[
  "Extreme low camera angle, sweeping cinematic depth and dramatic morning sunlight.",
  "Premium aerial editorial viewpoint with long shadows and bold geometric composition.",
  "Intimate close-up editorial composition with dramatic side lighting and rich environmental textures.",
  "Wide immersive landscape advertising composition, dynamic perspective and atmospheric motion.",
  "High-end studio-meets-location fashion campaign, sculptural lighting and unconventional framing.",
  "Golden hour backlit environmental portrait of the merchandise with strong negative space."
 ];
 const direction=directions[randomInt(directions.length)];
 const takeId=randomUUID();
 const prompt=[
  "Create a premium photographic ecommerce CAMPAIGN HERO using the supplied ORIGINAL PRODUCT PHOTO AS IMAGE REFERENCE.",
  "Make the original merchandise the undisputed main subject in an authentic lifestyle editorial photoshoot.",
  "Preserve its recognizable silhouette, colors, branding, logos, construction and distinguishing details as closely as possible.",
  "Do not replace the reference product with a different model. Do not invent visible features, specifications, endorsements or text.",
  "Build a coherent location, perspective, shadows and premium photographic lighting appropriate to this advertisement.",
  "IMPORTANT: this is a NEW alternative image, not a reproduction of any earlier output.",
  "Distinct creative take:",takeId,"Art direction:",direction,
  "Use this ad angle:",input.angle,"Mood:",input.mood,"Palette:",input.palette,
  "Product:",input.product.title.slice(0,120),
  "Verified merchant description:",input.product.description.slice(0,1200),
  "Meta creative:",(creative.headline+" "+creative.body).slice(0,500),
  "Generate a striking wide editorial hero without text or logos added to the scene.",
  "Output is an AI visualization for merchant review, not a documentary photograph."
 ].join("\n");
 const response=await fetch("https://api.openai.com/v1/images/edits",{
  method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
  body:JSON.stringify({model:process.env.OPENAI_IMAGE_MODEL||"gpt-image-2.5-flare",
    images:[{image_url:source}],prompt,size:"1536x1024",n:1,quality:"high",
    output_format:"webp",output_compression:65}),
  signal:AbortSignal.timeout(180000)
 });
 const json=await response.json();
 if(!response.ok)throw new Error("AI product photoshoot: "+String(json?.error?.message||response.statusText).slice(0,250));
 const b64=json?.data?.[0]?.b64_json;
 if(typeof b64!=="string"||b64.length>3_000_000)throw new Error("AI photoshoot output missing or too large.");
 const bytes=Buffer.from(b64,"base64");
 if(bytes.length>IMAGE_MAX_BYTES||bytes.length<1000||bytes.toString("hex",0,4)!=="52494646"||
   bytes.toString("ascii",8,12)!=="WEBP")throw new Error("AI photoshoot must return a WebP under 1.75 MB.");
 return bytes;
}
