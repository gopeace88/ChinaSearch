from __future__ import annotations

from pydantic import BaseModel, Field


class EvidenceQuality(BaseModel):
    source_type: str  # official | commercial | user_generated | media
    source_bias: str  # low | medium | high
    freshness: str  # YYYY-MM-DD
    independence_score: float = 0.0
    original_language: str = "zh"  # zh | en | ko
    analyzed_by: str = ""  # glm | gemini | claude


class Evidence(BaseModel):
    id: str
    claim: str
    content: str
    source_url: str
    quality: EvidenceQuality


class Question(BaseModel):
    id: str
    parent_id: str | None = None
    type: str  # drill-down | refutation | cross-check | expand-graph
    text: str
    status: str = "pending"  # pending | answered | skipped


class LLMTask(BaseModel):
    """A task to be dispatched to an LLM.

    We support `llm="auto"` so the router can choose a cost-effective model
    based on action + whether vision is required.
    """

    llm: str = "auto"  # auto | claude | gemini | glm

    # High-level action. Keep it small + composable.
    # text:
    # - web_search, summarize_url
    # - optimize_query, analyze_chinese, company_analyze
    # - dedupe_evidence, librarian_extract
    # orchestration:
    # - analyze_iteration, merge_evidence, plan_next
    # vision:
    # - screenshot_summary, document_ocr, label_read
    action: str

    query: str = ""
    content: str = ""

    # Optional routing hints
    requires_vision: bool = False
    vision_job_type: str | None = None  # screenshot_summary | document_ocr | label_read
    priority: str = "accurate_first"  # accurate_first | cheap_first
    model_hint: str | None = None


class ResearchState(BaseModel):
    research_goal: str
    decision_context: str = ""
    assumptions: list[str] = Field(default_factory=list)
    current_hypotheses: list[str] = Field(default_factory=list)
    evidence_list: list[Evidence] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)
    confidence_score: float = 0
    next_questions: list[Question] = Field(default_factory=list)
    iteration_count: int = 0
    internal_language: str = "zh"
    stop_reason: str | None = None


class IterationResult(BaseModel):
    """Claude's response after evaluating one IDRE iteration."""
    updated_state: ResearchState
    reasoning: str
    tasks: list[LLMTask] = Field(default_factory=list)
    should_stop: bool = False
