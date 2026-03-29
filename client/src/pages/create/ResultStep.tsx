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
} from "lucide-react";

import { StepIndicator } from "@/components/StepIndicator";
import { updateSessionRecord } from "@/lib/localUser";
import { useToast } from "@/hooks/use-toast";
import {
  assetAPI,
  jobAPI,
  sessionAPI,
  type SessionResults,
  type VersionSummary,
} from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  hero: "主图",
  white_bg: "白底图",
  scene: "场景图",
  selling_point: "卖点图",
  feature: "功能图",
  structure: "结构图",
  detail: "详情图",
};

type ResultAssetView = {
  asset_id: string;
  role: string;
  image_url: string;
  display_order: number;
  slot_id: string;
  isRegenerating: boolean;
  editOpen: boolean;
  texts: { title: string; subtitle: string; footer: string };
};

function roleToLabel(role?: string) {
  if (!role) return "主图";
  return ROLE_LABELS[role] || role;
}

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

function buildViewAssets(data: SessionResults): ResultAssetView[] {
  return (data.assets || []).map((asset, index) => ({
    asset_id: asset.asset_id,
    role: asset.role,
    image_url: asset.image_url,
    display_order: asset.display_order ?? index,
    slot_id: asset.slot_id || "",
    isRegenerating: false,
    editOpen: false,
    texts: { title: "", subtitle: "", footer: "" },
  }));
}

