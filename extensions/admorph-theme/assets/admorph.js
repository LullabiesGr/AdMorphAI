(function () {
  "use strict";

  // Shared by the manual Shopify app block and the optional automatic app embed.
  // Never modify the original product title, form, price, or SEO data.
  if (window.__admorphPersonalizationLoaded) return;
  window.__admorphPersonalizationLoaded = true;

  var RETRY_EVENTS = ["shopify:section:load", "shopify:block:select"];
  function editor() { return Boolean(window.Shopify && window.Shopify.designMode); }
  function adId() {
    var value = new URLSearchParams(window.location.search).get("admorph_ad") || "";
    return /^\d{5,30}$/.test(value) ? value : "";
  }
  function findFirst(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var node = document.querySelector(selectors[i]);
      if (node) return node;
    }
    return null;
  }
  function putAfter(target, element) {
    if (target && target.parentNode && element.previousElementSibling !== target) {
      target.insertAdjacentElement("afterend", element);
    }
  }
  function placeAutomatic(root) {
    if (!root || !root.isConnected) return;
    var handle = root.getAttribute("data-product-handle");
    // A manually positioned app block takes precedence. Never duplicate content.
    var manual = Array.prototype.some.call(
      document.querySelectorAll(".admorph-widget:not(.admorph-auto-slot)"),
      function (node) { return node.getAttribute("data-product-handle") === handle; }
    );
    if (manual) {
      root.hidden = true;
      return;
    }
    var placement = root.getAttribute("data-admorph-placement") || "after_title";
    var title = [
      "main .product__title", "main .product-info__title",
      "main .product-single__title", "main [data-product-title]",
      "main .product-title", "main h1"
    ];
    var description = [
      "main .product__description", "main .product-info__description",
      "main [data-product-description]", "main .product-description"
    ];
    var cart = [
      "main product-form", "main .product-form", 'main form[action*="/cart/add"]',
      "main [data-product-form]"
    ];
    var selectors = placement === "after_cart" ? cart.concat(title) :
      placement === "after_description" ? description.concat(title) : title.concat(cart);
    var anchor = findFirst(selectors);
    if (anchor) putAfter(anchor, root);
    // Do not move to the footer if the theme's product information wasn't found.
    // The root stays hidden until the actual content is fetched.
  }
  function textNode(name, value, className) {
    var node = document.createElement(name);
    node.className = className;
    node.textContent = String(value || "");
    return node;
  }
  function showEditorMessage(root, heading, detail) {
    if (!editor()) return;
    var container = document.createElement("div");
    container.className = "admorph-editor-preview";
    container.appendChild(textNode("strong", heading, "admorph-editor-title"));
    container.appendChild(textNode("p", detail, "admorph-editor-message"));
    root.replaceChildren(container);
    root.hidden = false;
  }
  // V2: build a premium ad-matched experience entirely with safe DOM methods.
  // Images are sourced from the actual Shopify product, never AI-invented merchandise.
  function renderExperience(root, c) {
    var frame = document.createElement("div");
    frame.className = "admorph-experience admorph-theme-" + c.layout;

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
  }

  function render(root, content) {
    if (content.version === "2.0" && content.hero &&
        Array.isArray(content.highlights) && content.highlights.length === 3 &&
        Array.isArray(content.styleMoments) && content.styleMoments.length === 3 &&
        content.adConnection && content.cta &&
        ["editorial","minimal","bold"].indexOf(content.layout) !== -1) {
      renderExperience(root, content);
      return;
    }
    var heading = textNode("h2", content.headline, "admorph-headline");
    var subheading = textNode("p", content.subheadline, "admorph-subheadline");
    var benefits = document.createElement("ul");
    benefits.className = "admorph-benefits";
    content.benefits.slice(0, 3).forEach(function (text) {
      benefits.appendChild(textNode("li", text, ""));
    });
    var fragment = document.createDocumentFragment();
    fragment.appendChild(heading);
    if (content.subheadline) fragment.appendChild(subheading);
    if (benefits.children.length) fragment.appendChild(benefits);
    root.replaceChildren(fragment);
    root.hidden = false;
    root.setAttribute("data-admorph-state", "rendered");
  }
  function load(root, id) {
    var handle = root.getAttribute("data-product-handle");
    if (!handle || !/^[a-z0-9][a-z0-9-]{0,250}$/.test(handle)) return;
    if (root.dataset.admorphLoaded === id) return;
    root.dataset.admorphLoaded = id;
    var url = "/apps/admorph?ad_id=" + encodeURIComponent(id) +
      "&product_handle=" + encodeURIComponent(handle);
    fetch(url, {credentials: "same-origin", headers: {Accept: "application/json"}})
      .then(function (response) {
        if (!response.ok) throw Error("App Proxy HTTP " + response.status);
        return response.json();
      })
      .then(function (result) {
        var content = result && result.content;
        if (!content) {
          showEditorMessage(root, "No matching AdMorph campaign",
            "The published Meta ad ID must match this product's handle.");
          return;
        }
        if (content.version === "2.0" ? (!content.hero || !Array.isArray(content.highlights) || !Array.isArray(content.styleMoments)) : (typeof content.headline !== "string" || !Array.isArray(content.benefits))) {
          throw Error("Unexpected AdMorph response");
        }
        render(root, content);
      })
      .catch(function (error) {
        delete root.dataset.admorphLoaded; // Allow retry on section reload.
        console.warn("[AdMorph] Product personalization:", error.message);
        showEditorMessage(root, "AdMorph could not load",
          "Check the published campaign and /apps/admorph App Proxy.");
      });
  }
  function run() {
    var roots = document.querySelectorAll(".admorph-widget");
    var id = adId();
    Array.prototype.forEach.call(roots, function (root) {
      if (root.classList.contains("admorph-auto-slot")) placeAutomatic(root);
    });
    // Prefer manual block on products where both integrations are installed.
    Array.prototype.forEach.call(roots, function (root) {
      if (root.classList.contains("admorph-auto-slot")) {
        var handle = root.getAttribute("data-product-handle");
        var hasManual = Array.prototype.some.call(
          document.querySelectorAll(".admorph-widget:not(.admorph-auto-slot)"),
          function (node) { return node.getAttribute("data-product-handle") === handle; }
        );
        if (hasManual) return;
      }
      if (!id) {
        if (editor()) {
          showEditorMessage(root, "AdMorph ready",
            "Save your theme, then open a published campaign's product URL with ?admorph_ad=META_AD_ID.");
        }
        return;
      }
      load(root, id);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
  RETRY_EVENTS.forEach(function (eventName) { document.addEventListener(eventName, run); });
  window.addEventListener("pageshow", run);
})();