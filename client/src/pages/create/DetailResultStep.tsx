import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertCircle,
  CloudUpload,
  Crown,
  Download,
  Loader2,
  RefreshCw,
  Share2,
  Sparkles,
  X,
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { jobAPI, sessionAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

import { DetailStepIndicator } from "./DetailStepIndicator";

type DetailPanel = {
  asset_id: string;
  panel_id?: string;
  slot_id?: string;
  panel_label?: string | null;
  image_url: string;
  thumbnail_url?: string | null;
  display_order: number;
  version_no?: number;
};

type DetailStitchedAsset = {
  asset_id: string;
  image_url: string;
  thumbnail_url?: string | null;
  version_no?: number;
  width?: number;
  height?: number;
};

type DetailResultsPayload = {
  session_id: string;
  status: string;
  detail_generation_round: number;
  detail_latest_result_version: number;
  requested_version: number;
  available_versions: number[];
  version_summaries: Array<{ version_no: number; asset_count: number; ready_count: number }>;
  summary: {
    total_count: number;
    ready_count: number;
    panel_count: number;
  };
  panels: DetailPanel[];
  stitched_asset: DetailStitchedAsset | null;
};

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

async function downloadDetailImagesDirectly(results: DetailResultsPayload, version: number) {
  const queue: Array<{ url: string; filename: string }> = [];

  if (results.stitched_asset?.image_url) {
    queue.push({
      url: results.stitched_asset.image_url,
      filename: `detail-page-long-v${version || 1}.png`,
    });
  }

  results.panels.forEach((panel, index) => {
    if (!panel.image_url) return;
    queue.push({
      url: panel.image_url,
      filename: `${panel.panel_label || `detail-${index + 1}`}-v${version || 1}.png`,
    });
  });

  for (let index = 0; index < queue.length; index += 1) {
    const item = queue[index];
    triggerBrowserDownload(item.url, item.filename);
    if (index < queue.length - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 180));
    }
  }

  return queue.length;
}

