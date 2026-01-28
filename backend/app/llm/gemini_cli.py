from __future__ import annotations

import asyncio
import logging

from app.config import settings
from app.llm.base import LLMResponse

logger = logging.getLogger(__name__)

SEARCH_PROMPT_TEMPLATE = """请用中文搜索以下内容，返回搜索结果的标题、摘要和URL。
搜索查询: {query}

请以结构化方式返回结果。"""


class GeminiCLI:
    """Wrapper around `gemini -p` CLI for Google AI One plan."""

    def __init__(self, cli_path: str | None = None):
        self.cli_path = cli_path or settings.gemini_cli_path

    async def search(self, query: str) -> LLMResponse:
        prompt = SEARCH_PROMPT_TEMPLATE.format(query=query)
        return await self._call(prompt)

    async def summarize_url(self, url: str) -> LLMResponse:
        prompt = f"请用中文总结以下网页的主要内容: {url}"
        return await self._call(prompt)

    async def _call(self, prompt: str) -> LLMResponse:
        try:
            proc = await asyncio.create_subprocess_exec(
                self.cli_path, "-p", prompt,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()

            if proc.returncode != 0:
                error_msg = stderr.decode("utf-8", errors="replace")
                logger.error(f"Gemini CLI error: {error_msg}")
                return LLMResponse(error=error_msg, llm_name="gemini")

            text = stdout.decode("utf-8", errors="replace")
            return LLMResponse(text=text, llm_name="gemini", raw=text)

        except FileNotFoundError:
            return LLMResponse(
                error=f"Gemini CLI not found at '{self.cli_path}'. Install gemini-cli first.",
                llm_name="gemini",
            )
        except Exception as e:
            return LLMResponse(error=str(e), llm_name="gemini")
