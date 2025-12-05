"""
文本优化智能体 - 只优化节点和边的文本内容，不碰坐标
"""
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.language_models import BaseLanguageModel
from typing import Dict, Any, Optional
import json
import re
from loguru import logger


class TextOptimizerAgent:
    """文本优化智能体 - 只优化文本，不优化布局"""
    
    def __init__(self, llm: BaseLanguageModel):
        self.llm = llm
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", """你是一个专业的图表文本优化专家。你的任务是优化图表中节点和边的文本内容。

**重要规则**：
1. **只优化文本内容**：节点标签、边标签的文字表达
2. **不修改结构**：不添加、删除节点或边
3. **不修改坐标**：输出的结构必须保持原有的节点 ID 和边关系
4. **只输出 JSON**：输出格式与输入格式完全一致，只改变文本内容

**优化方向**：
- 使文本更简洁、清晰
- 统一术语和命名风格
- 补充必要的说明文字
- 优化边标签，使其更准确地描述关系"""),
            ("user", """请优化以下图表结构的文本内容：

图表类型：{chart_type}
原始结构：
{structure}

请优化节点和边的文本标签，使其更清晰、准确。只输出优化后的 JSON，保持结构不变。""")
        ])
    
    async def optimize(
        self,
        structure: Dict[str, Any],
        chart_type: str = "auto"
    ) -> Dict[str, Any]:
        """
        优化图表结构的文本内容
        
        Args:
            structure: 图表结构 {type, nodes, edges}
            chart_type: 图表类型
            
        Returns:
            优化后的结构
        """
        try:
            chain = self.prompt | self.llm
            
            response = await chain.ainvoke({
                "structure": json.dumps(structure, ensure_ascii=False, indent=2),
                "chart_type": chart_type
            })
            
            # 解析响应
            optimized = self._parse_response(response.content, structure)
            return optimized
        
        except Exception as e:
            logger.warning(f"文本优化失败: {e}，返回原始结构")
            return structure
    
    def _parse_response(self, response_text: str, original_structure: Dict[str, Any]) -> Dict[str, Any]:
        """解析 LLM 响应"""
        try:
            # 清理文本
            text = response_text.strip()
            text = re.sub(r'^```(?:json|javascript|js)?\s*\n?', '', text, flags=re.MULTILINE)
            text = re.sub(r'\n?```\s*$', '', text, flags=re.MULTILINE)
            text = text.strip()
            
            # 提取 JSON
            json_match = re.search(r'\{[\s\S]*\}', text)
            if json_match:
                text = json_match.group(0)
            
            optimized = json.loads(text)
            
            # 验证：确保节点 ID 和边关系不变
            original_node_ids = {node.get("id") for node in original_structure.get("nodes", [])}
            optimized_node_ids = {node.get("id") for node in optimized.get("nodes", [])}
            
            if original_node_ids != optimized_node_ids:
                logger.warning("优化后的节点 ID 发生变化，使用原始结构")
                return original_structure
            
            # 验证边的连接关系
            original_edges = {(e.get("from"), e.get("to")) for e in original_structure.get("edges", [])}
            optimized_edges = {(e.get("from"), e.get("to")) for e in optimized.get("edges", [])}
            
            if original_edges != optimized_edges:
                logger.warning("优化后的边关系发生变化，使用原始结构")
                return original_structure
            
            return optimized
        
        except Exception as e:
            logger.warning(f"解析优化结果失败: {e}")
            return original_structure

