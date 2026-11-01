import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const script=readFileSync(new URL("../extensions/admorph-theme/assets/admorph.js",import.meta.url),"utf8");
const liquid=readFileSync(new URL("../extensions/admorph-theme/blocks/admorph-autopilot.liquid",import.meta.url),"utf8");
const rendererScript=readFileSync(new URL("../extensions/admorph-theme/assets/admorph-render.js",import.meta.url),"utf8");

function mockElement(tag){
 return {tagName:tag.toUpperCase(),children:[],textContent:"",className:"",
    classList:{add(name){this.lastAdded=name;}},addEventListener(name,handler){this["on"+name]=handler;},
    appendChild(child){this.children.push(child);return child;},
    replaceChildren(...children){this.children=children;},
    setAttribute(name,value){this[name]=value;}};
}
async function runStorefront({query="",withManual=false,v2=false,visual=null,immersive=false,withPurchase=true}={}){
 const events={};
 const requestUrls=[];
 const makeRoot=(automatic)=>({
    classList:{contains(name){return automatic&&name==="admorph-auto-slot";},add(name){this.added=name;}},
    getAttribute(name){return name==="data-admorph-immersive"?(immersive?"true":"false"):name==="data-admorph-renderer-url"?"https://cdn.shopify.com/extensions/admorph-render.js":name==="data-product-handle"?"city-line-trench":name==="data-admorph-placement"?"after_title":name==="data-product-image"?"https://cdn.shopify.com/s/files/test.jpg":name==="data-product-image-alt"?"City Line Trench":null;},
    dataset:{},hidden:true,isConnected:true,previousElementSibling:null,
    querySelector(selector){return selector===".admorph-shopify-gallery"&&immersive?{
       content:{querySelectorAll(){return [
         {getAttribute(k){return k==="data-src"?"https://cdn.shopify.com/s/files/test.jpg":"Main view";}},
         {getAttribute(k){return k==="data-src"?"https://cdn.shopify.com/s/files/real-back.jpg":"Back view";}}
       ];}}
     }:null;},
    replaceChildren(...items){this.nodes=items;},
    setAttribute(name,value){this[name]=value;}
 });
 const auto=makeRoot(true),manual=withManual?makeRoot(false):null;
 const anchor={parentNode:{},insertAdjacentElement(position,element){element.movedAfterTitle=position==="afterend";}};
 const main={contains(node){return node===section;}};
 const section={parentNode:main,insertAdjacentElement(position,node){node.immersivePositioned=position==="beforebegin";}};
 const purchase={closest(){return section;},scrollIntoView(){this.scrolled=true;},focus(){this.focused=true;}};
 let ctx;
 const document={
   readyState:"complete",
   head:{appendChild(script){
     setImmediate(()=>{
       vm.runInContext(rendererScript,ctx);
       if(typeof script.onload==="function")script.onload();
     });
     return script;
   }},
   querySelector(selector){
     if(selector==="main")return main;
     if(selector==='main form[action*="/cart/add"]')return withPurchase?purchase:null;
     return selector==="main h1"?anchor:null;
   },
   querySelectorAll(selector){
     if(selector===".admorph-widget")return manual?[manual,auto]:[auto];
     if(selector===".admorph-widget:not(.admorph-auto-slot)")return manual?[manual]:[];
     return [];
   },
   createElement:mockElement,
   createDocumentFragment(){return mockElement("fragment");},
   addEventListener(name,callback){events[name]=callback;}
 };
 const window={Shopify:{designMode:false},location:{search:query},addEventListener(name,callback){events[name]=callback;}};
 const content=v2?{
    version:"2.0",angle:"Urban layers",layout:"editorial",...(visual?{visual}:{}),
    hero:{eyebrow:"The new edit",headline:"Style meets the city",subheadline:"A concise introductory editorial line"},
    highlights:Array.from({length:3},(_,i)=>({title:"Detail "+i,text:"A distinct product detail "+i})),
    styleMoments:Array.from({length:3},(_,i)=>({label:"Look "+i,title:"Idea "+i,text:"Styling suggestion "+i})),
    adConnection:{title:"Continue the story",text:"See the look you clicked through to explore."},
    cta:{primary:"Explore your size",secondary:"Your Shopify cart stays the same"}
 }: {headline:"City Line Trench: Effortless Urban Style",
    subheadline:"Layer up",benefits:["Fluid silhouette","All-season look"]};
 const fetch=async url=>{requestUrls.push(url);return{ok:true,json:async()=>({content})};};
 ctx=vm.createContext({window,document,fetch,console,URLSearchParams});
 vm.runInContext(script,ctx);
 await new Promise(resolve=>setTimeout(resolve,15));
 return {auto,manual,requestUrls,events,section,purchase};
}
test("theme embed registers with the correct Shopify app target",()=>{
 const schema=JSON.parse(liquid.match(/{%\s*schema\s*%}([\s\S]*?){%\s*endschema\s*%}/)[1]);
 assert.equal(schema.target,"body");
 assert.equal(schema.javascript,"admorph.js");
 assert.deepEqual(schema.enabled_on.templates,["product"]);
});
test("no ad ID leaves the original Shopify product untouched",async()=>{
 const result=await runStorefront();
 assert.equal(result.auto.hidden,true);
 assert.equal(result.requestUrls.length,0);
});
test("published Meta ad renders a personalized product block",async()=>{
 const result=await runStorefront({query:"?admorph_ad=120255890044740602"});
 assert.equal(result.requestUrls.length,1);
 assert.equal(result.auto.movedAfterTitle,true);
 assert.equal(result.auto.hidden,false);
 assert.equal(result.auto.nodes[0].children[0].textContent,"City Line Trench: Effortless Urban Style");
});
test("manual block prevents a duplicate automatic block",async()=>{
 const result=await runStorefront({query:"?admorph_ad=120255890044740602",withManual:true});
 assert.equal(result.requestUrls.length,1);
 assert.equal(result.auto.hidden,true);
 assert.equal(result.manual.hidden,false);
});

