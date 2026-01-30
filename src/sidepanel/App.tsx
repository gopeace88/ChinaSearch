import { useState } from "react";
import { StatusBar } from "./components/StatusBar";
import { AnalysisView } from "./components/AnalysisView";
import { SettingsPanel } from "./components/SettingsPanel";
import { useResearchSession } from "./hooks/useResearchSession";

export function App() {
  const [tab, setTab] = useState<"research" | "settings">("research");
  const { session, usage, start, cancel, confirm, downloadReport } = useResearchSession();

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 12, fontSize: 14 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, borderBottom: "1px solid #ddd", paddingBottom: 8 }}>
        <button
          onClick={() => setTab("research")}
          style={{ fontWeight: tab === "research" ? "bold" : "normal", background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "4px 8px", borderBottom: tab === "research" ? "2px solid #2563eb" : "none" }}
        >
          Research
        </button>
        <button
          onClick={() => setTab("settings")}
          style={{ fontWeight: tab === "settings" ? "bold" : "normal", background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "4px 8px", borderBottom: tab === "settings" ? "2px solid #2563eb" : "none" }}
        >
          Settings
        </button>
      </div>

      {tab === "research" ? (
        <>
          <StatusBar session={session} usage={usage} />
          <StartControl session={session} onStart={start} onCancel={cancel} onConfirm={confirm} onDownloadReport={downloadReport} />
          <AnalysisView session={session} />
        </>
      ) : (
        <SettingsPanel />
      )}
    </div>
  );
}

function StartControl({ session, onStart, onCancel, onConfirm, onDownloadReport }: {
  session: ReturnType<typeof useResearchSession>["session"];
  onStart: (topic: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  onDownloadReport: () => void;
}) {
  const [topic, setTopic] = useState("");
  const [showCustomRounds, setShowCustomRounds] = useState(false);
  const [customRounds, setCustomRounds] = useState(5);

  if (!session || session.state === "IDLE") {
    return (
      <div style={{ marginBottom: 16 }}>
        {session && session.analyses.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <button onClick={onDownloadReport} style={{ padding: "8px 16px", background: "#7c3aed", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 14 }}>
              📄 내부 기록 다운로드
            </button>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
              전체 {session.analyses.length}개 라운드의 송수신 기록 (ChatGPT 보고서 + 검색 결과 + Claude 분석)
            </div>
          </div>
        )}
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter research topic..."
          rows={3}
          style={{ width: "100%", padding: 8, fontSize: 14, border: "1px solid #ccc", borderRadius: 4, resize: "vertical" }}
        />
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>반복 횟수:</span>
          <button
            onClick={() => { setCustomRounds(3); setShowCustomRounds(false); }}
            style={{ padding: "4px 12px", background: !showCustomRounds && customRounds === 3 ? "#2563eb" : "#e5e7eb", color: !showCustomRounds && customRounds === 3 ? "white" : "#374151", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13 }}
          >
            3
          </button>
          <button
            onClick={() => { setCustomRounds(5); setShowCustomRounds(false); }}
            style={{ padding: "4px 12px", background: !showCustomRounds && customRounds === 5 ? "#2563eb" : "#e5e7eb", color: !showCustomRounds && customRounds === 5 ? "white" : "#374151", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13 }}
          >
            5
          </button>
          <button
            onClick={() => { setCustomRounds(10); setShowCustomRounds(false); }}
            style={{ padding: "4px 12px", background: !showCustomRounds && customRounds === 10 ? "#2563eb" : "#e5e7eb", color: !showCustomRounds && customRounds === 10 ? "white" : "#374151", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13 }}
          >
            10
          </button>
          <button
            onClick={() => setShowCustomRounds(true)}
            style={{ padding: "4px 12px", background: showCustomRounds ? "#2563eb" : "#e5e7eb", color: showCustomRounds ? "white" : "#374151", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13 }}
          >
            직접입력
          </button>
          {showCustomRounds && (
            <input
              type="number"
              min={1}
              max={50}
              value={customRounds}
              onChange={(e) => setCustomRounds(Number(e.target.value))}
              style={{ width: 60, padding: "4px 8px", border: "1px solid #ccc", borderRadius: 4, fontSize: 13 }}
              autoFocus
            />
          )}
        </div>
        <button
          onClick={() => {
            if (topic.trim() && customRounds > 0 && customRounds <= 50) {
              // Update settings with custom rounds
              chrome.runtime.sendMessage({ type: "UPDATE_SETTINGS", payload: { maxRounds: customRounds } });
              onStart(topic.trim());
            }
          }}
          disabled={!topic.trim() || customRounds < 1 || customRounds > 50}
          style={{ marginTop: 8, padding: "8px 16px", background: "#2563eb", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 14, width: "100%" }}
        >
          Start Research ({customRounds} rounds)
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
      <button onClick={onCancel} style={{ padding: "6px 12px", background: "#f97316", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13 }}>
        ✕ Cancel (즉시 중단)
      </button>
      {session.state === "WAITING_CONFIRM" && (
        <button onClick={onConfirm} style={{ padding: "6px 12px", background: "#16a34a", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13 }}>
          ✓ Confirm & Continue
        </button>
      )}
      {session.analyses.length > 0 && (
        <button onClick={onDownloadReport} style={{ padding: "6px 12px", background: "#7c3aed", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13 }}>
          📄 보고서 저장
        </button>
      )}
    </div>
  );
}
