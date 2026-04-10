import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  CloudUpload,
  Crown,
  Download,
  Info,
  Loader2,
  Pencil,
  Share2,
  Sparkles,
  X,
  History,
  MessageSquare,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import GenerationWaitingUI from "@/components/GenerationWaitingUI";
import { useToast } from "@/hooks/use-toast";
import { getLoginUrl } from "@/const";
import { jobAPI, sessionAPI, type VersionSummary } from "@/lib/api";
import { resolveGenerationStageText } from "@/lib/generationStatus";
import { updateSessionRecord } from "@/lib/localUser";
import { useAuth } from "@/contexts/AuthContext";
import { QualityBadge } from "@/components/QualityBadge";
import { FailedAssetCard } from "@/components/FailedAssetCard";
import { AssetHistoryDrawer } from "@/components/AssetHistoryDrawer";
import { AssetFeedbackModal } from "@/components/AssetFeedbackModal";
import { useQualityPolling } from "@/hooks/useQualityPolling";

import { DetailStepIndicator } from "./DetailStepIndicator";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type DetailPanel = {
  asset_id: string;
  panel_id?: string;
  slot_id?: string;
  panel_label?: string | null;
  narrative_section?: string | null;
  panel_goal?: string | null;
  copy_focus?: string | null;
  panel_type?: string | null;
  visual_truth_mode?: string | null;
  origin_note?: string | null;
  image_url: string;
  thumbnail_url?: string | null;
  display_order: number;
  version_no?: number;
  carry_forward?: boolean;
  source_version_no?: number | null;
  fidelity_validation_status?: string | null;
  display_module_intent?: string | null;
  display_tags?: string[] | null;
  status?: string;
  quality_status?: string;
  quality_scores?: Record<string, any> | null;
  failure_reason?: string | null;
};

type DetailResultsPayload = {
  session_id: string;
  status: string;
  detail_generation_round: number;
  detail_latest_result_version: number;
  requested_version: number;
  available_versions: number[];
  version_summaries: VersionSummary[];
  expected_panel_ids?: string[];
  missing_panel_ids?: string[];
  summary: {
    total_count: number;
    ready_count: number;
    panel_count: number;
    expected_panel_count?: number;
  };
  panels: DetailPanel[];
};

