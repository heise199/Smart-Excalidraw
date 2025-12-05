# 前后端 API 集成文档

## 概述

前端已完全切换到使用 Python FastAPI 后端，不再使用 Next.js API 路由。

## API 端点映射

### 原前端 API → 后端 API

| 原前端 API | 后端 API | 说明 |
|-----------|---------|------|
| `POST /api/generate` | `POST /api/v1/generate` | 生成图表代码 |
| `GET /api/models` | `GET /api/v1/models` | 获取模型列表 |
| `GET /api/config` | `GET /api/v1/config` | 获取配置 |
| `POST /api/config` | `POST /api/v1/config` | 保存配置 |

## 配置

### 环境变量

在 `frontend/.env.local` 中配置后端地址：

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### 默认值

如果不设置环境变量，默认使用 `http://localhost:8000`

## API 客户端

所有 API 调用通过 `lib/api-client.js` 统一管理：

### generateChart()

生成图表代码（支持流式响应）

```javascript
import { generateChart } from '@/lib/api-client';

const response = await generateChart({
  config: {
    name: "My OpenAI",
    type: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "sk-...",
    model: "gpt-4"
  },
  userInput: "画一个流程图",
  chartType: "flowchart",
  image: null, // 可选
  stream: true // 默认 true
});
```

### fetchModels()

获取可用模型列表

```javascript
import { fetchModels } from '@/lib/api-client';

const models = await fetchModels('openai', 'https://api.openai.com/v1', 'sk-...');
```

### getAllConfigs()

获取所有配置

```javascript
import { getAllConfigs } from '@/lib/api-client';

const configs = await getAllConfigs();
// 返回: { providers: [...], currentProviderId: "..." }
```

### saveAllConfigs()

保存配置

```javascript
import { saveAllConfigs } from '@/lib/api-client';

await saveAllConfigs({
  providers: [...],
  currentProviderId: "..."
});
```

## 流式响应格式

后端使用 Server-Sent Events (SSE) 格式：
11
```
event: chunk
data: {"content": "..."}

event: chunk
data: {"content": "..."}

event: done
data: {"code": "[...]", "optimized": true, "validation_passed": true}
```

前端会自动解析并处理这些事件。

## 请求/响应格式

### POST /api/v1/generate

**请求：**
```json
{
  "config": {
    "name": "My OpenAI",
    "type": "openai",
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "sk-...",
    "model": "gpt-4"
  },
  "userInput": "画一个流程图",
  "chartType": "flowchart",
  "image": null,
  "stream": true,
  "useMcp": false,
  "mcpContext": null
}
```

**响应（流式）：**
- `event: chunk` - 代码片段
- `event: done` - 最终优化后的代码

### GET /api/v1/models

**查询参数：**
- `type`: 提供商类型 (openai, anthropic, ollama, qwen 等)
- `baseUrl`: 基础 URL
- `apiKey`: API 密钥（Ollama 可为空）

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

**请求：**
```json
{
  "providers": [...],
  "currentProviderId": "..."
}
```

**响应：**
```json
{
  "success": true
}
```

## 错误处理

所有 API 调用都会自动处理错误：

```javascript
try {
  const response = await generateChart({...});
} catch (error) {
  // error.message 包含错误信息
  console.error(error.message);
}
```

## 已更新的文件

1. ✅ `lib/api-client.js` - 新建，统一 API 客户端
2. ✅ `lib/config.js` - 更新，使用后端 API
3. ✅ `app/page.js` - 更新，使用后端生成 API
4. ✅ `components/ConfigModal.jsx` - 更新，使用后端模型 API

## 已废弃的文件

以下文件不再使用，可以删除或保留作为参考：

- `app/api/generate/route.js` - 已废弃
- `app/api/models/route.js` - 已废弃
- `app/api/config/route.js` - 已废弃
- `lib/llm-client.js` - 部分功能已迁移到 api-client.js

## 测试

### 1. 检查后端连接

```javascript
import { checkBackendConnection } from '@/lib/api-client';

const isConnected = await checkBackendConnection();
console.log('Backend connected:', isConnected);
```

### 2. 测试生成

1. 启动后端：`cd backend && uvicorn app.main:app --reload`
2. 启动前端：`cd frontend && pnpm dev`
3. 在浏览器中测试生成功能

## 故障排查

### CORS 错误

确保后端 `CORS_ORIGINS` 包含前端地址：
```python
# backend/app/config.py
CORS_ORIGINS = ["http://localhost:3000", "http://localhost:3001"]
```

### 连接失败

1. 检查后端是否运行：`curl http://localhost:8000/health`
2. 检查环境变量：`NEXT_PUBLIC_BACKEND_URL`
3. 检查网络连接

### SSE 解析错误

检查后端 SSE 格式是否正确，前端支持标准的 SSE 格式。

## 下一步

- [ ] 添加请求重试机制
- [ ] 添加请求超时处理
- [ ] 添加请求缓存（可选）
- [ ] 添加请求日志









