# Smart Excalidraw

> **用自然语言，绘制专业图表**

Smart Excalidraw 是一个基于 AI 的智能图表生成工具，通过自然语言描述即可生成专业的 Excalidraw 图表。项目采用前后端分离架构，前端使用 Next.js，后端使用 Python FastAPI，集成了多种大语言模型提供商。

## ✨ 核心特性

### 🎯 AI 驱动，效果出众
- 通过先进的大语言模型理解你的需求，生成结构清晰、布局合理的专业级图表
- 支持多种 LLM 提供商：OpenAI、Anthropic、Google、Mistral 等
- 支持多模态输入：文本描述 + 图片识别

### 🔗 独创连接算法
- 采用智能箭头优化算法，自动计算最佳连接点
- 确保图表井然有序、逻辑清晰，告别混乱的线条交叉
- 自动布局优化，元素间距智能调整

### 📊 丰富图表类型
- 支持 20+ 种图表类型，包括：
  - 流程图 (Flowchart)
  - 架构图 (Architecture)
  - 时序图 (Sequence)
  - ER 图 (ER Diagram)
  - 思维导图 (Mind Map)
  - 网络拓扑图 (Network Topology)
  - 等等...
- AI 可根据描述自动选择最合适的图表类型

### 🎨 完美 Excalidraw 集成
- 生成的图表完全基于 Excalidraw 格式
- 可以在画布上自由编辑、调整样式、添加细节
- 实现 AI 生成与手动精修的完美结合

### ⚡ 开箱即用
- 只需配置一个 AI API 密钥即可开始使用
- 所有配置保存在本地，隐私安全有保障
- 支持流式响应，实时查看生成进度

### 🤖 多智能体系统
- **规划智能体**：分析用户需求，制定生成计划
- **生成智能体**：根据规划生成 Excalidraw 代码
- **优化智能体**：优化代码布局，调整元素间距
- **验证智能体**：验证 JSON 格式，检查必填字段

## 🏗️ 技术架构

### 前端技术栈
- **Next.js 16** - React 框架
- **React 19** - UI 库
- **Excalidraw** - 图表绘制引擎
- **Tailwind CSS 4** - 样式框架
- **Monaco Editor** - 代码编辑器

### 后端技术栈
- **FastAPI** - 高性能异步 Web 框架
- **Langchain** - LLM 应用开发框架
- **Pydantic** - 数据验证
- **NetworkX** - 图布局算法
- **SSE (Server-Sent Events)** - 流式响应

### 项目结构

```
Smart-Excalidraw/
├── frontend/                 # Next.js 前端
│   ├── app/                  # Next.js App Router
│   ├── components/           # React 组件
│   ├── lib/                  # 工具函数
│   └── public/               # 静态资源
├── backend/                  # Python FastAPI 后端
│   ├── app/
│   │   ├── api/v1/          # API 路由
│   │   ├── core/            # 核心功能
│   │   │   ├── agents/      # Langchain 智能体
│   │   │   ├── llm/         # LLM 客户端
│   │   │   ├── excalidraw/  # Excalidraw 处理
│   │   │   └── layout/      # 布局引擎
│   │   ├── models/          # 数据模型
│   │   └── utils/           # 工具函数
│   └── data/                # 数据文件
└── docs/                     # 文档
```

## 🚀 快速开始

### 前置要求

- **Node.js** >= 18.0.0
- **Python** >= 3.9
- **pnpm** 或 **npm** 或 **yarn**
- 一个 LLM API 密钥（OpenAI、Anthropic、Google 等）

### 1. 克隆项目

```bash
git clone https://github.com/AXY520/Smart-Excalidraw.git
cd Smart-Excalidraw
```

### 2. 启动后端服务

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

后端服务将在 `http://localhost:8000` 启动。

### 3. 启动前端服务

```bash
cd frontend
pnpm install
pnpm dev
```

前端服务将在 `http://localhost:3000` 启动。

### 4. 配置 LLM

1. 在浏览器中打开 `http://localhost:3000`
2. 点击右上角的 **"配置 LLM"** 按钮
3. 选择提供商类型（OpenAI、Anthropic、Google 等）
4. 填入你的 API Key
5. 选择模型（推荐使用 `claude-sonnet-4.5`，效果最佳）
6. 保存配置

### 5. 开始使用

在输入框中用自然语言描述你的需求，例如：
- "画一个用户登录的流程图"
- "创建一个微服务架构图，包含网关、认证服务和业务服务"
- "设计一个电商系统的数据库 ER 图"

AI 会自动生成图表，你可以在画布上直接编辑和调整。

## 📖 详细文档

### 开发文档

- [前后端集成指南](INTEGRATION.md) - 前后端集成详细说明
- [后端实现总结](BACKEND_IMPLEMENTATION.md) - 后端架构和功能说明
- [Excalidraw API 文档](docs/excalidraw-skeleton-api-zh.md) - Excalidraw 元素 API 参考

### 前端文档

