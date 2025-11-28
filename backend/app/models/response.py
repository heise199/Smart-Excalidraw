"""
响应数据模型
"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class ModelInfo(BaseModel):
    """模型信息"""
    id: str
    name: str


class ModelListResponse(BaseModel):
    """模型列表响应"""
    models: List[ModelInfo]


class GenerateChunk(BaseModel):
    """生成数据块"""
    content: Optional[str] = None
    error: Optional[str] = None
    done: bool = False


class GenerateResponse(BaseModel):
    """生成响应（非流式）"""
    code: str
    elements_count: int
    optimized: bool
    validation_passed: bool
    errors: Optional[List[str]] = None


class ConfigResponse(BaseModel):
    """配置响应"""
    providers: List[Dict[str, Any]]
    current_provider_id: Optional[str] = None


class ErrorResponse(BaseModel):
    """错误响应"""
    error: str
    detail: Optional[str] = None

