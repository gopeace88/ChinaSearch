// Messages between content script, background, and sidepanel

export type MessageType =
  // Content script → Background
  | "RESEARCH_COMPLETE"
  | "REPORT_EXTRACTED"
  | "INPUT_INSERTED"
  // Background → Content script
  | "EXTRACT_REPORT"
  | "INSERT_QUESTION"
  | "SUBMIT_QUESTION"
  | "CHECK_RESEARCH_STATUS"
  | "CHECK_NEW_MESSAGE"
  | "MARK_SEEN"
  | "NEW_CHAT"
  | "PING"
  // Background → Sidepanel
  | "STATE_UPDATE"
  | "ANALYSIS_RESULT"
  // Sidepanel → Background
  | "START_SESSION"
  | "STOP_SESSION"
  | "CANCEL_SESSION"
  | "SET_AUTO_MODE"
  | "UPDATE_SETTINGS"
  | "MANUAL_CONFIRM"
  | "GENERATE_REPORT";

export interface ExtMessage {
  type: MessageType;
  payload?: unknown;
}

// Typed message payloads
export interface StartSessionPayload {
  topic: string;
}

export interface InsertQuestionPayload {
  question: string;
  autoSubmit: boolean;
}

export interface ReportExtractedPayload {
  content: string;
}

export interface StateUpdatePayload {
  sessionId: string;
  state: import("./types").SessionState;
  round: number;
  maxRounds: number;
}

export function sendMessage(msg: ExtMessage): Promise<unknown> {
  return chrome.runtime.sendMessage(msg);
}

export function sendTabMessage(tabId: number, msg: ExtMessage): Promise<unknown> {
  return chrome.tabs.sendMessage(tabId, msg);
}
