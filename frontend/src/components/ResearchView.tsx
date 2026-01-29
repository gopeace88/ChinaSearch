import { useEffect, useMemo, useRef, useState } from "react";
import { getState, runSession, generateReport, stepSession } from "../api";
import type { ResearchState, StepResponse } from "../types";
import { EvidenceTable } from "./EvidenceTable";
import { QuestionTree } from "./QuestionTree";
import { InterventionPanel } from "./InterventionPanel";

type LogEntry = {
  at: string;
  iterationNo: number;
  reasoning: string;
  tasks: { llm: string; action: string; query?: string }[];
  taskResults: { llm_name: string; ok: boolean; text: string; error: string | null }[];
  artifactPath: string | null;
};

export function ResearchView({ sessionId }: { sessionId: number }) {
  const [state, setState] = useState<ResearchState | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [auto, setAuto] = useState(false);
  const [busy, setBusy] = useState(false);

  const autoRef = useRef(false);
  autoRef.current = auto;

  const refresh = () => getState(sessionId).then(setState);

  useEffect(() => {
    setLog([]);
    setReport(null);
    setAuto(false);
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const runStep = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const resp: StepResponse = await stepSession(sessionId);
      setState(resp.iteration.updated_state);

      const now = new Date();
      setLog((prev) => [
        {
          at: now.toLocaleString(),
          iterationNo: resp.iteration.updated_state.iteration_count,
          reasoning: resp.iteration.reasoning,
          tasks: (resp.iteration.tasks || []).map((t) => ({ llm: t.llm, action: t.action, query: t.query })),
          taskResults: (resp.task_results || []).map((r) => ({
            llm_name: r.llm_name,
            ok: !r.error,
            text: r.text,
            error: r.error,
          })),
          artifactPath: resp.artifact_path,
        },
        ...prev,
      ]);

      if (resp.iteration.should_stop || resp.iteration.updated_state.stop_reason) {
        setAuto(false);
      }
    } finally {
      setBusy(false);
    }
  };

  // auto-run loop via polling
  useEffect(() => {
    if (!auto) return;
    let cancelled = false;

    const tick = async () => {
      if (cancelled || !autoRef.current) return;
      await runStep();
      if (cancelled || !autoRef.current) return;
      setTimeout(tick, 1500);
    };

    tick();
    return () => {
      cancelled = true;
    };
  }, [auto]);

  const header = useMemo(() => {
    if (!state) return null;
    return (
      <>
        <h2>{state.research_goal}</h2>
        <p>
          신뢰도: {state.confidence_score}% | 반복: {state.iteration_count}회 | 내부언어: {state.internal_language}
        </p>
        {state.stop_reason && (
          <p>
            <strong>종료: {state.stop_reason}</strong>
          </p>
        )}
      </>
    );
  }, [state]);

  if (!state) return <p>Loading...</p>;

  return (
    <div>
      {header}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={runStep} disabled={busy || !!state.stop_reason}>
          {busy ? "실행 중..." : "한 단계 실행(/step)"}
        </button>
        <button onClick={() => setAuto((v) => !v)} disabled={busy || !!state.stop_reason}>
          {auto ? "자동 진행 중지" : "자동 진행(1.5s)"}
        </button>
        <button onClick={() => runSession(sessionId).then(refresh)} disabled={busy}>
          백그라운드 실행(/run)
        </button>
        <button onClick={() => generateReport(sessionId).then((r) => setReport(r.report))}>
          한국어 리포트 생성
        </button>
      </div>

      {report && <pre style={{ background: "#f5f5f5", padding: 16, whiteSpace: "pre-wrap" }}>{report}</pre>}

      <h3>라이브 로그 (최신이 위)</h3>
      {log.length === 0 ? (
        <p style={{ color: "#666" }}>아직 실행된 step이 없습니다. "한 단계 실행"을 눌러보세요.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {log.map((e, idx) => (
            <details key={idx} open={idx === 0} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 10 }}>
              <summary style={{ cursor: "pointer" }}>
                <strong>Iteration {e.iterationNo}</strong> · {e.at}
                {e.artifactPath ? <span style={{ marginLeft: 8, color: "#666" }}>({e.artifactPath})</span> : null}
              </summary>
              <div style={{ marginTop: 10 }}>
                <h4>Reasoning</h4>
                <pre style={{ background: "#f8f8f8", padding: 10, whiteSpace: "pre-wrap" }}>{e.reasoning}</pre>

                <h4>Tasks</h4>
                <ul>
                  {e.tasks.length === 0 ? (
                    <li style={{ color: "#666" }}>(no tasks)</li>
                  ) : (
                    e.tasks.map((t, i) => (
                      <li key={i}>
                        <code>{t.llm}</code> / <code>{t.action}</code>
                        {t.query ? <span style={{ color: "#666" }}> — {t.query}</span> : null}
                      </li>
                    ))
                  )}
                </ul>

                <h4>Task outputs</h4>
                {e.taskResults.length === 0 ? (
                  <p style={{ color: "#666" }}>(no outputs)</p>
                ) : (
                  e.taskResults.map((r, i) => (
                    <details key={i} style={{ marginBottom: 8 }}>
                      <summary style={{ cursor: "pointer" }}>
                        <code>{r.llm_name}</code> {r.ok ? "OK" : "ERROR"}
                        {r.error ? <span style={{ color: "#b00" }}> — {r.error}</span> : null}
                      </summary>
                      <pre style={{ background: "#f8f8f8", padding: 10, whiteSpace: "pre-wrap" }}>
                        {r.text || ""}
                      </pre>
                    </details>
                  ))
                )}
              </div>
            </details>
          ))}
        </div>
      )}

      <h3>사용자 메모(최근)</h3>
      {state.user_notes?.length ? (
        <ul>{state.user_notes.slice(-10).map((n, i) => <li key={i}>{n}</li>)}</ul>
      ) : (
        <p style={{ color: "#666" }}>(없음)</p>
      )}

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