- [前端 README](frontend/README.md) - 前端详细说明
- [API 集成文档](frontend/API_INTEGRATION.md) - API 集成说明
- [配置同步文档](frontend/CONFIG_SYNC.md) - 配置同步机制

### 后端文档

- [Ollama/Qwen 设置指南](backend/docs/ollama-qwen-setup.md) - 本地模型设置
- [模型输入指南](backend/docs/model-input-guide.md) - 模型输入格式说明

## 🔧 配置说明

### 后端配置

后端配置通过环境变量或 `.env` 文件管理：

```bash
# .env 文件示例
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
HOST=0.0.0.0
PORT=8000
LOG_LEVEL=INFO
MCP_ENABLED=true
MCP_SERVER_URL=http://localhost:3002
```

### 前端配置

前端配置保存在浏览器本地存储中，通过 UI 界面进行管理。也可以直接编辑 `frontend/data/llm-configs.json` 文件。

## 📡 API 文档

### 生成图表

**POST** `/api/v1/generate`

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
  "currentCode": null,
  "stream": true
}
```

**响应格式（SSE）：**

```
event: plan
data: {"analysis": "...", "chartType": "flowchart", ...}

event: progress
data: {"stage": "generating", "message": "正在生成...", "progress": 50}

event: chunk
data: {"content": "..."}

event: done
data: {"code": "[...]", "optimized": true, "validation_passed": true}
```

### 获取模型列表

**GET** `/api/v1/models?type=openai&baseUrl=...&apiKey=...`

### 配置管理

**GET** `/api/v1/config` - 获取配置

**POST** `/api/v1/config` - 保存配置

详细 API 文档请访问：`http://localhost:8000/docs`（Swagger UI）

## 🛠️ 开发指南

### 本地开发

#### 同时运行前后端

**终端 1 - 前端：**
```bash
cd frontend
pnpm dev
```

**终端 2 - 后端：**
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

### 代码规范

**前端：**
- 使用 ESLint 进行代码检查
- 遵循 React Hooks 最佳实践

**后端：**
- 使用 Black 进行代码格式化
- 使用 Ruff 进行代码检查
- 使用 MyPy 进行类型检查

### 测试

```bash
# 后端测试
cd backend
pytest

# 前端测试（待实现）
cd frontend
pnpm test
```

## 🐳 Docker 部署

### 使用 Docker Compose

```bash
docker-compose up -d
```

### 单独构建

**前端：**
```bash
cd frontend
docker build -t smart-excalidraw-frontend .
docker run -p 3000:3000 smart-excalidraw-frontend
```

**后端：**
```bash
cd backend
docker build -t smart-excalidraw-backend .
docker run -p 8000:8000 smart-excalidraw-backend
```

## ❓ 常见问题

### Q: 推荐使用哪个 AI 模型？

A: 强烈推荐使用 **claude-sonnet-4.5**，它在理解需求和生成图表方面表现最佳。GPT-4 和 Gemini Pro 也是不错的选择。

### Q: 数据安全吗？

A: 所有配置信息仅保存在你的浏览器本地（前端）或本地文件系统（后端），不会上传到任何第三方服务器。只有你配置的 LLM API 会收到请求。

### Q: 支持哪些图表类型？

A: 支持流程图、架构图、时序图、ER 图、思维导图、网络拓扑图等 20+ 种类型，AI 会自动选择最合适的类型。

### Q: 生成的图表可以修改吗？

A: 当然可以！生成后可以在 Excalidraw 画布上自由编辑，包括调整位置、修改样式、添加元素等。所有修改都会实时同步到代码编辑器。

### Q: 如何修改已生成的图表？

A: 在修改模式下，你可以描述想要修改的内容，AI 会基于当前图表进行修改，而不是重新生成。

### Q: 支持图片输入吗？

A: 是的，支持上传图片，AI 可以识别图片内容并生成相应的图表。

### Q: 后端服务无法启动？

A: 请检查：
1. Python 版本 >= 3.9
2. 已安装所有依赖：`pip install -r requirements.txt`
3. 端口 8000 未被占用
4. 查看日志输出获取详细错误信息

### Q: 前端无法连接后端？

A: 请检查：
1. 后端服务是否正在运行
2. 前端配置的后端 URL 是否正确
3. CORS 配置是否包含前端地址
4. 浏览器控制台是否有错误信息

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 贡献方向

- 🐛 修复 Bug
- ✨ 添加新功能
- 📝 完善文档
- 🎨 优化 UI/UX
- ⚡ 性能优化
- 🔧 代码重构

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

- [Excalidraw](https://excalidraw.com/) - 强大的绘图工具
- [Langchain](https://www.langchain.com/) - LLM 应用开发框架
- [FastAPI](https://fastapi.tiangolo.com/) - 现代 Web 框架
- [Next.js](https://nextjs.org/) - React 框架

## 📮 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 [Issue](https://github.com/AXY520/Smart-Excalidraw/issues)
- 发送 Pull Request

---

**用 AI 的力量，让图表绘制变得简单！** 🚀