interface DetailImage {
  id: string;
  label: string;
  url: string;
  editOpen: boolean;
  isRegenerating: boolean;
  carry_forward?: boolean;
  source_version_no?: number | null;
  fidelity_validation_status?: string | null;
  status?: string;
  quality_status?: string;
  quality_scores?: Record<string, any> | null;
  failure_reason?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function triggerBrowserDownload(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function normalizeDetailResults(data: any): DetailResultsPayload {
  const panels = Array.isArray(data?.panels) ? data.panels : [];
  const sortedPanels: DetailPanel[] = panels
    .map((panel: any, index: number) => ({
      asset_id: String(panel?.asset_id || `${index + 1}`),
      panel_id: panel?.panel_id ?? null,
      slot_id: panel?.slot_id ?? null,
      panel_label: panel?.panel_label ?? panel?.panel_id ?? `详情图 ${index + 1}`,
      narrative_section: panel?.narrative_section ?? null,
      panel_goal: panel?.panel_goal ?? null,
      copy_focus: panel?.copy_focus ?? null,
      panel_type: panel?.panel_type ?? null,
      visual_truth_mode: panel?.visual_truth_mode ?? null,
      display_module_title: panel?.display_module_title ?? null,
      display_module_kind: panel?.display_module_kind ?? null,
      display_module_intent: panel?.display_module_intent ?? null,
      display_tags: Array.isArray(panel?.display_tags) ? panel.display_tags : null,
      origin_note: panel?.origin_note ?? null,
      image_url: String(panel?.image_url || panel?.thumbnail_url || ""),
      thumbnail_url: panel?.thumbnail_url ?? null,
      display_order: Number(panel?.display_order ?? index),
      carry_forward: Boolean(panel?.carry_forward),
      source_version_no: typeof panel?.source_version_no === "number" ? panel.source_version_no : null,
      fidelity_validation_status: panel?.fidelity_validation_status ?? null,
      status: panel?.status ?? null,
      quality_status: panel?.quality_status ?? "unchecked",
      quality_scores: panel?.quality_scores ?? null,
      failure_reason: panel?.failure_reason ?? null,
    }))
    .sort((a: DetailPanel, b: DetailPanel) => a.display_order - b.display_order);

  return {
    session_id: String(data?.session_id || ""),
    status: String(data?.status || ""),
    detail_generation_round: Number(data?.detail_generation_round || 0),
    detail_latest_result_version: Number(
      data?.detail_latest_result_version || data?.requested_version || 0,
    ),
    requested_version: Number(data?.requested_version || data?.detail_latest_result_version || 0),
    available_versions: Array.isArray(data?.available_versions)
      ? data.available_versions.map((item: any) => Number(item || 0)).filter(Boolean)
      : [],
    version_summaries: Array.isArray(data?.version_summaries) ? data.version_summaries : [],
    expected_panel_ids: Array.isArray(data?.expected_panel_ids) ? data.expected_panel_ids : [],
    missing_panel_ids: Array.isArray(data?.missing_panel_ids) ? data.missing_panel_ids : [],
    summary: {
      total_count: Number(data?.summary?.total_count || sortedPanels.length),
      ready_count: Number(data?.summary?.ready_count || sortedPanels.length),
      panel_count: Number(data?.summary?.panel_count || sortedPanels.length),
      expected_panel_count: Number(data?.summary?.expected_panel_count || sortedPanels.length),
    },
    panels: sortedPanels,
  };
}

function normalizeDetailGenerationError(error: any) {
  const raw = String(error?.message || error || "").trim();
  const code = String(error?.code || "").trim();
  const upstreamReason = String(error?.result_payload?.upstream_reason || "").trim();
  const upstreamStatus = Number(error?.result_payload?.upstream_http_status || 0);
  if (
    code === "42901" ||
    upstreamReason === "rate_limited" ||
    upstreamStatus === 429 ||
    raw.includes("Too Many Requests") ||
    raw.includes("429")
  ) {
    return "上游模型当前限流，请稍后重试。";
  }
  return raw || "详情图生成失败";
}

function saveBrandStyleProfile(payload: {
  brandName: string;
  sessionId: string;
  version: number;
  panelCount: number;
}) {
  const key = "saved_brand_style_profiles";
  try {
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    const safeExisting = Array.isArray(existing) ? existing : [];
    safeExisting.unshift({
      brand_name: payload.brandName,
      session_id: payload.sessionId,
      version: payload.version,
      panel_count: payload.panelCount,
      saved_at: new Date().toISOString(),
    });
    localStorage.setItem(key, JSON.stringify(safeExisting.slice(0, 20)));
  } catch {
    localStorage.setItem(
      key,
      JSON.stringify([
        {
          brand_name: payload.brandName,
          session_id: payload.sessionId,
          version: payload.version,
          panel_count: payload.panelCount,
          saved_at: new Date().toISOString(),
        },
      ]),
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DetailResultStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  const sessionId = sessionStorage.getItem("current_session_id") || "";

  const [phase, setPhase] = useState<"loading" | "done" | "error">("loading");
  const [progress, setProgress] = useState(8);
  const [loadingText, setLoadingText] = useState("正在生成详情图...");
  const [error, setError] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [historyAssetId, setHistoryAssetId] = useState<string | null>(null);
  const [feedbackAssetId, setFeedbackAssetId] = useState<string | null>(null);

  const generateStartRef = useRef(Date.now());
  const [downloading, setDownloading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [results, setResults] = useState<DetailResultsPayload | null>(null);
  const [currentVersion, setCurrentVersion] = useState(0);
  const [brandOpen, setBrandOpen] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [brandSavedName, setBrandSavedName] = useState("");
  const [brandSuccessOpen, setBrandSuccessOpen] = useState(false);

  // UI state for image editing
  const [images, setImages] = useState<DetailImage[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  /* ---------------------------------------------------------------- */
  /*  API helpers                                                      */
  /* ---------------------------------------------------------------- */

  async function fetchDetailResults(version?: number) {
    const data = await sessionAPI.getDetailResults(sessionId, version);
    const normalized = normalizeDetailResults(data);
    const resolvedVersion =
      normalized.requested_version ||
      normalized.detail_latest_result_version ||
      version ||
      0;

    setResults(normalized);
    setCurrentVersion(resolvedVersion);
    sessionStorage.setItem("detail_current_version", String(resolvedVersion));

    // Build images for UI
    setImages(
      normalized.panels.map((panel, index) => ({
        id: panel.asset_id,
        label: panel.display_module_title || panel.panel_label || `详情图 ${index + 1}`,
        url: panel.image_url,
        editOpen: false,
        isRegenerating: false,
        text: panel.display_module_title || panel.panel_label || `详情图 ${index + 1}`,
        carry_forward: panel.carry_forward,
        source_version_no: panel.source_version_no,
        fidelity_validation_status: panel.fidelity_validation_status,
        status: panel.status,
        quality_status: panel.quality_status,
        quality_scores: panel.quality_scores,
        failure_reason: panel.failure_reason,
      }))
    );

    return normalized;
  }

  async function waitForDetailGeneration(jobId: string, initialText = "正在生成详情图...") {
    setPhase("loading");
    setError("");
    setLoadingText(initialText);
    setProgress(8);

    await jobAPI.pollUntilDone(
      jobId,
      (status) => {
        const nextProgress = Number(status?.progress || 0);
        if (nextProgress > 0) {
          setProgress(Math.max(8, Math.min(99, nextProgress)));
        }
        setLoadingText(resolveGenerationStageText(status?.stage || status?.status, "detail").title);
      },
      2000,
      300000,
    );

    const snapshot = await sessionAPI.get(sessionId);
    const targetVersion = snapshot.detail_latest_result_version || undefined;
    await fetchDetailResults(targetVersion);
    setProgress(100);
    setPhase("done");
    if (sessionId) updateSessionRecord(sessionId, { last_step: "detail-result" });
  }

  async function startGeneration() {
    const generation = await sessionAPI.generateDetailPage(sessionId);
    const jobId = generation?.job_id || generation?.jobId;
    if (!jobId) {
      throw new Error("未拿到详情图任务 ID");
    }
    await waitForDetailGeneration(jobId);
  }

  /* ---------------------------------------------------------------- */
  /*  Bootstrap                                                        */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!sessionId) {
        setLocation("/create/detail-confirm");
        return;
      }

      try {
        setError("");
        setPhase("loading");

        const snapshot = await sessionAPI.get(sessionId);
        if (cancelled) return;

        // If results already exist, show them directly
        if (Number(snapshot.detail_latest_result_version || 0) > 0) {
          setLoadingText("正在加载详情结果...");
          setProgress(30);
          await fetchDetailResults(snapshot.detail_latest_result_version || undefined);
          if (cancelled) return;
          setProgress(100);
          setPhase("done");
          if (sessionId) updateSessionRecord(sessionId, { last_step: "detail-result" });
          return;
        }

        // Payment gate: if not paid, redirect to detail payment page
        const paymentSuccess = sessionStorage.getItem("detail_payment_success");
        if (!paymentSuccess) {
          setLocation("/create/detail-payment");
          return;
        }

        // Clear one-time payment flag
        sessionStorage.removeItem("detail_payment_success");

        // If a generation job is in progress, resume polling
        if (snapshot.latest_detail_generate_job_id) {
          const latestJob = await jobAPI.getStatus(snapshot.latest_detail_generate_job_id).catch(() => null);
          if (latestJob && !["failed", "error"].includes(String(latestJob.status || "").toLowerCase())) {
            await waitForDetailGeneration(
              snapshot.latest_detail_generate_job_id,
              "正在恢复已有详情图任务...",
            );
            return;
          }
        }

        // Paid but no results and no running job — start generation
        try {
          setPhase("loading");
          setLoadingText("正在启动详情图生成...");
          setProgress(8);
          await startGeneration();
        } catch (genErr: any) {
          if (!cancelled) {
            setPhase("error");
            setError(normalizeDetailGenerationError(genErr));
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setPhase("error");
          setError(normalizeDetailGenerationError(err));
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [sessionId, setLocation, toast]);

  const needsQualityPolling = images.some(img => img.quality_status === "pending_async_review");
  useQualityPolling(needsQualityPolling, async () => {
    await fetchDetailResults(currentVersion || undefined);
  });

  /* ---------------------------------------------------------------- */
  /*  UI Handlers                                                      */
  /* ---------------------------------------------------------------- */

  const handleRetry = async () => {
    if (!sessionId || regenerating) return;
    try {
      setRegenerating(true);
      await startGeneration();
      toast({ title: "已重新生成详情图", description: "当前显示的是最新生成结果。" });
    } catch (err: any) {
      setPhase("error");
      setError(normalizeDetailGenerationError(err));
    } finally {
      setRegenerating(false);
    }
  };

  const handleDownloadAll = async () => {
    if (!sessionId || !results) return;
    try {
      setDownloading(true);
      const blob = await sessionAPI.downloadDetailResults(sessionId, currentVersion || undefined);
      const url = URL.createObjectURL(blob);
      triggerBrowserDownload(url, `detail-page-v${currentVersion || 1}.zip`);
      URL.revokeObjectURL(url);
      toast({ title: "开始下载", description: "详情图压缩包已开始下载。" });
    } catch (err: any) {
      toast({ title: "下载失败", description: err?.message || "请稍后重试。", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const toggleEdit = (id: string) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === id ? { ...img, editOpen: !img.editOpen } : { ...img, editOpen: false }
      )
    );
  };

  const updateText = (id: string, value: string) => {
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, text: value } : img)));
  };

  const saveText = (id: string) => {
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, editOpen: false } : img)));
    toast({ title: "文字已保存" });
  };

