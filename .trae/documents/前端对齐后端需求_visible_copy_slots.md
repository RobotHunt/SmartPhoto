# 前端对齐后端需求计划：copy_blocks → visible_copy_slots

## 背景

后端接口 `GET /sessions/{id}/results` 和 `GET /sessions/{id}/detail-pages/results` 的每个 asset 新增 `visible_copy_slots` 字段。前端编辑框的数据源需要从 `copy_blocks` 切换为 `visible_copy_slots`。

`visible_copy_slots` 格式：
```json
[
  {"slot": "headline",     "text": "高效净化99.9%"},
  {"slot": "supporting",   "text": "宠物家庭客厅"},
  {"slot": "proof_1",      "text": "CADR值 380m³/h"},
  {"slot": "proof_2",      "text": "母婴级安全"}
]
```

**关键约束**：前端不需要关心 slot 名字——按数组顺序映射到编辑框的输入框即可（第0个→主标题，第1个→副标题，第2+个→标签）。

**不需要改的**：
- `POST /assets/{id}/edit-text` 请求体不变（还是传 `copy_blocks` 格式）
- `POST /copy/regenerate` 流程不变
- `POST /regenerate`、`POST /generate` 不变
- `PUT /strategy/overrides` 不变

---

## 现状分析

### 1. 主图结果页（ResultStep.tsx）

- `ResultAssetView` 类型已包含 `visible_copy_slots?: VisibleCopySlot[] | null`
- `buildViewAssets()` 通过 `resolveMainGalleryAssetCopy()` 将 `visible_copy_slots` 映射为 `copy_blocks`
- 编辑面板直接读取 `asset.copy_blocks.headline/supporting/proof_lines/matrix_lines`
- 用户修改后更新 `copy_blocks`，保存时：
  1. `upsertStrategyOverride(strategyOverrides, slotId, asset.copy_blocks)` → 存入策略覆盖
  2. `assetAPI.editAssetText(assetId, asset.copy_blocks)` → 调 edit-text 接口

### 2. 高清结果页（HDResultStep.tsx）

- `PreviewImage` 类型已包含 `visible_copy_slots?: VisibleCopySlot[] | null`
- `buildPreviewImages()` 同样通过 `resolveMainGalleryAssetCopy()` 映射
- 编辑面板直接读取 `img.copy_blocks.*`
- 保存逻辑与 ResultStep 相同

### 3. 详情图结果页（DetailResultStep.tsx）

- `DetailImage` 类型已包含 `visible_copy_slots?: VisibleCopySlot[] | null`
- `normalizeDetailResults()` 已解析 `visible_copy_slots`
- 但编辑面板直接读取 `img.copy_blocks?.headline/supporting/bullet_points/proof_lines/matrix_lines/cta_line`
- 保存时直接传 `img.copy_blocks` 给 `assetAPI.editDetailAssetText()`
- **注意**：详情图目前没有从 `visible_copy_slots` 到 `copy_blocks` 的映射逻辑

### 4. 核心映射函数（mainGalleryCopy.ts）

已有 `visibleCopySlotsToCopyBlocks()` 函数，按 slot name 映射：
- `slot === "headline"` → `headline`
- `slot === "supporting"` → `supporting`
- `/^proof_\d+$/` → `proof_lines[]`
- `/^matrix_\d+$/` → `matrix_lines[]`

---

## 计划步骤

### 步骤 1：修改主图映射逻辑 —— 按数组顺序映射（不再按 slot name）

**文件**：`client/src/lib/mainGalleryCopy.ts`

**修改 `visibleCopySlotsToCopyBlocks()`**：

当前实现按 slot name 判断（`headline`/`supporting`/`proof_\d+`/`matrix_\d+`）。根据新需求，改为**按数组顺序映射**：
- `slots[0]` → 主标题 (`headline`)
- `slots[1]` → 副标题 (`supporting`)
- `slots[2..n-1]` → 标签短句 (`matrix_lines[]`)

> 注意：需求说"第2+个→标签"，原 `proof_lines` 概念在新规则下可能不再独立存在。需要确认：
> - 旧版有 `proof_lines` 和 `matrix_lines` 两个数组
> - 新版按顺序映射后，第2+个全部进 `matrix_lines`
> - `proof_lines` 是否保留为空数组？还是和 `matrix_lines` 合并？

**建议实现**：
```typescript
export function visibleCopySlotsToCopyBlocks(slots: VisibleCopySlot[] | null | undefined): MainGalleryCopyBlocks {
  if (!slots || slots.length === 0) {
    return { ...EMPTY_MAIN_GALLERY_COPY_BLOCKS };
  }

  const headline = slots[0]?.text || "";
  const supporting = slots[1]?.text || "";
  const matrixLines = slots.slice(2).map((s) => s.text).filter(Boolean);

  return {
    headline,
    supporting,
    proof_lines: [], // 新规则下 proof_lines 不再从 visible_copy_slots 映射
    matrix_lines: matrixLines,
  };
}
```

**影响范围**：
- `ResultStep.tsx` 的 `buildViewAssets()`
- `HDResultStep.tsx` 的 `buildPreviewImages()`
- 这两个地方都调用 `resolveMainGalleryAssetCopy()`，最终会调用 `visibleCopySlotsToCopyBlocks()`

---

### 步骤 2：新增详情图 visible_copy_slots → copy_blocks 映射

**文件**：`client/src/pages/create/DetailResultStep.tsx`（或新建工具函数）

当前详情图编辑面板直接读取 `img.copy_blocks`，没有利用 `visible_copy_slots`。

