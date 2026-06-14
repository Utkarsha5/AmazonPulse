(function () {

  "use strict";

  // ── Cart page override ─────────────────────────────────────────────────────
  // When the extension loads on the Amazon cart page, inject the Pulse synced
  // cart UI instead of running the normal Tez sidebar logic.
  if (window.location.href.includes("cart/view")) {
    overrideAmazonCart();
    return;
  }

  /**
   * Retrieves pulseSyncCart from chrome.storage.local and renders a
   * native-looking Amazon "Active Cart" layout on the cart page.
   * Hides Amazon's empty-cart messaging so only our injected cart is visible.
   */
  function overrideAmazonCart() {
    chrome.storage.local.get("pulseSyncCart", (result) => {
      const initialCart = result.pulseSyncCart;

      // ── 1. Suppress Amazon's empty-cart / default cart chrome ──────────────
      const suppressStyle = document.createElement("style");
      suppressStyle.id = "amazon-pulse-cart-suppress";
      suppressStyle.textContent = `
        /* Hide Amazon's empty-cart messaging */
        .sc-your-amazon-cart-is-empty,
        .a-row.sc-cart-header,
        [data-name="empty-cart"],
        #sc-active-cart .a-box-group,
        .sc-list-item-content,
        .sc-list-body,
        .sc-cart-desktop-ad,
        #sc-buy-box-sticky-trigger,
        .sc-saved-cart-header,
        .sc-saved-cart-content { display: none !important; }
      `;
      document.head.appendChild(suppressStyle);

      // ── 2. Create the stable wrapper once — renderPulseCart fills it ───────
      const wrapper = document.createElement("div");
      wrapper.id = "pulse-cart-override";

      // Renders (or re-renders) the cart contents into wrapper.
      // Called on initial load and after every item removal.
      function renderPulseCart(cart) {

        const escHtml = (v) =>
          String(v)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");

        // ── Empty state ──────────────────────────────────────────────────────
        if (!cart || !cart.items || cart.items.length === 0) {
          wrapper.innerHTML = `
            <div class="pulse-cart-container">
              <div class="pulse-cart-header">
                <span class="pulse-cart-header__icon">🛒</span>
                <div>
                  <h1 class="pulse-cart-header__title">Amazon Pulse — Synced Cart</h1>
                  <p class="pulse-cart-header__sub">No items queued yet. Go back to a Tez page and add items.</p>
                </div>
              </div>
              <div class="pulse-cart-empty-state">
                <span class="pulse-cart-empty-state__icon" aria-hidden="true">🛒</span>
                <h2 class="pulse-cart-empty-state__title">Your Amazon Pulse Cart is empty.</h2>
                <p class="pulse-cart-empty-state__sub">
                  Items added on the Tez page will appear here.
                </p>
              </div>
            </div>
          `;
          return; // No "Proceed to Buy" button when cart is empty
        }

        // ── Filled state ─────────────────────────────────────────────────────
        // Recalculate subtotal from item count (we store one total for the whole
        // cart, so per-item prices aren't individually tracked; we divide evenly
        // as a display approximation and show the stored total).
        const itemCount = cart.items.length;

        const itemRowsHtml = cart.items
          .map(
            (name, idx) => `
              <div class="pulse-cart-item" data-item-index="${idx}">
                <span class="pulse-cart-item__index">${idx + 1}</span>
                <span class="pulse-cart-item__name">${escHtml(name)}</span>
                <button
                  type="button"
                  class="pulse-cart-item__remove"
                  data-item-index="${idx}"
                  aria-label="Remove ${escHtml(name)} from cart"
                  title="Remove item"
                >
                  🗑️ Remove
                </button>
              </div>
            `
          )
          .join("");

        wrapper.innerHTML = `
          <div class="pulse-cart-container">

            <div class="pulse-cart-header">
              <span class="pulse-cart-header__icon">🛒</span>
              <div>
                <h1 class="pulse-cart-header__title">Amazon Pulse — Synced Cart</h1>
                <p class="pulse-cart-header__sub">
                  Bundle: <strong>${escHtml(cart.bundle_name || "My Pulse Cart")}</strong>
                  &nbsp;·&nbsp; Queued at ${escHtml(new Date(cart.saved_at || Date.now()).toLocaleTimeString())}
                </p>
              </div>
            </div>

            <div class="pulse-cart-items">
              ${itemRowsHtml}
            </div>

            <div class="pulse-cart-subtotal">
              <div class="pulse-cart-subtotal__row">
                <span class="pulse-cart-subtotal__label">
                  Subtotal (${itemCount} item${itemCount !== 1 ? "s" : ""}):
                </span>
                <span class="pulse-cart-subtotal__amount">₹${escHtml(String(cart.total_price))}</span>
              </div>
              <button
                type="button"
                id="pulse-proceed-to-buy"
                class="pulse-cart-buy-btn"
              >
                Proceed to Buy (${itemCount} item${itemCount !== 1 ? "s" : ""})
              </button>
            </div>

          </div>
        `;

        // ── Proceed to Buy ───────────────────────────────────────────────────
        wrapper.querySelector("#pulse-proceed-to-buy").addEventListener("click", (e) => {
          e.preventDefault();
          showOrderConfirmation(cart);
        });

        // ── Remove buttons ───────────────────────────────────────────────────
        wrapper.querySelectorAll(".pulse-cart-item__remove").forEach((btn) => {
          btn.addEventListener("click", () => {
            const idx = parseInt(btn.dataset.itemIndex, 10);

            // Remove the item from the array
            const updatedItems = cart.items.filter((_, i) => i !== idx);

            // Recalculate total proportionally (or zero out if cart is now empty)
            const originalTotal = parseFloat(cart.total_price) || 0;
            const perItemValue  = cart.items.length > 0
              ? originalTotal / cart.items.length
              : 0;
            const updatedTotal  = Math.max(0, originalTotal - perItemValue).toFixed(2);

            const updatedCart = {
              ...cart,
              items:       updatedItems,
              total_price: updatedItems.length === 0 ? "0.00" : updatedTotal,
              saved_at:    new Date().toISOString(),
            };

            // Persist the updated cart, then immediately re-render
            chrome.storage.local.set({ pulseSyncCart: updatedCart }, () => {
              console.log(
                `[Amazon Pulse] Removed item at index ${idx}. Items remaining: ${updatedItems.length}`
              );
              // Mutate the local cart reference so the next render is correct
              cart.items       = updatedCart.items;
              cart.total_price = updatedCart.total_price;
              cart.saved_at    = updatedCart.saved_at;

              renderPulseCart(updatedCart);
            });
          });
        });
      }

      // Initial render
      renderPulseCart(initialCart);

      // ── 3. Inject into #sc-active-cart, falling back to #a-page ───────────
      // Amazon renders the cart asynchronously, so poll briefly before falling back.
      const POLL_INTERVAL_MS = 200;
      const POLL_TIMEOUT_MS  = 3000;
      const startTime = Date.now();

      function inject() {
        const target =
          document.getElementById("sc-active-cart") ||
          document.getElementById("a-page");

        if (target) {
          target.prepend(wrapper);
          console.log("[Amazon Pulse] Cart override injected into:", target.id);
          return;
        }

        if (Date.now() - startTime < POLL_TIMEOUT_MS) {
          setTimeout(inject, POLL_INTERVAL_MS);
        } else {
          // Last resort — prepend to body
          document.body.prepend(wrapper);
          console.warn("[Amazon Pulse] Cart container not found, prepended to body.");
        }
      }

      inject();
    });
  }
  // ── End cart page override ─────────────────────────────────────────────────

  /**
   * Replaces the entire page content with a full-screen "Order Placed" 
   * confirmation UI. Clears pulseSyncCart from storage on "Return to Tez".
   *
   * @param {{ items: string[], total_price: string|number, bundle_name: string }} cart
   */
  function showOrderConfirmation(cart) {
    // Generate a mock order number: #407-XXXXXXX style (matches Amazon's format)
    const mockOrderId =
      "407-" +
      Math.floor(1000000 + Math.random() * 9000000) +
      "-" +
      Math.floor(1000000 + Math.random() * 9000000);

    const escHtml = (v) =>
      String(v)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    // Build the confirmation element
    const screen = document.createElement("div");
    screen.id = "pulse-order-confirmation";
    screen.innerHTML = `
      <div class="pulse-confirm__card">

        <div class="pulse-confirm__check-wrap" aria-hidden="true">
          <svg class="pulse-confirm__check-svg" viewBox="0 0 52 52" fill="none"
               xmlns="http://www.w3.org/2000/svg">
            <circle class="pulse-confirm__check-circle" cx="26" cy="26" r="25"
                    stroke="#067d62" stroke-width="2" fill="#f2faf7"/>
            <path  class="pulse-confirm__check-tick"   d="M14 27l9 9 15-18"
                   stroke="#067d62" stroke-width="3" stroke-linecap="round"
                   stroke-linejoin="round"/>
          </svg>
        </div>

        <h1 class="pulse-confirm__title">🎉 Order Placed Successfully!</h1>

        <p class="pulse-confirm__sub">
          Amazon Pulse has processed your payment.<br>
          Your intent bundle is being packed.
        </p>

        <div class="pulse-confirm__order-box">
          <span class="pulse-confirm__order-label">Order Number</span>
          <span class="pulse-confirm__order-number">#${escHtml(mockOrderId)}</span>
        </div>

        <div class="pulse-confirm__bundle-name">
          ${escHtml(cart.bundle_name || "My Pulse Cart")}
          &nbsp;·&nbsp;
          <strong>₹${escHtml(String(cart.total_price))}</strong>
          &nbsp;·&nbsp;
          ${cart.items.length} item${cart.items.length !== 1 ? "s" : ""}
        </div>

        <button type="button" id="pulse-return-tez" class="pulse-confirm__return-btn">
          ← Return to Amazon Tez
        </button>

      </div>
    `;

    // Wire up the "Return to Tez" button:
    // clear storage first, then redirect
    screen.querySelector("#pulse-return-tez").addEventListener("click", () => {
      chrome.storage.local.remove("pulseSyncCart", () => {
        window.location.href = "https://www.amazon.in/tez/";
      });
    });

    // Swap the entire page body content for the confirmation screen
    // Keeping <head> intact so Amazon's own fonts/styles still apply
    document.body.innerHTML = "";
    document.body.appendChild(screen);
    document.body.style.cssText =
      "margin:0;padding:0;background:#f0f2f2;min-height:100vh;";
  }



  const SIDEBAR_ID = "amazon-pulse-sidebar";

  const ENHANCED_ATTR = "data-amazon-pulse-enhanced";

  const ADD_BUTTON_SELECTOR = 'button[data-csa-c-slot-id="AsinFaceout-AddToCart"]';

  const CARD_SELECTOR = 'div[role="button"][tabindex="0"]';

  const API_BASE = "http://localhost:8000";

  const USER_ID = "user_123";



  async function apiFetch(path, options = {}) {

    try {

      const response = await fetch(`${API_BASE}${path}`, {

        headers: {

          "Content-Type": "application/json",

          ...(options.headers || {}),

        },

        ...options,

      });



      if (!response.ok) {

        let detail = response.statusText;

        try {

          const errorBody = await response.json();

          detail = errorBody.detail || JSON.stringify(errorBody);

        } catch {

          detail = await response.text();

        }

        throw new Error(`Request failed (${response.status}): ${detail}`);

      }



      return await response.json();

    } catch (error) {

      if (error instanceof TypeError) {

        throw new Error(

          "Cannot reach Amazon Pulse backend. Start it with: python main.py (localhost:8000)"

        );

      }

      throw error;

    }

  }



  function escapeHtml(value) {

    return String(value)

      .replace(/&/g, "&amp;")

      .replace(/</g, "&lt;")

      .replace(/>/g, "&gt;")

      .replace(/"/g, "&quot;");

  }



  function renderError(container, message) {

    if (!container) {

      return;

    }



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



  function findProductCards() {

    const cards = new Set();



    document.querySelectorAll(ADD_BUTTON_SELECTOR).forEach((addButton) => {

      const card = addButton.closest(CARD_SELECTOR);

      if (card) {

        cards.add(card);

      }

    });



    return [...cards];

  }



  function scrapeProductFromCard(card) {

    const titleEl = card.querySelector('p[role="heading"]');

    const imageEl = card.querySelector('[role="img"]');

    const priceEl = card.querySelector('p[aria-label^="₹"]');



    const title =

      titleEl?.textContent?.trim() ||

      imageEl?.getAttribute("aria-label")?.trim() ||

      "";



    const price =

      priceEl?.getAttribute("aria-label")?.trim() ||

      priceEl?.textContent?.replace(/\s+/g, " ").trim() ||

      "";



    return { title, price };

  }



  async function handlePulseBuyClick(event, card) {

    event.preventDefault();

    event.stopPropagation();



    const product = scrapeProductFromCard(card);

    const pulseButton = event.currentTarget;

    const originalLabel = pulseButton.textContent;



    pulseButton.disabled = true;

    pulseButton.textContent = "Processing…";



    try {

      const result = await apiFetch("/api/v1/frictionless/add", {

        method: "POST",

        body: JSON.stringify({

          user_id: USER_ID,

          title: product.title,

          price: product.price,

        }),

      });



      console.log("[Amazon Pulse] 1-Tap checkout:", result);

      // Save the scraped product to pulseSyncCart
      saveToPulseCart({
        bundle_name: "1-Tap Pulse Buy",
        items:       [product.title || result.product?.title || "Unknown Product"],
        total_price: parseFloat(String(product.price || result.product?.price || "0").replace(/[^\d.]/g, "")) || 0,
      });

      // Update the sidebar frictionless section with a mini receipt
      renderFrictionlessReceipt(
        product.title  || result.product?.title || "Unknown Product",
        product.price  || result.product?.price || "",
      );

      // Visual feedback on the page button itself
      pulseButton.textContent = "✅ Added";

    } catch (error) {

      console.error("[Amazon Pulse] Checkout failed:", error);

      // Even if the API is down, save the scraped data and update the sidebar
      if (product.title) {
        saveToPulseCart({
          bundle_name: "1-Tap Pulse Buy",
          items:       [product.title],
          total_price: parseFloat(String(product.price).replace(/[^\d.]/g, "")) || 0,
        });
        renderFrictionlessReceipt(product.title, product.price);
        pulseButton.textContent = "✅ Added";
      } else {
        renderError(
          document.getElementById("amazon-pulse-frictionless-content"),
          error.message
        );
        pulseButton.textContent = originalLabel;
      }

    } finally {

      pulseButton.disabled = false;

    }

  }

  /**
   * Renders a mini "Recent 1-Tap" receipt inside the Frictionless sidebar section.
   * Replaces the placeholder text with the scraped item details and a sync badge.
   *
   * @param {string} title  - scraped product title
   * @param {string} price  - scraped product price string (e.g. "₹499")
   */
  function renderFrictionlessReceipt(title, price) {
    const container = document.getElementById("amazon-pulse-frictionless-content");
    if (!container) return;

    const receipt = document.createElement("div");
    receipt.className = "amazon-pulse-receipt";
    receipt.innerHTML = `
      <div class="amazon-pulse-receipt__header">
        <span class="amazon-pulse-receipt__label">Recent 1-Tap</span>
        <span class="amazon-pulse-badge amazon-pulse-badge--green amazon-pulse-receipt__badge">
          ✅ Synced to Cart
        </span>
      </div>
      <p class="amazon-pulse-receipt__title">${escapeHtml(title)}</p>
      ${price ? `<p class="amazon-pulse-receipt__price">${escapeHtml(price)}</p>` : ""}
    `;

    // Replace whatever was in the container (placeholder or previous receipt)
    container.innerHTML = "";
    container.appendChild(receipt);
  }



  function injectConfidenceBadge(card) {

    const imageEl = card.querySelector('[role="img"]');

    if (!imageEl || imageEl.querySelector(".amazon-pulse-confidence-badge")) {

      return;

    }



    imageEl.classList.add("amazon-pulse-card-image");



    const badge = document.createElement("div");

    badge.className = "amazon-pulse-confidence-badge";

    badge.textContent = "🔬 94% Confidence Match";

    badge.setAttribute("role", "status");

    imageEl.appendChild(badge);

  }



  function injectPulseBuyButton(card) {

    const addButton = card.querySelector(ADD_BUTTON_SELECTOR);

    if (!addButton || card.querySelector(".amazon-pulse-buy-btn")) {

      return;

    }



    const pulseButton = document.createElement("button");

    pulseButton.type = "button";

    pulseButton.className = "amazon-pulse-buy-btn";

    pulseButton.textContent = "⚡ 1-Tap Pulse Buy";

    pulseButton.addEventListener("click", (event) => handlePulseBuyClick(event, card));



    addButton.insertAdjacentElement("afterend", pulseButton);

  }



  function enhanceProductCard(card) {

    if (card.getAttribute(ENHANCED_ATTR) === "true") {

      return;

    }



    if (!card.querySelector(ADD_BUTTON_SELECTOR)) {

      return;

    }



    injectConfidenceBadge(card);

    injectPulseBuyButton(card);

    card.setAttribute(ENHANCED_ATTR, "true");

  }



  function enhanceAllProductCards() {

    findProductCards().forEach(enhanceProductCard);

  }



  function observeProductCards() {

    const observer = new MutationObserver(() => {

      enhanceAllProductCards();

    });



    observer.observe(document.body, {

      childList: true,

      subtree: true,

    });

  }



  /**
   * Saves a cart payload to chrome.storage.local under the key "pulseSyncCart".
   * Merges with any previously queued items so multiple adds accumulate.
   *
   * @param {{ items: string[], total_price: string|number, bundle_name: string }} payload
   */
  function saveToPulseCart(payload) {
    chrome.storage.local.get("pulseSyncCart", (result) => {
      const existing = result.pulseSyncCart || { items: [], total_price: 0, bundle_name: "" };

      // Merge items (deduplicate by name) and accumulate total
      const mergedItems = [
        ...new Set([...existing.items, ...payload.items]),
      ];
      const mergedTotal =
        parseFloat(existing.total_price || 0) +
        parseFloat(payload.total_price || 0);

      const updated = {
        bundle_name: payload.bundle_name || existing.bundle_name,
        items: mergedItems,
        total_price: mergedTotal.toFixed(2),
        saved_at: new Date().toISOString(),
      };

      chrome.storage.local.set({ pulseSyncCart: updated }, () => {
        console.log("[Amazon Pulse] pulseSyncCart saved:", updated);
      });
    });
  }

  /**
   * Attaches the "Added to Queue" animation to a cart button.
   * On click: saves cartPayload to chrome.storage.local, shows the
   * green confirmation state for 2 seconds, then reverts. Does NOT redirect.
   *
   * @param {HTMLButtonElement} btn
   * @param {string} originalLabel       - text to restore after the animation
   * @param {{ items: string[], total_price: string|number, bundle_name: string }} cartPayload
   */
  function attachAddedAnimation(btn, originalLabel, cartPayload) {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;

      // Persist to chrome.storage.local
      saveToPulseCart(cartPayload);

      // Animate to "added" state
      btn.disabled = true;
      btn.textContent = "✅ Added to Queue!";
      btn.style.background = "#00a8a8";
      btn.style.color = "#ffffff";
      btn.style.borderColor = "#00a8a8";

      // Revert after 2 seconds — no redirect here
      setTimeout(() => {
        btn.textContent = originalLabel;
        btn.style.background = "";
        btn.style.color = "";
        btn.style.borderColor = "";
        btn.disabled = false;
      }, 2000);
    });
  }

  function renderIntentBundle(data) {
    const container = document.getElementById("amazon-pulse-intent-results");
    if (!container) {
      return;
    }

    // Clear previous results before rendering new ones
    container.innerHTML = "";

    const bundle = data.primary_bundle;
    const itemsHtml = bundle.cart_items
      .map(
        (item) => `
          <li class="amazon-pulse-bundle-item">
            <span class="amazon-pulse-bundle-item__title">${escapeHtml(item.title)}</span>
            <span class="amazon-pulse-bundle-item__meta">×${item.quantity} · ₹${item.price_inr}</span>
          </li>
        `
      )
      .join("");

    // Render primary bundle
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
        ⚡ Add Bundle to Pulse Cart
      </button>
    `;
    container.appendChild(primaryBundleEl);

    // Wire up the primary bundle button — pass full bundle payload for storage
    const bundleBtn = primaryBundleEl.querySelector(".amazon-pulse-add-bundle-btn");
    const bundlePayload = {
      bundle_name: bundle.bundle_name,
      items: bundle.cart_items.map((item) => item.title),
      total_price: bundle.cart_total_inr,
    };
    attachAddedAnimation(bundleBtn, "⚡ Add Bundle to Pulse Cart", bundlePayload);

    // Inject the 👥 Popular in your Community sub-section directly below
    const communityData = data.community_top_carts || [];
    if (communityData.length > 0) {
      const communitySection = document.createElement("div");
      communitySection.className = "amazon-pulse-community-section";

      // Build each community card as a DOM element so we can attach listeners
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
            <button type="button" class="amazon-pulse-community-add-btn">
              ⚡ 1-Tap Add
            </button>
          </div>
        `;

        // Wire up the community card button — pass this cart's payload for storage
        const addBtn = cardEl.querySelector(".amazon-pulse-community-add-btn");
        const communityPayload = {
          bundle_name: cart.cart_name,
          items: cart.items,
          total_price: cart.total_price,
        };
        attachAddedAnimation(addBtn, "⚡ 1-Tap Add", communityPayload);

        communitySection.appendChild(cardEl);
      });

      container.appendChild(communitySection);
    }
  }



  async function resolveIntentFromInput() {

    const input = document.getElementById("amazon-pulse-intent-input");

    const button = document.getElementById("amazon-pulse-intent-btn");

    const results = document.getElementById("amazon-pulse-intent-results");



    if (!input || !button || !results) {

      return;

    }



    const query = input.value.trim();

    if (!query) {

      renderError(results, "Enter an intent, e.g. “Bake a cake”.");

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

      console.error("[Amazon Pulse] Intent resolve failed:", error);

      renderError(results, error.message);

    } finally {

      button.disabled = false;

      button.textContent = "Resolve Intent";

    }

  }



  function renderStockoutAlert(data) {

    const container = document.getElementById("amazon-pulse-stockout-content");

    if (!container) {

      return;

    }



    const pinCode = data.pin_code;

    const aggregate = data.pin_code_aggregates[pinCode];

    // Mock price for the staple item — used when saving to pulseSyncCart
    const RESTOCK_MOCK_PRICE = 56;

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

          ${

            aggregate

              ? `<div><dt>Local signal</dt><dd>${formatConfidence(aggregate.localized_confidence)} from ${aggregate.households_tracked} households</dd></div>`

              : ""

          }

        </dl>

        <button type="button" class="amazon-pulse-restock-btn" id="amazon-pulse-restock-btn">
          ⚡ 1-Tap Restock
        </button>

      </div>

    `;

    // Wire up the Restock button
    const restockBtn = container.querySelector("#amazon-pulse-restock-btn");
    restockBtn.addEventListener("click", () => {
      if (restockBtn.disabled) return;

      const itemName = data.staple_item;
      const price    = RESTOCK_MOCK_PRICE;

      // Save to pulseSyncCart
      saveToPulseCart({
        bundle_name: "Predictive Restock",
        items:       [itemName],
        total_price: price,
      });

      // Update button to confirmed state — no revert, it's a one-shot action
      restockBtn.disabled = true;
      restockBtn.textContent = "✅ Restocked!";
      restockBtn.style.background    = "#067d62";
      restockBtn.style.color         = "#ffffff";
      restockBtn.style.borderColor   = "#067d62";

      console.log("[Amazon Pulse] Restock queued:", itemName, "₹" + price);
    });

  }



  async function loadStockoutAlert() {

    const container = document.getElementById("amazon-pulse-stockout-content");

    if (!container) {

      return;

    }



    container.innerHTML = `<p class="amazon-pulse-loading">Loading stockout prediction…</p>`;



    try {

      const data = await apiFetch(`/api/v1/predict/stockout/${USER_ID}`);

      renderStockoutAlert(data);

    } catch (error) {

      console.error("[Amazon Pulse] Stockout fetch failed:", error);

      renderError(container, error.message);

    }

  }



  function renderFrictionlessCheckout(data) {

    const container = document.getElementById("amazon-pulse-frictionless-content");

    if (!container) {

      return;

    }

    // Use the scraped title/price from the product that was actually clicked,
    // falling back to what the API echoes back if scraping produced nothing.
    const displayTitle = (data.product && data.product.title) ? data.product.title : "Unknown Product";
    const displayPrice = (data.product && data.product.price) ? data.product.price : "";

    container.innerHTML = `

      <div class="amazon-pulse-checkout">

        <span class="amazon-pulse-badge amazon-pulse-badge--green amazon-pulse-queued-badge">✓ Added to Pulse Queue</span>
        <h3 class="amazon-pulse-checkout__title">${escapeHtml(displayTitle)}</h3>
        ${displayPrice ? `<p class="amazon-pulse-checkout__price">${escapeHtml(displayPrice)}</p>` : ""}
        <p class="amazon-pulse-checkout__message">${escapeHtml(data.message)}</p>
        <p class="amazon-pulse-checkout__order">Order <strong>${escapeHtml(data.order_id)}</strong> · ${data.checkout_latency_ms}ms</p>

      </div>

    `;

  }



  /**
   * Wires up the hardcoded "Predicted Personalization Vector" Auto-Buy card.
   * On click: saves the coffee item to pulseSyncCart, shows confirmation,
   * then redirects immediately to the Amazon cart page.
   */
  function setupFrictionlessCard() {

    const btn = document.getElementById("amazon-pulse-auto-buy-btn");

    if (!btn) return;

    btn.addEventListener("click", () => {

      if (btn.disabled) return;

      const ITEM_NAME  = "Nescafe Gold Coffee 50g";
      const ITEM_PRICE = 190;

      // Save to pulseSyncCart
      saveToPulseCart({
        bundle_name: "Zero-Search Auto-Buy",
        items:       [ITEM_NAME],
        total_price: ITEM_PRICE,
      });

      // Immediate confirmed state — no revert, we're about to navigate
      btn.disabled = true;
      btn.textContent = "✅ Synced to Cart";
      btn.style.background  = "#067d62";
      btn.style.color       = "#ffffff";
      btn.style.borderColor = "#067d62";

      // Give storage a moment to flush, then redirect to the cart
      setTimeout(() => {
        window.location.href = "https://www.amazon.in/gp/cart/view.html";
      }, 600);

    });

  }

  function setupCheckoutButton() {

    const btn = document.getElementById("amazon-pulse-checkout-btn");

    if (!btn) {

      return;

    }

    btn.addEventListener("click", () => {

      btn.disabled = true;

      btn.textContent = "Syncing to Amazon Cart…";

      setTimeout(() => {

        window.location.href = "https://www.amazon.in/gp/cart/view.html";

      }, 1500);

    });

  }



  function setupIntentEngine() {

    const button = document.getElementById("amazon-pulse-intent-btn");

    const input = document.getElementById("amazon-pulse-intent-input");



    button?.addEventListener("click", resolveIntentFromInput);

    input?.addEventListener("keydown", (event) => {

      if (event.key === "Enter") {

        resolveIntentFromInput();

      }

    });

  }



  function injectPulseSidebar() {

    if (document.getElementById(SIDEBAR_ID)) {

      return;

    }



    const sidebar = document.createElement("div");

    sidebar.id = SIDEBAR_ID;

    sidebar.className = "amazon-pulse-sidebar";



    sidebar.innerHTML = `

      <button

        type="button"

        class="amazon-pulse-sidebar__toggle"

        aria-label="Collapse Amazon Pulse sidebar"

        aria-expanded="true"

      >

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

              <input

                id="amazon-pulse-intent-input"

                class="amazon-pulse-input"

                type="text"

                placeholder="e.g. Bake a cake"

                aria-label="Shopping intent"

              />

              <button id="amazon-pulse-intent-btn" type="button" class="amazon-pulse-btn amazon-pulse-btn--primary">

                Resolve Intent

              </button>

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
                  <span class="amazon-pulse-predict-card__name">Nescafe Gold Coffee 50g</span>
                  <span class="amazon-pulse-predict-card__price">₹190</span>
                </div>
                <span class="amazon-pulse-badge amazon-pulse-badge--teal amazon-pulse-predict-card__vector-badge">
                  🧠 Vector Match
                </span>
              </div>
              <button
                type="button"
                id="amazon-pulse-auto-buy-btn"
                class="amazon-pulse-auto-buy-btn"
              >
                ⚡ 1-Tap Auto-Buy
              </button>
            </div>

          </div>

        </section>

      </div>

      <div class="amazon-pulse-sidebar__footer">

        <button

          type="button"

          id="amazon-pulse-checkout-btn"

          class="amazon-pulse-checkout-btn"

        >

          🛒 Sync &amp; Proceed to Amazon Checkout

        </button>

      </div>

    `;



    document.body.appendChild(sidebar);



    const toggle = sidebar.querySelector(".amazon-pulse-sidebar__toggle");

    toggle.addEventListener("click", () => {

      const isCollapsed = sidebar.classList.toggle("amazon-pulse-sidebar--collapsed");

      toggle.setAttribute("aria-expanded", String(!isCollapsed));

      toggle.setAttribute(

        "aria-label",

        isCollapsed ? "Expand Amazon Pulse sidebar" : "Collapse Amazon Pulse sidebar"

      );

      toggle.querySelector(".amazon-pulse-sidebar__toggle-icon").textContent = isCollapsed

        ? "‹"

        : "›";

    });



    setupIntentEngine();

    setupCheckoutButton();

    setupFrictionlessCard();

    chrome.runtime.sendMessage({ type: "PULSE_UI_READY", url: location.href });

  }



  async function init() {

    injectPulseSidebar();

    enhanceAllProductCards();

    observeProductCards();

    await loadStockoutAlert();

  }



  if (document.body) {

    init();

  } else {

    document.addEventListener("DOMContentLoaded", init, { once: true });

  }

})();


