import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Check,
  Loader2,
  RefreshCw,
  Wand2,
  X,
} from "lucide-react";
import { StepIndicator } from "@/components/StepIndicator";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  assetAPI,
  jobAPI,
  sessionAPI,
  type SessionResults,
  type VersionSummary,
} from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  hero: "鐧藉簳涓诲浘",
  white_bg: "白底图",
  scene: "场景图",
  selling_point: "卖点图",
  feature: "功能图",
  structure: "结构图",
  detail: "详情图",
};

interface ResultAssetView {
  asset_id: string;
  role: string;
  image_url: string;
  display_order: number;
  slot_id: string;
  isRegenerating: boolean;
}

function roleToLabel(role?: string) {
  if (!role) return "涓诲浘";
  return ROLE_LABELS[role] || role;
}

function normalizeGenerationError(message: string) {
  const raw = String(message || "").trim();
  if (!raw) {
    return {
      code: "unknown",
      title: "鐢熸垚澶辫触",
      description: "本次生成未成功，请稍后重试。",
    };
  }

  if (raw.includes("white background validation failed")) {
    return {
      code: "white_bg_validation_failed",
      title: "鐧藉簳鍥炬湭閫氳繃鏍￠獙",
      description: "系统已自动重试一次，但白底图仍未达到平台校验要求。建议返回策略页微调，或直接重新生成。",
    };
  }

  if (raw.includes("insufficient") || raw.includes("credits") || raw.includes("浣欓")) {
    return {
      code: "insufficient_credits",
      title: "棰濆害涓嶈冻",
      description: "您的账户余额不足以完成本次生成，请充值后重试。",
    };
  }

  return {
    code: "generic",
    title: "鐢熸垚澶辫触",
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
  }));
}

