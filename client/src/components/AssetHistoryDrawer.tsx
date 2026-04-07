import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Check, Clock, Loader2, RotateCcw, X, History } from "lucide-react";
import { assetAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { QualityBadge } from "./QualityBadge";

function HistoryThumbnail({ record }: { record: any }) {
  const [errorSrc, setErrorSrc] = useState<string | null>(null);

  const currentSrc = errorSrc === record.thumbnail_url && record.image_url 
    ? record.image_url 
    : record.thumbnail_url || record.image_url;

  const isFailed = (errorSrc === record.thumbnail_url && !record.image_url) || 
                   (errorSrc === record.image_url);

  if (!currentSrc || isFailed) {
    return (
      <div className="w-20 h-20 shrink-0 rounded-xl border border-white/10 bg-black/50 flex items-center justify-center opacity-50">
        <span className="text-[10px] text-slate-500 font-bold tracking-widest">
          {isFailed ? "加载失败" : "无预览"}
        </span>
      </div>
    );
  }

  return (
    <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden border border-white/10 bg-black/50">
      <img
        src={currentSrc}
        alt="thumbnail"
        className="w-full h-full object-cover"
        onError={() => setErrorSrc(currentSrc)}
      />
    </div>
  );
}

export interface AssetHistoryDrawerProps {
  assetId: string;
  currentVersionNo?: number;
  open: boolean;
  onClose: () => void;
  onRestoreSuccess: () => void;
}

export function AssetHistoryDrawer({
  assetId,
  currentVersionNo,
  open,
  onClose,
  onRestoreSuccess,
}: AssetHistoryDrawerProps) {
  const { toast } = useToast();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !assetId) return;
    let cancelled = false;
    setLoading(true);

    assetAPI
      .getHistory(assetId)
      .then((data) => {
        if (!cancelled) {
          const historyList = Array.isArray(data) ? data : data?.history || [];
          setHistory(historyList);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          toast({ title: "获取历史记录失败", description: err.message, variant: "destructive" });
          setLoading(false);
          onClose();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [assetId, open, toast, onClose]);

  const handleRestore = async (targetId: string, versionNo: number) => {
    try {
      setRestoringId(targetId);
      await assetAPI.restore(targetId);
      toast({ title: "已恢复", description: `素材已成功恢复至 V${versionNo}` });
      onRestoreSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: "恢复失败", description: err.message, variant: "destructive" });
    } finally {
      if (restoringId === targetId) {
        setRestoringId(null);
      }
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />
      <div
        className="w-full max-w-sm bg-[#050914]/95 border-l border-white/10 shadow-2xl h-full flex flex-col relative animate-in slide-in-from-right duration-300 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/40">
          <h2 className="text-base font-bold tracking-widest text-slate-100 flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" />
            素材版本历史
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center opacity-50">
              <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mb-4" />
              <span className="text-xs font-bold tracking-widest text-slate-400">加载中...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-50">
              <History className="w-12 h-12 text-slate-600 mb-4" />
              <span className="text-sm font-bold tracking-widest text-slate-400">无历史记录</span>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((record) => {
                const isCurrent = record.version_no === currentVersionNo;
                const isRestoring = restoringId === record.asset_id;

                return (
                  <div
                    key={record.asset_id}
                    className={`rounded-2xl border ${
                      isCurrent
                        ? "border-cyan-500/50 bg-cyan-950/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                        : "border-white/10 bg-black/40 hover:border-white/20"
                    } p-4 transition-all flex flex-col`}
                  >
                    <div className="flex items-start gap-4">
                      <HistoryThumbnail record={record} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-sm font-bold tracking-widest ${isCurrent ? "text-cyan-400" : "text-slate-200"}`}>
                            V{record.version_no}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] font-bold text-cyan-400 flex items-center gap-1 bg-cyan-500/20 px-1.5 py-0.5 rounded border border-cyan-500/30">
                              <Check className="w-3 h-3" />
                              当前
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-2">
                          <Clock className="w-3 h-3" />
                          {record.created_at ? format(new Date(record.created_at), "yyyy-MM-dd HH:mm") : "未知时间"}
                        </div>

                        <div className="mb-2">
                          <QualityBadge status={record.quality_status || record.status} reason={record.failure_reason} className="scale-90 origin-left" />
                        </div>
                      </div>
                    </div>

                    {record.edit_instruction && (
                      <div className="mt-3 px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-xs text-slate-300 font-medium leading-relaxed">
                        <span className="text-slate-500 text-[10px] block mb-0.5">重绘指令：</span>
                        {record.edit_instruction}
                      </div>
                    )}

                    {!isCurrent && (
                      <button
                        onClick={() => handleRestore(record.asset_id, record.version_no)}
                        disabled={isRestoring}
                        className="mt-4 w-full h-9 rounded-xl border border-blue-500/30 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 text-xs font-bold tracking-widest flex items-center justify-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(59,130,246,0.1)]"
                      >
                        {isRestoring ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            正在恢复...
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            恢复此版本
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
