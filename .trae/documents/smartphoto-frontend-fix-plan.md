# SmartPhoto 前端问题修复计划

## 一、计划概述

本计划针对甲方反馈的前端核心问题，按优先级制定修复方案。重点覆盖：移动端显示适配、文案编辑同步、文字修改生效、用户意图执行四大核心链路。

***

## 二、问题根因分析与修复步骤

### 【P0】任务一：移动端底部固定操作栏遮挡修复

**问题描述：**

* "确认卖点，继续"按钮只露出中间部分，左侧文字被遮挡

* "执行高清生成"按钮虽然可见，但页面内容被下方固定区域压住

* 底部按钮与系统导航栏/浏览器底部区域重叠

* 甲方明确反馈"显示不完整，这个也是上次提的"

**根因定位：**

1. `min-h-screen`（即 `100vh`）在移动端浏览器中，当地址栏/底部导航栏动态变化时，会导致实际可视区域溢出
2. 部分页面主体内容的 `padding-bottom` 预留不足，无法完全避开 fixed 底部栏
3. `CopywritingStep.tsx` L373 使用 `pb-28`（112px），但底部栏包含三个按钮（调整方案 + 确认卖点继续 + 分享），实际高度可能超出
4. `DetailResultStep.tsx` 底部栏包含登录提示条 + 操作按钮，双层结构高度未充分预留
5. 横向按钮组在小屏下被压缩，文字截断

**涉及文件：**

* `client/src/pages/create/ResultStep.tsx`

* `client/src/pages/create/CopywritingStep.tsx`

* `client/src/pages/create/DetailResultStep.tsx`

* `client/src/pages/create/ConfirmStep.tsx`

* `client/src/pages/create/HDResultStep.tsx`

* `client/src/index.css`

**具体修复步骤：**

1. **全局 CSS 修复视口高度问题**

   * 在 `index.css` 中，将所有 `min-h-screen` 的页面根容器改为使用 `min-h-[100dvh]`（CSS `dvh` 单位动态适应浏览器地址栏变化）

   * 添加 fallback：`min-h-screen` 作为后备，现代浏览器优先使用 `dvh`

   * 为 body 添加 `padding-bottom: env(safe-area-inset-bottom)`（已有，检查确认生效）

2. **统一底部安全区域处理**

   * 检查所有 fixed bottom 区域是否都包含 `pb-[env(safe-area-inset-bottom)]`

   * `ResultStep.tsx` L1099：已存在，确认无误

   * `CopywritingStep.tsx` L497：已存在，确认无误

   * `DetailResultStep.tsx` L785：已存在，但上方还有一层登录提示条 (L787-805) 也需要处理

3. **增加主体区域底部 padding 预留**

   * `ResultStep.tsx` L788：当前 `pb-44`（176px），底部栏高度约 80-90px + safe-area，确认是否足够，如不足改为 `pb-52` 或 `pb-60`

   * `CopywritingStep.tsx` L373：当前 `pb-28`（112px），底部栏包含三个大按钮（h-14 + padding），实际高度约 90px + safe-area，可能不足，改为 `pb-36` 或 `pb-40`

   * `DetailResultStep.tsx` L646：当前 `pb-36`（144px），底部栏包含登录提示条（约 50px）+ 操作栏（约 80px）+ safe-area，改为 `pb-48` 或 `pb-52`

4. **修复小屏下按钮文字截断**

   * `CopywritingStep.tsx` L507-513："确认卖点，继续"按钮在小屏下文字被压缩

   * 在移动端（< 640px）下，将底部按钮组改为垂直堆叠或缩小字体/内边距

   * 使用 `useIsMobile` hook 检测移动端，动态调整按钮样式

   * 按钮文字添加 `whitespace-nowrap` 防止换行，同时确保容器有足够宽度

5. **安卓浏览器底部导航栏兼容**

   * 为 fixed bottom 栏添加 `@supports (-webkit-touch-callout: none)` 和 `@supports not (-webkit-touch-callout: none)` 的差异化处理

   * 在安卓 Chrome/微信内置浏览器中测试 `dvh` 和 `env(safe-area-inset-bottom)` 的兼容性

***

### 【P0】任务二：图片文案与编辑表单文案同步修复

**问题描述：**

* 图片画面上显示的是："灵敏交互 一触即达 / 顶部触控｜丝滑操控 / 360° 环绕｜净化无死角"

* 点击"修改"后，编辑区显示的是："主标题：360° 全方位大面积进风 / 副标题：外观形状 圆柱型"

* 用户无法判断自己改的是不是图上的内容

**根因定位：**

