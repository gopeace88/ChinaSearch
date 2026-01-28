import type { Evidence } from "../types";

export function EvidenceTable({ evidence }: { evidence: Evidence[] }) {
  if (!evidence.length) return <p>증거 없음</p>;
  return (
    <div>
      <h3>증거 ({evidence.length})</h3>
      <table border={1} cellPadding={4} style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr><th>주장</th><th>내용</th><th>출처</th><th>원문</th><th>분석LLM</th><th>유형</th></tr>
        </thead>
        <tbody>
          {evidence.map((e) => (
            <tr key={e.id}>
              <td>{e.claim}</td>
              <td>{e.content.slice(0, 80)}</td>
              <td><a href={e.source_url} target="_blank" rel="noreferrer">{e.source_url.slice(0, 25)}</a></td>
              <td>{e.quality.original_language}</td>
              <td>{e.quality.analyzed_by}</td>
              <td>{e.quality.source_type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
