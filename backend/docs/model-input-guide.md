# 模型输入指南

## 概述

系统支持两种方式选择模型：
1. **从列表选择** - 自动从 API 获取可用模型列表
2. **手动输入** - 用户直接输入模型名称

## 工作原理

### 自动获取模型列表

系统会尝试从各个提供商的 API 获取模型列表：

- **OpenAI** - 从 `/models` 端点获取
- **Anthropic** - 尝试从 API 获取，失败则返回空列表
- **Google** - 尝试从 API 获取，失败则返回空列表
- **Mistral** - 从 `/v1/models` 端点获取
- **Ollama** - 从 `/api/tags` 端点获取本地模型
- **Qwen** - 尝试从 API 获取，失败则返回空列表
- **Custom** - 使用 OpenAI 兼容的 API

### 手动输入模式

当以下情况发生时，系统会自动切换到手动输入模式：

1. **API 获取失败** - 无法从提供商 API 获取模型列表
2. **模型列表为空** - API 返回空列表
3. **当前模型不在列表中** - 用户已输入的模型不在获取的列表中
4. **用户主动选择** - 用户点击"手动输入"选项

## 常用模型名称参考

### Anthropic (Claude)
```
claude-3-5-sonnet-20241022
claude-3-opus-20240229
claude-3-sonnet-20240229
claude-3-haiku-20240307
claude-3-5-sonnet-20240620
```

### Google (Gemini)
```
gemini-pro
gemini-pro-vision
gemini-1.5-pro
gemini-1.5-flash
gemini-1.5-pro-latest
```

### Mistral
```
mistral-large-latest
mistral-medium-latest
mistral-small-latest
mistral-tiny
pixtral-large-latest
```

### Ollama
```
llama2
mistral
codellama
phi
neural-chat
starling-lm
llama2:13b
llama2:70b
```

### Qwen (通义千问)
```
qwen-turbo
qwen-plus
qwen-max
qwen-max-longcontext
qwen-vl-max
qwen-vl-plus
```

### OpenAI
```
gpt-4
gpt-4-turbo-preview
gpt-3.5-turbo
gpt-4o
gpt-4o-mini
```

## 使用建议

### 1. 优先尝试自动获取

点击"加载可用模型"按钮，系统会自动尝试从 API 获取模型列表。

### 2. 如果获取失败

- 检查 API 密钥是否正确
- 检查网络连接
- 检查 Base URL 是否正确
- 如果确认配置正确但仍无法获取，使用手动输入

### 3. 手动输入时

- 确保模型名称拼写正确
- 注意大小写（某些提供商区分大小写）
- 使用完整的模型 ID（包括版本号，如果有）

### 4. 验证模型名称

保存配置后，尝试生成图表来验证模型名称是否正确。如果模型名称错误，会在生成时返回错误。

## 常见问题

### Q: 为什么某些提供商无法获取模型列表？

**A:** 某些提供商（如 Anthropic、Google）可能没有公开的模型列表 API 端点，或者需要特殊的认证方式。这种情况下，系统会返回空列表，允许用户手动输入。

### Q: 如何知道正确的模型名称？

**A:** 
1. 查看提供商的官方文档
2. 查看提供商的 API 文档
3. 参考上面的常用模型名称列表
4. 如果使用代理服务，查看代理服务的文档

### Q: 模型名称输入错误会怎样？

**A:** 保存配置时不会验证模型名称。只有在实际调用 API 生成图表时，如果模型名称错误，API 会返回错误信息。

### Q: 可以保存多个相同类型但不同模型的配置吗？

**A:** 可以。每个配置都有唯一的 ID，可以保存多个相同提供商但不同模型的配置。

## 最佳实践

1. **先尝试自动获取** - 大多数情况下，自动获取是最方便的
2. **保存常用模型** - 将常用的模型配置保存下来，避免重复输入
3. **使用描述性名称** - 为配置起一个容易识别的名称，如"我的 OpenAI GPT-4"
4. **验证配置** - 保存后测试一下生成功能，确保配置正确









