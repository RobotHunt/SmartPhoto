import type {
  MainGalleryCopyBlocks,
  PromptPreviewItem,
  SessionResultAsset,
  StrategyOverrideItem,
  VisibleCopySlot,
  DetailCopyBlocks,
  TextElement,
} from "@/lib/api";

export const EMPTY_MAIN_GALLERY_COPY_BLOCKS: MainGalleryCopyBlocks = {
  headline: "",
  supporting: "",
  proof_lines: [],
  matrix_lines: [],
};

// ────────────────────────────────────────────────────────────
//  v2.2.0 unified edit field system
// ────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  headline: "主标题",
  supporting: "副标题",
  label: "标签",
};

export function fieldRoleLabel(role: string): string {
  return ROLE_LABELS[role] || role;
}

function visibleCopySlotsToEditFields(slots: VisibleCopySlot[]): TextElement[] {
  return slots.map((s) => {
    const slot = s.slot;
    if (slot === "headline") return { id: "headline", role: "headline", text: s.text };
    if (slot === "supporting") return { id: "supporting", role: "supporting", text: s.text };
    const labelMatch = slot.match(/^label_(.+)$/);
    if (labelMatch) return { id: labelMatch[1], role: "label", text: s.text };
    return { id: slot, role: "label", text: s.text };
  });
}

function copyBlocksToEditFields(cb: MainGalleryCopyBlocks | null | undefined): TextElement[] {
  const fields: TextElement[] = [];
  const blocks = cb || EMPTY_MAIN_GALLERY_COPY_BLOCKS;
  if (blocks.headline) fields.push({ id: "h", role: "headline", text: blocks.headline });
  if (blocks.supporting) fields.push({ id: "s", role: "supporting", text: blocks.supporting });
  (blocks.proof_lines || []).forEach((t, i) => {
    if (t) fields.push({ id: `p${i}`, role: "label", text: t });
  });
  (blocks.matrix_lines || []).forEach((t, i) => {
    if (t) fields.push({ id: `m${i}`, role: "label", text: t });
  });
  return fields;
}

function detailCopyBlocksToEditFields(cb: DetailCopyBlocks | null | undefined): TextElement[] {
  const fields: TextElement[] = [];
  if (!cb) return fields;
  if (cb.headline) fields.push({ id: "h", role: "headline", text: cb.headline });
  if (cb.supporting) fields.push({ id: "s", role: "supporting", text: cb.supporting });
  (cb.bullet_points || []).forEach((t, i) => {
    if (t) fields.push({ id: `b${i}`, role: "label", text: t });
  });
  (cb.proof_lines || []).forEach((t, i) => {
    if (t) fields.push({ id: `p${i}`, role: "label", text: t });
  });
  (cb.matrix_lines || []).forEach((t, i) => {
    if (t) fields.push({ id: `m${i}`, role: "label", text: t });
  });
  if (cb.cta_line) fields.push({ id: "cta", role: "label", text: cb.cta_line });
  return fields;
}

export function getEditFields(asset: {
  text_elements?: TextElement[] | null;
  visible_copy_slots?: VisibleCopySlot[] | null;
  copy_blocks?: MainGalleryCopyBlocks | null;
}): TextElement[] {
  if (asset.text_elements?.length) return asset.text_elements;
  if (asset.visible_copy_slots?.length) return visibleCopySlotsToEditFields(asset.visible_copy_slots);
  return copyBlocksToEditFields(asset.copy_blocks);
}

export function getDetailEditFields(asset: {
  text_elements?: TextElement[] | null;
  visible_copy_slots?: VisibleCopySlot[] | null;
  copy_blocks?: DetailCopyBlocks | null;
}): TextElement[] {
  if (asset.text_elements?.length) return asset.text_elements;
  if (asset.visible_copy_slots?.length) return visibleCopySlotsToEditFields(asset.visible_copy_slots);
  return detailCopyBlocksToEditFields(asset.copy_blocks);
}

export function fieldsToCopyBlocks(fields: TextElement[]): MainGalleryCopyBlocks {
  return {
    headline: fields.find((f) => f.role === "headline")?.text || "",
    supporting: fields.find((f) => f.role === "supporting")?.text || "",
    proof_lines: fields.filter((f) => f.role === "label").map((f) => f.text),
    matrix_lines: [],
  };
}