**需要新增映射函数**（可放在 DetailResultStep.tsx 内或 mainGalleryCopy.ts 中）：

```typescript
function visibleCopySlotsToDetailCopyBlocks(slots: VisibleCopySlot[] | null | undefined): DetailCopyBlocks | null {
  if (!slots || slots.length === 0) return null;

  return {
    headline: slots[0]?.text || "",
    supporting: slots[1]?.text || "",
    bullet_points: [], // 详情图新规则下，bullet_points 是否也从 slots 映射？需要确认
    proof_lines: [],
    matrix_lines: slots.slice(2).map((s) => s.text).filter(Boolean),
    cta_line: "",
  };
}
```

> **待确认**：详情图的 `bullet_points` 和 `cta_line` 在新规则下如何映射？需求文档只给了4个 slot 的示例，但详情图有6个字段。

**修改 `fetchDetailResults()` 中的 `setImages`**：

当前：
```typescript
copy_blocks: panel.copy_blocks,
```

改为优先使用 `visible_copy_slots` 映射：
```typescript
copy_blocks: panel.visible_copy_slots && panel.visible_copy_slots.length > 0
  ? visibleCopySlotsToDetailCopyBlocks(panel.visible_copy_slots)
  : panel.copy_blocks,
```

---

### 步骤 3：确认编辑框保存逻辑无需改动

根据需求，以下接口**保持不变**：

1. `POST /assets/{id}/edit-text` 请求体仍是 `{ copy_blocks: {...}, instruction: null }`
2. `POST /copy/regenerate` 流程不变
3. `POST /regenerate`、`POST /generate` 不变
4. `PUT /strategy/overrides` 不变

**验证点**：
- `ResultStep.tsx` 的 `saveAssetText()` 调用 `assetAPI.editAssetText(assetId, asset.copy_blocks)` ✅ 不变
- `HDResultStep.tsx` 的 `saveText()` 同样调用 `assetAPI.editAssetText()` ✅ 不变
- `DetailResultStep.tsx` 的 `saveText()` 调用 `assetAPI.editDetailAssetText(id, img.copy_blocks)` ✅ 不变
- `upsertStrategyOverride()` 仍存 `copy_blocks_override` ✅ 不变

---

### 步骤 4：处理旧 session 的 fallback

需求说明："旧 session 通过 fallback 解析也能拿到数据，但新 session 质量更好"。

当前 `resolveMainGalleryAssetCopy()` 已有 fallback 逻辑：
```typescript
if (asset.visible_copy_slots && asset.visible_copy_slots.length > 0) {
  return { slotId, copyBlocks: visibleCopySlotsToCopyBlocks(asset.visible_copy_slots) };
}
// fallback 到 copy_blocks
return { slotId, copyBlocks: normalizeMainGalleryCopyBlocks(matchedOverride?.copy_blocks_override ?? matchedPrompt?.copy_blocks) };
```

这个 fallback 逻辑**已经正确**，不需要修改。只需确保 `visibleCopySlotsToCopyBlocks()` 按新规则实现即可。

详情图的 fallback 需要在 `fetchDetailResults()` 中实现（见步骤2）。

---

### 步骤 5：类型与接口确认

**文件**：`client/src/lib/api.ts`

`VisibleCopySlot` 类型已存在：
```typescript
export interface VisibleCopySlot {
  slot: string;
  text: string;
}
```

`SessionResultAsset` 已包含：
```typescript
visible_copy_slots?: VisibleCopySlot[] | null;
```

详情图 API 返回的 panel 也已包含 `visible_copy_slots`（在 `normalizeDetailResults()` 中解析）。

**无需新增类型**。

---

## 修改文件清单

| 文件 | 修改内容 | 优先级 |
|------|---------|--------|
| `client/src/lib/mainGalleryCopy.ts` | 重写 `visibleCopySlotsToCopyBlocks()` 为按数组顺序映射 | 高 |
| `client/src/pages/create/DetailResultStep.tsx` | 新增 `visibleCopySlotsToDetailCopyBlocks()`，修改 `fetchDetailResults()` 优先使用 visible_copy_slots | 高 |
| `client/src/pages/create/ResultStep.tsx` | 无需修改（已通过 resolveMainGalleryAssetCopy 使用） | - |
| `client/src/pages/create/HDResultStep.tsx` | 无需修改（同上） | - |
| `client/src/lib/api.ts` | 无需修改（类型已存在） | - |

---

## 待确认问题

1. **主图的 `proof_lines` 在新规则下如何处理？**
   - 需求说"第2+个→标签"，是否意味着 `proof_lines` 和 `matrix_lines` 合并？
   - 还是 `proof_lines` 保留为空数组，只填充 `matrix_lines`？

2. **详情图的 `bullet_points` 和 `cta_line` 如何映射？**
   - 详情图有6个字段，但 visible_copy_slots 示例只有4个
   - `bullet_points` 和 `cta_line` 是否也从 slots 映射？还是保留原 copy_blocks 的值？

3. **slot name 是否还需要保留？**
   - 需求说"前端不需要关心 slot 名字"
   - 但当前 `VisibleCopySlot` 接口有 `slot` 字段，是否需要移除？（建议保留，不影响按顺序映射）

---

## 实施顺序

1. 先确认上述3个待确认问题
2. 修改 `mainGalleryCopy.ts` 中的 `visibleCopySlotsToCopyBlocks()`
3. 修改 `DetailResultStep.tsx` 添加详情图映射
4. 本地测试验证（主图结果页、高清结果页、详情图结果页的编辑框是否正常显示和保存）
