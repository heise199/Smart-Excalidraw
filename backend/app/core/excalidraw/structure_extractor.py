"""
从 Excalidraw 代码中提取逻辑结构（节点和边）
用于修改模式下的增量更新
"""
import json
from typing import Dict, Any, List, Optional
from loguru import logger


def extract_structure_from_code(excalidraw_code: str) -> Optional[Dict[str, Any]]:
    """
    从 Excalidraw JSON 代码中提取逻辑结构
    
    Args:
        excalidraw_code: Excalidraw JSON 代码字符串
        
    Returns:
        结构字典 {nodes: [...], edges: [...]} 或 None
    """
    try:
        elements = json.loads(excalidraw_code)
        if not isinstance(elements, list):
            return None
            
        nodes = []
        edges = []
        node_id_map = {}  # excalidraw_id -> logical_id
        
        # 1. 提取节点（非箭头/线条的元素）
        for element in elements:
            el_type = element.get("type", "")
            
            if el_type in ["rectangle", "ellipse", "diamond", "text"]:
                # 这是一个节点
                excalidraw_id = element.get("id")
                if not excalidraw_id:
                    continue
                    
                # 提取标签文本
                label = ""
                if el_type == "text":
                    label = element.get("text", "")
                else:
                    # 从 label 对象中提取
                    label_obj = element.get("label")
                    if isinstance(label_obj, dict):
                        label = label_obj.get("text", "")
                    elif isinstance(label_obj, str):
                        label = label_obj
                
                if not label or not label.strip():
                    continue
                
                # 生成逻辑 ID（基于标签）
                logical_id = _generate_logical_id(label, len(nodes))
                
                node = {
                    "id": logical_id,
                    "label": label.strip(),
                    "shape": el_type
                }
                
                nodes.append(node)
                node_id_map[excalidraw_id] = logical_id
                
        # 2. 提取边（箭头/线条）
        for element in elements:
            el_type = element.get("type", "")
            
            if el_type in ["arrow", "line"]:
                start_ref = element.get("start", {})
                end_ref = element.get("end", {})
                
                start_id = start_ref.get("id") if isinstance(start_ref, dict) else None
                end_id = end_ref.get("id") if isinstance(end_ref, dict) else None
                
                if start_id in node_id_map and end_id in node_id_map:
                    from_id = node_id_map[start_id]
                    to_id = node_id_map[end_id]
                    
                    # 提取边标签
                    edge_label = ""
                    label_obj = element.get("label")
                    if isinstance(label_obj, dict):
                        edge_label = label_obj.get("text", "")
                    elif isinstance(label_obj, str):
                        edge_label = label_obj
                    
                    edge = {
                        "from": from_id,
                        "to": to_id
                    }
                    
                    if edge_label and edge_label.strip():
                        edge["label"] = edge_label.strip()
                    
                    edges.append(edge)
        
        if not nodes:
            return None
            
        return {
            "nodes": nodes,
            "edges": edges
        }
        
    except Exception as e:
        logger.warning(f"Failed to extract structure from code: {e}")
        return None


def _generate_logical_id(label: str, index: int) -> str:
    """生成逻辑 ID"""
    # 简化标签作为 ID（移除特殊字符，保留中文和英文）
    import re
    clean_label = re.sub(r'[^\w\u4e00-\u9fa5]', '_', label)
    clean_label = clean_label.strip('_')
    
    if not clean_label:
        return f"node_{index}"
    
    # 限制长度
    if len(clean_label) > 30:
        clean_label = clean_label[:30]
    
    return clean_label.lower()


def summarize_structure(structure: Dict[str, Any]) -> str:
    """
    将结构总结为文本描述，用于传递给 LLM
    
    Args:
        structure: 结构字典
        
    Returns:
        文本描述
    """
    if not structure:
        return "无现有结构"
    
    nodes = structure.get("nodes", [])
    edges = structure.get("edges", [])
    
    lines = [f"现有图表包含 {len(nodes)} 个节点和 {len(edges)} 条边："]
    lines.append("\n节点列表：")
    for i, node in enumerate(nodes, 1):
        shape = node.get("shape", "rectangle")
        label = node.get("label", "")
        lines.append(f"  {i}. [{shape}] {label}")
    
    if edges:
        lines.append("\n连接关系：")
        for edge in edges[:10]:  # 最多显示10条边
            from_label = next((n["label"] for n in nodes if n["id"] == edge.get("from")), edge.get("from"))
            to_label = next((n["label"] for n in nodes if n["id"] == edge.get("to")), edge.get("to"))
            lines.append(f"  - {from_label} -> {to_label}")
        
        if len(edges) > 10:
            lines.append(f"  ... 还有 {len(edges) - 10} 条边")
    
    return "\n".join(lines)

