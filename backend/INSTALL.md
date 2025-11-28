# 后端安装指南

## 快速开始

### 1. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

如果使用 conda 环境：

```bash
conda activate your_env_name
pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件（可选）
```

### 3. 启动服务

```bash
uvicorn app.main:app --reload --port 8000
```

## 常见问题

### 问题 1: ModuleNotFoundError: No module named 'sse_starlette'

**解决方案：**
```bash
pip install sse-starlette
```

或者安装所有依赖：
```bash
pip install -r requirements.txt
```

### 问题 2: ImportError: cannot import name 'ChatMistral'

**解决方案：**
Mistral 现在使用 OpenAI 兼容的 API，不再需要 `langchain-mistralai` 包。

如果已安装，可以卸载：
```bash
pip uninstall langchain-mistralai
```

### 问题 3: 依赖版本冲突

**解决方案：**
建议使用虚拟环境：

```bash
# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 问题 4: Langchain 版本问题

如果遇到 Langchain 相关错误，可以尝试：

```bash
pip install --upgrade langchain langchain-core langchain-community
```

## 依赖说明

### 核心依赖
- `fastapi` - Web 框架
- `uvicorn` - ASGI 服务器
- `pydantic` - 数据验证
- `langchain` - LLM 框架

### LLM 提供商
- `langchain-openai` - OpenAI 支持
- `langchain-anthropic` - Anthropic 支持
- `langchain-google-genai` - Google 支持
- `sse-starlette` - SSE 流式响应

### 工具库
- `httpx` - 异步 HTTP 客户端
- `loguru` - 日志管理
- `python-dotenv` - 环境变量管理

## 验证安装

### 1. 检查 Python 版本

```bash
python --version
# 应该 >= 3.8
```

### 2. 测试导入

```bash
python -c "from app.main import app; print('OK')"
```

### 3. 启动服务

```bash
uvicorn app.main:app --reload --port 8000
```

访问 http://localhost:8000/docs 查看 API 文档。

## 生产环境

### 使用 Gunicorn

```bash
pip install gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### 使用 Docker

```bash
docker build -t smart-excalidraw-backend .
docker run -p 8000:8000 smart-excalidraw-backend
```

## 故障排查

### 检查已安装的包

```bash
pip list | grep langchain
pip list | grep sse
```

### 重新安装依赖

```bash
pip install --upgrade -r requirements.txt
```

### 清理并重新安装

```bash
pip uninstall -r requirements.txt -y
pip install -r requirements.txt
```





