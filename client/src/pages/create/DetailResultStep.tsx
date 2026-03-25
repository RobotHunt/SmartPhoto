import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertCircle,
  CheckCircle2,
  CloudUpload,
  Crown,
  Download,
  Info,
  Loader2,
  RefreshCw,
  Share2,
  Sparkles,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { jobAPI, sessionAPI } from "@/lib/api";

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

function normalizeDetailResults(data: any): DetailResultsPayload {
  const panels = Array.isArray(data?.panels) ? data.panels : [];
  const sortedPanels = panels
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
    .sort(
      (a: { display_order: number }, b: { display_order: number }) =>
        a.display_order - b.display_order,
    );

  return {
    session_id: String(data?.session_id || ""),
    status: String(data?.status || ""),
    detail_generation_round: Number(data?.detail_generation_round || 0),
    detail_latest_result_version: Number(
      data?.detail_latest_result_version || data?.requested_version || 0,
    ),
    requested_version: Number(data?.requested_version || data?.detail_latest_result_version || 0),
    available_versions: Array.isArray(data?.available_versions)
      ? data.available_versions
          .map((version: any) => Number(version || 0))
          .filter(Boolean)
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
          image_url: String(
            data.stitched_asset.image_url || data.stitched_asset.thumbnail_url || "",
          ),
          thumbnail_url: data.stitched_asset.thumbnail_url ?? null,
          version_no:
            typeof data.stitched_asset.version_no === "number"
              ? data.stitched_asset.version_no
              : undefined,
          width:
            typeof data.stitched_asset.width === "number"
              ? data.stitched_asset.width
              : undefined,
          height:
            typeof data.stitched_asset.height === "number"
              ? data.stitched_asset.height
              : undefined,
        }
      : null,
  };
}

