import type { ExtMessage, StartSessionPayload } from "../shared/messages";
import type { Settings } from "../shared/types";
import { DEFAULT_SETTINGS } from "../shared/constants";
import { startSession, stopSession, cancelSession, getSession, getUsage, onStateChange, confirmAndProceed, generateFinalReport } from "./state-machine";

console.log("[CS-BG] Background service worker started");

// WebSocket connection to Gateway
let gatewaySocket: WebSocket | null = null;

function connectToGateway() {
  const gatewayUrl = 'ws://localhost:3004/ws';

  try {
    console.log('[CS-BG] Connecting to Gateway WebSocket...');
    gatewaySocket = new WebSocket(gatewayUrl);

    gatewaySocket.onopen = () => {
      console.log('[CS-BG] Connected to Gateway');
      gatewaySocket?.send(JSON.stringify({ type: 'EXTENSION_READY' }));
    };

    gatewaySocket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('[CS-BG] Received from Gateway:', message.type);

        if (message.type === 'START_SESSION') {
          const { sessionId, topic, maxRounds } = message.payload;
          const { messageId } = message;

          console.log(`[CS-BG] Starting session: ${topic}, maxRounds: ${maxRounds}, sessionId: ${sessionId}`);

          const settings = await getSettings();
          // Gateway에서 시작하는 세션은 항상 autoMode이고, Gateway의 sessionId 사용
          await startSession(topic, { ...settings, maxRounds, autoMode: true }, sessionId);

          // Send response back
          gatewaySocket?.send(JSON.stringify({
            type: 'SESSION_STARTED',
            messageId,
            success: true
          }));
        } else if (message.type === 'STOP_SESSION') {
          const { messageId } = message;

          console.log('[CS-BG] Stopping session (generate final report)');
          stopSession();

          gatewaySocket?.send(JSON.stringify({
            type: 'SESSION_STOPPED',
            messageId,
            success: true
          }));
        } else if (message.type === 'CANCEL_SESSION') {
          const { messageId } = message;

          console.log('[CS-BG] Canceling session (no final report)');
          cancelSession();

          // Send response back
          gatewaySocket?.send(JSON.stringify({
            type: 'SESSION_CANCELLED',
            messageId,
            success: true
          }));
        }
      } catch (error) {
        console.error('[CS-BG] Error handling Gateway message:', error);
      }
    };

    gatewaySocket.onclose = () => {
      console.log('[CS-BG] Disconnected from Gateway, reconnecting in 3s...');
      gatewaySocket = null;
      setTimeout(connectToGateway, 3000);
    };

    gatewaySocket.onerror = (error) => {
      console.error('[CS-BG] WebSocket error:', error);
    };
  } catch (error) {
    console.error('[CS-BG] Failed to connect to Gateway:', error);
    setTimeout(connectToGateway, 3000);
  }
}

// Connect to Gateway on startup
connectToGateway();

// Open side panel when extension icon clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// On install/update, inject content script into already-open ChatGPT tabs
chrome.runtime.onInstalled.addListener(async () => {
  console.log("[CS-BG] Extension installed/updated, injecting into existing tabs...");
  const manifest = chrome.runtime.getManifest();
  const files = manifest.content_scripts?.[0]?.js;
  if (!files) return;
  const tabs = await chrome.tabs.query({ url: ["*://chatgpt.com/*", "*://chat.openai.com/*"] });
  for (const tab of tabs) {
    if (tab.id) {
      chrome.scripting.executeScript({ target: { tabId: tab.id }, files }).catch((e) =>
        console.warn("[CS-BG] Failed to inject into tab", tab.id, e)
      );
    }
  }
});

// Load settings from storage
async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...result.settings };
}

// Broadcast state changes to sidepanel AND Gateway
onStateChange((session) => {
  console.log("[CS-BG] State changed:", session.state, "round:", session.round);

  // Send to sidepanel
  chrome.runtime.sendMessage({
    type: "STATE_UPDATE",
    payload: {
      sessionId: session.id,
      state: session.state,
      round: session.round,
      maxRounds: session.maxRounds,
    },
  }).catch(() => {});

  // Send to Gateway via WebSocket
  if (gatewaySocket && gatewaySocket.readyState === WebSocket.OPEN) {
    gatewaySocket.send(JSON.stringify({
      type: "PROGRESS_UPDATE",
      payload: {
        sessionId: session.id,
        state: session.state,
        round: session.round,
        maxRounds: session.maxRounds,
        topic: session.topic,
        progressLog: session.progressLog,
        analyses: session.analyses,
        finalReport: session.finalReport || null,
      },
    }));
  }
});

