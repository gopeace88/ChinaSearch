import json


def test_create_session(db_session):
    from app.models import ResearchSession

    s = ResearchSession(
        goal="블루투스 이어폰 ODM 업체 조사",
        state_json=json.dumps({"research_goal": "test", "confidence_score": 0}),
        status="running",
    )
    db_session.add(s)
    db_session.commit()
    assert s.id is not None
    assert s.status == "running"


def test_session_state_roundtrip(db_session):
    from app.models import ResearchSession

    state = {"research_goal": "test", "confidence_score": 42, "internal_language": "zh"}
    s = ResearchSession(goal="test", state_json=json.dumps(state), status="running")
    db_session.add(s)
    db_session.commit()
    loaded = json.loads(s.state_json)
    assert loaded["confidence_score"] == 42
    assert loaded["internal_language"] == "zh"
