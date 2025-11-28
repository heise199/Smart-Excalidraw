"""
Excalidraw 代码解析器
"""
import json
import re
from typing import Optional


def parse_code(code: str) -> str:
    """
    解析和清理 Excalidraw 代码
    
    Args:
        code: 原始代码字符串
        
    Returns:
        清理后的代码字符串
    """
    if not code or not isinstance(code, str):
        return "[]"
    
    # 1. 移除 LLM 思考/推理标签及其内容
    # 移除常见的思考标签: <thinking>, <reasoning>, <think> 等
    code = re.sub(r'<thinking>[\s\S]*?</thinking>', '', code, flags=re.IGNORECASE)
    code = re.sub(r'<reasoning>[\s\S]*?</reasoning>', '', code, flags=re.IGNORECASE)
    code = re.sub(r'<redacted_reasoning[^>]*>[\s\S]*?</think>', '', code, flags=re.IGNORECASE)
    code = re.sub(r'<redacted_reasoning[^>]*/>', '', code, flags=re.IGNORECASE)  # 自闭合标签
    code = re.sub(r'<thought>[\s\S]*?</thought>', '', code, flags=re.IGNORECASE)
    code = re.sub(r'<analysis>[\s\S]*?</analysis>', '', code, flags=re.IGNORECASE)
    # 移除未闭合的 redacted_reasoning 标签（只有开始标签，没有闭合）
    code = re.sub(r'<[^>]*redacted[^>]*>', '', code, flags=re.IGNORECASE)
    # 移除任何包含 thinking/reasoning 的 XML/HTML 标签
    code = re.sub(r'<[^>]*reasoning[^>]*>[\s\S]*?</[^>]*>', '', code, flags=re.IGNORECASE)
    code = re.sub(r'<[^>]*thinking[^>]*>[\s\S]*?</[^>]*>', '', code, flags=re.IGNORECASE)
    # 移除自闭合的思考标签
    code = re.sub(r'<[^>]*reasoning[^>]*/>', '', code, flags=re.IGNORECASE)
    code = re.sub(r'<[^>]*thinking[^>]*/>', '', code, flags=re.IGNORECASE)
    # 移除 HTML 注释
    code = re.sub(r'<!--[\s\S]*?-->', '', code)
    
    # 1.5. 移除 JSON 开始前的任何标签或非 JSON 内容
    json_start_match = re.search(r'[\[{]', code)
    if json_start_match:
        json_start_index = json_start_match.start()
        # 如果 JSON 开始前有内容，检查是否包含标签
        if json_start_index > 0:
            before_json = code[:json_start_index]
            # 如果包含 '<' 或 '>'，很可能是标签，移除它
            if '<' in before_json or '>' in before_json:
                code = code[json_start_index:]
    
    # 2. 移除 markdown 代码块包装
    code = re.sub(r'^```(?:json|javascript|js)?\s*\n?', '', code, flags=re.MULTILINE)
    code = re.sub(r'\n?```\s*$', '', code, flags=re.MULTILINE)
    code = code.strip()
    
    # 3. 移除数组前的非 JSON 内容
    # 找到第一个 '[' 或 '{' 的位置
    first_bracket = code.find('[')
    first_brace = code.find('{')
    json_start = -1
    
    if first_bracket != -1 and first_brace != -1:
        json_start = min(first_bracket, first_brace)
    elif first_bracket != -1:
        json_start = first_bracket
    elif first_brace != -1:
        json_start = first_brace
    
    if json_start > 0:
        code = code[json_start:]
    
    # 4. 提取 JSON 数组
    array_match = re.search(r'\[[\s\S]*\]', code)
    if array_match:
        code = array_match.group(0)
    else:
        # 如果找不到数组，尝试找 JSON 对象并包装成数组
        object_match = re.search(r'\{[\s\S]*\}', code)
        if object_match:
            code = '[' + object_match.group(0) + ']'
    
    # 3. 修复常见的格式错误
    # 移除对象后面的孤立字符串（如: },"string",）
    code = re.sub(r'\},\s*"([^"]+)",\s*"id"', r'}, {"id"', code)
    # 移除对象后面的孤立字符串（如: },"string"）
    code = re.sub(r'\},\s*"([^"]+)"\s*\]', r'}]', code)
    # 修复不完整的对象（如: "id":"value","type":"line" 缺少前面的 {）
    code = re.sub(r',\s*"id"\s*:\s*"([^"]+)"\s*,\s*"type"\s*:\s*"line"', r', {"id": "\1", "type": "line"}', code)
    
    # 4. 修复未转义的引号
    code = fix_unescaped_quotes(code)
    
    # 5. 尝试修复不完整的 JSON
    code = fix_incomplete_json(code)
    
    # 6. 验证 JSON 并过滤无效元素类型
    try:
        parsed = json.loads(code)
        # 确保返回的是数组
        if isinstance(parsed, list):
            # 过滤掉不支持的元素类型
            # 有效类型: rectangle, ellipse, diamond, text, line, arrow
            valid_types = {'rectangle', 'ellipse', 'diamond', 'text', 'line', 'arrow'}
            filtered = []
            for element in parsed:
                if not isinstance(element, dict):
                    continue
                element_type = element.get('type')
                if element_type and element_type in valid_types:
                    # 特殊验证：text 元素必须有有效的 text 属性
                    if element_type == 'text':
                        text_value = element.get('text')
                        if text_value is None or text_value == '':
                            # 如果 text 为空或 None，跳过这个元素
                            print(f"Warning: Skipping text element with missing or empty text property")
                            continue
                        # 确保 text 是字符串类型
                        if not isinstance(text_value, str):
                            element['text'] = str(text_value) if text_value is not None else ''
                    filtered.append(element)
                else:
                    # 记录警告但不中断处理
                    print(f"Warning: Skipping unsupported element type: {element_type}")
            return json.dumps(filtered, ensure_ascii=False)
        else:
            return "[]"
    except json.JSONDecodeError as e:
        # 如果仍然无效，尝试提取有效的部分
        try:
            # 找到最后一个完整的对象
            last_complete_pos = find_last_complete_object(code)
            if last_complete_pos > 0:
                code = code[:last_complete_pos] + ']'
                parsed = json.loads(code)
                return json.dumps(parsed, ensure_ascii=False)
        except:
            pass
        # 如果仍然无效，返回空数组
        return "[]"


