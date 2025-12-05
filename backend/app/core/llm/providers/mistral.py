"""
Mistral LLM 提供商实现
Mistral 使用 OpenAI 兼容的 API
"""
from langchain_openai import ChatOpenAI
from typing import List, Dict
import httpx


def create_mistral_llm(
    model: str,
    base_url: str,
    api_key: str,
    temperature: float = 0.7,
    max_tokens: int = 4096
) -> ChatOpenAI:
    """
    创建 Mistral LLM 实例
    
    Args:
        model: 模型名称（如 mistral-large-latest, mistral-medium-latest 等）
        base_url: Mistral API 地址（如 https://api.mistral.ai/v1）
        api_key: API 密钥
        temperature: 温度参数
        max_tokens: 最大 token 数
        
    Returns:
        ChatOpenAI 实例（兼容 OpenAI API）
    """
    # Mistral 使用 OpenAI 兼容的 API
    mistral_url = base_url.rstrip('/')
    if not mistral_url.endswith('/v1'):
        mistral_url = f"{mistral_url}/v1"
    
    return ChatOpenAI(
        model=model,
        openai_api_key=api_key,
        base_url=mistral_url,
        temperature=temperature,
        max_tokens=max_tokens,
        streaming=True,
    )


async def fetch_mistral_models(base_url: str, api_key: str) -> List[Dict[str, str]]:
    """
    获取 Mistral 可用模型列表
    
    Args:
        base_url: Mistral API 地址
        api_key: API 密钥
        
    Returns:
        模型列表
    """
    try:
        # Mistral 使用 OpenAI 兼容的 API
        mistral_url = base_url.rstrip('/')
        if not mistral_url.endswith('/v1'):
            mistral_url = f"{mistral_url}/v1"
        
        models_url = f"{mistral_url}/models"
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                models_url,
                headers={"Authorization": f"Bearer {api_key}"}
            )
            response.raise_for_status()
            data = response.json()
            
            models = data.get("data", []) if isinstance(data, dict) else data
            if models:
                return [
                    {
                        "id": m.get("id") or m,
                        "name": m.get("name") or m.get("id") or m
                    }
                    for m in models
                ]
    except Exception:
        # API 获取失败，返回空列表，让用户手动输入
        pass
    
    # 如果无法从 API 获取，返回空列表，允许用户手动输入
    # 用户可以在前端手动输入模型名称，如：mistral-large-latest, mistral-medium-latest 等
    return []









