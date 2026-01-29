from __future__ import annotations

import asyncio
import logging

from app.config import settings
from app.llm.base import LLMResponse

logger = logging.getLogger(__name__)


class ClaudeCLI:
    """Wrapper around `claude -p` CLI.

    Note: Claude Code supports `--model <alias|full-name>`.
    We use this for orchestration (sonnet) vs cheap worker (haiku).
    """

    def __init__(self, cli_path: str | None = None):
        self.cli_path = cli_path or settings.claude_cli_path

    async def ask(self, prompt: str, model: str | None = None) -> LLMResponse:
        try:
            cmd = [self.cli_path, "-p"]
            if model:
                cmd += ["--model", model]
            cmd.append(prompt)

            proc = await asyncio.create_subprocess_exec(
                *cmd,
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
