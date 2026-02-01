import { extractLatestReport, checkForNewMessage, markCurrentAsSeen, isStreaming, checkForContentGrowth } from "./chatgpt-reader";
import { insertText, submitInput, startNewChat } from "./chatgpt-writer";
import type { ExtMessage, CheckContentGrowthPayload } from "../shared/messages";

// Prevent duplicate injection
if ((window as any).__csExtLoaded) {
  console.log("[CS-Extension] Already loaded, skipping duplicate injection");
} else {
  (window as any).__csExtLoaded = true;
  console.log("[CS-Extension] Content script loaded on ChatGPT");
}

// Listen for messages from background (always re-register to ensure latest code handles messages)
chrome.runtime.onMessage.addListener(
  (message: ExtMessage, _sender, sendResponse) => {
    console.log("[CS-Extension] Received message:", message.type);

    switch (message.type) {
      case "PING": {
        sendResponse({ pong: true });
        break;
      }
      case "EXTRACT_REPORT": {
        const content = extractLatestReport();
        console.log("[CS-Extension] Extract report:", content ? content.slice(0, 80) + "..." : "null");
        sendResponse({ content });
        break;
      }
      case "CHECK_RESEARCH_STATUS": {
        const streaming = isStreaming();
        console.log("[CS-Extension] Streaming:", streaming);
        sendResponse({ inProgress: streaming });
        break;
      }
      case "CHECK_NEW_MESSAGE": {
        const newMsg = checkForNewMessage();
        console.log("[CS-Extension] New message check:", newMsg ? "YES" : "no");
        sendResponse({ content: newMsg });
        break;
      }
      case "INSERT_QUESTION": {
        const { question, autoSubmit } = message.payload as {
          question: string;
          autoSubmit: boolean;
        };
        const inserted = insertText(question);
        console.log("[CS-Extension] Insert result:", inserted);
        if (inserted && autoSubmit) {
          setTimeout(() => {
            const submitted = submitInput();
            console.log("[CS-Extension] Auto-submit result:", submitted);
          }, 500);
        }
        sendResponse({ success: inserted });
        break;
      }
      case "SUBMIT_QUESTION": {
        sendResponse({ success: submitInput() });
        break;
      }
      case "CHECK_CONTENT_GROWTH": {
        const minLen = (message.payload as CheckContentGrowthPayload)?.minLength || 200;
        const grown = checkForContentGrowth(minLen);
        console.log("[CS-Extension] Content growth:", grown ? "YES (" + grown.length + " chars)" : "no");
        sendResponse({ content: grown });
        break;
      }
      case "MARK_SEEN": {
        markCurrentAsSeen();
        sendResponse({ success: true });
        break;
      }
      case "NEW_CHAT": {
        const success = startNewChat();
        sendResponse({ success });
        break;
      }
    }
    return true;
  }
);

console.log("[CS-Extension] Message listener registered");
