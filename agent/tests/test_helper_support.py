"""ヘルパー支援AIエージェントのテスト"""

from src.helper_support.agent import root_agent as helper_support_agent
from src.shift_manager.agent import root_agent as shift_manager_agent


class TestAgentDefinition:
    """エージェント定義のテスト"""

    def test_shift_manager_agent_has_tools(self):
        """シフト管理AIにツールが登録されている"""
        assert shift_manager_agent.tools is not None
        assert len(shift_manager_agent.tools) > 0

    def test_helper_support_agent_has_tools(self):
        """ヘルパー支援AIにツールが登録されている"""
        assert helper_support_agent.tools is not None
        assert len(helper_support_agent.tools) > 0

    def test_shift_manager_uses_gemini(self):
        """シフト管理AIがGeminiモデルを使用"""
        assert "gemini" in shift_manager_agent.model

    def test_helper_support_uses_gemini(self):
        """ヘルパー支援AIがGeminiモデルを使用"""
        assert "gemini" in helper_support_agent.model

    def test_agents_have_different_names(self):
        """2つのエージェントが異なる名前を持つ"""
        assert shift_manager_agent.name != helper_support_agent.name

    def test_shift_manager_has_more_tools(self):
        """シフト管理AIはヘルパー支援AIより多くのツールを持つ"""
        assert len(shift_manager_agent.tools) >= len(helper_support_agent.tools)
