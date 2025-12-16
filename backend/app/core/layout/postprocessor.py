"""
布局后处理器 - 宽高平衡、美观优化
"""
from typing import List, Dict, Any
from loguru import logger


class LayoutPostProcessor:
    """布局后处理器"""
    
    def __init__(self):
        self.max_height_ratio = 1.6  # 最大高度/宽度比
        self.max_nodes_per_layer = 4  # 每层最大节点数
        self.min_node_spacing = 200  # 最小节点间距
        self.min_layer_spacing = 250  # 最小层级间距
    
    def process(
        self,
        layout_nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        chart_type: str = "flowchart"
    ) -> List[Dict[str, Any]]:
        """
        后处理布局，优化美观度
        
        Args:
            layout_nodes: 布局后的节点列表
            edges: 边列表
            chart_type: 图表类型
            
        Returns:
            优化后的节点列表
        """
        if not layout_nodes:
            return layout_nodes
        
        # 1. 优化间距（防止重叠）
        # 注意：LayoutEngine 已经做了较好的分层和排序，PostProcessor 主要负责微调防止重叠
        balanced_nodes = self._optimize_spacing(layout_nodes)
        
        # 2. 整体居中
        balanced_nodes = self._center_graph(balanced_nodes)
        
        return balanced_nodes

    def _center_graph(self, nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """将整个图形居中到 (0,0)"""
        if not nodes:
            return nodes
            
        x_coords = [n.get("x", 0) for n in nodes]
        y_coords = [n.get("y", 0) for n in nodes]
        
        min_x, max_x = min(x_coords), max(x_coords)
        min_y, max_y = min(y_coords), max(y_coords)
        
        center_x = (min_x + max_x) / 2
        center_y = (min_y + max_y) / 2
        
        result = []
        for node in nodes:
            result.append({
                **node,
                "x": node.get("x", 0) - center_x,
                "y": node.get("y", 0) - min_y  # Y轴从0开始
            })
            
        return result
    
    def _optimize_spacing(self, nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """优化节点间距，确保不重叠"""
        # 按层级分组 (根据 LayoutEngine 计算出的 y 坐标)
        level_groups = {}
        for node in nodes:
            y = node.get("y", 0)
            # 模糊匹配层级 (允许少量误差)
            found_level = None
            for level_y in level_groups.keys():
                if abs(y - level_y) < 10:
                    found_level = level_y
                    break
            
            if found_level is None:
                found_level = y
                level_groups[found_level] = []
            
            level_groups[found_level].append(node)
        
        result = []
        for level_y, level_nodes in sorted(level_groups.items()):
            # 按 x 坐标排序，保持 LayoutEngine 决定的相对顺序
            level_nodes.sort(key=lambda n: n.get("x", 0))
            
            # 确保节点间距足够
            # 从中心向两边检查，或者简单地从左到右调整
            
            # 简单策略：从左到右，如果重叠则向右推
            for i, node in enumerate(level_nodes):
                if i > 0:
                    prev_node = level_nodes[i - 1]
                    prev_x = prev_node.get("x", 0)
                    prev_w = prev_node.get("width", 200)
                    current_x = node.get("x", 0)
                    
                    # 如果间距太小，调整
                    # 增加一点额外间距
                    min_dist = self.min_node_spacing
                    if (current_x - prev_x) < min_dist:
                        new_x = prev_x + min_dist
                        node["x"] = float(new_x)
                
                result.append(node)
        
        return result
    
    def _group_by_level(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]]
    ) -> Dict[int, List[Dict[str, Any]]]:
        """按层级分组节点"""
        # 构建图
        node_map = {node.get("id"): node for node in nodes}
        graph = {}
        in_degree = {}
        
        for node in nodes:
            node_id = node.get("id")
            graph[node_id] = []
            in_degree[node_id] = 0
        
        for edge in edges:
            from_id = edge.get("from")
            to_id = edge.get("to")
            if from_id in graph and to_id in graph:
                graph[from_id].append(to_id)
                in_degree[to_id] = in_degree.get(to_id, 0) + 1
        
        # 计算层级（BFS）
        levels = {}
        queue = [n for n in nodes if in_degree.get(n.get("id"), 0) == 0]
        level = 0
        
        while queue:
            next_queue = []
            for node in queue:
                node_id = node.get("id")
                levels[node_id] = level
                for neighbor in graph.get(node_id, []):
                    if neighbor not in levels:
                        next_queue.append(node_map[neighbor])
            queue = next_queue
            level += 1
        
        # 为没有层级的节点分配层级
        for node in nodes:
            node_id = node.get("id")
            if node_id not in levels:
                levels[node_id] = level
                level += 1
        
        # 按层级分组
        level_nodes = {}
        for node in nodes:
            node_id = node.get("id")
            lvl = levels[node_id]
            if lvl not in level_nodes:
                level_nodes[lvl] = []
            level_nodes[lvl].append(node)
        
        return level_nodes





