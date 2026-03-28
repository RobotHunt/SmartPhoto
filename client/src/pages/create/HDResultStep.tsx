import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Share2,
  Sparkles,
} from "lucide-react";

import { StepIndicator } from "@/components/StepIndicator";
import { sessionAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type PreviewAsset = {
  asset_id: string;
  image_url: string;
  thumbnail_url?: string | null;
  role: string;
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

function resolveSelectedIds(raw: string | null): string[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

function roleLabel(role: string) {
  const roleMap: Record<string, string> = {
    hero: "主图",
    main: "主图",
    white_bg: "白底图",
    scene: "场景图",
    selling_point: "卖点图",
    detail: "详情图",
    feature: "功能图",
  };
  return roleMap[role] || role || "图片";
}

export default function HDResultStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<PreviewAsset[]>([]);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [singleDownloadingId, setSingleDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessionId = sessionStorage.getItem("current_session_id") || "";
  const selectedIds = useMemo(
    () => resolveSelectedIds(sessionStorage.getItem("selected_asset_ids")),
    [],
  );
  const unlockedVersion = Number(
    sessionStorage.getItem("hd_unlocked_version") ||
      sessionStorage.getItem("current_result_version") ||
      "0",
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!sessionId) {
        setError("缺少当前会话，请返回结果页重新进入当前版本下载页。");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const results = await sessionAPI.getResults(sessionId, unlockedVersion || undefined);
        if (cancelled) return;

        const filteredAssets =
          selectedIds.length > 0
            ? results.assets.filter((asset) => selectedIds.includes(asset.asset_id))
            : results.assets;

        setAssets(
          filteredAssets.map((asset) => ({
            asset_id: asset.asset_id,
            image_url: asset.image_url,
            thumbnail_url: asset.thumbnail_url ?? null,
            role: asset.role,
          })),
        );
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "加载当前版本结果失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [selectedIds, sessionId, unlockedVersion]);

  const titleText = useMemo(() => {
    if (unlockedVersion > 0) return `当前版本结果 · V${unlockedVersion}`;
    return "当前版本结果";
  }, [unlockedVersion]);

  const handleDownloadZip = async () => {
    if (!sessionId || assets.length === 0 || downloadingZip) return;

    setDownloadingZip(true);
    try {
      const blob = await sessionAPI.downloadResults(sessionId, unlockedVersion || undefined);
      const url = URL.createObjectURL(blob);
      triggerBrowserDownload(url, `main-gallery-v${unlockedVersion || 1}.zip`);
      URL.revokeObjectURL(url);

      toast({
        title: "开始下载",
        description: "当前版本压缩包已开始下载。",
      });
    } catch (err: any) {
      toast({
        title: "下载失败",
        description: err?.message || "请稍后重试。",
        variant: "destructive",
      });
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleDownloadSingle = async (asset: PreviewAsset) => {
    if (singleDownloadingId || !asset.image_url) return;

    setSingleDownloadingId(asset.asset_id);
    try {
      triggerBrowserDownload(asset.image_url, `${roleLabel(asset.role)}-${asset.asset_id}.png`);

      toast({
        title: "开始下载",
        description: `${roleLabel(asset.role)} 已开始下载。`,
      });
    } finally {
      setSingleDownloadingId(null);
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: titleText,
          text: "这是我刚生成的当前版本主图结果。",
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast({
          title: "链接已复制",
          description: "可以把当前页面链接分享给同事查看。",
        });
      }
    } catch {
      // user cancelled
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <StepIndicator currentStep={5} step5Label="结果查看" />
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
          <h2 className="mb-1 text-lg font-bold text-slate-900">正在加载当前版本结果</h2>
          <p className="text-sm text-slate-500">正在获取当前版本对应的主图结果。</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <StepIndicator currentStep={5} step5Label="结果查看" />
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
          <div className="mb-4 text-lg font-bold text-slate-900">当前版本结果加载失败</div>
          <p className="mb-5 max-w-sm text-center text-sm text-slate-500">{error}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/create/result")}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              返回结果页
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-blue-500 px-5 py-2.5 text-sm text-white transition hover:bg-blue-600"
            >
              重新加载
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <StepIndicator currentStep={5} step5Label="结果查看" />

      <div className="flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-3">
        <button
          onClick={() => setLocation("/create/result")}
          className="text-slate-600 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-base font-bold text-slate-900">{titleText}</h1>
          <p className="text-xs text-slate-400">当前页面只负责查看、下载和继续进入详情图流程</p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-40 pt-5">
        <div className="mb-4 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-100">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">当前版本结果已准备完成</h2>
              <p className="mt-1 text-sm text-slate-500">
                当前页面已经不再处理登录、账户归档和无水印权限判断，直接按 session 与版本展示结果。
              </p>
            </div>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-blue-500" />
          <span className="text-sm font-semibold text-slate-800">共 {assets.length} 张主图结果</span>
        </div>

        {assets.length > 0 ? (
          <div className="space-y-5">
            {assets.map((asset) => (
              <section
                key={asset.asset_id}
                className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div>
                    <div className="text-base font-bold text-slate-900">{roleLabel(asset.role)}</div>
                    <div className="mt-1 text-xs text-slate-400">{asset.asset_id.slice(0, 8)}</div>
                  </div>
                  <button
                    onClick={() => handleDownloadSingle(asset)}
                    disabled={singleDownloadingId === asset.asset_id}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-50"
                  >
                    {singleDownloadingId === asset.asset_id ? "下载中..." : "下载单张"}
                  </button>
                </div>

                <div className="bg-slate-50 px-4 py-4 sm:px-6 sm:py-6">
                  <div className="flex min-h-[320px] items-center justify-center overflow-hidden rounded-[24px] bg-white">
                    <img
                      src={asset.image_url}
                      alt={roleLabel(asset.role)}
                      className="max-h-[72vh] w-full object-contain"
                    />
                  </div>
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
            <p className="text-lg font-semibold text-slate-900">暂无当前版本结果</p>
            <p className="mt-2 text-sm text-slate-500">
              请先从结果页选择图片，并继续进入当前版本查看流程。
            </p>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <button
            onClick={handleDownloadZip}
            disabled={downloadingZip}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 disabled:opacity-50"
          >
            {downloadingZip ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Download className="h-5 w-5" />
            )}
            一键下载
          </button>
          <button
            onClick={handleShare}
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300"
          >
            <Share2 className="h-5 w-5" />
          </button>
          <button
            onClick={() => setLocation("/create/copywriting")}
            className="flex h-14 flex-[1.1] items-center justify-center gap-2 rounded-2xl bg-blue-500 text-white transition hover:bg-blue-600"
          >
            <FileText className="h-5 w-5" />
            生成详情图
          </button>
        </div>
      </div>
    </div>
  );
}
