# AI 精细化学习规划

基于 Next.js + Electron 的 AI 学习规划工具，支持 Web 和桌面端。自动生成阶段化学习计划、苏格拉底式 AI 教学、多题型检测、间隔复习，数据全部存储在本地 SQLite。

## 技术栈

- **前端**: Next.js 16 + React 19 + TypeScript + Tailwind CSS 4
- **UI 组件**: shadcn/ui + Recharts + React Flow
- **AI**: Vercel AI SDK（支持 OpenAI / Anthropic / DeepSeek）
- **数据库**: SQLite（better-sqlite3，本地存储）
- **桌面端**: Electron 43 + electron-builder

## 环境要求

- **Node.js** >= 18（推荐 20+）
- **pnpm**（推荐）或 npm
- C/C++ 编译工具链（`better-sqlite3` 需要编译原生模块）
  - macOS: `xcode-select --install`
  - Windows: `npm install -g windows-build-tools`
  - Linux: `sudo apt install build-essential python3`

## 本地安装与运行

### 1. 克隆项目

```bash
git clone git@github.com:QIYUEKURONG/ai-learning-planner.git
cd ai-learning-planner
```

### 2. 安装依赖

```bash
pnpm install
# 或
npm install
```

### 3. 启动开发服务

**Web 模式**（浏览器访问 http://localhost:3000）：

```bash
pnpm dev
```

**Electron 桌面模式**（自动启动桌面窗口，端口 3456）：

```bash
pnpm electron:dev
```

### 4. 配置 AI

启动后在**设置页面**配置以下信息：

| 配置项 | 说明 |
|--------|------|
| LLM 提供商 | `openai` / `anthropic` / `deepseek` |
| API Key | 对应提供商的 API 密钥 |
| Base URL | 自定义 API 地址（可选） |
| 模型 | 指定模型名称（可选） |
| Tavily API Key | 增强资源搜索（可选） |

## 构建部署

**Web 生产构建**：

```bash
pnpm build
pnpm start
```

**Electron 桌面打包**：

```bash
pnpm electron:build
# 产物在 dist/ 目录 (.dmg / .exe)
```

## 项目结构

```
├── src/
│   ├── app/              # Next.js 页面 + API 路由
│   ├── components/ui/    # shadcn 组件
│   ├── db/               # SQLite schema + 查询
│   └── lib/              # AI、数据源、工具函数
├── electron/main.js      # Electron 主进程
├── data/                 # SQLite 数据库存储目录
└── scripts/              # 构建辅助脚本
```

## 数据存储

- **开发模式**: `./data/learning-planner.db`
- **Electron 打包后**: `~/Library/Application Support/精细化AI规划/data/`（macOS）
- 所有数据存储在本地，无需外部数据库