function resolveStageText(stage: string | undefined) {
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

export default function DetailResultStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const sessionId = sessionStorage.getItem("current_session_id") || "";
  const authRedirect = `/login?redirect=${encodeURIComponent(
    `${window.location.pathname}${window.location.search}`,
  )}`;

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

        const snapshot = await sessionAPI.get(sessionId);
        const shouldAutostart =
          sessionStorage.getItem("detail_result_autostart") === "true";
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
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [sessionId, setLocation, toast]);

  const handleRetry = async () => {
    if (!sessionId || regenerating) return;
    try {
      setRegenerating(true);
      await startGeneration();
      toast({
        title: "已重新生成详情图",
        description: "当前展示的是最新生成结果。",
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
      const blob = await sessionAPI.downloadDetailResults(
        sessionId,
        currentVersion || undefined,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `detail-page-v${currentVersion || 1}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "开始下载", description: "详情图压缩包已开始下载。" });
    } catch (err: any) {
      toast({
        title: "下载失败",
        description: err?.message || "详情图下载失败",
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
    setBrandSavedName(trimmed);
    setBrandName("");
    setBrandOpen(false);
    setBrandSuccessOpen(true);
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <DetailStepIndicator currentStep={3} />

      {phase === "loading" && (
        <div className="flex flex-1 flex-col items-center justify-center px-4">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-200">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h2 className="mb-1 text-lg font-bold text-slate-900">正在生成详情图...</h2>
          <p className="mb-5 text-sm text-slate-500">{loadingText}</p>
          <div className="mb-2 w-full max-w-xs">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <p className="text-sm text-slate-400">{progress}%</p>
        </div>
      )}

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

      {phase === "done" && results && (
        <div className="flex flex-1 flex-col">
          <div className="flex items-center gap-2.5 border-b border-amber-100 bg-amber-50 px-4 py-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500">
              <Crown className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-900">详情图生成成功</p>
              <p className="text-xs text-amber-600">无水印高清详情图，可直接用于商品详情页上架</p>
            </div>
            <button
              onClick={handleRetry}
              disabled={regenerating}
              className="flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-500 transition hover:text-slate-700 disabled:opacity-60"
            >
              {regenerating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              重新生成
            </button>
          </div>

          {results.available_versions.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto border-b bg-white px-4 py-3">
              <span className="shrink-0 text-xs text-slate-400">版本</span>
              {results.available_versions.map((version) => (
                <button
                  key={version}
                  onClick={() => handleVersionChange(version)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                    version === currentVersion
                      ? "bg-blue-500 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  V{version}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto pb-36">
            <div className="border-b bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    当前版本共 {results.summary.panel_count || results.panels.length} 张详情图
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    当前展示 V{currentVersion || results.detail_latest_result_version || 1}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  已完成
                </div>
              </div>
            </div>

            {results.stitched_asset?.image_url && (
              <div className="border-b bg-white">
                <div className="px-4 py-2 text-sm font-semibold text-slate-700">详情长图</div>
                <img
                  src={results.stitched_asset.image_url}
                  alt="详情长图"
                  className="w-full object-cover"
                />
              </div>
            )}

            {results.panels.map((panel, index) => (
              <div key={panel.asset_id} className="border-b bg-white">
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-sm text-slate-600">
                    {panel.panel_label || `详情图 ${index + 1}`}
                  </span>
                  <span className="text-xs text-slate-400">#{index + 1}</span>
                </div>
                <img
                  src={panel.image_url}
                  alt={panel.panel_label || `详情图 ${index + 1}`}
                  className="w-full object-cover"
                />
              </div>
            ))}
          </div>

          <div className="fixed bottom-0 left-0 right-0 z-30">
            <div className="flex items-center gap-2.5 border-t border-slate-100 bg-white px-4 py-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50">
                <CloudUpload className="h-4 w-4 text-blue-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-800">登录账号，自动保存你的设计资产</p>
                <p className="text-xs text-slate-400">后续登录回看与下载会更方便</p>
              </div>
              <a
                href={authRedirect}
                className="shrink-0 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-600"
              >
                登录 / 注册
              </a>
            </div>

            <div className="flex gap-2 border-t border-slate-100 bg-white px-4 py-2.5 shadow-lg">
              <Button
                size="lg"
                variant="outline"
                className="flex-1 gap-1.5 border-slate-200 text-slate-600"
                onClick={handleDownloadAll}
                disabled={downloading}
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                一键下载
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="px-3 text-slate-500"
                onClick={() => setShareOpen(true)}
              >
                <Share2 className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                className="flex-1 bg-blue-500 text-white hover:bg-blue-600"
                onClick={handleRememberBrand}
              >
                记住品牌风格
              </Button>
            </div>
          </div>
        </div>
      )}

      {shareOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={() => setShareOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-sm rounded-t-2xl bg-white px-5 pb-8 pt-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">选择分享方式</h3>
              <button
                onClick={() => setShareOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <button
              className="h-11 w-full rounded-full bg-blue-500 text-sm font-semibold text-white transition-colors hover:bg-blue-600"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href).catch(() => {});
                toast({
                  title: "已复制链接",
                  description: "可以把详情图页面链接发给同事查看。",
                });
                setShareOpen(false);
              }}
            >
              复制链接
            </button>
          </div>
        </div>
      )}

      {brandOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={() => setBrandOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-sm rounded-t-2xl bg-white px-5 pb-8 pt-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => setBrandOpen(false)}
              className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="mb-1 text-lg font-bold text-slate-900">保存品牌/店铺风格</h3>
            <p className="mb-4 text-xs leading-relaxed text-slate-500">
              这一版先按前端本地占位方式保存，不回传后端。后续补品牌风格库接口后，再切换成真实云端保存。
            </p>

            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                品牌 / 店铺名称
              </label>
              <input
                type="text"
                value={brandName}
                onChange={(event) => setBrandName(event.target.value)}
                placeholder="例如：NaoNao宠物、小米官方旗舰店"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm placeholder:text-slate-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
              <div className="mb-2 flex items-center gap-1.5">
                <span className="text-sm font-semibold text-blue-900">保存品牌风格</span>
                <Info className="h-3.5 w-3.5 text-blue-400" />
              </div>
              <p className="mb-3 text-xs leading-relaxed text-slate-500">
                模型可以记录你生成过的品牌风格。以后生成同品牌图片时，选择品牌即可自动应用一致风格。
              </p>
              <ul className="space-y-1.5">
                {["产品实拍", "全套展示", "渲染图", "详情页版式"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={handleSaveBrand}
              disabled={!brandName.trim()}
              className={`h-11 w-full rounded-2xl text-sm font-semibold transition-colors ${
                brandName.trim()
                  ? "bg-blue-500 text-white hover:bg-blue-600"
                  : "cursor-not-allowed bg-slate-100 text-slate-300"
              }`}
            >
              保存品牌风格
            </button>
          </div>
        </div>
      )}

      {brandSuccessOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative flex w-full max-w-sm flex-col items-center rounded-3xl bg-white px-6 py-8 text-center shadow-2xl">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-500 shadow-lg shadow-green-200">
              <CheckCircle2 className="h-8 w-8 text-white" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-slate-900">
              已为您记住“{brandSavedName}”品牌风格
            </h3>
            <p className="mb-6 text-sm leading-relaxed text-slate-500">
              当前先保存在本地浏览器中。后续接上后端品牌风格库后，这里会升级成正式云端能力。
            </p>
            <button
              onClick={() => setBrandSuccessOpen(false)}
              className="h-11 w-full rounded-2xl bg-blue-500 text-sm font-semibold text-white transition-colors hover:bg-blue-600"
            >
              好的
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
