# Implementation Plan — ChinaSearch (v0.1)

## 0) Summary
We will build an MVP that orchestrates ChatGPT web (Deep Research or normal) using Clawdbot browser relay:
- capture latest answer
- analyze/structure it
- verify minimally (optional)
- generate next prompt
- wait for approval (default)
- optionally auto-run N iterations

## 1) Phases

### Phase 1 — Local workflow + storage (1st milestone)
**Goal:** create reproducible case folders and write iteration artifacts.

Deliverables:
- `cases/<case-id>/case.json`
- `cases/<case-id>/iterations/iteration-001.raw.md`
- `cases/<case-id>/iterations/iteration-001.analysis.json`
- `cases/<case-id>/state.json`

Implementation tasks:
1. Create a `case` creator helper (chat-driven):
   - inputs: goal, decision context, optional constraints
2. Implement file layout + naming scheme.
3. Define JSON schemas for analysis output.


### Phase 2 — Browser Relay capture (2nd milestone)
**Goal:** reliably extract the latest GPT response from the ChatGPT web UI.

Implementation tasks:
1. Require user to attach a tab via Clawdbot Browser Relay (profile=chrome).
2. Implement capture heuristics:
   - locate the latest assistant message container
   - extract plain text + visible links
   - capture timestamp + message id (if present)
3. Add fallback:
   - if extraction fails, prompt user to copy/paste

Notes:
- We avoid brittle selectors; prefer aria/role snapshot refs.


### Phase 3 — Analysis + next prompt generation (3rd milestone)
**Goal:** convert raw text into structured artifacts and next-step suggestions.

Implementation tasks:
1. Parser/formatter:
   - claims/evidence/uncertainties/entities extraction
2. Next-question generator:
   - produce 3–7 questions
   - recommend 1 prompt using `templates/next-question.md`
3. Save artifacts:
   - `iteration-XXX.analysis.json`
   - `iteration-XXX.next.md`

Model strategy:
- Primary reasoning: current agent model
- CN expansion/cross-check prompts: GLM (as configured)


### Phase 4 — Optional verification via web_fetch (4th milestone)
**Goal:** increase confidence by verifying top-K links.

Implementation tasks:
1. From evidence list, pick top-K links (K=3–10).
2. `web_fetch` each link and extract key lines.
3. Update confidence + uncertainties.
4. Add cross-check prompts (CN keywords) using GLM.


### Phase 5 — Orchestration + guardrails + autorun (5th milestone)
**Goal:** run iterative loops with safe defaults.

Implementation tasks:
1. State machine:
   - IDLE → CAPTURED → ANALYZED → READY_TO_SEND → WAIT_APPROVAL → SENT
2. Approval UX:
   - present recommended prompt
   - user replies: approve / edit / stop
3. Auto-run:
   - allow `autorun N`
   - enforce stop criteria (max iterations, VOI, repetition)
4. Logging:
   - `logs/run-<case-id>.log`


## 2) Guardrails (must-have)
- Default approval before sending next prompt.
- Hard cap: iterations <= N.
- Delay between UI actions.
- Stop if the next prompt is too similar to previous.
- Stop if no new evidence for 2 consecutive iterations.


## 3) Repo / Code Organization (inside ChinaSearch)
Proposed structure:
- `docs/` PRD + implementation notes
- `templates/` prompt templates
- `cases/` runtime outputs
- `scripts/` (later) helper scripts (optional)

We can start with “agent-driven” implementation (no code) and evolve to scripts when stable.


## 4) MVP Acceptance Tests
1. Create case → folders created.
2. Capture latest ChatGPT answer → saved raw.
3. Produce analysis JSON + next prompt.
4. Approval step blocks sending.
5. Auto-run N executes N iterations then stops.


## 5) Open Questions
- Where to store attachments metadata (file names + purpose)?
- What report format is preferred (Korean/English, length, tables)?
- Which domains matter most (1688, 天眼查/企查查, CCC/CE/KC docs, FCC, Alibaba)?

