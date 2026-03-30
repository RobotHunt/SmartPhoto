import type {
  MainGalleryCopyBlocks,
  PromptPreviewItem,
  SessionResultAsset,
  StrategyOverrideItem,
} from "@/lib/api";

export const EMPTY_MAIN_GALLERY_COPY_BLOCKS: MainGalleryCopyBlocks = {
  headline: "",
  supporting: "",
  proof_lines: [],
  matrix_lines: [],
};

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
  asset: Pick<SessionResultAsset, "role" | "slot_id" | "display_order">,
  prompts: PromptPreviewItem[],
  overrides: StrategyOverrideItem[],
): {
  slotId: string | null;
  copyBlocks: MainGalleryCopyBlocks;
} {
  const matchedPrompt = findMatchingPromptPreview(asset, prompts);
  const matchedOverride = findMatchingStrategyOverride(asset, prompts, overrides);
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