1. **主图（ResultStep）：** `copy_blocks` 的数据来源是 `promptPreviews` 和 `strategyOverrides`，这些数据来自后端策略系统的"预设文案"，而图片上的实际文字是模型生成整图时自主渲染的，两者可能没有严格同步
2. **详情图（DetailResultStep）：** `img.text` 初始化为 `panel.display_module_title || panel.panel_label`，根本不是图片上的真实标注文字，编辑框里让用户改的是"模块标题"而非"图上文字"
3. 系统存在"参数区文案、编辑区文案、图片实际文案"三套不同来源

**涉及文件：**

* `client/src/pages/create/ResultStep.tsx`

* `client/src/pages/create/DetailResultStep.tsx`

* `client/src/pages/create/HDResultStep.tsx`

* `client/src/lib/mainGalleryCopy.ts`

**具体修复步骤：**

1. **主图文案同步增强（ResultStep）**

   * 在 `toggleEditOpen` 打开编辑面板时，增加显式提示：

     * 在编辑面板顶部添加说明文字："以下文案将用于重新生成图片。当前图片上的文字可能因模型渲染略有差异。"

   * 如果后端 API 支持，优先尝试从 asset 中读取 `actual_displayed_copy` 或类似字段来回显真实文案

   * 检查 `resolveMainGalleryAssetCopy` 函数逻辑，确保 `copy_blocks` 解析优先级正确：`overrides` > `prompts` > asset 原始数据

   * 保存文案后，在重新加载结果时，强制刷新 `promptPreviews` 和 `strategyOverrides`，确保编辑后的文案回显一致

2. **详情图文案同步修复（DetailResultStep）—— 严重问题**

   * 当前 `img.text` 初始化为 `panel_label`，这是错误的

   * 需要后端支持：在 `DetailPanel` 类型中增加 `displayed_text` 或 `overlay_text` 字段，用于存储图片上实际出现的标注文字

   * 如果后端暂无法提供，前端至少应该在编辑框中明确标注："当前编辑的是模块标题，保存后将触发重新生成"

   * 修改 `DetailImage` 类型，增加 `displayed_text?: string` 字段

   * 修改 `normalizeDetailResults` 函数，尝试从 panel 数据中读取图片真实文案（如果后端有提供）

3. **增加文案差异提示**

   * 当编辑框中的文案与图片上显示的文案（如果前端能获取到）存在明显差异时，显示一个温和的提示条：

     * "图片上的文字与当前编辑文案不完全一致，保存后将按编辑框内容重新生成"

   * 这可以管理用户预期，避免"改了等于没改"的感知

***

### 【P0】任务三：点击"修改"后文字修改不生效修复

**问题描述：**

* 用户点击"修改"，编辑了标注文字，但系统没有把修改后的文字应用到图片中

* "这里也是点击修改了之后修改不了文字"

**根因定位：**

1. **主图（ResultStep）：** `saveAssetText` 逻辑看似正确（调用 `assetAPI.editAssetText`），但存在以下隐患：

   * `editAssetText` API 可能只替换文字层，但如果后端没有正确执行或返回错误，前端 toast 只显示"保存失败"，用户可能没注意到

   * 如果 `slotId` 解析失败，会直接 toast 错误但用户可能忽略
2. **详情图（DetailResultStep）：** `saveText` 函数是**严重功能缺失**：

   ```typescript
   const saveText = (id: string) => {
     setImages((prev) => prev.map((img) => (img.id === id ? { ...img, editOpen: false } : img)));
     toast({ title: "文字已保存" });
   };
   ```

   这个函数**完全没有调用任何 API**！只是本地关闭了编辑框并弹了个 toast，图片当然不会变化。

**涉及文件：**

* `client/src/pages/create/DetailResultStep.tsx`（严重）

* `client/src/pages/create/ResultStep.tsx`（隐患优化）

* `client/src/pages/create/HDResultStep.tsx`（隐患优化）

**具体修复步骤：**

1. **修复详情图 saveText（严重缺陷）**

   * 重写 `DetailResultStep.tsx` 的 `saveText` 函数：

     * 关闭编辑框，设置 `isRegenerating: true`

     * 调用 `assetAPI.regenerate(id, ` 修改文字为：${img.text}`)` 或调用 `assetAPI.editAssetText`（如果后端支持详情图文字编辑）

     * poll job 直到完成

     * 调用 `fetchDetailResults(currentVersion)` 刷新结果

     * 设置 `isRegenerating: false`

     * toast "文案修改已生效，图片已重新生成"

   * 如果后端 `assetAPI.editAssetText` 不支持详情图，则使用 `assetAPI.regenerate` 并附带修改 instruction