function WatermarkOverlay() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
      <div
        className="absolute inset-[-50%] flex flex-wrap items-center justify-center gap-8"
        style={{ transform: "rotate(-30deg)" }}
      >
        {Array.from({ length: 60 }).map((_, index) => (
          <span
            key={index}
            className="select-none whitespace-nowrap text-lg font-bold text-white/20"
            style={{ letterSpacing: "0.15em" }}
          >
            AI鐢靛晢鍋氬浘 路 棰勮姘村嵃
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ResultStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const sessionId = sessionStorage.getItem("current_session_id") || "";

  const [generating, setGenerating] = useState(true);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("AI 姝ｅ湪鍔姏鐢熸垚鍥剧墖...");
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
    "浜у搧";

  const safeSetProgress = useCallback((next: number) => {
    const clamped = Math.max(progressRef.current, Math.round(next));
    progressRef.current = clamped;
    setProgress(clamped);
  }, []);

  const applyResultsData = useCallback((data: SessionResults, explicitVersion?: number) => {
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

    safeSetProgress(100);
    setGenerating(false);
  }, [safeSetProgress]);

  const loadResults = useCallback(async (version?: number) => {
    if (!sessionId) throw new Error("缂哄皯 session_id");
    const data = await sessionAPI.getResults(sessionId, version);
    applyResultsData(data, version);
    return data;
  }, [applyResultsData, sessionId]);

  const startOrRestoreResults = useCallback(async () => {
    if (!sessionId) {
      setGenerating(false);
      setError("缺少 session_id，请返回重新开始");
      toast({
        title: "缂哄皯浼氳瘽",
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
      setStatusText("姝ｅ湪鍔犺浇鐢熸垚缁撴灉...");
      progressRef.current = 0;
      setProgress(0);

      try {
        const existing = await sessionAPI.getResults(sessionId);
        if (existing.assets.length > 0) {
          applyResultsData(existing);
          return;
        }
      } catch {
        // Ignore and continue to real generation.
      }

      try {
        let fakeProgress = 0;
        fakeTimer = setInterval(() => {
          fakeProgress += Math.random() * 5 + 1;
          if (fakeProgress > 40) fakeProgress = 40;
          if (!cancelled) safeSetProgress(fakeProgress);
        }, 400);

        setStatusText("姝ｅ湪鏍￠獙涓诲浘绛栫暐...");
        const snapshot = await sessionAPI.get(sessionId).catch(() => null);
        if (!snapshot?.strategy_preview) {
          clearInterval(fakeTimer);
          setGenerating(false);
          toast({
            title: "璇峰厛纭涓诲浘绛栫暐",
            description: "当前会话还没有可用的主图策略，正在返回策略确认页。",
          });
          setLocation("/create/strategy");
          return;
        }

        if (cancelled) return;

        if (Number(snapshot.latest_result_version || 0) > 0) {
          clearInterval(fakeTimer);
          setStatusText("姝ｅ湪鍔犺浇宸叉湁涓荤粨鏋?...");
          safeSetProgress(90);
          await loadResults(snapshot.latest_result_version || undefined);
          return;
        }

        if (snapshot.latest_generate_job_id) {
          clearInterval(fakeTimer);
          setStatusText("姝ｅ湪鎭㈠宸叉湁鐢熸垚浠诲姟...");
          safeSetProgress(45);
          await jobAPI.pollUntilDone(snapshot.latest_generate_job_id, (jobStatus) => {
            const pct = jobStatus.progress ?? jobStatus.progress_pct ?? 0;
            const stage = jobStatus.stage || jobStatus.status || "";
            if (stage && !cancelled) {
              setStatusText(`鐢熸垚涓?路 ${stage}`);
            }
            if (!cancelled) {
              safeSetProgress(Math.min(Math.round(50 + pct * 0.42), 92));
            }
          });
          if (cancelled) return;
          setStatusText("姝ｅ湪鍔犺浇鐢熸垚缁撴灉...");
          safeSetProgress(95);
          await loadResults();
          return;
        }

        setStatusText("AI 姝ｅ湪鍔姏鐢熸垚鍥剧墖...");
        safeSetProgress(45);
        const generateResponse = await sessionAPI.generateGallery(sessionId);
        clearInterval(fakeTimer);

        if (generateResponse?.job_id) {
          await jobAPI.pollUntilDone(generateResponse.job_id, (jobStatus) => {
            const pct = jobStatus.progress ?? jobStatus.progress_pct ?? 0;
            const stage = jobStatus.stage || jobStatus.status || "";
            if (stage && !cancelled) {
              setStatusText(`鐢熸垚涓?路 ${stage}`);
            }
            if (!cancelled) {
              safeSetProgress(Math.min(Math.round(50 + pct * 0.42), 92));
            }
          });
        }

        if (cancelled) return;

        setStatusText("姝ｅ湪鍔犺浇鐢熸垚缁撴灉...");
        safeSetProgress(95);
        await loadResults();
      } catch (err: any) {
        clearInterval(fakeTimer);
        const normalizedError = normalizeGenerationError(err?.message || "鐢熸垚澶辫触锛岃閲嶈瘯");
        setError(normalizedError.code === "insufficient_credits" ? "insufficient_credits" : normalizedError.description);
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
  }, [applyResultsData, loadResults, safeSetProgress, sessionId, toast]);

  useEffect(() => {
    let cleanup: void | (() => void);

    startOrRestoreResults().then((dispose) => {
      cleanup = dispose;
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [startOrRestoreResults]);

  useEffect(() => {
    const notice = sessionStorage.getItem("post_login_notice");
    if (notice !== "hd_payment") return;

    sessionStorage.removeItem("post_login_notice");
    toast({
      title: "鐧诲綍鎴愬姛",
      description: "已返回当前结果页，请继续点击“生成无水印高清图”进入支付流程。",
    });
  }, [toast]);

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
    setStatusText(`姝ｅ湪鍔犺浇 V${version}...`);
    progressRef.current = 0;
    setProgress(20);
    try {
      await loadResults(version);
    } catch (err: any) {
      setGenerating(false);
      toast({
        title: "鍒囨崲鐗堟湰澶辫触",
        description: err?.message || "请稍后重试",
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
      const response = await assetAPI.regenerate(
        assetId,
        instruction || "閲嶆柊鐢熸垚",
      );
      if (response?.job_id) {
        await jobAPI.pollUntilDone(response.job_id);
      }
      await loadResults();
      toast({
        title: "閲嶆柊鐢熸垚瀹屾垚",
        description: instruction ? `已按指示调整：${instruction}` : "已重新生成图片",
      });
    } catch (err: any) {
      toast({
        title: "閲嶆柊鐢熸垚澶辫触",
        description: err?.message || "请稍后重试",
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

  const confirmGlobalEdit = async () => {
    const instruction = globalInstruction.trim() || "鏁翠綋浼樺寲";
    setGlobalEditOpen(false);
    try {
      const response: any = await sessionAPI.globalEdit(sessionId, instruction);
      if (response?.job_id) {
        await jobAPI.pollUntilDone(response.job_id);
      }
      await loadResults();
      toast({ title: "鏁翠綋浼樺寲瀹屾垚" });
    } catch (err: any) {
      toast({
        title: "鏁翠綋浼樺寲澶辫触",
        description: err?.message || "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setGlobalInstruction("");
    }
  };

  const startGlobalEdit = async () => {
    if (globalEditLoading) return;
    const instruction = globalInstruction.trim() || "Global optimize";
    setGlobalEditLoading(true);
    setGlobalEditOpen(false);
    setGenerating(true);
    setError(null);
    setStatusText("AI is optimizing all images...");
    progressRef.current = 0;
    setProgress(15);
    try {
      const response: any = await sessionAPI.globalEdit(sessionId, instruction);
      if (response?.job_id) {
        await jobAPI.pollUntilDone(response.job_id, (jobStatus) => {
          const pct = jobStatus.progress ?? jobStatus.progress_pct ?? 0;
          const stage = jobStatus.stage || jobStatus.status || "";
          if (stage) {
            setStatusText(`Optimizing - ${stage}`);
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
        description: err?.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setGlobalEditLoading(false);
      setGlobalInstruction("");
    }
  };

  const selectedCount = selected.size;
  const hasRunningAssetRegen = regenLoading || assets.some((asset) => asset.isRegenerating);
  const actionLocked = globalEditLoading || hasRunningAssetRegen;

  if (generating) {
    return (
      <div className="min-h-screen bg-[#f5f6f8]">
        <StepIndicator currentStep={5} step5Label="鐢熸垚鍥剧墖" />
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-slate-900">{statusText}</h2>
          <p className="mb-6 text-sm text-slate-500">
            璇疯€愬績绛夊緟锛孉I 姝ｅ湪涓烘偍绮惧績鍒朵綔鍥剧墖
          </p>
          <div className="mb-3 w-full max-w-sm">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500 ease-out"
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
        <StepIndicator currentStep={5} step5Label="鐢熸垚鍥剧墖" />
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
            <X className="h-10 w-10 text-red-400" />
          </div>
          <h2 className="mb-2 text-lg font-bold text-slate-900">
            {isCreditsError ? "棰濆害涓嶈冻" : "鐢熸垚澶辫触"}
          </h2>
          <p className="mb-6 max-w-xs text-center text-sm text-slate-500">
            {isCreditsError ? "您的账户余额不足以完成本次生成，请充值后重试。" : error}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/create/strategy")}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              杩斿洖涓婁竴椤?            </button>
            {isCreditsError ? (
              <button
                onClick={() => setLocation("/create/payment")}
                className="rounded-xl bg-blue-500 px-5 py-2.5 text-sm text-white transition hover:bg-blue-600"
              >
                鍘诲厖鍊?              </button>
            ) : (
              <button
                onClick={() => window.location.reload()}
                className="rounded-xl border border-blue-200 bg-white px-5 py-2.5 text-sm text-blue-600 transition hover:bg-blue-50"
              >
                閲嶈瘯
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <StepIndicator currentStep={5} step5Label="鐢熸垚鍥剧墖" />

      <div className="mx-auto max-w-lg px-4 pb-44 pt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-slate-800">
            宸茬敓鎴?{assets.length} 寮?          </span>
          <button
            onClick={() => {
              if (actionLocked) return;
              setGlobalEditOpen(true);
            }}
            disabled={actionLocked}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {globalEditLoading ? "AI 优化中..." : "AI 鏁翠綋浼樺寲"}
          </button>
        </div>

        <div className="mb-3 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          鐐瑰嚮鍥剧墖鍙充笂瑙掑嬀閫夛紝鍙€夋嫨鍝簺缁撴灉缁х画杩涘叆鏃犳按鍗伴珮娓呭浘娴佺▼銆?        </div>

        {availableVersions.length > 1 && (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-700">鐗堟湰绠＄悊</span>
              <span className="text-[11px] text-slate-400">
                棰勮銆佹敮浠樸€侀珮娓呭潎鍩轰簬褰撳墠鐗堟湰
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableVersions.map((version) => {
                const summary = versionSummaries.find(
                  (item) => item.version_no === version,
                );
                const active = version === currentVersion;
                return (
                  <button
                    key={version}
                    onClick={() => handleVersionChange(version)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      active
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    V{version}
                    {version === latestVersion ? " · 最新" : ""}
                    {summary ? ` 路 ${summary.ready_count}/${summary.asset_count}` : ""}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {assets.map((asset) => {
            const isSelected = selected.has(asset.asset_id);
            const label = roleToLabel(asset.role);

            return (
              <div key={asset.asset_id} className="relative">
                <div
                  className={`relative cursor-pointer overflow-hidden rounded-2xl transition-all ${
                    isSelected ? "ring-2 ring-blue-400" : "ring-1 ring-slate-200"
                  }`}
                  onClick={() => toggleSelect(asset.asset_id)}
                >
                  {asset.isRegenerating && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/50">
                      <Loader2 className="h-8 w-8 animate-spin text-white" />
                      <span className="text-sm font-medium text-white">
                        閲嶆柊鐢熸垚涓?..
                      </span>
                    </div>
                  )}

                  <div className="relative w-full" style={{ aspectRatio: "1 / 1" }}>
                    <img
                      src={asset.image_url}
                      alt={label}
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                    <WatermarkOverlay />
                  </div>

                  <div className="absolute right-3 top-3 z-20">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-500"
                          : "border-white/60 bg-white/80 backdrop-blur-sm"
                      }`}
                    >
                      {isSelected && <Check className="h-4 w-4 stroke-[3] text-white" />}
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between px-1">
                  <span className="text-sm font-medium text-slate-700">
                    {productName} 路 {label}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (actionLocked) return;
                        setEditTextTarget(asset.asset_id);
                        setEditTextValue("");
                        setEditTextOpen(true);
                      }}
                      disabled={actionLocked}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 transition hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      缂栬緫鏂囧瓧
                    </button>
                    <button
                      onClick={() => openRegenModal(asset.asset_id)}
                      disabled={actionLocked || asset.isRegenerating}
                      className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-40"
                    >
                      <RefreshCw className="h-3 w-3" />
                      閲嶆柊鐢熸垚
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30">
        <div className="border-t border-slate-100 bg-white px-4 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="mx-auto max-w-lg">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800">
                宸查€夋嫨 {selectedCount} 寮?              </span>
              <span className="text-xs text-slate-400">
                纭鍚庣敓鎴愭棤姘村嵃楂樻竻鍥?              </span>
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
                if (authLoading) return;
                if (!user) {
                  sessionStorage.setItem("pending_auth_action", "hd_payment");
                  toast({
                    title: "璇峰厛鐧诲綍",
                    description: "登录或注册成功后会回到当前结果页，你可以继续进入高清支付流程。",
                  });
                  setLocation(`/login?redirect=${encodeURIComponent("/create/result")}`);
                  return;
                }
                sessionStorage.removeItem("pending_auth_action");
                setLocation("/create/payment");
              }}
              disabled={selectedCount === 0 || actionLocked}
              className="w-full rounded-2xl bg-gradient-to-r from-blue-500 to-emerald-500 py-3.5 font-bold text-white shadow-lg shadow-blue-200/50 transition active:scale-[0.98] disabled:from-slate-300 disabled:to-slate-400"
            >
              鐢熸垚鏃犳按鍗伴珮娓呭浘
            </button>
          </div>
        </div>
      </div>

      {regenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setRegenModalOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-t-3xl bg-white px-5 pb-8 pt-5 shadow-2xl">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">閲嶆柊鐢熸垚</h3>
              <button
                onClick={() => setRegenModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-400">
              鍛婅瘔 AI 浣犲笇鏈涘浣曡皟鏁磋繖寮犲浘鐗?            </p>
            <textarea
              ref={regenTextareaRef}
              value={regenInstruction}
              onChange={(event) => setRegenInstruction(event.target.value)}
              rows={4}
              placeholder="渚嬪锛氳儗鏅崲鎴愮櫧鑹层€佷骇鍝佹洿绐佸嚭銆佸幓鎺夊浣欏厓绱?.."
              className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <div className="mb-5 mt-3 flex flex-wrap gap-2">
              {["背景换成白色", "产品更突出", "文字更大", "去掉文字", "换横版构图"].map(
                (tag) => (
                  <button
                    key={tag}
                    onClick={() =>
                      setRegenInstruction((previous) =>
                        previous ? `${previous}，${tag}` : tag,
                      )
                    }
                    className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-600 transition hover:bg-blue-100"
                  >
                    + {tag}
                  </button>
                ),
              )}
            </div>
            <button
              onClick={confirmRegen}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-emerald-500 py-3.5 font-bold text-white transition active:scale-[0.98]"
            >
              <RefreshCw className="h-4 w-4" />
              纭骞跺紑濮嬮噸鏂扮敓鎴?            </button>
          </div>
        </div>
      )}

      {editTextOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setEditTextOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-t-3xl bg-white px-5 pb-8 pt-5 shadow-2xl">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">缂栬緫鏂囧瓧</h3>
              <button
                onClick={() => setEditTextOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-400">
              杈撳叆浣犲笇鏈涗慨鏀圭殑鏂囧瓧鍐呭
            </p>
            <textarea
              value={editTextValue}
              onChange={(event) => setEditTextValue(event.target.value)}
              rows={4}
              autoFocus
              placeholder="渚嬪锛氭爣棰樻敼涓衡€滄柊鍝侀鍙戔€濓紝鍓爣棰樻敼涓衡€滈檺鏃剁壒鎯犫€?.."
              className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={confirmEditText}
              className="mt-4 w-full rounded-2xl bg-gradient-to-r from-blue-500 to-emerald-500 py-3.5 font-bold text-white transition active:scale-[0.98]"
            >
              纭淇敼
            </button>
          </div>
        </div>
      )}

      {globalEditOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setGlobalEditOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-t-3xl bg-white px-5 pb-8 pt-5 shadow-2xl">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">AI 鏁翠綋浼樺寲鍥剧墖</h3>
              <button
                onClick={() => setGlobalEditOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-400">
              鍛婅瘔 AI 浣犲笇鏈涘鎵€鏈夊浘鐗囧仛鍝簺鏁翠綋璋冩暣
            </p>
            <textarea
              value={globalInstruction}
              onChange={(event) => setGlobalInstruction(event.target.value)}
              rows={4}
              placeholder="渚嬪锛氭暣浣撹壊璋冩洿鏆栥€佷骇鍝佹斁澶т竴鐐广€佽儗鏅洿绠€娲?.."
              className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <div className="mb-5 mt-3 flex flex-wrap gap-2">
              {["色调更暖", "产品放大", "背景更简洁", "增加品牌感", "对比度更强"].map(
                (tag) => (
                  <button
                    key={tag}
                    onClick={() =>
                      setGlobalInstruction((previous) =>
                        previous ? `${previous}，${tag}` : tag,
                      )
                    }
                    className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-600 transition hover:bg-blue-100"
                  >
                    + {tag}
                  </button>
                ),
              )}
            </div>
            <button
              onClick={startGlobalEdit}
              disabled={globalEditLoading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-emerald-500 py-3.5 font-bold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Wand2 className="h-4 w-4" />
              {globalEditLoading ? "优化中..." : "纭骞跺紑濮?AI 浼樺寲"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
