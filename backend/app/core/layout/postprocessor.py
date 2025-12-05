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
        
        # 1. 宽高平衡
        balanced_nodes = self._balance_width_height(layout_nodes, edges)
        
        # 2. 限制每层节点数
        balanced_nodes = self._limit_nodes_per_layer(balanced_nodes, edges)
        
        # 3. 优化间距
        balanced_nodes = self._optimize_spacing(balanced_nodes)
        
        return balanced_nodes
    
    def _balance_width_height(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """宽高平衡：如果图形太细长，自动加宽"""
        if not nodes:
            return nodes
        
        # 计算当前图形的宽高
        x_coords = [n.get("x", 0) for n in nodes]
        y_coords = [n.get("y", 0) for n in nodes]
        
        if not x_coords or not y_coords:
            return nodes
        
        width = max(x_coords) - min(x_coords)
        height = max(y_coords) - min(y_coords)
        
        # 如果高度超过宽度的1.6倍，需要加宽
        if height > 0 and width > 0 and height / width > self.max_height_ratio:
            logger.info(f"图形太细长 (宽:{width:.0f}, 高:{height:.0f})，进行加宽处理")
            
            # 按层级分组
            level_nodes = self._group_by_level(nodes, edges)
            
            # 重新布局：增加每层的宽度分布
            result = []
            for level, level_node_list in sorted(level_nodes.items()):
                y = level * self.min_layer_spacing
                
                # 计算这一层需要的宽度
                node_count = len(level_node_list)
                if node_count > self.max_nodes_per_layer:
                    # 如果节点太多，分成两行
                    mid = (node_count + 1) // 2
                    first_row = level_node_list[:mid]
                    second_row = level_node_list[mid:]
                    
                    # 第一行
                    x_start = -(len(first_row) - 1) * self.min_node_spacing / 2
                    for i, node in enumerate(first_row):
                        x = x_start + i * self.min_node_spacing
                        result.append({
                            **node,
                            "x": float(x),
                            "y": float(y)
                        })
                    
                    # 第二行（稍微偏移）
                    if second_row:
                        x_start = -(len(second_row) - 1) * self.min_node_spacing / 2
                        for i, node in enumerate(second_row):
                            x = x_start + i * self.min_node_spacing
                            result.append({
                                **node,
                                "x": float(x),
                                "y": float(y + self.min_layer_spacing * 0.4)
                            })
                else:
                    # 正常分布
                    x_start = -(node_count - 1) * self.min_node_spacing / 2
                    for i, node in enumerate(level_node_list):
                        x = x_start + i * self.min_node_spacing
                        result.append({
                            **node,
                            "x": float(x),
                            "y": float(y)
                        })
            
            return result
        
        return nodes
    
    def _limit_nodes_per_layer(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """限制每层节点数，超过则自动拆分"""
        level_nodes = self._group_by_level(nodes, edges)
        result = []
        
        for level, level_node_list in sorted(level_nodes.items()):
            if len(level_node_list) <= self.max_nodes_per_layer:
                # 节点数正常，直接使用
                result.extend(level_node_list)
            else:
                # 节点数过多，拆分成多行
                logger.info(f"层级 {level} 有 {len(level_node_list)} 个节点，进行拆分")
                
                # 分成多行
                rows = []
                for i in range(0, len(level_node_list), self.max_nodes_per_layer):
                    rows.append(level_node_list[i:i + self.max_nodes_per_layer])
                
                base_y = level * self.min_layer_spacing
                for row_idx, row in enumerate(rows):
                    y = base_y + row_idx * (self.min_layer_spacing * 0.5)
                    x_start = -(len(row) - 1) * self.min_node_spacing / 2
                    
                    for i, node in enumerate(row):
                        x = x_start + i * self.min_node_spacing
                        result.append({
                            **node,
                            "x": float(x),
                            "y": float(y)
                        })
        
        return result
    
    def _optimize_spacing(self, nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """优化节点间距，确保不重叠"""
        # 按层级分组
        level_groups = {}
        for node in nodes:
            y = node.get("y", 0)
            level = round(y / self.min_layer_spacing)
            if level not in level_groups:
                level_groups[level] = []
            level_groups[level].append(node)
        
        result = []
        for level, level_nodes in sorted(level_groups.items()):
            # 按 x 坐标排序
            level_nodes.sort(key=lambda n: n.get("x", 0))
            
            # 确保节点间距足够
            for i, node in enumerate(level_nodes):
                if i > 0:
                    prev_node = level_nodes[i - 1]
                    prev_x = prev_node.get("x", 0)
                    prev_w = prev_node.get("width", 200)
                    current_x = node.get("x", 0)
                    
                    # 如果间距太小，调整
                    min_x = prev_x + prev_w + self.min_node_spacing
                    if current_x < min_x:
                        node["x"] = float(min_x)
                
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




