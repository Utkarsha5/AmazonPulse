"use strict";

const API_BASE = "http://localhost:8000";

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Amazon Pulse] Extension installed and background worker active.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PULSE_UI_READY") {
    console.log("[Amazon Pulse] UI injected on:", message.url);
    sendResponse({ ok: true });

  } else if (message.type === "FRICTIONLESS_BUY") {
    fetch(`${API_BASE}/api/v1/frictionless/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.payload)
    })
      .then(response => response.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(error => {
        console.error("[Amazon Pulse] Backend fetch error:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true;

  } else if (message.type === "CONTEXT_TRIGGER") {
    fetch(`${API_BASE}/api/v1/context/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.payload)
    })
      .then(response => response.json())
      .then(data => sendResponse(data))
      .catch(error => {
        console.error("[Amazon Pulse] Context fetch error:", error);
        sendResponse({ success: false, trigger_found: false });
      });
    return true;

  } else if (message.type === "API_FETCH") {
    // Generic API proxy — content script sends { path, options }
    const { path, options = {} } = message.payload;
    fetch(`${API_BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    })
      .then(async (response) => {
        if (!response.ok) {
          let detail = response.statusText;
          try {
            const errorBody = await response.json();
            detail = errorBody.detail || JSON.stringify(errorBody);
          } catch {
            detail = await response.text();
          }
          sendResponse({ success: false, error: `Request failed (${response.status}): ${detail}` });
          return;
        }
        const data = await response.json();
        sendResponse({ success: true, data });
      })
      .catch(error => {
        console.error("[Amazon Pulse] API proxy error:", error);
        sendResponse({
          success: false,
          error: "Cannot reach Amazon Pulse backend. Start it with: python main.py (localhost:8000)"
        });
      });
    return true;
  }
});