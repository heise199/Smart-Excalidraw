"""
通用图表 DSL 与规范模块

当前包含：
- `dsl`      : DiagramDSL / NodeDSL / EdgeDSL / DiagramType
- `specs`    : 各图类型的节点/边语义规范与形状映射
- `converter`: 将 DSL 转换为内部 nodes/edges 结构

后续可以在规划/结构生成/验证阶段逐步接入这些定义，
让不同图类型共享一套统一的 DSL 与约束体系。
"""
from .dsl import DiagramDSL, DiagramType, NodeDSL, EdgeDSL  # noqa: F401
from .specs import DIAGRAM_SPECS, get_spec, get_shape_for_node_kind  # noqa: F401
from .converter import dsl_to_structure  # noqa: F401


