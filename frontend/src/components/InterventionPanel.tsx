import { useState } from "react";
import { intervene } from "../api";

export function InterventionPanel({ sessionId, onDone }: { sessionId: number; onDone: () => void }) {
  const [claim, setClaim] = useState("");
  const [content, setContent] = useState("");

  return (
    <div>
      <h3>개입</h3>
      <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
        <input value={claim} onChange={(e) => setClaim(e.target.value)} placeholder="주장" />
        <input value={content} onChange={(e) => setContent(e.target.value)} placeholder="내용" />
        <button onClick={async () => {
          await intervene(sessionId, "add_evidence", { claim, content, source_url: "manual", source_type: "user_generated" });
          setClaim(""); setContent(""); onDone();
        }}>증거 추가</button>
      </div>
      <button onClick={async () => { await intervene(sessionId, "force_stop", { reason: "User stopped" }); onDone(); }}>
        강제 종료
      </button>
    </div>
  );
}
