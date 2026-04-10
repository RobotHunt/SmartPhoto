import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import type { GenerationKind } from "@/lib/generationStatus";
import { getTips, resolveGenerationStageText } from "@/lib/generationStatus";

interface GenerationWaitingUIProps {
  kind: GenerationKind;
  /** Real progress from backend (0-100). Component handles its own auto-progress. */
  progress: number;
  stage?: string | null;
  previewImageUrl?: string;
}

const TICK_MS = 200;

/**
 * Internal timer + auto-progress.
 * - Ticks every 200 ms regardless of parent re-renders.
 * - Asymptotic curve → 92 % ceiling.
 * - Backend progress nudges up but never drags down.
 */
function useAutoProgress(realProgress: number) {
  const [display, setDisplay] = useState(5);
  const [ticks, setTicks] = useState(0);
  const lastRealRef = useRef(realProgress);

  useEffect(() => {
    const id = setInterval(() => setTicks((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (realProgress > lastRealRef.current) lastRealRef.current = realProgress;

    const ceiling = 92;
    const seconds = (ticks * TICK_MS) / 1000;
    const autoTarget = Math.min(ceiling, 5 + 87 * (1 - Math.exp(-seconds / 35)));
    const target = Math.max(autoTarget, Math.min(realProgress, ceiling));

    setDisplay((prev) => {
      if (target <= prev) return prev;
      const diff = target - prev;
      return prev + Math.max(0.3, diff * 0.15);
    });
  }, [realProgress, ticks]);

  return {
    display: Math.round(display * 10) / 10,
    elapsedMs: ticks * TICK_MS,
  };
}

export default function GenerationWaitingUI({
  kind,
  progress,
  stage,
  previewImageUrl,
}: GenerationWaitingUIProps) {
  const { display: dp, elapsedMs } = useAutoProgress(progress);

  const baseInfo = resolveGenerationStageText(stage, kind);
  const isEmotional = elapsedMs >= 10_000;

  // Tip rotation every 3 s
  const tips = getTips(kind);
  const tipIdx = Math.floor(elapsedMs / 3000) % tips.length;
  const currentTip = tips[tipIdx];

  // Human-readable stage label
  const stageLabel =
    dp >= 90
      ? "即将完成"
      : dp >= 70
        ? "处理接近尾声"
        : dp >= 50
          ? "已过半程，请稍候"
          : dp >= 25
            ? "正在处理中"
            : "已启动，请稍候";

  return (
    <div className="flex flex-col w-[calc(100%-2rem)] md:w-full mx-auto items-center justify-center flex-1 px-4 py-12 glass-panel rounded-[32px] my-8 md:my-16 max-w-md md:max-w-2xl text-slate-800 shadow-xl border border-slate-200 relative z-10">
      {/* Pulsing icon */}
      <div className="relative mb-5">
        <div className="absolute inset-0 w-16 h-16 rounded-full bg-blue-400/20 animate-ping" />
        <div className="relative w-16 h-16 bg-slate-50 rounded-full border-2 border-blue-200 flex items-center justify-center shadow-md">
          <Sparkles className="w-8 h-8 text-blue-500 animate-pulse" />
        </div>
      </div>

      {/* Title */}
      <h2 className="text-lg font-bold text-slate-900 mb-1">{baseInfo.title}</h2>

      {/* Rotating tip (crossfade via key) */}
      <div className="h-10 flex items-center justify-center mb-5 overflow-hidden">
        <p
          key={tipIdx}
          className="text-sm text-slate-500 text-center max-w-xs animate-in fade-in duration-500"
        >
          {currentTip}
        </p>
      </div>

      {/* Progress bar — always visible when showProgress */}
      {baseInfo.showProgress && (
        <div className="w-full flex-col items-center flex" key="progress-sec">
          <div className="w-full max-w-xs mb-2">
            <div className="w-full bg-slate-200 border border-slate-300 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 via-blue-400 to-sky-500 h-full rounded-full transition-all duration-700 ease-out shadow-sm"
                style={{ width: `${dp}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Stage label */}
      {baseInfo.showProgress && (
        <p className="text-xs text-slate-500 mt-1">{stageLabel}</p>
      )}

      {/* Emotional mode (≥ 10 s) */}
      {isEmotional && (
        <>
          <div className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-50/80 backdrop-blur-sm border border-blue-200 rounded-xl max-w-xs transition-opacity duration-500">
            <Sparkles className="w-4 h-4 text-blue-500 shrink-0" />
            <p className="text-xs text-blue-800 font-medium tracking-wide" key={`e-${tipIdx}`}>
              {kind === "detail"
                ? "AI 正在精心编排每一张详情图，确保版式与文案完美匹配"
                : kind === "hd"
                  ? "AI 正在逐像素提升清晰度，为您呈现最真实的商品质感"
                  : kind === "analysis"
                    ? "AI 正在深度解析商品特征与数据，这需要一点时间"
                    : "AI 正在为您精心制作每一张主图，好作品值得等待"}
            </p>
          </div>

          {previewImageUrl && (
            <div className="mt-3 w-full max-w-xs rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
              <img
                src={previewImageUrl}
                alt="预览"
                className="w-full object-cover"
                style={{ maxHeight: "140px", filter: "blur(4px) brightness(0.9)" }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
