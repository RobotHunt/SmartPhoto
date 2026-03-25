import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  CheckCircle2,
  CloudUpload,
  Download,
  FileText,
  Loader2,
  Share2,
  Sparkles,
} from "lucide-react";

import { StepIndicator } from "@/components/StepIndicator";
import { sessionAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

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

async function downloadAssetsDirectly(assets: PreviewAsset[]) {
  for (let index = 0; index < assets.length; index += 1) {
    const asset = assets[index];
    triggerBrowserDownload(asset.image_url, `${roleLabel(asset.role)}-${asset.asset_id}.png`);
    if (index < assets.length - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 180));
    }
  }
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

function buildClaimRedirect(pathname: string, search: string) {
  const url = new URL(`${pathname}${search || ""}`, window.location.origin);
  url.searchParams.set("claim", "1");
  return `/login?redirect=${encodeURIComponent(`${url.pathname}${url.search}`)}`;
}

export default function HDResultStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [assets, setAssets] = useState<PreviewAsset[]>([]);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [singleDownloadingId, setSingleDownloadingId] = useState<string | null>(null);
  const [canDownload, setCanDownload] = useState(false);
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
  const claimRedirect = buildClaimRedirect(window.location.pathname, window.location.search);
  const shouldClaimAfterLogin = new URLSearchParams(window.location.search).get("claim") === "1";

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!sessionId) {
        setError("缺少当前会话，请返回结果页重新进入高清流程。");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        if (user && shouldClaimAfterLogin) {
          setClaiming(true);
          await sessionAPI.claimGuestSession(sessionId);
          if (!cancelled) {
            window.history.replaceState({}, "", window.location.pathname);
            toast({
              title: "已保存到当前账户",
              description: "当前高清主图结果已归档到你的账户，后续可在历史记录中查看。",
            });
          }
        }

        const snapshot = await sessionAPI.get(sessionId);
        if (cancelled) return;

        setCanDownload(!!snapshot.can_download);

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
          setError(err?.message || "加载高清结果失败");
        }
      } finally {
        if (!cancelled) {
          setClaiming(false);
          setLoading(false);
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [claiming, selectedIds, sessionId, shouldClaimAfterLogin, toast, unlockedVersion, user]);

  const titleText = useMemo(() => {
    if (unlockedVersion > 0) return `高清无水印结果 · V${unlockedVersion}`;
    return "高清无水印结果";
  }, [unlockedVersion]);

  const handleDownloadZip = async () => {
    if (!sessionId || assets.length === 0 || downloadingZip) return;

    setDownloadingZip(true);
    try {
      if (canDownload) {
        const blob = await sessionAPI.downloadResults(sessionId, unlockedVersion || undefined);
        const url = URL.createObjectURL(blob);
        triggerBrowserDownload(url, `main-gallery-v${unlockedVersion || 1}.zip`);
        URL.revokeObjectURL(url);

        toast({
          title: "开始下载",
          description: "当前版本压缩包已开始下载。",
        });
      } else {
        await downloadAssetsDirectly(assets);
        toast({
          title: "开始下载",
          description: `已为你发起 ${assets.length} 张图片下载。`,
        });
      }
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
          text: "这是我刚生成的高清无水印主图结果。",
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

  const handleArchiveToAccount = async () => {
    if (!sessionId) return;

    if (!user) {
      setLocation(claimRedirect);
      return;
    }

    setClaiming(true);
    try {
      await sessionAPI.claimGuestSession(sessionId);
      setCanDownload(true);
      toast({
        title: "已保存到当前账户",
        description: "当前高清主图结果已归档到你的账户。",
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

  if (loading || claiming) {
    return (
      <div className="min-h-screen bg-slate-50">
        <StepIndicator currentStep={5} step5Label="高清结果" />
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
          <h2 className="mb-1 text-lg font-bold text-slate-900">
            {claiming ? "正在保存到你的账户..." : "正在加载高清结果"}
          </h2>
          <p className="text-sm text-slate-500">
            {claiming
              ? "请稍候，我们正在认领当前会话。"
              : "正在获取当前版本对应的高清无水印主图结果。"}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <StepIndicator currentStep={5} step5Label="高清结果" />
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
          <div className="mb-4 text-lg font-bold text-slate-900">高清结果加载失败</div>
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
      <StepIndicator currentStep={5} step5Label="高清结果" />

      <div className="flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-3">
        <button
          onClick={() => setLocation("/create/result")}
          className="text-slate-600 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-base font-bold text-slate-900">{titleText}</h1>
          <p className="text-xs text-slate-400">当前展示的是本次已解锁的高清无水印结果</p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-40 pt-5">
        <div className="mb-4 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-100">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">高清无水印主图已解锁</h2>
              <p className="mt-1 text-sm text-slate-500">
                当前页面展示的是当前版本对应的高清结果，图片将按完整比例展示。
              </p>
            </div>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-blue-500" />
          <span className="text-sm font-semibold text-slate-800">共 {assets.length} 张高清图</span>
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
            <p className="text-lg font-semibold text-slate-900">暂无高清结果</p>
            <p className="mt-2 text-sm text-slate-500">
              请先从结果页选择图片，并继续进入高清流程。
            </p>
          </div>
        )}
      </div>

      {!canDownload && (
        <div className="fixed bottom-24 left-0 right-0 z-20 border-t border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
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
