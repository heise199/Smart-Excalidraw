"""
验证智能体 - 验证生成的代码
"""
import json
from typing import Dict, Any, List, Tuple


class ValidatorAgent:
    """验证智能体"""
    
    def validate(self, code: str) -> Tuple[bool, List[str]]:
        """
        验证代码
        
        Args:
            code: 要验证的代码
            
        Returns:
            (是否有效, 错误列表)
        """
        errors = []
        
        # 1. JSON 格式验证
        try:
            elements = json.loads(code)
        except json.JSONDecodeError as e:
            errors.append(f"JSON 格式错误: {str(e)}")
            return False, errors
        
        # 2. 数组验证
        if not isinstance(elements, list):
            errors.append("代码必须是数组格式")
            return False, errors
        
        # 3. 元素验证
        for i, element in enumerate(elements):
            element_errors = self._validate_element(element, i)
            errors.extend(element_errors)
        
        return len(errors) == 0, errors
    
    def _validate_element(self, element: Dict[str, Any], index: int) -> List[str]:
        """验证单个元素"""
        errors = []
        
        # 必填字段检查
        if "type" not in element:
            errors.append(f"元素 {index}: 缺少 type 字段")
            return errors
        
        element_type = element["type"]
        
        # 坐标检查
        if "x" not in element or "y" not in element:
            errors.append(f"元素 {index} ({element_type}): 缺少坐标 x 或 y")
        
        # 类型特定验证
        if element_type == "text" and "text" not in element:
            errors.append(f"元素 {index} (text): 缺少 text 字段")
        
        if element_type == "arrow":
            # 箭头绑定检查
            if "start" in element or "end" in element:
                if "start" in element:
                    start = element["start"]
                    if "type" not in start and "id" not in start:
                        errors.append(f"元素 {index} (arrow): start 必须包含 type 或 id")
        
        if element_type == "frame":
            # 框架 children 检查
            if "children" not in element:
                errors.append(f"元素 {index} (frame): 缺少 children 字段")
            elif not isinstance(element["children"], list):
                errors.append(f"元素 {index} (frame): children 必须是数组")
        
        return errors

