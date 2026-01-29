from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

from app.config import settings
from app.llm.base import LLMResponse
from app.schemas import LLMTask


@dataclass
class TaskResultArtifact:
    llm: str
    action: str
    query: str = ""
    content_preview: str = ""
    ok: bool = True
    error: str | None = None
    output_preview: str = ""
    output_text: str = ""


@dataclass
class IterationArtifact:
    session_id: int
    iteration: int
    created_at: str
    task_results: list[TaskResultArtifact]


def _preview(s: str, n: int = 300) -> str:
    s = s or ""
    s = s.strip()
    return s if len(s) <= n else s[:n] + " …"


def save_iteration_artifact(
    session_id: int,
    iteration: int,
    tasks: list[LLMTask],
    results: list[LLMResponse],
) -> Path:
    """Persist task results for a given iteration.

    Files are written under:
      <artifacts_dir>/sessions/<session_id>/iteration-XXX.evidence.json
    """

    out_dir = Path(settings.artifacts_dir) / "sessions" / str(session_id)
    out_dir.mkdir(parents=True, exist_ok=True)

    created_at = datetime.now(timezone.utc).isoformat()

    tr: list[TaskResultArtifact] = []
    for t, r in zip(tasks, results, strict=False):
        tr.append(
            TaskResultArtifact(
                llm=r.llm_name or t.llm,
                action=t.action,
                query=t.query,
                content_preview=_preview(t.content),
                ok=r.error is None,
                error=r.error,
                output_preview=_preview(r.text),
                output_text=r.text or "",
            )
        )

    payload = IterationArtifact(
        session_id=session_id,
        iteration=iteration,
        created_at=created_at,
        task_results=tr,
    )

    path = out_dir / f"iteration-{iteration:03d}.evidence.json"
    path.write_text(json.dumps(asdict(payload), ensure_ascii=False, indent=2), encoding="utf-8")
    return path
