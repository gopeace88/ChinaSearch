import { useEffect, useState } from "react";
import { listSessions, createSession } from "../api";
import type { SessionSummary } from "../types";

export function SessionList({ onSelect }: { onSelect: (id: number) => void }) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [goal, setGoal] = useState("");

  useEffect(() => { listSessions().then(setSessions); }, []);

  const handleCreate = async () => {
    if (!goal.trim()) return;
    const s = await createSession(goal);
    setSessions((prev) => [s, ...prev]);
    setGoal("");
  };

  return (
    <div>
      <h2>조사 세션</h2>
      <div>
        <input value={goal} onChange={(e) => setGoal(e.target.value)}
          placeholder="조사 목표 (예: A사 블루투스 이어폰 ODM 신뢰성)" />
        <button onClick={handleCreate}>새 조사</button>
      </div>
      <ul>
        {sessions.map((s) => (
          <li key={s.id} onClick={() => onSelect(s.id)} style={{ cursor: "pointer" }}>
            [{s.status}] {s.goal} — {s.confidence_score}% ({s.iteration_count}회)
          </li>
        ))}
      </ul>
    </div>
  );
}