  const handleAssetRegenerate = async (id: string) => {
    if (!sessionId || regenerating) return;
    try {
      setImages((prev) => prev.map((img) => (img.id === id ? { ...img, isRegenerating: true } : img)));
      const response = await assetAPI.regenerate(id, "重新生成");
      if (response?.job_id) {
        await jobAPI.pollUntilDone(response.job_id);
      }
      await fetchDetailResults(currentVersion);
      toast({ title: "重新生成完成" });
    } catch (err: any) {
      toast({ title: "重新生成失败", description: err?.message || "请稍后重试。", variant: "destructive" });
    } finally {
      setImages((prev) => prev.map((img) => (img.id === id ? { ...img, isRegenerating: false } : img)));
    }
  };

  const handleSaveBrand = () => {
    const trimmed = brandName.trim();
    if (!trimmed || !results) return;
    saveBrandStyleProfile({
      brandName: trimmed,
      sessionId,
      version: currentVersion || results.detail_latest_result_version || 1,
      panelCount: results.summary.panel_count || results.panels.length,
    });
    setBrandSavedName(trimmed);
    setBrandOpen(false);
    setBrandName("");
    setBrandSuccessOpen(true);
  };

  const handleBrandSuccessClose = () => {
    setBrandSuccessOpen(false);
    const keysToRemove = [
      "uploadSlotPreviews", "uploadedImageUrls", "uploadedCount",
      "uploadedImages", "selectedProductType", "selectedPlatform",
      "selectedTheme", "analysisResult", "productParams",
      "copywritings", "selectedImgCount", "selectedPlans",
      "paymentSuccess", "generatedImages", "hdImages",
      "hdImgCount", "hdFromPreview", "hdPaymentSuccess",
      "detailCopySections", "detailPaymentSuccess",
      "current_session_id", "current_result_version",
      "selected_asset_ids", "detail_current_version",
    ];
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
    setLocation("/");
  };

