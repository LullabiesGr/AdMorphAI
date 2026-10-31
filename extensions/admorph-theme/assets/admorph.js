(function(){
  "use strict";
  function isEditor(){
    return !!(window.Shopify && window.Shopify.designMode);
  }
  function editorMessage(root,heading,detail){
    if(!isEditor())return;
    var msg=document.createElement("div");
    msg.className="admorph-editor-preview";
    var h=document.createElement("strong");h.textContent=heading;
    var p=document.createElement("p");p.textContent=detail;
    msg.append(h,p);root.replaceChildren(msg);root.hidden=false;
  }
  function run(){
    var adId=new URLSearchParams(window.location.search).get("admorph_ad");
    document.querySelectorAll(".admorph-widget").forEach(function(root){
      // Theme Editor renders a helpful installation preview without an ad click.
      if(!adId || !/^\d{5,30}$/.test(adId)){
        editorMessage(root,"AdMorph AI block installed","On the live product page, use a published campaign URL with ?admorph_ad=YOUR_META_AD_ID.");
        return;
      }
      var handle=root.getAttribute("data-product-handle");
      if(!handle || root.dataset.admorphLoaded===adId)return;
      root.dataset.admorphLoaded=adId;
      var url="/apps/admorph?ad_id="+encodeURIComponent(adId)+"&product_handle="+encodeURIComponent(handle);
      fetch(url,{credentials:"same-origin",headers:{Accept:"application/json"}})
        .then(function(response){
          if(!response.ok)throw Error("Shopify App Proxy returned HTTP "+response.status);
          return response.json();
        })
        .then(function(data){
          if(!data || !data.content){
            editorMessage(root,"AdMorph AI: no matching experience","Check that the campaign is published and its ad ID belongs to this product.");
            return;
          }
          var c=data.content;
          if(typeof c.headline!=="string" || !Array.isArray(c.benefits)){
            throw Error("Invalid campaign content");
          }
          var title=document.createElement("h2");title.className="admorph-headline";title.textContent=c.headline;
          var subtitle=document.createElement("p");subtitle.className="admorph-subheadline";subtitle.textContent=c.subheadline||"";
          var benefits=document.createElement("ul");benefits.className="admorph-benefits";
          c.benefits.slice(0,3).forEach(function(b){var li=document.createElement("li");li.textContent=String(b);benefits.appendChild(li);});
          root.replaceChildren(title,subtitle,benefits);
          root.hidden=false;
        })
        .catch(function(error){
          console.warn("[AdMorph] Storefront personalization unavailable:",error.message);
          editorMessage(root,"AdMorph AI could not load content","Check the /apps/admorph storefront proxy and deployed Shopify app configuration.");
        });
    });
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run);
  else run();
  document.addEventListener("shopify:section:load",run);
})();
