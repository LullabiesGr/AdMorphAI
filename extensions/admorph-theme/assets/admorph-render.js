(function () {
  "use strict";
  // Standalone V2 renderer, fetched only when an ad-matched experience is required.
  window.__admorphRenderExperience = function(root, c, hasImage, adId, token, helpers) {
    var textNode=helpers.textNode, findFirst=helpers.findFirst, publishPixelEvent=helpers.publishPixelEvent;
    var frame = document.createElement("div");
    var visual=c.visual || {};
    var compositions=["split","spotlight","gallery"];
    var palettes=["sand","slate","rose","sage","midnight"];
    var composition=compositions.indexOf(visual.composition)!==-1 ? visual.composition : "split";
    var palette=palettes.indexOf(visual.palette)!==-1 ? visual.palette : "sand";
    var imageFit=visual.imageFit==="contain" ? "contain" : "cover";
    frame.className = "admorph-experience admorph-theme-" + c.layout +
      " admorph-visual-" + composition+" admorph-palette-"+palette+" admorph-fit-"+imageFit;

    var hero = document.createElement("section");
    hero.className = "admorph-experience-hero";
    var copy = document.createElement("div");
    copy.className = "admorph-experience-copy";
    var tag = textNode("span", c.hero.eyebrow, "admorph-experience-eyebrow");
    var headline = textNode("h2", c.hero.headline, "admorph-experience-headline");
    var introduction = textNode("p", c.hero.subheadline, "admorph-experience-intro");
    copy.appendChild(tag);
    copy.appendChild(headline);
    copy.appendChild(introduction);
    var imageUrl = root.getAttribute("data-product-image") || "";
    if (/^https:\/\/[^<>"']+$/.test(imageUrl)) {
      var imageWrap = document.createElement("div");
      imageWrap.className = "admorph-experience-image";
      var img = document.createElement("img");
      img.src = imageUrl;
      img.alt = root.getAttribute("data-product-image-alt") || "Product image";
      img.loading = "lazy";
      img.decoding = "async";
      imageWrap.appendChild(img);
      hero.appendChild(imageWrap);
    } else {
      hero.classList.add("admorph-experience-no-image");
    }
    if(hasImage){
      var backdrop=document.createElement("img");
      backdrop.className="admorph-ai-backdrop";
      backdrop.alt="";
      backdrop.setAttribute("aria-hidden","true");
      backdrop.loading="lazy";
      backdrop.src="/apps/admorph?image=1&ad_id="+encodeURIComponent(adId)+
        "&product_handle="+encodeURIComponent(root.getAttribute("data-product-handle"));
      copy.insertBefore(backdrop,copy.firstChild);
    }
    hero.appendChild(copy);
    frame.appendChild(hero);

    var highlightSection = document.createElement("section");
    highlightSection.className = "admorph-experience-highlights";
    var highlightLabel = textNode("p", "The details", "admorph-experience-kicker");
    highlightSection.appendChild(highlightLabel);
    var highlightGrid = document.createElement("div");
    highlightGrid.className = "admorph-experience-highlight-grid";
    c.highlights.forEach(function (item, index) {
      var card = document.createElement("article");
      card.className = "admorph-experience-highlight";
      card.appendChild(textNode("span", String(index + 1).padStart(2, "0"), "admorph-experience-counter"));
      card.appendChild(textNode("h3", item.title, "admorph-experience-small-title"));
      card.appendChild(textNode("p", item.text, "admorph-experience-card-text"));
      highlightGrid.appendChild(card);
    });
    highlightSection.appendChild(highlightGrid);
    frame.appendChild(highlightSection);

    var moments = document.createElement("section");
    moments.className = "admorph-experience-moments";
    moments.appendChild(textNode("p", "Make it yours", "admorph-experience-kicker"));
    var momentsGrid = document.createElement("div");
    momentsGrid.className = "admorph-experience-moment-grid";
    c.styleMoments.forEach(function (moment) {
      var card = document.createElement("article");
      card.className = "admorph-experience-moment";
      card.appendChild(textNode("span", moment.label, "admorph-experience-moment-label"));
      card.appendChild(textNode("h3", moment.title, "admorph-experience-small-title"));
      card.appendChild(textNode("p", moment.text, "admorph-experience-card-text"));
      momentsGrid.appendChild(card);
    });
    moments.appendChild(momentsGrid);
    frame.appendChild(moments);

    var connection = document.createElement("section");
    connection.className = "admorph-experience-connection";
    connection.appendChild(textNode("span", "Picked for this moment", "admorph-experience-eyebrow"));
    connection.appendChild(textNode("h3", c.adConnection.title, "admorph-experience-connection-title"));
    connection.appendChild(textNode("p", c.adConnection.text, "admorph-experience-card-text"));
    var button = document.createElement("button");
    button.type = "button";
    button.className = "admorph-experience-cta";
    button.textContent = c.cta.primary;
    button.addEventListener("click", function () {
      publishPixelEvent("admorph:experiment_cta",token);
      var buy = findFirst([
        'main form[action*="/cart/add"] button[type="submit"]',
        "main product-form button[type=submit]",
        "main .product-form__submit",
        'main button[name="add"]',
        'main form[action*="/cart/add"]'
      ]);
      // Only scroll to a real Shopify purchase control, never create orders.
      if (buy) {
        buy.scrollIntoView({behavior:"smooth", block:"center"});
        if (typeof buy.focus === "function") {
          try { buy.focus({preventScroll:true}); } catch (_) {}
        }
      }
    });
    connection.appendChild(button);
    if (c.cta.secondary) {
      connection.appendChild(textNode("small", c.cta.secondary, "admorph-experience-cta-note"));
    }
    frame.appendChild(connection);
    root.replaceChildren(frame);
    root.hidden = false;
    root.setAttribute("data-admorph-state", "rendered");
    root.setAttribute("data-admorph-version", "2.0");

  };
})();
