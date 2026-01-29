# Workflow

## Case lifecycle
- Create a case with a short slug (e.g. `2026-01-29-xoss-soteck-orkar`).
- Each loop writes an iteration file and updates `state.json`.

## Iteration steps
1) Capture
- Extract ChatGPT output (main answer + citations/links) from the browser.
- Save to `cases/<case>/iterations/iteration-XXX.raw.md`.

2) Analyze
- Parse into:
  - Claims
  - Evidence (links + quotes)
  - Uncertainties
  - Next questions

3) Verify (optional but recommended)
- Use `web_fetch` on a small set of high-value links.
- Use GLM for Chinese-language expansion/cross-check queries.

4) Next prompt
- Produce 3–7 candidate next questions.
- Recommend 1.

5) Human approval (default)
- Only send next prompt to ChatGPT after explicit approval.

## Auto-run mode
- Enable for max N iterations.
- Stop on:
  - repeated/low-VOI questions
  - no new evidence
  - conflicts requiring human judgment

