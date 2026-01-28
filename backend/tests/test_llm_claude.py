import pytest
from unittest.mock import patch, AsyncMock
from app.llm.claude_cli import ClaudeCLI


@pytest.mark.asyncio
async def test_claude_cli_calls_subprocess():
    claude = ClaudeCLI()

    with patch("asyncio.create_subprocess_exec") as mock_exec:
        mock_proc = AsyncMock()
        mock_proc.communicate = AsyncMock(return_value=(
            b'{"answer": "test response"}', b""
        ))
        mock_proc.returncode = 0
        mock_exec.return_value = mock_proc
        response = await claude.ask("请分析这个公司")
        assert response.text is not None
        mock_exec.assert_called_once()
        call_args = mock_exec.call_args[0]
        assert "claude" in call_args[0]
        assert "-p" in call_args


@pytest.mark.asyncio
async def test_claude_cli_handles_error():
    claude = ClaudeCLI()
    with patch("asyncio.create_subprocess_exec") as mock_exec:
        mock_proc = AsyncMock()
        mock_proc.communicate = AsyncMock(return_value=(b"", b"Error occurred"))
        mock_proc.returncode = 1
        mock_exec.return_value = mock_proc
        response = await claude.ask("test")
        assert response.error is not None
