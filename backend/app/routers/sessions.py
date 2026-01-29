from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.engine.state import StateManager
from app.engine.idre import IDREEngine
from app.models import ResearchSession

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


class CreateSessionRequest(BaseModel):
    goal: str
    decision_context: str = ""


class SessionResponse(BaseModel):
    id: int
    goal: str
    status: str
    iteration_count: int
    confidence_score: float

    model_config = {"from_attributes": True}


@router.post("", response_model=SessionResponse)
def create_session(req: CreateSessionRequest, db: Session = Depends(get_db)):
    mgr = StateManager(db)
    return mgr.create_session(req.goal)


@router.get("", response_model=list[SessionResponse])
def list_sessions(db: Session = Depends(get_db)):
    return db.query(ResearchSession).order_by(ResearchSession.id.desc()).all()


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(session_id: int, db: Session = Depends(get_db)):
    session = db.get(ResearchSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return session


@router.get("/{session_id}/state")
def get_session_state(session_id: int, db: Session = Depends(get_db)):
    mgr = StateManager(db)
    return mgr.get_state(session_id).model_dump()


@router.post("/{session_id}/run")
async def run_session(session_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Run the full loop in the background.

    For live progress, prefer calling /step repeatedly and rendering the outputs.
    """
    session = db.get(ResearchSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    mgr = StateManager(db)
    engine = IDREEngine(state_manager=mgr)
    background_tasks.add_task(engine.run_loop, session_id)
    return {"message": "Research started", "session_id": session_id}


@router.post("/{session_id}/step")
async def step_session(session_id: int, db: Session = Depends(get_db)):
    """Run exactly one iteration and return outputs (so the UI can show progress).

    Returns:
      - iteration: IterationResult
      - task_results: list[{llm_name,text,error}]
      - artifact_path: path to saved evidence json (if written)
    """
    session = db.get(ResearchSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    mgr = StateManager(db)
    engine = IDREEngine(state_manager=mgr)
    iteration = await engine.run_iteration(session_id)
    task_results = getattr(iteration, "_task_results", [])

    return {
        "iteration": iteration.model_dump(),
        "task_results": [
            {"llm_name": r.llm_name, "text": r.text, "error": r.error}
            for r in task_results
        ],
        "artifact_path": getattr(iteration, "_artifact_path", None),
    }


@router.get("/{session_id}/artifacts")
def list_artifacts(session_id: int):
    """List saved evidence artifacts for a session."""
    base = Path(settings.artifacts_dir) / "sessions" / str(session_id)
    if not base.exists():
        return {"files": []}
    files = sorted([p.name for p in base.glob("iteration-*.evidence.json")])
    return {"files": files}


@router.post("/{session_id}/report")
async def generate_report(session_id: int, db: Session = Depends(get_db)):
    session = db.get(ResearchSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    mgr = StateManager(db)
    engine = IDREEngine(state_manager=mgr)
    report = await engine.generate_report(session_id)
    return {"report": report}