export function fieldsToDetailCopyBlocks(fields: TextElement[]): DetailCopyBlocks | null {
  if (!fields.length) return null;
  return {
    headline: fields.find((f) => f.role === "headline")?.text || "",
    supporting: fields.find((f) => f.role === "supporting")?.text || "",
    bullet_points: [],
    proof_lines: fields.filter((f) => f.role === "label").map((f) => f.text),
    matrix_lines: [],
    cta_line: "",
  };
}

export function updateFieldById(fields: TextElement[], id: string, text: string): TextElement[] {
  return fields.map((f) => (f.id === id ? { ...f, text } : f));
}

export function fieldsTotalLength(fields: TextElement[]): number {
  return fields.reduce((sum, f) => sum + (f.text?.length || 0), 0);
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

export function normalizeMainGalleryCopyBlocks(value: unknown): MainGalleryCopyBlocks {
  if (!value || typeof value !== "object") {
    return { ...EMPTY_MAIN_GALLERY_COPY_BLOCKS };
  }

  const raw = value as Record<string, unknown>;
  return {
    headline: normalizeText(raw.headline),
    supporting: normalizeText(raw.supporting),
    proof_lines: normalizeTextList(raw.proof_lines),
    matrix_lines: normalizeTextList(raw.matrix_lines),
  };
}

export function visibleCopySlotsToDetailCopyBlocks(slots: VisibleCopySlot[] | null | undefined): DetailCopyBlocks | null {
  if (!slots || slots.length === 0) return null;

  return {
    headline: slots[0]?.text || "",
    supporting: slots[1]?.text || "",
    bullet_points: [],
    proof_lines: [],
    matrix_lines: slots.slice(2).map((s) => s.text).filter(Boolean),
    cta_line: "",
  };
}

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
    proof_lines: [],
    matrix_lines: matrixLines,
  };
}

export function copyBlocksToVisibleSlots(copyBlocks: MainGalleryCopyBlocks | null | undefined): VisibleCopySlot[] {
  const slots: VisibleCopySlot[] = [];
  const blocks = copyBlocks || EMPTY_MAIN_GALLERY_COPY_BLOCKS;
  if (blocks.headline) slots.push({ slot: "headline", text: blocks.headline });
  if (blocks.supporting) slots.push({ slot: "supporting", text: blocks.supporting });
  for (const line of blocks.proof_lines || []) {
    if (line) slots.push({ slot: `proof_${slots.length}`, text: line });
  }
  for (const line of blocks.matrix_lines || []) {
    if (line) slots.push({ slot: `matrix_${slots.length}`, text: line });
  }
  return slots;
}

export function detailCopyBlocksToVisibleSlots(copyBlocks: DetailCopyBlocks | null | undefined): VisibleCopySlot[] {
  const slots: VisibleCopySlot[] = [];
  if (!copyBlocks) return slots;
  if (copyBlocks.headline) slots.push({ slot: "headline", text: copyBlocks.headline });
  if (copyBlocks.supporting) slots.push({ slot: "supporting", text: copyBlocks.supporting });
  for (const line of copyBlocks.bullet_points || []) {
    if (line) slots.push({ slot: `bullet_${slots.length}`, text: line });
  }
  for (const line of copyBlocks.proof_lines || []) {
    if (line) slots.push({ slot: `proof_${slots.length}`, text: line });
  }
  for (const line of copyBlocks.matrix_lines || []) {
    if (line) slots.push({ slot: `matrix_${slots.length}`, text: line });
  }
  if (copyBlocks.cta_line) slots.push({ slot: "cta_line", text: copyBlocks.cta_line });
  return slots;
}

export function ensureVisibleSlots(
  visibleSlots: VisibleCopySlot[] | null | undefined,
  copyBlocks: MainGalleryCopyBlocks | null | undefined,
): VisibleCopySlot[] {
  if (visibleSlots && visibleSlots.length > 0) return visibleSlots;
  return copyBlocksToVisibleSlots(copyBlocks);
}

export function ensureDetailVisibleSlots(
  visibleSlots: VisibleCopySlot[] | null | undefined,
  copyBlocks: DetailCopyBlocks | null | undefined,
): VisibleCopySlot[] {
  if (visibleSlots && visibleSlots.length > 0) return visibleSlots;
  return detailCopyBlocksToVisibleSlots(copyBlocks);
}

export function updateSlotText(
  slots: VisibleCopySlot[] | null | undefined,
  index: number,
  text: string,
): VisibleCopySlot[] {
  const list = slots && slots.length > 0 ? [...slots] : [];
  while (list.length <= index) {
    list.push({ slot: `slot_${list.length}`, text: "" });
  }
  list[index] = { ...list[index], text };
  return list;
}

