import { z } from "zod";
import { metaCreativeCopy } from "./meta.server";

export const variantSchema=z.object({
 headline:z.string().min(8).max(130),
 subheadline:z.string().min(15).max(240),
 benefits:z.array(z.string().min(5).max(150)).length(3),
 cta:z.string().min(3).max(50)
});
export type Variant=z.infer<typeof variantSchema>;
const jsonSchema={
 type:"object",additionalProperties:false,
 properties:{
   headline:{type:"string"},
   subheadline:{type:"string"},
   benefits:{type:"array",items:{type:"string"}},
   cta:{type:"string"}
 },
 required:["headline","subheadline","benefits","cta"]
};
export async function generateVariant(input:{
 product:{title:string,description:string},
 adCreative:unknown
}):Promise<Variant> {
 const key=process.env.OPENAI_API_KEY;
 if(!key) throw new Error("OPENAI_API_KEY is not configured");
 const ad=metaCreativeCopy(input.adCreative);
 const description=input.product.description.slice(0,4500);
 const context=JSON.stringify({product:{title:input.product.title,description},ad:{body:ad.body,headline:ad.headline}});
 const prompt="You are a Shopify conversion copywriter. Produce a differentiated, concise product-page messaging block matching the paid ad's angle. Only state facts supported by the product title and description. Never invent guarantees, medical claims, discounts, price, shipping promises, availability, ratings, or testimonials. If the product does not support the ad claim, write cautious neutral copy instead. Use the source language of the ad where possible. The merchant must approve before publication. Data: "+context;
 const baseContent:any[]=[{type:"input_text",text:prompt}];
 if(/^https:\/\//.test(ad.imageUrl)&&ad.imageUrl.length<2000) baseContent.push({type:"input_image",image_url:ad.imageUrl,detail:"low"});
 const makeRequest=async (content:any[])=>{
   const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},
      body:JSON.stringify({
        model:process.env.OPENAI_MODEL||"gpt-4.1-mini",
        input:[{role:"user",content}],
        max_output_tokens:900,
        text:{format:{type:"json_schema",name:"admorph_variant",strict:true,schema:jsonSchema}}
      }),
      signal:AbortSignal.timeout(45000)
   });
   const data=await response.json();
   if(!response.ok) throw new Error("OpenAI: "+(data.error?.message||response.statusText));
   const text=(data.output||[]).flatMap((o:any)=>o.content||[]).find((c:any)=>c.type==="output_text")?.text;
   if(!text) throw new Error("OpenAI did not return generated text");
   return variantSchema.parse(JSON.parse(text));
 };
 try {return await makeRequest(baseContent);}
 catch(e) {
   // Meta image URL may be expired or inaccessible to OpenAI. Text-only fallback.
   if(baseContent.length===1) throw e;
   return await makeRequest(baseContent.slice(0,1));
 }
}
