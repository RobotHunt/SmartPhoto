export type GenerationKind = "main" | "detail" | "hd" | "analysis";

function containsChinese(text: string) {
  return /[\u4e00-\u9fff]/.test(text);
}

export interface GenerationStageInfo {
  stage: string;
  title: string;
  description: string;
  showProgress: boolean;
  tipRotation: number;
}

const TIPS_MAIN = [
  "AI 正在为您的图片选择最佳构图",
  "智能调色中，让商品更具吸引力",
  "正在优化光影与细节表现",
  "即将呈现专业级主图效果",
  "AI 正在匹配目标平台风格",
  "精心处理每一处商品细节",
  "正在应用色彩增强算法",
  "最后打磨中，马上就好",
];

const TIPS_ANALYSIS = [
  "AI 正在深度解析商品外观特征",
  "正在智能提取核心参数与卖点",
  "扫描视觉风格中，匹配爆款策略",
  "即将推导最恰当的文案方向",
  "AI 正在融合平台标准与产品优势",
  "正在为你生成专属的策略矩阵",
  "分析即将完成，最后整理中",
];

const TIPS_DETAIL = [
  "AI 正在编排详情页版式与图文",
  "正在匹配平台规格与尺寸要求",
  "智能排版中，确保信息层次清晰",
  "即将呈现完整详情长图",
  "正在生成六大模块内容",
  "AI 正在优化文案与图片的搭配",
  "智能校对中，确保信息准确无误",
  "详情图即将生成完成",
];

const TIPS_HD = [
  "正在生成高清无水印版本",
  "AI 正在提升图片分辨率与清晰度",
  "渲染中，保留每一处产品细节",
  "即将完成高清图生成",
  "正在逐像素增强画面质感",
  "AI 正在去除水印并优化边缘",
  "高清渲染接近尾声",
  "最终校验中，即将呈现",
];

function pickTip(tips: string[], rotation: number) {
  return tips[rotation % tips.length];
}

export function getTips(kind: GenerationKind) {
  if (kind === "analysis") return TIPS_ANALYSIS;
  if (kind === "detail") return TIPS_DETAIL;
  if (kind === "hd") return TIPS_HD;
  return TIPS_MAIN;
}

export function resolveGenerationStageText(
  stage: string | null | undefined,
  kind: GenerationKind = "main",
): GenerationStageInfo {
  const raw = String(stage || "").trim();
  const tips = getTips(kind);

  if (!raw) {
    return {
      stage: "default",
      title: kind === "analysis" ? "正在提取参数与卖点" : kind === "detail" ? "正在生成详情图" : kind === "hd" ? "正在生成高清图" : "正在生成主图",
      description: pickTip(tips, 0),
      showProgress: true,
      tipRotation: 0,
    };
  }

  if (containsChinese(raw)) {
    let t = raw;
    if (raw.includes("准备") || raw.includes("排队") || raw.includes("提交") || raw.includes("等待")) {
      t = kind === "analysis" ? "正在提取分析特征" : kind === "detail" ? "正准备编排详情图" : kind === "hd" ? "正准备渲染高清图" : "正在生成主图";
    }

    return {
      stage: raw,
      title: t,
      description: pickTip(tips, 0),
      showProgress: true,
      tipRotation: 0,
    };
  }

  const normalized = raw.toLowerCase();

  if (
    normalized.includes("queue") ||
    normalized.includes("pending") ||
    normalized.includes("wait")
  ) {
    const t = kind === "analysis" ? "分析正在排队中" : kind === "detail" ? "详情图正在排队" : kind === "hd" ? "高清图渲染准备中" : "正在准备生成主图";
    return {
      stage: "preparing",
      title: t,
      description: "正在为您分配 AI 资源，请稍候",
      showProgress: true,
      tipRotation: 1,
    };
  }

  if (
    normalized.includes("plan") ||
    normalized.includes("strategy") ||
    normalized.includes("preview")
  ) {
    const t = kind === "detail" ? "正在规划详情图" : "正在校验主图策略";
    return {
      stage: "planning",
      title: t,
      description: pickTip(tips, 2),
      showProgress: true,
      tipRotation: 2,
    };
  }

  if (normalized.includes("analysis") || normalized.includes("extract")) {
    const t = kind === "analysis" ? "正在深度分析素材" : kind === "detail" ? "正在准备详情图素材" : "正在分析素材";
    return {
      stage: "analyzing",
      title: t,
      description: pickTip(tips, 0),
      showProgress: true,
      tipRotation: 0,
    };
  }

  if (
    normalized.includes("render") ||
    normalized.includes("generate") ||
    normalized.includes("diffus") ||
    normalized.includes("infer") ||
    normalized.includes("processing") ||
    normalized.includes("running")
  ) {
    const t = kind === "analysis" ? "正在提取卖点" : kind === "detail" ? "正在生成详情图" : kind === "hd" ? "正在生成高清图" : "正在生成主图";
    return {
      stage: "generating",
      title: t,
      description: pickTip(tips, 1),
      showProgress: true,
      tipRotation: 1,
    };
  }

  if (
    normalized.includes("stitch") ||
    normalized.includes("merge") ||
    normalized.includes("compose")
  ) {
    const t = kind === "detail" ? "正在拼接详情长图" : "正在整理主图";
    return {
      stage: "composing",
      title: t,
      description: pickTip(tips, 3),
      showProgress: true,
      tipRotation: 3,
    };
  }

  if (
    normalized.includes("upload") ||
    normalized.includes("save") ||
    normalized.includes("final") ||
    normalized.includes("result") ||
    normalized.includes("persist")
  ) {
    return {
      stage: "finishing",
      title: "正在整理结果",
      description: "即将完成，请稍候",
      showProgress: true,
      tipRotation: 3,
    };
  }

  if (
    normalized.includes("done") ||
    normalized.includes("complete") ||
    normalized.includes("finish") ||
    normalized.includes("success") ||
    normalized.includes("succeed")
  ) {
    return {
      stage: "done",
      title: "即将完成",
      description: "AI 处理即将结束",
      showProgress: true,
      tipRotation: 3,
    };
  }

  if (
    normalized.includes("create") ||
    normalized.includes("submit") ||
    normalized.includes("dispatch") ||
    normalized.includes("start")
  ) {
    const t = kind === "analysis" ? "分析任务已提交" : kind === "detail" ? "详情图任务已提交" : kind === "hd" ? "高清图生成已启动" : "主图生成任务已提交";
    return {
      stage: "submitted",
      title: t,
      description: "AI 正在启动，请稍候",
      showProgress: true,
      tipRotation: 0,
    };
  }

  return {
    stage: "default",
    title: kind === "analysis" ? "正在提取参数与卖点" : kind === "detail" ? "正在生成详情图" : kind === "hd" ? "正在生成高清图" : "正在生成主图",
    description: pickTip(tips, 0),
    showProgress: true,
    tipRotation: 0,
  };
}

const EMOTIONAL_THRESHOLD_MS = 10_000;

export function resolveStageByElapsedTime(
  elapsedMs: number,
  kind: GenerationKind = "main",
  stage?: string | null,
): GenerationStageInfo {
  const base = resolveGenerationStageText(stage, kind);
  const tips = getTips(kind);

  if (elapsedMs < EMOTIONAL_THRESHOLD_MS) {
    return base;
  }

  const rotation = Math.floor(elapsedMs / 3000) % tips.length;

  return {
    ...base,
    description: pickTip(tips, rotation),
    tipRotation: rotation,
    title: base.stage === "preparing"
      ? "正在为您精心制作"
      : base.title,
    showProgress: base.stage !== "preparing",
  };
}
