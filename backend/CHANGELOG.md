# 更新日志

## [2025-01-XX] - 添加 Ollama 和 Qwen 支持

### 新增功能

#### ✅ Ollama 支持
- 添加 Ollama LLM 提供商
- 支持本地和远程 Ollama 服务
- 自动获取可用模型列表
- 使用 OpenAI 兼容的 API 接口

**配置示例：**
```json
{
  "name": "本地 Ollama",
  "type": "ollama",
  "baseUrl": "http://localhost:11434",
  "apiKey": "ollama",
  "model": "llama2"
}
```

#### ✅ Qwen (通义千问) 支持
- 添加 Qwen LLM 提供商
- 支持阿里云 DashScope API
- 支持多种 Qwen 模型（turbo/plus/max/vl）
- 使用 OpenAI 兼容的 API 接口

**配置示例：**
```json
{
  "name": "通义千问",
  "type": "qwen",
  "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
  "apiKey": "sk-xxxxxxxxxxxxx",
  "model": "qwen-max"
}
```

### 修改的文件

1. **backend/app/models/request.py**
   - 添加 `LLMProvider.OLLAMA` 和 `LLMProvider.QWEN` 枚举值

2. **backend/app/core/llm/factory.py**
   - 添加 `_create_ollama()` 和 `_create_qwen()` 方法
   - 更新 provider_map 映射

3. **backend/app/core/llm/providers/**
   - 新增 `ollama.py` - Ollama 提供商实现
   - 新增 `qwen.py` - Qwen 提供商实现
   - 新增 `common.py` - 通用模型获取函数
   - 更新 `__init__.py` - 导出新函数

4. **backend/app/api/v1/models.py**
   - 添加 Ollama 和 Qwen 的模型列表获取支持
   - 处理 Ollama 可选的 API key

### 新增文档

- `backend/docs/ollama-qwen-setup.md` - 详细的配置和使用指南

### 支持的模型

#### Ollama 常用模型
- llama2
- mistral
- codellama
- phi
- neural-chat
- starling-lm

#### Qwen 模型
- qwen-turbo
- qwen-plus
- qwen-max
- qwen-max-longcontext
- qwen-vl-max
- qwen-vl-plus

### 使用说明

详见 `backend/docs/ollama-qwen-setup.md`

### 注意事项

1. **Ollama**
   - 需要先安装并启动 Ollama 服务
   - 默认端口：11434
   - API key 通常不需要，但需要提供（可以是 "ollama"）

2. **Qwen**
   - 需要从阿里云 DashScope 获取 API Key
   - 注意 API 调用频率限制
   - 不同模型有不同的计费标准

### 测试

```bash
# 测试 Ollama
curl http://localhost:11434/api/tags

# 测试 Qwen API
curl https://dashscope.aliyuncs.com/compatible-mode/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```





