import pytest
from unittest.mock import patch, MagicMock
from app.llm.glm_sdk import GLMSDK


@pytest.mark.asyncio
async def test_glm_analyze_chinese():
    glm = GLMSDK()
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = "该公司成立于2018年，注册资本500万元"

    with patch.object(glm, "_get_client") as mock_client_fn:
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response
        mock_client_fn.return_value = mock_client

        response = await glm.analyze_chinese("这是一段关于蓝牙耳机工厂的中文网页内容...")
        assert "该公司" in response.text
        assert response.llm_name == "glm"


@pytest.mark.asyncio
async def test_glm_company_analyze():
    glm = GLMSDK()
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = "根据天眼查信息，该公司经营状态正常"

    with patch.object(glm, "_get_client") as mock_client_fn:
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response
        mock_client_fn.return_value = mock_client

        response = await glm.company_analyze("深圳市蓝牙科技有限公司 注册资本500万 成立2018年")
        assert response.text is not None
        assert response.llm_name == "glm"
