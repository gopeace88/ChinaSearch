import type { ResearchSession } from "../../shared/types";

export function AnalysisView({ session }: { session: ResearchSession | null }) {
  if (!session || session.analyses.length === 0) {
    return <p style={{ color: "#6b7280" }}>No analysis results yet.</p>;
  }

  return (
    <div>
      {/* Display final report if available */}
      {session.finalReport && (
        <div style={{ marginBottom: 24, padding: 16, background: "#fef3c7", borderRadius: 8, border: "2px solid #f59e0b" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "#92400e" }}>📋 ChatGPT 최종 보고서</h3>
          <details open>
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14, marginBottom: 8, color: "#b45309" }}>
              전체 내용 보기
            </summary>
            <pre style={{
              whiteSpace: "pre-wrap",
              fontSize: 13,
              margin: 0,
              maxHeight: 500,
              overflow: "auto",
              background: "#fffbeb",
              padding: 12,
              borderRadius: 6,
              border: "1px solid #fde68a"
            }}>
              {session.finalReport}
            </pre>
          </details>
        </div>
      )}

      {/* Display round-by-round analyses */}
      {[...session.analyses].reverse().map((a, i) => (
        <div key={i} style={{ marginBottom: 16, padding: 12, background: "#f9fafb", borderRadius: 6, border: "1px solid #e5e7eb" }}>
          <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Round {a.round}</h4>

          {a.glmClaims && (
            <details style={{ marginBottom: 8 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13 }}>GLM 추출 핵심 사실</summary>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, margin: "4px 0", maxHeight: 200, overflow: "auto" }}>
                {a.glmClaims}
              </pre>
            </details>
          )}

          {a.searchResults && a.searchResults !== "(검색 결과 없음)" && (
            <details style={{ marginBottom: 8 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Brave 검색 결과</summary>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, margin: "4px 0", maxHeight: 200, overflow: "auto" }}>
                {a.searchResults}
              </pre>
            </details>
          )}

          {a.metaAssessment && (
            <details style={{ marginBottom: 8 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13, color: "#7c3aed" }}>Claude 전략 자가진단</summary>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, margin: "4px 0", maxHeight: 150, overflow: "auto", background: "#f5f3ff", padding: 8, borderRadius: 4 }}>
                {a.metaAssessment}
              </pre>
            </details>
          )}

          <details style={{ marginBottom: 8 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Claude 종합 분석</summary>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, margin: "4px 0", maxHeight: 200, overflow: "auto" }}>
              {a.claudeAnalysis}
            </pre>
          </details>

          <div style={{ background: "#eff6ff", padding: 8, borderRadius: 4, fontSize: 13 }}>
            <strong>Follow-up:</strong> {a.followUpQuestion}
          </div>
        </div>
      ))}
    </div>
  );
}
