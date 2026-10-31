import { z } from "zod";
export const variantSchema=z.object({
 headline:z.string().min(8).max(130),
 subheadline:z.string().min(15).max(240),
 benefits:z.array(z.string().min(5).max(150)).length(3),
 cta:z.string().min(3).max(50)
});
export type Variant=z.infer<typeof variantSchema>;
