import {z} from "zod";
import {variantSchema} from "./variant";

/** Structured creative + story layout. Merchant-authored claims remain subject to review. */
export const experienceSchema=z.object({
 version:z.literal("2.0"),
 angle:z.string().min(3).max(90),
 layout:z.enum(["editorial","minimal","bold"]),
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

/** Already-published v1 campaigns remain valid and render without migration. */
export const campaignContentSchema=z.union([experienceSchema,variantSchema]);
export type CampaignContent=z.infer<typeof campaignContentSchema>;
export function isExperience(data:unknown):data is Experience{
 return experienceSchema.safeParse(data).success;
}
export function hasValidCampaignContent(data:unknown):boolean{
 return campaignContentSchema.safeParse(data).success;
}
