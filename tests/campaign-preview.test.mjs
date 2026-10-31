import test from "node:test";
import assert from "node:assert/strict";
import {selectPreviewContent,groupByImportedAd} from "../app/lib/campaign-preview.ts";

test("published legacy content remains visible until it has a staged replacement",()=>{
 const old={headline:"Legacy",benefits:["A","B","C"]};
 assert.deepEqual(selectPreviewContent({content:old,draftContent:null}),old);
});
test("V2 draft is preferred for preview without mutating live content",()=>{
 const live={headline:"Old live experience"};
 const draft={version:"2.0",hero:{headline:"New experience"}};
 const campaign={content:live,draftContent:draft};
 assert.equal(selectPreviewContent(campaign),draft);
 assert.equal(campaign.content,live);
});
test("campaigns without content show no AI preview",()=>{
 assert.equal(selectPreviewContent({content:null,draftContent:null}),null);
});
test("every imported Meta ad stays visible even without a linked campaign",()=>{
 const ads=[{id:"100",name:"Ad one"},{id:"200",name:"Ad two"},{id:"300",name:"Ad three"}];
 const linked=[{metaAdId:"100",id:"c1"},{metaAdId:"100",id:"c2"}];
 const grouped=groupByImportedAd(ads,linked);
 assert.equal(grouped.length,3);
 assert.equal(grouped[0].linked.length,2);
 assert.equal(grouped[1].linked.length,0);
 assert.equal(grouped[2].linked.length,0);
});

test("existing V2 campaigns remain supported without visual settings",async()=>{
 const {resolveVisualDirection}=await import("../app/lib/visual-direction.ts");
 const experience={version:"2.0",angle:"Urban layers",layout:"editorial"};
 assert.equal(resolveVisualDirection(experience).composition,"split");
 assert.equal(resolveVisualDirection(experience).palette,"sand");
});
test("visual direction allows only supported safe design presets",async()=>{
 const {visualDirectionSchema}=await import("../app/lib/visual-direction.ts");
 const good={composition:"gallery",palette:"rose",imageFit:"contain",
 mood:"Soft editorial",rationale:"Echo the ad creative while keeping the real Shopify product photo."};
 assert.equal(visualDirectionSchema.safeParse(good).success,true);
 assert.equal(visualDirectionSchema.safeParse({...good,palette:"evil-css"}).success,false);
});

test("AI visual rationale longer than 200 characters is clipped safely",async()=>{
 const {normalizeVisualDirection}=await import("../app/lib/visual-direction.ts");
 const result=normalizeVisualDirection({
   composition:"spotlight",palette:"sage",imageFit:"contain",
   mood:"An incredibly detailed visual direction ".repeat(10),
   rationale:"This ad needs a grounded but elegant editorial layout. ".repeat(10)
 });
 assert.equal(result.mood.length,65);
 assert.equal(result.rationale.length,200);
});
test("AI explanation too short is replaced with safe, human-readable fallback",async()=>{
 const {normalizeVisualDirection}=await import("../app/lib/visual-direction.ts");
 const result=normalizeVisualDirection({
   composition:"split",palette:"sand",imageFit:"cover",mood:"",rationale:"ok"
 });
 assert.ok(result.mood.length>=3);
 assert.ok(result.rationale.length>=12);
});
