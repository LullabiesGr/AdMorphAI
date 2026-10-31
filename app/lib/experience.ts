import {z} from "zod";
import {variantSchema} from "./variant";

/** Structured creative + story layout. Merchant-authored claims remain subject to review. */
export const experienceSchema=z.object({
 version:z.literal("2.0"),
 angle:z.string().min(3).max(90),
 layout:z.enum(["editorial","minimal","bold"]),
 visual:visualDirectionSchema.optional(),
 hero:z.object({
   eyebrow:z.string().min(2).max(52),
   headline:z.string().min(8).max(120),
   subheadline:z.string().min(15).max(225)
 }),
 highlights:z.array(z.object({
   title:z.string().min(3).max(52),
   text:z.string().min(8).max(160)
 })).length(3),
 styleMoments:z.array(z.object({
   label:z.string().min(2).max(32),
   title:z.string().min(3).max(64),
   text:z.string().min(8).max(170)
 })).length(3),
 adConnection:z.object({
   title:z.string().min(3).max(72),
   text:z.string().min(10).max(220)
 }),
 cta:z.object({
   primary:z.string().min(3).max(50),
   secondary:z.string().max(80)
 })
});
export type Experience=z.infer<typeof experienceSchema>;

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

/** Already-published v1 campaigns remain valid and render without migration. */
export const campaignContentSchema=z.union([experienceSchema,variantSchema]);
export type CampaignContent=z.infer<typeof campaignContentSchema>;
export function isExperience(data:unknown):data is Experience{
 return experienceSchema.safeParse(data).success;
}
export function hasValidCampaignContent(data:unknown):boolean{
 return campaignContentSchema.safeParse(data).success;
}
