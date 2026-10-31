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
