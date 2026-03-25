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

type PreviewAsset = {
  asset_id: string;
  image_url: string;
  thumbnail_url?: string | null;
  role: string;
};

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
  const selectedIdsRaw = sessionStorage.getItem("selected_asset_ids");
  const selectedIds = useMemo(() => resolveSelectedIds(selectedIdsRaw), [selectedIdsRaw]);
  const unlockedVersion = Number(
    sessionStorage.getItem("hd_unlocked_version") ||
      sessionStorage.getItem("current_result_version") ||
      "0",
  );
  const authRedirect = `/login?redirect=${encodeURIComponent(
    `${window.location.pathname}${window.location.search}`,
  )}`;

  useEffect(() => {
    let cancelled = false;

    async function loadUnlockedAssets() {
      if (!sessionId) {
        setError("缺少会话，请返回结果页重新进入。");
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
          setError(err?.message || "加载高清结果失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadUnlockedAssets();
    return () => {
      cancelled = true;
    };
  }, [selectedIds, sessionId, unlockedVersion]);

  const titleText = useMemo(() => {
    if (unlockedVersion > 0) return `高清无水印结果 · V${unlockedVersion}`;
    return "高清无水印结果";
  }, [unlockedVersion]);

  const handleDownloadZip = async () => {
    if (!sessionId || assets.length === 0 || downloadingZip) return;
    setDownloadingZip(true);
    try {
      const blob = await sessionAPI.downloadResults(sessionId, unlockedVersion || undefined);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `main-gallery-v${unlockedVersion || 1}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "开始下载",
        description: "已开始下载当前版本压缩包。",
      });
    } catch (err: any) {
      toast({
        title: "下载失败",
        description: err?.message || "压缩包下载失败",
        variant: "destructive",
      });
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleDownloadSingle = async (asset: PreviewAsset) => {
    if (singleDownloadingId) return;
    setSingleDownloadingId(asset.asset_id);
    try {
      const link = document.createElement("a");
      link.href = asset.image_url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.download = `${roleLabel(asset.role)}-${asset.asset_id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "开始下载",
        description: `${roleLabel(asset.role)} 已发起下载。`,
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
          description: "可以把当前结果页链接分享给他人。",
        });
      }
    } catch {
      // ignore cancelled share
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <StepIndicator currentStep={5} step5Label="高清结果" />
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
          <h2 className="mb-1 text-lg font-bold text-slate-900">正在加载高清结果</h2>
          <p className="text-sm text-slate-500">当前版本已解锁，正在获取无水印高清图片...</p>
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
        <button onClick={() => setLocation("/create/result")} className="text-slate-600 transition hover:text-slate-900">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-base font-bold text-slate-900">{titleText}</h1>
          <p className="text-xs text-slate-400">按当前查看版本展示无水印主图结果</p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-44 pt-4">
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900">高清无水印主图已解锁</p>
            <p className="text-xs text-amber-700">当前页面展示的是当前版本对应的高清结果</p>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-blue-500" />
          <span className="text-sm font-semibold text-slate-800">共 {assets.length} 张高清图</span>
        </div>

        <div className="space-y-5">
          {assets.map((asset) => (
            <div
              key={asset.asset_id}
              className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex justify-center bg-slate-100 px-4 py-4">
                <img
                  src={asset.image_url}
                  alt={roleLabel(asset.role)}
                  className="block max-w-full object-contain"
                  style={{ maxHeight: "calc(100vh - 320px)" }}
                />
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{roleLabel(asset.role)}</div>
                  <div className="text-xs text-slate-400">当前版本无水印结果</div>
                </div>
                <button
                  onClick={() => handleDownloadSingle(asset)}
                  disabled={singleDownloadingId === asset.asset_id}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-60"
                >
                  {singleDownloadingId === asset.asset_id ? "下载中..." : "下载单张"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30">
        <div className="border-t border-slate-100 bg-white px-4 py-2">
          <div className="mx-auto flex max-w-6xl items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50">
              <CloudUpload className="h-4 w-4 text-blue-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-800">登录/注册后，可自动保存当前设计结果</p>
              <p className="text-xs text-slate-400">这一页的强制登录与回跳恢复，等后端新版后再接入</p>
            </div>
            <button
              onClick={() => setLocation(authRedirect)}
              className="shrink-0 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-600"
            >
              登录 / 注册
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-white px-4 py-2.5 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-6xl gap-2">
            <button
              onClick={handleDownloadZip}
              disabled={downloadingZip || assets.length === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {downloadingZip ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  下载中...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  下载压缩包
                </>
              )}
            </button>

            <button
              onClick={handleShare}
              className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-slate-500 transition hover:bg-slate-50"
            >
              <Share2 className="h-4 w-4" />
            </button>

            <button
              onClick={() => {
                sessionStorage.setItem("generation_target", "detail_page");
                sessionStorage.setItem("detail_flow_origin", "hd-result");
                setLocation("/create/copywriting");
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-500 py-3 text-sm font-bold text-white transition hover:bg-blue-600"
            >
              <FileText className="h-4 w-4" />
              生成详情图
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
