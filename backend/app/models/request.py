"""
请求数据模型
"""
from pydantic import BaseModel, Field
from typing import Optional, Literal, Dict, Any
from enum import Enum


class LLMProvider(str, Enum):
    """LLM 提供商枚举"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    MISTRAL = "mistral"
    OLLAMA = "ollama"
    QWEN = "qwen"
    CUSTOM = "custom"


class ChartType(str, Enum):
    """图表类型枚举"""
    AUTO = "auto"
    FLOWCHART = "flowchart"
    MINDMAP = "mindmap"
    ORGCHART = "orgchart"
    SEQUENCE = "sequence"
    CLASS = "class"
    ER = "er"
    GANTT = "gantt"
    TIMELINE = "timeline"
    TREE = "tree"
    NETWORK = "network"
    ARCHITECTURE = "architecture"
    DATAFLOW = "dataflow"
    STATE = "state"
    SWIMLANE = "swimlane"
    CONCEPT = "concept"
    FISHBONE = "fishbone"
    SWOT = "swot"
    PYRAMID = "pyramid"
    FUNNEL = "funnel"
    VENN = "venn"
    MATRIX = "matrix"
    INFOGRAPHIC = "infographic"


class LLMConfig(BaseModel):
    """LLM 配置"""
    id: Optional[str] = None
    name: str
    type: LLMProvider
    base_url: str = Field(..., alias="baseUrl")
    api_key: str = Field(..., alias="apiKey")
    model: str
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 4096
    
    class Config:
        populate_by_name = True


class ImageData(BaseModel):
    """图片数据"""
    data: str  # base64 编码
    mime_type: str = Field(..., alias="mimeType")
    dimensions: Optional[Dict[str, int]] = None
    size: Optional[int] = None
    name: Optional[str] = None
    
    class Config:
        populate_by_name = True


class GenerateRequest(BaseModel):
    """生成请求"""
    config: LLMConfig
    user_input: str = Field(..., alias="userInput")
    chart_type: ChartType = Field(ChartType.AUTO, alias="chartType")
    image: Optional[ImageData] = None
    stream: bool = True
    use_mcp: bool = Field(False, alias="useMcp")
    mcp_context: Optional[Dict[str, Any]] = Field(None, alias="mcpContext")
    
    class Config:
        populate_by_name = True


class ModelListRequest(BaseModel):
    """模型列表请求"""
    type: LLMProvider
    base_url: str = Field(..., alias="baseUrl")
    api_key: str = Field(..., alias="apiKey")
    
    class Config:
        populate_by_name = True


class ConfigSaveRequest(BaseModel):
    """配置保存请求"""
    providers: list[LLMConfig]
    current_provider_id: Optional[str] = Field(None, alias="currentProviderId")
    
    class Config:
        populate_by_name = True

