import { useEffect, useState } from "react";
import { Loader2, ThumbsUp, ThumbsDown, X } from "lucide-react";
import { assetAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export interface AssetFeedbackModalProps {
  assetId: string;
  open: boolean;
  onClose: () => void;
}

const FEEDBACK_GROUPS = [
  {
    label: "产品问题",
    tags: [
      { id: "deformed", label: "产品变形" },
      { id: "wrong_color", label: "颜色偏差" },
      { id: "logo_moved", label: "Logo位移" },
      { id: "product_text_changed", label: "产品文字被改" },
      { id: "color_shifted", label: "色偏" },
      { id: "low_fidelity", label: "保真度低" },
    ],
  },
  {
    label: "文案问题",
    tags: [
      { id: "bad_text", label: "文字错误" },
    ],
  },
  {
    label: "布局问题",
    tags: [
      { id: "weak_frame_structure", label: "框架感不足" },
      { id: "not_platform_native", label: "不像平台原生图" },
      { id: "too_photographic", label: "过于照片化" },
      { id: "insufficient_title_zone", label: "标题区域不清" },
      { id: "lack_of_proof_blocks", label: "缺少证据块" },
      { id: "layout_too_empty", label: "布局太空" },
      { id: "layout_too_busy", label: "布局太挤" },
    ],
  },
  {
    label: "风格问题",
    tags: [
      { id: "wrong_style", label: "风格不符" },
      { id: "platform_violation", label: "平台违规" },
    ],
  },
  {
    label: "其他",
    tags: [
      { id: "other", label: "其他问题" },
    ],
  },
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
        issue_tags: score === 1 ? selectedCategories : [],
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
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div 
        className="relative w-full max-w-sm rounded-[24px] bg-white border border-slate-200 shadow-2xl p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold tracking-widest text-slate-800">图片质量反馈</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {fetching ? (
          <div className="py-12 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
            <span className="text-xs text-slate-400 font-bold tracking-widest">加载中...</span>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex gap-4">
              <button
                onClick={() => setScore(3)}
                className={`flex-1 flex flex-col items-center justify-center py-4 rounded-2xl border transition-all ${
                  score === 3
                    ? "border-emerald-300 bg-emerald-50 text-emerald-600 shadow-sm"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <ThumbsUp className="w-6 h-6 mb-2" />
                <span className="text-xs font-bold tracking-widest">满意</span>
              </button>
              <button
                onClick={() => setScore(1)}
                className={`flex-1 flex flex-col items-center justify-center py-4 rounded-2xl border transition-all ${
                  score === 1
                    ? "border-rose-300 bg-rose-50 text-rose-600 shadow-sm"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <ThumbsDown className="w-6 h-6 mb-2 flex-shrink-0 mt-1" />
                <span className="text-xs font-bold tracking-widest">不满意</span>
              </button>
            </div>

            {score === 1 && (
              <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                <div>
                  <label className="text-xs font-bold tracking-widest text-slate-400 mb-2 block">
                    主要问题（可多选）
                  </label>
                  <div className="space-y-3">
                    {FEEDBACK_GROUPS.map((group) => (
                      <div key={group.label}>
                        <span className="text-[10px] font-bold text-slate-400 mb-1.5 block tracking-widest">{group.label}</span>
                        <div className="flex flex-wrap gap-2">
                          {group.tags.map((tag) => (
                            <button
                              key={tag.id}
                              onClick={() => toggleCategory(tag.id)}
                              className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-widest border transition-colors ${
                                selectedCategories.includes(tag.id)
                                  ? "bg-rose-50 border-rose-300 text-rose-600"
                                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                              }`}
                            >
                              {tag.label}
                            </button>
                          ))}
                        </div>
                      </div>
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
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-500/50 transition resize-none custom-scrollbar"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || score === null}
              className="w-full h-11 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold tracking-widest transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