2. **增强主图 saveAssetText 错误处理**

   * 在 `ResultStep.tsx` 的 `saveAssetText` 中：

     * 在 catch 块中增加更明确的错误提示

     * 如果 `editAssetText` 调用成功但返回的 job 最终失败，需要在 UI 上反馈（当前只 toast"保存失败"）

     * 保存期间禁用编辑框，防止用户重复点击

3. **增强"仅替换文字" vs "智能重排版"的反馈**

   * 点击"仅替换文字"后，如果后端返回 job\_id，显示进度状态（当前只在 asset 卡片上显示"重新生成中..."，但文字编辑的进度不够明显）

   * 考虑在编辑面板内也显示一个小的 loading 状态

***

### 【P0】任务四：用户修改意图未执行修复（如"宠物净化"）

**问题描述：**

* 用户修改主图需求为"宠物净化"，但生成结果仍是普通空气净化器

* 首图文案仍是"360° 环绕净吸，拒绝空气污染"，没有围绕宠物场景展开

**根因定位：**

1. 用户在 `GenerateStep.tsx` 中选择的主题是"宠物家庭"，该主题被保存到 `hero_scene`，但后端在生成时可能没有将该主题正确注入到卖点文案中
2. 用户在 `ResultStep.tsx` 的"重新生成"modal 中输入"宠物净化"，该 instruction 只传给 `assetAPI.regenerate`，但 regenerate 可能只影响图像风格，不影响文案内容
3. 文案生成和图像生成是分离的：文案由 `sessionAPI.regenerateCopy` 生成，图像由 `sessionAPI.generateGallery` 生成。如果用户只修改了图像生成指令，但没有同步更新文案，就会导致"图不对文"

**涉及文件：**

* `client/src/pages/create/GenerateStep.tsx`

* `client/src/pages/create/ResultStep.tsx`

* `client/src/lib/api.ts`

**具体修复步骤：**

1. **主题选择后强制同步更新文案**

   * 在 `GenerateStep.tsx` 中，当用户选择主题（如"宠物家庭"）并点击"生成主图文案"时：

     * 在 `handleNext` 中，除了 `saveParameters`，还应该将 `selectedTheme` 作为 `instruction` 传给 `sessionAPI.regenerateCopy`

     * 确保后端知道当前的核心场景方向

   * 检查 `saveParameters` 的 payload 是否包含 `hero_scene`，确认后端是否正确消费该字段

2. **重绘时同步更新文案 overrides**

   * 在 `ResultStep.tsx` 的 `handleRegen` 中，当用户输入的 instruction 包含明确的文案方向（如"宠物净化"、"强调除甲醛"等）时：

     * 在调用 `assetAPI.regenerate` 之前，先根据 instruction 更新该 asset 的 `copy_blocks`（或至少更新 headline/supporting）

     * 保存新的 `copy_blocks` 到 `strategyOverrides`

     * 然后调用 `assetAPI.regenerate`，并将 instruction 同时传给 `edit_constraints` 或额外参数

   * 这样确保图像生成时，既有视觉方向，也有文案方向

3. **增加文案方向关键词识别**

   * 在前端维护一个关键词映射表：

     ```
     "宠物净化" -> { headline: "宠物家庭专用净化器", supporting: "滤除毛发异味，守护爱宠健康" }
     "除甲醛" -> { headline: "高效除甲醛", supporting: "新居必备，净化甲醛无死角" }
     ```

   * 当用户输入的 instruction 匹配这些关键词时，自动建议或自动填充对应的文案方向到 `copy_blocks`

   * 这可以显著提升"修改等于生效"的感知

4. **明确提示用户修改的影响范围**

   * 在重绘 modal 中增加说明：

     * "重新生成将同时调整图片风格和文案内容。如果只想修改文字，请点击图片下方的【修改】按钮。"

   * 区分"修改图片风格"和"修改图片文字"两个入口的预期

***

### 【P1】任务五："仅替换文字"与"智能重排版"功能边界明确化

**问题描述：**

* 用户不清楚"仅替换文字"和"智能重排版"的区别

* 点击后不知道会发生什么

**涉及文件：**

* `client/src/pages/create/ResultStep.tsx`

* `client/src/pages/create/HDResultStep.tsx`

**具体修复步骤：**

1. **增加按钮说明文案**

   * 在"仅替换文字"和"智能重排版"按钮下方或 tooltip 中增加说明：

     * 仅替换文字："保留当前图片构图，仅将文字替换为您编辑的内容"

     * 智能重排版："根据您的新文案重新计算图片布局和排版，可能改变构图"

   * 在移动端使用简洁的次级文字说明

