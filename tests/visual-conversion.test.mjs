import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const base="../";
const read=(file)=>readFileSync(new URL(base+file,import.meta.url),"utf8");
test("Web Pixel requires analytics privacy consent and reads only Shopify standard events",()=>{
 const config=read("extensions/admorph-web-pixel/shopify.extension.toml");
 const pixel=read("extensions/admorph-web-pixel/src/index.js");
 assert.match(config,/type = "web_pixel_extension"/);
 assert.match(config,/analytics = true/);
 for(const kind of ["admorph:experiment_exposure","admorph:experiment_cta","product_added_to_cart","checkout_completed"])
   assert.ok(pixel.includes('subscribe("'+kind+'"'));
 assert.ok(!pixel.includes("event.data.checkout.email"));
 assert.ok(!pixel.includes("event.data.customer.email"));
});
test("AI imagery is generated as decorative backdrop only",()=>{
 const source=read("app/services/image-generation.server.ts");
 assert.match(source,/no garments, no people/i);
 assert.match(source,/output_format:"webp"/);
 assert.match(source,/gpt-image-2.5-flare/);
 const storefront=read("extensions/admorph-theme/assets/admorph.js");
 assert.ok(storefront.includes("admorph-ai-backdrop"));
 assert.ok(storefront.includes('data-product-image'));
 assert.ok(storefront.includes('admorph-visual-'));
});
test("Experiment control does not show AI content and analytics respects privacy",()=>{
 const storefront=read("extensions/admorph-theme/assets/admorph.js");
 assert.match(storefront,/analyticsProcessingAllowed/);
 assert.match(storefront,/group\.arm==="A"/);
 assert.match(storefront,/root\.hidden=true/);
 assert.match(storefront,/admorph:experiment_exposure/);
});
test("Pixel events require signed shop-specific expiring token",()=>{
 const backend=read("app/services/experiment.server.ts");
 assert.match(backend,/createHmac/);
 assert.match(backend,/timingSafeEqual/);
 assert.match(backend,/exp:Date\.now\(\)\+24\*60\*60\*1000/);
 assert.match(backend,/parsed\.shop!==expectedShop/);
 assert.match(backend,/eventKey:String\(key\)/);
});
