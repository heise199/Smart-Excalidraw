"""
Ollama LLM 提供商实现
Ollama 使用 OpenAI 兼容的 API
"""
from langchain_openai import ChatOpenAI
from typing import List, Dict
import httpx


def create_ollama_llm(
    model: str,
    base_url: str,
    api_key: str = None,  # Ollama 通常不需要 API key
    temperature: float = 0.7,
    max_tokens: int = 4096
) -> ChatOpenAI:
    """
    创建 Ollama LLM 实例
    
    Args:
        model: 模型名称（如 llama2, mistral, codellama 等）
        base_url: Ollama 服务地址（如 http://localhost:11434）
        api_key: API 密钥（通常不需要）
        temperature: 温度参数
        max_tokens: 最大 token 数
        
    Returns:
        ChatOpenAI 实例（兼容 OpenAI API）
    """
    # Ollama 使用 OpenAI 兼容的 API
    # base_url 应该是 http://localhost:11434/v1 格式
    ollama_url = base_url.rstrip('/')
    if not ollama_url.endswith('/v1'):
        ollama_url = f"{ollama_url}/v1"
    
    return ChatOpenAI(
        model=model,
        openai_api_key=api_key or "ollama",  # Ollama 可能不需要 key，但需要提供
        base_url=ollama_url,
        temperature=temperature,
        max_tokens=max_tokens,
        streaming=True,
    )


async def fetch_ollama_models(base_url: str, api_key: str = None) -> List[Dict[str, str]]:
    """
    获取 Ollama 可用模型列表
    
    Args:
        base_url: Ollama 服务地址
        api_key: API 密钥（通常不需要）
        
    Returns:
        模型列表
    """
    try:
        # Ollama 的模型列表端点
        ollama_url = base_url.rstrip('/')
        if ollama_url.endswith('/v1'):
            ollama_url = ollama_url[:-3]
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{ollama_url}/api/tags")
            response.raise_for_status()
            data = response.json()
            
            models = data.get("models", [])
            return [
                {
                    "id": model.get("name", ""),
                    "name": model.get("name", "")
                }
                for model in models
                if model.get("name")
            ]
    except Exception:
        # API 获取失败（可能是 Ollama 服务未启动），返回空列表，让用户手动输入
        # 用户可以在前端手动输入模型名称，如：llama2, mistral, codellama 等
        return []