export default function ResultStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const sessionId = sessionStorage.getItem("current_session_id") || "";

  const [generating, setGenerating] = useState(true);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("AI 正在努力生成图片...");
  const [error, setError] = useState<string | null>(null);

  const [assets, setAssets] = useState<ResultAssetView[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [availableVersions, setAvailableVersions] = useState<number[]>([]);
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);
  const [latestVersion, setLatestVersion] = useState<number>(0);
  const [versionSummaries, setVersionSummaries] = useState<VersionSummary[]>([]);

  const [regenModalOpen, setRegenModalOpen] = useState(false);
  const [regenTargetId, setRegenTargetId] = useState<string | null>(null);
  const [regenInstruction, setRegenInstruction] = useState("");
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
    (data: SessionResults, explicitVersion?: number) => {
      const nextAssets = buildViewAssets(data);
      const resolvedVersion =
        explicitVersion || data.requested_version || data.latest_result_version || null;

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
      const data = await sessionAPI.getResults(sessionId, version);
      applyResultsData(data, version);
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
      setError(null);
      setStatusText("正在加载生成结果...");
      progressRef.current = 0;
      setProgress(0);

      try {
        const existing = await sessionAPI.getResults(sessionId);
        if (existing.assets.length > 0) {
          applyResultsData(existing);
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
              if (stage && !cancelled) {
                setStatusText(`生成中 · ${stage}`);
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

        setStatusText("AI 正在努力生成图片...");
        safeSetProgress(45);
        const generateResponse = await sessionAPI.generateGallery(sessionId);
        clearInterval(fakeTimer);

        if (generateResponse?.job_id) {
          await jobAPI.pollUntilDone(generateResponse.job_id, (jobStatus) => {
            const pct = jobStatus.progress ?? jobStatus.progress_pct ?? 0;
            const stage = jobStatus.stage || jobStatus.status || "";
            if (stage && !cancelled) {
              setStatusText(`生成中 · ${stage}`);
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
    setRegenModalOpen(true);
    setTimeout(() => regenTextareaRef.current?.focus(), 120);
  };

  const handleVersionChange = async (version: number) => {
    if (!sessionId || version === currentVersion) return;
    setGenerating(true);
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

  const handleRegen = async (assetId: string, instruction: string) => {
    setAssets((previous) =>
      previous.map((asset) =>
        asset.asset_id === assetId ? { ...asset, isRegenerating: true } : asset,
      ),
    );

    try {
      const response = await assetAPI.regenerate(assetId, instruction || "重新生成");
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
    await handleRegen(regenTargetId, regenInstruction);
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
          if (stage) {
            setStatusText(`优化中 · ${stage}`);
          }
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
    field: "title" | "subtitle" | "footer",
    value: string,
  ) => {
    setAssets((prev) =>
      prev.map((a) =>
        a.asset_id === assetId
          ? { ...a, texts: { ...a.texts, [field]: value } }
          : a,
      ),
    );
  };

  const saveAssetText = async (assetId: string) => {
    const asset = assets.find((a) => a.asset_id === assetId);
    if (!asset) return;
    const { title, subtitle, footer } = asset.texts;
    const parts: string[] = [];
    if (title.trim()) parts.push(`主标题：${title.trim()}`);
    if (subtitle.trim()) parts.push(`副标题：${subtitle.trim()}`);
    if (footer.trim()) parts.push(`底部文字：${footer.trim()}`);
    if (parts.length === 0) {
      // nothing to do, just close
      setAssets((prev) =>
        prev.map((a) =>
          a.asset_id === assetId ? { ...a, editOpen: false } : a,
        ),
      );
      return;
    }
    const instruction = `修改文字：${parts.join("；")}`;
    setAssets((prev) =>
      prev.map((a) =>
        a.asset_id === assetId ? { ...a, editOpen: false } : a,
      ),
    );
    await handleRegen(assetId, instruction);
  };

  const selectedCount = selected.size;
  const hasRunningAssetRegen = regenLoading || assets.some((asset) => asset.isRegenerating);
  const actionLocked = globalEditLoading || hasRunningAssetRegen;

  if (generating) {
    return (
      <div className="min-h-screen bg-[#f5f6f8]">
        <StepIndicator currentStep={5} step5Label="生成图片" />
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-slate-900">{statusText}</h2>
          <p className="mb-6 text-sm text-slate-500">请耐心等待，AI 正在为您精心制作图片</p>
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
      </div>
    );
  }

  if (error && assets.length === 0) {
    const isCreditsError = error === "insufficient_credits";
    return (
      <div className="min-h-screen bg-[#f5f6f8]">
        <StepIndicator currentStep={5} step5Label="生成图片" />
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
            <X className="h-10 w-10 text-red-400" />
          </div>
          <h2 className="mb-2 text-lg font-bold text-slate-900">
            {isCreditsError ? "额度不足" : "生成失败"}
          </h2>
          <p className="mb-6 max-w-xs text-center text-sm text-slate-500">
            {isCreditsError
              ? "当前额度不足以完成本次生成，请稍后重试或联系后端补充联调额度。"
              : error}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/create/strategy")}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              返回上一页
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl border border-blue-200 bg-white px-5 py-2.5 text-sm text-blue-600 transition hover:bg-blue-50"
            >
              重试
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <StepIndicator currentStep={5} step5Label="生成图片" />

      <div className="mx-auto max-w-lg px-4 pb-44 pt-4">
        {/* --- Top status bar --- */}
        <div className="mb-1 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500">
              <Check className="h-3 w-3 stroke-[3] text-white" />
            </div>
            <span className="text-sm font-bold text-slate-800">
              已生成 {assets.length} 张图片
            </span>
          </div>
          <button
            onClick={() => setLocation("/create/generate")}
            className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-blue-300 hover:text-blue-600"
          >
            <RotateCcw className="h-3 w-3" />
            重新生成
          </button>
        </div>
        <p className="mb-4 text-xs text-slate-400">预览图含水印，付费后生成高清清图</p>

        {/* --- Image cards --- */}
        <div className="space-y-3">
          {assets.map((asset) => {
            const isSelected = selected.has(asset.asset_id);
            const label = roleToLabel(asset.role);

            return (
              <div
                key={asset.asset_id}
                className={`overflow-hidden rounded-2xl bg-white transition-all ${
                  isSelected
                    ? "shadow-md shadow-blue-100 ring-2 ring-blue-400"
                    : "shadow-sm ring-1 ring-slate-100"
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
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/50">
                      <Loader2 className="h-8 w-8 animate-spin text-white" />
                      <span className="text-sm font-medium text-white">重新生成中...</span>
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
                      className="whitespace-nowrap font-bold tracking-widest text-white/25 rotate-[-30deg]"
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
                          ? "border-blue-500 bg-blue-500"
                          : "border-white/60 bg-white/80 backdrop-blur-sm"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 stroke-[3] text-white" />}
                    </div>
                  </div>
                </div>

                {/* Info row below image */}
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-600">
                      {productName} · {label}
                    </span>
                    <button
                      onClick={() => {
                        if (actionLocked) return;
                        toggleEditOpen(asset.asset_id);
                      }}
                      disabled={actionLocked}
                      className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Pencil className="h-3 w-3" />
                      编辑文字
                    </button>
                  </div>
                  <button
                    onClick={() => openRegenModal(asset.asset_id)}
                    disabled={actionLocked || asset.isRegenerating}
                    className="flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 disabled:opacity-40"
                  >
                    <RefreshCw className="h-3 w-3" />
                    重新生成
                  </button>
                </div>

                {/* Expandable inline edit panel */}
                {asset.editOpen && (
                  <div className="border-t border-slate-100 bg-slate-50 px-3 pb-3 pt-2">
                    <div className="space-y-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">
                          主标题
                        </label>
                        <input
                          type="text"
                          value={asset.texts.title}
                          onChange={(e) =>
                            updateAssetText(asset.asset_id, "title", e.target.value)
                          }
                          placeholder="输入主标题..."
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">
                          副标题
                        </label>
                        <input
                          type="text"
                          value={asset.texts.subtitle}
                          onChange={(e) =>
                            updateAssetText(asset.asset_id, "subtitle", e.target.value)
                          }
                          placeholder="输入副标题..."
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">
                          底部文字
                        </label>
                        <input
                          type="text"
                          value={asset.texts.footer}
                          onChange={(e) =>
                            updateAssetText(asset.asset_id, "footer", e.target.value)
                          }
                          placeholder="输入底部文字..."
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => saveAssetText(asset.asset_id)}
                      disabled={actionLocked}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Check className="h-3.5 w-3.5" />
                      保存文字
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
        <div className="border-t border-slate-100 bg-white px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <div className="min-w-0 flex-1">
              {selectedCount > 0 ? (
                <>
                  <p className="text-sm font-semibold text-slate-900">
                    已选择 <span className="text-blue-600">{selectedCount}</span> 张
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    确认后生成无水印高清图...
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-400">
                  点击图片选择要生成高清版的图片
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
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-200/50 transition active:scale-[0.98] disabled:from-slate-300 disabled:to-slate-400"
            >
              <Sparkles className="h-4 w-4" />
              生成无水印高清图
            </button>
          </div>
        </div>
      </div>

      {/* --- Regen modal (bottom-sheet) --- */}
      {regenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setRegenModalOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-t-3xl bg-white px-5 pb-8 pt-5 shadow-2xl">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">重新生成</h3>
              <button
                onClick={() => setRegenModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-400">
              请告诉 AI 你希望如何调整这张图片（可选）
            </p>
            <textarea
              ref={regenTextareaRef}
              value={regenInstruction}
              onChange={(event) => setRegenInstruction(event.target.value)}
              rows={5}
              className="w-full rounded-2xl border border-blue-200 px-4 py-3 text-sm text-slate-700 outline-none ring-0 transition focus:border-blue-400"
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
                    className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-600 transition hover:bg-blue-100"
                  >
                    + {tag}
                  </button>
                ),
              )}
            </div>
            <button
              onClick={confirmRegen}
              disabled={regenLoading}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-emerald-500 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-200/50 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {regenLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              确认，开始重新生成
            </button>
          </div>
        </div>
      )}

      {/* --- Global edit modal (kept but hidden entry point) --- */}
      {globalEditOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setGlobalEditOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-t-3xl bg-white px-5 pb-8 pt-5 shadow-2xl">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">AI 整体优化</h3>
              <button
                onClick={() => setGlobalEditOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-400">描述希望 AI 如何整体优化当前这一版主图。</p>
            <textarea
              value={globalInstruction}
              onChange={(event) => setGlobalInstruction(event.target.value)}
              rows={5}
              className="w-full rounded-2xl border border-blue-200 px-4 py-3 text-sm text-slate-700 outline-none ring-0 transition focus:border-blue-400"
              placeholder="例如：整体更高级一些，主图更聚焦产品，卖点文字更清晰"
            />
            <button
              onClick={startGlobalEdit}
              disabled={globalEditLoading}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-emerald-500 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-200/50 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {globalEditLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              开始整体优化
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
