import { useState } from "react";
import { intervene } from "../api";

export function InterventionPanel({ sessionId, onDone }: { sessionId: number; onDone: () => void }) {
  const [claim, setClaim] = useState("");
  const [content, setContent] = useState("");
  const [note, setNote] = useState("");

  return (
    <div>
      <h3>개입</h3>

      <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="질문/메모(조사에 반영)" style={{ flex: 1, minWidth: 220 }} />
        <button
          onClick={async () => {
            await intervene(sessionId, "add_note", { text: note });
            setNote("");
            onDone();
          }}
          disabled={!note.trim()}
        >
          메모 추가
        </button>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
        <input value={claim} onChange={(e) => setClaim(e.target.value)} placeholder="주장" style={{ flex: 1, minWidth: 180 }} />
        <input value={content} onChange={(e) => setContent(e.target.value)} placeholder="내용" style={{ flex: 2, minWidth: 240 }} />
        <button
          onClick={async () => {
            await intervene(sessionId, "add_evidence", {
              claim,
              content,
              source_url: "manual",
              source_type: "user_generated",
            });
            setClaim("");
            setContent("");
            onDone();
          }}
          disabled={!claim.trim() || !content.trim()}
        >
          증거 추가
        </button>
      </div>

      <button
        onClick={async () => {
          await intervene(sessionId, "force_stop", { reason: "User stopped" });
          onDone();
        }}
      >
        강제 종료
      </button>
    </div>
  );
}
