"""
通用 LLM 提供商模型获取函数
"""
from typing import List, Dict
import httpx


async def fetch_openai_models(base_url: str, api_key: str) -> List[Dict[str, str]]:
    """获取 OpenAI 模型列表"""
    url = f"{base_url.rstrip('/')}/models"
    async with httpx.AsyncClient() as client:
        response = await client.get(
            url,
            headers={"Authorization": f"Bearer {api_key}"}
        )
        response.raise_for_status()
        data = response.json()
        
        models = data.get("data", []) if isinstance(data, dict) else data
        return [
            {
                "id": m.get("id") or m.get("model") or m,
                "name": m.get("name") or m.get("id") or m.get("model") or m
            }
            for m in models
            if isinstance(m, dict) or isinstance(m, str)
        ]


async def fetch_anthropic_models(base_url: str, api_key: str) -> List[Dict[str, str]]:
    """获取 Anthropic 模型列表"""
    # 尝试从 API 获取模型列表
    # Anthropic API 可能没有标准的模型列表端点，但可以尝试
    url = f"{base_url.rstrip('/')}/models"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                url,
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                }
            )
            response.raise_for_status()
            data = response.json()
            
            models = data.get("data", []) if isinstance(data, dict) else data
            if models:
                return [
                    {
                        "id": m.get("id") or m.get("model") or m,
                        "name": m.get("name") or m.get("id") or m.get("model") or m
                    }
                    for m in models
                    if isinstance(m, dict) or isinstance(m, str)
                ]
    except Exception:
        # API 获取失败，返回空列表，让用户手动输入
        pass
    
    # 如果无法从 API 获取，返回空列表，允许用户手动输入
    # 用户可以在前端手动输入模型名称，如：claude-3-5-sonnet-20241022
    return []


async def fetch_google_models(base_url: str, api_key: str) -> List[Dict[str, str]]:
    """获取 Google 模型列表"""
    # 尝试从 API 获取模型列表
    # Google Gemini API 可能没有标准的模型列表端点，但可以尝试
    url = f"{base_url.rstrip('/')}/models"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                url,
                headers={"Authorization": f"Bearer {api_key}"}
            )
            response.raise_for_status()
            data = response.json()
            
            models = data.get("data", []) if isinstance(data, dict) else data
            if models:
                return [
                    {
                        "id": m.get("id") or m.get("model") or m,
                        "name": m.get("name") or m.get("id") or m.get("model") or m
                    }
                    for m in models
                    if isinstance(m, dict) or isinstance(m, str)
                ]
    except Exception:
        # API 获取失败，返回空列表，让用户手动输入
        pass
    
    # 如果无法从 API 获取，返回空列表，允许用户手动输入
    # 用户可以在前端手动输入模型名称，如：gemini-pro, gemini-pro-vision, gemini-1.5-pro 等
    return []


async def fetch_mistral_models(base_url: str, api_key: str) -> List[Dict[str, str]]:
    """获取 Mistral 模型列表"""
    # 延迟导入避免循环导入
    from .mistral import fetch_mistral_models as _fetch_mistral_models
    return await _fetch_mistral_models(base_url, api_key)


async def fetch_custom_models(base_url: str, api_key: str) -> List[Dict[str, str]]:
    """获取自定义模型列表（OpenAI 兼容）"""
    return await fetch_openai_models(base_url, api_key)

