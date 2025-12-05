"""
结构生成提示词 - LLM 只生成逻辑结构，不包含坐标
"""
from typing import Dict, Any


def get_structure_system_prompt() -> str:
    """获取结构生成系统提示词"""
    return """## 任务

根据用户需求，生成图表的**逻辑结构**（节点和边），不包含任何坐标信息。

## 输出格式

你必须输出一个 JSON 对象，包含以下字段：

```json
{
  "type": "flowchart",  // 图表类型：flowchart, mindmap, orgchart, tree, network 等
  "nodes": [
    {
      "id": "node1",           // 唯一标识符
      "label": "节点文本",      // 节点显示文本
      "shape": "rectangle"     // 形状类型：rectangle, ellipse, diamond, text
    }
  ],
  "edges": [
    {
      "from": "node1",         // 起始节点 ID
      "to": "node2",           // 目标节点 ID
      "label": "连接标签"      // 可选的边标签（可选）
    }
  ]
}
```

## 重要规则

1. **绝对不要包含坐标信息**（x, y, width, height 等）
2. **只输出逻辑结构**：节点 ID、标签、连接关系
3. **确保节点 ID 唯一**
4. **边的 from 和 to 必须引用已存在的节点 ID**
5. **输出必须是有效的 JSON，不要包含其他文本**
6. **节点数量限制**：
   - 流程图：最多 12-15 个节点（避免过长）
   - 思维导图：最多 20 个节点
   - 其他类型：根据复杂度合理控制
7. **保持结构简洁**：优先选择关键步骤，不要生成过于详细的流程

## 形状选择指南

- **rectangle**: 普通步骤、模块、组件
- **ellipse**: 开始/结束节点
- **diamond**: 判断/决策节点
- **text**: 纯文本节点（少用）

## 示例

用户输入："画一个简单的登录流程"

输出：
```json
{
  "type": "flowchart",
  "nodes": [
    {"id": "start", "label": "开始", "shape": "ellipse"},
    {"id": "input", "label": "输入用户名密码", "shape": "rectangle"},
    {"id": "validate", "label": "验证信息", "shape": "diamond"},
    {"id": "success", "label": "登录成功", "shape": "ellipse"},
    {"id": "fail", "label": "登录失败", "shape": "ellipse"}
  ],
  "edges": [
    {"from": "start", "to": "input"},
    {"from": "input", "to": "validate"},
    {"from": "validate", "to": "success", "label": "验证通过"},
    {"from": "validate", "to": "fail", "label": "验证失败"}
  ]
}
```

记住：只输出 JSON，不要坐标！"""


def get_structure_user_prompt(user_input: str, chart_type: str, plan: Dict[str, Any] = None) -> str:
    """获取结构生成用户提示词"""
    prompt_parts = []
    
    # 添加图表类型说明
    if chart_type and chart_type != "auto":
        chart_type_name = get_chart_type_name(chart_type)
        prompt_parts.append(f"请创建一个{chart_type_name}类型的图表结构。")
    else:
        prompt_parts.append("请根据用户需求，智能选择最合适的图表类型。")
    
    # 添加规划信息（如果有）
    if plan:
        prompt_parts.append(f"\n规划信息：")
        if "chart_type" in plan:
            prompt_parts.append(f"- 图表类型: {plan['chart_type']}")
        if "elements" in plan:
            prompt_parts.append(f"- 元素数量: {len(plan.get('elements', []))}")
        if "relationships" in plan:
            prompt_parts.append(f"- 关系数量: {len(plan.get('relationships', []))}")
    
    # 添加用户输入
    prompt_parts.append(f"\n用户需求：\n{user_input}")
    prompt_parts.append("\n请生成图表的逻辑结构（节点和边），只输出 JSON，不要包含坐标信息。")
    
    return "\n".join(prompt_parts)


def get_chart_type_name(chart_type: str) -> str:
    """获取图表类型中文名"""
    type_names = {
        "flowchart": "流程图",
        "mindmap": "思维导图",
        "orgchart": "组织架构图",
        "sequence": "时序图",
        "class": "UML类图",
        "er": "ER图",
        "gantt": "甘特图",
        "timeline": "时间线",
        "tree": "树形图",
        "network": "网络拓扑图",
        "architecture": "架构图",
        "dataflow": "数据流图",
        "state": "状态图",
        "swimlane": "泳道图",
        "concept": "概念图",
        "fishbone": "鱼骨图",
        "swot": "SWOT分析图",
        "pyramid": "金字塔图",
        "funnel": "漏斗图",
        "venn": "韦恩图",
        "matrix": "矩阵图",
        "infographic": "信息图"
    }
    return type_names.get(chart_type, "自动")

