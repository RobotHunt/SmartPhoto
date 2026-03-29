import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, CheckCircle2, Loader2, Pencil, RefreshCw, Sparkles } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { jobAPI, sessionAPI } from "@/lib/api";
import { updateSessionRecord } from "@/lib/localUser";

import { DetailStepIndicator } from "./DetailStepIndicator";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type DetailPlanItem = {
  slot_id?: string;
  panel_id?: string;
  panel_label?: string;
  panel_type?: string;
  narrative_section?: string;
  panel_goal?: string;
  copy_focus?: string;
  visual_truth_mode?: string;
  origin_note?: string;
  display_order?: number;
  copy_lines?: string[];
  copy_blocks?: Record<string, any>;
  layout_notes?: string;
};

type DetailPanel = {
  asset_id: string;
  panel_label?: string | null;
  image_url: string;
  display_order: number;
};

type PreviewCard = {
  id: string;
  label: string;
  description: string;
  previewUrl: string;
};

type Phase = "loading" | "planning" | "generating" | "done" | "error";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseSelectedIds(raw: string | null) {
  if (!raw) return [] as string[];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

function collectText(value: unknown): string[] {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectText);
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(collectText);
  }
  return [];
}

function buildPreviewCards(panelPlan: DetailPlanItem[], previewUrls: string[]) {
  const fallbackUrls = previewUrls.length > 0 ? previewUrls : ["/examples/air-purifier.jpg"];

  return panelPlan.map((item, index) => {
    const copyLines = [
      ...(Array.isArray(item.copy_lines) ? item.copy_lines : []),
      ...collectText(item.copy_blocks),
    ].filter(Boolean);

    return {
      id: String(item.slot_id || item.panel_id || index + 1),
      label: item.panel_label || item.panel_type || `详情图 ${index + 1}`,
      description:
        item.panel_goal ||
        item.copy_focus ||
        copyLines[0] ||
        item.layout_notes ||
        "将基于当前文案与平台规则生成详情图内容",
      previewUrl: fallbackUrls[index % fallbackUrls.length],
    };
  });
}

function normalizeDetailResults(data: any) {
  const panels = Array.isArray(data?.panels) ? data.panels : [];
  return panels
    .map((panel: any, index: number) => ({
      asset_id: String(panel?.asset_id || `${index + 1}`),
      panel_label: panel?.panel_label ?? panel?.panel_id ?? `详情图 ${index + 1}`,
      image_url: String(panel?.image_url || panel?.thumbnail_url || ""),
      display_order: Number(panel?.display_order ?? index),
    }))
    .sort((a: DetailPanel, b: DetailPanel) => a.display_order - b.display_order);
}

