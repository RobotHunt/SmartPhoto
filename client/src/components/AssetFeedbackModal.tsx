import { useEffect, useState } from "react";
import { Loader2, ThumbsUp, ThumbsDown, X } from "lucide-react";
import { assetAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export interface AssetFeedbackModalProps {
  assetId: string;
  open: boolean;
  onClose: () => void;
}

const FEEDBACK_CATEGORIES = [
  { id: "flaw", label: "明显瑕疵/错误" },
  { id: "style", label: "风格不符" },
  { id: "missing", label: "内容缺失" },
  { id: "fidelity", label: "保真度低" },
  { id: "other", label: "其他问题" },
];

export function AssetFeedbackModal({ assetId, open, onClose }: AssetFeedbackModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!open || !assetId) return;
    let cancelled = false;
    setFetching(true);
    
    // reset form
    setScore(null);
    setSelectedCategories([]);
    setComment("");

    assetAPI
      .getFeedback(assetId)
      .then((data) => {
        if (!cancelled && data) {
          setScore(data.score ?? null);
          setSelectedCategories(data.categories || []);
          setComment(data.comment || "");
        }
        setFetching(false);
      })
      .catch(() => {
        if (!cancelled) setFetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [assetId, open]);

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (score === null) {
      toast({ title: "请选择评价", variant: "destructive" });
      return;
    }
    
    try {
      setLoading(true);
      await assetAPI.submitFeedback(assetId, {
        rating: score,
        issue_tags: score < 0 ? selectedCategories : [],
        comment,
      });
      toast({ title: "反馈已提交", description: "感谢您的反馈！" });
      onClose();
    } catch (err: any) {
      toast({ title: "提交失败", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div 
        className="relative w-full max-w-sm rounded-[24px] bg-[#050914]/95 backdrop-blur-xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold tracking-widest text-slate-100">图片质量反馈</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {fetching ? (
          <div className="py-12 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mb-4" />
            <span className="text-xs text-slate-400 font-bold tracking-widest">加载中...</span>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex gap-4">
              <button
                onClick={() => setScore(1)}
                className={`flex-1 flex flex-col items-center justify-center py-4 rounded-2xl border transition-all ${
                  score === 1
                    ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                    : "border-white/10 bg-black/40 text-slate-400 hover:bg-white/5"
                }`}
              >
                <ThumbsUp className="w-6 h-6 mb-2" />
                <span className="text-xs font-bold tracking-widest">满意</span>
              </button>
              <button
                onClick={() => setScore(-1)}
                className={`flex-1 flex flex-col items-center justify-center py-4 rounded-2xl border transition-all ${
                  score === -1
                    ? "border-rose-500/50 bg-rose-500/20 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.2)]"
                    : "border-white/10 bg-black/40 text-slate-400 hover:bg-white/5"
                }`}
              >
                <ThumbsDown className="w-6 h-6 mb-2 flex-shrink-0 mt-1" />
                <span className="text-xs font-bold tracking-widest">不满意</span>
              </button>
            </div>

            {score === -1 && (
              <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                <div>
                  <label className="text-xs font-bold tracking-widest text-slate-400 mb-2 block">
                    主要问题（可多选）
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {FEEDBACK_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => toggleCategory(cat.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-widest border transition-colors ${
                          selectedCategories.includes(cat.id)
                            ? "bg-rose-500/20 border-rose-500/50 text-rose-300"
                            : "bg-black/30 border-white/10 text-slate-400 hover:bg-white/5"
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-bold tracking-widest text-slate-400 mb-2 block">
                补充说明（选填）
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="请详细描述问题，帮助我们优化模型..."
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition resize-none custom-scrollbar"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || score === null}
              className="w-full h-11 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold tracking-widest transition shadow-[0_0_15px_rgba(6,182,212,0.3)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "提交中..." : "提交反馈"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
