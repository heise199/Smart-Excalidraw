"""
图表生成 API 端点
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
from loguru import logger
import json

from app.models.request import GenerateRequest
from app.models.response import GenerateResponse, GenerateChunk
from app.core.llm.factory import LLMFactory
from app.core.agents.planner import PlannerAgent
from app.core.agents.generator import GeneratorAgent
from app.core.agents.optimizer import OptimizerAgent
from app.core.agents.validator import ValidatorAgent
from app.core.excalidraw.parser import parse_code
from app.core.excalidraw.optimizer import optimize_arrows

router = APIRouter()


@router.post("/generate", response_model=None)
async def generate_chart(request: GenerateRequest):
    """
    生成 Excalidraw 图表代码
    
    支持流式和非流式响应
    """
    try:
        # 创建 LLM 实例
        llm = LLMFactory.create_llm(request.config)
        
        # 创建智能体
        planner = PlannerAgent(llm)
        generator = GeneratorAgent(llm)
        optimizer = OptimizerAgent(llm)
        validator = ValidatorAgent()
        
        # 1. 规划阶段
        logger.info("开始规划阶段")
        plan = await planner.plan(request.user_input, request.chart_type.value)
        logger.info(f"规划完成: {plan}")
        
        # 2. 生成阶段
        logger.info("开始生成阶段")
        accumulated_code = ""
        
        if request.stream:
            # 流式响应
            async def generate_stream():
                nonlocal accumulated_code
                
                # 生成代码
                async for chunk in generator.generate(
                    request.user_input,
                    request.chart_type.value,
                    plan,
                    request.image.dict() if request.image else None
                ):
                    accumulated_code += chunk
                    yield {
                        "event": "chunk",
                        "data": json.dumps({"content": chunk})
                    }
                
                # 后处理
                processed_code = parse_code(accumulated_code)
                
                # 优化
                optimized_code = await optimizer.optimize(processed_code)
                optimized_code = optimize_arrows(optimized_code)
                
                # 验证
                is_valid, errors = validator.validate(optimized_code)
                
                # 发送最终结果
                yield {
                    "event": "done",
                    "data": json.dumps({
                        "code": optimized_code,
                        "optimized": True,
                        "validation_passed": is_valid,
                        "errors": errors if not is_valid else None
                    })
                }
            
            return EventSourceResponse(generate_stream())
        else:
            # 非流式响应
            async for chunk in generator.generate(
                request.user_input,
                request.chart_type.value,
                plan,
                request.image.dict() if request.image else None
            ):
                accumulated_code += chunk
            
            # 后处理
            processed_code = parse_code(accumulated_code)
            
            # 优化
            optimized_code = await optimizer.optimize(processed_code)
            optimized_code = optimize_arrows(optimized_code)
            
            # 验证
            is_valid, errors = validator.validate(optimized_code)
            
            # 解析元素数量
            try:
                elements = json.loads(optimized_code)
                elements_count = len(elements) if isinstance(elements, list) else 0
            except:
                elements_count = 0
            
            return GenerateResponse(
                code=optimized_code,
                elements_count=elements_count,
                optimized=True,
                validation_passed=is_valid,
                errors=errors if not is_valid else None
            )
    
    except Exception as e:
        logger.error(f"生成失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

