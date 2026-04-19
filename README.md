# SmartPhoto - AI电商做图平台 (AI E-commerce Image Studio)

SmartPhoto 是一款专注于电商领域的 AI 智能做图与营销物料生成平台。通过集成先进的 AI 视觉识别、抠图去底、图像生成与大语言模型，帮助跨境以及国内电商卖家一键生成高质量的产品主图、白底图、详情页及营销文案。

## 🌟 核心特性 (Key Features)

平台提供完整的 9 步智能生成工作流：

1. **智能图片上传与识别**：支持多角度实拍图上传，AI 自动进行产品类型分析与拍摄角度识别（支持正面、侧面、45°、顶部等角度）。
2. **AI 智能抠图转白底**：自动提取产品主体，一键移除背景，生成电商标准白底图，并提供前后对比预览。
3. **多平台智能适配**：支持 1688、阿里国际站、淘宝、抖音、TikTok、亚马逊等 12 个主流电商平台，自动适配不同平台的图片规格与风格要求。
4. **产品参数智能提取**：支持上传产品说明书(PDF)或参数截图，AI 自动提取关键卖点、核心性能（如 CADR、噪音等级、尺寸等）。
5. **AI 营销文案生成**：根据产品图与参数自动生成平台适配的主图文案与详情页结构文案。
6. **电商场景图生成**：一键生成符合产品特性的电商场景图、卖点图与结构图。
7. **可插拔 AI 服务**：采用适配器模式设计底层的 AI 视觉与图像生成服务，支持快速对接不同的 AI 供应商。
8. **移动端优先与销售型 UI**：经过专业设计的销售导向 UI 界面（移动端优先），内置详情页独立付费链路（Paywall）与智能化等待动效设计。

## 🛠️ 技术栈 (Tech Stack)

### 前端 (Frontend)
- **框架**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **路由**: [wouter](https://github.com/molefrog/wouter)
- **样式**: [Tailwind CSS 4](https://tailwindcss.com/)
- **组件库**: [Radix UI](https://www.radix-ui.com/) (无头组件)
- **状态管理 & 数据**: [@tanstack/react-query](https://tanstack.com/query/latest) + [tRPC Client](https://trpc.io/)

### 后端 (Backend)
- **服务层**: [Express](https://expressjs.com/) + [tRPC Server](https://trpc.io/)
- **数据库**: MySQL / PostgreSQL 兼容数据库 + [Drizzle ORM](https://orm.drizzle.team/)
- **文件存储**: AWS S3 兼容协议 (`@aws-sdk/client-s3`)

## 🚀 快速开始 (Getting Started)

### 环境要求
- Node.js >= 18
- pnpm >= 8

### 安装依赖

项目使用 `pnpm` 进行包管理。由于项目中锁定并部分 patch 了依赖引用，推荐使用 pnpm 确保依赖一致性。

```bash
# 全局安装 pnpm (如果尚未安装)
npm install -g pnpm

# 安装项目依赖
pnpm install
```

### 环境变量配置

复制环境配置文件示例并填写你的本地或开发环境配置：

```bash
# 复制示例环境变量文件
cp .env.example .env.local
```

你需要配置的核心环境变量通常包括：
- 数据库连接字符串
- AI 服务的 API Keys 和供应商设置
- AWS S3 相关配置 (Access Key, Secret Key, Bucket Name)

### 运行开发环境

```bash
# 启动本地开发服务器与后端服务 (同时启动)
pnpm run dev
```
启动后可以通过终端提示的 URL 访问本地开发环境（如：`http://localhost:5173`）。

### 构建生产版本

```bash
# 类型检查
pnpm run check

# 构建前端静态产物与后端代码
pnpm run build

# 预览生产版本
pnpm run start
```

## 📁 核心目录结构 (Directory Structure)

```text
SmartPhoto/
├── client/                 # 前端 React 源代码
│   ├── src/
│   │   ├── components/     # 全局复用 UI 组件与步骤条
│   │   ├── lib/            # 工具函数与共享逻辑 (如 wait-state 计算等)
│   │   ├── pages/          # 页面路由级组件 (包含核心的9步AI工作流拆解)
│   │   └── App.tsx         # 前端应用入口与路由总配置
├── server/                 # 后端 Express + tRPC 源代码
│   ├── ai/                 # AI 服务适配器(Adapters)与大模型、生图业务逻辑
│   ├── routes.ts           # tRPC Router 定义与 API 业务逻辑
│   └── ...
├── drizzle/                # 数据库 Schema 迁移与生成记录
├── docs/                   # 项目说明与参考文档
├── package.json            # 项目依赖与各类 NPM Scripts
├── UI_PLAN.md              # 销售型 UI 改造计划与详情说明
└── todo.md                 # 详细的开发进度清单与 TODO(待办事项)
```

## 📄 协议与授权 (License)

[MIT License](LICENSE)
