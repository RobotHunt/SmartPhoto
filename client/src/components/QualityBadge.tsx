import { AlertCircle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface QualityBadgeProps {
  status?: string;
  reason?: string | null;
  className?: string;
}

export function QualityBadge({ status, reason, className = "" }: QualityBadgeProps) {
  if (!status || status === "unchecked") return null;

  let config = {
    color: "",
    icon: <></>,
    text: "",
  };

  switch (status) {
    case "pending_async_review":
      config = {
        color: "bg-blue-50 text-blue-600 border-blue-200",
        icon: <Loader2 className="w-3 h-3 animate-spin" />,
        text: "质检中",
      };
      break;
    case "passed":
      config = {
        color: "bg-emerald-50 text-emerald-600 border-emerald-200",
        icon: <CheckCircle2 className="w-3 h-3" />,
        text: "质检通过",
      };
      break;
    case "sync_failed":
    case "generation_failed":
      config = {
        color: "bg-red-50 text-red-600 border-red-200",
        icon: <XCircle className="w-3 h-3" />,
        text: "生成失败",
      };
      break;
    case "async_failed":
      config = {
        color: "bg-orange-50 text-orange-600 border-orange-200",
        icon: <AlertCircle className="w-3 h-3" />,
        text: "质量不达标",
      };
      break;
    default:
      return null;
  }

  const badge = (
    <div
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-widest shadow-sm ${config.color} ${className}`}
    >
      {config.icon}
      {config.text}
    </div>
  );

  if (reason && (status === "sync_failed" || status === "async_failed" || status === "generation_failed")) {
    return (
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <div className="cursor-help">{badge}</div>
          </TooltipTrigger>
          <TooltipContent className="bg-white border-slate-200 text-slate-700 shadow-lg">
            <p className="text-xs">{reason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}
