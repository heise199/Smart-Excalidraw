# 前后端集成检查清单

## ✅ 已完成的集成工作

### 1. API 客户端创建
- [x] 创建 `lib/api-client.js` - 统一 API 客户端
- [x] 支持所有后端 API 端点
- [x] 错误处理机制
- [x] 环境变量配置支持

### 2. 配置管理更新
- [x] `lib/config.js` - 使用后端 API
- [x] `getAllConfigs()` - 调用后端
- [x] `saveAllConfigs()` - 调用后端

### 3. 生成功能更新
- [x] `app/page.js` - `handleSendMessage()` 使用后端 API
- [x] 支持图片输入
- [x] SSE 流式响应解析
- [x] 处理后端返回的优化代码

### 4. 模型管理更新
- [x] `components/ConfigModal.jsx` - 使用后端模型 API
- [x] 支持所有提供商类型（包括 Ollama 和 Qwen）

### 5. 文档
- [x] `API_INTEGRATION.md` - 集成文档
- [x] `.env.example` - 环境变量示例

## 🔍 接口规范检查

### POST /api/v1/generate

**前端发送：**
```json
{
  "config": {...},
  "userInput": "...",
  "chartType": "flowchart",
  "image": null,
  "stream": true
}
```

**后端期望：**
```json
{
  "config": {...},
  "userInput": "...",
  "chartType": "flowchart",
  "image": null,
  "stream": true,
  "useMcp": false,
  "mcpContext": null
}
```

✅ **匹配** - 前端会自动添加 `useMcp: false` 和 `mcpContext: null`

### GET /api/v1/models

**前端发送：**
```
GET /api/v1/models?type=openai&baseUrl=...&apiKey=...
```

**后端期望：**
```
GET /api/v1/models?type=openai&baseUrl=...&apiKey=...
```

✅ **匹配** - 完全一致

### GET /api/v1/config

**前端期望：**
```json
{
  "providers": [...],
  "currentProviderId": "..."
}
```

**后端返回：**
```json
{
  "providers": [...],
  "currentProviderId": "..."
}
```

✅ **匹配** - 完全一致

### POST /api/v1/config

**前端发送：**
```json
{
  "providers": [...],
  "currentProviderId": "..."
}
```

**后端期望：**
```json
{
  "providers": [...],
  "currentProviderId": "..."
}
```

✅ **匹配** - 完全一致

## 🔄 SSE 格式检查

### 后端发送格式：
```
event: chunk
data: {"content": "..."}

event: chunk
data: {"content": "..."}

event: done
data: {"code": "[...]", "optimized": true, "validation_passed": true}
```

### 前端解析：
- ✅ 正确解析 `event:` 行
- ✅ 正确解析 `data:` 行
- ✅ 处理 `chunk` 事件
- ✅ 处理 `done` 事件

## ⚠️ 注意事项

### 1. 环境变量
确保设置 `NEXT_PUBLIC_BACKEND_URL`：
```bash
# frontend/.env.local
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### 2. CORS 配置
确保后端允许前端域名：
```python
# backend/app/config.py
CORS_ORIGINS = ["http://localhost:3000", "http://localhost:3001"]
```

### 3. 已废弃的文件
以下文件不再使用，可以删除：
- `app/api/generate/route.js`
- `app/api/models/route.js`
- `app/api/config/route.js`

或者保留作为参考，但不会被执行。

## 🧪 测试步骤

### 1. 启动后端
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

### 2. 启动前端
```bash
cd frontend
pnpm dev
```

### 3. 测试功能
- [ ] 配置 LLM 提供商
- [ ] 加载模型列表
- [ ] 生成图表（文本输入）
- [ ] 生成图表（图片输入）
- [ ] 保存/加载配置

## 📝 待优化项

- [ ] 添加请求重试机制
- [ ] 添加请求超时处理
- [ ] 添加连接状态指示器
- [ ] 优化错误提示信息
- [ ] 添加请求日志（开发模式）





