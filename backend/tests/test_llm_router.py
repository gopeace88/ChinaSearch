import pytest
from unittest.mock import AsyncMock, patch
from app.llm.router import LLMRouter
from app.llm.base import LLMResponse
from app.schemas import LLMTask


@pytest.mark.asyncio
async def test_router_dispatches_web_search_to_gemini():
    router = LLMRouter()
    task = LLMTask(llm="gemini", action="web_search", query="深圳蓝牙耳机")

    with patch.object(router.gemini, "search", new_callable=AsyncMock) as mock:
        mock.return_value = LLMResponse(text="results", llm_name="gemini")
        result = await router.execute(task)
        assert result.llm_name == "gemini"
        mock.assert_called_once_with("深圳蓝牙耳机")


@pytest.mark.asyncio
async def test_router_dispatches_analyze_to_glm():
    router = LLMRouter()
    task = LLMTask(llm="glm", action="analyze_chinese", content="中文内容")

    with patch.object(router.glm, "analyze_chinese", new_callable=AsyncMock) as mock:
        mock.return_value = LLMResponse(text="分析结果", llm_name="glm")
        result = await router.execute(task)
        assert result.llm_name == "glm"


@pytest.mark.asyncio
async def test_router_dispatches_company_to_glm():
    router = LLMRouter()
    task = LLMTask(llm="glm", action="company_analyze", content="企业信息")

    with patch.object(router.glm, "company_analyze", new_callable=AsyncMock) as mock:
        mock.return_value = LLMResponse(text="企业分析", llm_name="glm")
        result = await router.execute(task)
        assert result.llm_name == "glm"


@pytest.mark.asyncio
async def test_router_fallback_on_error():
    router = LLMRouter()
    task = LLMTask(llm="gemini", action="web_search", query="test")

    with patch.object(router.gemini, "search", new_callable=AsyncMock) as mock_gemini:
        mock_gemini.return_value = LLMResponse(error="rate limited", llm_name="gemini")
        with patch.object(router.claude, "ask", new_callable=AsyncMock) as mock_claude:
            mock_claude.return_value = LLMResponse(text="fallback result", llm_name="claude")
            result = await router.execute(task)
            assert result.text == "fallback result"
            mock_claude.assert_called_once()
