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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import GenerationWaitingUI from "@/components/GenerationWaitingUI";
import { useToast } from "@/hooks/use-toast";
import { getLoginUrl } from "@/const";
import { jobAPI, sessionAPI, type VersionSummary } from "@/lib/api";
import { resolveGenerationStageText } from "@/lib/generationStatus";
import { updateSessionRecord } from "@/lib/localUser";
import { useAuth } from "@/contexts/AuthContext";

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
  display_module_title?: string | null;
  display_module_kind?: string | null;
  display_module_intent?: string | null;
  display_tags?: string[] | null;
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
  text: string;
  carry_forward?: boolean;
  source_version_no?: number | null;
  fidelity_validation_status?: string | null;
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
      version_no: typeof panel?.version_no === "number" ? panel.version_no : undefined,
      carry_forward: Boolean(panel?.carry_forward),
      source_version_no: typeof panel?.source_version_no === "number" ? panel.source_version_no : null,
      fidelity_validation_status: panel?.fidelity_validation_status ?? null,
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
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-950/40 border border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
            <AlertCircle className="h-10 w-10 text-red-400" />
          </div>
          <div>
            <p className="mb-2 text-xl font-bold tracking-widest text-slate-100">详情图生成失败</p>
            <p className="mb-8 max-w-sm text-center text-sm font-medium tracking-wide text-slate-400">{error}</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocation("/create/detail-confirm")}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md px-6 py-3 text-sm font-bold tracking-widest text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              返回上一步
            </button>
            <button
              onClick={handleRetry}
              className="rounded-xl border border-cyan-500/30 bg-cyan-600/20 px-6 py-3 text-sm font-bold tracking-widest text-cyan-400 transition hover:bg-cyan-500/30 hover:text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
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
          <div className="glass-panel border-cyan-500/30 bg-cyan-900/20 px-4 py-4 flex items-center gap-4 rounded-2xl mb-6 shadow-[0_0_15px_rgba(6,182,212,0.1)] relative z-10">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(34,211,238,0.5)]">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-base font-bold tracking-widest text-slate-100">详情图生成成功！</p>
              <p className="text-sm font-medium text-cyan-400/80 tracking-wide mt-0.5">无水印 · 可直接用于电商上架</p>
            </div>
          </div>

          {/* partial warning banner */}
          {results?.missing_panel_ids && results.missing_panel_ids.length > 0 && (
            <div className="glass-panel border-orange-500/30 bg-orange-900/20 px-4 py-3 flex items-center gap-3 rounded-2xl mb-6 shadow-[0_0_15px_rgba(249,115,22,0.1)] relative z-10">
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
              <div className="w-1.5 h-5 bg-cyan-500 rounded-full shadow-[0_0_8px_#06b6d4]"></div>
              <span className="text-base font-bold tracking-widest text-slate-100">长图分解列表</span>
              <span className="text-xs font-medium bg-white/10 px-2 py-0.5 rounded text-cyan-300">{images.length} 块</span>
            </div>
            {results && results.available_versions.length > 1 && (
            <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-wide text-slate-400">生成版本历史:</span>
                <select
                  value={currentVersion || results.detail_latest_result_version || ""}
                  onChange={(e) => {
                    setPhase("loading");
                    setLoadingText(`正在加载 V${e.target.value}...`);
                    setProgress(20);
                    fetchDetailResults(Number(e.target.value)).then(() => {
                      setPhase("done");
                      setProgress(100);
                    }).catch((err) => {
                      setPhase("error");
                      setError(err.message);
                    });
                  }}
                  className="rounded-lg border border-white/20 bg-black/40 backdrop-blur-md px-3 py-1.5 text-sm font-bold tracking-wide text-slate-200 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500/50"
                >
                  {results.available_versions.map((v) => {
                    const tag = v === results.detail_latest_result_version ? " (最新)" : "";
                    const vSum = results.version_summaries?.find((vs) => vs.version_no === v);
                    const counts = vSum ? ` [${vSum.ready_count}/${vSum.asset_count}图]` : "";
                    return (
                      <option key={v} value={v}>
                        Version {v}{tag}{counts}
                      </option>
                    );
                  })}
                </select>
            </div>
            )}
          </div>

          {/* image list */}
          <div className="flex-1 pb-36 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 relative z-10">
            {images.map((img) => (
              <div key={img.id} className="glass-panel overflow-hidden rounded-[24px] shadow-md shadow-black/40 border border-white/5 hover:border-cyan-500/30 transition-all flex flex-col">
                {/* image */}
                <div className="relative select-none" onContextMenu={(e) => e.preventDefault()}>
                  {img.isRegenerating ? (
                    <div className="w-full flex items-center justify-center bg-black/30" style={{ minHeight: "200px" }}>
                      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                    </div>
                  ) : (
                    <img
                      src={img.url}
                      alt={img.label}
                      className="w-full object-cover pointer-events-none rounded-t-[24px]"
                      draggable={false}
                      style={{ maxHeight: "400px" }}
                    />
                  )}

                  {/* carry forward badge */}
                  {img.carry_forward && img.source_version_no != null && (
                    <div className="absolute top-3 left-3 z-20">
                      <div className="rounded-full bg-slate-800/80 backdrop-blur-md border border-white/20 px-2 py-0.5 text-[10px] font-bold tracking-widest text-slate-300 shadow-sm">
                        沿用自 V{img.source_version_no}
                      </div>
                    </div>
                  )}

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
                <div className="flex items-center justify-between px-4 py-3 bg-black/20 backdrop-blur-md">
                  <span className="text-sm font-bold tracking-wide text-slate-300">{productType} · {img.label}</span>
                  <button
                    onClick={() => toggleEdit(img.id)}
                    className={`flex items-center gap-1.5 text-xs font-bold tracking-wide shadow-sm rounded-full px-3 py-1 border transition
                      ${img.editOpen
                        ? "text-cyan-400 border-cyan-500/50 bg-cyan-900/60"
                        : "text-cyan-400 border-cyan-500/30 bg-cyan-950/40 hover:bg-cyan-900/60"
                      }`}
                  >
                    <Pencil className="w-3 h-3" />
                    修改
                  </button>
                </div>

                {/* edit panel */}
                {img.editOpen && (
                  <div className="border-t border-white/10 px-4 pb-4 pt-3 bg-black/40 backdrop-blur-md">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold tracking-widest text-slate-400 w-14 shrink-0">标注文字</span>
                        <input
                          value={img.text}
                          onChange={(e) => updateText(img.id, e.target.value)}
                          className="flex-1 text-sm bg-black/30 border border-white/10 text-slate-200 rounded-xl px-3 py-2 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50"
                          placeholder="输入标注文字"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => saveText(img.id)}
                      className="mt-4 w-full flex items-center justify-center gap-1.5 text-sm font-bold tracking-widest text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl py-2.5 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                    >
                      <Check className="w-4 h-4" />
                      保存修改
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* fixed bottom: login bar + action buttons */}
          <div className="fixed bottom-0 left-0 right-0 z-30">
            {/* login prompt (hidden when logged in) */}
            {!isAuthenticated && (
              <div className="bg-[#050914] border-t border-white/5 px-4 py-2 flex items-center justify-center">
                <div className="max-w-5xl w-full flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center shrink-0">
                    <CloudUpload className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold tracking-widest text-slate-200">登录后可云端保存资料与历史</p>
                    <p className="text-xs font-medium tracking-wide text-slate-500">当前数据仅保存在浏览器内</p>
                  </div>
                  <a
                    href={getLoginUrl()}
                    className="shrink-0 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200 text-xs font-bold tracking-widest px-4 py-2 rounded-xl transition-all"
                  >
                    前往登录
                  </a>
                </div>
              </div>
            )}
            {/* action buttons */}
            <div className="border-t border-white/10 bg-[#050914]/80 backdrop-blur-xl px-4 py-4 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
              <div className="max-w-5xl w-full mx-auto flex gap-3">
                <Button size="lg" className="flex-1 text-slate-300 font-bold tracking-widest bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl h-14" onClick={handleDownloadAll} disabled={downloading}>
                  {downloading ? <Loader2 className="w-5 h-5 animate-spin mr-1" /> : <Download className="w-5 h-5 mr-1" />}
                  一键打包下载
                </Button>
                <Button size="icon" variant="outline" className="h-14 w-14 border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-400 rounded-2xl shrink-0 transition-colors shadow-lg" onClick={() => setShareOpen(true)}>
                  <Share2 className="w-5 h-5" />
                </Button>
                <Button size="lg" className="sci-fi-button flex-[1.5] bg-cyan-600 font-bold tracking-widest text-base shadow-[0_0_20px_rgba(6,182,212,0.4)] rounded-2xl h-14 gap-2 text-white" onClick={() => setBrandOpen(true)}>
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
          <div className="absolute inset-0 bg-black/40" />
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
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder:text-slate-300"
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
                  ? "bg-blue-500 hover:bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-300 cursor-not-allowed"
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
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-3xl w-full max-w-sm px-6 py-8 shadow-2xl flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-green-200">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              已为您记住「{brandSavedName}」品牌风格
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              下次生成该品牌图片时，选择「{brandSavedName}」将自动应用一致风格，无需重复设置。
            </p>
            <button
              onClick={handleBrandSuccessClose}
              className="w-full h-11 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-semibold text-sm transition-colors"
            >
              好的，返回主页
            </button>
          </div>
        </div>
      )}

      {/* share modal (bottom sheet) */}
      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShareOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-t-2xl w-full max-w-sm pb-8 pt-5 px-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">选择分享方式</h3>
              <button onClick={() => setShareOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <button
              className="w-full h-11 rounded-full bg-blue-500 hover:bg-blue-600 text-white font-semibold text-sm transition-colors"
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
    </div>
  );
}
