"""
结构生成智能体 - LLM 只生成逻辑结构，不包含坐标
"""
from langchain_core.language_models import BaseLanguageModel
from typing import Dict, Any, AsyncIterator, List, Set
import json
import re
from loguru import logger
from app.utils.prompts_structure import get_structure_system_prompt, get_structure_user_prompt


class StructureGeneratorAgent:
    """结构生成智能体"""
    
    def __init__(self, llm: BaseLanguageModel):
        self.llm = llm
    
    async def generate_structure(
        self,
        user_input: str,
        chart_type: str,
        plan: Dict[str, Any] = None,
        image_data: Dict[str, Any] = None
    ) -> AsyncIterator[str]:
        """
        生成图表结构（只包含节点和边，不包含坐标）
        
        Args:
            user_input: 用户输入
            chart_type: 图表类型
            plan: 规划结果
            image_data: 图片数据（可选）
            
        Yields:
            结构 JSON 片段
        """
        # 构建提示词
        system_prompt = get_structure_system_prompt()
        user_prompt = get_structure_user_prompt(user_input, chart_type, plan)
        
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
        accumulated = ""
        async for chunk in self.llm.astream(messages):
            if hasattr(chunk, "content"):
                content = chunk.content
            elif isinstance(chunk, dict) and "content" in chunk:
                content = chunk["content"]
            else:
                continue
            
            accumulated += content
            yield content
    
    def parse_structure(self, structure_text: str) -> Dict[str, Any]:
        """
        解析结构 JSON
        
        Args:
            structure_text: 结构 JSON 文本
            
        Returns:
            解析并规范化后的结构字典
        """
        # 1. 清理文本
        text = structure_text.strip()
        
        # 移除 <think> 标签内容 (针对 DeepSeek R1 等思考模型)
        text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
        text = text.strip()

        # 优先尝试提取 ```json ... ``` 或 ``` ... ``` 代码块
        # 使用非贪婪匹配 [\s\S]*? 确保只匹配第一个完整的代码块（如果 LLM 输出了多个）
        # 或者如果有思维链，通常 JSON 在最后
        code_block_matches = re.findall(r'```(?:json|javascript|js)?\s*([\s\S]*?)\s*```', text)
        if code_block_matches:
            # 如果有多个代码块，通常最后一个是最终结果，但也可能第一个是
            # 这里假设最长的那个或者是包含 "nodes" 的那个是正确的
            # 简单起见，取最后一个看起来像 JSON 的
            for block in reversed(code_block_matches):
                if "{" in block and "nodes" in block:
                    text = block
                    break
            else:
                # 如果都没找到特征，回退到最后一个
                text = code_block_matches[-1]
        
        text = text.strip()

        # 尝试查找最外层的 JSON 对象 {}
        # 为了处理可能存在的思维链文本（如果不在代码块中）
        try:
            # 简单的贪婪匹配可能会匹配过多，这里尝试找到第一个合法的 JSON 结束位置
            # 但这对 Python 正则较难。
            # 回退策略：如果直接 loads 失败，尝试正则提取
             
            # 移除常见的干扰字符
            if text.startswith("json"):
                text = text[4:].strip()
                
            structure = json.loads(text)
        except json.JSONDecodeError:
            # 正则提取 { ... }
            json_match = re.search(r'(\{[\s\S]*\})', text)
            if json_match:
                try:
                    structure = json.loads(json_match.group(1))
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse structure JSON from regex match: {e}")
                    # 最后的尝试：使用 dirtyjson 或简单的清理（这里暂不引入新库）
                    return self._create_fallback_structure()
            else:
                return self._create_fallback_structure()

        # 2. 基本类型校验
        if not isinstance(structure, dict):
            # 可能是列表？
            if isinstance(structure, list):
                 logger.warning("Structure is a list, wrapping in flowchart dict")
                 # 假设列表就是 nodes
                 structure = {"type": "flowchart", "nodes": structure, "edges": []}
            else:
                logger.warning("Structure is not a dict, using fallback")
                return self._create_fallback_structure()

        # 3. 字段兜底
        if "nodes" not in structure or not isinstance(structure.get("nodes"), list):
            logger.warning("Structure nodes missing or not a list, using empty list")
            structure["nodes"] = []
        if "edges" not in structure or not isinstance(structure.get("edges"), list):
            logger.warning("Structure edges missing or not a list, using empty list")
            structure["edges"] = []
        if "type" not in structure or not isinstance(structure.get("type"), str):
            structure["type"] = "flowchart"

        # 4. 规范化节点和边
        structure = self._normalize_structure(structure)

        return structure

    def _create_fallback_structure(self) -> Dict[str, Any]:
        """创建回退的空结构"""
        return {
            "type": "flowchart",
            "nodes": [],
            "edges": [],
        }

    def _normalize_structure(self, structure: Dict[str, Any]) -> Dict[str, Any]:
        """
        规范化由 LLM 生成的结构，保证后续布局安全可靠。

        - 为缺失/非法的节点 ID 自动生成稳定 ID
        - 去重节点 ID
        - 丢弃引用不存在节点的边
        """
        nodes: List[Dict[str, Any]] = structure.get("nodes", []) or []
        edges: List[Dict[str, Any]] = structure.get("edges", []) or []

        normalized_nodes: List[Dict[str, Any]] = []
        used_ids: Set[str] = set()

        # 1. 规范化节点 ID
        for idx, node in enumerate(nodes):
            node = dict(node) if not isinstance(node, dict) else node

            raw_id = node.get("id")
            node_id = raw_id

            # id 缺失 / 为空 / 非字符串 时自动生成
            if not isinstance(node_id, str) or not node_id.strip():
                node_id = f"node_{idx}"
                logger.warning(
                    f"结构生成: 节点缺少有效 id，自动分配 id='{node_id}'，原始 id={raw_id!r}"
                )

            node_id = node_id.strip()

            # 避免重复 id
            if node_id in used_ids:
                suffix = 1
                new_id = f"{node_id}_{suffix}"
                while new_id in used_ids:
                    suffix += 1
                    new_id = f"{node_id}_{suffix}"
                logger.warning(
                    f"结构生成: 节点 id 重复 ('{node_id}')，重命名为 '{new_id}'"
                )
                node_id = new_id

            node["id"] = node_id
            used_ids.add(node_id)

            # 补一个简单的 label，防止完全空白
            if not node.get("label"):
                # 有些计划里用 content 字段
                content = node.get("content")
                if isinstance(content, str) and content.strip():
                    node["label"] = content.strip()
                else:
                    node["label"] = f"节点 {len(normalized_nodes) + 1}"

            normalized_nodes.append(node)

        valid_ids: Set[str] = used_ids

        # 2. 规范化边：只保留 from/to 都在 valid_ids 中的边
        normalized_edges: List[Dict[str, Any]] = []
        for edge in edges:
            if not isinstance(edge, dict):
                logger.warning(f"结构生成: 非法边（非字典）被丢弃: {edge!r}")
                continue

            from_id = edge.get("from")
            to_id = edge.get("to")

            if not isinstance(from_id, str) or not isinstance(to_id, str):
                logger.warning(
                    f"结构生成: 边缺少有效 from/to（from={from_id!r}, to={to_id!r}），被丢弃"
                )
                continue

            from_id = from_id.strip()
            to_id = to_id.strip()

            if from_id not in valid_ids or to_id not in valid_ids:
                logger.warning(
                    f"结构生成: 边引用了不存在的节点（from={from_id!r}, to={to_id!r}），被丢弃"
                )
                continue

            normalized_edges.append(
                {
                    **edge,
                    "from": from_id,
                    "to": to_id,
                }
            )

        if len(normalized_edges) < len(edges):
            logger.info(
                f"结构生成: 边已清洗，保留 {len(normalized_edges)} 条，丢弃 {len(edges) - len(normalized_edges)} 条无效边"
            )

        structure["nodes"] = normalized_nodes
        structure["edges"] = normalized_edges

        return structure



