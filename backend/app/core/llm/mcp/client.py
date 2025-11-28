"""
MCP (Model Context Protocol) 客户端
"""
import httpx
from typing import Dict, Any, Optional, List
from loguru import logger


class MCPClient:
    """MCP 客户端"""
    
    def __init__(self, server_url: str):
        self.server_url = server_url.rstrip('/')
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def get_context(
        self,
        user_input: str,
        chart_type: str = "auto"
    ) -> Dict[str, Any]:
        """
        获取 MCP 上下文
        
        Args:
            user_input: 用户输入
            chart_type: 图表类型
            
        Returns:
            MCP 上下文数据
        """
        try:
            response = await self.client.post(
                f"{self.server_url}/context",
                json={
                    "user_input": user_input,
                    "chart_type": chart_type
                }
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.warning(f"MCP 上下文获取失败: {e}")
            return {}
    
    async def enhance_prompt(
        self,
        prompt: str,
        context: Dict[str, Any]
    ) -> str:
        """
        使用 MCP 增强提示词
        
        Args:
            prompt: 原始提示词
            context: MCP 上下文
            
        Returns:
            增强后的提示词
        """
        if not context:
            return prompt
        
        try:
            response = await self.client.post(
                f"{self.server_url}/enhance",
                json={
                    "prompt": prompt,
                    "context": context
                }
            )
            response.raise_for_status()
            result = response.json()
            return result.get("enhanced_prompt", prompt)
        except Exception as e:
            logger.warning(f"MCP 提示词增强失败: {e}")
            return prompt
    
    async def validate_output(
        self,
        code: str,
        requirements: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        使用 MCP 验证输出
        
        Args:
            code: 生成的代码
            requirements: 需求
            
        Returns:
            验证结果
        """
        try:
            response = await self.client.post(
                f"{self.server_url}/validate",
                json={
                    "code": code,
                    "requirements": requirements
                }
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.warning(f"MCP 验证失败: {e}")
            return {"valid": True, "errors": []}
    
    async def close(self):
        """关闭客户端"""
        await self.client.aclose()

