"""
优化智能体 - 优化生成的 Excalidraw 代码
"""
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.language_models import BaseLanguageModel
from typing import Dict, Any
import json
import re


class OptimizerAgent:
    """优化智能体"""
    
    def __init__(self, llm: BaseLanguageModel):
        self.llm = llm
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", """你是一个 Excalidraw 代码优化专家。你的任务是优化生成的代码，确保：

1. 元素间距合理（建议 > 800px）
2. 箭头正确绑定到元素边缘中心
3. 坐标对齐，避免重叠
4. 样式统一，视觉美观
5. JSON 格式正确

输入代码，输出优化后的代码。只输出 JSON 数组，不要其他内容。"""),
            ("user", "请优化以下 Excalidraw 代码：\n{code}")
        ])
    
    async def optimize(self, code: str) -> str:
        """
        优化代码
        
        Args:
            code: 原始代码
            
        Returns:
            优化后的代码
        """
        # 先尝试简单的后处理
        cleaned_code = self._clean_code(code)
        
        # 使用 LLM 进一步优化
        chain = self.prompt | self.llm
        
        try:
            response = await chain.ainvoke({"code": cleaned_code})
            optimized = self._clean_code(response.content)
            return optimized
        except Exception as e:
            # 如果优化失败，返回清理后的原始代码
            return cleaned_code
    
    def _clean_code(self, code: str) -> str:
        """清理代码：移除 markdown 包装，修复引号等"""
        # 移除 markdown 代码块
        code = re.sub(r'^```(?:json|javascript|js)?\s*\n?', '', code, flags=re.MULTILINE)
        code = re.sub(r'\n?```\s*$', '', code, flags=re.MULTILINE)
        code = code.strip()
        
        # 尝试提取 JSON 数组
        array_match = re.search(r'\[[\s\S]*\]', code)
        if array_match:
            code = array_match.group(0)
        
        return code

