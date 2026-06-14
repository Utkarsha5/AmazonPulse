"use strict";

// ═══════════════════════════════════════════════════════════════════════════
// Amazon Pulse — Background Service Worker (MV3)
// ═══════════════════════════════════════════════════════════════════════════
// Handles API relay (bypasses CSP on amazon.in), extension lifecycle events,
// and message routing between content scripts and the backend.
// ═══════════════════════════════════════════════════════════════════════════

const API_BASE = "http://localhost:8000";

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Pulse] Extension installed — background worker active.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {

    case "PULSE_UI_READY":
      console.log("[Pulse] UI injected on:", message.url);
      sendResponse({ ok: true });
      break;

    case "FRICTIONLESS_BUY":
      fetchJSON("/api/v1/frictionless/add", {
        method: "POST",
        body: JSON.stringify(message.payload),
      })
        .then(data => sendResponse({ success: true, data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true; // Keep channel open for async response

    case "CONTEXT_TRIGGER":
      fetchJSON("/api/v1/context/trigger", {
        method: "POST",
        body: JSON.stringify(message.payload),
      })
        .then(data => sendResponse(data))
        .catch(() => sendResponse({ success: false, trigger_found: false }));
      return true;

    case "API_FETCH": {
      const { path, options = {} } = message.payload;
      fetchJSON(path, options)
        .then(data => sendResponse({ success: true, data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    default:
      sendResponse({ error: `Unknown message type: ${message.type}` });
  }
});

// ── Helper: Fetch JSON from the Pulse backend ────────────────────────────────

async function fetchJSON(path, options = {}) {
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
      const body = await response.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      detail = await response.text();
    }
    throw new Error(`${response.status}: ${detail}`);
  }

  return response.json();
}