test("V2 renders structured editorial sections with real product image",async()=>{
 const result=await runStorefront({query:"?admorph_ad=120255890044740602",v2:true});
 assert.equal(result.requestUrls.length,1);
 assert.equal(result.auto.hidden,false);
 const root=result.auto.nodes[0];
 assert.ok(root.className.startsWith("admorph-experience admorph-theme-editorial"));
 assert.ok(root.className.includes("admorph-visual-split admorph-palette-sand admorph-fit-cover"));
 assert.equal(root.children.length,4);
 const hero=root.children[0];
 assert.equal(hero.children[0].children[0].src,"https://cdn.shopify.com/s/files/test.jpg");
 assert.equal(hero.children[1].children[1].textContent,"Style meets the city");
 const details=root.children[1];
 assert.equal(details.children[1].children.length,3);
 const moments=root.children[2];
 assert.equal(moments.children[1].children.length,3);
 const button=root.children[3].children[3];
 assert.equal(button.textContent,"Explore your size");
 assert.equal(button.type,"button");
 assert.equal(typeof button.onclick,"function");
});
test("V2 content never changes native product purchasing on normal visits",async()=>{
 const r=await runStorefront({v2:true});
 assert.equal(r.requestUrls.length,0);
 assert.equal(r.auto.hidden,true);
});

test("AI visual direction changes only predefined presentation classes",async()=>{
 const result=await runStorefront({query:"?admorph_ad=120255890044740602",v2:true,
  visual:{composition:"spotlight",palette:"sage",imageFit:"contain",mood:"Calm",rationale:"Muted seasonal visuals"}});
 const hero=result.auto.nodes[0];
 assert.ok(hero.className.includes("admorph-visual-spotlight"));
 assert.ok(hero.className.includes("admorph-palette-sage"));
 assert.ok(hero.className.includes("admorph-fit-contain"));
 assert.equal(result.requestUrls.length,1);
});
test("unknown visual values safely fall back to predefined neutral layout",async()=>{
 const result=await runStorefront({query:"?admorph_ad=120255890044740602",v2:true,
  visual:{composition:"unexpected",palette:"transparent",imageFit:"stretch"}});
 assert.ok(result.auto.nodes[0].className.includes("admorph-visual-split admorph-palette-sand admorph-fit-cover"));
});