  const productType = sessionStorage.getItem("selectedProductType") || "产品";

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div className="min-h-screen aurora-bg flex flex-col">
      <DetailStepIndicator currentStep={4} />

      {/* Loading phase */}
      {phase === "loading" && (
        <GenerationWaitingUI
          kind="detail"
          progress={progress}
          stage={loadingText}
        />
      )}

      {/* Error phase */}
      {phase === "error" && (
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 relative z-10 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 border border-red-200 shadow-sm">
            <AlertCircle className="h-10 w-10 text-red-400" />
          </div>
          <div>
            <p className="mb-2 text-xl font-bold tracking-widest text-slate-900">详情图生成失败</p>
            <p className="mb-8 max-w-sm text-center text-sm font-medium tracking-wide text-slate-500">{error}</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocation("/create/detail-confirm")}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 backdrop-blur-md px-6 py-3 text-sm font-bold tracking-widest text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
            >
              返回上一步
            </button>
            <button
              onClick={handleRetry}
              className="rounded-xl border border-blue-300 bg-blue-600/20 px-6 py-3 text-sm font-bold tracking-widest text-blue-600 transition hover:bg-blue-500/30 hover:text-blue-600 shadow-sm"
            >
              重试
            </button>
          </div>
        </div>
      )}

      {/* Done phase */}
      {phase === "done" && (
        <div className="flex-1 flex flex-col w-full max-w-7xl mx-auto px-4 md:px-8 mt-4">
          {/* success banner */}
          <div className="glass-panel border-blue-300 bg-blue-50 px-4 py-4 flex items-center gap-4 rounded-2xl mb-6 shadow-sm relative z-10">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full flex items-center justify-center shrink-0 shadow-sm">
              <Crown className="w-5 h-5 text-slate-900" />
            </div>
            <div className="flex-1">
              <p className="text-base font-bold tracking-widest text-slate-900">详情图生成成功！</p>
              <p className="text-sm font-medium text-blue-600/80 tracking-wide mt-0.5">无水印 · 可直接用于电商上架</p>
            </div>
          </div>

          {/* partial warning banner */}
          {results?.missing_panel_ids && results.missing_panel_ids.length > 0 && (
            <div className="glass-panel border-orange-500/30 bg-orange-50 px-4 py-3 flex items-center gap-3 rounded-2xl mb-6 shadow-sm relative z-10">
              <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4 text-orange-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold tracking-widest text-orange-200">本版缺少 {results.missing_panel_ids.length} 个模块</p>
                <p className="text-xs font-medium text-orange-400/80 tracking-wide mt-0.5">如果影响使用，可尝试重新生成以补全缺失的内容</p>
              </div>
            </div>
          )}

          {/* version select & image count */}
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-3 pl-2">
              <div className="w-1.5 h-5 bg-blue-500 rounded-full shadow-sm"></div>
              <span className="text-base font-bold tracking-widest text-slate-900">长图分解列表</span>
              <span className="text-xs font-medium bg-slate-200 px-2 py-0.5 rounded text-blue-600">{images.length} 块</span>
            </div>
            {results && results.available_versions.length > 1 && (
            <div className="flex items-center gap-2 relative z-50">
                <span className="text-sm font-bold tracking-wide text-slate-500">生成版本历史:</span>
                <VersionSelector
                  versions={results.available_versions}
                  currentVersion={currentVersion || results.detail_latest_result_version || 0}
                  summaries={results.version_summaries}
                  onSelectVersion={(v) => {
                    setPhase("loading");
                    setLoadingText(`正在加载 V${v}...`);
                    setProgress(20);
                    fetchDetailResults(v).then(() => {
                      setPhase("done");
                      setProgress(100);
                    }).catch((err) => {
                      setPhase("error");
                      setError(err.message);
                    });
                  }}
                />
            </div>
            )}
          </div>

          {/* image list */}
          <div className="flex-1 pb-36 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 relative z-10">
            {images.map((img) => {
              if (!img.url && img.status === "failed") {
                return (
                  <div key={img.id} className="h-full w-full">
                    <FailedAssetCard
                      label={img.label}
                      productName={productType}
                      reason={img.failure_reason}
                      onRetry={() => handleAssetRegenerate(img.id)}
                      isRegenerating={img.isRegenerating}
                    />
                  </div>
                );
              }

              return (
              <div key={img.id} className="glass-panel overflow-hidden rounded-[24px] shadow-md shadow-black/40 border border-slate-200 hover:border-blue-400 transition-all flex flex-col group">
                {/* image */}
                <div 
                  className="relative select-none cursor-zoom-in" 
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={() => setPreviewImage(img.url)}
                >
                  {img.isRegenerating ? (
                    <div className="w-full flex items-center justify-center bg-slate-50" style={{ minHeight: "200px" }}>
                      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    </div>
                  ) : (
                    <>
                      <img
                        src={img.url}
                        alt={img.label}
                        className="w-full object-cover pointer-events-none rounded-t-[24px] transition-transform duration-700 group-hover:scale-[1.02]"
                        draggable={false}
                        style={{ maxHeight: "400px" }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-blue-900/10 transition-colors pointer-events-none" />
                    </>
                  )}

                  {/* carry forward badge */}
                  <div className="absolute top-3 left-3 z-30 flex flex-col items-start gap-1.5">
                    {img.carry_forward && img.source_version_no != null && (
                      <div className="rounded-full bg-white/90 backdrop-blur-sm border border-slate-300 px-2 py-0.5 text-[10px] font-bold tracking-widest text-slate-700 shadow-sm">
                        沿用自 V{img.source_version_no}
                      </div>
                    )}
                    <QualityBadge status={img.quality_status} reason={img.failure_reason} />
                  </div>

                  {/* fidelity badge */}
                  {img.fidelity_validation_status === 'passed' && (
                    <div className="absolute bottom-3 left-3 z-20">
                      <div className="rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold tracking-widest text-emerald-400 shadow-sm">
                        保真通过
                      </div>
                    </div>
                  )}
                  {img.fidelity_validation_status === 'failed' && (
                    <div className="absolute bottom-3 left-3 z-20">
                      <div className="rounded-full bg-red-500/20 backdrop-blur-md border border-red-500/40 px-2 py-0.5 text-[10px] font-bold tracking-widest text-red-400 shadow-sm">
                        保真受限
                      </div>
                    </div>
                  )}
                </div>

                {/* bottom action row */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 backdrop-blur-md">
                  <span className="text-sm font-bold tracking-wide text-slate-600">{productType} · {img.label}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleEdit(img.id)}
                      className={`flex items-center gap-1.5 text-xs font-bold tracking-wide shadow-sm rounded-full px-3 py-1 border transition
                        ${img.editOpen
                          ? "text-blue-600 border-blue-400 bg-blue-500"
                          : "text-blue-600 border-blue-300 bg-blue-100 hover:bg-blue-500"
                        }`}
                    >
                      <Pencil className="w-3 h-3" />
                      修改
                    </button>
                    <button
                      onClick={() => setHistoryAssetId(img.id)}
                      className="flex items-center justify-center w-7 h-7 rounded-full border border-slate-200 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 transition shadow-sm text-slate-600"
                      title="版本历史"
                    >
                      <History className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setFeedbackAssetId(img.id)}
                      className="flex items-center justify-center w-7 h-7 rounded-full border border-slate-200 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 transition shadow-sm text-slate-600"
                      title="反馈质量"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* edit panel */}
                {img.editOpen && (
                  <div className="border-t border-slate-200 px-4 pb-4 pt-3 bg-white/80 backdrop-blur-md">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold tracking-widest text-slate-500 w-14 shrink-0">标注文字</span>
                        <input
                          value={img.text}
                          onChange={(e) => updateText(img.id, e.target.value)}
                          className="flex-1 text-sm bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                          placeholder="输入标注文字"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => saveText(img.id)}
                      className="mt-4 w-full flex items-center justify-center gap-1.5 text-sm font-bold tracking-widest text-slate-900 bg-blue-600 hover:bg-blue-500 rounded-xl py-2.5 transition-all shadow-sm"
                    >
                      <Check className="w-4 h-4" />
                      保存修改
                    </button>
                  </div>
                )}
              </div>
            )})}
          </div>

          {/* fixed bottom: login bar + action buttons */}
          <div className="fixed bottom-0 left-0 right-0 z-30">
            {/* login prompt (hidden when logged in) */}
            {!isAuthenticated && (
              <div className="bg-white border-t border-slate-200 px-4 py-2 flex items-center justify-center">
                <div className="max-w-5xl w-full flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-300 flex items-center justify-center shrink-0">
                    <CloudUpload className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold tracking-widest text-slate-700">登录后可云端保存资料与历史</p>
                    <p className="text-xs font-medium tracking-wide text-slate-500">当前数据仅保存在浏览器内</p>
                  </div>
                  <a
                    href={getLoginUrl()}
                    className="shrink-0 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 text-xs font-bold tracking-widest px-4 py-2 rounded-xl transition-all"
                  >
                    前往登录
                  </a>
                </div>
              </div>
            )}
            {/* action buttons */}
            <div className="border-t border-slate-200 bg-white/90 backdrop-blur-xl px-4 py-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
              <div className="max-w-5xl w-full mx-auto flex gap-3">
                <Button size="lg" className="flex-1 text-slate-600 font-bold tracking-widest bg-slate-100 border border-slate-200 hover:bg-slate-200 rounded-2xl h-14" onClick={handleDownloadAll} disabled={downloading}>
                  {downloading ? <Loader2 className="w-5 h-5 animate-spin mr-1" /> : <Download className="w-5 h-5 mr-1" />}
                  一键打包下载
                </Button>
                <Button size="icon" variant="outline" className="h-14 w-14 border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-blue-600 rounded-2xl shrink-0 transition-colors shadow-lg" onClick={() => setShareOpen(true)}>
                  <Share2 className="w-5 h-5" />
                </Button>
                <Button size="lg" className="sci-fi-button flex-[1.5] bg-blue-600 font-bold tracking-widest text-base shadow-md rounded-2xl h-14 gap-2 text-white" onClick={() => setBrandOpen(true)}>
                  <Crown className="w-5 h-5 fill-white/50" />
                  保存品牌风格
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* brand save modal (bottom sheet) */}
      {brandOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setBrandOpen(false)}>
          <div className="absolute inset-0 bg-white/80" />
          <div
            className="relative bg-white rounded-t-2xl w-full max-w-sm pb-8 pt-5 px-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setBrandOpen(false)}
              className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-1">保存品牌/店铺风格?</h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              模型可以记录你生成过的品牌风格偏好，以后生成该品牌图片时，选择品牌会将相应可自动应用一致风格。
            </p>

            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">品牌 / 店铺名称</label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="例如：NaoNao宠物、小米官方旗舰店"
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder:text-slate-600"
              />
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-4 mb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-sm font-semibold text-blue-900">保存品牌风格</span>
                <Info className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-3">
                模型可以记录你生成过的品牌风格。以后生成的同品牌图片时，选择品牌即可自动生成一致风格。
              </p>
              <ul className="space-y-1.5">
                {["产品实拍", "全套展示", "渲染图", "详情页注版"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={handleSaveBrand}
              disabled={!brandName.trim()}
              className={`w-full h-11 rounded-2xl font-semibold text-sm transition-colors ${
                brandName.trim()
                  ? "bg-blue-500 hover:bg-blue-600 text-slate-900"
                  : "bg-slate-100 text-slate-600 cursor-not-allowed"
              }`}
            >
              保存品牌风格
            </button>
          </div>
        </div>
      )}

      {/* brand save success modal */}
      {brandSuccessOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-white/80" />
          <div className="relative bg-white rounded-3xl w-full max-w-sm px-6 py-8 shadow-2xl flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-green-200">
              <CheckCircle2 className="w-8 h-8 text-slate-900" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              已为您记住「{brandSavedName}」品牌风格
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              下次生成该品牌图片时，选择「{brandSavedName}」将自动应用一致风格，无需重复设置。
            </p>
            <button
              onClick={handleBrandSuccessClose}
              className="w-full h-11 rounded-2xl bg-blue-500 hover:bg-blue-600 text-slate-900 font-semibold text-sm transition-colors"
            >
              好的，返回主页
            </button>
          </div>
        </div>
      )}

      {/* share modal (bottom sheet) */}
      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShareOpen(false)}>
          <div className="absolute inset-0 bg-white/80" />
          <div className="relative bg-white rounded-t-2xl w-full max-w-sm pb-8 pt-5 px-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">选择分享方式</h3>
              <button onClick={() => setShareOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <button
              className="w-full h-11 rounded-full bg-blue-500 hover:bg-blue-600 text-slate-900 font-semibold text-sm transition-colors"
              onClick={async () => {
                await navigator.clipboard.writeText(window.location.href);
                toast({ title: "已复制链接" });
                setShareOpen(false);
              }}
            >
              复制链接
            </button>
          </div>
        </div>
      )}

      <AssetHistoryDrawer
        assetId={historyAssetId || ""}
        currentVersionNo={currentVersion ?? undefined}
        open={!!historyAssetId}
        onClose={() => setHistoryAssetId(null)}
        onRestoreSuccess={() => fetchDetailResults(currentVersion || undefined)}
      />

      <AssetFeedbackModal
        assetId={feedbackAssetId || ""}
        open={!!feedbackAssetId}
        onClose={() => setFeedbackAssetId(null)}
      />
    </div>
  );
}
