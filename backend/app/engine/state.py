from sqlalchemy.orm import Session

from app.models import ResearchSession
from app.schemas import ResearchState


class StateManager:
    def __init__(self, db: Session):
        self.db = db

    def create_session(self, goal: str) -> ResearchSession:
        state = ResearchState(research_goal=goal)
        session = ResearchSession(
            goal=goal,
            state_json=state.model_dump_json(),
            status="running",
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_state(self, session_id: int) -> ResearchState:
        session = self.db.get(ResearchSession, session_id)
        if session is None:
            raise ValueError(f"Session {session_id} not found")
        return ResearchState.model_validate_json(session.state_json)

    def save_state(self, session_id: int, state: ResearchState) -> None:
        session = self.db.get(ResearchSession, session_id)
        if session is None:
            raise ValueError(f"Session {session_id} not found")
        session.state_json = state.model_dump_json()
        session.iteration_count = state.iteration_count
        session.confidence_score = state.confidence_score
        if state.stop_reason:
            session.status = "completed"
        self.db.commit()
