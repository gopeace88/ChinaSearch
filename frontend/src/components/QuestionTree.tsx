import type React from "react";
import type { Question } from "../types";

export function QuestionTree({ questions }: { questions: Question[] }) {
  const roots = questions.filter((q) => !q.parent_id);
  const renderQ = (q: Question, depth = 0): React.ReactElement => {
    const children = questions.filter((c) => c.parent_id === q.id);
    return (
      <div key={q.id} style={{ marginLeft: depth * 20, marginBottom: 4 }}>
        <span style={{ color: q.status === "answered" ? "green" : q.status === "skipped" ? "gray" : "black" }}>
          [{q.type}] {q.text} ({q.status})
        </span>
        {children.map((c) => renderQ(c, depth + 1))}
      </div>
    );
  };
  return (
    <div>
      <h3>질문 트리</h3>
      {roots.length ? roots.map((r) => renderQ(r)) : <p>질문 없음</p>}
    </div>
  );
}
