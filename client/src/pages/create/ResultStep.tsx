import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Check,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Wand2,
  X,
  History,
  MessageSquare,
} from "lucide-react";

import { VersionSelector } from "@/components/VersionSelector";
import { StepIndicator } from "@/components/StepIndicator";
import GenerationWaitingUI from "@/components/GenerationWaitingUI";
import { resolveAssetLabel } from "@/lib/assetLabels";
import { resolveGenerationStageText } from "@/lib/generationStatus";
import { updateSessionRecord } from "@/lib/localUser";
import { useToast } from "@/hooks/use-toast";
import {
  assetAPI,
  jobAPI,
  sessionAPI,
  type MainGalleryCopyBlocks,
  type PromptPreviewItem,
  type SessionResults,
  type StrategyOverrideItem,
  type VersionSummary,
} from "@/lib/api";
import {
  copyLinesToTextarea,
  resolveMainGalleryAssetCopy,
  textareaToCopyLines,
  upsertStrategyOverride,
} from "@/lib/mainGalleryCopy";
import { QualityBadge } from "@/components/QualityBadge";
import { FailedAssetCard } from "@/components/FailedAssetCard";
import { AssetHistoryDrawer } from "@/components/AssetHistoryDrawer";
import { AssetFeedbackModal } from "@/components/AssetFeedbackModal";
import { useQualityPolling } from "@/hooks/useQualityPolling";

type ResultAssetView = {
  asset_id: string;
  role: string;
  image_url: string;
  display_order: number;
  slot_id: string;
  resolved_slot_id: string | null;
  isRegenerating: boolean;
  editOpen: boolean;
  copy_blocks: MainGalleryCopyBlocks;
  carry_forward?: boolean;
  source_version_no?: number | null;
  fidelity_validation_status?: string | null;
  status?: string;
  quality_status?: string;
  quality_scores?: Record<string, any> | null;
  failure_reason?: string | null;
};

function normalizeGenerationError(error: any) {
  const raw = String(error?.message || error || "").trim();
  const code = String(error?.code || "").trim();
  const upstreamReason = String(error?.result_payload?.upstream_reason || "").trim();
  const upstreamStatus = Number(error?.result_payload?.upstream_http_status || 0);
  if (!raw) {
    return {
      code: "unknown",
      title: "生成失败",
      description: "本次生成未成功，请稍后重试。",
    };
  }

  if (raw.includes("white background validation failed")) {
    return {
      code: "white_bg_validation_failed",
      title: "白底图未通过校验",
      description:
        "系统已自动重试一次，但白底图仍未达到平台校验要求。建议返回策略页微调，或直接重新生成。",
    };
  }

  if (raw.includes("insufficient") || raw.includes("credits") || raw.includes("余额")) {
    return {
      code: "insufficient_credits",
      title: "额度不足",
      description: "当前账户额度不足以完成本次生成，请稍后重试或联系后端补充联调额度。",
    };
  }

  if (
    code === "42901" ||
    upstreamReason === "rate_limited" ||
    upstreamStatus === 429 ||
    raw.includes("Too Many Requests") ||
    raw.includes("429")
  ) {
    return {
      code: "upstream_rate_limited",
      title: "上游限流",
      description: "当前上游模型出现限流，请稍后重试。这不是你的会话数据丢失。",
    };
  }

  return {
    code: "generic",
    title: "生成失败",
    description: raw,
  };
}

function buildViewAssets(
  data: SessionResults,
  prompts: PromptPreviewItem[],
  overrides: StrategyOverrideItem[],
): ResultAssetView[] {
  return (data.assets || []).map((asset, index) => ({
    ...(() => {
      const resolved = resolveMainGalleryAssetCopy(asset, prompts, overrides);
      return {
        resolved_slot_id: resolved.slotId,
        copy_blocks: resolved.copyBlocks,
      };
    })(),
    asset_id: asset.asset_id,
    role: asset.role,
    image_url: asset.image_url,
    display_order: asset.display_order ?? index,
    slot_id: asset.slot_id || "",
    isRegenerating: false,
    editOpen: false,
    carry_forward: asset.carry_forward,
    source_version_no: asset.source_version_no,
    fidelity_validation_status: asset.fidelity_validation_status,
    status: asset.status,
    quality_status: asset.quality_status,
    quality_scores: asset.quality_scores,
    failure_reason: asset.failure_reason,
  }));
}

