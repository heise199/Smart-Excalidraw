# 快速修复指南

## 问题 1: ModuleNotFoundError: No module named 'sse_starlette'

**解决方案：**
```bash
pip install sse-starlette
```

## 问题 2: ImportError: cannot import name 'ChatMistral'

**已修复！** Mistral 现在使用 OpenAI 兼容的 API，不再需要 `langchain-mistralai`。

如果已安装该包，可以卸载：
```bash
pip uninstall langchain-mistralai mistralai
```

## 完整安装步骤

```bash
# 1. 进入后端目录
cd backend

# 2. 安装所有依赖
pip install -r requirements.txt

# 3. 如果遇到版本冲突，可以尝试
pip install --upgrade -r requirements.txt

# 4. 启动服务
uvicorn app.main:app --reload --port 8000
```

## 验证安装

```bash
# 测试导入
python -c "from app.main import app; print('✅ 导入成功')"
```

如果看到 "✅ 导入成功"，说明所有依赖都已正确安装。

## 主要变更

1. **Mistral 支持** - 现在使用 OpenAI 兼容的 API，不再依赖 `langchain-mistralai`
2. **所有提供商统一** - 都支持从 API 获取模型列表，失败时允许手动输入





