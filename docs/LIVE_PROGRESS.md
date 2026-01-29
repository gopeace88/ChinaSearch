# Live Progress (UI/UX)

User requirement: while researching, show intermediate outputs so the user can follow along.

## Recommended pattern

Instead of running the loop in the background (`POST /api/sessions/{id}/run`),
call `POST /api/sessions/{id}/step` repeatedly from the frontend.

Each `/step` returns:
- `iteration`: the full `IterationResult`
- `task_results`: list of LLM outputs (text + error)
- `artifact_path`: path to the saved `iteration-XXX.evidence.json`

## Artifact storage

Artifacts are stored under:
- `artifacts/sessions/<session_id>/iteration-XXX.evidence.json`

You can list them with:
- `GET /api/sessions/<session_id>/artifacts`
