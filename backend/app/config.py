"""
应用配置管理
"""
from pydantic_settings import BaseSettings
from typing import List
import os
from pathlib import Path


class Settings(BaseSettings):
    """应用配置"""
    
    # 应用基础配置
    APP_NAME: str = "Smart Excalidraw API"
    DEBUG: bool = False
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]
    
    # 服务器配置
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # 数据目录
    DATA_DIR: Path = Path("data")
    CONFIG_FILE: Path = DATA_DIR / "llm-configs.json"
    
    # LLM 配置
    DEFAULT_MAX_TOKENS: int = 4096
    DEFAULT_TEMPERATURE: float = 0.7
    
    # 流式响应配置
    STREAM_CHUNK_SIZE: int = 1024
    
    # MCP 配置
    MCP_ENABLED: bool = True
    MCP_SERVER_URL: str = "http://localhost:3002"
    
    # 日志配置
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# 创建全局配置实例
settings = Settings()

# 确保数据目录存在
settings.DATA_DIR.mkdir(exist_ok=True)

