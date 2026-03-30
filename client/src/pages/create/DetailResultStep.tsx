import { useEffect, useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { getLoginUrl } from "@/const";
import { jobAPI, sessionAPI } from "@/lib/api";
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
  summary: {
    total_count: number;
    ready_count: number;
    panel_count: number;
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
    summary: {
      total_count: Number(data?.summary?.total_count || sortedPanels.length),
      ready_count: Number(data?.summary?.ready_count || sortedPanels.length),
      panel_count: Number(data?.summary?.panel_count || sortedPanels.length),
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
        setLoadingText(resolveGenerationStageText(status?.stage || status?.status, "detail"));
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

        // No results and no running job — go back to confirm page to generate
        setLocation("/create/detail-confirm");
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <DetailStepIndicator currentStep={3} />

      {/* Loading phase */}
      {phase === "loading" && (
        <div className="flex flex-col items-center justify-center flex-1 px-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">正在生成详情图…</h2>
          <p className="text-sm text-slate-500 mb-5">{loadingText}</p>
          <div className="w-full max-w-xs mb-2">
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-400 to-blue-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <p className="text-sm text-slate-400">{progress}%</p>
        </div>
      )}

      {/* Error phase */}
      {phase === "error" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900">详情图生成失败</p>
            <p className="mt-1 break-words text-sm text-slate-500">{error}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/create/detail-confirm")}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              返回上一步
            </button>
            <button
              onClick={handleRetry}
              className="rounded-full bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600"
            >
              重试
            </button>
          </div>
        </div>
      )}

      {/* Done phase */}
      {phase === "done" && (
        <div className="flex-1 flex flex-col">
          {/* success banner */}
          <div className="bg-amber-50 border-b border-amber-100 px-4 py-2.5 flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shrink-0">
              <Crown className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-900">详情图生成成功！</p>
              <p className="text-xs text-amber-600">无水印 · 可直接用于电商上架</p>
            </div>
          </div>

          {/* image count */}
          <div className="px-4 py-2 flex items-center gap-1.5 bg-white border-b">
            <span className="text-sm font-semibold text-slate-700">详情图</span>
            <span className="text-xs text-slate-400">共 {images.length} 张</span>
          </div>

          {/* image list */}
          <div className="flex-1 overflow-y-auto pb-36">
            {images.map((img) => (
              <div key={img.id} className="bg-white border-b">
                {/* image */}
                <div className="relative select-none" onContextMenu={(e) => e.preventDefault()}>
                  {img.isRegenerating ? (
                    <div className="w-full flex items-center justify-center bg-slate-100" style={{ minHeight: "200px" }}>
                      <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                    </div>
                  ) : (
                    <img
                      src={img.url}
                      alt={img.label}
                      className="w-full object-cover pointer-events-none"
                      draggable={false}
                      style={{ maxHeight: "400px" }}
                    />
                  )}
                </div>

                {/* bottom action row */}
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-slate-500">{productType} · {img.label}</span>
                  <button
                    onClick={() => toggleEdit(img.id)}
                    className={`flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border transition
                      ${img.editOpen
                        ? "text-blue-700 border-blue-400 bg-blue-100"
                        : "text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
                      }`}
                  >
                    <Pencil className="w-3 h-3" />
                    编辑文字
                  </button>
                </div>

                {/* edit panel */}
                {img.editOpen && (
                  <div className="border-t border-slate-100 px-4 pb-4 pt-3 bg-slate-50">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-14 shrink-0">标注文字</span>
                        <input
                          value={img.text}
                          onChange={(e) => updateText(img.id, e.target.value)}
                          className="flex-1 text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                          placeholder="输入标注文字"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => saveText(img.id)}
                      className="mt-3 w-full flex items-center justify-center gap-1.5 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-xl py-2 font-medium transition"
                    >
                      <Check className="w-4 h-4" />
                      保存文字
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
              <div className="bg-white border-t border-slate-100 px-4 py-2 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <CloudUpload className="w-4 h-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800">登录后可保存本地资料与历史记录</p>
                  <p className="text-xs text-slate-400">数据保存在当前浏览器</p>
                </div>
                <a
                  href={getLoginUrl()}
                  className="shrink-0 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                >
                  登录 / 注册
                </a>
              </div>
            )}
            {/* action buttons */}
            <div className="bg-white border-t border-slate-100 shadow-lg px-4 py-2.5 flex gap-2">
              <Button size="lg" variant="outline" className="flex-1 text-slate-600 gap-1.5 border-slate-200" onClick={handleDownloadAll} disabled={downloading}>
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                一键下载
              </Button>
              <Button size="lg" variant="ghost" className="px-3 text-slate-500" onClick={() => setShareOpen(true)}>
                <Share2 className="w-4 h-4" />
              </Button>
              <Button size="lg" className="flex-1 bg-blue-500 hover:bg-blue-600 text-white gap-1.5" onClick={() => setBrandOpen(true)}>
                记住品牌风格
              </Button>
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