test("theme app loader and renderer are both under Shopify's 10KB suggested JS limit",()=>{
 const {statSync}=requireSize();
 function requireSize(){return {statSync:(p)=>({size:readFileSync(p).byteLength})};}
 const pathA=new URL("../extensions/admorph-theme/assets/admorph.js",import.meta.url);
 const pathB=new URL("../extensions/admorph-theme/assets/admorph-render.js",import.meta.url);
 assert.ok(statSync(pathA).size<10000);
 assert.ok(statSync(pathB).size<10000);
 assert.match(liquid,/data-admorph-renderer-url/);
});

test("immersive Meta experience moves ahead of native Shopify product section",async()=>{
 const r=await runStorefront({query:"?admorph_ad=120255890044740602",v2:true,immersive:true});
 assert.equal(r.requestUrls.length,1);
 assert.equal(r.auto.hidden,false);
 assert.equal(r.auto.immersivePositioned,true);
 assert.equal(r.auto.classList.added,"admorph-immersive-mounted");
 const visual=r.auto.nodes[0],hero=visual.children[0];
 assert.equal(hero.children[0].children[0].src,"https://cdn.shopify.com/s/files/test.jpg");
 const thumbnails=hero.children[0].children[1];
 assert.equal(thumbnails.children.length,2);
 thumbnails.children[1].onclick();
 assert.equal(hero.children[0].children[0].src,"https://cdn.shopify.com/s/files/real-back.jpg");
 assert.equal(thumbnails.children[1]["aria-pressed"],"true");
 const heroCopy=hero.children[1];
 assert.ok(heroCopy.children.some(child=>child.className==="admorph-immersive-angle"));
 const cta=heroCopy.children.find(child=>child.className==="admorph-immersive-shop");
 assert.equal(cta.textContent,"Explore your size");
 cta.onclick();
 assert.equal(r.purchase.scrolled,true);
});
test("without a verified native Shopify purchase section, immersive hero does not move elsewhere",async()=>{
 const r=await runStorefront({query:"?admorph_ad=120255890044740602",v2:true,immersive:true,withPurchase:false});
 assert.equal(r.auto.hidden,false);
 assert.notEqual(r.auto.immersivePositioned,true);
});
test("merchant can turn off immersive mode and keep original app-block placement",async()=>{
 const r=await runStorefront({query:"?admorph_ad=120255890044740602",v2:true,immersive:false});
 assert.equal(r.auto.hidden,false);
 assert.notEqual(r.auto.immersivePositioned,true);
});
test("both Shopify block formats offer immersive display control",()=>{
 const manual=readFileSync(new URL("../extensions/admorph-theme/blocks/admorph-product.liquid",import.meta.url),"utf8");
 assert.match(liquid,/data-admorph-immersive/);
 assert.match(manual,/data-admorph-immersive/);
 for(const source of [manual,liquid]){
  assert.match(source,/admorph-shopify-gallery/);
  assert.match(source,/"id": "immersive"/);
 }
});

test("manual Shopify app block is preferred and can render an immersive hero",async()=>{
 const r=await runStorefront({query:"?admorph_ad=120255890044740602",v2:true,immersive:true,withManual:true});
 assert.equal(r.requestUrls.length,1);
 assert.equal(r.auto.hidden,true);
 assert.equal(r.manual.hidden,false);
 assert.equal(r.manual.immersivePositioned,true);
 assert.equal(r.manual.nodes[0].children[0].children[0].children[1].children.length,2);
});
