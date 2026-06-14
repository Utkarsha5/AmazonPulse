"use strict";

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Amazon Pulse] Extension installed and background worker active.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PULSE_UI_READY") {
    console.log("[Amazon Pulse] UI injected on:", message.url);
    sendResponse({ ok: true });
    
  } else if (message.type === "FRICTIONLESS_BUY") {
    // Background scripts CAN make localhost HTTP requests without being blocked by Amazon's CSP
    fetch("http://localhost:8000/api/v1/frictionless/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.payload)
    })
      .then(response => response.json())
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        console.error("Backend fetch error:", error);
        sendResponse({ success: false, error: error.message });
      });
      
    return true; // Important: Keeps the message channel open for the async fetch response
  }
  else if (message.type === "CONTEXT_TRIGGER") {
    fetch("http://localhost:8000/api/v1/context/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.payload)
    })
      .then(response => response.json())
      .then(data => sendResponse(data))
      .catch(error => {
        console.error("Context fetch error:", error);
        sendResponse({ success: false, trigger_found: false });
      });

    return true; // Keep channel open
  }
});