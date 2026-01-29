# PRD — ChinaSearch: GPT Deep Research Loop Agent (v0.1)

## 1. North Star
Reduce the time/cognitive load required to source and validate Chinese electronic components by automating the repetitive loop:

> Deep Research output → extract/structure → verify/cross-check → propose next questions → (approve) → run again

while keeping the **ChatGPT web UI** as the front-end for:
- Deep Research mode
- file attachments (PDF/spec sheets/images/certificates)

## 2. User
- Korean operator sourcing electronic components from China, selling in Korea.
- Needs: fast company/product/market verification, evidence, uncertainty tracking, repeatable outputs.

## 3. Problem
Current workflow is manual and repetitive:
- run GPT/Claude deep research
- read report, decide next questions
- re-run, iterate
- hard to track evidence, avoid repetition, or stop at the right time

## 4. Non-goals (v0.1)
- Fully autonomous web crawling beyond what Deep Research provides
- Fully automatic Deep Research mode switching (user controls it)
- Automatic negotiation, outreach, or ordering
- Guaranteeing truth; we produce evidence-backed, uncertainty-aware guidance

## 5. Product Principles
1) **Web UI first**: ChatGPT web is the primary surface (attachments included).
2) **HITL by default**: user approves before sending the next prompt.
3) **Auto-run optional**: allow N-step unattended iterations with strong guardrails.
4) **Evidence Gate**: separate claims vs evidence vs uncertainty.
5) **Recoverable**: store every iteration + state; resume from last.

## 6. Core Workflow (IDRE-lite)
Each iteration:
1) Capture: extract the latest GPT response (text + visible citations/links)
2) Parse: claims/evidence/uncertainties/entities
3) Verify (optional): minimal web_fetch checks for top-K links + CN query expansion via GLM
4) Next-step: generate candidate next questions + recommended next prompt
5) Decide:
   - default: wait for approval
   - optional: auto-run for max N iterations

## 7. Functional Requirements
### FR1 — Browser-based capture
- Must read the latest answer from ChatGPT web UI.
- Must detect “answer completed” reliably enough (heuristics).

### FR2 — Case management
- Create a case (slug + metadata).
- Store:
  - raw captured output per iteration
  - normalized analysis per iteration
  - running state.json

### FR3 — Analysis
- Extract:
  - Claims (what is asserted)
  - Evidence (links, quotes, doc refs)
  - Uncertainties (missing / conflicting)
  - Entities (company names, brands, locations)
- Produce a concise report.

### FR4 — Next-question generation
- Generate 3–7 candidate next questions.
- Provide 1 recommended next prompt.

### FR5 — Guardrails / Stop Criteria
- Stop if:
  - repeated/low-VOI questions
  - no new evidence found
  - conflicts requiring human judgment
  - max iteration N reached
  - max wall-clock time reached

### FR6 — Human approval (default)
- Before sending the next prompt to ChatGPT, require explicit approval.

### FR7 — Auto-run mode (optional)
- Allow enabling “auto-run max N iterations” for unattended runs.
- Must still honor guardrails and stop criteria.

### FR8 — Chinese-language verification assistance
- Use GLM to propose Chinese search terms, entity variants, and cross-check angles.
- If Brave/web_search is available, allow optional external verification.

## 8. Data Model (v0.1)
### Case
- id (slug)
- created_at
- goal
- attachments (manual description)
- settings (approval mode, max iterations)

### Iteration
- iteration_no
- captured_at
- raw_text
- parsed: claims/evidence/uncertainties/entities
- next_questions
- recommended_prompt
- decision (approved/skipped)

## 9. UX / Interaction
Primary UX in chat:
- Commands:
  - create case
  - capture iteration
  - analyze
  - propose next
  - approve/send
  - enable autorun N
  - stop

Secondary UX (optional later): lightweight dashboard.

## 10. Security / Compliance
- Avoid storing sensitive user attachments; store references/notes.
- Do not auto-send externally (emails/messages) without explicit instruction.
- Be cautious about automating web UIs; add delays and manual override.

## 11. Success Metrics
- Time-to-first-decision reduced by >50%.
- Clear evidence table + uncertainty list in every report.
- Low repetition: fewer redundant iterations.
- Stable unattended run for N iterations without runaway loops.
