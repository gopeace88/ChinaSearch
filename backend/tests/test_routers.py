import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine)

    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200


def test_create_session(client):
    resp = client.post("/api/sessions", json={"goal": "蓝牙耳机ODM调查"})
    assert resp.status_code == 200
    assert resp.json()["goal"] == "蓝牙耳机ODM调查"
    assert resp.json()["id"] is not None


def test_list_sessions(client):
    client.post("/api/sessions", json={"goal": "A"})
    client.post("/api/sessions", json={"goal": "B"})
    resp = client.get("/api/sessions")
    assert len(resp.json()) == 2


def test_get_session_state(client):
    resp = client.post("/api/sessions", json={"goal": "Test"})
    sid = resp.json()["id"]
    resp = client.get(f"/api/sessions/{sid}/state")
    assert resp.status_code == 200
    assert resp.json()["research_goal"] == "Test"
    assert resp.json()["internal_language"] == "zh"


def test_intervene_add_evidence(client):
    resp = client.post("/api/sessions", json={"goal": "Test"})
    sid = resp.json()["id"]
    resp = client.post(f"/api/sessions/{sid}/intervene", json={
        "action": "add_evidence",
        "payload": {
            "claim": "工厂已确认",
            "content": "实地考察确认",
            "source_url": "manual",
            "source_type": "user_generated",
        },
    })
    assert resp.status_code == 200
    state = client.get(f"/api/sessions/{sid}/state").json()
    assert len(state["evidence_list"]) == 1


def test_intervene_force_stop(client):
    resp = client.post("/api/sessions", json={"goal": "Test"})
    sid = resp.json()["id"]
    resp = client.post(f"/api/sessions/{sid}/intervene", json={
        "action": "force_stop",
        "payload": {"reason": "信息已足够"},
    })
    assert resp.status_code == 200
    session = client.get(f"/api/sessions/{sid}").json()
    assert session["status"] == "completed"
