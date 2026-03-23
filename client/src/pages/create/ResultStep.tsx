import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Loader2, RefreshCw, Check, X, Sparkles, RotateCcw, Pencil, Wand2, ArrowLeft } from "lucide-react";
import { StepIndicator } from "@/components/StepIndicator";
import { useToast } from "@/hooks/use-toast";
import { sessionAPI, jobAPI, assetAPI } from "@/lib/api";

// ─── Role label mapping ─────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  hero: "白底主图",
  white_bg: "白底图",
  scene: "场景图",
  selling_point: "卖点图",
  feature: "功能图",
  structure: "结构图",
};

function roleToLabel(role: string | undefined): string {
  if (!role) return "主图";
  return ROLE_LABELS[role] ?? role;
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface ResultAsset {
  asset_id: string;
  role: string;
  image_url: string;
  display_order: number;
  slot_id: string;
  isRegenerating: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function ResultStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Generation state
  const [generating, setGenerating] = useState(true);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const safeSetProgress = (val: number) => {
    const clamped = Math.max(progressRef.current, Math.round(val));
    progressRef.current = clamped;
    setProgress(clamped);
  };
  const [statusText, setStatusText] = useState("AI 正在努力生成图片...");
  const [error, setError] = useState<string | null>(null);

  // Results
  const [assets, setAssets] = useState<ResultAsset[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Product name from earlier steps
  const productName =
    sessionStorage.getItem("selectedProductType") ||
    (() => {
      try {
        const ar = sessionStorage.getItem("analysisResult");
        return ar ? JSON.parse(ar).product_name : "";
      } catch {
        return "";
      }
    })() ||
    "产品";

  // Edit-text modal (per image)
  const [editTextOpen, setEditTextOpen] = useState(false);
  const [editTextTarget, setEditTextTarget] = useState<string | null>(null);
  const [editTextValue, setEditTextValue] = useState("");

  // AI optimization modal
  const [aiOptModalOpen, setAiOptModalOpen] = useState(false);
  const [aiOptFeedback, setAiOptFeedback] = useState("");

  // Regeneration modal (bottom sheet)
  const [regenModalOpen, setRegenModalOpen] = useState(false);
  const [regenTargetId, setRegenTargetId] = useState<string | null>(null);
  const [regenInstruction, setRegenInstruction] = useState("");
  const [regenLoading, setRegenLoading] = useState(false);
  const regenTextareaRef = useRef<HTMLTextAreaElement>(null);

  const sessionId = sessionStorage.getItem("current_session_id") || "";

  // ─── Toggle selection ────────────────────────────────────────────────────
  const toggleSelect = (assetId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  };

  // ─── Load results from backend ──────────────────────────────────────────
  const loadResults = useCallback(
    async (sid: string) => {
      try {
        const data = await sessionAPI.getResults(sid);
        const rawAssets: any[] =
          data?.assets ?? data?.images ?? data?.results ?? (Array.isArray(data) ? data : []);

        const mapped: ResultAsset[] = rawAssets.map((item: any, idx: number) => ({
          asset_id: item.asset_id ?? item.id ?? String(idx + 1),
          role: item.role ?? item.asset_role ?? "hero",
          image_url: item.image_url ?? item.url ?? "",
          display_order: item.display_order ?? idx,
          slot_id: item.slot_id ?? "",
          isRegenerating: false,
        }));

        setAssets(mapped);
        // Select all by default
        setSelected(new Set(mapped.map((a) => a.asset_id)));

        safeSetProgress(100);
        setGenerating(false);
      } catch (err: any) {
        toast({
          title: "获取结果失败",
          description: err.message || "请重试",
          variant: "destructive",
        });
        setGenerating(false);
      }
    },
    [toast],
  );

  // ─── On mount: try loading existing results first, only generate if none ──
  useEffect(() => {
    if (!sessionId) {
      toast({
        title: "缺少会话",
        description: "找不到 session_id，请返回重新开始",
        variant: "destructive",
      });
      setGenerating(false);
      setError("缺少会话 ID，请返回重新开始");
      return;
    }

    let cancelled = false;
    let fakeTimer: ReturnType<typeof setInterval>;

    (async () => {
      try {
        // ── Step 1: Try to load existing results first ──
        setStatusText("正在加载生成结果...");
        try {
          const existingData = await sessionAPI.getResults(sessionId);
          const existingAssets: any[] =
            existingData?.assets ?? existingData?.images ?? existingData?.results ?? (Array.isArray(existingData) ? existingData : []);

          if (existingAssets.length > 0 && !cancelled) {
            // Results already exist — display them directly, no need to regenerate
            const mapped: ResultAsset[] = existingAssets.map((item: any, idx: number) => ({
              asset_id: item.asset_id ?? item.id ?? String(idx + 1),
              role: item.role ?? item.asset_role ?? "hero",
              image_url: item.image_url ?? item.url ?? "",
              display_order: item.display_order ?? idx,
              slot_id: item.slot_id ?? "",
              isRegenerating: false,
            }));
            setAssets(mapped);
            setSelected(new Set(mapped.map((a) => a.asset_id)));
            safeSetProgress(100);
            setGenerating(false);
            return; // ← Skip generation entirely
          }
        } catch {
          // No existing results or endpoint error — proceed to generate
        }

        if (cancelled) return;

        // ── Step 2: No existing results — run generation ──
        let fakeProgress = 0;
        fakeTimer = setInterval(() => {
          if (cancelled) return;
          fakeProgress += Math.random() * 5 + 1;
          if (fakeProgress > 40) fakeProgress = 40;
          safeSetProgress(Math.round(fakeProgress));
        }, 400);

        // Build strategy if needed
        setStatusText("正在构建生成策略...");
        try {
          await sessionAPI.buildStrategy(sessionId);
        } catch (strategyErr: any) {
          if (
            !strategyErr.message?.includes("already") &&
            !strategyErr.message?.includes("copy not ready")
          ) {
            console.warn("Strategy build warning:", strategyErr.message);
          }
        }

        if (cancelled) return;
        safeSetProgress(45);
        setStatusText("AI 正在努力生成图片...");

        // Start generation
        const genResp = await sessionAPI.generateGallery(sessionId);
        const jobId = genResp.job_id || (genResp as any).jobId;

        if (cancelled) return;
        clearInterval(fakeTimer);

        // Poll until done
        await jobAPI.pollUntilDone(jobId, (status) => {
          if (cancelled) return;
          const pct = status.progress ?? status.progress_pct ?? 0;
          safeSetProgress(Math.min(Math.round(50 + pct * 0.42), 92));
          const stage = status.stage || status.status || "";
          if (stage) setStatusText(`生成中: ${stage}`);
        });

        if (cancelled) return;

        // Fetch results
        setStatusText("正在加载生成结果...");
        safeSetProgress(95);
        await loadResults(sessionId);
      } catch (err: any) {
        if (cancelled) return;
        clearInterval(fakeTimer!);
        console.error("Generation failed:", err);
        const msg = err.message || "生成失败，请重试";
        const isCredits = msg.includes("insufficient") || msg.includes("credits") || msg.includes("余额");
        toast({
          title: isCredits ? "额度不足" : "生成失败",
          description: isCredits ? "账户余额不足，请充值后重试" : msg,
          variant: "destructive",
        });
        setError(isCredits ? "insufficient_credits" : msg);
        setGenerating(false);
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(fakeTimer);
    };
  }, [sessionId, loadResults, toast]);

  // ─── Open regen modal ──────────────────────────────────────────────────
  const openRegenModal = (assetId: string) => {
    setRegenTargetId(assetId);
    setRegenInstruction("");
    setRegenModalOpen(true);
    setTimeout(() => regenTextareaRef.current?.focus(), 150);
  };

  // ─── Confirm regeneration ──────────────────────────────────────────────
  const confirmRegen = async () => {
    if (!regenTargetId || !sessionId) return;
    setRegenModalOpen(false);
    setRegenLoading(true);

    setAssets((prev) =>
      prev.map((a) =>
        a.asset_id === regenTargetId ? { ...a, isRegenerating: true } : a,
      ),
    );

    try {
      const result = await assetAPI.regenerate(
        regenTargetId,
        regenInstruction || "重新生成",
      );
      if (result && result.job_id) {
        await jobAPI.pollUntilDone(result.job_id);
      }
      await loadResults(sessionId);
      toast({
        title: "重新生成完成",
        description: regenInstruction
          ? `已按指示调整：${regenInstruction}`
          : "已重新生成",
      });
    } catch (err: any) {
      const msg = err.message || "请重试";
      const isCredits = msg.includes("insufficient") || msg.includes("credits") || msg.includes("余额");
      toast({
        title: isCredits ? "额度不足" : "重新生成失败",
        description: isCredits ? "账户余额不足，请充值后重试" : msg,
        variant: "destructive",
      });
    } finally {
      setAssets((prev) =>
        prev.map((a) =>
          a.asset_id === regenTargetId ? { ...a, isRegenerating: false } : a,
        ),
      );
      setRegenLoading(false);
      setRegenTargetId(null);
    }
  };

  // ─── Open edit-text modal ──────────────────────────────────────────────
  const openEditText = (assetId: string) => {
    setEditTextTarget(assetId);
    setEditTextValue("");
    setEditTextOpen(true);
  };

  const confirmEditText = async () => {
    if (!editTextTarget || !editTextValue.trim()) {
      setEditTextOpen(false);
      return;
    }
    // Treat "edit text" as a regen with specific text instruction
    setEditTextOpen(false);
    setRegenLoading(true);

    setAssets((prev) =>
      prev.map((a) =>
        a.asset_id === editTextTarget ? { ...a, isRegenerating: true } : a,
      ),
    );

    try {
      const result = await assetAPI.regenerate(
        editTextTarget,
        `修改文字：${editTextValue}`,
      );
      if (result && result.job_id) {
        await jobAPI.pollUntilDone(result.job_id);
      }
      await loadResults(sessionId);
      toast({ title: "文字编辑完成" });
    } catch (err: any) {
      toast({
        title: "编辑失败",
        description: err.message || "请重试",
        variant: "destructive",
      });
    } finally {
      setAssets((prev) =>
        prev.map((a) =>
          a.asset_id === editTextTarget ? { ...a, isRegenerating: false } : a,
        ),
      );
      setRegenLoading(false);
      setEditTextTarget(null);
    }
  };

  // ─── Watermark pattern (diagonal repeated "水印") ──────────────────────
  const WatermarkOverlay = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
      <div
        className="absolute inset-[-50%] flex flex-wrap items-center justify-center gap-8"
        style={{ transform: "rotate(-30deg)" }}
      >
        {Array.from({ length: 60 }).map((_, i) => (
          <span
            key={i}
            className="text-white/20 text-lg font-bold select-none whitespace-nowrap"
            style={{ letterSpacing: "0.15em" }}
          >
            AI电商做图 · 预览水印
          </span>
        ))}
      </div>
    </div>
  );

  // ─── Render: loading state ─────────────────────────────────────────────
  if (generating) {
    return (
      <div className="min-h-screen bg-[#f5f6f8]">
        <StepIndicator currentStep={5} step5Label="生成图片" />

        <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
          {/* Spinner in light blue circle */}
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          </div>

          <h2 className="text-xl font-bold text-slate-900 mb-2">{statusText}</h2>
          <p className="text-sm text-slate-500 mb-6">
            请耐心等待，AI 正在为您精心制作图片
          </p>

          {/* Progress bar */}
          <div className="w-full max-w-sm mb-3">
            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <p className="text-sm text-slate-400 font-medium">{progress}%</p>
        </div>
      </div>
    );
  }

  // ─── Render: error state ───────────────────────────────────────────────
  if (error && assets.length === 0) {
    const isCreditsError = error === "insufficient_credits";

    return (
      <div className="min-h-screen bg-[#f5f6f8]">
        <StepIndicator currentStep={5} step5Label="生成图片" />

        <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
            <X className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">
            {isCreditsError ? "额度不足" : "生成失败"}
          </h2>
          <p className="text-sm text-slate-500 mb-6 text-center max-w-xs">
            {isCreditsError
              ? "您的账户余额不足以完成本次生成，请充值后重试。"
              : error}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/create/confirm")}
              className="flex items-center gap-2 text-sm text-slate-600 border border-slate-300 rounded-xl px-5 py-2.5 bg-white hover:bg-slate-50 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              返回上一页
            </button>
            {isCreditsError && (
              <button
                onClick={() => setLocation("/create/payment")}
                className="flex items-center gap-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-xl px-5 py-2.5 transition"
              >
                去充值
              </button>
            )}
            {!isCreditsError && (
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 text-sm text-blue-600 border border-blue-200 rounded-xl px-5 py-2.5 bg-white hover:bg-blue-50 transition"
              >
                重试
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const selectedCount = selected.size;

  // ─── Render: results ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <StepIndicator currentStep={5} step5Label="生成图片" />

      <div className="max-w-lg mx-auto px-4 pb-44 pt-4">
        {/* Top bar: count */}
        <div className="mb-3">
          <span className="text-sm font-bold text-slate-800">
            已生成 {assets.length} 张
          </span>
        </div>

        {/* Image list */}
        <div className="space-y-3">
          {assets.map((asset) => {
            const isSelected = selected.has(asset.asset_id);
            const label = roleToLabel(asset.role);

            return (
              <div key={asset.asset_id} className="relative">
                {/* Image card */}
                <div
                  className={`relative rounded-2xl overflow-hidden cursor-pointer transition-all ${
                    isSelected
                      ? "ring-2 ring-blue-400"
                      : "ring-1 ring-slate-200"
                  }`}
                  onClick={() => toggleSelect(asset.asset_id)}
                >
                  {/* Regenerating overlay */}
                  {asset.isRegenerating && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-20 gap-2">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                      <span className="text-white text-sm font-medium">
                        重新生成中...
                      </span>
                    </div>
                  )}

                  {/* Image */}
                  <div className="relative w-full" style={{ aspectRatio: "1 / 1" }}>
                    <img
                      src={asset.image_url}
                      alt={label}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />

                    {/* Watermark overlay */}
                    <WatermarkOverlay />
                  </div>

                  {/* Selection circle top-right */}
                  <div className="absolute top-3 right-3 z-20">
                    <div
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected
                          ? "bg-blue-500 border-blue-500"
                          : "bg-white/80 border-white/60 backdrop-blur-sm"
                      }`}
                    >
                      {isSelected && (
                        <Check className="w-4 h-4 text-white stroke-[3]" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Below image: info + actions */}
                <div className="flex items-center justify-between mt-2 px-1">
                  {/* Label */}
                  <span className="text-sm text-slate-700 font-medium">
                    {productName} · {label}
                  </span>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditText(asset.asset_id)}
                      className="text-xs text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-300 rounded-full px-3 py-1 transition bg-white"
                    >
                      编辑文字
                    </button>
                    <button
                      onClick={() => openRegenModal(asset.asset_id)}
                      disabled={asset.isRegenerating || regenLoading}
                      className="text-xs text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-300 rounded-full px-3 py-1 transition bg-white disabled:opacity-40 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      重新生成
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Bottom fixed bar ──────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-30">
        <div className="bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-4 py-4">
          <div className="max-w-lg mx-auto">
            {/* Selection count + hint */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-800">
                已选择 {selectedCount} 张
              </span>
              <span className="text-xs text-slate-400">
                确认后生成无水印高清图...
              </span>
            </div>

            {/* Gradient button */}
            <button
              onClick={() => {
                // Store selected asset IDs for payment page
                sessionStorage.setItem(
                  "selected_asset_ids",
                  JSON.stringify(Array.from(selected)),
                );
                setLocation("/create/payment");
              }}
              disabled={selectedCount === 0}
              className="w-full bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 disabled:from-slate-300 disabled:to-slate-400 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition active:scale-[0.98] shadow-lg shadow-blue-200/50"
            >
              生成无水印高清图
            </button>
          </div>
        </div>
      </div>

      {/* ─── Regeneration modal (bottom sheet) ─────────────────────────────── */}
      {regenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setRegenModalOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl px-5 pt-5 pb-8 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            {/* Drag handle */}
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />

            {/* Title */}
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-slate-900 text-base">重新生成</h3>
              <button
                onClick={() => setRegenModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              请告诉 AI 你希望如何调整这张图片（可选）
            </p>

            {/* Textarea */}
            <textarea
              ref={regenTextareaRef}
              value={regenInstruction}
              onChange={(e) => setRegenInstruction(e.target.value)}
              placeholder="例如：背景换成白色、产品更突出、去掉多余元素..."
              rows={4}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />

            {/* Quick tag suggestions */}
            <div className="flex flex-wrap gap-2 mt-3 mb-5">
              {[
                "背景换白色",
                "产品更突出",
                "文字更大",
                "去掉文字",
                "换横版构图",
              ].map((tag) => (
                <button
                  key={tag}
                  onClick={() =>
                    setRegenInstruction((prev) =>
                      prev ? `${prev}，${tag}` : tag,
                    )
                  }
                  className="text-xs text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-full px-3 py-1 transition"
                >
                  + {tag}
                </button>
              ))}
            </div>

            {/* Confirm button */}
            <button
              onClick={confirmRegen}
              className="w-full bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition active:scale-[0.98]"
            >
              <RefreshCw className="w-4 h-4" />
              确认，开始重新生成
            </button>
          </div>
        </div>
      )}

      {/* ─── Edit text modal (bottom sheet) ────────────────────────────────── */}
      {editTextOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setEditTextOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl px-5 pt-5 pb-8 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />

            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-slate-900 text-base">编辑文字</h3>
              <button
                onClick={() => setEditTextOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              请输入你希望修改的文字内容
            </p>

            <textarea
              value={editTextValue}
              onChange={(e) => setEditTextValue(e.target.value)}
              placeholder={'例如：标题改为"新品首发"、副标题改为"限时特惠"...'}
              rows={4}
              autoFocus
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />

            <button
              onClick={confirmEditText}
              className="w-full mt-4 bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition active:scale-[0.98]"
            >
              确认修改
            </button>
          </div>
        </div>
      )}

      {/* ─── AI优化图片弹窗 ──────────────────────────────────────────── */}
      {aiOptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setAiOptModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl px-5 pt-5 pb-8 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-slate-900 text-base">AI优化图片</h3>
              <button onClick={() => setAiOptModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-slate-400 mb-3">告诉 AI 你希望对所有图片做哪些整体调整</p>
            <textarea
              value={aiOptFeedback}
              onChange={e => setAiOptFeedback(e.target.value)}
              placeholder="例如：整体色调更暖、产品放大一些、背景更简洁…"
              rows={4}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
            <div className="flex flex-wrap gap-2 mt-3 mb-5">
              {["色调更暖", "产品放大", "背景更简洁", "增加品牌感", "对比度更强"].map(tag => (
                <button key={tag} onClick={() => setAiOptFeedback(p => p ? `${p}，${tag}` : tag)}
                  className="text-xs text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-full px-3 py-1 transition">+ {tag}</button>
              ))}
            </div>
            <button onClick={async () => {
              setAiOptModalOpen(false);
              try {
                const resp = await sessionAPI.globalEdit(sessionId, aiOptFeedback || "整体优化");
                if (resp?.job_id) await jobAPI.pollUntilDone(resp.job_id);
                await loadResults(sessionId);
                toast({ title: "AI优化完成" });
              } catch (e: any) { toast({ title: "优化失败", description: e.message, variant: "destructive" }); }
              setAiOptFeedback("");
            }} className="w-full bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition active:scale-[0.98]">
              <Wand2 className="w-4 h-4" /> 确认，开始AI优化
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
