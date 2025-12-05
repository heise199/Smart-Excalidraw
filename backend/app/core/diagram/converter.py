"""
DSL -> 内部结构(nodes/edges) 转换器

这一层把通用 DiagramDSL 映射成当前布局引擎使用的结构：
{
  "type": "flowchart" | "er" | ...,
  "nodes": [{"id", "label", "shape", ...}, ...],
  "edges": [{"from", "to", "label", ...}, ...]
}
"""
from __future__ import annotations

from typing import Any, Dict, List

from app.core.diagram.dsl import DiagramDSL
from app.core.diagram.specs import get_shape_for_node_kind


def dsl_to_structure(dsl: DiagramDSL) -> Dict[str, Any]:
    """
    将 DiagramDSL 转成当前布局/渲染管线使用的结构。

    注意：这里只负责语义到「shape + label」的映射，不生成坐标。
    """
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []

    # 1. 节点：kind -> shape
    for node in dsl.nodes:
        shape = get_shape_for_node_kind(dsl.diagram_type, node.kind, default="rectangle")

        nodes.append(
            {
                "id": node.id,
                "label": node.name,
                "shape": shape,
                # 把原始语义信息也带上，后续 TextOptimizer/Validator 可以用
                "kind": node.kind,
                "props": node.props,
            }
        )

    # 2. 边：保持语义 kind，用于标签或后续样式
    for edge in dsl.edges:
        label = edge.label
        # 如果没有显式 label，可以根据 kind 简单生成一个
        if not label and edge.kind:
            label = edge.kind

        edges.append(
            {
                "id": edge.id,
                "from": edge.from_id,
                "to": edge.to_id,
                "label": label,
                "kind": edge.kind,
                "props": edge.props,
            }
        )

    return {
        "type": dsl.diagram_type.value,
        "nodes": nodes,
        "edges": edges,
        "metadata": dsl.metadata,
    }



