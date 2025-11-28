# Ollama 和 Qwen API 配置指南

## Ollama 配置

### 1. 安装 Ollama

访问 [Ollama 官网](https://ollama.ai/) 下载并安装 Ollama。

### 2. 启动 Ollama 服务

```bash
# 启动 Ollama 服务（默认端口 11434）
ollama serve
```

### 3. 下载模型

```bash
# 下载常用模型
ollama pull llama2
ollama pull mistral
ollama pull codellama
ollama pull phi
```

### 4. 配置 API

在 Smart Excalidraw 中配置：

- **提供商类型**: `ollama`
- **基础 URL**: `http://localhost:11434` (本地) 或 `http://your-server:11434` (远程)
- **API 密钥**: 通常不需要，可以填写 `ollama` 或留空
- **模型**: 选择已下载的模型，如 `llama2`, `mistral`, `codellama` 等

### 5. 常用模型列表

- `llama2` - Llama 2
- `mistral` - Mistral 7B
- `codellama` - Code Llama
- `phi` - Phi-2
- `neural-chat` - Neural Chat
- `starling-lm` - Starling LM
- `llama2:13b` - Llama 2 13B
- `llama2:70b` - Llama 2 70B

### 6. 验证连接

```bash
# 测试 Ollama API
curl http://localhost:11434/api/tags
```

## Qwen API 配置

### 1. 获取 API 密钥

1. 访问 [阿里云 DashScope](https://dashscope.console.aliyun.com/)
2. 注册/登录账号
3. 创建 API Key

### 2. 配置 API

在 Smart Excalidraw 中配置：

- **提供商类型**: `qwen`
- **基础 URL**: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- **API 密钥**: 从 DashScope 控制台获取的 API Key
- **模型**: 选择可用的模型，如：
  - `qwen-turbo` - Qwen Turbo（快速）
  - `qwen-plus` - Qwen Plus（平衡）
  - `qwen-max` - Qwen Max（最强）
  - `qwen-max-longcontext` - Qwen Max 长上下文
  - `qwen-vl-max` - Qwen VL Max（视觉）
  - `qwen-vl-plus` - Qwen VL Plus（视觉）

### 3. 模型说明

#### 文本模型
- **qwen-turbo**: 快速响应，适合简单任务
- **qwen-plus**: 平衡性能和速度
- **qwen-max**: 最强性能，适合复杂任务
- **qwen-max-longcontext**: 支持超长上下文（128K tokens）

#### 视觉模型
- **qwen-vl-max**: 多模态视觉理解
- **qwen-vl-plus**: 视觉理解增强版

### 4. 使用限制

- 每个 API Key 有调用频率限制
- 不同模型有不同的计费标准
- 建议查看 [DashScope 文档](https://help.aliyun.com/zh/dashscope/) 了解最新信息

### 5. 验证连接

```bash
# 测试 Qwen API
curl https://dashscope.aliyuncs.com/compatible-mode/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## 配置示例

### Ollama 配置示例

```json
{
  "name": "本地 Ollama",
  "type": "ollama",
  "baseUrl": "http://localhost:11434",
  "apiKey": "ollama",
  "model": "llama2"
}
```

### Qwen 配置示例

```json
{
  "name": "通义千问",
  "type": "qwen",
  "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
  "apiKey": "sk-xxxxxxxxxxxxx",
  "model": "qwen-max"
}
```

## 常见问题

### Ollama 相关问题

**Q: Ollama 服务无法连接？**
A: 检查 Ollama 服务是否运行：`ollama serve`，确认端口 11434 未被占用。

**Q: 模型下载失败？**
A: 检查网络连接，或使用代理。可以手动下载模型文件。

**Q: 如何查看已安装的模型？**
A: 运行 `ollama list` 命令。

### Qwen 相关问题

**Q: API 调用返回 401 错误？**
A: 检查 API Key 是否正确，是否已激活。

**Q: 如何查看 API 使用量？**
A: 登录 DashScope 控制台查看使用统计。

**Q: 支持哪些模型？**
A: 查看 [DashScope 模型列表](https://help.aliyun.com/zh/dashscope/developer-reference/model-introduction)

## 性能优化建议

### Ollama
- 使用 GPU 加速（如果可用）
- 选择适合的模型大小（7B/13B/70B）
- 调整 `max_tokens` 参数

### Qwen
- 根据任务复杂度选择模型（turbo/plus/max）
- 合理设置 `temperature` 参数
- 注意 API 调用频率限制

## 参考链接

- [Ollama 官方文档](https://github.com/ollama/ollama)
- [DashScope 文档](https://help.aliyun.com/zh/dashscope/)
- [Qwen 模型介绍](https://help.aliyun.com/zh/dashscope/developer-reference/model-introduction)





