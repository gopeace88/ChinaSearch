import { useEffect, useState, useCallback } from "react";
import type { ResearchSession, LLMUsage } from "../../shared/types";
import type { ExtMessage } from "../../shared/messages";

export function useResearchSession() {
  const [session, setSession] = useState<ResearchSession | null>(null);
  const [usage, setUsage] = useState<LLMUsage>({ glmCalls: 0, claudeCalls: 0 });

  // Listen for state updates from background
  useEffect(() => {
    const handler = (message: ExtMessage) => {
      if (message.type === "STATE_UPDATE") {
        // Refresh full session
        chrome.runtime.sendMessage({ type: "GET_SESSION" } as any).then((res: any) => {
          setSession(res?.session || null);
          if (res?.usage) setUsage(res.usage);
        });
      }
    };
    chrome.runtime.onMessage.addListener(handler);

    // Initial fetch
    chrome.runtime.sendMessage({ type: "GET_SESSION" } as any).then((res: any) => {
      if (res?.session) setSession(res.session);
      if (res?.usage) setUsage(res.usage);
    }).catch(() => {});

    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  const start = useCallback((topic: string) => {
    chrome.runtime.sendMessage({ type: "START_SESSION", payload: { topic } });
  }, []);

  const cancel = useCallback(() => {
    chrome.runtime.sendMessage({ type: "CANCEL_SESSION" });
  }, []);

  const confirm = useCallback(() => {
    chrome.runtime.sendMessage({ type: "MANUAL_CONFIRM" });
  }, []);

  const downloadReport = useCallback(async () => {
    const response = await chrome.runtime.sendMessage({ type: "GENERATE_REPORT" }) as any;
    if (response?.success && response?.report) {
      const blob = new Blob([response.report], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = `research-${date}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, []);

  return { session, usage, start, cancel, confirm, downloadReport };
}
