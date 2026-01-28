from __future__ import annotations

import logging

from app.llm.base import LLMResponse
from app.llm.claude_cli import ClaudeCLI
from app.llm.gemini_cli import GeminiCLI
from app.llm.glm_sdk import GLMSDK
from app.schemas import LLMTask

logger = logging.getLogger(__name__)


class LLMRouter:
    """Routes LLMTask to the appropriate LLM based on task.llm and task.action."""

    def __init__(self):
        self.claude = ClaudeCLI()
        self.gemini = GeminiCLI()
        self.glm = GLMSDK()

    async def execute(self, task: LLMTask) -> LLMResponse:
        result = await self._dispatch(task)

        if result.error:
            logger.warning(f"{task.llm} failed for {task.action}: {result.error}. Trying fallback.")
            result = await self._fallback(task)

        return result

    async def _dispatch(self, task: LLMTask) -> LLMResponse:
        if task.llm == "gemini":
            if task.action == "web_search":
                return await self.gemini.search(task.query)
            elif task.action == "summarize_url":
                return await self.gemini.summarize_url(task.query)

        elif task.llm == "glm":
            if task.action == "analyze_chinese":
                return await self.glm.analyze_chinese(task.content)
            elif task.action == "company_analyze":
                return await self.glm.company_analyze(task.content)
            elif task.action == "optimize_query":
                return await self.glm.optimize_query(task.query)

        elif task.llm == "claude":
            return await self.claude.ask(task.content or task.query)

        return LLMResponse(error=f"Unknown task: {task.llm}/{task.action}", llm_name=task.llm)

    async def _fallback(self, task: LLMTask) -> LLMResponse:
        """Fallback: if Gemini fails -> Claude, if GLM fails -> Claude, if Claude fails -> GLM."""
        fallback_prompt = task.content or task.query
        if task.llm in ("gemini", "glm"):
            return await self.claude.ask(fallback_prompt)
        elif task.llm == "claude":
            return await self.glm.analyze_chinese(fallback_prompt)
        return LLMResponse(error="All LLMs failed", llm_name="none")
