from app.engine.prompts import build_system_prompt, build_iteration_message
from app.schemas import ResearchState
from app.llm.base import LLMResponse


def test_system_prompt_contains_evidence_gate():
    prompt = build_system_prompt()
    assert "Evidence Gate" in prompt
    assert "假设" in prompt


def test_system_prompt_requires_chinese_internal():
    prompt = build_system_prompt()
    assert "中文" in prompt


def test_system_prompt_defines_json_response():
    prompt = build_system_prompt()
    assert "updated_state" in prompt
    assert "should_stop" in prompt
    assert "tasks" in prompt


def test_iteration_message_includes_state():
    state = ResearchState(research_goal="调查蓝牙耳机ODM", confidence_score=30)
    msg = build_iteration_message(state, new_results=[])
    assert "调查蓝牙耳机ODM" in msg
    assert "30" in msg


def test_iteration_message_includes_new_evidence():
    state = ResearchState(research_goal="Test")
    results = [
        LLMResponse(text="搜索结果: 深圳工厂信息", llm_name="gemini"),
        LLMResponse(text="企业分析: 正常经营", llm_name="glm"),
    ]
    msg = build_iteration_message(state, new_results=results)
    assert "搜索结果" in msg
    assert "gemini" in msg
    assert "glm" in msg
