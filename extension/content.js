(function () {
  "use strict";

  const SIDEBAR_ID = "amazon-pulse-sidebar";

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
          <div class="amazon-pulse-sidebar__module-content"></div>
        </section>

        <section class="amazon-pulse-sidebar__module" id="amazon-pulse-stockout">
          <h2 class="amazon-pulse-sidebar__module-title">
            🔔 Predictive Stockout <span class="amazon-pulse-sidebar__module-tag">(Collaborative Alerts)</span>
          </h2>
          <div class="amazon-pulse-sidebar__module-content"></div>
        </section>

        <section class="amazon-pulse-sidebar__module" id="amazon-pulse-frictionless">
          <h2 class="amazon-pulse-sidebar__module-title">
            ⚡ Frictionless 1-Tap <span class="amazon-pulse-sidebar__module-tag">(Personalization Vectors)</span>
          </h2>
          <div class="amazon-pulse-sidebar__module-content"></div>
        </section>
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

    chrome.runtime.sendMessage({ type: "PULSE_UI_READY", url: location.href });
  }

  if (document.body) {
    injectPulseSidebar();
  } else {
    document.addEventListener("DOMContentLoaded", injectPulseSidebar, { once: true });
  }
})();
