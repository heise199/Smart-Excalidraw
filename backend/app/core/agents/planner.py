"""
规划智能体 - 分析用户需求，制定生成计划
"""
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.language_models import BaseLanguageModel
from typing import Dict, Any, Optional
import json
import re
import asyncio
from loguru import logger
from openai import InternalServerError, APIError
from fastapi import HTTPException
from app.core.excalidraw.structure_extractor import extract_structure_from_code, summarize_structure


class PlannerAgent:
    """规划智能体"""
    
    def __init__(self, llm: BaseLanguageModel):
        self.llm = llm
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", """你是一个专业的图表规划专家。你的任务是深度分析用户需求，充分揣测用户意图，然后制定详细的图表生成计划。

**核心任务**：
1. **需求分析与意图揣测**：
   - 不要只看字面意思，要分析用户背后的真实目的。
   - 思考图表的受众是谁？是为了展示流程、分析原因、还是展示架构？
   - 挖掘隐含需求：用户没有明说，但对于该类型图表至关重要的内容（例如：泳道图必须有角色，架构图必须有数据流）。

2. **详细规划**：
   - 基于分析结果，制定包含足够多细节的规划。
   - 如果用户输入简单，必须进行**大幅度的内容扩展**，补充合理的细节。
   - 确保规划的元素数量充足（根据复杂度决定，不强制限制，但要够用）。

**关于修改模式（重要）**：
如果提供了 `current_structure`（现有结构摘要），这表示用户想要在现有图表基础上进行**增量修改**，而不是重新生成。

**修改模式的核心原则**：
1. **必须先理解现有结构**：仔细阅读 `current_structure` 中列出的所有现有节点和连接关系。
2. **保留未修改的部分**：除非用户明确要求删除或修改某个节点，否则**必须完整保留**所有现有节点和它们之间的连接关系。
3. **只添加或修改用户要求的部分**：
   - 如果用户说"添加一个XX节点"，在保留所有现有节点的基础上，添加新节点。
   - 如果用户说"修改XX节点"，只修改该节点的内容，其他节点保持不变。
   - 如果用户说"在XX和YY之间添加连接"，在保留所有现有连接的基础上，添加新连接。
4. **输出完整结构**：你的 `elements` 和 `relationships` 必须包含：
   - 所有现有节点（除非用户明确要求删除）
   - 所有现有连接（除非用户明确要求删除）
   - 新增的节点和连接
5. **不要重新发明轮子**：不要因为用户说"优化布局"就改变节点内容，不要因为用户说"添加反馈"就删除现有流程。

请分析用户需求，并输出一个 JSON 格式的规划，包含以下字段：
- analysis: 需求分析与意图揣测（字符串）
  - 请详细描述你对用户意图的理解、受众分析以及关键内容的构思。
- chart_type: 图表类型（flowchart, mindmap, orgchart 等）
- elements: 需要创建的元素列表，每个元素包含 type, content, position_hint, action
  - action 字段：如果是修改模式，必须标注 "keep"（保留现有）或 "add"（新增）或 "modify"（修改内容）
  - 每个元素应该包含详细的内容描述。
- relationships: 元素之间的关系，每个关系包含 from, to, type, action
  - action 字段：如果是修改模式，必须标注 "keep"（保留现有）或 "add"（新增）
  - 确保逻辑连贯，关系清晰。
- layout: 布局建议（top-down, left-right, radial 等）
- style: 样式建议（colors, sizes 等）

输出要求：
1. **JSON 格式**：必须将 JSON 包裹在 ```json ... ``` 代码块中。
2. **思考过程**：你可以先进行分析（Chain of Thought），但最终必须输出上述格式的 JSON 代码块。
3. **不要包含其他文本**：代码块之外不要有其他解释性文字，除非是思考过程。"""),
            ("user", """用户需求：{user_input}
图表类型：{chart_type}

{current_structure_context}

