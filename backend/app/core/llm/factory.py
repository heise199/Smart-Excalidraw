"""
LLM 工厂类 - 统一创建和管理 LLM 实例
"""
from typing import Protocol, Optional
from langchain_core.language_models import BaseLanguageModel
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI

from app.models.request import LLMProvider, LLMConfig
from app.core.llm.providers.custom import CustomLLM
from app.core.llm.providers.ollama import create_ollama_llm
from app.core.llm.providers.qwen import create_qwen_llm
from app.core.llm.providers.mistral import create_mistral_llm


class LLMFactory:
    """LLM 工厂类"""
    
    @staticmethod
    def create_llm(config: LLMConfig) -> BaseLanguageModel:
        """
        根据配置创建 LLM 实例
        
        Args:
            config: LLM 配置
            
        Returns:
            LLM 实例
        """
        provider_map = {
            LLMProvider.OPENAI: LLMFactory._create_openai,
            LLMProvider.ANTHROPIC: LLMFactory._create_anthropic,
            LLMProvider.GOOGLE: LLMFactory._create_google,
            LLMProvider.MISTRAL: LLMFactory._create_mistral,
            LLMProvider.OLLAMA: LLMFactory._create_ollama,
            LLMProvider.QWEN: LLMFactory._create_qwen,
            LLMProvider.CUSTOM: LLMFactory._create_custom,
        }
        
        creator = provider_map.get(config.type)
        if not creator:
            raise ValueError(f"不支持的 LLM 提供商: {config.type}")
        
        return creator(config)
    
    @staticmethod
    def _create_openai(config: LLMConfig) -> ChatOpenAI:
        """创建 OpenAI LLM"""
        return ChatOpenAI(
            model=config.model,
            openai_api_key=config.api_key,
            base_url=config.base_url,
            temperature=config.temperature,
            max_tokens=config.max_tokens,
            streaming=True,
        )
    
    @staticmethod
    def _create_anthropic(config: LLMConfig) -> ChatAnthropic:
        """创建 Anthropic LLM"""
        return ChatAnthropic(
            model=config.model,
            anthropic_api_key=config.api_key,
            base_url=config.base_url,
            temperature=config.temperature,
            max_tokens=config.max_tokens,
            streaming=True,
        )
    
    @staticmethod
    def _create_google(config: LLMConfig) -> ChatGoogleGenerativeAI:
        """创建 Google LLM"""
        return ChatGoogleGenerativeAI(
            model=config.model,
            google_api_key=config.api_key,
            temperature=config.temperature,
            max_output_tokens=config.max_tokens,
        )
    
    @staticmethod
    def _create_mistral(config: LLMConfig) -> ChatOpenAI:
        """创建 Mistral LLM（使用 OpenAI 兼容的 API）"""
        return create_mistral_llm(
            model=config.model,
            base_url=config.base_url,
            api_key=config.api_key,
            temperature=config.temperature,
            max_tokens=config.max_tokens,
        )
    
    @staticmethod
    def _create_ollama(config: LLMConfig) -> ChatOpenAI:
        """创建 Ollama LLM"""
        return create_ollama_llm(
            model=config.model,
            base_url=config.base_url,
            api_key=config.api_key,
            temperature=config.temperature,
            max_tokens=config.max_tokens,
        )
    
    @staticmethod
    def _create_qwen(config: LLMConfig) -> ChatOpenAI:
        """创建 Qwen LLM"""
        return create_qwen_llm(
            model=config.model,
            base_url=config.base_url,
            api_key=config.api_key,
            temperature=config.temperature,
            max_tokens=config.max_tokens,
        )
    
    @staticmethod
    def _create_custom(config: LLMConfig) -> CustomLLM:
        """创建自定义 LLM"""
        return CustomLLM(
            model=config.model,
            api_key=config.api_key,
            base_url=config.base_url,
            temperature=config.temperature,
            max_tokens=config.max_tokens,
        )

