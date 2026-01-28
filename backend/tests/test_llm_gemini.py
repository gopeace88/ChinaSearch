import pytest
from unittest.mock import patch, AsyncMock
from app.llm.gemini_cli import GeminiCLI


@pytest.mark.asyncio
async def test_gemini_cli_web_search():
    gemini = GeminiCLI()
    with patch("asyncio.create_subprocess_exec") as mock_exec:
        mock_proc = AsyncMock()
        mock_proc.communicate = AsyncMock(return_value=(
            b"Search results: Shenzhen Bluetooth factory found at...", b""
        ))
        mock_proc.returncode = 0
        mock_exec.return_value = mock_proc
        response = await gemini.search("深圳蓝牙耳机制造商")
        assert response.text is not None
        assert response.llm_name == "gemini"
        call_args = mock_exec.call_args[0]
        assert "gemini" in call_args[0]


@pytest.mark.asyncio
async def test_gemini_cli_handles_error():
    gemini = GeminiCLI()
    with patch("asyncio.create_subprocess_exec") as mock_exec:
        mock_proc = AsyncMock()
        mock_proc.communicate = AsyncMock(return_value=(b"", b"rate limited"))
        mock_proc.returncode = 1
        mock_exec.return_value = mock_proc
        response = await gemini.search("test")
        assert response.error is not None
