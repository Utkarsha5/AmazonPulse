(function () {

  "use strict";

  // ── Cart page override ─────────────────────────────────────────────────────
  // When the extension loads on the Amazon cart page, inject the Pulse synced
  // cart UI instead of running the normal Tez sidebar logic.
 if (window.location.href.includes("cart/view") || window.location.href.includes("tez/browse/cart")) {
    overrideAmazonCart();
    return;
  }

  /**
   * Retrieves pulseSyncCart from chrome.storage.local and renders a
   * native-looking Amazon "Active Cart" layout on the cart page.
   * Hides Amazon's empty-cart messaging so only our injected cart is visible.
   */
  function overrideAmazonCart() {
    // 1. Destroy the sidebar if it exists on the cart page
    const rogueSidebar = document.querySelector(".amazon-pulse-sidebar");
    if (rogueSidebar) rogueSidebar.remove();

    chrome.storage.local.get("pulseSyncCart", (result) => {
      const initialCart = result.pulseSyncCart;

      // 2. Safely hide Amazon's "Empty Basket" without breaking React
      const suppressStyle = document.createElement("style");
      suppressStyle.id = "amazon-pulse-cart-suppress";
      suppressStyle.textContent = `
        /* Safely hide the empty basket container using CSS instead of deleting nodes */
        div:has(> img[alt="Empty Basket"]) {
          display: none !important;
        }
      `;
      document.head.appendChild(suppressStyle);

      // 3. Create the stable wrapper once
      const wrapper = document.createElement("div");
      wrapper.id = "pulse-cart-override";
      // Using Flexbox to integrate cleanly into the Tez layout
      wrapper.style.cssText = "width: 100%; position: relative; padding: 16px; box-sizing: border-box; background: transparent; z-index: 10;";

      // Renders (or re-renders) the cart contents into wrapper.
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
          return;
        }

        // ── Filled state ─────────────────────────────────────────────────────
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
          <div class="pulse-cart-container" style="border: 2px solid #00a8a8; border-radius: 12px; background: #fff; overflow: hidden; margin-bottom: 20px;">
            <div class="pulse-cart-header" style="background: #f0fcfc; padding: 16px; border-bottom: 1px solid #e0e0e0;">
              <span class="pulse-cart-header__icon" style="font-size: 24px; margin-right: 12px;">🛒</span>
              <div style="display: inline-block; vertical-align: top;">
                <h1 class="pulse-cart-header__title" style="margin: 0; font-size: 18px; color: #0f1111;">Amazon Pulse — Synced Cart</h1>
                <p class="pulse-cart-header__sub" style="margin: 4px 0 0; font-size: 12px; color: #565959;">
                  Bundle: <strong>${escHtml(cart.bundle_name || "My Pulse Cart")}</strong>
                  &nbsp;·&nbsp; Queued at ${escHtml(new Date(cart.saved_at || Date.now()).toLocaleTimeString())}
                </p>
              </div>
            </div>

            <div class="pulse-cart-items" style="padding: 16px;">
              ${itemRowsHtml}
            </div>

            <div class="pulse-cart-subtotal" style="background: #fafafa; padding: 16px; border-top: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;">
              <div class="pulse-cart-subtotal__row">
                <span class="pulse-cart-subtotal__label" style="font-size: 14px; color: #0f1111;">
                  Subtotal (${itemCount} item${itemCount !== 1 ? "s" : ""}):
                </span>
                <span class="pulse-cart-subtotal__amount" style="font-size: 18px; font-weight: bold; margin-left: 8px;">₹${escHtml(String(cart.total_price))}</span>
              </div>
              <button
                type="button"
                id="pulse-proceed-to-buy"
                class="pulse-cart-buy-btn"
                style="background: #ffd814; border: 1px solid #fcd200; border-radius: 8px; padding: 10px 20px; font-weight: bold; cursor: pointer;"
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
            const updatedItems = cart.items.filter((_, i) => i !== idx);

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

            chrome.storage.local.set({ pulseSyncCart: updatedCart }, () => {
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

      // ── 4. Inject safely into #scrollableMainBody without destroying React ───────────
      const POLL_INTERVAL_MS = 50;
      const POLL_TIMEOUT_MS  = 5000;
      const startTime = Date.now();

      const tryInjectCart = setInterval(() => {
        const targetContainer = document.getElementById("scrollableMainBody");

        if (targetContainer) {
          // Check if we already injected to prevent duplicates
          if (!document.getElementById("pulse-cart-override")) {
            
            // 🚨 CRITICAL FIX: We use prepend() to add our cart AT THE TOP
            // We DO NOT use targetContainer.innerHTML = '' anymore!
            targetContainer.prepend(wrapper);
            
            console.log("[Amazon Pulse] Safely prepended custom cart into #scrollableMainBody");
          }
          clearInterval(tryInjectCart); // Found and injected, stop polling
        } 
        // Fallback
        else if (Date.now() - startTime > POLL_TIMEOUT_MS) {
          clearInterval(tryInjectCart);
          if (!document.getElementById("pulse-cart-override")) {
            document.body.prepend(wrapper);
          }
        }
      }, POLL_INTERVAL_MS);

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
        window.location.href = "https://www.amazon.in/tez/browse?qcbrand=qqfsWw9RkO";
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
    // 1. Find Amazon's native Add button
    const nativeAddBtn = card.querySelector('button[data-csa-c-slot-id*="AddToCart"]') || card.querySelector('button:has(span)');
    
    // If there's no native add button, or we already injected ours, skip.
    if (!nativeAddBtn || card.querySelector(".amazon-pulse-card-btn")) {
      return;
    }

    // 🛑 NEW SMART FILTERS: Prevent injecting on tiny/cluttered cards

    // Filter A: Skip if the button opens a variant dropdown (e.g., size selection)
    if (nativeAddBtn.getAttribute("aria-haspopup") === "menu") {
      return; 
    }

    // Filter B: Skip if the button contains a chevron icon (another dropdown indicator)
    if (nativeAddBtn.querySelector('img[alt*="chevron"]')) {
      return;
    }

    // Filter C: Skip if the card's width is too small to fit two buttons cleanly
    // (Amazon Tez standard main-grid cards are usually wider than 150px)
    if (card.offsetWidth > 0 && card.offsetWidth < 140) {
      return;
    }

    // 2. Find the correct parent container to append to
    const actionContainer = nativeAddBtn.closest('.ciwqVZ') || nativeAddBtn.parentElement.parentElement;

    // 3. Create the Pulse button
    const pulseButton = document.createElement("button");
    pulseButton.type = "button";
    pulseButton.className = "amazon-pulse-auto-buy-btn amazon-pulse-card-btn"; 
    pulseButton.innerHTML = `
      <span style="font-size: 14px; line-height: 1;">✨</span> 
      1-Tap Buy 
      <span style="font-size: 14px; line-height: 1;">⚡</span>
    `;

    // 4. Inject it safely
    if (actionContainer) {
        actionContainer.appendChild(pulseButton);
    }

    // 5. The Magic Click Logic
    pulseButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation(); 

      if (pulseButton.disabled) return;

      pulseButton.disabled = true;
      
      pulseButton.style.background = "linear-gradient(135deg, #d97706 0%, #b45309 100%)";

      if (nativeAddBtn && !nativeAddBtn.disabled) {
        nativeAddBtn.click();
      }

      setTimeout(() => {
        
        window.location.href = "https://www.amazon.in/tez/browse/cart?qcbrand=qqfsWw9RkO";
      }, 600);
    });
  }



 function enhanceProductCard(card) {
    if (card.getAttribute(ENHANCED_ATTR) === "true") {
      return;
    }

    // Find the native add button
    const nativeAddBtn = card.querySelector(ADD_BUTTON_SELECTOR) || card.querySelector('button:has(span)');

    if (!nativeAddBtn) {
      return;
    }

    // 🛑 GATEKEEPER FILTERS: Prevent ANY enhancement (badges or buttons) on cluttered/tiny cards
    
    // Filter A: Skip if it's a dropdown variant menu
    if (nativeAddBtn.getAttribute("aria-haspopup") === "menu") {
      return; 
    }
    
    // Filter B: Skip if it has a chevron icon
    if (nativeAddBtn.querySelector('img[alt*="chevron"]')) {
      return;
    }
    
    // Filter C: Skip if the card is too narrow
    if (card.offsetWidth > 0 && card.offsetWidth < 140) {
      return;
    }

    // If it passes the filters, inject BOTH the badge and the button safely
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

      // ── SAFEGUARD: Check if the extension context is still alive ──
      if (!chrome.runtime || !chrome.runtime.id) {
        btn.innerHTML = "⚠️ Please refresh the page";
        btn.style.background = "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)"; // Red error state
        console.warn("[Amazon Pulse] Extension context invalidated. Please reload the webpage.");
        return;
      }

      const ITEM_NAME  = "Nescafe Gold Coffee 50g";
      const ITEM_PRICE = "190";

      // Instantly show a "Processing" state
      btn.disabled = true;
      btn.innerHTML = `<span style="font-size: 16px;">⚙️</span> Processing...`;
      btn.style.background = "linear-gradient(135deg, #d97706 0%, #b45309 100%)";
      btn.style.boxShadow = "0 4px 10px rgba(217, 119, 6, 0.3)";

      // Ask background.js to make the secure API call
      chrome.runtime.sendMessage({
        type: "FRICTIONLESS_BUY",
        payload: {
          title: ITEM_NAME,
          price: ITEM_PRICE,
          user_id: "hackathon_demo_user"
        }
      }, (response) => {
        
        // Handle the response from your Python backend
        if (response && response.success) {
          btn.innerHTML = `✅ Ordered! (ID: ${response.data.order_id})`;
          btn.style.background = "linear-gradient(135deg, #059669 0%, #047857 100%)";
          btn.style.boxShadow = "0 4px 10px rgba(5, 150, 105, 0.4)";
          btn.style.transform = "scale(1.02)";
        } else {
          console.error("Pulse Backend Error:", response?.error);
          
          // Fallback just in case your FastAPI server is offline during the presentation
          btn.innerHTML = `✅ Order Confirmed (Demo)!`;
          btn.style.background = "linear-gradient(135deg, #059669 0%, #047857 100%)";
          btn.style.boxShadow = "0 4px 10px rgba(5, 150, 105, 0.4)";
        }
      });
    });
  }

  function setupCheckoutButton() {
    const btn = document.getElementById("amazon-pulse-checkout-btn");
    if (!btn) return;
    
    btn.addEventListener("click", () => {
      btn.disabled = true;
      // Instantly redirect! No more 1.5 second wait.
      window.location.href = "https://www.amazon.in/tez/browse/cart?qcbrand=qqfsWw9RkO";
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

    if (window.location.href.includes("cart")) {
      return; 
    }

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
                <span style="font-size: 16px; line-height: 1;">✨</span> 
                Pulse 1-Tap Buy 
                <span style="font-size: 16px; line-height: 1;">⚡</span>
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


  // ── Contextual Zero-Search Popup (Hackathon Demo) ─────────────────────────
  function showContextPopup(popupData) {
    if (document.getElementById("pulse-context-popup")) return;

    const popup = document.createElement("div");
    popup.id = "pulse-context-popup";
    popup.className = "amazon-pulse-context-popup";
    // Adding some inline styling to make it wider and fit multiple options cleanly
    popup.style.cssText = "position: fixed; bottom: 20px; right: 20px; width: 340px; background: white; padding: 16px; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); z-index: 2147483647; font-family: 'Amazon Ember', Arial, sans-serif;";

    // Build HTML for each alternate cart option
    const bundlesHtml = popupData.bundles.map((bundle, index) => `
      <div class="pulse-bundle-option" style="border: 1px solid #e7e7e7; border-radius: 8px; padding: 12px; margin-bottom: 12px; background: #f8f8f8;">
        <div style="font-size: 13px; color: #0f1111; margin-bottom: 8px;">
          <strong>${bundle.bundle_name}</strong><br/>
          <span style="font-size: 11px; color: #565959;">${bundle.items.join(" • ")}</span>
        </div>
        <button class="amazon-pulse-auto-buy-btn context-buy-btn" data-index="${index}" style="border-radius: 8px; width: 100%; padding: 8px; cursor: pointer; border: 1px solid #008296; background: #00a8a8; color: white; font-weight: bold;">
          <span style="font-size: 14px;">✨</span> 1-Tap Buy — ₹${bundle.price_inr}
        </button>
      </div>
    `).join("");

    popup.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
        <div class="pulse-context-title" style="font-weight: bold; font-size: 16px; color: #0f1111;">
          ${popupData.message}
        </div>
        <button id="close-context-popup" style="background:none; border:none; cursor:pointer; font-size:22px; line-height: 1;">&times;</button>
      </div>
      <div style="max-height: 400px; overflow-y: auto; padding-right: 4px;">
        ${bundlesHtml}
      </div>
    `;

    document.body.appendChild(popup);

    // Close logic
    document.getElementById("close-context-popup").addEventListener("click", () => {
      popup.remove();
    });

    // 1-Tap Buy logic for ALL buttons
    const buyBtns = popup.querySelectorAll(".context-buy-btn");
    buyBtns.forEach(btn => {
      btn.addEventListener("click", (e) => {
        if (btn.disabled) return;
        
        // Disable all buttons in the popup so they don't double-click
        buyBtns.forEach(b => b.disabled = true);
        
        btn.innerHTML = `⚙️ Adding to Cart...`;
        btn.style.background = "linear-gradient(135deg, #d97706 0%, #b45309 100%)";
        
        // Figure out which bundle they clicked
        const bundleIndex = btn.getAttribute("data-index");
        const selectedBundle = popupData.bundles[bundleIndex];

        // Save to your injected Pulse Cart
        saveToPulseCart({
          bundle_name: selectedBundle.bundle_name,
          items: selectedBundle.items,
          total_price: selectedBundle.price_inr
        });

        // Show success, then instantly redirect to the actual cart page!
        // Show success, then instantly redirect to the actual cart page!
        setTimeout(() => {
          btn.innerHTML = `✅ Added!`;
          btn.style.background = "linear-gradient(135deg, #059669 0%, #047857 100%)";
          btn.style.border = "none";
          
          setTimeout(() => {
            // Redirect straight to the actual Tez Cart!
            window.location.href = "https://www.amazon.in/tez/browse/cart?qcbrand=qqfsWw9RkO";
          }, 400);
        }, 600);
      });
    });
  }

  // ── Secret Hackathon Hotkey Trigger (Mac/Windows Safe) ───────────────
  window.addEventListener("keydown", (event) => {
    if (event.altKey && event.code === "KeyR") {
      event.preventDefault();
      console.log("[Pulse Demo] Hotkey detected! Triggering Rain Bundles...");
      
      // Pass an array of different bundle options
      showContextPopup({
        message: "🌧️ Heavy Rain! Pick your vibe:",
        bundles: [
          {
            bundle_name: "The Classic Pakoda Route",
            items: ["Tata Sampann Pakoda Mix", "Brooke Bond Red Label Tea", "Haldiram's Bhujia"],
            price_inr: 285
          },
          {
            bundle_name: "Spicy Ramen & Chill",
            items: ["Samyang Buldak Ramen (2 Pack)", "Coke Zero 300ml", "Lays India's Magic Masala"],
            price_inr: 340
          },
          {
            bundle_name: "Cozy Soup & Bread",
            items: ["Knorr Classic Tomato Soup", "Britannia Premium Bake Rusk", "Amul Butter"],
            price_inr: 195
          }
        ]
      });
    }
  });
  // ──────────────────────────────────────────────────────────────────────────
  if (document.body) {

    init();

  } else {

    document.addEventListener("DOMContentLoaded", init, { once: true });

  }
  // ── SPA Route Watcher (Fixes Sticky Elements on Back Navigation) ──────────
  let lastUrl = window.location.href;
  
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      console.log("[Pulse SPA Watcher] Route shifted to:", lastUrl);
      
      // If we left the cart page and returned to the browse/home page:
      if (!window.location.href.includes("cart")) {
        console.log("[Pulse SPA Watcher] Left cart page. Cleaning up UI...");
        
        // 1. Remove the custom cart view or order confirmation screens
        // (Targets common element classes/IDs used in our overrides)
        const customCartUI = document.getElementById("pulse-cart-wrapper") || 
                             document.querySelector(".amazon-pulse-cart-container") ||
                             document.querySelector("[style*='z-index: 2147483647']"); // Catch full screen overlays
        
        if (customCartUI && !customCartUI.classList.contains("amazon-pulse-sidebar")) {
          customCartUI.remove();
        }

        // 2. Unsuppress standard Amazon styles (re-enable normal visibility)
        const hiddenStyles = document.getElementById("amazon-pulse-cart-suppress");
        if (hiddenStyles) {
          hiddenStyles.remove();
        }

        // 3. Bring back the clean sidebar control center for the browse page
        injectPulseSidebar();
      }
    }
  }, 300); // Checks every 300ms for seamless response latency
})();
