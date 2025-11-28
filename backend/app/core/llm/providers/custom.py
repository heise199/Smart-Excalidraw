"""
自定义 LLM 提供商实现
支持 OpenAI 兼容的 API
"""
from typing import Optional, Iterator
from langchain_core.language_models import BaseChatModel
from langchain_core.callbacks import CallbackManagerForLLMRun
from langchain_core.messages import BaseMessage, AIMessageChunk
from langchain_core.outputs import ChatGenerationChunk
import httpx
import json


class CustomLLM(BaseChatModel):
    """自定义 LLM 实现（OpenAI 兼容）"""
    
    model: str
    api_key: str
    base_url: str
    temperature: float = 0.7
    max_tokens: int = 4096
    
    @property
    def _llm_type(self) -> str:
        return "custom"
    
    def _generate(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: any,
    ) -> Iterator[ChatGenerationChunk]:
        """生成响应"""
        url = f"{self.base_url.rstrip('/')}/chat/completions"
        
        # 转换消息格式
        formatted_messages = []
        for msg in messages:
            if hasattr(msg, "content"):
                formatted_messages.append({
                    "role": msg.__class__.__name__.lower().replace("message", ""),
                    "content": msg.content
                })
        
        # 准备请求
        payload = {
            "model": self.model,
            "messages": formatted_messages,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "stream": True,
        }
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        
        # 流式请求
        with httpx.stream(
            "POST",
            url,
            json=payload,
            headers=headers,
            timeout=60.0,
        ) as response:
            response.raise_for_status()
            
            for line in response.iter_lines():
                if not line or line == "data: [DONE]":
                    continue
                
                if line.startswith("data: "):
                    try:
                        data = json.loads(line[6:])
                        delta = data.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content", "")
                        
                        if content:
                            chunk = ChatGenerationChunk(
                                message=AIMessageChunk(content=content)
                            )
                            if run_manager:
                                run_manager.on_llm_new_token(content)
                            yield chunk
                    except json.JSONDecodeError:
                        continue

