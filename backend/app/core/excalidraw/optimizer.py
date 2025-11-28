"""
Excalidraw 箭头优化器
基于 lib/optimizeArrows.js 的逻辑
"""
import json
from typing import Dict, Any, List, Tuple


def optimize_arrows(code: str) -> str:
    """
    优化箭头连接点
    
    Args:
        code: Excalidraw 代码字符串
        
    Returns:
        优化后的代码字符串
    """
    try:
        elements = json.loads(code)
        if not isinstance(elements, list):
            return code
        
        # 创建元素 ID 映射
        element_map = {el["id"]: el for el in elements if "id" in el}
        
        # 优化每个箭头/线条，并验证所有元素
        optimized_elements = []
        for element in elements:
            # 验证 text 元素
            if element.get("type") == "text":
                text_value = element.get("text")
                if text_value is None or text_value == '':
                    # 跳过无效的 text 元素
                    continue
                # 确保 text 是字符串
                if not isinstance(text_value, str):
                    element["text"] = str(text_value)
            
            if element.get("type") in ["arrow", "line"]:
                optimized = _optimize_arrow(element, element_map)
                optimized_elements.append(optimized)
            else:
                optimized_elements.append(element)
        
        return json.dumps(optimized_elements, ensure_ascii=False, indent=2)
    
    except Exception as e:
        # 如果优化失败，返回原始代码
        return code


def _optimize_arrow(arrow: Dict[str, Any], element_map: Dict[str, Any]) -> Dict[str, Any]:
    """优化单个箭头"""
    optimized = arrow.copy()
    
    # 获取绑定的元素
    start_ele = None
    end_ele = None
    
    if "start" in arrow and "id" in arrow["start"]:
        start_ele = element_map.get(arrow["start"]["id"])
    if "end" in arrow and "id" in arrow["end"]:
        end_ele = element_map.get(arrow["end"]["id"])
    
    # 如果两个元素都绑定，计算最佳连接点
    if start_ele and end_ele:
        start_edge = _get_start_edge_center(start_ele, end_ele)
        end_edge = _get_end_edge_center(end_ele, start_ele)
        
        optimized["x"] = start_edge[0]
        optimized["y"] = start_edge[1]
        optimized["width"] = end_edge[0] - start_edge[0]
        optimized["height"] = end_edge[1] - start_edge[1]
    
    # 修复宽度为 0 的问题
    if optimized.get("width") == 0:
        optimized["width"] = 1
    
    return optimized


def _get_start_edge_center(start_ele: Dict[str, Any], end_ele: Dict[str, Any]) -> Tuple[float, float]:
    """计算起点边缘中心"""
    start_x = start_ele.get("x", 0)
    start_y = start_ele.get("y", 0)
    start_w = start_ele.get("width", 100)
    start_h = start_ele.get("height", 100)
    
    end_x = end_ele.get("x", 0)
    end_y = end_ele.get("y", 0)
    
    dx = start_x - end_x
    dy = start_y - end_y
    abs_dx = abs(dx)
    abs_dy = abs(dy)
    
    # 水平对齐
    if dy == 0:
        if dx < 0:
            return (start_x + start_w, start_y + start_h / 2)
        elif dx > 0:
            return (start_x, start_y + start_h / 2)
    
    # 垂直对齐
    if dx == 0:
        if dy < 0:
            return (start_x + start_w / 2, start_y + start_h)
        elif dy > 0:
            return (start_x + start_w / 2, start_y)
    
    # 左上
    if dx < 0 and dy < 0:
        if abs_dx > abs_dy:
            return (start_x + start_w, start_y + start_h / 2)
        else:
            return (start_x + start_w / 2, start_y + start_h)
    
    # 右上
    if dx > 0 and dy < 0:
        if abs_dx > abs_dy:
            return (start_x, start_y + start_h / 2)
        else:
            return (start_x + start_w / 2, start_y + start_h)
    
    # 左下
    if dx < 0 and dy > 0:
        if abs_dx > abs_dy:
            return (start_x + start_w, start_y + start_h / 2)
        else:
            return (start_x + start_w / 2, start_y)
    
    # 右下
    if dx > 0 and dy > 0:
        if abs_dx > abs_dy:
            return (start_x, start_y + start_h / 2)
        else:
            return (start_x + start_w / 2, start_y)
    
    # 默认：右边缘
    return (start_x + start_w, start_y + start_h / 2)


def _get_end_edge_center(end_ele: Dict[str, Any], start_ele: Dict[str, Any]) -> Tuple[float, float]:
    """计算终点边缘中心"""
    end_x = end_ele.get("x", 0)
    end_y = end_ele.get("y", 0)
    end_w = end_ele.get("width", 100)
    end_h = end_ele.get("height", 100)
    
    start_x = start_ele.get("x", 0)
    start_y = start_ele.get("y", 0)
    
    dx = end_x - start_x
    dy = end_y - start_y
    abs_dx = abs(dx)
    abs_dy = abs(dy)
    
    # 水平对齐
    if dy == 0:
        if dx < 0:
            return (end_x + end_w, end_y + end_h / 2)
        elif dx > 0:
            return (end_x, end_y + end_h / 2)
    
    # 垂直对齐
    if dx == 0:
        if dy < 0:
            return (end_x + end_w / 2, end_y + end_h)
        elif dy > 0:
            return (end_x + end_w / 2, end_y)
    
    # 左上
    if dx < 0 and dy < 0:
        if abs_dx > abs_dy:
            return (end_x + end_w, end_y + end_h / 2)
        else:
            return (end_x + end_w / 2, end_y + end_h)
    
    # 右上
    if dx > 0 and dy < 0:
        if abs_dx > abs_dy:
            return (end_x, end_y + end_h / 2)
        else:
            return (end_x + end_w / 2, end_y + end_h)
    
    # 左下
    if dx < 0 and dy > 0:
        if abs_dx > abs_dy:
            return (end_x + end_w, end_y + end_h / 2)
        else:
            return (end_x + end_w / 2, end_y)
    
    # 右下
    if dx > 0 and dy > 0:
        if abs_dx > abs_dy:
            return (end_x, end_y + end_h / 2)
        else:
            return (end_x + end_w / 2, end_y)
    
    # 默认：左边缘
    return (end_x, end_y + end_h / 2)