2. **按钮状态优化**

   * 当文案总长度超过 80 字时（已有提示），自动建议用户使用"智能重排版"

   * 当文案变化不大（仅修改 1-2 个字）时，默认推荐"仅替换文字"

***

### 【P1】任务六：参数提取展示优化（前端部分）

**问题描述：**

* 系统把"外观形状、操作方式、滤芯规格"等基础可见信息当作核心参数

* 缺少 CADR 值、适用面积、除甲醛能力等真正影响卖点的参数

**根因定位：**

* 这主要是后端 AI 提取的问题，但前端在展示时可以优化引导和分类

**涉及文件：**

* `client/src/pages/create/CopywritingStep.tsx`

* `client/src/pages/create/GenerateStep.tsx`

**具体修复步骤：**

1. **优化参数展示分类**

   * 在 `GenerateStep.tsx` 的"核心参数"区域，将参数分为：

     * "基础信息"（外观、操作方式等）

     * "核心性能"（CADR、净化效率、适用面积等，如果后端能提供）

   * 增加提示："如果缺少关键参数，请手动添加或上传产品说明书以提升生成质量"

2. **增加参数示例引导**

   * 在"添加参数"按钮附近，增加常见参数的快捷添加标签：

     * 空气净化器："CADR值"、"适用面积"、"滤芯等级"、"噪音分贝"

     * 根据 `productCategory` 动态显示不同的推荐参数

***

## 三、回归测试清单（必须在真机/模拟器上验证）

### 移动端显示测试

* [ ] iOS Safari：底部"确认卖点，继续"按钮完整显示，无遮挡

* [ ] iOS Safari：底部"执行高清生成"按钮完整显示

* [ ] 安卓 Chrome：底部按钮完整显示，无遮挡

* [ ] 微信内置浏览器：底部按钮完整显示

* [ ] 切换横屏/竖屏后，fixed bottom 栏位置正确

* [ ] 小屏手机（< 375px 宽）：底部按钮文字不被截断

### 文案同步测试

* [ ] 主图生成后，点击"修改"，编辑框中的文案与图片上的文案语义一致（允许模型渲染差异，但核心卖点方向一致）

* [ ] 编辑主图主标题为"宠物净化专用"，保存后重新加载，编辑框回显新文案

* [ ] 详情图点击"修改"，编辑框显示图片上的标注文字（或与图片方向一致的文案）

### 文字修改生效测试

* [ ] 主图点击"仅替换文字"，保存后图片重新生成，新文字体现在图片中

* [ ] 主图点击"智能重排版"，保存后图片重新生成，新文字体现在图片中

* [ ] 详情图点击"修改"，修改标注文字，保存后图片重新生成，新文字体现在图片中

* [ ] 修改失败后，前端正确显示错误提示，不显示"已保存"的误导信息

### 用户意图执行测试

* [ ] 在 GenerateStep 选择"宠物家庭"主题，生成后首图文案包含宠物相关卖点

* [ ] 在 ResultStep 重绘 modal 输入"宠物净化"，生成后图片和文案均体现宠物方向

* [ ] 重绘时同时修改文案和图像风格，两者同步生效

***

## 四、后端配合需求（同步给后端团队）

1. **详情图真实文案回显：** 请在 `getDetailResults` 的 panel 数据中增加 `displayed_text` 或 `overlay_copy` 字段，返回图片上实际渲染的标注文字，供前端编辑框回显。
2. **editAssetText 支持详情图：** 请确认 `/assets/{id}/edit-text` 接口是否支持详情图（detail panel）的文字编辑，如果不支持，前端将降级为 `regenerate`。
3. **主题注入文案生成：** 请确认 `regenerateCopy` 和 `generateGallery` 是否正确消费 `hero_scene` 字段，确保"宠物家庭"等主题能影响卖点文案生成。
4. **参数提取准确性：** 请在参数提取阶段优先识别品类核心性能参数（如空气净化器的 CADR、适用面积、滤芯等级），减少基础外观信息的权重。

***

## 五、实施顺序建议

| 顺序 | 任务                   | 预估影响       | 依赖                   |
| -- | -------------------- | ---------- | -------------------- |
| 1  | 任务一（移动端显示）           | 高，用户体验立即改善 | 无                    |
| 2  | 任务三（详情图 saveText 修复） | 极高，核心功能缺陷  | 无                    |
| 3  | 任务二（文案同步）            | 高，需后端配合    | 后端提供 displayed\_text |
| 4  | 任务四（意图执行）            | 高，需前后端联调   | 后端确认主题注入逻辑           |
| 5  | 任务五（功能边界明确）          | 中，体验优化     | 无                    |
| 6  | 任务六（参数展示）            | 中，前端独立完成   | 无                    |

