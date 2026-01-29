from __future__ import annotations

import json
import logging

from app.engine.prompts import build_system_prompt, build_iteration_message
from app.engine.state import StateManager
from app.engine.artifacts import save_iteration_artifact
from app.llm.base import LLMResponse
from app.llm.claude_cli import ClaudeCLI
from app.llm.router import LLMRouter
from app.schemas import ResearchState, IterationResult
from app.config import settings

logger = logging.getLogger(__name__)


class IDREEngine:
    """Iterative Deep Research Engine — the core orchestrator."""

    def __init__(self, state_manager: StateManager):
        self.state_manager = state_manager
        self.router = LLMRouter()
        self.claude = ClaudeCLI()

    async def run_iteration(
        self,
        session_id: int,
        prev_results: list[LLMResponse] | None = None,
    ) -> IterationResult:
        """Run one IDRE iteration: Claude analyzes -> dispatches LLM tasks."""
        state = self.state_manager.get_state(session_id)

        # 1. Call Claude as analyst
        iteration = await self._call_claude_analyst(state, prev_results or [])

        # 2. Save updated state
        self.state_manager.save_state(session_id, iteration.updated_state)

        # 3. Execute LLM tasks
        results = []
        for task in iteration.tasks:
            result = await self.router.execute(task)
            results.append(result)

        # Persist evidence/task outputs for reproducibility
        it_no = iteration.updated_state.iteration_count or (state.iteration_count + 1)
        try:
            save_iteration_artifact(session_id=session_id, iteration=it_no, tasks=iteration.tasks, results=results)
        except Exception as e:
            logger.warning(f"Failed to save iteration artifact: {e}")

        # Store results for next iteration
        iteration._task_results = results  # type: ignore[attr-defined]

        return iteration

    async def run_loop(
        self,
        session_id: int,
        max_iterations: int = 20,
    ) -> ResearchState:
        """Run the full IDRE loop until stop or max iterations."""
        prev_results: list[LLMResponse] = []

        for i in range(max_iterations):
            logger.info(f"Session {session_id}: iteration {i + 1}")
            iteration = await self.run_iteration(session_id, prev_results)

            if iteration.should_stop:
                logger.info(f"Session {session_id}: stopped at iteration {i + 1}")
                break

            # Carry forward task results to next iteration
            prev_results = getattr(iteration, "_task_results", [])

        return self.state_manager.get_state(session_id)

    async def generate_report(self, session_id: int) -> str:
        """Generate final Korean report from Research State."""
        state = self.state_manager.get_state(session_id)
        prompt = f"""以下是一份中国市场调研的完整状态。请将其转化为韩语调研报告。

报告格式：
# [调查主题]

## 结论 (Executive Summary)
- 核心判断: ...
- 置信度: X%
- 建议行动: 联系/样品/保留/中止

## 证据摘要
| # | 主张 | 证据 | 来源 | 原文语言 | 分析LLM | 可信度 |
|---|------|------|------|----------|---------|--------|

## 已验证假设
## 已反驳假设
## 剩余不确定性
## 调查日志

Research State:
{state.model_dump_json(indent=2)}

请用韩语撰写完整报告。"""

        response = await self.claude.ask(prompt, model=settings.claude_model_main)
        return response.text or "리포트 생성 실패"

    async def _call_claude_analyst(
        self,
        state: ResearchState,
        new_results: list[LLMResponse],
    ) -> IterationResult:
        """Call Claude CLI as the main analyst."""
        system = build_system_prompt()
        message = build_iteration_message(state, new_results)
        full_prompt = f"{system}\n\n---\n\n{message}"

        response = await self.claude.ask(full_prompt, model=settings.claude_model_main)

        if response.error:
            logger.error(f"Claude analyst error: {response.error}")
            return IterationResult(
                updated_state=state,
                reasoning=f"Error: {response.error}",
                tasks=[],
                should_stop=False,
            )

        # Parse JSON from Claude's response
        try:
            text = response.text.strip()
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()

            data = json.loads(text)
            return IterationResult.model_validate(data)

        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"Failed to parse Claude response: {e}")
            logger.debug(f"Raw response: {response.text[:500]}")
            return IterationResult(
                updated_state=state,
                reasoning=response.text[:500],
                tasks=[],
                should_stop=False,
            )
