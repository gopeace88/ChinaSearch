# Analysis Output (v0.1)

This is the structure saved to `cases/<case>/iterations/iteration-XXX.analysis.json`.

```json
{
  "iteration": 1,
  "captured_at": "ISO-8601",
  "summary_ko": "...",
  "claims": [
    {"id": "c1", "text": "...", "confidence": 0.0, "status": "claim|hypothesis"}
  ],
  "evidence": [
    {"id": "e1", "url": "https://...", "label": "...", "notes": "...", "source_type": "official|commercial|media|user_generated|unknown"}
  ],
  "uncertainties": ["..."],
  "next_questions": [
    {"id": "q1", "type": "drill-down|cross-check|refutation|expand-graph", "text": "..."}
  ],
  "recommended_prompt": "..."
}
```
