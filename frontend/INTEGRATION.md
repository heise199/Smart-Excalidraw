# 前后端集成指南

本文档说明如何将 Python FastAPI 后端集成到现有的 Next.js 前端项目中。

## 架构概览

```
前端 (Next.js)         后端 (FastAPI)
    |                      |
    |  HTTP/SSE            |
    |<------------------->|
    |                      |
    |  1. 生成请求         |
    |  2. 流式响应         |
    |  3. 配置管理         |
```

## 集成步骤

### 1. 启动后端服务

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. 修改前端 API 调用

修改 `app/api/generate/route.js`，将请求转发到 Python 后端：

```javascript
// 原代码调用 LLM，现在改为调用 Python 后端
const response = await fetch('http://localhost:8000/api/v1/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    config,
    userInput: userMessage,
    chartType,
    image: imageData, // 如果有图片
    stream: true,
    useMcp: false, // 是否使用 MCP
  }),
});
```

### 3. 更新模型列表 API

修改 `app/api/models/route.js`：

```javascript
const response = await fetch(`http://localhost:8000/api/v1/models?type=${type}&baseUrl=${baseUrl}&apiKey=${apiKey}`);
```

### 4. 更新配置 API

修改 `app/api/config/route.js`：

```javascript
// GET
const response = await fetch('http://localhost:8000/api/v1/config');

// POST
const response = await fetch('http://localhost:8000/api/v1/config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(configData),
});
```

## API 接口说明

### POST /api/v1/generate

**请求体：**
```json
{
  "config": {
    "name": "My OpenAI",
    "type": "openai",
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "sk-...",
    "model": "gpt-4"
  },
  "userInput": "画一个用户登录流程图",
  "chartType": "flowchart",
  "image": null,
  "stream": true,
  "useMcp": false
}
```

**流式响应（SSE）：**
```
event: chunk
data: {"content": "..."}

event: chunk
data: {"content": "..."}

event: done
data: {"code": "[...]", "optimized": true, "validation_passed": true}
```

### GET /api/v1/models

**查询参数：**
- `type`: 提供商类型 (openai, anthropic, google, mistral, custom)
- `baseUrl`: 基础 URL
- `apiKey`: API 密钥

**响应：**
```json
{
  "models": [
    {"id": "gpt-4", "name": "GPT-4"},
    {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo"}
  ]
}
```

### GET /api/v1/config

**响应：**
```json
{
  "providers": [...],
  "currentProviderId": "..."
}
```

### POST /api/v1/config

**请求体：**
```json
{
  "providers": [...],
  "currentProviderId": "..."
}
```

## 环境变量配置

在前端项目中添加后端 URL 配置：

```javascript
// lib/config.js 或环境变量
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
```

## 开发模式

### 同时运行前后端

**终端 1 - 前端：**
```bash
cd .
pnpm dev
```

**终端 2 - 后端：**
```bash
cd backend
uvicorn app.main:app --reload
```

## 生产部署

### Docker Compose

创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  frontend:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_BACKEND_URL=http://backend:8000
  
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - CORS_ORIGINS=http://localhost:3000
```

### Nginx 反向代理

```nginx
server {
    listen 80;
    
    location / {
        proxy_pass http://frontend:3000;
    }
    
    location /api {
        proxy_pass http://backend:8000;
    }
}
```

## 故障排查

### 1. CORS 错误

确保后端 `CORS_ORIGINS` 包含前端 URL。

### 2. 连接失败

检查后端服务是否运行：
```bash
curl http://localhost:8000/health
```

### 3. 流式响应中断

检查网络连接和超时设置。

## 下一步

- [ ] 添加认证和授权
- [ ] 实现请求限流
- [ ] 添加监控和日志
- [ ] 优化性能