// Handle messages
chrome.runtime.onMessage.addListener((message: ExtMessage, _sender, sendResponse) => {
  console.log("[CS-BG] Received message:", message.type);

  // Handle GET_SESSION synchronously (no async needed)
  if ((message as any).type === "GET_SESSION") {
    sendResponse({ session: getSession(), usage: getUsage() });
    return false;
  }

  (async () => {
    try {
      const settings = await getSettings();

      switch (message.type) {
        case "START_SESSION": {
          const { topic } = message.payload as StartSessionPayload;
          console.log("[CS-BG] Starting session for topic:", topic);
          await startSession(topic, settings);
          console.log("[CS-BG] Session started, polling active");
          sendResponse({ success: true });
          break;
        }
        case "STOP_SESSION":
          stopSession();
          sendResponse({ success: true });
          break;
        case "CANCEL_SESSION":
          cancelSession();
          sendResponse({ success: true });
          break;
        case "MANUAL_CONFIRM":
          confirmAndProceed(settings);
          sendResponse({ success: true });
          break;
        case "SET_AUTO_MODE": {
          const session = getSession();
          if (session) session.autoMode = (message.payload as { autoMode: boolean }).autoMode;
          sendResponse({ success: true });
          break;
        }
        case "UPDATE_SETTINGS": {
          await chrome.storage.local.set({ settings: message.payload });
          sendResponse({ success: true });
          break;
        }
        case "GENERATE_REPORT": {
          const report = generateFinalReport();
          sendResponse({ success: true, report });
          break;
        }
        case "RESEARCH_COMPLETE":
          break;
      }
    } catch (err) {
      console.error("[CS-BG] Error handling message:", message.type, err);
      sendResponse({ success: false, error: String(err) });
    }
  })();
  return true;
});

// Storage listener for Gateway commands (CDP-compatible)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace !== 'local') return;

  for (const [key, { newValue }] of Object.entries(changes)) {
    if (key.startsWith('gateway_command_')) {
      console.log("[CS-BG] Gateway command received via storage:", newValue);

      (async () => {
        try {
          const settings = await getSettings();

          if (newValue.type === "START_SESSION") {
            const { topic, payload } = newValue;
            const maxRounds = payload?.maxRounds || 3;
            console.log(`[CS-BG] Starting session via gateway: ${topic}, maxRounds: ${maxRounds}`);
            await startSession(topic, { ...settings, maxRounds });
            console.log("[CS-BG] Session started successfully");
          }

          // Clean up the command from storage
          await chrome.storage.local.remove(key);
        } catch (err) {
          console.error("[CS-BG] Error handling gateway command:", err);
        }
      })();
    }
  }
});

// External message handler for Playwright integration
type ExternalMessage =
  | { type: "START_SESSION"; payload: { topic: string; maxRounds: number } }
  | { type: "PAUSE_SESSION" }
  | { type: "RESUME_SESSION" }
  | { type: "CANCEL_SESSION" }
  | { type: "GET_PROGRESS" }
  | { type: "GET_STATUS" };

chrome.runtime.onMessageExternal.addListener(
  (message: ExternalMessage, sender, sendResponse) => {
    console.log("[CS-BG] External message received:", message.type, "from:", sender.url);

    (async () => {
      try {
        switch (message.type) {
          case "START_SESSION": {
            const settings = await getSettings();
            await startSession(message.payload.topic, {
              ...settings,
              maxRounds: message.payload.maxRounds,
              autoMode: true, // External execution is always automatic
            });
            sendResponse({ success: true });
            break;
          }

          case "PAUSE_SESSION": {
            // Pause not implemented yet - would need to add pause state to session
            sendResponse({ success: true, message: "Pause not fully implemented yet" });
            break;
          }

          case "RESUME_SESSION": {
            // Resume not implemented yet - would need to restore paused session
            sendResponse({ success: true, message: "Resume not fully implemented yet" });
            break;
          }

          case "CANCEL_SESSION": {
            await stopSession();
            sendResponse({ success: true });
            break;
          }

          case "GET_PROGRESS": {
            const session = getSession();
            if (!session) {
              sendResponse({ error: "No active session" });
              break;
            }

            sendResponse({
              id: session.id,
              topic: session.topic,
              state: session.state,
              round: session.round,
              maxRounds: session.maxRounds,
              progressLog: session.progressLog,
              analyses: session.analyses.map((a) => ({
                round: a.round,
                followUpQuestion: a.followUpQuestion,
                createdAt: a.createdAt,
              })),
            });
            break;
          }

          case "GET_STATUS": {
            const session = getSession();
            if (!session) {
              sendResponse({ active: false });
              break;
            }

            sendResponse({
              active: true,
              id: session.id,
              topic: session.topic,
              state: session.state,
              round: session.round,
              maxRounds: session.maxRounds,
            });
            break;
          }

          default:
            sendResponse({ error: "Unknown message type" });
        }
      } catch (err) {
        console.error("[CS-BG] External message error:", err);
        sendResponse({ error: String(err) });
      }
    })();

    return true; // Async response
  }
);
