"""
提示词管理工具
"""
from typing import Dict, Any


def get_system_prompt() -> str:
    """获取系统提示词"""
    return """## 任务

根据用户的需求，基于 ExcalidrawElementSkeleton API 的规范，合理运用**绑定（Binding）、容器（Containment）、组合（Grouping）与框架（Framing）**等核心机制来绘制出结构清晰、布局优美、信息传达高效的 Excalidraw 图像。

## 输入

用户需求，可能是一个指令，也可能是一篇文章，或者是一张需要分析和转换的图片。

## 输出

基于 ExcalidrawElementSkeleton 的 JSON 代码。

### 输出约束
除了json代码外，不要输出任何其他内容。

## 执行步骤

### 步骤1：需求分析与内容展开
- **重要**：如果用户输入是一个简单的指令或简短描述，你必须首先将其展开为一篇详细、丰富的内容。
  - 例如：如果用户说"画一个流程图"，你需要先构思一个完整的业务流程，包含至少10-15个步骤
  - 例如：如果用户说"画一个系统架构图"，你需要设计一个包含多个模块、组件、数据流的完整架构
  - 展开的内容应该包含具体的概念、步骤、关系、数据等详细信息
- 针对用户输入的文章或你展开的详细内容，仔细阅读并理解整体结构和逻辑
- **内容丰富度要求**：确保展开后的内容足够详细，能够支撑生成一个包含至少15-30个元素的图表

### 步骤2：可视化创作
- 针对详细内容，提取所有关键概念、数据、流程、关系等，设计清晰的视觉呈现方案
- **元素数量要求**：
  - 简单图表：至少10-15个元素（包括形状、文本、箭头等）
  - 中等复杂度：至少20-30个元素
  - 复杂图表：至少30-50个元素
- 使用 Excalidraw 代码绘制图像，确保每个重要概念都有对应的视觉元素

## 最佳实践提醒

### Excalidraw 代码规范
- **箭头/连线**：箭头或连线必须双向链接到对应的元素上（也即需要绑定 id），大部分情况下，应该是起点和终点链接的元素的边缘的中间位置
- **坐标规划**：预先规划布局，避免元素重叠
- **间距充分**：确保元素之间的间距足够大，应**大于 800px**
- **尺寸一致性**：同类型元素保持相似尺寸，建立视觉节奏

### 内容准确性
- 严格遵循原文内容，不添加原文未提及的信息
- 保留所有关键细节、数据和论点,并保持原文的逻辑关系和因果链条
- **内容展开原则**：对于简单指令，要主动展开为详细内容，不要只生成几个基本元素

### 可视化质量
- 图像需具备独立的信息传达能力,图文结合，用视觉语言解释抽象概念
- 适合科普教育场景，降低理解门槛
- **丰富度要求**：
  - 每个主要概念都应该有对应的视觉元素（形状、文本等）
  - 使用多种元素类型（矩形、椭圆、菱形、文本、箭头）来增加视觉丰富度
  - 添加必要的文字说明和标注，不要只有简单的标签
  - 使用颜色区分不同的类别或层级
  - 对于流程类图表，要包含所有中间步骤，不要跳过
  - 对于架构类图表，要包含所有主要模块和它们之间的关系

## 视觉风格指南
- **风格定位**: 科学教育、专业严谨、清晰简洁
- **文字辅助**: 包含必要的文字标注和说明
- **色彩方案**: 使用 2-4 种主色，保持视觉统一
- **留白原则**: 保持适当留白，避免视觉拥挤

## ExcalidrawElementSkeleton 元素与属性

### 支持的元素类型（type 字段）
**重要：只能使用以下元素类型，其他类型（如 triangle）不被支持！**
- `rectangle` - 矩形
- `ellipse` - 椭圆
- `diamond` - 菱形
- `text` - 文本
- `line` - 线条
- `arrow` - 箭头

**注意：**
- `triangle` 不是有效的元素类型！如果需要三角形，请使用 `diamond` 类型。
- `triangle` 只能作为箭头的头部类型（`startArrowhead` 或 `endArrowhead`），不能作为独立的元素类型。

详见文档：docs/excalidraw-skeleton-api-zh.md
"""


def get_user_prompt(user_input: str, chart_type: str, plan: Dict[str, Any] = None) -> str:
    """获取用户提示词"""
    prompt_parts = []
    
    # 添加图表类型说明
    if chart_type and chart_type != "auto":
        chart_type_name = get_chart_type_name(chart_type)
        prompt_parts.append(f"请创建一个{chart_type_name}类型的 Excalidraw 图表。")
    else:
        prompt_parts.append("请根据用户需求，智能选择最合适的一种或多种图表类型来呈现信息。")
    
    # 添加内容丰富度要求
    prompt_parts.append("\n**重要要求**：")
    prompt_parts.append("- 如果用户输入是简单指令，请先将其展开为详细、丰富的内容")
    prompt_parts.append("- 生成的图表必须包含足够多的元素（至少15-30个元素），不要只生成几个简单的框和箭头")
    prompt_parts.append("- 每个重要概念都要有对应的视觉元素和文字说明")
    prompt_parts.append("- 使用多种元素类型和颜色来增加视觉丰富度")
    prompt_parts.append("- 确保图表内容详细、完整，能够独立传达信息")
    
    # 添加规划信息（如果有）
    if plan:
        prompt_parts.append(f"\n规划信息：\n{format_plan(plan)}")
        # 如果规划中的元素数量太少，提醒需要扩展
        if "elements" in plan and len(plan.get("elements", [])) < 10:
            prompt_parts.append("\n**注意**：规划中的元素数量较少，请根据用户需求大幅扩展内容，生成更详细的图表。")
    
    # 添加用户输入
    prompt_parts.append(f"\n用户需求：\n{user_input}")
    
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


def format_plan(plan: Dict[str, Any]) -> str:
    """格式化规划信息"""
    lines = []
    
    # 添加需求分析（如果有）
    if "analysis" in plan:
        lines.append(f"## 需求分析与意图揣测")
        lines.append(f"{plan['analysis']}")
        lines.append("")  # 空行分隔
        
    if "chart_type" in plan:
        lines.append(f"- 图表类型: {plan['chart_type']}")
    if "layout" in plan:
        lines.append(f"- 布局: {plan['layout']}")
    if "elements" in plan:
        lines.append(f"- 元素数量: {len(plan['elements'])}")
    if "relationships" in plan:
        lines.append(f"- 关系数量: {len(plan['relationships'])}")
    return "\n".join(lines)

