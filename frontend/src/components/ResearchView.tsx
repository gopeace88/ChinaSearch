import { useEffect, useState } from "react";
import { getState, runSession, generateReport } from "../api";
import type { ResearchState } from "../types";
import { EvidenceTable } from "./EvidenceTable";
import { QuestionTree } from "./QuestionTree";
import { InterventionPanel } from "./InterventionPanel";

export function ResearchView({ sessionId }: { sessionId: number }) {
  const [state, setState] = useState<ResearchState | null>(null);
  const [report, setReport] = useState<string | null>(null);

  const refresh = () => getState(sessionId).then(setState);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [sessionId]);

  if (!state) return <p>Loading...</p>;

  return (
    <div>
      <h2>{state.research_goal}</h2>
      <p>신뢰도: {state.confidence_score}% | 반복: {state.iteration_count}회 | 내부언어: {state.internal_language}</p>
      {state.stop_reason && <p><strong>종료: {state.stop_reason}</strong></p>}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => runSession(sessionId).then(refresh)}>조사 실행</button>
        <button onClick={() => generateReport(sessionId).then((r) => setReport(r.report))}>
          한국어 리포트 생성
        </button>
      </div>

      {report && <pre style={{ background: "#f5f5f5", padding: 16 }}>{report}</pre>}

      <h3>가설</h3>
      <ul>{state.current_hypotheses.map((h, i) => <li key={i}>{h}</li>)}</ul>

      <h3>불확실성</h3>
      <ul>{state.uncertainties.map((u, i) => <li key={i}>{u}</li>)}</ul>

      <QuestionTree questions={state.next_questions} />
      <EvidenceTable evidence={state.evidence_list} />
      <InterventionPanel sessionId={sessionId} onDone={refresh} />
    </div>
  );
}
