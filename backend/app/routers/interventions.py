from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.engine.state import StateManager
from app.schemas import Evidence, EvidenceQuality

router = APIRouter(prefix="/api/sessions", tags=["interventions"])


class InterventionRequest(BaseModel):
    action: str  # add_evidence | add_note | force_stop | skip_question
    payload: dict


@router.post("/{session_id}/intervene")
def intervene(session_id: int, req: InterventionRequest, db: Session = Depends(get_db)):
    mgr = StateManager(db)
    state = mgr.get_state(session_id)

    if req.action == "add_evidence":
        p = req.payload
        ev = Evidence(
            id=str(uuid.uuid4())[:8],
            claim=p["claim"],
            content=p["content"],
            source_url=p["source_url"],
            quality=EvidenceQuality(
                source_type=p.get("source_type", "user_generated"),
                source_bias="medium",
                freshness="",
                original_language="ko",
                analyzed_by="user",
            ),
        )
        state.evidence_list.append(ev)
        mgr.save_state(session_id, state)
        return {"message": "Evidence added", "evidence_id": ev.id}

    elif req.action == "add_note":
        note = (req.payload.get("text") or "").strip()
        if not note:
            raise HTTPException(400, "Missing payload.text")
        state.user_notes.append(note)
        mgr.save_state(session_id, state)
        return {"message": "Note added"}

    elif req.action == "force_stop":
        state.stop_reason = req.payload.get("reason", "User forced stop")
        mgr.save_state(session_id, state)
        return {"message": "Session stopped"}

    elif req.action == "skip_question":
        qid = req.payload.get("question_id")
        for q in state.next_questions:
            if q.id == qid:
                q.status = "skipped"
        mgr.save_state(session_id, state)
        return {"message": f"Question {qid} skipped"}

    else:
        raise HTTPException(400, f"Unknown action: {req.action}")
