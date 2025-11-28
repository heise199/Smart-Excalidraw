"""
Qwen (通义千问) LLM 提供商实现
Qwen API 使用 OpenAI 兼容的接口
"""
from langchain_openai import ChatOpenAI
from typing import List, Dict
import httpx


def create_qwen_llm(
    model: str,
    base_url: str,
    api_key: str,
    temperature: float = 0.7,
    max_tokens: int = 4096
) -> ChatOpenAI:
    """
    创建 Qwen LLM 实例
    
    Args:
        model: 模型名称（如 qwen-turbo, qwen-plus, qwen-max 等）
        base_url: Qwen API 地址（如 https://dashscope.aliyuncs.com/compatible-mode/v1）
        api_key: API 密钥
        temperature: 温度参数
        max_tokens: 最大 token 数
        
    Returns:
        ChatOpenAI 实例（兼容 OpenAI API）
    """
    # Qwen 使用 OpenAI 兼容的 API
    qwen_url = base_url.rstrip('/')
    if not qwen_url.endswith('/v1'):
        # 确保 URL 格式正确
        if not qwen_url.endswith('/compatible-mode/v1'):
            qwen_url = f"{qwen_url}/compatible-mode/v1"
    
    return ChatOpenAI(
        model=model,
        openai_api_key=api_key,
        base_url=qwen_url,
        temperature=temperature,
        max_tokens=max_tokens,
        streaming=True,
    )


async def fetch_qwen_models(base_url: str, api_key: str) -> List[Dict[str, str]]:
    """
    获取 Qwen 可用模型列表
    
    Args:
        base_url: Qwen API 地址
        api_key: API 密钥
        
    Returns:
        模型列表
    """
    try:
        # Qwen 使用 OpenAI 兼容的 API，尝试获取模型列表
        qwen_url = base_url.rstrip('/')
        if not qwen_url.endswith('/v1'):
            if not qwen_url.endswith('/compatible-mode/v1'):
                qwen_url = f"{qwen_url}/compatible-mode/v1"
        
        models_url = f"{qwen_url}/models" if qwen_url.endswith('/v1') else f"{qwen_url}/v1/models"
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                models_url,
                headers={"Authorization": f"Bearer {api_key}"}
            )
            response.raise_for_status()
            data = response.json()
            
            # 解析响应
            models = data.get("data", []) if isinstance(data, dict) else data
            return [
                {
                    "id": m.get("id") or m.get("model") or m,
                    "name": m.get("name") or m.get("id") or m.get("model") or m
                }
                for m in models
                if isinstance(m, (dict, str))
            ]
    except Exception:
        # API 获取失败，返回空列表，让用户手动输入
        # 用户可以在前端手动输入模型名称，如：qwen-turbo, qwen-plus, qwen-max 等
        return []

