import {z} from "zod";

/** Design direction is a controlled, product-safe visual system; no synthetic product photos. */
export const visualDirectionSchema=z.object({
 composition:z.enum(["split","spotlight","gallery"]),
 palette:z.enum(["sand","slate","rose","sage","midnight"]),
 imageFit:z.enum(["cover","contain"]),
 mood:z.string().min(3).max(65),
 rationale:z.string().min(12).max(200)
});
export type VisualDirection=z.infer<typeof visualDirectionSchema>;
export const defaultVisualDirection:VisualDirection={
 composition:"split",palette:"sand",imageFit:"cover",
 mood:"Editorial",rationale:"A neutral product-led layout using the original Shopify product photography."
};
export function resolveVisualDirection(data:{visual?:VisualDirection}):VisualDirection{
 return data.visual||defaultVisualDirection;
}


/** Convert LLM explanations to stable, merchant-safe lengths before validation. */
export function normalizeVisualDirection(input:unknown):VisualDirection{
 const raw=input&&typeof input==="object"&&!Array.isArray(input)?input as Record<string,unknown>:{};
 const bound=(value:unknown,min:number,max:number,fallback:string)=>{
  const text=typeof value==="string"?value.trim():"";
  return (text.length<min?fallback:text).slice(0,max);
 };
 return visualDirectionSchema.parse({
  composition:raw.composition,
  palette:raw.palette,
  imageFit:raw.imageFit,
  mood:bound(raw.mood,3,65,defaultVisualDirection.mood),
  rationale:bound(raw.rationale,12,200,defaultVisualDirection.rationale)
 });
}
