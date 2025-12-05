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
            shape = node.get("shape", "rectangle")
            x = node.get("x", 0)
            y = node.get("y", 0)
            width = node.get("width", 200)
            height = node.get("height", 80)
            
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
                
                element = {
                    "id": excalidraw_id,
                    "type": shape,
                    "x": float(x),
                    "y": float(y),
                    "width": float(width),
                    "height": float(height),
                    "backgroundColor": shape_color,
                    "strokeColor": theme.get("primary", "#1976d2"),
                    "strokeWidth": theme.get("lineWidth", 2),
                    "fillStyle": "hachure",
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
        """计算节点边缘上的连接点"""
        center_x = node_x + node_w / 2
        center_y = node_y + node_h / 2
        
        dx = target_x - center_x
        dy = target_y - center_y
        
        # 如果 dx 和 dy 都为 0，返回右边缘中心
        if abs(dx) < 0.001 and abs(dy) < 0.001:
            return (node_x + node_w, center_y)
        
        # 计算与边缘的交点
        # 简化：使用矩形边缘
        if abs(dx) > abs(dy):
            # 水平方向为主
            if dx > 0:
                # 右边缘
                y = center_y + dy * (node_w / 2) / abs(dx) if abs(dx) > 0.001 else center_y
                y = max(node_y, min(node_y + node_h, y))
                return (node_x + node_w, y)
            else:
                # 左边缘
                y = center_y + dy * (node_w / 2) / abs(dx) if abs(dx) > 0.001 else center_y
                y = max(node_y, min(node_y + node_h, y))
                return (node_x, y)
        else:
            # 垂直方向为主
            if dy > 0:
                # 下边缘
                x = center_x + dx * (node_h / 2) / abs(dy) if abs(dy) > 0.001 else center_x
                x = max(node_x, min(node_x + node_w, x))
                return (x, node_y + node_h)
            else:
                # 上边缘
                x = center_x + dx * (node_h / 2) / abs(dy) if abs(dy) > 0.001 else center_x
                x = max(node_x, min(node_x + node_w, x))
                return (x, node_y)

