import type { ResearchSession, LLMUsage } from "../../shared/types";

const STATE_LABELS: Record<string, string> = {
  IDLE: "대기 중",
  WAITING_RESEARCH: "ChatGPT 응답 대기 중...",
  READING_RESULT: "보고서 읽는 중...",
  ANALYZING: "분석 진행 중...",
  INSERTING_QUESTION: "후속 질문 입력 중...",
  WAITING_CONFIRM: "확인 대기",
  AUTO_SUBMIT: "자동 제출 중...",
  WAITING_FINAL_REPORT: "최종 보고서 대기 중...",
};

function elapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}초 전`;
  return `${Math.floor(s / 60)}분 ${s % 60}초 전`;
}

export function StatusBar({ session, usage }: { session: ResearchSession | null; usage: LLMUsage }) {
  if (!session) return null;

  const isActive = session.state !== "IDLE" && session.state !== "WAITING_CONFIRM";
  const isAnalyzing = session.state === "ANALYZING" || session.state === "WAITING_FINAL_REPORT";
  const log = session.progressLog || [];
  const now = Date.now();

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Main status */}
      <div style={{
        background: isActive ? "#2563eb" : session.state === "WAITING_CONFIRM" ? "#16a34a" : "#6b7280",
        color: "white",
        padding: "8px 12px",
        borderRadius: 6,
        fontSize: 14,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>
            {isAnalyzing && <span style={{ display: "inline-block", animation: "spin 1s linear infinite", marginRight: 6 }}>⏳</span>}
            {STATE_LABELS[session.state] || session.state}
          </span>
          <span>Round {session.round}/{session.maxRounds}</span>
        </div>
        <div style={{ fontSize: 12, marginTop: 4, opacity: 0.8 }}>
          GLM: {usage.glmCalls}회 | Claude: {usage.claudeCalls}회
        </div>
      </div>

      {/* Live progress log */}
      {log.length > 0 && (
        <div style={{
          marginTop: 8,
          padding: 8,
          background: "#f0f9ff",
          border: "1px solid #bae6fd",
          borderRadius: 6,
          fontSize: 12,
          maxHeight: 160,
          overflowY: "auto",
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: "#0369a1" }}>진행 상황</div>
          {log.slice(-8).map((entry, i) => (
            <div key={i} style={{
              padding: "2px 0",
              color: entry.step.includes("❌") || entry.step.includes("⚠️") ? "#dc2626" : "#374151",
              opacity: i === log.slice(-8).length - 1 ? 1 : 0.7,
              fontWeight: i === log.slice(-8).length - 1 ? 600 : 400,
            }}>
              <span>{entry.step}</span>
              <span style={{ color: "#6b7280", marginLeft: 6 }}>{entry.detail}</span>
              <span style={{ color: "#9ca3af", marginLeft: 6, fontSize: 11 }}>{elapsed(now - entry.time)}</span>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
