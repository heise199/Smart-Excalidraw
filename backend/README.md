# Smart Excalidraw Python 后端

基于 FastAPI 和 Langchain 的智能图表生成后端服务。

## 架构概述

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI 应用入口
│   ├── config.py               # 配置管理
│   ├── models/                 # 数据模型
│   │   ├── __init__.py
│   │   ├── request.py          # 请求模型
│   │   └── response.py         # 响应模型
│   ├── api/                    # API 路由
│   │   ├── __init__.py
│   │   ├── v1/
│   │   │   ├── __init__.py
│   │   │   ├── generate.py     # 图表生成端点
│   │   │   ├── models.py        # 模型管理端点
│   │   │   └── config.py        # 配置管理端点
│   ├── core/                   # 核心功能
│   │   ├── __init__.py
│   │   ├── agents/             # Langchain 智能体
│   │   │   ├── __init__.py
│   │   │   ├── planner.py      # 规划智能体
│   │   │   ├── generator.py    # 生成智能体
│   │   │   ├── optimizer.py    # 优化智能体
│   │   │   └── validator.py    # 验证智能体
│   │   ├── llm/                # LLM 客户端
│   │   │   ├── __init__.py
│   │   │   ├── factory.py       # LLM 工厂
│   │   │   ├── providers/      # 各提供商实现
│   │   │   │   ├── __init__.py
│   │   │   │   ├── openai.py
│   │   │   │   ├── anthropic.py
│   │   │   │   ├── google.py
│   │   │   │   ├── mistral.py
│   │   │   │   └── custom.py
│   │   │   └── mcp/            # MCP 支持
│   │   │       ├── __init__.py
│   │   │       └── client.py
│   │   └── excalidraw/         # Excalidraw 处理
│   │       ├── __init__.py
│   │       ├── parser.py        # 代码解析
│   │       └── optimizer.py     # 代码优化
│   └── utils/                  # 工具函数
│       ├── __init__.py
│       ├── prompts.py          # 提示词管理
│       └── validators.py       # 验证工具
├── requirements.txt            # Python 依赖
├── .env.example               # 环境变量示例
└── README.md                  # 本文档
```

## 快速开始

### 1. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填入你的 API 密钥
```

### 3. 启动服务

```bash
uvicorn app.main:app --reload --port 8000
```

### 4. 访问 API 文档

打开浏览器访问：http://localhost:8000/docs

## 功能特性

- ✅ FastAPI 高性能异步框架
- ✅ Langchain 多智能体系统
- ✅ 支持多种 LLM 提供商（OpenAI, Anthropic, Google, Mistral 等）
- ✅ MCP (Model Context Protocol) 支持
- ✅ 流式响应 (SSE)
- ✅ 自动代码优化和验证
- ✅ 完整的类型提示

## API 端点

### POST /api/v1/generate
生成 Excalidraw 图表代码

### GET /api/v1/models
获取可用模型列表

### POST /api/v1/config
保存 LLM 配置

## 开发指南

详见各模块的 README 文档。

