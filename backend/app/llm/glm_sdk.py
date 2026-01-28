from __future__ import annotations

import asyncio
import logging

from app.config import settings
from app.llm.base import LLMResponse

logger = logging.getLogger(__name__)

ANALYZE_PROMPT = """你是中国市场调研专家。请用中文分析以下内容，提取关键事实和判断：

{content}

请以结构化方式返回：
1. 关键事实
2. 可能的风险点
3. 需要进一步验证的内容"""

COMPANY_PROMPT = """你是中国企业信息分析专家。请用中文分析以下企业信息：

{content}

请判断：
1. 企业基本状况（正常/异常）
2. 是否为实际制造商还是贸易商
3. 可信度评估
4. 需要进一步验证的内容"""


class GLMSDK:
    """Wrapper around zhipuai Python SDK for GLM coding-lite plan."""

    def _get_client(self):
        from zhipuai import ZhipuAI
        return ZhipuAI(api_key=settings.glm_api_key)

    async def analyze_chinese(self, content: str) -> LLMResponse:
        prompt = ANALYZE_PROMPT.format(content=content)
        return await self._call(prompt)

    async def company_analyze(self, content: str) -> LLMResponse:
        prompt = COMPANY_PROMPT.format(content=content)
        return await self._call(prompt)

    async def optimize_query(self, query: str) -> LLMResponse:
        prompt = f"请将以下调研需求转化为最优的中文搜索关键词（返回3-5个搜索查询）：\n{query}"
        return await self._call(prompt)

    async def _call(self, prompt: str) -> LLMResponse:
        try:
            client = self._get_client()
            response = await asyncio.to_thread(
                client.chat.completions.create,
                model=settings.glm_model,
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.choices[0].message.content
            return LLMResponse(text=text, llm_name="glm", raw=text)

        except Exception as e:
            logger.error(f"GLM SDK error: {e}")
            return LLMResponse(error=str(e), llm_name="glm")
