import { AlertTriangle, RotateCcw } from "lucide-react";

export interface FailedAssetCardProps {
  label: string;
  productName: string;
  reason?: string | null;
  onRetry: () => void;
  isRegenerating?: boolean;
}

export function FailedAssetCard({
  label,
  productName,
  reason,
  onRetry,
  isRegenerating,
}: FailedAssetCardProps) {
  return (
    <div className="glass-panel overflow-hidden rounded-[24px] shadow-md border border-red-500/30 flex flex-col items-center justify-center relative min-h-[300px]">
      
      
      <div className="text-center z-10 p-6 flex flex-col items-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 border border-red-200">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="mb-2 font-bold text-red-500 tracking-widest text-sm">生成失败</h3>
        <p className="text-xs text-red-500 mb-6 max-w-[200px] leading-relaxed">
          {reason || "图片生成过程中发生异常，请重试"}
        </p>
        
        <button
          onClick={onRetry}
          disabled={isRegenerating}
          className="flex items-center justify-center gap-2 rounded-xl bg-red-50 px-6 py-2.5 text-xs font-bold tracking-widest text-red-600 transition hover:bg-red-100 hover:text-red-700 border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RotateCcw className={`w-4 h-4 ${isRegenerating ? "animate-spin" : ""}`} />
          {isRegenerating ? "重新生成中..." : "重新生成"}
        </button>
      </div>

      {/* Info row identical to normal cards for layout consistency */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-white border-t border-red-200">
        <span className="text-sm font-bold tracking-wide text-slate-600">
          {productName} · {label}
        </span>
      </div>
    </div>
  );
}
