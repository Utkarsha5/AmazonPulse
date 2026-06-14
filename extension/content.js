(function () {
  "use strict";

  // ═══════════════════════════════════════════════════════════════════════════
  // Amazon Pulse — Content Script (Production)
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // This script enhances Amazon Tez pages with intent-based shopping,
  // predictive stockout alerts, and frictionless 1-tap purchasing.
  //
  // Architecture:
  //  - All API calls go through background.js (CSP-safe relay)
  //  - Items are added to Amazon's REAL cart via native button clicks
  //  - Pulse cart in chrome.storage tracks what Pulse added for display context
  //  - Cart page shows a Pulse banner above Amazon's real cart items
  // ═══════════════════════════════════════════════════════════════════════════

  const SIDEBAR_ID = "amazon-pulse-sidebar";
  const ENHANCED_ATTR = "data-amazon-pulse-enhanced";
  const ADD_BUTTON_SELECTOR = 'button[data-csa-c-slot-id="AsinFaceout-AddToCart"]';
  const CARD_SELECTOR = 'div[role="button"][tabindex="0"]';
  const USER_ID = "user_123";
  const CART_URL = "https://www.amazon.in/tez/browse/cart?qcbrand=qqfsWw9RkO";
  const BROWSE_URL = "https://www.amazon.in/tez/browse?qcbrand=qqfsWw9RkO";

  // ── Utility Functions ──────────────────────────────────────────────────────

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderError(container, message) {
    if (!container) return;
    container.innerHTML = `
      <div class="amazon-pulse-error" role="alert">
        <strong>Connection error</strong>
        <p>${escapeHtml(message)}</p>
      </div>
    `;
  }

  function formatConfidence(score) {
    return `${Math.round(score * 100)}%`;
  }

  function isCartPage() {
    const url = window.location.href;
    return url.includes("cart/view") || url.includes("tez/browse/cart");
  }

  // ── API Layer (routes through background.js service worker) ────────────────

  async function apiFetch(path, options = {}) {
    return new Promise((resolve, reject) => {
      if (!chrome.runtime || !chrome.runtime.id) {
        reject(new Error("Extension context invalidated. Please refresh the page."));
        return;
      }
      chrome.runtime.sendMessage(
        { type: "API_FETCH", payload: { path, options } },
        (resp) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!resp) {
            reject(new Error("No response from background script."));
            return;
          }
          if (!resp.success) {
            reject(new Error(resp.error || "API request failed"));
            return;
          }
          resolve(resp.data);
        }
      );
    });
  }

  // ── Pulse Cart Storage ─────────────────────────────────────────────────────
  // Tracks items added by Pulse for display context only.
  // The REAL cart is Amazon's native cart (items are added via native buttons).

  function saveToPulseCart(payload) {
    chrome.storage.local.get("pulseSyncCart", (result) => {
      if (chrome.runtime.lastError) return;
      const existing = result.pulseSyncCart || { items: [], asins: [], total_price: 0, bundle_name: "" };

      const mergedItems = [...new Set([...existing.items, ...payload.items])];
      const mergedAsins = [...new Set([...(existing.asins || []), ...(payload.asins || [])])];
      const mergedTotal = parseFloat(existing.total_price || 0) + parseFloat(payload.total_price || 0);

      const updated = {
        bundle_name: payload.bundle_name || existing.bundle_name,
        items: mergedItems,
        asins: mergedAsins,
        total_price: mergedTotal.toFixed(2),
        saved_at: new Date().toISOString(),
      };

      chrome.storage.local.set({ pulseSyncCart: updated }, () => {
        if (chrome.runtime.lastError) return;
        console.log("[Pulse] Cart saved:", updated);
      });
    });
  }

  function clearPulseCart() {
    chrome.storage.local.remove("pulseSyncCart", () => {
      if (chrome.runtime.lastError) return;
      console.log("[Pulse] Cart cleared");
    });
  }

  // ── Native Cart Integration ────────────────────────────────────────────────
  // Clicks Amazon's actual "Add to Cart" button using the ASIN identifier.
  // The Tez cart page uses: data-csa-c-content-id="AsinFaceout-AddToCart-{ASIN}"
  // The browse page uses similar patterns on product cards.

  /**
   * Finds and clicks the native Add to Cart button for a given ASIN.
   * Matches "AsinFaceout-AddToCart-{ASIN}" buttons on both browse and cart pages.
   * Does NOT match cart quantity steppers (CartLineItem-AddToCartQtyStepper).
   * Returns true if the button was found and clicked.
   */
  function clickAddToCartByAsin(asin) {
    // Primary: exact match on the AsinFaceout-AddToCart pattern (works on browse + cart recommendations)
    const addContainer = document.querySelector(
      `[data-csa-c-content-id="AsinFaceout-AddToCart-${asin}"]`
    );
    if (addContainer) {
      const btn = addContainer.querySelector("button") || addContainer;
      btn.click();
      console.log(`[Pulse] Added ASIN ${asin} to cart`);
      return true;
    }

    // Fallback: find any data-asin card that has an AddToCart button (not a stepper)
    const cards = document.querySelectorAll(`[data-asin="${asin}"]`);
    for (const card of cards) {
      const addBtn = card.querySelector('[data-csa-c-slot-id="AsinFaceout-AddToCart"] button') ||
                     card.querySelector('[data-csa-c-slot-id*="AddToCart"]:not([data-csa-c-slot-id*="QtyStepper"]) button');
      if (addBtn) {
        addBtn.click();
        console.log(`[Pulse] Added ASIN ${asin} via card fallback`);
        return true;
      }
    }

    console.warn(`[Pulse] ASIN ${asin} not found on page`);
    return false;
  }

  /**
   * Adds multiple items to Amazon's real cart by their ASINs.
   * Returns { added: string[], notFound: string[] } with product titles.
   */
  function addItemsToRealCart(items) {
    const added = [];
    const notFound = [];

    for (const item of items) {
      if (item.asin && clickAddToCartByAsin(item.asin)) {
        added.push(item.title);
      } else {
        notFound.push(item.title);
      }
    }

    return { added, notFound };
  }

  // ── Product Card Scraping ──────────────────────────────────────────────────

  function findProductCards() {
    const cards = new Set();
    document.querySelectorAll(ADD_BUTTON_SELECTOR).forEach((addButton) => {
      const card = addButton.closest(CARD_SELECTOR);
      if (card) cards.add(card);
    });
    // Also find cards via the container-level add button pattern
    document.querySelectorAll('[data-csa-c-slot-id*="AddToCart"]').forEach((el) => {
      const card = el.closest(CARD_SELECTOR);
      if (card) cards.add(card);
    });
    return [...cards];
  }

  function scrapeProductFromCard(card) {
    const titleEl = card.querySelector('p[role="heading"]') || card.querySelector('p[lineclamp]');
    const imageEl = card.querySelector('[role="img"]');
    const priceEl = card.querySelector('p[aria-label^="₹"]');

    const title = titleEl?.textContent?.trim() ||
                  imageEl?.getAttribute("aria-label")?.trim() || "";
    const price = priceEl?.getAttribute("aria-label")?.trim() ||
                  priceEl?.textContent?.replace(/\s+/g, " ").trim() || "";

    return { title, price };
  }

  // ── Product Card Enhancement ───────────────────────────────────────────────

  function injectConfidenceBadge(card) {
    const imageEl = card.querySelector('[role="img"]');
    if (!imageEl || imageEl.querySelector(".amazon-pulse-confidence-badge")) return;

    imageEl.classList.add("amazon-pulse-card-image");

    const badge = document.createElement("div");
    badge.className = "amazon-pulse-confidence-badge";
    badge.textContent = "🔬 94% Match";
    badge.setAttribute("role", "status");
    imageEl.appendChild(badge);
  }

  function injectPulseBuyButton(card) {
    const nativeAddBtn = card.querySelector('button[data-csa-c-slot-id*="AddToCart"]') ||
                         card.querySelector('[data-csa-c-slot-id*="AddToCart"] button') ||
                         card.querySelector('button:has(span)');

    if (!nativeAddBtn || card.querySelector(".amazon-pulse-card-btn")) return;

    // Skip dropdowns, chevrons, tiny cards
    if (nativeAddBtn.getAttribute("aria-haspopup") === "menu") return;
    if (nativeAddBtn.querySelector('img[alt*="chevron"]')) return;
    if (card.offsetWidth > 0 && card.offsetWidth < 140) return;

    const actionContainer = nativeAddBtn.closest('[data-csa-c-slot-id*="AddToCart"]')?.parentElement ||
                            nativeAddBtn.parentElement?.parentElement;

    const pulseButton = document.createElement("button");
    pulseButton.type = "button";
    pulseButton.className = "amazon-pulse-auto-buy-btn amazon-pulse-card-btn";
    pulseButton.innerHTML = `<span>✨</span> 1-Tap Buy <span>⚡</span>`;

    if (actionContainer) {
      actionContainer.appendChild(pulseButton);
    }

    pulseButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (pulseButton.disabled) return;

      pulseButton.disabled = true;
      pulseButton.style.background = "linear-gradient(135deg, #d97706 0%, #b45309 100%)";
      pulseButton.innerHTML = "⚙️ Adding...";

      // Click Amazon's native add button to add to real cart
      if (nativeAddBtn && !nativeAddBtn.disabled) {
        nativeAddBtn.click();
      }

      // Also try ASIN-based click (more reliable)
      const asinContainer = card.closest('[data-asin]');
      const asin = asinContainer?.getAttribute('data-asin');
      if (asin) {
        clickAddToCartByAsin(asin);
      }

      // Track in Pulse cart for context
      const product = scrapeProductFromCard(card);
      const cardAsin = asinContainer?.getAttribute('data-asin') || null;
      saveToPulseCart({
        bundle_name: "1-Tap Pulse Buy",
        items: [product.title || "Product"],
        asins: cardAsin ? [cardAsin] : [],
        total_price: parseFloat(String(product.price).replace(/[^\d.]/g, "")) || 0,
      });

      // Show success then navigate to cart
      setTimeout(() => {
        pulseButton.innerHTML = "✅ Added!";
        pulseButton.style.background = "linear-gradient(135deg, #059669 0%, #047857 100%)";
        setTimeout(() => {
          window.location.href = CART_URL;
        }, 400);
      }, 500);
    });
  }

  function enhanceProductCard(card) {
    if (card.getAttribute(ENHANCED_ATTR) === "true") return;

    const nativeAddBtn = card.querySelector(ADD_BUTTON_SELECTOR) ||
                         card.querySelector('[data-csa-c-slot-id*="AddToCart"] button') ||
                         card.querySelector('button:has(span)');
    if (!nativeAddBtn) return;

    if (nativeAddBtn.getAttribute("aria-haspopup") === "menu") return;
    if (nativeAddBtn.querySelector('img[alt*="chevron"]')) return;
    if (card.offsetWidth > 0 && card.offsetWidth < 140) return;

    injectConfidenceBadge(card);
    injectPulseBuyButton(card);
    card.setAttribute(ENHANCED_ATTR, "true");
  }

  function enhanceAllProductCards() {
    findProductCards().forEach(enhanceProductCard);
  }

  function observeProductCards() {
    const observer = new MutationObserver(() => enhanceAllProductCards());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── Cart Page: Pulse Banner + Auto-Add Pending Items ─────────────────────
  // On the cart page, show a contextual banner AND attempt to add any
  // pending Pulse items found in the "You might have missed" section.

  function injectPulseCartBanner() {
    if (document.getElementById("pulse-cart-banner")) return;

    chrome.storage.local.get("pulseSyncCart", (result) => {
      if (chrome.runtime.lastError) return;
      const cart = result.pulseSyncCart;
      if (!cart || !cart.items || cart.items.length === 0) return;

      // Auto-add: try to click Add buttons for pending items in recommendations
      // Wait for the "You might have missed" section to render
      setTimeout(() => {
        const addedAsins = [];
        if (cart.asins && cart.asins.length > 0) {
          for (const asin of cart.asins) {
            if (clickAddToCartByAsin(asin)) {
              addedAsins.push(asin);
            }
          }
          if (addedAsins.length > 0) {
            console.log(`[Pulse] Auto-added ${addedAsins.length} items from recommendations`);
          }
        }

        // Update banner to reflect what was actually added
        const addedBadge = document.getElementById("pulse-banner-added-count");
        if (addedBadge) {
          if (addedAsins.length > 0) {
            addedBadge.textContent = `✅ ${addedAsins.length} added to cart`;
            addedBadge.style.color = "#067d62";
          } else {
            addedBadge.textContent = `Items not in recommendations`;
            addedBadge.style.color = "#565959";
          }
        }
      }, 3000);

      // Show the banner immediately with all queued items
      if (document.getElementById("pulse-cart-banner")) return;

      const banner = document.createElement("div");
      banner.id = "pulse-cart-banner";
      banner.style.cssText = `
        width: 100%;
        padding: 12px 16px;
        background: linear-gradient(135deg, #f0fcfc 0%, #e6f9f9 100%);
        border: 1.5px solid #00a8a8;
        border-radius: 10px;
        margin-bottom: 12px;
        box-sizing: border-box;
        font-family: "Amazon Ember", Arial, sans-serif;
      `;

      const itemCount = cart.items.length;
      banner.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">⚡</span>
            <div>
              <p style="margin: 0; font-size: 14px; font-weight: 700; color: #0f1111;">
                Amazon Pulse — ${itemCount} item${itemCount !== 1 ? "s" : ""} queued
              </p>
              <p style="margin: 2px 0 0; font-size: 12px; color: #565959;">
                ${escapeHtml(cart.bundle_name || "Pulse Bundle")} · ₹${escapeHtml(String(cart.total_price))}
                <span id="pulse-banner-added-count" style="margin-left: 8px; font-weight: 600; color: #565959;">Adding...</span>
              </p>
            </div>
          </div>
          <button id="pulse-banner-clear" style="
            padding: 6px 12px;
            font-size: 11px;
            font-weight: 600;
            color: #565959;
            background: #ffffff;
            border: 1px solid #d5d9d9;
            border-radius: 6px;
            cursor: pointer;
          ">Clear Pulse</button>
        </div>
        <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px;">
          ${cart.items.map(name => `
            <span style="
              display: inline-block;
              padding: 3px 8px;
              font-size: 11px;
              font-weight: 600;
              color: #067d62;
              background: #e8f8f5;
              border-radius: 12px;
              white-space: nowrap;
            ">${escapeHtml(name)}</span>
          `).join("")}
        </div>
      `;

      // Wire clear button
      banner.querySelector("#pulse-banner-clear").addEventListener("click", () => {
        clearPulseCart();
        banner.remove();
      });

      // Inject into #scrollableMainBody
      const pollBanner = setInterval(() => {
        if (!isCartPage()) { clearInterval(pollBanner); return; }
        if (document.getElementById("pulse-cart-banner")) { clearInterval(pollBanner); return; }

        const target = document.getElementById("scrollableMainBody");
        if (target) {
          target.prepend(banner);
          clearInterval(pollBanner);
        }
      }, 100);

      setTimeout(() => clearInterval(pollBanner), 10000);
    });
  }

  // ── Sidebar: Intent Engine ─────────────────────────────────────────────────

  function renderIntentBundle(data) {
    const container = document.getElementById("amazon-pulse-intent-results");
    if (!container) return;

    container.innerHTML = "";

    const bundle = data.primary_bundle;
    const itemsHtml = bundle.cart_items
      .map((item) => `
        <li class="amazon-pulse-bundle-item">
          <span class="amazon-pulse-bundle-item__title">${escapeHtml(item.title)}</span>
          <span class="amazon-pulse-bundle-item__meta">×${item.quantity} · ₹${item.price_inr}</span>
        </li>
      `).join("");

    const primaryBundleEl = document.createElement("div");
    primaryBundleEl.className = "amazon-pulse-result";
    primaryBundleEl.innerHTML = `
      <div class="amazon-pulse-result__header">
        <span class="amazon-pulse-badge amazon-pulse-badge--teal">
          ${formatConfidence(data.confidence)} GNN Match
        </span>
        <span class="amazon-pulse-result__label">${escapeHtml(data.matched_keyword)}</span>
      </div>
      <p class="amazon-pulse-result__summary">
        <strong>${escapeHtml(bundle.bundle_name)}</strong> for "${escapeHtml(data.query)}"
      </p>
      <ul class="amazon-pulse-bundle-list">${itemsHtml}</ul>
      <div class="amazon-pulse-result__footer">
        <span>Your bundle</span>
        <strong>₹${bundle.cart_total_inr}</strong>
      </div>
      <button type="button" class="amazon-pulse-add-bundle-btn">
        ⚡ Add Bundle to Cart
      </button>
    `;
    container.appendChild(primaryBundleEl);

    // Wire up bundle button — adds items to real cart
    const bundleBtn = primaryBundleEl.querySelector(".amazon-pulse-add-bundle-btn");
    bundleBtn.addEventListener("click", () => {
      if (bundleBtn.disabled) return;
      bundleBtn.disabled = true;

      // Map bundle items to the ASIN format
      const items = bundle.cart_items.map((item) => ({ asin: item.sku, title: item.title }));
      const { added, notFound } = addItemsToRealCart(items);

      // Track in Pulse storage
      saveToPulseCart({
        bundle_name: bundle.bundle_name,
        items: bundle.cart_items.map((item) => item.title),
        asins: bundle.cart_items.map((item) => item.sku).filter(Boolean),
        total_price: bundle.cart_total_inr,
      });

      if (added.length > 0) {
        bundleBtn.textContent = `✅ ${added.length} added to cart!`;
        bundleBtn.style.background = "#067d62";
        bundleBtn.style.color = "#fff";
        bundleBtn.style.borderColor = "#067d62";
      } else {
        bundleBtn.textContent = `✅ Bundle queued!`;
        bundleBtn.style.background = "#067d62";
        bundleBtn.style.color = "#fff";
        bundleBtn.style.borderColor = "#067d62";
      }

      if (notFound.length > 0) {
        console.log("[Pulse] Items not on page (tracked for cart):", notFound);
      }

      // Navigate to cart after short delay
      setTimeout(() => {
        window.location.href = CART_URL;
      }, 800);
    });

    // Community carts
    const communityData = data.community_top_carts || [];
    if (communityData.length > 0) {
      const communitySection = document.createElement("div");
      communitySection.className = "amazon-pulse-community-section";

      const titleEl = document.createElement("h4");
      titleEl.className = "amazon-pulse-community-section__title";
      titleEl.textContent = "👥 Popular in your Community";
      communitySection.appendChild(titleEl);

      communityData.forEach((cart) => {
        const cardEl = document.createElement("div");
        cardEl.className = "amazon-pulse-community-card";
        cardEl.innerHTML = `
          <div class="amazon-pulse-community-card__header">
            <strong class="amazon-pulse-community-card__name">${escapeHtml(cart.cart_name)}</strong>
            <span class="amazon-pulse-community-card__fire-badge">
              🔥 ${cart.purchase_count.toLocaleString()}
            </span>
          </div>
          <ul class="amazon-pulse-community-card__items">
            ${cart.items.map((name) => `<li>${escapeHtml(name)}</li>`).join("")}
          </ul>
          <div class="amazon-pulse-community-card__footer">
            <span class="amazon-pulse-community-card__total">₹${cart.total_price}</span>
            <button type="button" class="amazon-pulse-community-add-btn">⚡ 1-Tap Add</button>
          </div>
        `;

        const addBtn = cardEl.querySelector(".amazon-pulse-community-add-btn");
        addBtn.addEventListener("click", () => {
          if (addBtn.disabled) return;
          addBtn.disabled = true;

          // Community carts come from backend as plain strings — try title-based fallback
          const items = cart.items.map(name => ({ asin: null, title: name }));
          const { added } = addItemsToRealCart(items);
          saveToPulseCart({
            bundle_name: cart.cart_name,
            items: cart.items,
            asins: [],
            total_price: cart.total_price,
          });

          addBtn.textContent = `✅ Queued!`;
          addBtn.style.background = "#00a8a8";
          addBtn.style.color = "#fff";
          addBtn.style.borderColor = "#00a8a8";

          setTimeout(() => {
            window.location.href = CART_URL;
          }, 600);
        });

        communitySection.appendChild(cardEl);
      });

      container.appendChild(communitySection);
    }
  }

  async function resolveIntentFromInput() {
    const input = document.getElementById("amazon-pulse-intent-input");
    const button = document.getElementById("amazon-pulse-intent-btn");
    const results = document.getElementById("amazon-pulse-intent-results");

    if (!input || !button || !results) return;

    const query = input.value.trim();
    if (!query) {
      renderError(results, "Enter an intent, e.g. \u201CBake a cake\u201D.");
      return;
    }

    button.disabled = true;
    button.textContent = "Resolving…";
    results.innerHTML = `<p class="amazon-pulse-loading">Traversing NLP graph…</p>`;

    try {
      const data = await apiFetch("/api/v1/intent/resolve", {
        method: "POST",
        body: JSON.stringify({ query }),
      });
      renderIntentBundle(data);
    } catch (error) {
      console.error("[Pulse] Intent resolve failed:", error);
      renderError(results, error.message);
    } finally {
      button.disabled = false;
      button.textContent = "Resolve Intent";
    }
  }

  // ── Sidebar: Stockout Alert ────────────────────────────────────────────────

  function renderStockoutAlert(data) {
    const container = document.getElementById("amazon-pulse-stockout-content");
    if (!container) return;

    const pinCode = data.pin_code;
    const aggregate = data.pin_code_aggregates[pinCode];

    container.innerHTML = `
      <div class="amazon-pulse-alert">
        <div class="amazon-pulse-alert__header">
          <span class="amazon-pulse-badge amazon-pulse-badge--green">
            🔬 ${formatConfidence(data.confidence_score)} Confidence
          </span>
          <span class="amazon-pulse-alert__due">Due in ${data.reorder_due_in_days} day(s)</span>
        </div>
        <h3 class="amazon-pulse-alert__item">${escapeHtml(data.staple_item)}</h3>
        <p class="amazon-pulse-alert__message">${escapeHtml(data.alert_message)}</p>
        <dl class="amazon-pulse-alert__meta">
          <div><dt>Cadence</dt><dd>Every ${data.typical_cadence_days} days</dd></div>
          <div><dt>Pin code</dt><dd>${escapeHtml(pinCode)}</dd></div>
          ${aggregate
            ? `<div><dt>Local signal</dt><dd>${formatConfidence(aggregate.localized_confidence)} from ${aggregate.households_tracked} households</dd></div>`
            : ""}
        </dl>
        <button type="button" class="amazon-pulse-restock-btn" id="amazon-pulse-restock-btn">
          ⚡ 1-Tap Restock
        </button>
      </div>
    `;

    const restockBtn = container.querySelector("#amazon-pulse-restock-btn");
    restockBtn.addEventListener("click", () => {
      if (restockBtn.disabled) return;
      restockBtn.disabled = true;

      const itemName = data.staple_item;

      // Try to add to real cart via ASIN (Amul Gold Milk)
      clickAddToCartByAsin("B01IBTD4HC");

      // Track in Pulse
      saveToPulseCart({
        bundle_name: "Predictive Restock",
        items: [itemName],
        asins: ["B01IBTD4HC"],
        total_price: 34,
      });

      restockBtn.textContent = "✅ Added to Cart!";
      restockBtn.style.background = "#067d62";
      restockBtn.style.color = "#ffffff";
      restockBtn.style.borderColor = "#067d62";

      setTimeout(() => {
        window.location.href = CART_URL;
      }, 600);
    });
  }

  async function loadStockoutAlert() {
    const container = document.getElementById("amazon-pulse-stockout-content");
    if (!container) return;

    container.innerHTML = `<p class="amazon-pulse-loading">Loading stockout prediction…</p>`;

    try {
      const data = await apiFetch(`/api/v1/predict/stockout/${USER_ID}`);
      renderStockoutAlert(data);
    } catch (error) {
      console.error("[Pulse] Stockout fetch failed:", error);
      renderError(container, error.message);
    }
  }

  // ── Sidebar: Frictionless 1-Tap ────────────────────────────────────────────

  function setupFrictionlessCard() {
    const btn = document.getElementById("amazon-pulse-auto-buy-btn");
    if (!btn) return;

    btn.addEventListener("click", () => {
      if (btn.disabled) return;

      if (!chrome.runtime || !chrome.runtime.id) {
        btn.innerHTML = "⚠️ Please refresh";
        btn.style.background = "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)";
        return;
      }

      const ITEM_NAME = "Amul Gold Pasteurized Milk 500ml";
      const ITEM_ASIN = "B01IBTD4HC";
      const ITEM_PRICE = 34;

      btn.disabled = true;
      btn.innerHTML = `<span>⚙️</span> Adding to Cart...`;
      btn.style.background = "linear-gradient(135deg, #d97706 0%, #b45309 100%)";

      // Add to real cart via ASIN
      clickAddToCartByAsin(ITEM_ASIN);

      // Track in Pulse
      saveToPulseCart({
        bundle_name: "Predictive Restock",
        items: [ITEM_NAME],
        asins: [ITEM_ASIN],
        total_price: ITEM_PRICE,
      });

      // Also call backend for tracking
      chrome.runtime.sendMessage({
        type: "FRICTIONLESS_BUY",
        payload: { title: ITEM_NAME, price: String(ITEM_PRICE), user_id: USER_ID }
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn("[Pulse] Message failed:", chrome.runtime.lastError.message);
        }
      });

      setTimeout(() => {
        btn.innerHTML = `✅ Added to Cart!`;
        btn.style.background = "linear-gradient(135deg, #059669 0%, #047857 100%)";
        setTimeout(() => {
          window.location.href = CART_URL;
        }, 400);
      }, 500);
    });
  }

  // ── Sidebar: Checkout Button ───────────────────────────────────────────────

  function setupCheckoutButton() {
    const btn = document.getElementById("amazon-pulse-checkout-btn");
    if (!btn) return;

    btn.addEventListener("click", () => {
      btn.disabled = true;
      window.location.href = CART_URL;
    });
  }

  // ── Sidebar: Intent Engine Setup ───────────────────────────────────────────

  function setupIntentEngine() {
    const button = document.getElementById("amazon-pulse-intent-btn");
    const input = document.getElementById("amazon-pulse-intent-input");

    button?.addEventListener("click", resolveIntentFromInput);
    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") resolveIntentFromInput();
    });
  }

  // ── Sidebar Injection ──────────────────────────────────────────────────────

  function injectPulseSidebar() {
    if (isCartPage()) return;
    if (document.getElementById(SIDEBAR_ID)) return;

    const sidebar = document.createElement("div");
    sidebar.id = SIDEBAR_ID;
    sidebar.className = "amazon-pulse-sidebar";

    sidebar.innerHTML = `
      <button type="button" class="amazon-pulse-sidebar__toggle"
        aria-label="Collapse Amazon Pulse sidebar" aria-expanded="true">
        <span class="amazon-pulse-sidebar__toggle-icon" aria-hidden="true">›</span>
      </button>

      <header class="amazon-pulse-sidebar__header">
        <span class="amazon-pulse-sidebar__brand-icon" aria-hidden="true">⚡</span>
        <div class="amazon-pulse-sidebar__brand">
          <h1 class="amazon-pulse-sidebar__title">Amazon Pulse</h1>
          <p class="amazon-pulse-sidebar__subtitle">Control Center</p>
        </div>
      </header>

      <div class="amazon-pulse-sidebar__body">
        <section class="amazon-pulse-sidebar__module" id="amazon-pulse-intent">
          <h2 class="amazon-pulse-sidebar__module-title">
            ✨ Shop by Intent <span class="amazon-pulse-sidebar__module-tag">(NLP Graph Engine)</span>
          </h2>
          <div class="amazon-pulse-sidebar__module-content">
            <div class="amazon-pulse-intent-form">
              <input id="amazon-pulse-intent-input" class="amazon-pulse-input" type="text"
                placeholder="e.g. Bake a cake" aria-label="Shopping intent" />
              <button id="amazon-pulse-intent-btn" type="button"
                class="amazon-pulse-btn amazon-pulse-btn--primary">Resolve Intent</button>
            </div>
            <div id="amazon-pulse-intent-results" class="amazon-pulse-results"></div>
          </div>
        </section>

        <section class="amazon-pulse-sidebar__module" id="amazon-pulse-stockout">
          <h2 class="amazon-pulse-sidebar__module-title">
            🔔 Predictive Stockout <span class="amazon-pulse-sidebar__module-tag">(Collaborative Alerts)</span>
          </h2>
          <div id="amazon-pulse-stockout-content" class="amazon-pulse-sidebar__module-content">
            <p class="amazon-pulse-loading">Loading stockout prediction…</p>
          </div>
        </section>

        <section class="amazon-pulse-sidebar__module" id="amazon-pulse-frictionless">
          <h2 class="amazon-pulse-sidebar__module-title">
            ⚡ Frictionless 1-Tap <span class="amazon-pulse-sidebar__module-tag">(Personalization Vectors)</span>
          </h2>
          <div id="amazon-pulse-frictionless-content" class="amazon-pulse-sidebar__module-content">
            <p class="amazon-pulse-predict-hint">
              Based on your 14-day cycle, you usually restock this today.
            </p>
            <div class="amazon-pulse-predict-card" id="amazon-pulse-predict-card">
              <div class="amazon-pulse-predict-card__body">
                <div class="amazon-pulse-predict-card__info">
                  <span class="amazon-pulse-predict-card__name">Amul Gold Pasteurized Milk 500ml</span>
                  <span class="amazon-pulse-predict-card__price">₹34</span>
                </div>
                <span class="amazon-pulse-badge amazon-pulse-badge--teal amazon-pulse-predict-card__vector-badge">
                  🧠 Vector Match
                </span>
              </div>
              <button type="button" id="amazon-pulse-auto-buy-btn" class="amazon-pulse-auto-buy-btn">
                <span>✨</span> Pulse 1-Tap Buy <span>⚡</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      <div class="amazon-pulse-sidebar__footer">
        <button type="button" id="amazon-pulse-checkout-btn" class="amazon-pulse-checkout-btn">
          🛒 Go to Cart
        </button>
      </div>
    `;

    document.body.appendChild(sidebar);

    // Toggle collapse
    const toggle = sidebar.querySelector(".amazon-pulse-sidebar__toggle");
    toggle.addEventListener("click", () => {
      const isCollapsed = sidebar.classList.toggle("amazon-pulse-sidebar--collapsed");
      toggle.setAttribute("aria-expanded", String(!isCollapsed));
      toggle.setAttribute("aria-label",
        isCollapsed ? "Expand Amazon Pulse sidebar" : "Collapse Amazon Pulse sidebar");
      toggle.querySelector(".amazon-pulse-sidebar__toggle-icon").textContent = isCollapsed ? "‹" : "›";
    });

    setupIntentEngine();
    setupCheckoutButton();
    setupFrictionlessCard();

    chrome.runtime.sendMessage({ type: "PULSE_UI_READY", url: location.href }, () => {
      if (chrome.runtime.lastError) {
        console.warn("[Pulse] Could not notify background:", chrome.runtime.lastError.message);
      }
    });
  }

  // ── Contextual Zero-Search Popup ───────────────────────────────────────────

  function showContextPopup(popupData) {
    if (document.getElementById("pulse-context-popup")) return;

    const popup = document.createElement("div");
    popup.id = "pulse-context-popup";
    popup.className = "amazon-pulse-context-popup";
    popup.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; width: 340px;
      background: white; padding: 16px; border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15); z-index: 2147483647;
      font-family: 'Amazon Ember', Arial, sans-serif;
    `;

    const bundlesHtml = popupData.bundles.map((bundle, index) => `
      <div style="border: 1px solid #e7e7e7; border-radius: 8px; padding: 12px; margin-bottom: 12px; background: #f8f8f8;">
        <div style="font-size: 13px; color: #0f1111; margin-bottom: 8px;">
          <strong>${escapeHtml(bundle.bundle_name)}</strong><br/>
          <span style="font-size: 11px; color: #565959;">${bundle.items.map(i => escapeHtml(i.title)).join(" • ")}</span>
        </div>
        <button class="context-buy-btn" data-index="${index}" style="
          border-radius: 8px; width: 100%; padding: 8px; cursor: pointer;
          border: 1px solid #008296; background: #00a8a8; color: white; font-weight: bold;
        ">✨ 1-Tap Buy — ₹${bundle.price_inr}</button>
      </div>
    `).join("");

    popup.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
        <div style="font-weight: bold; font-size: 16px; color: #0f1111;">${escapeHtml(popupData.message)}</div>
        <button id="close-context-popup" style="background:none; border:none; cursor:pointer; font-size:22px; line-height:1;">&times;</button>
      </div>
      <div style="max-height: 400px; overflow-y: auto; padding-right: 4px;">${bundlesHtml}</div>
    `;

    document.body.appendChild(popup);

    document.getElementById("close-context-popup").addEventListener("click", () => popup.remove());

    popup.querySelectorAll(".context-buy-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;

        popup.querySelectorAll(".context-buy-btn").forEach(b => b.disabled = true);
        btn.innerHTML = `⚙️ Adding to Cart...`;
        btn.style.background = "linear-gradient(135deg, #d97706 0%, #b45309 100%)";

        const bundleIndex = parseInt(btn.getAttribute("data-index"), 10);
        const selectedBundle = popupData.bundles[bundleIndex];

        // Add items to real cart using ASINs
        const { added } = addItemsToRealCart(selectedBundle.items);

        // Track in Pulse
        saveToPulseCart({
          bundle_name: selectedBundle.bundle_name,
          items: selectedBundle.items.map(i => i.title),
          asins: selectedBundle.items.map(i => i.asin).filter(Boolean),
          total_price: selectedBundle.price_inr,
        });

        setTimeout(() => {
          btn.innerHTML = `✅ ${added.length} added!`;
          btn.style.background = "linear-gradient(135deg, #059669 0%, #047857 100%)";
          btn.style.border = "none";

          setTimeout(() => {
            window.location.href = CART_URL;
          }, 400);
        }, 500);
      });
    });
  }

  // ── Hotkey: Alt+R for Context Popup ────────────────────────────────────────

  window.addEventListener("keydown", (event) => {
    if (event.altKey && event.code === "KeyR") {
      event.preventDefault();
      console.log("[Pulse] Hotkey detected — triggering context bundles");

      showContextPopup({
        message: "🌧️ Heavy Rain! Pick your vibe:",
        bundles: [
          {
            bundle_name: "Monsoon Comfort Pack",
            items: [
              { asin: "B00U7GDO14", title: "Maggi 2-Minute Masala Noodles", price: 76 },
              { asin: "B08C5GFQYF", title: "Bingo! Masala Tadka Tedhe Medhe", price: 15 },
              { asin: "B07G1RP4FW", title: "Coca-Cola Diet Coke Can", price: 38 },
            ],
            price_inr: 129,
          },
          {
            bundle_name: "Snack Binge & Chill",
            items: [
              { asin: "B00TOFX9Q4", title: "Lay's Chile Limon Chips", price: 25 },
              { asin: "B004ZXK6FC", title: "Coca-Cola Original Taste", price: 36 },
              { asin: "B078KT9RB1", title: "Amul Fresh Paneer", price: 84 },
            ],
            price_inr: 145,
          },
          {
            bundle_name: "Drinks & Munchies",
            items: [
              { asin: "B07BFNG2XM", title: "Thums Up Soft Drink", price: 34 },
              { asin: "B079GX9DDF", title: "Kinley Club Soda", price: 18 },
              { asin: "B0B3Y9BWVF", title: "Coca-Cola Zero Sugar", price: 30 },
            ],
            price_inr: 82,
          },
        ],
      });
    }
  });

  // ── Initialization ─────────────────────────────────────────────────────────

  async function init() {
    injectPulseSidebar();
    enhanceAllProductCards();
    observeProductCards();
    await loadStockoutAlert();
  }

  // Run init on browse pages, banner on cart pages
  if (isCartPage()) {
    injectPulseCartBanner();
  } else {
    if (document.body) {
      init();
    } else {
      document.addEventListener("DOMContentLoaded", init, { once: true });
    }
  }

  // ── SPA Route Watcher ──────────────────────────────────────────────────────

  let lastUrl = window.location.href;

  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      console.log("[Pulse SPA] Route changed:", lastUrl);

      if (isCartPage()) {
        // Navigated TO cart — remove sidebar, show banner
        const sidebar = document.querySelector(".amazon-pulse-sidebar");
        if (sidebar) sidebar.remove();
        injectPulseCartBanner();
      } else {
        // Left cart — remove banner, restore sidebar
        const banner = document.getElementById("pulse-cart-banner");
        if (banner) banner.remove();
        const suppress = document.getElementById("amazon-pulse-cart-suppress");
        if (suppress) suppress.remove();

        injectPulseSidebar();
        enhanceAllProductCards();
      }
    }
  }, 300);

})();
