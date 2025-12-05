# 模型配置前后端联动说明

## 概述

前后端模型配置和选择已完全联动，所有配置操作都通过后端 API 进行，确保数据一致性。

## 联动机制

### 1. 配置加载

**页面加载时：**
```javascript
// app/page.js
useEffect(() => {
  loadConfigs(); // 从后端加载所有配置
}, []);
```

**配置模态框打开时：**
```javascript
// components/ConfigModal.jsx
useEffect(() => {
  if (isOpen) {
    loadConfigs(); // 从后端加载最新配置
  }
}, [isOpen]);
```

### 2. 配置保存

**保存新配置或更新配置：**
```javascript
// components/ConfigModal.jsx
const handleSave = async () => {
  // 1. 保存到后端
  await saveProvider(config, true);
  // 2. 重新加载配置列表
  await loadConfigs();
  // 3. 获取最新配置并通知父组件
  const savedConfig = await getConfig();
  onSave(savedConfig);
};
```

**流程：**
1. 用户填写配置并点击保存
2. 前端调用 `saveProvider()` → 后端 API `/api/v1/config`
3. 后端保存到文件
4. 前端重新加载配置列表
5. 前端获取当前配置并更新 UI

### 3. 配置切换

**在页面头部切换配置：**
```javascript
// app/page.js
onClick={async () => {
  // 1. 保存到后端
  await setCurrentProvider(provider.id);
  // 2. 重新加载配置
  await loadConfigs();
  // 3. 获取最新配置并更新 UI
  const currentConfig = await getConfig();
  setConfig(currentConfig);
}}
```

**在配置模态框中切换：**
```javascript
// components/ConfigModal.jsx
const handleSetCurrentProvider = async (providerId) => {
  // 1. 保存到后端
  await setCurrentProvider(providerId);
  // 2. 重新加载配置列表
  await loadConfigs();
  // 3. 通知父组件刷新
  const currentConfig = await getConfig();
  onSave(currentConfig);
};
```

### 4. 配置删除

```javascript
// components/ConfigModal.jsx
const handleDeleteProvider = async (providerId) => {
  // 1. 删除并保存到后端
  await deleteProvider(providerId);
  // 2. 重新加载配置列表
  await loadConfigs();
  // 3. 如果删除的是当前配置，通知父组件刷新
  if (allConfigs.currentProviderId === providerId) {
    const newConfig = await getConfig();
    onSave(newConfig);
  }
};
```

### 5. 模型列表加载

```javascript
// components/ConfigModal.jsx
const handleLoadModels = async () => {
  // 调用后端 API 获取模型列表
  const { fetchModels } = await import('@/lib/api-client');
  const models = await fetchModels(config.type, config.baseUrl, config.apiKey);
  setModels(models);
};
```

**流程：**
1. 用户点击"加载可用模型"
2. 前端调用 `fetchModels()` → 后端 API `/api/v1/models`
3. 后端从提供商 API 获取模型列表
4. 前端显示模型列表或手动输入框

## API 端点

### GET /api/v1/config
获取所有配置和当前提供商 ID

**响应：**
```json
{
  "providers": [
    {
      "id": "provider_123",
      "name": "My OpenAI",
      "type": "openai",
      "baseUrl": "https://api.openai.com/v1",
      "apiKey": "sk-...",
      "model": "gpt-4"
    }
  ],
  "currentProviderId": "provider_123"
}
```

### POST /api/v1/config
保存配置

**请求：**
```json
{
  "providers": [...],
  "currentProviderId": "provider_123"
}
```

### GET /api/v1/models
获取可用模型列表

**查询参数：**
- `type`: 提供商类型
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

## 数据流

```
用户操作
  ↓
前端组件 (ConfigModal/page.js)
  ↓
lib/config.js (业务逻辑)
  ↓
lib/api-client.js (API 调用)
  ↓
后端 API (/api/v1/config, /api/v1/models)
  ↓
后端存储 (JSON 文件)
  ↓
前端重新加载配置
  ↓
UI 更新
```

## 关键特性

### 1. 实时同步
- 所有配置操作立即保存到后端
- 操作后自动重新加载配置
- UI 始终显示最新状态

### 2. 错误处理
- API 调用失败时显示错误信息
- 配置验证失败时阻止保存
- 网络错误时提供友好提示

### 3. 配置验证
- 必填字段检查（type, baseUrl, model）
- Ollama 不需要 API key
- 其他提供商需要 API key

### 4. 模型选择
- 自动从 API 获取模型列表
- 获取失败时允许手动输入
- 支持从列表选择或手动输入

## 使用示例

### 添加新配置

1. 打开配置模态框
2. 填写提供商信息
3. 点击"加载可用模型"（可选）
4. 选择或输入模型名称
5. 点击"保存"
6. 配置自动保存到后端并成为当前配置

### 切换配置

1. 点击页面头部的配置名称
2. 从下拉列表中选择其他配置
3. 配置自动切换并保存到后端

### 编辑配置

1. 打开配置模态框
2. 切换到"管理配置"标签
3. 点击要编辑的配置
4. 修改配置信息
5. 点击"保存"
6. 配置自动更新到后端

## 注意事项

1. **配置持久化** - 所有配置保存在后端 `data/llm-configs.json`
2. **当前配置** - 只有一个配置可以作为当前配置
3. **模型验证** - 模型名称在生成时验证，不在保存时验证
4. **API 密钥** - Ollama 不需要 API key，其他提供商需要
5. **错误处理** - 所有 API 调用都有错误处理

## 故障排查

### 配置无法保存
- 检查后端服务是否运行
- 检查网络连接
- 查看浏览器控制台错误信息

### 配置无法加载
- 检查后端 API 是否正常
- 检查配置文件是否存在
- 查看后端日志

### 模型列表无法加载
- 检查 API 密钥是否正确
- 检查基础 URL 是否正确
- 检查网络连接
- 某些提供商可能不支持模型列表 API，需要手动输入