export function getSlotsTotalLength(slots: VisibleCopySlot[] | null | undefined): number {
  if (!slots) return 0;
  return slots.reduce((sum, s) => sum + (s.text?.length || 0), 0);
}

export function copyLinesToTextarea(lines: string[]): string {
  return lines.join("\n");
}

export function textareaToCopyLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function matchesByRoleAndDisplayOrder(
  asset: Pick<SessionResultAsset, "role" | "display_order">,
  prompt: Pick<PromptPreviewItem, "role" | "display_order">,
): boolean {
  return asset.role === prompt.role && asset.display_order === prompt.display_order;
}

export function findMatchingPromptPreview(
  asset: Pick<SessionResultAsset, "role" | "slot_id" | "display_order">,
  prompts: PromptPreviewItem[],
): PromptPreviewItem | null {
  if (asset.slot_id) {
    const matchedBySlot = prompts.find((item) => item.slot_id === asset.slot_id);
    if (matchedBySlot) return matchedBySlot;
  }

  const matchedByRoleAndOrder = prompts.find((item) => matchesByRoleAndDisplayOrder(asset, item));
  if (matchedByRoleAndOrder) return matchedByRoleAndOrder;

  const sameRole = prompts.filter((item) => item.role === asset.role);
  return sameRole.length === 1 ? sameRole[0] : null;
}

export function resolveStrategyOverrideSlotId(
  asset: Pick<SessionResultAsset, "role" | "slot_id" | "display_order">,
  prompts: PromptPreviewItem[],
): string | null {
  const matchedPrompt = findMatchingPromptPreview(asset, prompts);
  return matchedPrompt?.slot_id || asset.slot_id || asset.role || null;
}

export function findMatchingStrategyOverride(
  asset: Pick<SessionResultAsset, "role" | "slot_id" | "display_order">,
  prompts: PromptPreviewItem[],
  overrides: StrategyOverrideItem[],
): StrategyOverrideItem | null {
  const slotId = resolveStrategyOverrideSlotId(asset, prompts);
  if (!slotId) return null;
  return overrides.find((item) => item.slot_id === slotId) || null;
}

export function resolveMainGalleryAssetCopy(
  asset: Pick<SessionResultAsset, "role" | "slot_id" | "display_order" | "visible_copy_slots">,
  prompts: PromptPreviewItem[],
  overrides: StrategyOverrideItem[],
): {
  slotId: string | null;
  copyBlocks: MainGalleryCopyBlocks;
} {
  const matchedPrompt = findMatchingPromptPreview(asset, prompts);
  const matchedOverride = findMatchingStrategyOverride(asset, prompts, overrides);

  if (asset.visible_copy_slots && asset.visible_copy_slots.length > 0) {
    return {
      slotId: matchedPrompt?.slot_id || asset.slot_id || asset.role || null,
      copyBlocks: visibleCopySlotsToCopyBlocks(asset.visible_copy_slots),
    };
  }

  return {
    slotId: matchedPrompt?.slot_id || asset.slot_id || asset.role || null,
    copyBlocks: normalizeMainGalleryCopyBlocks(
      matchedOverride?.copy_blocks_override ?? matchedPrompt?.copy_blocks,
    ),
  };
}

function isCopyBlocksEmpty(copyBlocks: MainGalleryCopyBlocks): boolean {
  return !(
    copyBlocks.headline ||
    copyBlocks.supporting ||
    copyBlocks.proof_lines.length > 0 ||
    copyBlocks.matrix_lines.length > 0
  );
}

export function upsertStrategyOverride(
  overrides: StrategyOverrideItem[],
  slotId: string,
  copyBlocks: MainGalleryCopyBlocks,
): StrategyOverrideItem[] {
  const existing = overrides.find((item) => item.slot_id === slotId);
  const remaining = overrides.filter((item) => item.slot_id !== slotId);

  if (isCopyBlocksEmpty(copyBlocks) && !existing) {
    return overrides;
  }

  const nextOverride: StrategyOverrideItem = {
    slot_id: slotId,
    copy_blocks_override: copyBlocks,
    raw_prompt_override: existing?.raw_prompt_override ?? null,
    expression_mode_override: existing?.expression_mode_override ?? null,
    applied_preset_id: existing?.applied_preset_id ?? null,
    locked: existing?.locked ?? false,
  };

  return [...remaining, nextOverride];
}
