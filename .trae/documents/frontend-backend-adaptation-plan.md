# 前端适配后端新改动计划

## 概述

后端对文案数据结构进行了调整，前端需要适配以下改动：

1. 编辑框回显数据源从 `copy_blocks` 改为 `visible_copy_slots`
2. `regenerateCopy` 流程需要补充 `PUT /copy` 调用

***

## 改动清单

### 1. 编辑框回显：用 `visible_copy_slots` 替换 `copy_blocks`

**影响接口：**

* `GET /sessions/{id}/results`

* `GET /sessions/{id}/detail-pages/results`

**新增字段格式：**

```json
{
  "asset_id": "...",
  "copy_blocks": {
    "headline": "十四五国家重点出版物",
    "supporting": "...",
    "proof_lines": []
  },
  "visible_copy_slots": [
    {"slot": "headline", "text": "十四五国家重点出版物"},
    {"slot": "supporting", "text": "十四五国家重点出版物"},
    {"slot": "proof_1", "text": "杨卫民等多位行业权威专家著"},
    {"slot": "proof_2", "text": "科学出版社学术出版精品"},
    {"slot": "proof_3", "text": "深度解析3D复印领域核心技术"}
  ]
}
```

**字段映射规则：**

| visible\_copy\_slots\[].slot | 对应编辑框          |
| ---------------------------- | -------------- |
| headline                     | 主标题输入框         |
| supporting                   | 副标题输入框         |
| proof\_1 \~ proof\_4         | 标签/卖点输入框（按顺序）  |
| matrix\_1 \~ matrix\_3       | 矩阵文案输入框（按顺序）   |
| 主标题 / 副标题 / 标签1 等            | 编辑流显式标签（优先级更高） |

**需要修改的文件：**

#### 1.1 `client/src/lib/api.ts`

* 在 `SessionResultAsset` 接口中新增 `visible_copy_slots` 字段

* 在 `normalizeSessionResults` 函数中保留 `visible_copy_slots` 数据

#### 1.2 `client/src/lib/mainGalleryCopy.ts`

* 新增 `VisibleCopySlot` 类型定义

* 新增 `visibleCopySlotsToCopyBlocks` 函数：将 `visible_copy_slots` 数组转换为 `MainGalleryCopyBlocks` 对象

* 修改 `resolveMainGalleryAssetCopy` 函数：优先使用 `visible_copy_slots` 构建 `copyBlocks`，如果没有则回退到原来的 `copy_blocks`

#### 1.3 `client/src/pages/create/ResultStep.tsx`

* `ResultAssetView` 类型中新增 `visible_copy_slots` 字段

* `buildViewAssets` 函数中从 asset 提取 `visible_copy_slots` 并传入

* 编辑框回显逻辑：点击"修改"时，使用 `visible_copy_slots` 按 slot 名映射到各个输入框

* 如果 `visible_copy_slots` 为空，保持原有回退逻辑

#### 1.4 `client/src/pages/create/HDResultStep.tsx`

* `PreviewImage` 类型中新增 `visible_copy_slots` 字段

* `buildPreviewImages` 函数中从 asset 提取 `visible_copy_slots`

* 编辑框回显逻辑改为从 `visible_copy_slots` 映射

#### 1.5 `client/src/pages/create/DetailResultStep.tsx`

* `DetailPanel` 类型中新增 `visible_copy_slots` 字段

* `normalizeDetailResults` 函数中保留 `visible_copy_slots`

* `DetailImage` 类型中新增 `visible_copy_slots` 字段

* 编辑框回显逻辑改为从 `visible_copy_slots` 映射

* 注意：详情图的字段映射略有不同（包含 bullet\_points, cta\_line 等）

### 2. 编辑提交：结构不变

**说明：** `POST /assets/{id}/edit-text` 的请求体仍是 `copy_blocks` 格式（`{headline, supporting, proof_lines, matrix_lines}`），后端会将它们转为结构化标签再生成。

**结论：** 提交逻辑无需修改，保持现有 `copy_blocks` 结构即可。

### 3. regenerateCopy 必须调 PUT /copy

**当前流程问题：**

```
POST /copy/regenerate → job_id
轮询 GET /copy/regenerate/{job_id} → generated_fields
缺少：PUT /copy ← 必须！否则不生效
```

**需要修改的文件：**

#### 3.1 `client/src/lib/api.ts`

* `regenerateCopy` 函数保持 `POST /sessions/{sessionId}/copy/regenerate` 不变

* 确认 `saveCopy` 函数使用 `PUT /sessions/{sessionId}/copy` 方法正确

#### 3.2 `client/src/pages/create/CopywritingStep.tsx`

* `loadOrGenerateCopy` 函数：在获取生成结果后，调用 `sessionAPI.saveCopy(sessionId, result)` 保存

* `forceRegenerateCopy` 函数：同样在获取结果后调用 `saveCopy`

#### 3.3 `client/src/pages/create/StrategyStep.tsx`

* 在 `regenerateCopy` 和 `getCopy` 之后，确保调用 `saveCopy` 保存文案

* 当前代码在生成后已经调用了 `saveCopy`，但需要确认逻辑完整性

### 4. 不需要改动的部分

* `POST /assets/{id}/edit-text` 接口签名不变

* 生图触发流程不变

* 策略预览/覆盖接口不变

***

## 实施步骤

### 步骤 1：修改 API 类型定义 (`api.ts`)

* [ ] 在 `SessionResultAsset` 接口添加 `visible_copy_slots?: Array<{slot: string; text: string}> | null`

* [ ] 在 `normalizeSessionResults` 中保留该字段

### 步骤 2：新增工具函数 (`mainGalleryCopy.ts`)

* [ ] 定义 `VisibleCopySlot` 类型

* [ ] 实现 `visibleCopySlotsToCopyBlocks` 转换函数

* [ ] 实现 `visibleCopySlotsToDetailCopyBlocks` 转换函数（详情图用）

* [ ] 修改 `resolveMainGalleryAssetCopy` 优先使用 `visible_copy_slots`

### 步骤 3：修改主图结果页 (`ResultStep.tsx`)

* [ ] 更新 `ResultAssetView` 类型

* [ ] 更新 `buildViewAssets` 函数

* [ ] 修改编辑框初始化逻辑，从 `visible_copy_slots` 映射

### 步骤 4：修改高清结果页 (`HDResultStep.tsx`)

* [ ] 更新 `PreviewImage` 类型

* [ ] 更新 `buildPreviewImages` 函数

* [ ] 修改编辑框初始化逻辑

### 步骤 5：修改详情图结果页 (`DetailResultStep.tsx`)

* [ ] 更新 `DetailPanel` 和 `DetailImage` 类型

* [ ] 更新 `normalizeDetailResults` 函数

* [ ] 修改编辑框初始化逻辑

### 步骤 6：验证 regenerateCopy 流程

* [ ] 确认 `CopywritingStep.tsx` 和 `StrategyStep.tsx` 中生成后都调用了 `saveCopy`

* [ ] 确认 `saveCopy` 使用的是 `PUT` 方法

### 步骤 7：测试验证

* [ ] 检查 TypeScript 类型错误

* [ ] 运行构建验证

