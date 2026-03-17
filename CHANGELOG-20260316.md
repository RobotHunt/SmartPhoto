# 静态化改造记录 — 2026-03-16

> 目标：将 ai-ecommerce-image-studio 从全栈项目（React + Express + tRPC + MySQL）改为**纯静态前端**，不接真实 API，使用假数据跑通完整流程，部署到 GitHub + 阿里云 ESA。

---

## 一、改动文件清单

共修改 **10 个文件**，新建 **2 个文件**（含本文件）。

| 序号 | 文件路径 | 改动类型 |
|------|---------|---------|
| 1 | `client/src/main.tsx` | 重写 |
| 2 | `client/src/_core/hooks/useAuth.ts` | 重写 |
| 3 | `client/src/pages/create/UploadStep.tsx` | 局部替换 |
| 4 | `client/src/pages/create/AnalyzeStep.tsx` | 局部替换 |
| 5 | `client/src/pages/create/CopywritingStep.tsx` | 局部替换 |
| 6 | `client/src/pages/Account.tsx` | 局部替换 |
| 7 | `client/src/pages/ProjectDetail.tsx` | 局部替换 |
| 8 | `client/src/pages/Home.tsx` | 多处替换 |
| 9 | `vite.config.ts` | 重写 |
| 10 | `package.json` | 局部替换 |
| 新建 | `esa-deploy-guide.md` | 阿里云 ESA 部署指南 |
| 新建 | `CHANGELOG-20260316.md` | 本文件 |

> 所有原始代码均以 `/* ... */` 或 `//` 注释保留，并标注 `[2026-03-16 静态化改造]` + 修改目标，方便日后恢复。

---

## 二、逐文件改动详情

### 1. `client/src/main.tsx` — 移除 tRPC Provider

**位置**：全文

**注释掉的内容**：
- `import { trpc }` / `import { UNAUTHED_ERR_MSG }` / `import { httpBatchLink, TRPCClientError }` / `import superjson` / `import { getLoginUrl }`
- `redirectToLoginIfUnauthorized()` 函数及 queryClient 的 error subscribe 逻辑（原第 13-38 行）
- `trpcClient` 创建（原第 40-53 行）
- `<trpc.Provider>` 包裹渲染（原第 55-61 行）

**替换为**：
- 仅保留 `QueryClient` + `QueryClientProvider`
- 渲染结构：`<QueryClientProvider> → <App />`

---

### 2. `client/src/_core/hooks/useAuth.ts` — Mock 认证

**位置**：全文

**注释掉的内容**：
- `import { trpc }` / `import { TRPCClientError }` / `import { getLoginUrl }`
- 原 `useAuth()` 函数体：`trpc.auth.me.useQuery()` / `trpc.auth.logout.useMutation()` / `redirectOnUnauthenticated` 逻辑

**替换为**：
- 硬编码 `MOCK_USER = { id: 1, name: "演示用户", email: "demo@example.com", openId: "demo-static-user" }`
- `useAuth()` 始终返回 `{ user: MOCK_USER, loading: false, isAuthenticated: true }`
- `logout()` 直接 `window.location.href = "/"`

---

### 3. `client/src/pages/create/UploadStep.tsx` — Mock 上传

**注释掉的内容**：
- 第 6 行：`import { trpc } from "@/lib/trpc"`
- 第 65 行：`const uploadImageMutation = trpc.project.uploadImage.useMutation()`
- 原 `handleStartAnalysis()` 函数（第 124-170 行）：循环调用 `uploadImageMutation.mutateAsync()` 上传图片到 S3

**替换为**：
- 新 `handleStartAnalysis()`：直接取每张图片的 base64 preview 作为 URL 存入 sessionStorage
- 额外写入 `sessionStorage.setItem("firstUploadedImageUrl", uploadedUrls[0])` 供下一步使用

---

### 4. `client/src/pages/create/AnalyzeStep.tsx` — Mock AI 识别

**注释掉的内容**：
- 第 13 行：`import { trpc } from "@/lib/trpc"`
- 第 56 行：`const analyzeImageMutation = trpc.project.analyzeImage.useMutation()`
- `useEffect` 内 timer 回调（原第 72-110 行）：调用 `analyzeImageMutation.mutateAsync({ imageUrl })` 识别图片

