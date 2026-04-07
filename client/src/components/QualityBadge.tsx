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
        color: "bg-blue-500/20 text-blue-400 border-blue-500/40",
        icon: <Loader2 className="w-3 h-3 animate-spin" />,
        text: "质检中",
      };
      break;
    case "passed":
      config = {
        color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
        icon: <CheckCircle2 className="w-3 h-3" />,
        text: "质检通过",
      };
      break;
    case "sync_failed":
    case "generation_failed":
      config = {
        color: "bg-red-500/20 text-red-400 border-red-500/40",
        icon: <XCircle className="w-3 h-3" />,
        text: "生成失败",
      };
      break;
    case "async_failed":
      config = {
        color: "bg-orange-500/20 text-orange-400 border-orange-500/40",
        icon: <AlertCircle className="w-3 h-3" />,
        text: "质量不达标",
      };
      break;
    default:
      return null;
  }

  const badge = (
    <div
      className={`inline-flex items-center gap-1 rounded-full backdrop-blur-md border px-2 py-0.5 text-[10px] font-bold tracking-widest shadow-sm ${config.color} ${className}`}
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
          <TooltipContent className="bg-slate-900 border-white/10 text-slate-200">
            <p className="text-xs">{reason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}
