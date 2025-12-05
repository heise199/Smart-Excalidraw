"""
布局优化智能体 - 根据图表类型检测缺失元素并自动补充
"""
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.language_models import BaseLanguageModel
from typing import Dict, Any, List, Optional
import json
from loguru import logger


class LayoutOptimizerAgent:
    """布局优化智能体"""
    
    def __init__(self, llm: BaseLanguageModel):
        self.llm = llm
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", """你是一个专业的图表布局优化专家。你的任务是：

1. **分析图表类型**：根据元素类型和布局判断图表类型（流程图、思维导图、架构图等）
2. **检测缺失元素**：根据图表类型的要求，检测缺失的关键元素
   - 流程图：必须有箭头连接各个步骤
   - 思维导图：必须有线条连接中心节点和分支
   - 架构图：必须有箭头表示数据流或调用关系
   - 组织架构图：必须有箭头表示上下级关系
3. **自动补充连接**：为缺失的连接关系自动添加箭头或线条
4. **优化布局**：确保元素间距合理、对齐美观

**重要规则**：
- 只输出优化后的完整 JSON 数组，不要其他内容
- 保持原有元素不变，只添加缺失的连接
- 箭头必须使用 start 和 end 绑定到元素（通过 id 或 type）
- 确保所有连接都有合理的起点和终点"""),
            ("user", """请分析并优化以下 Excalidraw 代码：

图表类型：{chart_type}
原始代码：
{code}
{missing_info}

请：
1. 检测图表类型（如果 chart_type 是 auto，请根据元素推断）
2. 检测缺失的连接关系（如流程图的箭头）
3. 自动添加缺失的连接
4. 优化整体布局

只输出优化后的 JSON 数组。""")
        ])
    
    async def optimize(
        self, 
        code: str, 
        chart_type: str = "auto",
        user_input: Optional[str] = None
    ) -> str:
        """
        优化布局并补充缺失元素
        
        Args:
            code: 原始代码
            chart_type: 图表类型
            user_input: 用户输入（可选，用于上下文理解）
            
        Returns:
            优化后的代码
        """
        try:
            # 先进行基础分析
            elements = json.loads(code)
            if not isinstance(elements, list):
                return code
            
            # 检测缺失的连接
            missing_connections = self._detect_missing_connections(elements, chart_type)
            
            # 如果有缺失的连接，使用 LLM 智能补充
            if missing_connections:
                logger.info(f"检测到 {len(missing_connections)} 个缺失的连接，使用 LLM 补充")
                return await self._llm_optimize(code, chart_type, missing_connections)
            else:
                # 如果没有缺失的连接，只做布局优化
                return await self._llm_optimize(code, chart_type, [])
        
        except json.JSONDecodeError:
            # 如果代码无效，直接返回
            return code
        except Exception as e:
            logger.warning(f"布局优化失败: {e}，返回原始代码")
            return code
    
    def _detect_missing_connections(
        self, 
        elements: List[Dict[str, Any]], 
        chart_type: str
    ) -> List[Dict[str, Any]]:
        """
        检测缺失的连接关系
        
        Args:
            elements: 元素列表
            chart_type: 图表类型
            
        Returns:
            缺失连接的列表
        """
        missing = []
        
        # 统计元素类型
        element_types = {}
        arrow_count = 0
        nodes = []
        
        for el in elements:
            el_type = el.get("type")
            if el_type:
                element_types[el_type] = element_types.get(el_type, 0) + 1
            
            if el_type in ["arrow", "line"]:
                arrow_count += 1
            
            # 收集节点元素（非箭头/线条）
            if el_type in ["rectangle", "ellipse", "diamond", "text"]:
                nodes.append(el)
        
        # 根据图表类型判断是否需要连接
        needs_connections = False
        
        if chart_type == "flowchart" or chart_type == "auto":
            # 流程图：如果有多个节点但没有箭头，需要添加
            if len(nodes) >= 2 and arrow_count == 0:
                needs_connections = True
                missing.append({
                    "type": "flowchart",
                    "reason": "流程图缺少箭头连接",
                    "nodes": nodes
                })
        
        elif chart_type == "mindmap":
            # 思维导图：需要中心节点到分支的连接
            if len(nodes) >= 2 and arrow_count == 0:
                needs_connections = True
                missing.append({
                    "type": "mindmap",
                    "reason": "思维导图缺少连接线",
                    "nodes": nodes
                })
        
        elif chart_type in ["architecture", "dataflow", "network"]:
            # 架构图/数据流图：需要表示关系的箭头
            if len(nodes) >= 2 and arrow_count == 0:
                needs_connections = True
                missing.append({
                    "type": chart_type,
                    "reason": f"{chart_type}缺少关系箭头",
                    "nodes": nodes
                })
        
        elif chart_type == "orgchart":
            # 组织架构图：需要上下级关系的箭头
            if len(nodes) >= 2 and arrow_count == 0:
                needs_connections = True
                missing.append({
                    "type": "orgchart",
                    "reason": "组织架构图缺少上下级连接",
                    "nodes": nodes
                })
        
        return missing
    
    async def _llm_optimize(
        self, 
        code: str, 
        chart_type: str,
        missing_connections: List[Dict[str, Any]]
    ) -> str:
        """
        使用 LLM 优化代码
        
        Args:
            code: 原始代码
            chart_type: 图表类型
            missing_connections: 缺失连接列表
            
        Returns:
            优化后的代码
        """
        try:
            chain = self.prompt | self.llm
            
            # 构建提示词
            missing_info = ""
            if missing_connections:
                missing_info = f"\n检测到缺失的连接：{json.dumps(missing_connections, ensure_ascii=False, indent=2)}"
            
            response = await chain.ainvoke({
                "code": code,
                "chart_type": chart_type,
                "missing_info": missing_info
            })
            
            # 清理响应
            optimized = self._clean_response(response.content)
            return optimized
        
        except Exception as e:
            logger.warning(f"LLM 优化失败: {e}")
            return code
    
    def _clean_response(self, response: str) -> str:
        """清理 LLM 响应"""
        import re
        
        # 移除 markdown 代码块
        response = re.sub(r'^```(?:json|javascript|js)?\s*\n?', '', response, flags=re.MULTILINE)
        response = re.sub(r'\n?```\s*$', '', response, flags=re.MULTILINE)
        response = response.strip()
        
        # 提取 JSON 数组
        array_match = re.search(r'\[[\s\S]*\]', response)
        if array_match:
            response = array_match.group(0)
        
        # 验证 JSON
        try:
            json.loads(response)
            return response
        except:
            return response

