from __future__ import annotations

from dataclasses import dataclass


@dataclass
class LLMResponse:
    text: str = ""
    error: str | None = None
    llm_name: str = ""
    raw: str = ""
