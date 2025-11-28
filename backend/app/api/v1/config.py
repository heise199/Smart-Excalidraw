"""
配置管理 API 端点
"""
from fastapi import APIRouter, HTTPException
from loguru import logger
import json
from pathlib import Path

from app.models.request import ConfigSaveRequest
from app.models.response import ConfigResponse
from app.config import settings

router = APIRouter()


@router.get("/config", response_model=ConfigResponse)
async def get_config():
    """获取配置"""
    try:
        if not settings.CONFIG_FILE.exists():
            return ConfigResponse(providers=[], current_provider_id=None)
        
        with open(settings.CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        return ConfigResponse(**data)
    
    except Exception as e:
        logger.error(f"读取配置失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/config")
async def save_config(request: ConfigSaveRequest):
    """保存配置"""
    try:
        # 确保目录存在
        settings.CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        
        # 保存配置
        with open(settings.CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(request.dict(by_alias=True), f, ensure_ascii=False, indent=2)
        
        return {"success": True}
    
    except Exception as e:
        logger.error(f"保存配置失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

