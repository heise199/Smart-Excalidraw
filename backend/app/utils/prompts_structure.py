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
6. **节点数量**：
   - 根据实际逻辑复杂度决定节点数量，不强制限制。
   - 如果流程过长，建议拆分为主要流程和子流程，或使用泳道图/分层结构。
7. **保持结构线性且清晰**：
   - 避免生成过于复杂的网状结构。
   - 尽量减少长距离的跨层跳转（例如从第1步直接跳到第5步）。
   - 如果流程复杂，请将其拆分为主要流程和次要分支。
   - **避免循环依赖**，除非逻辑必须。

8. **特定图表类型规则**：
   - **韦恩图 (venn)**：
     - 必须区分“集合”和“元素”。
     - **集合**：shape 必须是 "ellipse"。
     - **元素**：shape 必须是 "rectangle" 或 "text"。
     - **不要生成箭头 (edges)**，除非你需要明确指出元素属于哪个集合。
     - **严禁**使用“生物A”、“集合1”等无意义的代号，**必须**使用规划中提供的具体内容（如“哺乳动物”、“人类”）。

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
        prompt_parts.append(f"\n## 规划信息（必须严格执行）")
        
        # 检查是否是修改模式（plan 中包含现有结构信息）
        if "current_structure" in plan or "现有图表" in str(plan.get("analysis", "")):
            prompt_parts.append(f"**这是修改模式**：规划中已经包含了现有图表结构，你必须：")
            prompt_parts.append("1. **完整保留**规划中列出的所有现有节点（除非规划明确标注为"删除"）。")
            prompt_parts.append("2. **完整保留**规划中列出的所有现有连接关系。")
            prompt_parts.append("3. 添加规划中标注为"新增"的节点和连接。")
            prompt_parts.append("4. 只修改规划中明确要求修改的节点内容。")
        else:
            prompt_parts.append(f"你必须**完全忠实**地执行以下规划，**严禁**擅自增删节点或修改内容：")
        
        prompt_parts.append(format_plan_structure(plan))
        prompt_parts.append("\n**执行指令**：")
        prompt_parts.append("1. 将规划中的 `elements` 一一对应转换为 `nodes`。")
        prompt_parts.append("2. 不要添加规划中没有的节点（例如：不要自作聪明地添加具体例子）。")
        prompt_parts.append("3. 不要遗漏规划中有的节点。")
        prompt_parts.append("4. 对于韦恩图 (venn)，**不要生成任何 edges** 数组内容（保持为空），因为韦恩图靠空间位置表达关系。")
    
    # 添加用户输入
    prompt_parts.append(f"\n用户需求：\n{user_input}")
    prompt_parts.append("\n请生成图表的逻辑结构（节点和边），只输出 JSON，不要包含坐标信息。")
    
    return "\n".join(prompt_parts)


def format_plan_structure(plan: Dict[str, Any]) -> str:
    """格式化规划信息供结构生成使用"""
    lines = []
    if "chart_type" in plan:
        lines.append(f"- 图表类型: {plan['chart_type']}")
    
    if "elements" in plan:
        lines.append(f"- 必须包含的节点 ({len(plan['elements'])}个):")
        for el in plan['elements']:
            content = el.get('content', '未知内容')
            el_type = el.get('type', 'unknown')
            lines.append(f"  * [{el_type}] {content}")
            
    if "relationships" in plan:
        lines.append(f"- 必须包含的关系 ({len(plan['relationships'])}条):")
        for rel in plan['relationships']:
            lines.append(f"  * {rel.get('from')} -> {rel.get('to')} ({rel.get('type')})")
            
    return "\n".join(lines)


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

