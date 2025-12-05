"""
图表类型规范定义（Specification）

每种图有：
- 允许的节点语义角色（node_kinds）
- 允许的边语义角色（edge_kinds）
- 语义角色 -> 形状映射（用于 Excalidraw）
- 一些基本约束规则（后续可由 Validator 使用）
"""
from __future__ import annotations

from typing import Any, Dict, List

from app.core.diagram.dsl import DiagramType


DiagramSpec = Dict[str, Any]


DIAGRAM_SPECS: Dict[DiagramType, DiagramSpec] = {
    DiagramType.ER: {
        "node_kinds": {
            "entity": {"shape": "rectangle"},
            "relationship": {"shape": "diamond"},
            "attribute": {"shape": "ellipse"},
        },
        "edge_kinds": {
            "identifying": {},
            "non_identifying": {},
            "inherit": {},  # 派生实体
        },
        "constraints": [
            # 关系必须至少连接两个实体（留给 Validator 实现）
            {"type": "min_incident_entities", "relationship_kind": "relationship", "min": 2},
            # 属性只能连到实体或关系
            {
                "type": "edge_rule",
                "from": ["attribute"],
                "to": ["entity", "relationship"],
            },
        ],
    },
    DiagramType.CLASS: {
        "node_kinds": {
            "class": {"shape": "rectangle"},
            "interface": {"shape": "rectangle"},
            "abstract_class": {"shape": "rectangle"},
        },
        "edge_kinds": {
            "association": {},
            "inheritance": {},
            "implementation": {},
            "composition": {},
            "aggregation": {},
        },
        "constraints": [
            {
                "type": "allowed_edge_pairs",
                "rules": [
                    # 继承/实现两端都必须是 class/interface/abstract_class
                    {
                        "edge_kinds": ["inheritance", "implementation"],
                        "from": ["class", "abstract_class", "interface"],
                        "to": ["class", "abstract_class", "interface"],
                    }
                ],
            }
        ],
    },
    DiagramType.FLOWCHART: {
        "node_kinds": {
            "start": {"shape": "ellipse"},
            "end": {"shape": "ellipse"},
            "process": {"shape": "rectangle"},
            "decision": {"shape": "diamond"},
            "io": {"shape": "parallelogram"},
        },
        "edge_kinds": {
            "next": {},
            "yes": {},
            "no": {},
        },
        "constraints": [
            {"type": "must_have_start_end", "required_kinds": ["start", "end"]},
        ],
    },
    # 其他类型（sequence/state/architecture/dataflow）可按需补充
}


def get_spec(diagram_type: DiagramType) -> DiagramSpec:
    """获取图表类型规范，如果不存在则返回空规范"""
    return DIAGRAM_SPECS.get(diagram_type, {"node_kinds": {}, "edge_kinds": {}, "constraints": []})


def get_shape_for_node_kind(diagram_type: DiagramType, kind: str, default: str = "rectangle") -> str:
    """根据图类型 + 节点语义角色，获取对应形状"""
    spec = get_spec(diagram_type)
    node_kinds: Dict[str, Dict[str, Any]] = spec.get("node_kinds", {})
    kind_info = node_kinds.get(kind, {})
    return kind_info.get("shape", default)



