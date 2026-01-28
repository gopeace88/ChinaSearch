from app.schemas import (
    ResearchState, Question, Evidence, EvidenceQuality, LLMTask,
)


def test_empty_research_state():
    state = ResearchState(research_goal="Test goal")
    assert state.research_goal == "Test goal"
    assert state.confidence_score == 0
    assert state.next_questions == []
    assert state.stop_reason is None
    assert state.internal_language == "zh"


def test_question_tree_structure():
    q1 = Question(id="q1", parent_id=None, type="drill-down", text="根问题?", status="answered")
    q2 = Question(id="q2", parent_id="q1", type="refutation", text="反例?", status="pending")
    state = ResearchState(research_goal="Test", next_questions=[q1, q2])
    assert state.next_questions[1].parent_id == "q1"


def test_evidence_quality_with_language_and_analyzer():
    eq = EvidenceQuality(
        source_type="official",
        source_bias="low",
        freshness="2026-01-29",
        independence_score=0.9,
        original_language="zh",
        analyzed_by="glm",
    )
    ev = Evidence(
        id="e1",
        claim="该公司是实际制造商",
        content="工商登记信息确认",
        source_url="https://example.com",
        quality=eq,
    )
    assert ev.quality.original_language == "zh"
    assert ev.quality.analyzed_by == "glm"


def test_llm_task_schema():
    task = LLMTask(llm="gemini", action="web_search", query="深圳蓝牙耳机制造商")
    assert task.llm == "gemini"
    assert task.action == "web_search"

    task2 = LLMTask(llm="glm", action="analyze_chinese", content="一段中文内容")
    assert task2.content == "一段中文内容"
