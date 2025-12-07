"""
布局引擎 - 使用 graphviz/networkx 自动计算节点坐标
"""
import json
from typing import Dict, Any, List, Tuple, Optional, TYPE_CHECKING
from loguru import logger

if TYPE_CHECKING:
    import networkx as nx

try:
    import networkx as nx
    HAS_NETWORKX = True
except ImportError:
    HAS_NETWORKX = False
    nx = None  # 设置为 None 以避免类型注解错误
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
        elif chart_type == "venn":
            return self._venn_layout(nodes, edges)
        else:
            # 默认使用分层布局
            return self._hierarchical_layout(nodes, edges)
    
    def _venn_layout(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """韦恩图布局"""
        if not nodes:
            return []
            
        # 区分集合节点和元素节点
        # 策略：根据 shape (ellipse 为集合) 或 顺序 (Plan 中通常集合在前)
        # 如果没有明确特征，假设前 2-4 个节点是集合
        
        sets = [n for n in nodes if n.get("shape") == "ellipse"]
        elements = [n for n in nodes if n.get("shape") != "ellipse"]
        
        # Fallback: 如果没有 ellipse，取前几个作为集合
        if not sets:
            num_sets = min(3, len(nodes))
            if len(nodes) > 4: num_sets = 3
            if len(nodes) <= 2: num_sets = len(nodes)
            sets = nodes[:num_sets]
            elements = nodes[num_sets:]
            # 强制修正形状
            for s in sets: s["shape"] = "ellipse"
            
        result = []
        
        # 1. 布局集合圆圈 (Sets)
        import math
        set_radius = 180  # 圆半径
        offset = 120      # 圆心偏离中心的距离
        
        set_positions = []
        if len(sets) == 1:
            set_positions = [(0, 0)]
        elif len(sets) == 2:
            set_positions = [(-offset, 0), (offset, 0)]
        elif len(sets) == 3:
            # 品字形：上，左下，右下 (倒三角)
            # 或者 正三角：上，左下，右下
            # 这里用正三角布局：上方一个，下方左右各一个
            r = offset * 1.2
            set_positions = [
                (0, -r),               # 上
                (-r * 0.866, r * 0.5), # 左下
                (r * 0.866, r * 0.5)   # 右下
            ]
        else:
            # 4个及以上：环形分布
            for i in range(len(sets)):
                angle = 2 * math.pi * i / len(sets) - math.pi / 2 # 从上方开始
                set_positions.append((math.cos(angle) * offset, math.sin(angle) * offset))
        
        for i, node in enumerate(sets):
            cx, cy = set_positions[i] if i < len(set_positions) else (0, 0)
            result.append({
                **node,
                "x": float(cx - set_radius),
                "y": float(cy - set_radius),
                "width": float(set_radius * 2),
                "height": float(set_radius * 2),
                # 韦恩图的集合需要透明背景以便重叠
                "backgroundColor": "transparent", 
                "fillStyle": "solid" # 前端 Builder 需要处理透明度
            })
            
        # 2. 布局元素 (Elements)
        # 简单策略：将元素分布在下方或四周，因为计算重叠区域太复杂
        # 或者如果能判断归属关系，尽量靠近归属的集合
        
        # 构建归属关系 map
        parent_map = {} # element_id -> [set_ids]
        for edge in edges:
            u, v = edge.get("from"), edge.get("to")
            # 假设边是 element -> set 或 set -> element
            # 这里暂不处理复杂的包含逻辑，简单将所有元素排布在图表下方
            pass

        # 网格布局元素在下方
        start_y = set_radius * 1.5 + 50
        col_count = 4
        element_spacing_x = 220
        element_spacing_y = 100
        
        for i, node in enumerate(elements):
            row = i // col_count
            col = i % col_count
            
            # 居中排列
            row_width = min(len(elements) - row * col_count, col_count) * element_spacing_x
            start_x = -row_width / 2 + element_spacing_x / 2
            
            x = start_x + col * element_spacing_x - 100 # -100 是为了中心对齐 (宽200)
            y = start_y + row * element_spacing_y
            
            result.append({
                **node,
                "x": float(x),
                "y": float(y),
                "width": 200,
                "height": 60
            })
            
        return result

    def _hierarchical_layout(
        self, 
        nodes: List[Dict[str, Any]], 
        edges: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        分层布局（适用于流程图、树形图、组织架构图）
        """
        # 优先使用改进的自定义分层布局算法
        return self._improved_hierarchical_layout(nodes, edges)

    def _improved_hierarchical_layout(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """改进的分层布局算法 (Sugiyama-like) with Dummy Nodes"""
        if not nodes:
            return []

        # 1. 构建初始图结构
        node_map = {n["id"]: n for n in nodes}
        adj = {n["id"]: [] for n in nodes}
        rev_adj = {n["id"]: [] for n in nodes}
        
        for edge in edges:
            u, v = edge.get("from"), edge.get("to")
            if u in node_map and v in node_map:
                adj[u].append(v)
                rev_adj[v].append(u)

        # 2. 层级分配 (Layer Assignment)
        layers = {}
        # 计算入度
        in_degree = {n: len(rev_adj[n]) for n in adj}
        queue = [n for n in adj if in_degree[n] == 0]
        
        # 处理环：如果没有入度为0的节点，随意选一个
        if not queue and adj:
            queue = [list(adj.keys())[0]]
            
        processed = set()
        
        curr_layer_nodes = queue
        layer_idx = 0
        
        # 简单的 BFS 分层
        while curr_layer_nodes:
            next_layer_nodes = []
            for u in curr_layer_nodes:
                if u in processed: continue
                processed.add(u)
                layers[u] = layer_idx
                
                for v in adj[u]:
                    in_degree[v] -= 1
                    if in_degree[v] <= 0:
                        next_layer_nodes.append(v)
            
            if not next_layer_nodes and len(processed) < len(nodes):
                remaining = [n for n in adj if n not in processed and in_degree[n] <= 0]
                if not remaining:
                    remaining = [n for n in adj if n not in processed]
                    if remaining:
                        remaining = [remaining[0]]
                next_layer_nodes = remaining

            curr_layer_nodes = next_layer_nodes
            layer_idx += 1
            
        # 兜底：确保所有节点都有层级
        for n in adj:
            if n not in layers:
                layers[n] = layer_idx

        # 3. 引入虚拟节点 (Dummy Nodes) 处理跨层边
        # 这里的目的是为了让长边在中间层占据位置，从而推开实体节点
        # 我们构建一个新的“布局图”，包含虚拟节点
        
        layout_nodes = set(node_map.keys()) # 包含真实节点ID和虚拟节点ID
        layout_layers = layers.copy() # ID -> Layer
        layout_adj = {k: v[:] for k, v in adj.items()} # 复制邻接表
        layout_rev_adj = {k: v[:] for k, v in rev_adj.items()}
        
        # 遍历原始边，寻找跨层边
        original_edges = []
        for u in adj:
            for v in adj[u]:
                original_edges.append((u, v))
                
        dummy_node_counter = 0
        
        for u, v in original_edges:
            u_layer = layout_layers[u]
            v_layer = layout_layers[v]
            
            # 如果跨越了多于1层 (例如 Layer 0 -> Layer 2)
            if v_layer - u_layer > 1:
                # 移除直接连接
                if v in layout_adj[u]: layout_adj[u].remove(v)
                if u in layout_rev_adj[v]: layout_rev_adj[v].remove(u)
                
                # 插入虚拟节点链
                curr = u
                for l in range(u_layer + 1, v_layer):
                    dummy_id = f"__dummy_{dummy_node_counter}"
                    dummy_node_counter += 1
                    
                    layout_nodes.add(dummy_id)
                    layout_layers[dummy_id] = l
                    
                    # 更新邻接表
                    layout_adj[curr] = layout_adj.get(curr, []) + [dummy_id]
                    layout_rev_adj[dummy_id] = [curr]
                    layout_adj[dummy_id] = [] # 初始化
                    
                    curr = dummy_id
                    
                # 连接最后一个虚拟节点到目标
                layout_adj[curr].append(v)
                layout_rev_adj[v] = layout_rev_adj.get(v, []) + [curr]

        # 4. 节点排序 (Node Ordering) - 包含虚拟节点
        layer_groups = {}
        for n, l in layout_layers.items():
            if l not in layer_groups:
                layer_groups[l] = []
            layer_groups[l].append(n)
            
        sorted_layers = sorted(layer_groups.keys())
        
        # 迭代优化顺序
        for _ in range(4): # 增加迭代次数
            # 向下扫描
            for i in range(1, len(sorted_layers)):
                curr_l = sorted_layers[i]
                prev_l = sorted_layers[i-1]
                prev_nodes = layer_groups[prev_l]
                curr_nodes = layer_groups[curr_l]
                
                node_pos = {n: idx for idx, n in enumerate(prev_nodes)}
                
                barycenters = []
                for u in curr_nodes:
                    parents = layout_rev_adj.get(u, [])
                    valid_parents = [p for p in parents if p in node_pos]
                    if valid_parents:
                        avg_pos = sum(node_pos[p] for p in valid_parents) / len(valid_parents)
                    else:
                        # 保持相对位置或放到最后
                        # 这里做一个简单的启发式：如果是虚拟节点，尽量靠中心；如果是实体节点，根据已有顺序
                        avg_pos = float('inf') 
                    barycenters.append((avg_pos, u))
                
                # 稳定排序：如果重心相同，保持原有相对顺序
                # 添加原始索引作为第二排序键
                curr_nodes_map = {n: i for i, n in enumerate(curr_nodes)}
                barycenters.sort(key=lambda x: (x[0], curr_nodes_map.get(x[1], 0)))
                layer_groups[curr_l] = [x[1] for x in barycenters]
            
            # 向上扫描 (可选，为了更好效果)
            for i in range(len(sorted_layers)-2, -1, -1):
                curr_l = sorted_layers[i]
                next_l = sorted_layers[i+1]
                curr_nodes = layer_groups[curr_l]
                next_nodes = layer_groups[next_l]
                
                node_pos = {n: idx for idx, n in enumerate(next_nodes)}
                
                barycenters = []
                for u in curr_nodes:
                    children = layout_adj.get(u, [])
                    valid_children = [c for c in children if c in node_pos]
                    if valid_children:
                        avg_pos = sum(node_pos[c] for c in valid_children) / len(valid_children)
                    else:
                        avg_pos = float('inf')
                    barycenters.append((avg_pos, u))
                
                curr_nodes_map = {n: i for i, n in enumerate(curr_nodes)}
                barycenters.sort(key=lambda x: (x[0], curr_nodes_map.get(x[1], 0)))
                layer_groups[curr_l] = [x[1] for x in barycenters]

        # 5. 坐标分配
        result = []
        
        for l in sorted_layers:
            nodes_in_row = layer_groups[l]
            
            # 动态计算该行的宽度，虚拟节点也占位
            # 虚拟节点可以窄一点，实体节点宽一点
            current_x = 0
            row_nodes_data = []
            
            for node_id in nodes_in_row:
                is_dummy = node_id.startswith("__dummy_")
                width = 50 if is_dummy else 200 # 虚拟节点占位宽度小一点，但要有间距
                spacing = self.node_spacing
                
                # 记录这个节点的中心位置
                x = current_x
                row_nodes_data.append({
                    "id": node_id,
                    "x": x,
                    "width": width
                })
                
                current_x += width + spacing
                
            # 将整行居中
            row_width = current_x - self.node_spacing # 减去最后一个多余的间距
            start_x_offset = -row_width / 2
            
            y = l * self.level_spacing
            
            for node_data in row_nodes_data:
                node_id = node_data["id"]
                
                # 只处理真实节点
                if not node_id.startswith("__dummy_"):
                    final_x = start_x_offset + node_data["x"]
                    
                    node = node_map[node_id]
                    result.append({
                        **node,
                        "x": float(final_x),
                        "y": float(y),
                        "width": 200,
                        "height": 80
                    })
                
        return result
    
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
    
    def _multipartite_layout(self, G: "nx.DiGraph") -> Dict[str, Tuple[float, float]]:
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
        G: "nx.DiGraph", 
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

