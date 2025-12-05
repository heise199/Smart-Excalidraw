"""
通用图表 DSL 定义

该模块只关心「语义结构」，不关心坐标和具体渲染细节。
LLM 只需要生成这些 DSL 结构，后端再将其转换为内部的 nodes/edges 结构，
最后由布局引擎 + ExcalidrawBuilder 负责位置与样式。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class DiagramType(str, Enum):
    """支持的图表类型（可按需扩展）"""

    FLOWCHART = "flowchart"
    ER = "er"
    CLASS = "class"
    SEQUENCE = "sequence"
    STATE = "state"
    ARCHITECTURE = "architecture"
    DATAFLOW = "dataflow"


@dataclass
class NodeDSL:
    """
    通用节点定义（语义层）

    - id: 语义 ID（在整个图中唯一）
    - kind: 节点语义角色，如 entity / relationship / attribute / class / interface / state / component 等
    - name: 人类可读的名称（用于显示）
    - props: 针对不同图类型的扩展属性，例如：
        - ER: {"attributes": [...], "pk": [...], "note": "..."}
        - CLASS: {"attributes": [...], "methods": [...], "stereotype": "interface"}
        - STATE: {"entry": "...", "exit": "..."}
    """

    id: str
    kind: str
    name: str
    props: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EdgeDSL:
    """
    通用边定义（语义层）

    - id: 边 ID
    - from_id/to_id: 连接的节点 ID
    - kind: 语义关系类型，如：
        - ER: "identifying", "non_identifying"
        - CLASS: "association", "inheritance", "implementation", "composition", "aggregation"
        - STATE: "transition"
        - FLOWCHART: "next", "yes", "no"
    - label: 边标签，如角色名、条件等
    - props: 扩展属性（如基数、条件表达式等）
    """

    id: str
    from_id: str
    to_id: str
    kind: str
    label: Optional[str] = None
    props: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DiagramDSL:
    """
    一张图的完整 DSL 表达

    - diagram_type: 图表类型
    - nodes: 节点列表
    - edges: 边列表
    - metadata: 其他元信息（主题、布局偏好、备注等）
    """

    diagram_type: DiagramType
    nodes: List[NodeDSL] = field(default_factory=list)
    edges: List[EdgeDSL] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)



