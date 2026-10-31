import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const script=readFileSync(new URL("../extensions/admorph-theme/assets/admorph.js",import.meta.url),"utf8");
const liquid=readFileSync(new URL("../extensions/admorph-theme/blocks/admorph-autopilot.liquid",import.meta.url),"utf8");

function mockElement(tag){
 return {tagName:tag.toUpperCase(),children:[],textContent:"",className:"",
    appendChild(child){this.children.push(child);return child;},
    replaceChildren(...children){this.children=children;},
    setAttribute(name,value){this[name]=value;}};
}
async function runStorefront({query="",withManual=false}={}){
 const events={};
 const requestUrls=[];
 const makeRoot=(automatic)=>({
    classList:{contains(name){return automatic&&name==="admorph-auto-slot";}},
    getAttribute(name){return name==="data-product-handle"?"city-line-trench":name==="data-admorph-placement"?"after_title":null;},
    dataset:{},hidden:true,isConnected:true,previousElementSibling:null,
    replaceChildren(...items){this.nodes=items;},
    setAttribute(name,value){this[name]=value;}
 });
 const auto=makeRoot(true),manual=withManual?makeRoot(false):null;
 const anchor={insertAdjacentElement(position,element){element.movedAfterTitle=position==="afterend";}};
 const document={
   readyState:"complete",
   querySelector(selector){return selector==="main h1"?anchor:null;},
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
 const fetch=async url=>{requestUrls.push(url);return{ok:true,json:async()=>({content:{
   headline:"City Line Trench: Effortless Urban Style",
   subheadline:"Layer up",
   benefits:["Fluid silhouette","All-season look"]}})};};
 vm.runInNewContext(script,{window,document,fetch,console,URLSearchParams});
 await new Promise(resolve=>setImmediate(resolve));
 return {auto,manual,requestUrls,events};
}
test("theme embed registers with the correct Shopify app target",()=>{
 const schema=JSON.parse(liquid.match(/{%\\s*schema\\s*%}([\\s\\S]*?){%\\s*endschema\\s*%}/)[1]);
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