**替换为**：
- 纯同步 mock：2.5 秒动画后直接返回假数据
- `mockResult = { imageType: "实物图", productName: "空气净化器", productCategory, suggestions: [...] }`
- 保留原有 `getMockCandidates()` / `getMockSceneTags()` 辅助函数（未改动）

---

### 5. `client/src/pages/create/CopywritingStep.tsx` — Mock 文案生成

**注释掉的内容**：
- 第 9 行：`import { trpc } from "@/lib/trpc"`
- 第 91-109 行：`const generateMutation = trpc.project.generateDetailCopy.useMutation({...})` 及 `onSuccess` / `onError` 回调
- 第 111-120 行：`useEffect` 内 `generateMutation.mutate({...})`
- 第 122 行：`const isLoading = generateMutation.isPending`
- 第 245-258 行：错误重试区域引用 `generateMutation.isError` / `generateMutation.mutate()`

**替换为**：
- 新增 `const [isLoading, setIsLoading] = useState(true)` / `const [genError, setGenError] = useState(false)`
- `useEffect` 内 2 秒 `setTimeout` 后设置 6 模块硬编码假文案：
  - `product_display`：宠物家庭专研空气净化器
  - `core_selling_point`：宠物毛发专用吸附技术
  - `function_description`：四重过滤系统
  - `product_details`：匠心工艺
  - `usage_scenarios`：多场景守护
  - `product_parameters`：规格参数
- 错误重试按钮改为 `window.location.reload()`

---

### 6. `client/src/pages/Account.tsx` — Mock 登出

**注释掉的内容**：
- 第 8 行：`import { trpc } from "@/lib/trpc"`
- 第 22-26 行：`const logout = trpc.auth.logout.useMutation({ onSuccess: ... })`

**替换为**：
- `const logout = { mutate: () => { window.location.href = "/"; }, isPending: false }`

---

### 7. `client/src/pages/ProjectDetail.tsx` — Mock 项目数据

**注释掉的内容**：
- 第 6 行：`import { trpc } from "@/lib/trpc"`
- 第 13-21 行：`trpc.project.get.useQuery()` / `trpc.project.getImages.useQuery()`

**替换为**：
- `projectLoading = false` / `imagesLoading = false`
- 硬编码 `project` 对象（空气净化器示例数据）
- 硬编码 `images` 数组（4 张 `/examples/` 目录下的示例图）

---

### 8. `client/src/pages/Home.tsx` — 简化 CTA + 修复头像链接

**改动 A — CTA 区域**（第 406 行）

**注释掉的内容**：
- `<Link href={user ? "/create/upload" : getLoginUrl()}>`

**替换为**：
- `<Link href="/create/upload">`（静态模式下不判断登录状态）

**改动 B — 顶部导航栏头像链接 + JSX 语法修复**（第 74-96 行）

**问题 1**：原代码 `<Link href="/profile">` 指向 `/profile`，但 App.tsx 路由表中不存在该路由，点击后显示 404。

**问题 2（语法错误修复）**：此区域之前的修改在 JSX 三元表达式 `{user ? ( ... ) : ( ... )}` 内部混用了两种非法注释写法：
- 在 `(` 后紧跟 `{/* JSX注释 */}`（三元表达式分支内第一个元素不能是注释块）
- 在 JSX 子元素位置使用 `// 单行注释`（JSX 内部不支持 `//` 注释）

这导致 TypeScript 报出 59 个连锁语法错误（JSX 元素无结束标记、意外的标记、找不到名称等）。

**注释掉的内容**：
- 原第 74-96 行整个三元表达式块（含有语法错误的版本）

**替换为**：
- 注释移到三元表达式**外部**（使用 `{/* ... */}` 包裹）
- `user ? <Link href="/account">...</Link>` — 头像指向 `/account`
- `: <Link href="/create/upload">...</Link>` — 未登录跳转到上传页
- TypeScript 检查零报错，构建成功

---

### 9. `vite.config.ts` — 移除服务端插件

**注释掉的内容**：
- `import { vitePluginManusRuntime } from "vite-plugin-manus-runtime"`
- `import fs from "node:fs"` / `import type { Plugin, ViteDevServer }`
- 整个 `vitePluginManusDebugCollector()` 函数定义（约 80 行）
- 原 plugins 数组：`[react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector()]`
- `server.allowedHosts` 中的 Manus 专用域名