请先进行深度需求分析，然后制定详细规划。""")
        ])
    
    async def plan(self, user_input: str, chart_type: str = "auto", current_code: str = None) -> Dict[str, Any]:
        """
        制定生成计划
        
        Args:
            user_input: 用户输入
            chart_type: 图表类型
            current_code: 现有代码（可选，用于修改模式）
            
        Returns:
            规划结果
        """
        chain = self.prompt | self.llm
        
        # 处理现有代码：先提取结构，再总结
        current_structure_context = ""
        if current_code and current_code.strip():
            try:
                # 从 Excalidraw 代码中提取逻辑结构
                structure = extract_structure_from_code(current_code)
                if structure:
                    # 总结为文本描述
                    summary = summarize_structure(structure)
                    current_structure_context = f"## 现有图表结构（必须保留）\n\n{summary}\n\n**重要**：上述所有节点和连接都必须保留，除非用户明确要求删除。"
                    logger.info(f"Extracted structure: {len(structure.get('nodes', []))} nodes, {len(structure.get('edges', []))} edges")
                else:
                    current_structure_context = "现有代码无法解析出有效结构，将作为新建处理。"
            except Exception as e:
                logger.warning(f"Failed to extract structure from current code: {e}")
                current_structure_context = "现有代码解析失败，将作为新建处理。"
        else:
            current_structure_context = "这是新建模式，没有现有图表结构。"
        
        # 添加重试机制处理 CUDA 内存不足等临时错误
        max_retries = 3
        retry_delay = 2  # 秒
        
        for attempt in range(max_retries):
            try:
                response = await chain.ainvoke({
                    "user_input": user_input,
                    "chart_type": chart_type,
                    "current_structure_context": current_structure_context
                })
                break  # 成功则跳出循环
            except (InternalServerError, APIError) as e:
                error_msg = str(e).lower()
                # 检查是否是 CUDA 内存不足或其他可重试的错误
                if any(keyword in error_msg for keyword in ['cuda', 'out of memory', 'memory', '500', 'internal server error']):
                    if attempt < max_retries - 1:
                        wait_time = retry_delay * (attempt + 1)  # 指数退避
                        logger.warning(
                            "LLM 请求失败（可能是 CUDA 内存不足），%d 秒后重试 (%d/%d): %s",
                            wait_time, attempt + 1, max_retries, str(e)[:200]
                        )
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        logger.error("LLM 请求失败，已达到最大重试次数: %s", str(e))
                        raise HTTPException(
                            status_code=503,
                            detail=f"模型服务暂时不可用（可能是显存不足）。请稍后重试。错误详情: {str(e)[:200]}"
                        )
                else:
                    # 其他类型的错误，直接抛出
                    raise
            except Exception as e:
                # 其他异常，直接抛出
                logger.error("规划阶段发生未知错误: %s", str(e), exc_info=True)
                raise
        
        # 解析 JSON 响应
        content = response.content.strip()
        
        # 1. 移除 <think> 标签内容 (针对 DeepSeek R1 等思考模型)
        content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL)
        content = content.strip()
        
        plan = None
        
        # 2. 优先尝试提取 markdown 代码块
        # 使用非贪婪匹配提取最后一个可能的 JSON 块（通常思考在通过，结果在最后）
        code_blocks = re.findall(r'```(?:json)?\s*(\{.*?\})\s*```', content, re.DOTALL)
        if code_blocks:
            # 尝试解析最后一个代码块
            try:
                plan = json.loads(code_blocks[-1])
            except json.JSONDecodeError:
                # 如果最后一个失败，尝试其他的
                for block in reversed(code_blocks[:-1]):
                    try:
                        plan = json.loads(block)
                        break
                    except json.JSONDecodeError:
                        continue
        
        # 3. 如果没有代码块，尝试直接提取最外层的 JSON 对象
        if not plan:
            try:
                # 寻找第一个 { 和最后一个 }
                start = content.find('{')
                end = content.rfind('}')
                if start != -1 and end != -1:
                    json_str = content[start:end+1]
                    plan = json.loads(json_str)
            except json.JSONDecodeError:
                pass
                
        # 4. 如果还是失败，且内容看起来像 JSON 但有一些前缀后缀
        if not plan:
            # 最后的尝试：清理常见的干扰字符
            cleaned = re.sub(r'^[^{]*', '', content) # 去掉开头的非 { 字符
            cleaned = re.sub(r'[^}]*$', '', cleaned) # 去掉结尾的非 } 字符
            try:
                plan = json.loads(cleaned)
            except json.JSONDecodeError:
                pass

        if plan:
            return plan
        
        logger.error(f"Failed to parse plan JSON. Content preview: {content[:200]}...")
        return {
            "analysis": "默认规划（解析失败，请检查模型输出）",
            "chart_type": chart_type if chart_type != "auto" else "flowchart",
            "elements": [],
            "relationships": [],
            "layout": "top-down",
            "style": {}
        }