function normalizeDetailResults(data: any): DetailResultsPayload {
  const panels = Array.isArray(data?.panels) ? data.panels : [];
  const sortedPanels: DetailPanel[] = panels
    .map((panel: any, index: number) => ({
      asset_id: String(panel?.asset_id || `${index + 1}`),
      panel_id: panel?.panel_id ?? null,
      slot_id: panel?.slot_id ?? null,
      panel_label: panel?.panel_label ?? panel?.panel_id ?? `详情图 ${index + 1}`,
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
    version_summaries: Array.isArray(data?.version_summaries)
      ? data.version_summaries.map((summary: any) => ({
          version_no: Number(summary?.version_no || 0),
          asset_count: Number(summary?.asset_count || 0),
          ready_count: Number(summary?.ready_count || 0),
        }))
      : [],
    summary: {
      total_count: Number(data?.summary?.total_count || sortedPanels.length),
      ready_count: Number(data?.summary?.ready_count || sortedPanels.length),
      panel_count: Number(data?.summary?.panel_count || sortedPanels.length),
    },
    panels: sortedPanels,
    stitched_asset: data?.stitched_asset
      ? {
          asset_id: String(data.stitched_asset.asset_id || "stitched"),
          image_url: String(data.stitched_asset.image_url || data.stitched_asset.thumbnail_url || ""),
          thumbnail_url: data.stitched_asset.thumbnail_url ?? null,
          version_no:
            typeof data.stitched_asset.version_no === "number"
              ? data.stitched_asset.version_no
              : undefined,
          width:
            typeof data.stitched_asset.width === "number" ? data.stitched_asset.width : undefined,
          height:
            typeof data.stitched_asset.height === "number"
              ? data.stitched_asset.height
              : undefined,
        }
      : null,
  };
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

function buildClaimRedirect(pathname: string, search: string) {
  const url = new URL(`${pathname}${search || ""}`, window.location.origin);
  url.searchParams.set("claim", "1");
  return `/login?redirect=${encodeURIComponent(`${url.pathname}${url.search}`)}`;
}

export default function DetailResultStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const sessionId = sessionStorage.getItem("current_session_id") || "";
  const claimRedirect = buildClaimRedirect(window.location.pathname, window.location.search);
  const shouldClaimAfterLogin = new URLSearchParams(window.location.search).get("claim") === "1";

  const [phase, setPhase] = useState<"loading" | "done" | "error">("loading");
  const [progress, setProgress] = useState(8);
  const [loadingText, setLoadingText] = useState("正在生成详情图...");
  const [error, setError] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [results, setResults] = useState<DetailResultsPayload | null>(null);
  const [currentVersion, setCurrentVersion] = useState(0);
  const [canDownload, setCanDownload] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [brandName, setBrandName] = useState("");

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
        setLoadingText(resolveStageText(status?.stage || status?.status));
      },
      2000,
      300000,
    );

    const snapshot = await sessionAPI.get(sessionId);
    setCanDownload(!!snapshot.can_download);
    const targetVersion = snapshot.detail_latest_result_version || undefined;
    await fetchDetailResults(targetVersion);
    setProgress(100);
    setPhase("done");
  }

  async function startGeneration() {
    const generation = await sessionAPI.generateDetailPage(sessionId);
    const jobId = generation?.job_id || generation?.jobId;
    if (!jobId) {
      throw new Error("未拿到详情图任务 ID");
    }
    await waitForDetailGeneration(jobId);
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!sessionId) {
        setLocation("/create/copywriting");
        return;
      }

      try {
        setError("");
        setPhase("loading");

        if (user && shouldClaimAfterLogin) {
          setClaiming(true);
          await sessionAPI.claimGuestSession(sessionId);
          if (!cancelled) {
            window.history.replaceState({}, "", window.location.pathname);
            toast({
              title: "已保存到当前账户",
              description: "当前详情图结果已归档到你的账户。",
            });
          }
        }

        const snapshot = await sessionAPI.get(sessionId);
        if (cancelled) return;

        setCanDownload(!!snapshot.can_download);

        const shouldAutostart = sessionStorage.getItem("detail_result_autostart") === "true";
        sessionStorage.removeItem("detail_result_autostart");

        if (shouldAutostart) {
          await startGeneration();
          if (cancelled) return;
          toast({
            title: "详情图生成完成",
            description: "已切换到当前最新版本。",
          });
          return;
        }

        if (Number(snapshot.detail_latest_result_version || 0) > 0) {
          await fetchDetailResults(snapshot.detail_latest_result_version || undefined);
          if (cancelled) return;
          setProgress(100);
          setPhase("done");
          return;
        }

        if (snapshot.latest_detail_generate_job_id) {
          await waitForDetailGeneration(
            snapshot.latest_detail_generate_job_id,
            "正在恢复已有详情图任务...",
          );
          return;
        }

        await startGeneration();
      } catch (err: any) {
        if (!cancelled) {
          setPhase("error");
          setError(err?.message || "详情图生成失败");
        }
      } finally {
        if (!cancelled) {
          setClaiming(false);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [sessionId, setLocation, shouldClaimAfterLogin, toast, user]);

  const handleRetry = async () => {
    if (!sessionId || regenerating) return;
    try {
      setRegenerating(true);
      await startGeneration();
      toast({
        title: "已重新生成详情图",
        description: "当前显示的是最新生成结果。",
      });
    } catch (err: any) {
      setPhase("error");
      setError(err?.message || "重新生成详情图失败");
    } finally {
      setRegenerating(false);
    }
  };

  const handleVersionChange = async (version: number) => {
    if (!sessionId || version === currentVersion) return;
    try {
      setPhase("loading");
      setLoadingText(`正在加载 V${version} 详情图...`);
      setProgress(30);
      await fetchDetailResults(version);
      setProgress(100);
      setPhase("done");
    } catch (err: any) {
      setPhase("error");
      setError(err?.message || "切换详情图版本失败");
    }
  };

  const handleDownloadAll = async () => {
    if (!sessionId || !results) return;

    try {
      setDownloading(true);
      if (canDownload) {
        const blob = await sessionAPI.downloadDetailResults(sessionId, currentVersion || undefined);
        const url = URL.createObjectURL(blob);
        triggerBrowserDownload(url, `detail-page-v${currentVersion || 1}.zip`);
        URL.revokeObjectURL(url);
        toast({ title: "开始下载", description: "详情图压缩包已开始下载。" });
      } else {
        const count = await downloadDetailImagesDirectly(results, currentVersion || 1);
        toast({ title: "开始下载", description: `已为你发起 ${count} 张详情图下载。` });
      }
    } catch (err: any) {
      toast({
        title: "下载失败",
        description: err?.message || "请稍后重试。",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleRememberBrand = () => {
    setBrandOpen(true);
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
    setBrandName("");
    setBrandOpen(false);
    toast({
      title: "已记住品牌风格",
      description: `已保存品牌“${trimmed}”的本地风格记录，正在返回首页。`,
    });
    setLocation("/");
  };

  const handleArchiveToAccount = async () => {
    if (!sessionId) return;
    if (!user) {
      setLocation(claimRedirect);
      return;
    }

    setClaiming(true);
    try {
      const snapshot = await sessionAPI.claimGuestSession(sessionId);
      setCanDownload(!!snapshot.can_download);
      toast({
        title: "已保存到当前账户",
        description: "当前详情图结果已归档到你的账户。",
      });
    } catch (err: any) {
      toast({
        title: "保存失败",
        description: err?.message || "请稍后重试。",
        variant: "destructive",
      });
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <DetailStepIndicator currentStep={3} />

      {(phase === "loading" || claiming) && (
        <div className="flex flex-1 flex-col items-center justify-center px-4">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-200">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h2 className="mb-1 text-lg font-bold text-slate-900">
            {claiming ? "正在保存到你的账户..." : "正在生成详情图..."}
          </h2>
          <p className="mb-5 text-sm text-slate-500">
            {claiming ? "请稍候，我们正在认领当前会话。" : loadingText}
          </p>
          {!claiming && (
            <>
              <div className="mb-2 w-full max-w-xs">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <p className="text-sm text-slate-400">{progress}%</p>
            </>
          )}
        </div>
      )}

      {phase === "error" && !claiming && (
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

      {phase === "done" && results && !claiming && (
        <div className="flex flex-1 flex-col">
          <div className="flex items-center gap-2.5 border-b border-amber-100 bg-amber-50 px-4 py-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500">
              <Crown className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">详情图已生成完成</div>
              <div className="text-xs text-slate-500">当前展示的是当前版本对应的详情图结果</div>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-40 pt-4">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {(results.available_versions || []).map((version) => {
                const active = version === currentVersion;
                const summary = results.version_summaries.find((item) => item.version_no === version);
                return (
                  <button
                    key={version}
                    onClick={() => handleVersionChange(version)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      active
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    V{version}
                    {summary ? ` · ${summary.ready_count}/${summary.asset_count}` : ""}
                  </button>
                );
              })}
            </div>

            {results.stitched_asset && (
              <div className="mb-5 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                <img
                  src={results.stitched_asset.image_url}
                  alt="详情长图"
                  className="w-full object-contain"
                />
              </div>
            )}

            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-slate-500">
                共 {results.summary.panel_count || results.panels.length} 张详情图
              </div>
              <button
                onClick={handleRetry}
                disabled={regenerating}
                className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-50"
              >
                {regenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                重新生成
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {results.panels.map((panel, index) => (
                <div
                  key={panel.asset_id}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="border-b border-slate-100 px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">
                      {panel.panel_label || `详情图 ${index + 1}`}
                    </div>
                  </div>
                  <div className="bg-slate-100 p-3">
                    <img
                      src={panel.image_url}
                      alt={panel.panel_label || `详情图 ${index + 1}`}
                      className="w-full rounded-2xl object-contain"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!canDownload && phase === "done" && !claiming && (
        <div className="fixed bottom-24 left-0 right-0 z-20 border-t border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-500">
                <CloudUpload className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  登录账号，自动保存你的设计资产
                </div>
                <div className="text-xs text-slate-400">避免图片丢失</div>
              </div>
            </div>
            <button
              onClick={handleArchiveToAccount}
              className="rounded-full bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-600"
            >
              登录 / 注册
            </button>
          </div>
        </div>
      )}

      {phase === "done" && results && !claiming && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <button
              onClick={handleDownloadAll}
              disabled={downloading}
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 disabled:opacity-50"
            >
              {downloading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Download className="h-5 w-5" />
              )}
              一键下载
            </button>
            <button
              onClick={() => setShareOpen(true)}
              className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300"
            >
              <Share2 className="h-5 w-5" />
            </button>
            <button
              onClick={handleRememberBrand}
              className="flex h-14 flex-[1.1] items-center justify-center gap-2 rounded-2xl bg-blue-500 text-white transition hover:bg-blue-600"
            >
              <CloudUpload className="h-5 w-5" />
              记住品牌风格
            </button>
          </div>
        </div>
      )}

      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShareOpen(false)} />
          <div className="relative w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">分享详情图</h3>
              <button onClick={() => setShareOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-500">
              当前先复制页面链接用于分享，后续可再接正式分享能力。
            </p>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(window.location.href);
                toast({ title: "链接已复制", description: "当前页面链接已复制到剪贴板。" });
                setShareOpen(false);
              }}
              className="w-full rounded-2xl bg-blue-500 py-3 text-sm font-semibold text-white hover:bg-blue-600"
            >
              复制链接
            </button>
          </div>
        </div>
      )}

      {brandOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setBrandOpen(false)} />
          <div className="relative w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">记住品牌风格</h3>
              <button onClick={() => setBrandOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-sm text-slate-500">
              当前仅做前端本地保存，占位模拟模板效果，不会回传后端。
            </p>
            <input
              value={brandName}
              onChange={(event) => setBrandName(event.target.value)}
              placeholder="请输入品牌名称"
              className="mb-4 h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-blue-400"
            />
            <button
              onClick={handleSaveBrand}
              disabled={!brandName.trim()}
              className="w-full rounded-2xl bg-blue-500 py-3 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
            >
              保存
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
