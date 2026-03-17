# 阿里云 ESA (边缘安全加速) 部署指南

> [2026-03-16] 本项目已改为纯静态前端，以下是部署到阿里云 ESA 的完整步骤。

---

## 一、前置准备

### 1. 本地构建静态文件

```bash
pnpm install
pnpm build
```

构建产出目录：`dist/public/`，包含 `index.html` + JS/CSS/图片等静态资源。

### 2. 推送到 GitHub

```bash
git init
git add .
git commit -m "静态化改造：纯前端版本"
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

---

## 二、阿里云 ESA 配置步骤

### Step 1：开通 ESA 服务

1. 登录 [阿里云控制台](https://esa.console.aliyun.com/)
2. 搜索"ESA 边缘安全加速"并开通
3. 进入 ESA 控制台

### Step 2：添加站点

1. 点击「添加站点」
2. 输入你的域名（例如 `demo.yourdomain.com`）
3. 选择套餐（免费版即可用于测试）
4. 按提示修改域名 DNS 的 NS 记录（指向阿里云 ESA 的 NS 服务器）

### Step 3：配置源站

选择「源站配置」，设置回源方式：

**方案 A：使用 OSS 作为源站（推荐）**

1. 创建一个 OSS Bucket（例如 `ai-ecommerce-static`）
2. 将 `dist/public/` 目录上传到 Bucket 根目录：
   ```bash
   # 安装 ossutil
   # https://help.aliyun.com/document_detail/120075.html
   ossutil cp -r dist/public/ oss://ai-ecommerce-static/ --update
   ```
3. ESA 源站配置：
   - 源站类型：OSS 域名
   - OSS Bucket 域名：`ai-ecommerce-static.oss-cn-hangzhou.aliyuncs.com`

**方案 B：使用 GitHub Pages 作为源站**

1. 在 GitHub 仓库设置 GitHub Pages（源为 `gh-pages` 分支）
2. ESA 源站配置：
   - 源站类型：自定义域名
   - 回源地址：`<你的用户名>.github.io`
   - 回源 Host：`<你的用户名>.github.io`

### Step 4：配置 SPA 路由回退（关键）

由于是单页应用（SPA），所有前端路由（如 `/create/upload`）都需要返回 `index.html`。

**方法：通过「转换规则」配置 URL 重写**

进入 ESA 控制台 → 你的站点 → 「规则引擎」或「转换规则」：

```
规则名称：SPA 路由回退
匹配条件：URI 路径 不匹配 正则 \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|json|webp|mp4)$
执行动作：URL 重写 → 重写到 /index.html
```

或者用「自定义错误页面」方式：

```
错误码：404
处理方式：返回指定页面
页面路径：/index.html
响应状态码：200
```

### Step 5：配置缓存规则

进入「缓存配置」：

```yaml
# 静态资源长缓存（JS/CSS 带 hash，可以长期缓存）
规则1:
  匹配: 文件后缀 = js, css, woff, woff2, ttf
  缓存时间: 365 天

# 图片缓存
规则2:
  匹配: 文件后缀 = png, jpg, jpeg, gif, svg, webp, ico
  缓存时间: 30 天

# index.html 不缓存（确保更新即时生效）
规则3:
  匹配: URI 路径 = /index.html
  缓存时间: 不缓存
```

### Step 6：开启 HTTPS

进入「SSL/TLS」配置：

1. 选择「申请免费证书」或上传你自己的证书
2. 开启「强制 HTTPS 跳转」
3. 最低 TLS 版本选择 TLS 1.2

### Step 7：验证部署

1. 等待 DNS 生效（通常 5-10 分钟）
2. 访问 `https://demo.yourdomain.com`
3. 测试前端路由：访问 `https://demo.yourdomain.com/create/upload` 确认不会 404
4. 走完整流程：首页 → 上传 → AI 识别 → 选平台 → 参数 → 文案 → 生成

---

## 三、CI/CD 自动部署（可选）

### GitHub Actions 自动构建+上传 OSS

在仓库创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to Aliyun OSS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install
      - run: pnpm build

      - name: Upload to OSS
        uses: manyuanrong/setup-ossutil@v3.0
        with:
          endpoint: oss-cn-hangzhou.aliyuncs.com
          access-key-id: ${{ secrets.OSS_ACCESS_KEY_ID }}
          access-key-secret: ${{ secrets.OSS_ACCESS_KEY_SECRET }}

      - run: ossutil cp -r dist/public/ oss://ai-ecommerce-static/ --update --force
```

需要在 GitHub 仓库 Settings → Secrets 中添加：
- `OSS_ACCESS_KEY_ID`
- `OSS_ACCESS_KEY_SECRET`

---

## 四、常见问题

### Q: 访问子路由 404？
A: SPA 路由回退没配置。参考 Step 4 配置 URL 重写或自定义错误页面。

### Q: 资源加载失败（JS/CSS 404）？
A: 检查 `vite.config.ts` 中的 `base` 配置。如果部署在子目录下，需要设置 `base: '/子目录/'`。

### Q: 更新后用户看到旧版本？
A: 检查 `index.html` 的缓存配置，确保设为不缓存。JS/CSS 文件名带 hash，新版本自动使用新文件名。

---

## 五、目录结构（构建产出）

```
dist/public/
├── index.html          # 入口文件
├── assets/
│   ├── index-xxxxx.js  # 主 JS bundle
│   └── index-xxxxx.css # 主 CSS bundle
├── examples/           # 示例图片
│   ├── air-purifier.jpg
│   ├── air-purifier-white.jpg
│   ├── 2.jpg
│   └── 3.jpg
├── platforms/           # 平台 logo
└── ...                  # 其他静态资源
```
