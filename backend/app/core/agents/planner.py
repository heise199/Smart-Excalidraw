"""
规划智能体 - 分析用户需求，制定生成计划
"""
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.language_models import BaseLanguageModel
from typing import Dict, Any
import json


class PlannerAgent:
    """规划智能体"""
    
    def __init__(self, llm: BaseLanguageModel):
        self.llm = llm
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", """你是一个专业的图表规划专家。你的任务是分析用户需求，制定详细的图表生成计划。

**重要原则**：
1. 如果用户输入是简单指令，先将其展开为详细、丰富的内容
2. 规划必须包含足够多的元素（至少15-30个），不要只规划几个基本元素
3. 每个主要概念、步骤、模块都应该有对应的元素
4. 确保规划的内容详细、完整，能够支撑生成一个丰富的图表

请分析用户需求，并输出一个 JSON 格式的规划，包含以下字段：
- chart_type: 图表类型（flowchart, mindmap, orgchart 等）
- elements: 需要创建的元素列表，每个元素包含 type, content, position_hint
  - **要求**：elements 数组必须包含至少15个元素，对于复杂内容应该包含30-50个元素
  - 每个元素应该包含详细的内容描述，不要只是简单的标签
- relationships: 元素之间的关系
  - **要求**：确保所有重要的关系都被包含，不要遗漏
- layout: 布局建议（top-down, left-right, radial 等）
- style: 样式建议（colors, sizes 等）

输出格式必须是有效的 JSON，不要包含任何其他文本。"""),
            ("user", "用户需求：{user_input}\n图表类型：{chart_type}\n\n请制定一个详细的规划，确保包含足够多的元素（至少15-30个）。")
        ])
    
    async def plan(self, user_input: str, chart_type: str = "auto") -> Dict[str, Any]:
        """
        制定生成计划
        
        Args:
            user_input: 用户输入
            chart_type: 图表类型
            
        Returns:
            规划结果
        """
        chain = self.prompt | self.llm
        
        response = await chain.ainvoke({
            "user_input": user_input,
            "chart_type": chart_type
        })
        
        # 解析 JSON 响应
        content = response.content.strip()
        
        # 移除可能的 markdown 代码块包装
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        try:
            plan = json.loads(content)
            return plan
        except json.JSONDecodeError as e:
            # 如果解析失败，返回默认规划
            return {
                "chart_type": chart_type if chart_type != "auto" else "flowchart",
                "elements": [],
                "relationships": [],
                "layout": "top-down",
                "style": {}
            }

