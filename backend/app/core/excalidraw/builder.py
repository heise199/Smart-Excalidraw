"""
Excalidraw JSON 生成器 - 从布局结果生成完整的 Excalidraw JSON
"""
import json
import uuid
from typing import Dict, Any, List, Optional
from loguru import logger
from app.core.layout.theme import Theme, ThemeType


class ExcalidrawBuilder:
    """Excalidraw JSON 生成器"""
    
    def __init__(self, theme_type: ThemeType = ThemeType.DEFAULT):
        self.theme_type = theme_type
        self.theme = Theme.get_theme(theme_type)
    
    def _determine_shape(self, node: Dict[str, Any]) -> str:
        """根据节点类型或标签确定形状"""
        label = node.get("label", "").lower()
        node_type = node.get("type", "").lower()
        shape = node.get("shape", "").lower()

        # 如果已经指定了有效形状，直接使用
        if shape in ["rectangle", "ellipse", "diamond"]:
            return shape

        # 根据标签推断
        if label in ["开始", "结束", "start", "end", "stop", "流程开始", "流程结束"]:
            return "ellipse"
        elif "判断" in label or "是否" in label or "?" in label or node_type == "decision":
            return "diamond"
        elif "数据库" in label or "storage" in label or node_type == "database":
            # Excalidraw 原生不支持数据库形状，用圆柱体近似或保持矩形
            # 这里为了简单，暂时用 ellipse 或 rectangle
            return "ellipse" 
        
        # 默认矩形
        return "rectangle"

    def build(
        self,
        structure: Dict[str, Any],
        layout_nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        theme_type: Optional[ThemeType] = None
    ) -> str:
        """
        从结构和布局生成 Excalidraw JSON
        
        Args:
            structure: 图表结构
            layout_nodes: 带坐标的节点列表
            edges: 边列表
            theme_type: 主题类型（可选）
            
        Returns:
            Excalidraw JSON 字符串
        """
        # 使用指定的主题或默认主题
        if theme_type:
            theme = Theme.get_theme(theme_type)
        else:
            theme = self.theme
        
        elements = []
        node_id_map = {}  # 原始 ID -> Excalidraw ID
        
        # 1. 创建节点元素
        for node in layout_nodes:
            node_id = node.get("id")
            label = node.get("label", "")
            # 自动推断形状
            shape = self._determine_shape(node)
            
            x = node.get("x", 0)
            y = node.get("y", 0)
            width = node.get("width", 200)
            height = node.get("height", 80)
            
            # 菱形节点调整宽高比例
            if shape == "diamond":
                width = max(width, 120)
                height = max(height, 120)

            # 生成 Excalidraw ID
            excalidraw_id = f"node-{uuid.uuid4().hex[:8]}"
            node_id_map[node_id] = excalidraw_id
            
            # 根据形状类型创建元素
            if shape == "text":
                # 文本元素
                element = {
                    "id": excalidraw_id,
                    "type": "text",
                    "x": float(x),
                    "y": float(y),
                    "text": label,
                    "fontSize": 20,
                    "strokeColor": theme.get("text", "#000000")
                }
            else:
                # 形状元素（带标签）
                shape_color = Theme.get_shape_color(shape, self.theme_type if not theme_type else theme_type)
                corner_radius = theme.get("cornerRadius", 0)
                
                # 特殊处理：韦恩图的集合圆圈需要半透明
                fill_style = "hachure"
                stroke_width = theme.get("lineWidth", 2)
                
                # 如果是 LayoutEngine 标记为 transparent 的（针对韦恩图集合）
                if node.get("backgroundColor") == "transparent":
                    shape_color = "#00000000" # 完全透明背景，或者使用半透明色
                    # 为了让韦恩图好看，我们使用半透明填充
                    # Excalidraw 没有直接的 rgba 背景色支持得很好，通常通过 fillStyle 控制
                    # 这里我们给一个半透明的描边色作为背景色模拟，或者直接不填充
                    fill_style = "solid" 
                    # 实际上 Excalidraw 的 backgroundColor 支持 hex alpha
                    # 给几个好看的半透明色
                    colors = ["#ff000020", "#00ff0020", "#0000ff20", "#ffff0020"]
                    # 根据 ID hash 选一个颜色，避免每次都一样
                    color_idx = abs(hash(node_id)) % len(colors)
                    shape_color = colors[color_idx]
                    stroke_width = 3

                element = {
                    "id": excalidraw_id,
                    "type": shape,
                    "x": float(x),
                    "y": float(y),
                    "width": float(width),
                    "height": float(height),
                    "backgroundColor": shape_color,
                    "strokeColor": theme.get("primary", "#1976d2"),
                    "strokeWidth": stroke_width,
                    "fillStyle": fill_style,
                    "label": {
                        "text": label,
                        "fontSize": 16,
                        "strokeColor": theme.get("text", "#000000"),
                        "textAlign": "center",
                        "verticalAlign": "middle"
                    }
                }
                
                # 应用圆角（如果支持）
                if corner_radius > 0 and shape in ["rectangle"]:
                    element["roundness"] = {"type": min(corner_radius // 2, 3)}
            
            elements.append(element)
        
        # 2. 创建箭头/连线元素
        # 对于韦恩图，不生成箭头，因为韦恩图是通过空间重叠来表达关系的
        if structure.get("type") == "venn":
            return json.dumps(elements, ensure_ascii=False, indent=2)

        for edge in edges:
            from_id = edge.get("from")
            to_id = edge.get("to")
            edge_label = edge.get("label", "")
            
            if from_id not in node_id_map or to_id not in node_id_map:
                continue
            
            from_excalidraw_id = node_id_map[from_id]
            to_excalidraw_id = node_id_map[to_id]
            
            # 找到对应的节点元素以计算箭头位置
            from_node = next((n for n in layout_nodes if n.get("id") == from_id), None)
            to_node = next((n for n in layout_nodes if n.get("id") == to_id), None)
            
            if not from_node or not to_node:
                continue
            
            # 计算箭头起点和终点（节点边缘中心）
            from_x = from_node.get("x", 0)
            from_y = from_node.get("y", 0)
            from_w = from_node.get("width", 200)
            from_h = from_node.get("height", 80)
            
            to_x = to_node.get("x", 0)
            to_y = to_node.get("y", 0)
            to_w = to_node.get("width", 200)
            to_h = to_node.get("height", 80)
            
            # 计算连接点（简化版：使用节点中心）
            from_center_x = from_x + from_w / 2
            from_center_y = from_y + from_h / 2
            to_center_x = to_x + to_w / 2
            to_center_y = to_y + to_h / 2
            
            # 计算箭头位置和尺寸
            dx = to_center_x - from_center_x
            dy = to_center_y - from_center_y
            
            # 起点：从节点边缘开始
            start_x, start_y = self._get_edge_point(
                from_x, from_y, from_w, from_h,
                to_center_x, to_center_y
            )
            
            # 终点：到节点边缘
            end_x, end_y = self._get_edge_point(
                to_x, to_y, to_w, to_h,
                from_center_x, from_center_y
            )
            
            # 创建箭头元素（使用主题颜色）
            # 优先使用 elbow (折线) 样式，对于流程图更整洁
            arrow_type = "elbow" 
            
            arrow = {
                "id": f"arrow-{uuid.uuid4().hex[:8]}",
                "type": "arrow",
                "x": float(start_x),
                "y": float(start_y),
                "width": float(end_x - start_x),
                "height": float(end_y - start_y),
                "strokeColor": theme.get("lineColor", theme.get("primary", "#1976d2")),
                "strokeWidth": theme.get("lineWidth", 2),
                "endArrowhead": "arrow",
                # 设置线条样式为折线
                "strokeStyle": "solid",
                "roundness": { "type": 2 }, # 稍微圆角
                "start": {
                    "id": from_excalidraw_id
                },
                "end": {
                    "id": to_excalidraw_id
                }
            }
            
            # 如果有标签，添加标签
            if edge_label:
                arrow["label"] = {
                    "text": edge_label,
                    "fontSize": 14,
                    "strokeColor": theme.get("lineColor", theme.get("primary", "#1976d2"))
                }
            
            elements.append(arrow)
        
        return json.dumps(elements, ensure_ascii=False, indent=2)
    
    def _get_edge_point(
        self,
        node_x: float, node_y: float, node_w: float, node_h: float,
        target_x: float, target_y: float
    ) -> tuple:
        """计算节点边缘上的连接点 (Snap-to-grid 风格)"""
        center_x = node_x + node_w / 2
        center_y = node_y + node_h / 2
        
        dx = target_x - center_x
        dy = target_y - center_y
        
        # 优先选择 上下左右 四个中点
        
        # 水平方向为主
        if abs(dx) > abs(dy):
            if dx > 0:
                # 右边缘中点
                return (node_x + node_w, center_y)
            else:
                # 左边缘中点
                return (node_x, center_y)
        else:
            # 垂直方向为主
            if dy > 0:
                # 下边缘中点
                return (center_x, node_y + node_h)
            else:
                # 上边缘中点
                return (center_x, node_y)