def fix_unescaped_quotes(json_string: str) -> str:
    """
    修复 JSON 字符串中未转义的引号
    
    Args:
        json_string: JSON 字符串
        
    Returns:
        修复后的字符串
    """
    result = ''
    in_string = False
    escape_next = False
    
    for i, char in enumerate(json_string):
        if escape_next:
            result += char
            escape_next = False
            continue
        
        if char == '\\':
            result += char
            escape_next = True
            continue
        
        if char == '"':
            if not in_string:
                # 开始字符串
                in_string = True
                result += char
            else:
                # 可能是结束引号或未转义的引号
                # 检查下一个非空白字符
                next_chars = json_string[i+1:].lstrip()
                if next_chars and next_chars[0] in [':', ',', '}', ']', '']:
                    # 这是结束引号
                    in_string = False
                    result += char
                else:
                    # 这是未转义的引号，需要转义
                    result += '\\"'
        else:
            result += char
    
    return result


def fix_incomplete_json(json_string: str) -> str:
    """
    修复不完整的 JSON（如缺少闭合括号等）
    
    Args:
        json_string: JSON 字符串
        
    Returns:
        修复后的字符串
    """
    # 统计括号和方括号
    open_braces = json_string.count('{')
    close_braces = json_string.count('}')
    open_brackets = json_string.count('[')
    close_brackets = json_string.count(']')
    
    # 添加缺失的闭合括号
    result = json_string
    if open_braces > close_braces:
        result += '}' * (open_braces - close_braces)
    if open_brackets > close_brackets:
        result += ']' * (open_brackets - close_brackets)
    
    return result


def find_last_complete_object(json_string: str) -> int:
    """
    找到最后一个完整对象的位置
    
    Args:
        json_string: JSON 字符串
        
    Returns:
        最后一个完整对象结束的位置，如果找不到返回 0
    """
    depth = 0
    in_string = False
    escape_next = False
    last_complete_pos = 0
    
    for i, char in enumerate(json_string):
        if escape_next:
            escape_next = False
            continue
        
        if char == '\\':
            escape_next = True
            continue
        
        if char == '"':
            in_string = not in_string
            continue
        
        if in_string:
            continue
        
        if char == '{':
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0:
                # 找到一个完整的对象
                last_complete_pos = i + 1
        elif char == '[':
            depth += 1
        elif char == ']':
            depth -= 1
            if depth == 0:
                # 找到数组结束
                last_complete_pos = i + 1
                break
    
    return last_complete_pos