export default function ResultStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const sessionId = sessionStorage.getItem("current_session_id") || "";

  const [generating, setGenerating] = useState(true);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("正在生成主图...");
  const [error, setError] = useState<string | null>(null);
  const generateStartRef = useRef(Date.now());
  const [historyAssetId, setHistoryAssetId] = useState<string | null>(null);
  const [feedbackAssetId, setFeedbackAssetId] = useState<string | null>(null);

  const [assets, setAssets] = useState<ResultAssetView[]>([]);
  const [promptPreviews, setPromptPreviews] = useState<PromptPreviewItem[]>([]);
  const [strategyOverrides, setStrategyOverrides] = useState<StrategyOverrideItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [availableVersions, setAvailableVersions] = useState<number[]>([]);
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);
  const [latestVersion, setLatestVersion] = useState<number>(0);
  const [versionSummaries, setVersionSummaries] = useState<VersionSummary[]>([]);

  const [regenModalOpen, setRegenModalOpen] = useState(false);
  const [regenTargetId, setRegenTargetId] = useState<string | null>(null);
  const [regenInstruction, setRegenInstruction] = useState("");
  const [regenKeepElements, setRegenKeepElements] = useState("");
  const [regenRemoveElements, setRegenRemoveElements] = useState("");
  const [regenLoading, setRegenLoading] = useState(false);

  const [editTextOpen, setEditTextOpen] = useState(false);
  const [editTextTarget, setEditTextTarget] = useState<string | null>(null);
  const [editTextValue, setEditTextValue] = useState("");

  const [globalEditOpen, setGlobalEditOpen] = useState(false);
  const [globalInstruction, setGlobalInstruction] = useState("");
  const [globalEditLoading, setGlobalEditLoading] = useState(false);

  const progressRef = useRef(0);
  const regenTextareaRef = useRef<HTMLTextAreaElement>(null);

  const productName =
    sessionStorage.getItem("selectedProductType") ||
    (() => {
      try {
        const raw = sessionStorage.getItem("analysisResult");
        return raw ? JSON.parse(raw).product_name : "";
      } catch {
        return "";
      }
    })() ||
    "产品";

  const safeSetProgress = useCallback((next: number) => {
    const clamped = Math.max(progressRef.current, Math.round(next));
    progressRef.current = clamped;
    setProgress(clamped);
  }, []);

  const applyResultsData = useCallback(
    (
      data: SessionResults,
      prompts: PromptPreviewItem[],
      overrides: StrategyOverrideItem[],
      explicitVersion?: number,
    ) => {
      const nextAssets = buildViewAssets(data, prompts, overrides);
      const resolvedVersion =
        explicitVersion || data.requested_version || data.latest_result_version || null;

      setPromptPreviews(prompts);
      setStrategyOverrides(overrides);
      setAssets(nextAssets);
      setSelected(new Set(nextAssets.map((asset) => asset.asset_id)));
      setAvailableVersions(data.available_versions || []);
      setLatestVersion(data.latest_result_version || 0);
      setCurrentVersion(resolvedVersion);
      setVersionSummaries(data.version_summaries || []);

      if (resolvedVersion) {
        sessionStorage.setItem("current_result_version", String(resolvedVersion));
      } else {
        sessionStorage.removeItem("current_result_version");
      }

      const sid = sessionStorage.getItem("current_session_id");
      if (sid) {
        updateSessionRecord(sid, { last_step: "result", image_count: nextAssets.length });
      }

      safeSetProgress(100);
      setGenerating(false);
    },
    [safeSetProgress],
  );

  const loadResults = useCallback(
    async (version?: number) => {
      if (!sessionId) throw new Error("缺少 session_id");
      const [data, promptPreviewRes, overrideRes] = await Promise.all([
        sessionAPI.getResults(sessionId, version),
        sessionAPI
          .previewPrompts(sessionId, { include_latest_assets: true })
          .catch(() => null),
        sessionAPI.getStrategyOverrides(sessionId).catch(() => null),
      ]);
      applyResultsData(
        data,
        promptPreviewRes?.prompts || [],
        overrideRes?.overrides || [],
        version,
      );
      return data;
    },
    [applyResultsData, sessionId],
  );

  const startOrRestoreResults = useCallback(async () => {
    if (!sessionId) {
      setGenerating(false);
      setError("找不到当前会话，请返回重新开始。");
      toast({
        title: "缺少会话",
        description: "找不到当前会话，请返回重新开始。",
        variant: "destructive",
      });
      return;
    }

    let cancelled = false;
    let fakeTimer: ReturnType<typeof setInterval> | undefined;

    const run = async () => {
      setGenerating(true);
      generateStartRef.current = Date.now();
      setError(null);
      setStatusText("正在加载生成结果...");
      progressRef.current = 0;
      setProgress(0);

      try {
        const existing = await sessionAPI.getResults(sessionId);
        if (existing.assets.length > 0) {
          const promptPreviewRes = await sessionAPI
            .previewPrompts(sessionId, { include_latest_assets: true })
            .catch(() => null);
          const overrideRes = await sessionAPI.getStrategyOverrides(sessionId).catch(() => null);
          applyResultsData(
            existing,
            promptPreviewRes?.prompts || [],
            overrideRes?.overrides || [],
          );
          return;
        }
      } catch {
        // ignore and continue
      }

      try {
        let fakeProgress = 0;
        fakeTimer = setInterval(() => {
          fakeProgress += Math.random() * 5 + 1;
          if (fakeProgress > 40) fakeProgress = 40;
          if (!cancelled) safeSetProgress(fakeProgress);
        }, 400);

        setStatusText("正在校验主图策略...");
        const snapshot = await sessionAPI.get(sessionId).catch(() => null);
        if (!snapshot?.strategy_preview) {
          clearInterval(fakeTimer);
          setGenerating(false);
          toast({
            title: "请先确认主图策略",
            description: "当前会话还没有可用的主图策略，正在返回策略确认页。",
          });
          setLocation("/create/strategy");
          return;
        }

        if (cancelled) return;

        if (Number(snapshot.latest_result_version || 0) > 0) {
          clearInterval(fakeTimer);
          setStatusText("正在加载已有主图结果...");
          safeSetProgress(90);
          await loadResults(snapshot.latest_result_version || undefined);
          return;
        }

        if (snapshot.latest_generate_job_id) {
          const latestJob = await jobAPI.getStatus(snapshot.latest_generate_job_id).catch(() => null);
          if (!latestJob || !["failed", "error"].includes(String(latestJob.status || "").toLowerCase())) {
            clearInterval(fakeTimer);
            setStatusText("正在恢复已有生成任务...");
            safeSetProgress(45);
            await jobAPI.pollUntilDone(snapshot.latest_generate_job_id, (jobStatus) => {
              const pct = jobStatus.progress ?? jobStatus.progress_pct ?? 0;
              const stage = jobStatus.stage || jobStatus.status || "";
              if (!cancelled) {
                setStatusText(resolveGenerationStageText(stage, "main").title);
              }
              if (!cancelled) {
                safeSetProgress(Math.min(Math.round(50 + pct * 0.42), 92));
              }
            });
            if (cancelled) return;
            setStatusText("正在加载生成结果...");
            safeSetProgress(95);
            await loadResults();
            return;
          }

          setStatusText("检测到上一轮生成失败，正在重新创建任务...");
          safeSetProgress(42);
        }

        setStatusText("正在生成主图...");
        safeSetProgress(45);
        const generateResponse = await sessionAPI.generateGallery(sessionId);
        clearInterval(fakeTimer);

        if (generateResponse?.job_id) {
          await jobAPI.pollUntilDone(generateResponse.job_id, (jobStatus) => {
            const pct = jobStatus.progress ?? jobStatus.progress_pct ?? 0;
            const stage = jobStatus.stage || jobStatus.status || "";
            if (!cancelled) {
              setStatusText(resolveGenerationStageText(stage, "main").title);
            }
            if (!cancelled) {
              safeSetProgress(Math.min(Math.round(50 + pct * 0.42), 92));
            }
          });
        }

        if (cancelled) return;

        setStatusText("正在加载生成结果...");
        safeSetProgress(95);
        await loadResults();
      } catch (err: any) {
        clearInterval(fakeTimer);
        const normalizedError = normalizeGenerationError(err || "生成失败，请重试");
        setError(
          normalizedError.code === "insufficient_credits"
            ? "insufficient_credits"
            : normalizedError.description,
        );
        setGenerating(false);
        toast({
          title: normalizedError.title,
          description: normalizedError.description,
          variant: "destructive",
        });
      }
    };

    await run();

    return () => {
      cancelled = true;
      clearInterval(fakeTimer);
    };
  }, [applyResultsData, loadResults, safeSetProgress, sessionId, setLocation, toast]);

  useEffect(() => {
    let cleanup: void | (() => void);

    startOrRestoreResults().then((dispose) => {
      cleanup = dispose;
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [startOrRestoreResults]);

  const needsQualityPolling = assets.some(a => a.quality_status === "pending_async_review");
  useQualityPolling(needsQualityPolling, async () => {
    await loadResults(currentVersion ?? undefined);
  });

  const toggleSelect = (assetId: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  };

  const openRegenModal = (assetId: string) => {
    setRegenTargetId(assetId);
    setRegenInstruction("");
    setRegenKeepElements("");
    setRegenRemoveElements("");
    setRegenModalOpen(true);
    setTimeout(() => regenTextareaRef.current?.focus(), 120);
  };

  const handleVersionChange = async (version: number) => {
    if (!sessionId || version === currentVersion) return;
    setGenerating(true);
    generateStartRef.current = Date.now();
    setStatusText(`正在加载 V${version}...`);
    progressRef.current = 0;
    setProgress(20);
    try {
      await loadResults(version);
    } catch (err: any) {
      setGenerating(false);
      toast({
        title: "切换版本失败",
        description: err?.message || "请稍后重试。",
        variant: "destructive",
      });
    }
  };

  const handleRegen = async (
    assetId: string,
    instruction: string,
    editConstraints?: { keep?: string[]; remove?: string[] }
  ) => {
    setAssets((previous) =>
      previous.map((asset) =>
        asset.asset_id === assetId ? { ...asset, isRegenerating: true } : asset,
      ),
    );

    try {
      const response = await assetAPI.regenerate(assetId, instruction || "重新生成", editConstraints);
      if (response?.job_id) {
        await jobAPI.pollUntilDone(response.job_id);
      }
      await loadResults();
      toast({
        title: "重新生成完成",
        description: instruction ? `已按指示调整：${instruction}` : "已重新生成图片。",
      });
    } catch (err: any) {
      toast({
        title: "重新生成失败",
        description: err?.message || "请稍后重试。",
        variant: "destructive",
      });
    } finally {
      setAssets((previous) =>
        previous.map((asset) =>
          asset.asset_id === assetId ? { ...asset, isRegenerating: false } : asset,
        ),
      );
    }
  };

  const confirmRegen = async () => {
    if (!regenTargetId) return;
    setRegenModalOpen(false);
    setRegenLoading(true);
    
    const constraints: { keep?: string[], remove?: string[] } = {};
    const keeps = regenKeepElements.split(/[,，]/).map(s => s.trim()).filter(Boolean);
    const removes = regenRemoveElements.split(/[,，]/).map(s => s.trim()).filter(Boolean);
    
    if (keeps.length > 0) constraints.keep = keeps;
    if (removes.length > 0) constraints.remove = removes;
    
    await handleRegen(
      regenTargetId, 
      regenInstruction, 
      Object.keys(constraints).length > 0 ? constraints : undefined
    );
    
    setRegenTargetId(null);
    setRegenLoading(false);
  };

  const confirmEditText = async () => {
    if (!editTextTarget || !editTextValue.trim()) {
      setEditTextOpen(false);
      return;
    }
    setEditTextOpen(false);
    await handleRegen(editTextTarget, `修改文字：${editTextValue.trim()}`);
    setEditTextTarget(null);
    setEditTextValue("");
  };

  const startGlobalEdit = async () => {
    if (globalEditLoading || !sessionId) return;
    const instruction = globalInstruction.trim() || "整体优化";
    setGlobalEditLoading(true);
    setGlobalEditOpen(false);
    setGenerating(true);
    generateStartRef.current = Date.now();
    setError(null);
    setStatusText("AI 正在整体优化图片...");
    progressRef.current = 0;
    setProgress(15);

    try {
      const response: any = await sessionAPI.globalEdit(sessionId, instruction);
      if (response?.job_id) {
        await jobAPI.pollUntilDone(response.job_id, (jobStatus) => {
          const pct = jobStatus.progress ?? jobStatus.progress_pct ?? 0;
          const stage = jobStatus.stage || jobStatus.status || "";
          setStatusText(resolveGenerationStageText(stage, "main").title);
          safeSetProgress(Math.min(Math.round(20 + pct * 0.75), 96));
        });
      }
      await loadResults();
      toast({ title: "整体优化完成" });
    } catch (err: any) {
      setGenerating(false);
      toast({
        title: "整体优化失败",
        description: err?.message || "请稍后重试。",
        variant: "destructive",
      });
    } finally {
      setGlobalEditLoading(false);
      setGlobalInstruction("");
    }
  };

  /* --- per-asset inline edit helpers --- */
  const toggleEditOpen = (assetId: string) => {
    setAssets((prev) =>
      prev.map((a) =>
        a.asset_id === assetId
          ? { ...a, editOpen: !a.editOpen }
          : { ...a, editOpen: false },
      ),
    );
  };

  const updateAssetText = (
    assetId: string,
    field: "headline" | "supporting",
    value: string,
  ) => {
    setAssets((prev) =>
      prev.map((a) =>
        a.asset_id === assetId
          ? { ...a, copy_blocks: { ...a.copy_blocks, [field]: value } }
          : a,
      ),
    );
  };

  const updateAssetLineText = (
    assetId: string,
    field: "proof_lines" | "matrix_lines",
    value: string,
  ) => {
    setAssets((prev) =>
      prev.map((a) =>
        a.asset_id === assetId
          ? {
              ...a,
              copy_blocks: {
                ...a.copy_blocks,
                [field]: textareaToCopyLines(value),
              },
            }
          : a,
      ),
    );
  };

  const saveAssetText = async (assetId: string) => {
    const asset = assets.find((a) => a.asset_id === assetId);
    if (!asset) return;
    const slotId =
      asset.resolved_slot_id ||
      resolveMainGalleryAssetCopy(asset, promptPreviews, strategyOverrides).slotId;
    if (!slotId || !sessionId) {
      toast({
        title: "保存失败",
        description: "当前图片缺少可用槽位标识，暂时无法保存文案。",
        variant: "destructive",
      });
      return;
    }
    setAssets((prev) =>
      prev.map((a) =>
        a.asset_id === assetId ? { ...a, editOpen: false, isRegenerating: true } : a,
      ),
    );
    try {
      const nextOverrides = upsertStrategyOverride(
        strategyOverrides,
        slotId,
        asset.copy_blocks,
      );
      const saved = await sessionAPI.saveStrategyOverrides(sessionId, {
        overrides: nextOverrides,
      });
      setStrategyOverrides(saved.overrides || nextOverrides);
      // Use edit-text API to preserve composition while only replacing text
      const response = await assetAPI.editAssetText(assetId, asset.copy_blocks);
      if (response?.job_id) {
        await jobAPI.pollUntilDone(response.job_id);
      }
      await loadResults();
      toast({ title: "文案修改完成" });
    } catch (err: any) {
      toast({
        title: "保存失败",
        description: err?.message || "请稍后重试。",
        variant: "destructive",
      });
    } finally {
      setAssets((prev) =>
        prev.map((a) =>
          a.asset_id === assetId ? { ...a, isRegenerating: false } : a,
        ),
      );
    }
  };

  const selectedCount = selected.size;
  const hasRunningAssetRegen = regenLoading || assets.some((asset) => asset.isRegenerating);
  const actionLocked = globalEditLoading || hasRunningAssetRegen;

  if (generating) {
    const elapsedMs = Date.now() - generateStartRef.current;
    return (
      <div className="min-h-screen aurora-bg">
        <StepIndicator currentStep={5} step5Label="生成图片" />
        <GenerationWaitingUI
          kind="main"
          progress={progress}
          stage={statusText}
        />
      </div>
    );
  }

  if (error && assets.length === 0) {
    const isCreditsError = error === "insufficient_credits";
    return (
      <div className="min-h-screen aurora-bg">
        <StepIndicator currentStep={5} step5Label="生成图片" />
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 relative z-10">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 border border-red-200 shadow-sm">
            <X className="h-10 w-10 text-red-400" />
          </div>
          <h2 className="mb-2 text-xl font-bold tracking-widest text-slate-900">
            {isCreditsError ? "额度不足" : "生成失败"}
          </h2>
          <p className="mb-8 max-w-sm text-center text-sm font-medium tracking-wide text-slate-500">
            {isCreditsError
              ? "当前额度不足以完成本次生成，请稍后重试或联系后端补充联调额度。"
              : error}
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocation("/create/strategy")}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 backdrop-blur-md px-6 py-3 text-sm font-bold tracking-widest text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              返回上一页
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl border border-blue-300 bg-blue-600/20 px-6 py-3 text-sm font-bold tracking-widest text-blue-600 transition hover:bg-blue-500/30 hover:text-blue-600 shadow-sm"
            >
              重试
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen aurora-bg">
      <StepIndicator currentStep={5} step5Label="生成图片" />

      <div className="mx-auto w-full max-w-7xl px-4 pb-44 pt-4 md:pt-8 relative z-10">
        {/* --- Top status bar --- */}
        <div className="mb-1 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500">
              <Check className="h-3 w-3 stroke-[3] text-slate-900" />
            </div>
            <span className="text-sm font-bold text-slate-900">
              已生成 {assets.length} 张图片
            </span>
          </div>
          <button
            onClick={() => setLocation("/create/generate")}
            className="flex items-center gap-1 rounded-full border border-slate-300 bg-white/80 backdrop-blur-md px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-blue-300 hover:text-slate-900"
          >
            <RotateCcw className="h-3 w-3" />
            重新生成
          </button>
        </div>
        <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <p className="text-xs text-slate-500 font-medium">✨ 提示：预览图含水印，付费后可获取高清无水印原图</p>
            {availableVersions.length > 1 && (
            <div className="flex items-center gap-2 relative z-50">
                <span className="text-sm font-medium text-slate-600">生成版本历史:</span>
                <VersionSelector
                  versions={availableVersions}
                  currentVersion={currentVersion || latestVersion || 0}
                  summaries={versionSummaries}
                  onSelectVersion={(v: number) => handleVersionChange(v)}
                />
            </div>
            )}
        </div>

        {/* --- Image grids --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {assets.map((asset) => {
            const isSelected = selected.has(asset.asset_id);
            const label = resolveAssetLabel(asset.role, asset.slot_id);

            if (!asset.image_url && asset.status === "failed") {
              return (
                <div key={asset.asset_id} className="h-full w-full">
                  <FailedAssetCard
                    label={label}
                    productName={productName}
                    reason={asset.failure_reason}
                    onRetry={() => {
                        // Pass assetId explicitly, though openRegenModal currently uses modal, 
                        // maybe auto-trigger handleRegen directly so user doesn't have to fill instruction
                        handleRegen(asset.asset_id, "重新生成");
                    }}
                    isRegenerating={asset.isRegenerating}
                  />
                </div>
              );
            }

            return (
              <div
                key={asset.asset_id}
                className={`overflow-hidden rounded-[24px] glass-panel transition-all flex flex-col ${
                  isSelected
                    ? "shadow-md border-2 border-blue-400 translate-y-[-2px]"
                    : "shadow-md shadow-black/40 border border-slate-200 hover:border-blue-300"
                }`}
              >
                {/* 1:1 image area */}
                <div
                  className="relative w-full cursor-pointer"
                  style={{ aspectRatio: "1/1" }}
                  onClick={() => toggleSelect(asset.asset_id)}
                >
                  {/* regenerating overlay */}
                  {asset.isRegenerating && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white/90 backdrop-blur-sm">
                      <div className="relative">
                        <div className="absolute inset-0 bg-blue-500/30 blur-md rounded-full" />
                        <Loader2 className="h-10 w-10 animate-spin text-blue-600 relative" />
                      </div>
                      <span className="text-sm font-bold tracking-widest text-slate-700">重新生成中...</span>
                    </div>
                  )}

                  {/* image */}
                  <img
                    src={asset.image_url}
                    alt={label}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />

                  {/* Single centered watermark */}
                  <div className="pointer-events-none absolute inset-0 flex select-none items-center justify-center">
                    <span
                      className="whitespace-nowrap font-bold tracking-widest text-slate-900/25 rotate-[-30deg]"
                      style={{
                        fontSize: "clamp(16px, 4.5vw, 24px)",
                        textShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }}
                    >
                      AI电商做图 · 预览水印
                    </span>
                  </div>

                  {/* selection circle top-right */}
                  <div className="absolute right-3 top-3 z-20">
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all ${
                        isSelected
                          ? "border-blue-400 bg-blue-500 shadow-sm"
                          : "border-slate-300 bg-slate-100 backdrop-blur-md"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 stroke-[3] text-slate-900" />}
                    </div>
                  </div>

                  <div className="absolute top-3 left-3 z-30 flex flex-col items-start gap-1.5">
                    {asset.carry_forward && asset.source_version_no != null && (
                      <div className="rounded-full bg-white/90 backdrop-blur-sm border border-slate-300 px-2 py-0.5 text-[10px] font-bold tracking-widest text-slate-700 shadow-sm">
                        沿用自 V{asset.source_version_no}
                      </div>
                    )}
                    <QualityBadge status={asset.quality_status} reason={asset.failure_reason} />
                  </div>

                  {/* fidelity badge */}
                  {asset.fidelity_validation_status === 'passed' && (
                    <div className="absolute bottom-3 left-3 z-20">
                      <div className="rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold tracking-widest text-emerald-400 shadow-sm">
                        保真通过
                      </div>
                    </div>
                  )}
                  {asset.fidelity_validation_status === 'failed' && (
                    <div className="absolute bottom-3 left-3 z-20">
                      <div className="rounded-full bg-red-500/20 backdrop-blur-md border border-red-500/40 px-2 py-0.5 text-[10px] font-bold tracking-widest text-red-400 shadow-sm">
                        保真受限
                      </div>
                    </div>
                  )}
                </div>

                {/* Info row below image */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 backdrop-blur-md">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-bold tracking-wide text-slate-600">
                      {productName} · {label}
                    </span>
                    <button
                      onClick={() => {
                        if (actionLocked) return;
                        toggleEditOpen(asset.asset_id);
                      }}
                      disabled={actionLocked}
                      className="flex items-center gap-1.5 rounded-full border border-blue-300 bg-blue-100 px-3 py-1 text-xs font-bold tracking-wide text-blue-600 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40 shadow-sm"
                    >
                      <Pencil className="h-3 w-3" />
                      修改
                    </button>
                    <button
                      onClick={() => {
                        if (actionLocked) return;
                        setHistoryAssetId(asset.asset_id);
                      }}
                      disabled={actionLocked}
                      className="flex items-center justify-center w-6 h-6 rounded-full border border-slate-200 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 transition disabled:opacity-40 text-slate-600"
                      title="版本历史"
                    >
                      <History className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => {
                        if (actionLocked) return;
                        setFeedbackAssetId(asset.asset_id);
                      }}
                      disabled={actionLocked}
                      className="flex items-center justify-center w-6 h-6 rounded-full border border-slate-200 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 transition disabled:opacity-40 text-slate-600"
                      title="反馈质量"
                    >
                      <MessageSquare className="h-3 w-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => openRegenModal(asset.asset_id)}
                    disabled={actionLocked || asset.isRegenerating}
                    className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold tracking-wide text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 disabled:opacity-40 shadow-sm"
                  >
                    <RefreshCw className="h-3 w-3" />
                    重绘
                  </button>
                </div>

                {/* Expandable inline edit panel */}
                {asset.editOpen && (
                  <div className="border-t border-slate-200 bg-white/80 backdrop-blur-md px-4 pb-4 pt-3">
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-bold tracking-widest text-slate-500">
                          主标题
                        </label>
                        <input
                          type="text"
                          value={asset.copy_blocks.headline}
                          onChange={(e) =>
                            updateAssetText(asset.asset_id, "headline", e.target.value)
                          }
                          placeholder="输入主标题..."
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-bold tracking-widest text-slate-500">
                          副标题
                        </label>
                        <input
                          type="text"
                          value={asset.copy_blocks.supporting}
                          onChange={(e) =>
                            updateAssetText(asset.asset_id, "supporting", e.target.value)
                          }
                          placeholder="输入副标题..."
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-bold tracking-widest text-slate-500">
                          佐证短句
                        </label>
                        <textarea
                          rows={3}
                          value={copyLinesToTextarea(asset.copy_blocks.proof_lines)}
                          onChange={(e) =>
                            updateAssetLineText(asset.asset_id, "proof_lines", e.target.value)
                          }
                          placeholder={"每行一条"}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 resize-y"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-bold tracking-widest text-slate-500">
                          标签短句
                        </label>
                        <textarea
                          rows={3}
                          value={copyLinesToTextarea(asset.copy_blocks.matrix_lines)}
                          onChange={(e) =>
                            updateAssetLineText(asset.asset_id, "matrix_lines", e.target.value)
                          }
                          placeholder={"每行一条"}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 resize-y"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => saveAssetText(asset.asset_id)}
                      disabled={actionLocked}
                      className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold tracking-widest text-slate-900 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
                    >
                      <Check className="h-4 w-4" />
                      应用文案重生
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* --- Bottom fixed bar --- */}
      <div className="fixed bottom-0 left-0 right-0 z-30">
        <div className="border-t border-slate-200 bg-white/90 backdrop-blur-xl px-4 py-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
          <div className="mx-auto flex max-w-5xl items-center gap-4">
            <div className="min-w-0 flex-1 pl-2">
              {selectedCount > 0 ? (
                <>
                  <p className="text-sm font-bold tracking-widest text-slate-900">
                    已选择 <span className="text-blue-600 font-black">{selectedCount}</span> 张
                  </p>
                  <p className="truncate text-xs font-medium tracking-wide text-blue-600/70 mt-0.5">
                    确认后生成高分辨率无水印画质
                  </p>
                </>
              ) : (
                <p className="text-sm font-medium tracking-widest text-slate-500">
                  点击图片选择要生成高清版的构图
                </p>
              )}
            </div>
            <button
              onClick={() => {
                sessionStorage.setItem(
                  "selected_asset_ids",
                  JSON.stringify(Array.from(selected)),
                );
                sessionStorage.setItem("selectedImgCount", String(selectedCount));
                if (currentVersion) {
                  sessionStorage.setItem(
                    "current_result_version",
                    String(currentVersion),
                  );
                }
                setLocation("/create/payment");
              }}
              disabled={selectedCount === 0 || actionLocked}
              className="sci-fi-button flex items-center gap-2 rounded-2xl bg-blue-600 px-8 py-3.5 text-base font-bold tracking-widest text-white shadow-md transition-all active:scale-[0.98] disabled:bg-slate-200 disabled:text-white/30 disabled:border-slate-200 disabled:shadow-none"
            >
              <Sparkles className="h-5 w-5 fill-white/80" />
              执行高清生成
            </button>
          </div>
        </div>
      </div>

      {/* --- Regen modal (bottom-sheet) --- */}
      {regenModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center">
          <div
            className="absolute inset-0 bg-white backdrop-blur-sm transition-opacity"
            onClick={() => setRegenModalOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-t-3xl bg-white/95 backdrop-blur-xl border-t border-slate-200 px-5 pb-8 pt-5 shadow-[0_-20px_50px_rgba(0,0,0,0.1)] outline-none animate-in slide-in-from-bottom duration-300">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-base font-bold tracking-widest text-slate-900">重新生成</h3>
              <button
                onClick={() => setRegenModalOpen(false)}
                className="text-slate-500 transition-colors hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              请告诉 AI 你希望如何调整这张图片（可选）
            </p>
            <textarea
              ref={regenTextareaRef}
              value={regenInstruction}
              onChange={(event) => setRegenInstruction(event.target.value)}
              rows={5}
              className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 outline-none ring-0 transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
              placeholder="例如：背景更干净一些，产品更居中，去掉多余装饰..."
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {["背景换白色", "产品更突出", "文字更大", "去掉文字", "换横版构图"].map(
                (tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      setRegenInstruction((prev) => `${prev}${prev ? "；" : ""}${tag}`)
                    }
                    className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-200 hover:border-blue-300 hover:text-blue-600"
                  >
                    + {tag}
                  </button>
                ),
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                  保留元素 (逗号分隔)
                </label>
                <input
                  type="text"
                  value={regenKeepElements}
                  onChange={(e) => setRegenKeepElements(e.target.value)}
                  placeholder="例如：模特，包装"
                  className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                  去除元素 (逗号分隔)
                </label>
                <input
                  type="text"
                  value={regenRemoveElements}
                  onChange={(e) => setRegenRemoveElements(e.target.value)}
                  placeholder="例如：背景阴影，反光"
                  className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                />
              </div>
            </div>

            <button
              onClick={confirmRegen}
              disabled={regenLoading}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-base font-bold tracking-widest text-slate-900 shadow-md transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              {regenLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Wand2 className="h-5 w-5" />
              )}
              确认，开始重新生成
            </button>
          </div>
        </div>
      )}

      {/* --- Global edit modal (kept but hidden entry point) --- */}
      {globalEditOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center">
          <div
            className="absolute inset-0 bg-white backdrop-blur-sm transition-opacity"
            onClick={() => setGlobalEditOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-t-3xl bg-white/95 backdrop-blur-xl border-t border-slate-200 px-5 pb-8 pt-5 shadow-[0_-20px_50px_rgba(0,0,0,0.1)] outline-none animate-in slide-in-from-bottom duration-300">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-base font-bold tracking-widest text-slate-900">AI 整体优化</h3>
              <button
                onClick={() => setGlobalEditOpen(false)}
                className="text-slate-500 transition-colors hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-500">描述希望 AI 如何整体优化当前这一版主图。</p>
            <textarea
              value={globalInstruction}
              onChange={(event) => setGlobalInstruction(event.target.value)}
              rows={5}
              className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 outline-none ring-0 transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
              placeholder="例如：整体更高级一些，主图更聚焦产品，卖点文字更清晰"
            />
            <button
              onClick={startGlobalEdit}
              disabled={globalEditLoading}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-base font-bold tracking-widest text-slate-900 shadow-md transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              {globalEditLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Wand2 className="h-5 w-5" />
              )}
              开始整体优化
            </button>
          </div>
        </div>
      )}

      <AssetHistoryDrawer
        assetId={historyAssetId || ""}
        currentVersionNo={currentVersion ?? undefined}
        open={!!historyAssetId}
        onClose={() => setHistoryAssetId(null)}
        onRestoreSuccess={() => loadResults()}
      />

      <AssetFeedbackModal
        assetId={feedbackAssetId || ""}
        open={!!feedbackAssetId}
        onClose={() => setFeedbackAssetId(null)}
      />
    </div>
  );
}
