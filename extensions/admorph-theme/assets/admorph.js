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
  function render(root, content) {
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
        if (typeof content.headline !== "string" || !Array.isArray(content.benefits)) {
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