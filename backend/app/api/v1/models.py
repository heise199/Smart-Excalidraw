"""
模型管理 API 端点
"""
from fastapi import APIRouter, HTTPException, Query
from loguru import logger

from app.models.request import ModelListRequest, LLMProvider
from app.models.response import ModelListResponse, ModelInfo
from app.core.llm.providers import (
    fetch_openai_models,
    fetch_anthropic_models,
    fetch_google_models,
    fetch_mistral_models,
    fetch_ollama_models,
    fetch_qwen_models,
    fetch_custom_models
)

router = APIRouter()


@router.get("/models", response_model=ModelListResponse)
async def get_models(
    type: LLMProvider = Query(..., description="提供商类型"),
    baseUrl: str = Query(..., alias="baseUrl", description="基础 URL"),
    apiKey: str = Query(..., alias="apiKey", description="API 密钥")
):
    """
    获取可用模型列表
    """
    try:
        provider_map = {
            LLMProvider.OPENAI: fetch_openai_models,
            LLMProvider.ANTHROPIC: fetch_anthropic_models,
            LLMProvider.GOOGLE: fetch_google_models,
            LLMProvider.MISTRAL: fetch_mistral_models,
            LLMProvider.OLLAMA: fetch_ollama_models,
            LLMProvider.QWEN: fetch_qwen_models,
            LLMProvider.CUSTOM: fetch_custom_models,
        }
        
        fetcher = provider_map.get(type)
        if not fetcher:
            raise HTTPException(status_code=400, detail=f"不支持的提供商类型: {type}")
        
        # Ollama 可能不需要 API key
        if type == LLMProvider.OLLAMA:
            models = await fetcher(baseUrl, apiKey or "")
        else:
            models = await fetcher(baseUrl, apiKey)
        
        # 即使模型列表为空，也返回成功响应
        # 前端会显示手动输入框，让用户自己输入模型名称
        return ModelListResponse(
            models=[ModelInfo(id=m["id"], name=m["name"]) for m in models]
        )
    
    except Exception as e:
        logger.error(f"获取模型列表失败: {e}", exc_info=True)
        # 获取失败时返回空列表，而不是抛出异常
        # 这样前端可以显示手动输入框
        return ModelListResponse(models=[])

