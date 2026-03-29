export type GenerationKind = "main" | "detail";

function containsChinese(text: string) {
  return /[\u4e00-\u9fff]/.test(text);
}

export function resolveGenerationStageText(
  stage: string | null | undefined,
  kind: GenerationKind = "main",
) {
  const raw = String(stage || "").trim();
  if (!raw) {
    return kind === "detail" ? "正在生成详情图" : "正在生成主图";
  }

  if (containsChinese(raw)) {
    return raw;
  }

  const normalized = raw.toLowerCase();

  if (
    normalized.includes("queue") ||
    normalized.includes("pending") ||
    normalized.includes("wait")
  ) {
    return "排队中";
  }

  if (
    normalized.includes("plan") ||
    normalized.includes("strategy") ||
    normalized.includes("preview")
  ) {
    return kind === "detail" ? "正在规划详情图" : "正在校验主图策略";
  }

  if (normalized.includes("analysis") || normalized.includes("extract")) {
    return kind === "detail" ? "正在准备详情图素材" : "正在分析素材";
  }

  if (
    normalized.includes("render") ||
    normalized.includes("generate") ||
    normalized.includes("diffus") ||
    normalized.includes("infer") ||
    normalized.includes("processing") ||
    normalized.includes("running")
  ) {
    return kind === "detail" ? "正在生成详情图" : "正在生成主图";
  }

  if (
    normalized.includes("stitch") ||
    normalized.includes("merge") ||
    normalized.includes("compose")
  ) {
    return kind === "detail" ? "正在拼接详情长图" : "正在整理主图";
  }

  if (
    normalized.includes("upload") ||
    normalized.includes("save") ||
    normalized.includes("final") ||
    normalized.includes("result") ||
    normalized.includes("persist")
  ) {
    return "正在整理结果";
  }

  if (
    normalized.includes("done") ||
    normalized.includes("complete") ||
    normalized.includes("finish") ||
    normalized.includes("success") ||
    normalized.includes("succeed")
  ) {
    return "即将完成";
  }

  if (
    normalized.includes("create") ||
    normalized.includes("submit") ||
    normalized.includes("dispatch") ||
    normalized.includes("start")
  ) {
    return "任务已提交";
  }

  return kind === "detail" ? "正在生成详情图" : "正在生成主图";
}
