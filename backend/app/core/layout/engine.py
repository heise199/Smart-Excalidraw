"""
布局引擎 - 使用 graphviz/networkx 自动计算节点坐标
"""
import json
from typing import Dict, Any, List, Tuple, Optional
from loguru import logger

try:
    import networkx as nx
    HAS_NETWORKX = True
except ImportError:
    HAS_NETWORKX = False
    logger.warning("networkx not installed, layout engine will use simple algorithm")

try:
    import pygraphviz  # type: ignore
    HAS_PYGRAPHVIZ = True
except ImportError:
    HAS_PYGRAPHVIZ = False
    # pygraphviz 是可选依赖，不需要警告


class LayoutEngine:
    """布局引擎"""
    
    def __init__(self):
        self.node_spacing = 200  # 节点间距（像素）
        self.level_spacing = 300  # 层级间距（像素）
    
    def layout(
        self, 
        structure: Dict[str, Any],
        chart_type: str = "flowchart"
    ) -> List[Dict[str, Any]]:
        """
        对结构进行布局，返回带坐标的节点列表
        
        Args:
            structure: 图表结构 {type, nodes, edges}
            chart_type: 图表类型
            
        Returns:
            带坐标的节点列表
        """
        nodes = structure.get("nodes", [])
        edges = structure.get("edges", [])
        
        if not nodes:
            return []
        
        # 根据图表类型选择布局算法
        if chart_type in ["flowchart", "tree", "orgchart"]:
            return self._hierarchical_layout(nodes, edges)
        elif chart_type == "mindmap":
            return self._radial_layout(nodes, edges)
        elif chart_type in ["network", "architecture", "dataflow"]:
            return self._force_directed_layout(nodes, edges)
        else:
            # 默认使用分层布局
            return self._hierarchical_layout(nodes, edges)
    
    def _hierarchical_layout(
        self, 
        nodes: List[Dict[str, Any]], 
        edges: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        分层布局（适用于流程图、树形图、组织架构图）
        """
        if HAS_NETWORKX:
            return self._networkx_hierarchical_layout(nodes, edges)
        else:
            return self._simple_hierarchical_layout(nodes, edges)
    
    def _networkx_hierarchical_layout(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """使用 networkx 进行分层布局"""
        try:
            # 创建有向图
            G = nx.DiGraph()
            
            # 添加节点
            node_map = {}
            for node in nodes:
                node_id = node.get("id")
                G.add_node(node_id)
                node_map[node_id] = node
            
            # 添加边
            for edge in edges:
                from_id = edge.get("from")
                to_id = edge.get("to")
                if from_id in node_map and to_id in node_map:
                    G.add_edge(from_id, to_id)
            
            # 使用分层布局
            try:
                # 尝试使用 graphviz 布局（如果可用）
                if HAS_PYGRAPHVIZ:
                    pos = nx.nx_agraph.graphviz_layout(G, prog='dot')
                else:
                    # 使用 networkx 的分层布局
                    pos = nx.spring_layout(G, k=self.node_spacing/50, iterations=50)
                    # 或者使用分层布局
                    try:
                        pos = self._multipartite_layout(G)
                    except:
                        pass
            except:
                # 回退到简单布局
                pos = self._simple_positions(G, nodes)
            
            # 转换为带坐标的节点
            result = []
            for node in nodes:
                node_id = node.get("id")
                if node_id in pos:
                    x, y = pos[node_id]
                    result.append({
                        **node,
                        "x": float(x),
                        "y": float(y),
                        "width": 200,  # 默认宽度
                        "height": 80   # 默认高度
                    })
                else:
                    # 如果节点没有位置，使用默认值
                    result.append({
                        **node,
                        "x": 0.0,
                        "y": 0.0,
                        "width": 200,
                        "height": 80
                    })
            
            return result
        
        except Exception as e:
            logger.warning(f"NetworkX layout failed: {e}, using simple layout")
            return self._simple_hierarchical_layout(nodes, edges)
    
    def _multipartite_layout(self, G: nx.DiGraph) -> Dict[str, Tuple[float, float]]:
        """多部分图布局（分层）+ 左右分支平衡"""
        # 计算层级
        levels = {}
        in_degree = {n: 0 for n in G.nodes()}
        
        # 计算入度
        for u, v in G.edges():
            in_degree[v] = in_degree.get(v, 0) + 1
        
        # BFS 分配层级
        queue = [n for n in G.nodes() if in_degree[n] == 0]
        level = 0
        
        while queue:
            next_queue = []
            for node in queue:
                levels[node] = level
                for neighbor in G.successors(node):
                    if neighbor not in levels:
                        next_queue.append(neighbor)
            queue = next_queue
            level += 1
        
        # 为没有层级的节点分配层级
        for node in G.nodes():
            if node not in levels:
                levels[node] = level
                level += 1
        
        # 计算位置（带左右分支平衡）
        pos = {}
        level_nodes = {}
        for node, lvl in levels.items():
            if lvl not in level_nodes:
                level_nodes[lvl] = []
            level_nodes[lvl].append(node)
        
        # 第一遍：分配层级位置
        for lvl, nodes_in_level in level_nodes.items():
            y = lvl * self.level_spacing
            x_start = -(len(nodes_in_level) - 1) * self.node_spacing / 2
            for i, node in enumerate(nodes_in_level):
                if node not in pos:
                    x = x_start + i * self.node_spacing
                    pos[node] = (x, y)
        
        # 第二遍：处理决策节点的左右分支
        for node in G.nodes():
            outputs = list(G.successors(node))
            if len(outputs) > 1:
                # 这是一个决策节点，需要左右分布输出
                node_x, node_y = pos[node]
                
                # 左右分布
                left_outputs = outputs[::2]  # 偶数索引：左侧
                right_outputs = outputs[1::2]  # 奇数索引：右侧
                
                # 左侧输出
                for i, output in enumerate(left_outputs):
                    if output in pos:
                        # 如果已经分配位置，调整到左侧
                        current_x, current_y = pos[output]
                        new_x = node_x - self.node_spacing * (i + 1) - self.node_spacing / 2
                        pos[output] = (new_x, current_y)
                
                # 右侧输出
                for i, output in enumerate(right_outputs):
                    if output in pos:
                        # 如果已经分配位置，调整到右侧
                        current_x, current_y = pos[output]
                        new_x = node_x + self.node_spacing * (i + 1) + self.node_spacing / 2
                        pos[output] = (new_x, current_y)
        
        return pos
    
    def _simple_positions(
        self, 
        G: nx.DiGraph, 
        nodes: List[Dict[str, Any]]
    ) -> Dict[str, Tuple[float, float]]:
        """简单位置计算"""
        pos = {}
        for i, node in enumerate(nodes):
            node_id = node.get("id")
            row = i // 3
            col = i % 3
            pos[node_id] = (col * self.node_spacing, row * self.level_spacing)
        return pos
    
    def _simple_hierarchical_layout(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """简单分层布局（不依赖 networkx）"""
        # 构建邻接表
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
        
        # 计算层级
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
                        next_queue.append([n for n in nodes if n.get("id") == neighbor][0])
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
        
        # 计算位置
        result = []
        for lvl, nodes_in_level in sorted(level_nodes.items()):
            y = lvl * self.level_spacing
            x_start = -(len(nodes_in_level) - 1) * self.node_spacing / 2
            for i, node in enumerate(nodes_in_level):
                x = x_start + i * self.node_spacing
                result.append({
                    **node,
                    "x": float(x),
                    "y": float(y),
                    "width": 200,
                    "height": 80
                })
        
        return result
    
    def _radial_layout(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """径向布局（适用于思维导图）"""
        if not nodes:
            return []
        
        # 找到中心节点（通常是第一个节点或入度最小的节点）
        center_id = nodes[0].get("id")
        center_node = nodes[0]
        
        # 构建图
        graph = {}
        for node in nodes:
            node_id = node.get("id")
            graph[node_id] = []
        
        for edge in edges:
            from_id = edge.get("from")
            to_id = edge.get("to")
            if from_id in graph:
                graph[from_id].append(to_id)
        
        # 中心节点在原点
        result = [{
            **center_node,
            "x": 0.0,
            "y": 0.0,
            "width": 200,
            "height": 80
        }]
        
        # 其他节点围绕中心分布
        radius = 400
        angle_step = 360 / max(len(nodes) - 1, 1)
        
        for i, node in enumerate(nodes[1:], 1):
            angle = (i - 1) * angle_step * 3.14159 / 180  # 转换为弧度
            x = radius * (1 if i % 2 == 0 else -1) * (i // 2)
            y = radius * (1 if (i // 2) % 2 == 0 else -1) * ((i - 1) // 2)
            
            result.append({
                **node,
                "x": float(x),
                "y": float(y),
                "width": 200,
                "height": 80
            })
        
        return result
    
    def _force_directed_layout(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """力导向布局（适用于网络图、架构图）"""
        if HAS_NETWORKX:
            try:
                G = nx.Graph()
                node_map = {}
                for node in nodes:
                    node_id = node.get("id")
                    G.add_node(node_id)
                    node_map[node_id] = node
                
                for edge in edges:
                    from_id = edge.get("from")
                    to_id = edge.get("to")
                    if from_id in node_map and to_id in node_map:
                        G.add_edge(from_id, to_id)
                
                pos = nx.spring_layout(G, k=self.node_spacing/50, iterations=50)
                
                result = []
                for node in nodes:
                    node_id = node.get("id")
                    if node_id in pos:
                        x, y = pos[node_id]
                        result.append({
                            **node,
                            "x": float(x * 100),  # 缩放
                            "y": float(y * 100),
                            "width": 200,
                            "height": 80
                        })
                    else:
                        result.append({
                            **node,
                            "x": 0.0,
                            "y": 0.0,
                            "width": 200,
                            "height": 80
                        })
                
                return result
            except Exception as e:
                logger.warning(f"Force directed layout failed: {e}")
        
        # 回退到简单网格布局
        result = []
        cols = int(len(nodes) ** 0.5) + 1
        for i, node in enumerate(nodes):
            row = i // cols
            col = i % cols
            result.append({
                **node,
                "x": float(col * self.node_spacing),
                "y": float(row * self.level_spacing),
                "width": 200,
                "height": 80
            })
        
        return result

