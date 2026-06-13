"use strict";

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Amazon Pulse] Extension installed and background worker active.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PULSE_UI_READY") {
    console.log("[Amazon Pulse] UI injected on:", message.url);
    sendResponse({ ok: true });
  } else {
    sendResponse({ ok: false, error: "Unknown message type" });
  }
  return true;
});