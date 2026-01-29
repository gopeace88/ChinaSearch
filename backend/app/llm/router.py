from __future__ import annotations

import logging

from app.llm.base import LLMResponse
from app.llm.claude_cli import ClaudeCLI
from app.llm.gemini_cli import GeminiCLI
from app.llm.glm_sdk import GLMSDK
from app.schemas import LLMTask

logger = logging.getLogger(__name__)


class LLMRouter:
    """Routes LLMTask to the appropriate LLM.

    Key idea: allow `llm="auto"` so we can do cost-effective orchestration:
      - Orchestrator/analysis: Claude (sonnet)
      - Explore/librarian: GLM
      - Search/summarize: Gemini
      - Vision jobs: Gemini for screenshot/document; Claude(haiku) for light label reads (with fallback)

    NOTE: Actual image I/O depends on the underlying CLI/tooling; here we route by intent.
    """

    def __init__(self):
        self.claude = ClaudeCLI()
        self.gemini = GeminiCLI()
        self.glm = GLMSDK()

    def _route_auto(self, task: LLMTask) -> tuple[str, str | None]:
        """Return (llm, model_hint)."""
        # Vision routing (as requested: screenshot>document>label)
        if task.requires_vision or task.vision_job_type:
            v = task.vision_job_type or task.action
            if v in ("screenshot_summary", "document_ocr"):
                return ("gemini", None)
            if v == "label_read":
                # cheap-first by default for label reads
                model = task.model_hint or (settings.claude_model_cheap if task.priority == "cheap_first" else settings.claude_model_main)
                return ("claude", model)

        # Text routing
        if task.action in ("web_search", "summarize_url"):
            return ("gemini", None)

        if task.action in ("optimize_query", "analyze_chinese", "company_analyze", "librarian_extract", "dedupe_evidence"):
            return ("glm", None)

        if task.action in ("analyze_iteration", "merge_evidence", "plan_next"):
            return ("claude", task.model_hint or settings.claude_model_main)

        # Default: orchestrator
        return ("claude", task.model_hint or settings.claude_model_main)

    async def execute(self, task: LLMTask) -> LLMResponse:
        # Resolve llm/model for auto routing
        llm = task.llm
        model = task.model_hint
        if task.llm == "auto":
            llm, model = self._route_auto(task)

        result = await self._dispatch(task, llm=llm, model=model)

        if result.error:
            logger.warning(f"{llm} failed for {task.action}: {result.error}. Trying fallback.")
            result = await self._fallback(task, attempted_llm=llm)

        return result

    async def _dispatch(self, task: LLMTask, llm: str, model: str | None) -> LLMResponse:
        if llm == "gemini":
            if task.action == "web_search":
                return await self.gemini.search(task.query)
            if task.action == "summarize_url":
                return await self.gemini.summarize_url(task.query)
            # Vision tasks (intent-only): we pass the request as text for now.
            if task.action in ("screenshot_summary", "document_ocr", "label_read"):
                return await self.gemini._call(task.content or task.query)

        if llm == "glm":
            if task.action == "analyze_chinese":
                return await self.glm.analyze_chinese(task.content)
            if task.action == "company_analyze":
                return await self.glm.company_analyze(task.content)
            if task.action == "optimize_query":
                return await self.glm.optimize_query(task.query)
            if task.action in ("librarian_extract", "dedupe_evidence"):
                return await self.glm.analyze_chinese(task.content or task.query)

        if llm == "claude":
            return await self.claude.ask(task.content or task.query, model=model)

        return LLMResponse(error=f"Unknown task: {llm}/{task.action}", llm_name=llm)

    async def _fallback(self, task: LLMTask, attempted_llm: str) -> LLMResponse:
        """Fallback strategy.

        - If Gemini/GLM fails: use Claude (sonnet)
        - If Claude fails: use GLM (text-only)
        """
        fallback_prompt = task.content or task.query

        if attempted_llm in ("gemini", "glm"):
            return await self.claude.ask(fallback_prompt, model=settings.claude_model_main)

        if attempted_llm == "claude":
            return await self.glm.analyze_chinese(fallback_prompt)

        return LLMResponse(error="All LLMs failed", llm_name="none")
