from app.engine.state import StateManager
from app.schemas import ResearchState, Question


def test_create_session(db_session):
    mgr = StateManager(db_session)
    session = mgr.create_session("블루투스 이어폰 ODM 조사")
    assert session.id is not None
    state = mgr.get_state(session.id)
    assert state.research_goal == "블루투스 이어폰 ODM 조사"
    assert state.internal_language == "zh"


def test_update_state(db_session):
    mgr = StateManager(db_session)
    session = mgr.create_session("Test")
    state = mgr.get_state(session.id)
    state.confidence_score = 50
    state.current_hypotheses = ["该公司是实际制造商"]
    mgr.save_state(session.id, state)
    reloaded = mgr.get_state(session.id)
    assert reloaded.confidence_score == 50
    assert "该公司是实际制造商" in reloaded.current_hypotheses


def test_add_question_to_tree(db_session):
    mgr = StateManager(db_session)
    session = mgr.create_session("Test")
    state = mgr.get_state(session.id)
    q = Question(id="q1", parent_id=None, type="drill-down", text="是否有实际工厂?", status="pending")
    state.next_questions.append(q)
    mgr.save_state(session.id, state)
    reloaded = mgr.get_state(session.id)
    assert len(reloaded.next_questions) == 1
    assert reloaded.next_questions[0].text == "是否有实际工厂?"


def test_complete_session(db_session):
    mgr = StateManager(db_session)
    session = mgr.create_session("Test")
    state = mgr.get_state(session.id)
    state.stop_reason = "调查完成"
    mgr.save_state(session.id, state)
    from app.models import ResearchSession
    updated = db_session.get(ResearchSession, session.id)
    assert updated.status == "completed"
