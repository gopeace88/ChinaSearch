import pytest
from unittest.mock import AsyncMock, patch

from app.engine.idre import IDREEngine
from app.engine.state import StateManager
from app.schemas import ResearchState, IterationResult, LLMTask, Question
from app.llm.base import LLMResponse


@pytest.fixture
def engine(db_session):
    mgr = StateManager(db_session)
    return IDREEngine(state_manager=mgr)


def _make_iteration_result(state: ResearchState, should_stop: bool = False) -> IterationResult:
    state.iteration_count += 1
    if not should_stop:
        state.next_questions.append(
            Question(
                id=f"q{state.iteration_count}",
                parent_id=None,
                type="drill-down",
                text="是否有实际工厂?",
                status="pending",
            )
        )
    return IterationResult(
        updated_state=state,
        reasoning="测试推理过程",
        tasks=[LLMTask(llm="gemini", action="web_search", query="test")] if not should_stop else [],
        should_stop=should_stop,
    )


@pytest.mark.asyncio
async def test_engine_runs_one_iteration(engine, db_session):
    mgr = StateManager(db_session)
    session = mgr.create_session("Test research")
    state = mgr.get_state(session.id)
    result = _make_iteration_result(state, should_stop=True)

    with patch.object(engine, "_call_claude_analyst", new_callable=AsyncMock) as mock:
        mock.return_value = result
        iteration = await engine.run_iteration(session.id)
        assert iteration.should_stop is True


@pytest.mark.asyncio
async def test_engine_dispatches_llm_tasks(engine, db_session):
    mgr = StateManager(db_session)
    session = mgr.create_session("Test research")
    state = mgr.get_state(session.id)
    result = _make_iteration_result(state, should_stop=False)

    with patch.object(engine, "_call_claude_analyst", new_callable=AsyncMock) as mock_claude:
        mock_claude.return_value = result
        with patch.object(engine.router, "execute", new_callable=AsyncMock) as mock_router:
            mock_router.return_value = LLMResponse(text="搜索结果", llm_name="gemini")
            iteration = await engine.run_iteration(session.id)
            mock_router.assert_called_once()


@pytest.mark.asyncio
async def test_engine_loop_stops_on_should_stop(engine, db_session):
    mgr = StateManager(db_session)
    session = mgr.create_session("Test")
    state = mgr.get_state(session.id)
    result = _make_iteration_result(state, should_stop=True)

    with patch.object(engine, "_call_claude_analyst", new_callable=AsyncMock) as mock:
        mock.return_value = result
        with patch.object(engine.router, "execute", new_callable=AsyncMock):
            final_state = await engine.run_loop(session.id, max_iterations=10)
            assert mock.call_count == 1
