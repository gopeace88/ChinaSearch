# ChinaSearch

China-focused iterative deep research workspace.

## Goal
Use ChatGPT Deep Research (web UI) + Clawdbot orchestration to:
- capture research outputs
- extract claims/evidence/uncertainties
- generate next-step questions
- iterate with human approval (default) or limited auto-run

## Directory layout
- `cases/` — one folder per research case
- `cases/<case-id>/iterations/` — captured outputs per iteration
- `cases/<case-id>/state.json` — current research state (lightweight)
- `templates/` — prompt/report templates
- `logs/` — run logs / debugging notes
- `docs/` — design notes and how-to

## Workflow (MVP)
1. Human runs ChatGPT Deep Research (with file attachments as needed).
2. Clawdbot reads the answer from the browser tab.
3. Clawdbot analyzes + verifies (optionally with web_fetch + GLM for CN sources).
4. Clawdbot proposes next questions.
5. Human approves (default) or enables auto-run for N iterations.

## Guardrails
- Default: require approval before sending the next prompt.
- Optional: auto-run max N iterations with stop criteria.