function resolveStageText(stage?: string) {
  if (!stage) return "详情图生成中";
  const normalized = String(stage).toLowerCase();
  if (normalized.includes("queue")) return "任务排队中";
  if (normalized.includes("planning")) return "正在规划详情图";
  if (normalized.includes("render")) return "正在渲染详情图";
  if (normalized.includes("stitch")) return "正在拼接长图";
  if (normalized.includes("upload")) return "正在整理结果";
  if (normalized.includes("done")) return "即将完成";
  return stage;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DetailConfirmStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const sessionId = sessionStorage.getItem("current_session_id") || "";
  const selectedIdsRaw = sessionStorage.getItem("selected_asset_ids");
  const currentMainVersionRaw = sessionStorage.getItem("current_result_version");
  const selectedIds = useMemo(() => parseSelectedIds(selectedIdsRaw), [selectedIdsRaw]);

  const [phase, setPhase] = useState<Phase>("loading");
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState("正在生成详情图...");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // planning phase state

  const [cards, setCards] = useState<PreviewCard[]>([]);

  // done phase state — real generated detail panels
  const [panels, setPanels] = useState<DetailPanel[]>([]);

  /* ---------------------------------------------------------------- */
  /*  API helpers                                                      */
  /* ---------------------------------------------------------------- */

  async function fetchDetailResults(version?: number) {
    const data = await sessionAPI.getDetailResults(sessionId, version);
    const normalized = normalizeDetailResults(data);
    setPanels(normalized);
    return normalized;
  }

  async function loadPreviewUrls() {
    let previewUrls: string[] = [];
    try {
      const results = await sessionAPI.getResults(
        sessionId,
        currentMainVersionRaw ? Number(currentMainVersionRaw) : undefined,
      );
      const assets = Array.isArray(results?.assets) ? results.assets : [];
      const filtered =
        selectedIds.length > 0
          ? assets.filter((asset: any) => selectedIds.includes(asset.asset_id))
          : assets;
      previewUrls = filtered
        .map((asset: any) => asset.thumbnail_url || asset.image_url)
        .filter(Boolean);
    } catch {
      // fallback
    }
    if (previewUrls.length === 0) {
      const images = await sessionAPI.listImages(sessionId);
      previewUrls = images.map((item: any) => item.url).filter(Boolean);
    }
    return previewUrls;
  }

  /* ---------------------------------------------------------------- */
  /*  Bootstrap                                                        */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!sessionId) {
        setLocation("/create/copywriting");
        return;
      }

      try {

        setError("");

        const snapshot = await sessionAPI.get(sessionId);
        if (cancelled) return;

        // If detail images already generated, check if copy has changed
        if (Number(snapshot.detail_latest_result_version || 0) > 0) {
          const savedCopyHash = sessionStorage.getItem("detail_copy_hash");
          const currentCopyHash = JSON.stringify(snapshot.confirmed_copy || "");
          const copyChanged = savedCopyHash !== null && savedCopyHash !== currentCopyHash;

          if (!copyChanged) {
            // Copy unchanged — show existing results directly
            await fetchDetailResults(snapshot.detail_latest_result_version || undefined);
            if (cancelled) return;
            setPhase("done");
  
            return;
          }
          // Copy changed — fall through to show planning, user will regenerate
        }

        // If a generation job is in progress, resume polling
        if (snapshot.latest_detail_generate_job_id) {
          const jobStatus = String(
            (await jobAPI.getStatus(snapshot.latest_detail_generate_job_id).catch(() => null))
              ?.status || ""
          ).toLowerCase();
          const isFinal = ["failed", "error", "completed", "done"].includes(jobStatus);
          if (!isFinal) {
  
            await startPolling(snapshot.latest_detail_generate_job_id, "正在恢复详情图生成任务...");
            return;
          }
        }

        // Otherwise, show strategy preview
        let preview = snapshot.detail_strategy_preview;
        if (!Array.isArray(preview?.panel_plan) || preview.panel_plan.length === 0) {
          const previewRes = await sessionAPI.previewDetailStrategy(sessionId);
          preview = previewRes?.detail_strategy_preview ?? preview;
        }

        const panelPlan = Array.isArray(preview?.panel_plan) ? preview.panel_plan : [];
        if (panelPlan.length === 0) {
          throw new Error("详情图策略尚未生成，请先返回文案页确认内容后重试。");
        }

        const previewUrls = await loadPreviewUrls();
        if (!cancelled) {
          setCards(buildPreviewCards(panelPlan, previewUrls));
          setPhase("planning");

        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "详情图方案加载失败");
          setPhase("error");

        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [sessionId, setLocation]);

  /* ---------------------------------------------------------------- */
  /*  Generation                                                       */
  /* ---------------------------------------------------------------- */

  async function startPolling(jobId: string, initialText = "正在生成详情图...") {
    setPhase("generating");
    setError("");
    setLoadingText(initialText);
    setProgress(8);
    setBusy(true);

    await jobAPI.pollUntilDone(
      jobId,
      (status) => {
        const nextProgress = Number(status?.progress || 0);
        if (nextProgress > 0) {
          setProgress(Math.max(8, Math.min(99, nextProgress)));
        }
        setLoadingText(resolveStageText(status?.stage || status?.status));
      },
      2000,
      300000,
    );

    const snapshot = await sessionAPI.get(sessionId);
    const targetVersion = snapshot.detail_latest_result_version || undefined;
    await fetchDetailResults(targetVersion);
    setProgress(100);
    setPhase("done");
    setBusy(false);

    if (sessionId) {
      updateSessionRecord(sessionId, { last_step: "detail-confirm" });
    }
  }

  async function tryResumeExistingJob(): Promise<boolean> {
    try {
      const snapshot = await sessionAPI.get(sessionId);
      const jobId = snapshot.latest_detail_generate_job_id;
      if (!jobId) return false;
      const jobStatus = String(
        (await jobAPI.getStatus(jobId).catch(() => null))?.status || ""
      ).toLowerCase();
      const isFinal = ["failed", "error", "completed", "done"].includes(jobStatus);
      if (isFinal) return false;
      await startPolling(jobId, "正在恢复已有任务...");
      return true;
    } catch {
      return false;
    }
  }

  const handleGenerate = async () => {
    if (!sessionId || busy) return;
    setBusy(true);

    try {
      setError("");

      // Save copy snapshot so we can detect changes later
      const snap = await sessionAPI.get(sessionId);
      sessionStorage.setItem("detail_copy_hash", JSON.stringify(snap.confirmed_copy || ""));

      const generation = await sessionAPI.generateDetailPage(sessionId);
      const jobId = generation?.job_id || generation?.jobId;
      if (!jobId) {
        throw new Error("未拿到详情图任务 ID");
      }
      await startPolling(jobId);
      toast({ title: "详情图生成完成" });
    } catch (err: any) {
      // If generation failed (e.g. 409 job_already_running), try resuming existing job
      const resumed = await tryResumeExistingJob();
      if (resumed) {
        toast({ title: "详情图生成完成" });
        return;
      }

      const raw = String(err?.message || err || "").trim();
      setError(raw || "详情图生成失败");
      setPhase("error");
    } finally {
      setBusy(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Navigation                                                       */
  /* ---------------------------------------------------------------- */

  const handleBack = () => {
    setLocation("/create/copywriting");
  };

  const handleGoToResult = () => {
    setLocation("/create/detail-result");
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <DetailStepIndicator currentStep={2} />

      {/* ---- Initial loading ---- */}
      {phase === "loading" && (
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      )}

      {/* ---- Generating phase ---- */}
      {phase === "generating" && (
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-slate-900">{loadingText}</h2>
          <p className="mb-6 text-sm text-slate-500">请耐心等待，AI 正在为您生成详情图</p>
          <div className="mb-2 w-full max-w-xs">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-400">{progress}%</p>
        </div>
      )}

      {/* ---- Error phase ---- */}
      {phase === "error" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <div>
            <p className="text-base font-semibold text-slate-900">详情图生成失败</p>
            <p className="text-sm text-slate-500 mt-1 break-words">{error}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="px-4 py-2 rounded-full border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
            >
              返回文案页
            </button>
            <button
              onClick={handleGenerate}
              className="px-4 py-2 rounded-full bg-blue-500 text-sm text-white hover:bg-blue-600"
            >
              重试
            </button>
          </div>
        </div>
      )}

      {/* ---- Planning phase (strategy preview) ---- */}
      {phase === "planning" && (
        <>
          {/* status bar */}
          <div className="bg-white border-b px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-semibold text-slate-800">
                已规划 {cards.length} 张详情图
              </span>
            </div>
            <button
              onClick={handleBack}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-full px-2.5 py-1 transition"
            >
              <RefreshCw className="w-3 h-3" />
              重新规划
            </button>
          </div>
          <p className="px-4 py-1.5 text-xs text-slate-400 bg-white border-b">
            预览为策略规划，确认后生成详情图
          </p>

          <div className="flex-1 overflow-y-auto pb-28">
              {cards.map((card) => (
                <div key={card.id} className="bg-white border-b">
                  <div
                    className="relative select-none"
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <img
                      src={card.previewUrl}
                      alt={card.label}
                      className="w-full object-cover pointer-events-none"
                      draggable={false}
                      style={{ maxHeight: "400px" }}
                    />
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div
                        className="text-white/25 font-bold text-xl select-none"
                        style={{
                          transform: "rotate(-30deg)",
                          textShadow: "0 1px 4px rgba(0,0,0,0.4)",
                          letterSpacing: "0.08em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        AI电商做图 · 预览版
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2">
                    <span className="text-sm text-slate-500">{card.label}</span>
                    <span className="text-xs text-slate-400">{card.description}</span>
                  </div>
                </div>
              ))}
            </div>

          <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t shadow-lg px-4 py-3">
              <button
                onClick={handleGenerate}
                disabled={busy}
                className="w-full h-12 rounded-2xl flex items-center justify-center gap-2 text-base font-bold bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-200 transition disabled:opacity-70"
              >
                <Sparkles className="w-5 h-5" />
                确认生成详情图
              </button>
              <p className="text-center text-xs text-slate-400 mt-1.5">
                共 {cards.length} 张，确认后开始生成
              </p>
          </div>
        </>
      )}

      {/* ---- Done phase (real generated images with watermark) ---- */}
      {phase === "done" && (
        <>
          <div className="bg-white border-b px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-semibold text-slate-800">
                已生成 {panels.length} 张详情图
              </span>
            </div>
            <button
              onClick={handleBack}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-full px-2.5 py-1 transition"
            >
              <RefreshCw className="w-3 h-3" />
              重新生成
            </button>
          </div>
          <p className="px-4 py-1.5 text-xs text-slate-400 bg-white border-b">
            预览图含水印，确认后生成无水印高清图
          </p>

          <div className="flex-1 overflow-y-auto pb-28">
            {panels.map((panel, index) => (
              <div key={panel.asset_id} className="bg-white border-b">
                <div
                  className="relative select-none"
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <img
                    src={panel.image_url}
                    alt={panel.panel_label || `详情图 ${index + 1}`}
                    className="w-full object-cover pointer-events-none"
                    draggable={false}
                  />
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div
                      className="text-white/25 font-bold text-xl select-none"
                      style={{
                        transform: "rotate(-30deg)",
                        textShadow: "0 1px 4px rgba(0,0,0,0.4)",
                        letterSpacing: "0.08em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      AI电商做图 · 预览版
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-sm text-slate-500">
                    {panel.panel_label || `详情图 ${index + 1}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleBack}
                      className="flex items-center gap-1 text-xs text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-full px-2.5 py-1 transition"
                    >
                      <Pencil className="w-3 h-3" />
                      编辑文字
                    </button>
                    <button
                      onClick={handleBack}
                      className="flex items-center gap-1 text-xs text-slate-500 border border-slate-200 rounded-full px-2.5 py-1 hover:bg-slate-50 transition"
                    >
                      <RefreshCw className="w-3 h-3" />
                      重新生成
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t shadow-lg px-4 py-3">
            <button
              onClick={handleGoToResult}
              className="w-full h-12 rounded-2xl flex items-center justify-center gap-2 text-base font-bold bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-200 transition"
            >
              <Sparkles className="w-5 h-5" />
              生成无水印高清图
            </button>
            <p className="text-center text-xs text-slate-400 mt-1.5">
              共 {panels.length} 张，确认后全部生成
            </p>
          </div>

        </>
      )}
    </div>
  );
}
