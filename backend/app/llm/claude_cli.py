from __future__ import annotations

import asyncio
import logging

from app.config import settings
from app.llm.base import LLMResponse

logger = logging.getLogger(__name__)


class ClaudeCLI:
    """Wrapper around `claude -p` CLI for Max+5 plan."""

    def __init__(self, cli_path: str | None = None):
        self.cli_path = cli_path or settings.claude_cli_path

    async def ask(self, prompt: str) -> LLMResponse:
        try:
            proc = await asyncio.create_subprocess_exec(
                self.cli_path, "-p", prompt,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()

            if proc.returncode != 0:
                error_msg = stderr.decode("utf-8", errors="replace")
                logger.error(f"Claude CLI error: {error_msg}")
                return LLMResponse(error=error_msg, llm_name="claude")

            text = stdout.decode("utf-8", errors="replace")
            return LLMResponse(text=text, llm_name="claude", raw=text)

        except FileNotFoundError:
            return LLMResponse(
                error=f"Claude CLI not found at '{self.cli_path}'. Install Claude Code first.",
                llm_name="claude",
            )
        except Exception as e:
            return LLMResponse(error=str(e), llm_name="claude")
