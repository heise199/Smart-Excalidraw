"""
生成智能体 - 根据规划生成 Excalidraw 代码
"""
from langchain_core.language_models import BaseLanguageModel
from typing import Dict, Any, AsyncIterator
from app.utils.prompts import get_system_prompt, get_user_prompt


class GeneratorAgent:
    """生成智能体"""
    
    def __init__(self, llm: BaseLanguageModel):
        """
        初始化生成智能体
        
        Args:
            llm: 语言模型
        """
        self.llm = llm
    
    async def generate(
        self,
        user_input: str,
        chart_type: str,
        plan: Dict[str, Any],
        image_data: Dict[str, Any] = None
    ) -> AsyncIterator[str]:
        """
        生成 Excalidraw 代码
        
        Args:
            user_input: 用户输入
            chart_type: 图表类型
            plan: 规划结果
            image_data: 图片数据（可选）
            
        Yields:
            代码片段
        """
        # 构建提示词
        system_prompt = get_system_prompt()
        user_prompt = get_user_prompt(user_input, chart_type, plan)
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        # 如果有图片，添加到消息中
        if image_data:
            messages[-1]["content"] = [
                {"type": "text", "text": user_prompt},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{image_data['mime_type']};base64,{image_data['data']}"
                    }
                }
            ]
        
        # 流式生成
        async for chunk in self.llm.astream(messages):
            if hasattr(chunk, "content"):
                yield chunk.content
            elif isinstance(chunk, dict) and "content" in chunk:
                yield chunk["content"]

