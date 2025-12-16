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
from app.core.agents.structure_generator import StructureGeneratorAgent
from app.core.agents.text_optimizer import TextOptimizerAgent
from app.core.agents.validator import ValidatorAgent
from app.core.layout.engine import LayoutEngine
from app.core.layout.postprocessor import LayoutPostProcessor
from app.core.layout.theme import ThemeType
from app.core.excalidraw.builder import ExcalidrawBuilder
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
        structure_generator = StructureGeneratorAgent(llm)
        text_optimizer = TextOptimizerAgent(llm)
        layout_engine = LayoutEngine()
        layout_postprocessor = LayoutPostProcessor()
        excalidraw_builder = ExcalidrawBuilder(theme_type=ThemeType.DEFAULT)
        validator = ValidatorAgent()
        
        # 1. 规划阶段
        logger.info("开始规划阶段")
        plan = await planner.plan(request.user_input, request.chart_type.value, request.current_code)
        logger.info(f"规划完成: {plan}")
        
        # 2. 生成结构阶段
        logger.info("开始生成结构阶段")
        accumulated_structure = ""
        
        if request.stream:
            # 流式响应
            async def generate_stream():
                nonlocal accumulated_structure
                
                # 0. 发送规划结果（Analysis）
                yield {
                    "event": "plan",
                    "data": json.dumps(plan)
                }
                
                # 1. 规划阶段进度（已完成）
                
                # 2. 生成结构阶段进度
                yield {
                    "event": "progress",
                    "data": json.dumps({
                        "stage": "generating_structure",
                        "message": "正在生成图表结构（节点和边）...",
                        "progress": 30
                    })
                }
                
                # 生成结构（只包含节点和边，不包含坐标）
                async for chunk in structure_generator.generate_structure(
                    request.user_input,
                    request.chart_type.value,
                    plan,
                    request.image.dict() if request.image else None
                ):
                    accumulated_structure += chunk
                    yield {
                        "event": "chunk",
                        "data": json.dumps({"content": chunk})
                    }
                
                # 3. 解析结构进度
                yield {
                    "event": "progress",
                    "data": json.dumps({
                        "stage": "parsing_structure",
                        "message": "正在解析结构...",
                        "progress": 50
                    })
                }
                structure = structure_generator.parse_structure(accumulated_structure)
                logger.info(f"结构解析完成: {len(structure.get('nodes', []))} 个节点, {len(structure.get('edges', []))} 条边")
                
                # 4. 文本优化进度（可选）
                yield {
                    "event": "progress",
                    "data": json.dumps({
                        "stage": "optimizing_text",
                        "message": "正在优化文本内容...",
                        "progress": 60
                    })
                }
                optimized_structure = await text_optimizer.optimize(
                    structure,
                    request.chart_type.value
                )
                
                # 5. 布局计算进度
                yield {
                    "event": "progress",
                    "data": json.dumps({
                        "stage": "calculating_layout",
                        "message": "正在计算节点布局...",
                        "progress": 70
                    })
                }
                layout_nodes = layout_engine.layout(
                    optimized_structure,
                    request.chart_type.value
                )
                logger.info(f"布局计算完成: {len(layout_nodes)} 个节点已定位")
                
                # 6. 布局后处理进度（宽高平衡、美观优化）
                yield {
                    "event": "progress",
                    "data": json.dumps({
                        "stage": "postprocessing_layout",
                        "message": "正在优化布局美观度...",
                        "progress": 75
                    })
                }
                layout_nodes = layout_postprocessor.process(
                    layout_nodes,
                    optimized_structure.get("edges", []),
                    request.chart_type.value
                )
                logger.info(f"布局后处理完成: {len(layout_nodes)} 个节点已优化")
                
                # 7. 生成 Excalidraw JSON 进度（应用主题）
                yield {
                    "event": "progress",
                    "data": json.dumps({
                        "stage": "building_excalidraw",
                        "message": "正在生成 Excalidraw 代码（应用主题）...",
                        "progress": 85
                    })
                }
                excalidraw_json = excalidraw_builder.build(
                    optimized_structure,
                    layout_nodes,
                    optimized_structure.get("edges", []),
                    theme_type=ThemeType.DEFAULT
                )
                
                # 8. 箭头优化
                optimized_code = optimize_arrows(excalidraw_json)
                
                # 9. 验证进度
                yield {
                    "event": "progress",
                    "data": json.dumps({
                        "stage": "validating",
                        "message": "正在验证代码...",
                        "progress": 95
                    })
                }
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
            accumulated_structure = ""
            
            # 生成结构
            async for chunk in structure_generator.generate_structure(
                request.user_input,
                request.chart_type.value,
                plan,
                request.image.dict() if request.image else None
            ):
                accumulated_structure += chunk
            
            # 解析结构
            structure = structure_generator.parse_structure(accumulated_structure)
            
            # 文本优化
            optimized_structure = await text_optimizer.optimize(
                structure,
                request.chart_type.value
            )
            
            # 布局计算
            layout_nodes = layout_engine.layout(
                optimized_structure,
                request.chart_type.value
            )
            
            # 布局后处理（宽高平衡、美观优化）
            layout_nodes = layout_postprocessor.process(
                layout_nodes,
                optimized_structure.get("edges", []),
                request.chart_type.value
            )
            
            # 生成 Excalidraw JSON（应用主题）
            excalidraw_json = excalidraw_builder.build(
                optimized_structure,
                layout_nodes,
                optimized_structure.get("edges", []),
                theme_type=ThemeType.DEFAULT
            )
            
            # 箭头优化
            optimized_code = optimize_arrows(excalidraw_json)
            
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
        # 使用 % 格式化避免 f-string 中的 {} 冲突
        logger.error("生成失败: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))





