(function(){
  function run(){
    var adId=new URLSearchParams(window.location.search).get("admorph_ad");
    if(!adId||!/^\d{5,30}$/.test(adId))return;
    document.querySelectorAll(".admorph-widget").forEach(function(root){
      var handle=root.getAttribute("data-product-handle");
      if(!handle||root.dataset.loaded==="1")return;
      root.dataset.loaded="1";
      var url="/apps/admorph?ad_id="+encodeURIComponent(adId)+"&product_handle="+encodeURIComponent(handle);
      fetch(url,{credentials:"same-origin"})
       .then(function(response){if(!response.ok)throw Error("Content unavailable");return response.json();})
       .then(function(data){
         if(!data||!data.content)return;
         var c=data.content;
         if(typeof c.headline!=="string"||!Array.isArray(c.benefits))return;
         var title=document.createElement("h2");title.className="admorph-headline";title.textContent=c.headline;
         var subtitle=document.createElement("p");subtitle.className="admorph-subheadline";subtitle.textContent=c.subheadline||"";
         var benefits=document.createElement("ul");benefits.className="admorph-benefits";
         c.benefits.slice(0,3).forEach(function(b){var li=document.createElement("li");li.textContent=String(b);benefits.appendChild(li)});
         root.replaceChildren(title,subtitle,benefits);
         root.hidden=false;
       }).catch(function(){root.hidden=true;});
    });
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run);else run();
})();