**替换为**：
- `const plugins = [react(), tailwindcss(), jsxLocPlugin()]`
- `allowedHosts` 仅保留 `localhost` / `127.0.0.1`

---

### 10. `package.json` — 简化构建命令

**注释掉的内容**（以 `_comment_xxx_original` 字段保留原始值）：

| 命令 | 原值 | 新值 |
|------|------|------|
| `dev` | `cross-env NODE_ENV=development tsx watch server/_core/index.ts` | `vite` |
| `build` | `vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist` | `vite build` |
| `start` | `cross-env NODE_ENV=production node dist/index.js` | `vite preview` |
| `db:push` | `drizzle-kit generate && drizzle-kit migrate` | 已移除（以注释字段记录原值） |

**新增**：
- `"preview": "vite preview"`

---

### 11. `client/src/pages/create/StrategyStep.tsx` — 已撤销修改，恢复原样

此文件曾被修改（取消自动倒计时），但属于误改——原始自动倒计时 5 秒跳转是甲方 Manus 的设计意图。已完全恢复为原始代码，无任何改动。

---

### 12. 补回缺失的原始代码注释

检查发现 `Home.tsx` 两处修改点虽然标注了改动说明，但**原始代码没有以注释块保留**。已补回：

- **第 74-90 行（头像链接区域）**：补回原始 `<Link href="/profile">` + `<a href={getLoginUrl()}>` 完整 JSX 注释块
- **第 419 行（CTA 按钮）**：补回原始 `<Link href={user ? "/create/upload" : getLoginUrl()}>` 注释行

---

### 13. 新建 `esa-deploy-guide.md`

阿里云 ESA 部署完整指南，包含：
- OSS 源站 / GitHub Pages 源站两种方案
- SPA 路由回退配置（URL 重写 / 自定义错误页面）
- 缓存规则（静态资源长缓存、index.html 不缓存）
- HTTPS 配置
- GitHub Actions CI/CD 自动部署示例

---

## 三、构建验证结果

```
$ pnpm build

vite v7.1.9 building for production...
✓ 1747 modules transformed.
✓ built in 7.10s

产出目录 dist/public/：
├── index.html            (0.96 kB)
├── assets/index-xxx.css  (152 kB)
├── assets/index-xxx.js   (1,105 kB)
├── examples/             (示例图片)
├── platforms/             (平台 logo)
└── ...
```

构建成功，无报错。

---

## 四、后续运行命令

### 本地开发

```bash
# 安装依赖（首次或依赖变更后执行）
pnpm install

# 启动开发服务器（热更新）
pnpm dev

# 访问 http://localhost:5173
```

### 构建静态文件

```bash
# 构建
pnpm build

# 构建产出目录
# dist/public/
```

### 本地预览构建结果

```bash
# 方式一：vite preview
pnpm preview
# 访问 http://localhost:4173

# 方式二：任意静态服务器
npx serve dist/public
# 访问 http://localhost:3000
```

### 推送到 GitHub

```bash
# 初始化 git（如果还没有）
git init
git add .
git commit -m "feat: 静态化改造，移除后端依赖，使用 mock 数据跑通全流程"

# 关联远程仓库
git remote add origin https://github.com/<用户名>/<仓库名>.git
git push -u origin main
```

### 部署到阿里云 ESA

详见 `esa-deploy-guide.md`，核心步骤：

```bash
# 1. 构建
pnpm build

# 2. 上传到 OSS（如果用 OSS 源站方案）
ossutil cp -r dist/public/ oss://<bucket-name>/ --update --force

# 3. 在 ESA 控制台配置 SPA 回退规则（见指南 Step 4）
```

---

## 五、如何恢复原始全栈版本

所有原始代码均以注释形式保留在文件中，搜索 `[2026-03-16 静态化改造]` 即可定位所有改动点。

恢复步骤：
1. 取消注释原始代码块
2. 删除或注释掉 mock 替换代码
3. 恢复 `package.json` 中的原始 scripts
4. 恢复 `vite.config.ts` 中的 Manus 插件
5. 确保 `.env` 中的数据库和 AI Provider 配置正确
6. 运行 `pnpm db:push` 初始化数据库
7. 运行 `pnpm dev` 启动全栈服务
