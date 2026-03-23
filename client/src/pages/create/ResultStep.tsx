import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Loader2, RefreshCw, Download, ArrowLeft,
  Wand2, X, ChevronLeft, ChevronRight,
  ZoomIn, CheckCircle2, Sparkles,
} from "lucide-react";
import { StepIndicator } from "@/components/StepIndicator";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { sessionAPI, jobAPI, assetAPI } from "@/lib/api";

// ─── Role label mapping (backend role → Chinese display) ──────────────────────
const ROLE_LABELS: Record<string, string> = {
  hero: "白底主图",
  white_bg: "白底图",
  scene: "场景图",
  selling_point: "卖点图",
  feature: "功能图",
  structure: "结构图",
  detail: "详情图",
};

function roleToLabel(role: string | undefined): string {
  if (!role) return "主图";
  return ROLE_LABELS[role] ?? role;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ResultImage {
  id: string;
  asset_id: string;
  role: string;
  label: string;
  description: string;
  url: string;
  isRegenerating: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ResultStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Generation state
  const [generating, setGenerating] = useState(true);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("AI 正在努力生成图片...");
  const [error, setError] = useState<string | null>(null);

  // Results
  const [images, setImages] = useState<ResultImage[]>([]);
  const [versions, setVersions] = useState<number[]>([]);
  const [currentVersion, setCurrentVersion] = useState<number>(1);

  // Full-screen preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  // Single-image regeneration modal
  const [regenModalOpen, setRegenModalOpen] = useState(false);
  const [regenTargetId, setRegenTargetId] = useState<string | null>(null);
  const [regenInstruction, setRegenInstruction] = useState("");
  const [regenLoading, setRegenLoading] = useState(false);
  const regenTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Global edit modal
  const [globalEditOpen, setGlobalEditOpen] = useState(false);
  const [globalInstruction, setGlobalInstruction] = useState("");
  const [globalEditLoading, setGlobalEditLoading] = useState(false);
  const globalTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Download loading
  const [downloading, setDownloading] = useState(false);

  const sessionId = sessionStorage.getItem("current_session_id") || "";

  // ─── Load results from backend ────────────────────────────────────────────
  const loadResults = useCallback(
    async (sid: string, version?: number) => {
      try {
        const data = await sessionAPI.getResults(sid, version);

        // Backend returns { assets: [...], available_versions: [...] }
        const rawAssets: any[] = data?.assets ?? data?.images ?? data?.results ?? (Array.isArray(data) ? data : []);

        const versionList: number[] = data?.available_versions ?? data?.versions ?? [];

        setImages(
          rawAssets.map((item: any, idx: number) => ({
            id: item.asset_id ?? item.id ?? String(idx + 1),
            asset_id: item.asset_id ?? item.id ?? String(idx + 1),
            role: item.role ?? item.asset_role ?? "hero",
            label: roleToLabel(item.role ?? item.asset_role),
            description: item.slot_id || item.expression_mode || "",
            url: item.image_url ?? item.url ?? "",
            isRegenerating: false,
          }))
        );

        if (versionList.length > 0) {
          setVersions(versionList);
          setCurrentVersion(data?.requested_version ?? versionList[versionList.length - 1]);
        }

        setProgress(100);
        setGenerating(false);
      } catch (err: any) {
        toast({ title: "获取结果失败", description: err.message || "请重试", variant: "destructive" });
        setGenerating(false);
      }
    },
    [toast]
  );

  // ─── On mount: ensure strategy → generate → poll → fetch results ──────────
  useEffect(() => {
    if (!sessionId) {
      toast({ title: "缺少会话", description: "找不到 session_id，请返回重新开始", variant: "destructive" });
      setGenerating(false);
      setError("缺少会话 ID，请返回重新开始");
      return;
    }

    let cancelled = false;
    let fakeTimer: ReturnType<typeof setInterval>;

    (async () => {
      try {
        // Quick fake progress to 40%
        let fakeProgress = 0;
        fakeTimer = setInterval(() => {
          if (cancelled) return;
          fakeProgress += Math.random() * 5 + 1;
          if (fakeProgress > 40) fakeProgress = 40;
          setProgress(Math.round(fakeProgress));
        }, 400);

        // Step 1: Build strategy if not already done
        setStatusText("正在构建生成策略...");
        try {
          await sessionAPI.buildStrategy(sessionId);
        } catch (strategyErr: any) {
          // If strategy already exists, continue; otherwise fail
          if (!strategyErr.message?.includes("already") && !strategyErr.message?.includes("copy not ready")) {
            console.warn("Strategy build warning:", strategyErr.message);
          }
        }

        if (cancelled) return;
        setProgress(45);
        setStatusText("AI 正在努力生成图片...");

        // Step 2: Start generation
        const genResp = await sessionAPI.generateGallery(sessionId);
        const jobId = genResp.job_id || genResp.jobId;

        if (cancelled) return;
        clearInterval(fakeTimer);

        // Step 3: Poll until done
        await jobAPI.pollUntilDone(jobId, (status) => {
          if (cancelled) return;
          const pct = status.progress ?? status.progress_pct ?? 0;
          // Map backend 0-100 to our 50-92 range
          setProgress(Math.min(Math.round(50 + pct * 0.42), 92));
          const stage = status.stage || status.status || "";
          if (stage) setStatusText(`生成中: ${stage}`);
        });

        if (cancelled) return;

        // Step 4: Fetch results
        setStatusText("正在加载生成结果...");
        setProgress(95);
        await loadResults(sessionId);
      } catch (err: any) {
        if (cancelled) return;
        clearInterval(fakeTimer);
        console.error("Generation failed:", err);
        toast({ title: "生成失败", description: err.message || "请重试", variant: "destructive" });
        setError(err.message || "生成失败，请重试");
        setGenerating(false);
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(fakeTimer);
    };
  }, [sessionId, loadResults, toast]);

  // ─── Version switching ────────────────────────────────────────────────────
  const handleVersionChange = async (version: number) => {
    setCurrentVersion(version);
    setGenerating(true);
    setProgress(50);
    setStatusText("正在加载版本...");
    await loadResults(sessionId, version);
  };

  // ─── Full-screen preview ──────────────────────────────────────────────────
  const openPreview = (index: number) => {
    setPreviewIndex(index);
    setPreviewOpen(true);
  };

  const closePreview = () => setPreviewOpen(false);

  const prevPreview = () => {
    setPreviewIndex((i) => (i > 0 ? i - 1 : images.length - 1));
  };

  const nextPreview = () => {
    setPreviewIndex((i) => (i < images.length - 1 ? i + 1 : 0));
  };

  // ─── Single image regeneration ────────────────────────────────────────────
  const openRegenModal = (assetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRegenTargetId(assetId);
    setRegenInstruction("");
    setRegenModalOpen(true);
    setTimeout(() => regenTextareaRef.current?.focus(), 150);
  };

  const confirmRegen = async () => {
    if (!regenTargetId || !sessionId) return;
    setRegenModalOpen(false);
    setRegenLoading(true);

    // Mark the specific image as regenerating
    setImages((prev) =>
      prev.map((img) =>
        img.asset_id === regenTargetId ? { ...img, isRegenerating: true } : img
      )
    );

    try {
      const result = await assetAPI.regenerate(regenTargetId, regenInstruction || "重新生成");

      // If regenerate returns a job_id, poll it
      if (result && result.job_id) {
        await jobAPI.pollUntilDone(result.job_id);
      }

      // Refresh all results
      await loadResults(sessionId, currentVersion !== 1 ? currentVersion : undefined);
      toast({ title: "重新生成完成", description: regenInstruction ? `已按指示调整：${regenInstruction}` : "已重新生成" });
    } catch (err: any) {
      toast({ title: "重新生成失败", description: err.message || "请重试", variant: "destructive" });
    } finally {
      setImages((prev) =>
        prev.map((img) =>
          img.asset_id === regenTargetId ? { ...img, isRegenerating: false } : img
        )
      );
      setRegenLoading(false);
      setRegenTargetId(null);
    }
  };

  // ─── Global edit ──────────────────────────────────────────────────────────
  const openGlobalEdit = () => {
    setGlobalInstruction("");
    setGlobalEditOpen(true);
    setTimeout(() => globalTextareaRef.current?.focus(), 150);
  };

  const confirmGlobalEdit = async () => {
    if (!sessionId) return;
    setGlobalEditOpen(false);
    setGlobalEditLoading(true);

    try {
      const result = await sessionAPI.globalEdit(sessionId, globalInstruction || "整体优化");

      // If globalEdit returns a job_id, poll it
      if (result && result.job_id) {
        await jobAPI.pollUntilDone(result.job_id);
      }

      // Refresh results
      await loadResults(sessionId, currentVersion !== 1 ? currentVersion : undefined);
      toast({
        title: "全局修改完成",
        description: globalInstruction ? `已按指示调整：${globalInstruction}` : "已完成整体优化",
      });
    } catch (err: any) {
      toast({ title: "全局修改失败", description: err.message || "请重试", variant: "destructive" });
    } finally {
      setGlobalEditLoading(false);
      setGlobalInstruction("");
    }
  };

  // ─── Download all ─────────────────────────────────────────────────────────
  const handleDownloadAll = async () => {
    if (!sessionId) return;
    setDownloading(true);
    try {
      const blob = await sessionAPI.downloadResults(sessionId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `smartphoto_results_${sessionId}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "下载成功", description: "图片已打包下载" });
    } catch (err: any) {
      toast({ title: "下载失败", description: err.message || "请重试", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  // ─── Render: generating state ─────────────────────────────────────────────
  if (generating) {
    return (
      <div className="min-h-screen bg-[#f5f6f8]">
        <StepIndicator currentStep={5} step5Label="生成图片" />

        <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
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

  // ─── Render: error state ──────────────────────────────────────────────────
  if (error && images.length === 0) {
    return (
      <div className="min-h-screen bg-[#f5f6f8]">
        <StepIndicator currentStep={5} step5Label="生成图片" />

        <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
            <X className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">生成失败</h2>
          <p className="text-sm text-slate-500 mb-6 text-center max-w-xs">{error}</p>
          <Button
            onClick={() => setLocation("/create/copywriting")}
            variant="outline"
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            返回修改方案
          </Button>
        </div>
      </div>
    );
  }

  // ─── Render: results ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <StepIndicator currentStep={5} step5Label="生成图片" />

      <div className="max-w-2xl mx-auto px-4 pb-36">
        {/* Header */}
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span className="font-bold text-slate-900 text-base">
              已生成 {images.length} 张图片
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Global edit button */}
            <button
              onClick={openGlobalEdit}
              disabled={globalEditLoading}
              className="flex items-center gap-1.5 text-sm text-blue-600 border border-blue-300 rounded-full px-3 py-1.5 bg-white hover:bg-blue-50 transition disabled:opacity-50"
            >
              {globalEditLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Wand2 className="w-3.5 h-3.5" />
              )}
              全局修改
            </button>
          </div>
        </div>

        {/* Version selector */}
        {versions.length > 1 && (
          <div className="flex items-center gap-2 mb-4 px-1">
            <span className="text-sm text-slate-500">版本：</span>
            <div className="flex gap-1.5">
              {versions.map((v) => (
                <button
                  key={v}
                  onClick={() => handleVersionChange(v)}
                  className={`text-sm px-3 py-1 rounded-full transition ${
                    currentVersion === v
                      ? "bg-blue-500 text-white font-medium"
                      : "bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:text-blue-600"
                  }`}
                >
                  V{v}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Global edit loading overlay */}
        {globalEditLoading && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin shrink-0" />
            <span className="text-sm text-blue-700">AI 正在执行全局修改，请稍候...</span>
          </div>
        )}

        {/* Image grid */}
        <div className="grid grid-cols-2 gap-3">
          {images.map((image, index) => (
            <div
              key={image.id}
              className="bg-white rounded-2xl overflow-hidden shadow-sm ring-1 ring-slate-100 hover:shadow-md transition-shadow"
            >
              {/* Image area */}
              <div
                className="relative w-full cursor-pointer group"
                style={{ aspectRatio: "1 / 1" }}
                onClick={() => openPreview(index)}
              >
                {/* Regenerating overlay */}
                {image.isRegenerating && (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-20 gap-2 rounded-t-2xl">
                    <Loader2 className="w-7 h-7 text-white animate-spin" />
                    <span className="text-white text-xs">重新生成中...</span>
                  </div>
                )}

                <img
                  src={image.url}
                  alt={image.label}
                  className="w-full h-full object-cover"
                  draggable={false}
                />

                {/* Hover zoom icon */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow-lg" />
                </div>
              </div>

              {/* Info & actions */}
              <div className="px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    {image.label}
                  </span>
                </div>
                {image.description && (
                  <p className="text-xs text-slate-500 line-clamp-2 mb-2">
                    {image.description}
                  </p>
                )}
                <button
                  onClick={(e) => openRegenModal(image.asset_id, e)}
                  disabled={image.isRegenerating || regenLoading}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-300 rounded-full px-2.5 py-1 transition disabled:opacity-40 bg-slate-50 hover:bg-blue-50 w-full justify-center"
                >
                  <RefreshCw className="w-3 h-3" />
                  重新生成
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Bottom action bar ───────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-30">
        <div className="bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            {/* Back to copywriting */}
            <Button
              variant="outline"
              onClick={() => setLocation("/create/copywriting")}
              className="gap-1.5 rounded-xl shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              返回修改方案
            </Button>

            {/* Download all */}
            <Button
              variant="outline"
              onClick={handleDownloadAll}
              disabled={downloading || images.length === 0}
              className="gap-1.5 rounded-xl shrink-0"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              下载全部图片
            </Button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Generate HD watermark-free images */}
            <Button
              onClick={() => setLocation("/create/payment")}
              disabled={images.length === 0}
              className="gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-200 active:scale-95 transition-all px-6"
            >
              <Sparkles className="w-4 h-4" />
              生成无水印高清图
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Full-screen preview modal ───────────────────────────────────── */}
      {previewOpen && images[previewIndex] && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
          {/* Close button */}
          <button
            onClick={closePreview}
            className="absolute top-4 right-4 text-white/80 hover:text-white z-10"
          >
            <X className="w-7 h-7" />
          </button>

          {/* Prev button */}
          {images.length > 1 && (
            <button
              onClick={prevPreview}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white bg-black/30 hover:bg-black/50 rounded-full p-2 transition z-10"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Image */}
          <div className="max-w-[90vw] max-h-[85vh] flex flex-col items-center">
            <img
              src={images[previewIndex].url}
              alt={images[previewIndex].label}
              className="max-w-full max-h-[75vh] object-contain rounded-lg"
            />
            <div className="mt-3 text-center">
              <span className="text-white font-medium text-sm">
                {images[previewIndex].label}
              </span>
              {images[previewIndex].description && (
                <p className="text-white/60 text-xs mt-1 max-w-md">
                  {images[previewIndex].description}
                </p>
              )}
              <p className="text-white/40 text-xs mt-1">
                {previewIndex + 1} / {images.length}
              </p>
            </div>
          </div>

          {/* Next button */}
          {images.length > 1 && (
            <button
              onClick={nextPreview}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white bg-black/30 hover:bg-black/50 rounded-full p-2 transition z-10"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Click backdrop to close */}
          <div className="absolute inset-0 -z-10" onClick={closePreview} />
        </div>
      )}

      {/* ─── Single-image regeneration modal ─────────────────────────────── */}
      {regenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setRegenModalOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl px-5 pt-5 pb-8 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />

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
              告诉 AI 你希望如何调整这张图片（留空则直接重新生成）
            </p>

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
              {["背景换白色", "产品更突出", "文字更大", "去掉文字", "换横版构图", "色调更暖"].map(
                (tag) => (
                  <button
                    key={tag}
                    onClick={() =>
                      setRegenInstruction((prev) =>
                        prev ? `${prev}，${tag}` : tag
                      )
                    }
                    className="text-xs text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-full px-3 py-1 transition"
                  >
                    + {tag}
                  </button>
                )
              )}
            </div>

            <button
              onClick={confirmRegen}
              className="w-full bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              确认，开始重新生成
            </button>
          </div>
        </div>
      )}

      {/* ─── Global edit modal ───────────────────────────────────────────── */}
      {globalEditOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setGlobalEditOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl px-5 pt-5 pb-8 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />

            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-slate-900 text-base">全局修改</h3>
              <button
                onClick={() => setGlobalEditOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              告诉 AI 你希望对所有图片做哪些整体调整
            </p>

            <textarea
              ref={globalTextareaRef}
              value={globalInstruction}
              onChange={(e) => setGlobalInstruction(e.target.value)}
              placeholder="例如：整体色调更暖、产品放大一些、背景更简洁、增加品牌感..."
              rows={4}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />

            {/* Quick tag suggestions */}
            <div className="flex flex-wrap gap-2 mt-3 mb-5">
              {[
                "色调更暖",
                "产品放大",
                "背景更简洁",
                "增加品牌感",
                "对比度更强",
                "去除杂乱元素",
              ].map((tag) => (
                <button
                  key={tag}
                  onClick={() =>
                    setGlobalInstruction((prev) =>
                      prev ? `${prev}，${tag}` : tag
                    )
                  }
                  className="text-xs text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-full px-3 py-1 transition"
                >
                  + {tag}
                </button>
              ))}
            </div>

            <button
              onClick={confirmGlobalEdit}
              className="w-full bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition active:scale-95"
            >
              <Wand2 className="w-4 h-4" />
              确认，开始全局修改
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
