import { useState } from "react";
import { SessionList } from "./components/SessionList";
import { ResearchView } from "./components/ResearchView";

export default function App() {
  const [sid, setSid] = useState<number | null>(null);
  return (
    <div style={{ padding: 20 }}>
      <h1>ChinaSearch</h1>
      <p>멀티 LLM 중국 시장 리서치 에이전트</p>
      <div style={{ display: "flex", gap: 20 }}>
        <div style={{ width: 320 }}><SessionList onSelect={setSid} /></div>
        <div style={{ flex: 1 }}>{sid ? <ResearchView sessionId={sid} /> : <p>세션을 선택하세요</p>}</div>
      </div>
    </div>
  );
}
