const ASSET_LABELS: Record<string, string> = {
  hero: "主图",
  primary_kv: "核心主图",
  white_bg: "白底图",
  scene: "场景图",
  usage_scene: "使用场景图",
  usage_scenes: "使用场景图",
  selling_point: "卖点图",
  feature: "功能图",
  structure: "结构图",
  detail: "详情图",
  reason_why: "购买理由图",
  proof_authority: "权威背书图",
  comparison: "对比图",
  parameter_board: "参数信息图",
  mechanism_illustration: "原理说明图",
  scene_reconstruction: "场景重建图",
};

function containsChinese(text: string) {
  return /[\u4e00-\u9fff]/.test(text);
}

function inferLabel(raw: string) {
  const normalized = raw.toLowerCase();

  if (normalized.includes("primary") || normalized.includes("kv")) return "核心主图";
  if (normalized.includes("proof") || normalized.includes("authority")) return "权威背书图";
  if (normalized.includes("reason")) return "购买理由图";
  if (normalized.includes("white")) return "白底图";
  if (normalized.includes("scene")) return "场景图";
  if (normalized.includes("sell")) return "卖点图";
  if (normalized.includes("feature")) return "功能图";
  if (normalized.includes("structure")) return "结构图";
  if (normalized.includes("detail")) return "详情图";
  if (normalized.includes("compare")) return "对比图";
  if (normalized.includes("parameter")) return "参数信息图";
  if (normalized.includes("mechanism")) return "原理说明图";

  return "主图";
}

export function resolveAssetLabel(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const raw = String(value || "").trim();
    if (!raw) continue;
    if (containsChinese(raw)) return raw;
    if (ASSET_LABELS[raw]) return ASSET_LABELS[raw];
    return inferLabel(raw);
  }

  return "主图";
}
