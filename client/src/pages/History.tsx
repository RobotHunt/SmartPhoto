import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { accountAPI, sessionAPI } from "@/lib/api";
import {
  Search, MoreHorizontal, ImageIcon,
  Home, FolderOpen, User, Loader2, RefreshCw,
  X, Download, ChevronLeft, ChevronRight, ZoomIn,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createPortal } from "react-dom";

// ── Types ────────────────────────────────────────────────
interface AssetSession {
  session_id: string;
  product_name: string;
  platforms: string[];
  status: string;
  created_at: string;
  counts: Record<string, number>;
  previews: string[];
  result_urls: string[];
}

interface ResultAsset {
  asset_id: string;
  role: string;
  image_url: string;
  display_order: number;
}

interface SessionResults {
  assets: ResultAsset[];
  available_versions: number[];
  requested_version: number;
}

// ── Constants ────────────────────────────────────────────
const FILTER_TABS = ["全部", "已完成", "生成中", "失败"];

const PLATFORM_MAP: Record<string, string> = {
  "1688": "1688",
  taobao: "淘宝",
  tmall: "天猫",
  alibaba: "阿里巴巴",
  jd: "京东",
  pdd: "拼多多",
  douyin: "抖音",
  amazon: "亚马逊",
};

const ROLE_LABEL_MAP: Record<string, string> = {
  hero: "白底主图",
  main: "主图",
  white_bg: "白底图",
  scene: "场景图",
  selling_point: "卖点图",
  detail: "详情图",
  banner: "横幅图",
  lifestyle: "生活场景图",
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  completed: { label: "已完成", color: "bg-green-100 text-green-700" },
  processing: { label: "生成中", color: "bg-blue-100 text-blue-600" },
  pending: { label: "等待中", color: "bg-yellow-100 text-yellow-700" },
  failed: { label: "失败", color: "bg-red-100 text-red-600" },
  queued: { label: "排队中", color: "bg-slate-100 text-slate-600" },
};

// ── Helpers ──────────────────────────────────────────────
function formatPlatform(platform: string): string {
  return PLATFORM_MAP[platform.toLowerCase()] || platform;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return dateStr;
  }
}

function roleLabel(role: string): string {
  return ROLE_LABEL_MAP[role] || role;
}

function statusInfo(status: string) {
  return STATUS_MAP[status] || { label: status, color: "bg-slate-100 text-slate-600" };
}

/** Build image type tag list from counts object */
function buildImageTags(counts: Record<string, number>): string[] {
  const tagMap: Record<string, string> = {
    main: "主图",
    hero: "白底主图",
    white_bg: "白底图",
    scene: "场景图",
    selling_point: "卖点图",
    detail: "详情图",
    banner: "横幅图",
    lifestyle: "生活场景图",
  };
  const tags: string[] = [];
  if (!counts) return tags;
  for (const [key, count] of Object.entries(counts)) {
    if (count > 0 && tagMap[key]) {
      tags.push(tagMap[key]);
    }
  }
  return tags.length > 0 ? tags : ["图片"];
}

function totalCount(counts: Record<string, number>): number {
  if (!counts) return 0;
  return Object.values(counts).reduce((sum, n) => sum + n, 0);
}

// ── Image Preview Modal ──────────────────────────────────
function ImagePreviewModal({
  imageUrl,
  onClose,
}: {
  imageUrl: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white z-10"
      >
        <X className="w-7 h-7" />
      </button>
      <img
        src={imageUrl}
        alt="Preview"
        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
  );
}

// ── Detail Modal ─────────────────────────────────────────
function DetailModal({
  asset,
  onClose,
}: {
  asset: AssetSession;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [results, setResults] = useState<SessionResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fetchResults = useCallback(
    async (version?: number) => {
      setLoading(true);
      setError(null);
      try {
        const data = await sessionAPI.getResults(asset.session_id, version);
        setResults(data);
        if (selectedVersion === null && data.requested_version) {
          setSelectedVersion(data.requested_version);
        }
      } catch (err: any) {
        setError(err.message || "加载详情失败");
      } finally {
        setLoading(false);
      }
    },
    [asset.session_id, selectedVersion],
  );

  useEffect(() => {
    fetchResults();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleVersionChange = (ver: number) => {
    setSelectedVersion(ver);
    fetchResults(ver);
  };

  const handleDownloadAll = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const blob = await sessionAPI.downloadResults(asset.session_id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${asset.product_name || "images"}_${asset.session_id.slice(0, 8)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "下载已开始", description: "文件正在下载中..." });
    } catch (err: any) {
      toast({
        title: "下载失败",
        description: err.message || "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (previewUrl) {
          setPreviewUrl(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, previewUrl]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Group assets by role
  const groupedAssets: Record<string, ResultAsset[]> = {};
  if (results?.assets) {
    for (const a of results.assets) {
      const key = a.role || "other";
      if (!groupedAssets[key]) groupedAssets[key] = [];
      groupedAssets[key].push(a);
    }
    // Sort within each group by display_order
    for (const key of Object.keys(groupedAssets)) {
      groupedAssets[key].sort((a, b) => a.display_order - b.display_order);
    }
  }

  const platformDisplay =
    asset.platforms && asset.platforms.length > 0
      ? asset.platforms.map(formatPlatform).join(" / ")
      : "未选择平台";

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 active:scale-95 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 truncate max-w-[200px]">
              {asset.product_name || "未命名商品"}
            </h2>
            <p className="text-xs text-slate-400">
              {formatDate(asset.created_at)} · {platformDisplay}
            </p>
          </div>
        </div>
        <button
          onClick={handleDownloadAll}
          disabled={downloading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-full transition-colors disabled:opacity-50"
        >
          {downloading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          下载全部
        </button>
      </div>

      {/* Version selector */}
      {results && results.available_versions && results.available_versions.length > 1 && (
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-xs text-slate-500 flex-shrink-0">版本：</span>
          {results.available_versions.map((ver) => (
            <button
              key={ver}
              onClick={() => handleVersionChange(ver)}
              className={`flex-shrink-0 text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                selectedVersion === ver
                  ? "bg-blue-500 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              V{ver}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-sm text-slate-400">加载图片中...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-sm text-red-500">{error}</p>
            <button
              onClick={() => fetchResults(selectedVersion ?? undefined)}
              className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600"
            >
              <RefreshCw className="w-4 h-4" />
              重新加载
            </button>
          </div>
        ) : !results || results.assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <ImageIcon className="w-12 h-12 text-slate-300" />
            <p className="text-sm text-slate-400">暂无生成结果</p>
          </div>
        ) : (
          Object.entries(groupedAssets).map(([role, items]) => (
            <div key={role} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-slate-800">
                  {roleLabel(role)}
                </span>
                <span className="text-xs text-slate-400">
                  ({items.length}张)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {items.map((item) => (
                  <button
                    key={item.asset_id}
                    onClick={() => setPreviewUrl(item.image_url)}
                    className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 group"
                  >
                    <img
                      src={item.image_url}
                      alt={roleLabel(item.role)}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <ZoomIn className="w-5 h-5 text-white drop-shadow-lg" />
                    </div>
                    <span className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-md">
                      {roleLabel(item.role)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Image preview overlay */}
      {previewUrl && (
        <ImagePreviewModal
          imageUrl={previewUrl}
          onClose={() => setPreviewUrl(null)}
        />
      )}
    </div>,
    document.body,
  );
}

// ── Single asset card ────────────────────────────────────
function AssetCard({
  asset,
  onOpenDetail,
}: {
  asset: AssetSession;
  onOpenDetail: (asset: AssetSession) => void;
}) {
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [downloading, setDownloading] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const tags = buildImageTags(asset.counts);
  const total = totalCount(asset.counts);

  const openMenu = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.top, right: window.innerWidth - rect.right });
    }
    setMenuOpen(true);
  };

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const blob = await sessionAPI.downloadResults(asset.session_id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${asset.product_name || "images"}_${asset.session_id.slice(0, 8)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "下载已开始", description: "文件正在下载中..." });
    } catch (err: any) {
      toast({
        title: "下载失败",
        description: err.message || "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  // Build thumbnail array from previews
  const thumbnails: (string | null)[] = [];
  if (asset.previews && asset.previews.length > 0) {
    for (let i = 0; i < 3; i++) {
      thumbnails.push(asset.previews[i] || null);
    }
  } else if (asset.result_urls && asset.result_urls.length > 0) {
    for (let i = 0; i < 3; i++) {
      thumbnails.push(asset.result_urls[i] || null);
    }
  } else {
    thumbnails.push(null, null, null);
  }

  const extraCount = Math.max(0, total - 3);

  const platformDisplay =
    asset.platforms && asset.platforms.length > 0
      ? asset.platforms.map(formatPlatform).join(" / ")
      : "未选择平台";

  const { label: statusLabel, color: statusColor } = statusInfo(asset.status);

  return (
    <div className="bg-white rounded-2xl p-3.5 mb-3 shadow-sm">
      {/* Top: date + status + three-dot menu */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">
            {formatDate(asset.created_at)}
          </span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor}`}
          >
            {statusLabel}
          </span>
        </div>
        <div className="relative">
          <button
            ref={btnRef}
            onClick={openMenu}
            className="text-slate-400 hover:text-slate-600 active:scale-95 transition-all p-0.5"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen &&
            createPortal(
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  className="fixed z-50 bg-white rounded-xl shadow-xl border border-slate-100 py-1 min-w-[120px]"
                  style={{ top: menuPos.top + 20, right: menuPos.right }}
                >
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenDetail(asset);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 active:bg-slate-100"
                  >
                    查看详情
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      handleDownload();
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 active:bg-slate-100"
                  >
                    批量下载
                  </button>
                </div>
              </>,
              document.body,
            )}
        </div>
      </div>

      {/* Product name */}
      <p className="text-sm font-medium text-slate-700 mb-1 truncate">
        {asset.product_name || "未命名商品"}
      </p>

      {/* Platform & count info */}
      <p className="text-xs text-slate-400 mb-2.5">
        平台：{platformDisplay}
        {total > 0 && ` · ${total}张图片`}
      </p>

      {/* Image type tags */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar mb-2.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-600"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Three equal-width thumbnails */}
      <div className="flex gap-1.5 mb-2.5" style={{ height: 90 }}>
        {thumbnails.map((img, idx) => (
          <div
            key={idx}
            className="flex-1 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center relative"
          >
            {img ? (
              <img
                src={img}
                alt={`${asset.product_name} thumbnail ${idx + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <ImageIcon className="w-5 h-5 text-slate-300" />
            )}
            {/* Last thumbnail: show +N overlay if there are more */}
            {idx === 2 && extraCount > 0 && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl">
                <span className="text-white text-sm font-bold">
                  +{extraCount}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom action row */}
      <div className="flex gap-2">
        <button
          onClick={() => onOpenDetail(asset)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 active:bg-slate-100 transition-colors"
        >
          查看全部
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        </button>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-50"
        >
          {downloading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              下载中...
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              下载
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────
export default function History() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [activeFilter, setActiveFilter] = useState("全部");
  const [searchQuery, setSearchQuery] = useState("");

  const [assets, setAssets] = useState<AssetSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detail modal state
  const [detailAsset, setDetailAsset] = useState<AssetSession | null>(null);

  // Fetch assets from backend
  const fetchAssets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await accountAPI.getAssets();
      setAssets(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || "加载资产失败");
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load on mount & when user changes
  useEffect(() => {
    if (user) {
      fetchAssets();
    }
  }, [user, fetchAssets]);

  // Auth loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  // Not logged in: show login prompt
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-2">
          <FolderOpen className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">
          登录后查看资产
        </h2>
        <p className="text-sm text-slate-500 text-center">
          登录账号，自动保存你的设计资产，避免图片丢失
        </p>
        <button
          onClick={() => setLocation("/login")}
          className="mt-2 px-8 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-full transition-colors"
        >
          登录 / 注册
        </button>
      </div>
    );
  }

  // Filter by search query (product name) and status tab
  const filtered = assets.filter((a) => {
    // Search filter
    const matchesSearch = (a.product_name || "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    // Status filter
    let matchesFilter = true;
    if (activeFilter === "已完成") {
      matchesFilter = a.status === "completed";
    } else if (activeFilter === "生成中") {
      matchesFilter = a.status === "processing" || a.status === "pending" || a.status === "queued";
    } else if (activeFilter === "失败") {
      matchesFilter = a.status === "failed";
    }
    // "全部" matches everything

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top header bar */}
      <div className="bg-white px-4 pt-5 pb-3 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-xl flex items-center justify-center">
              <FolderOpen className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-base font-bold text-slate-900">我的资产</h1>
          </div>
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
            {user.display_name?.[0]?.toUpperCase() ??
              user.email?.[0]?.toUpperCase() ??
              "S"}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 font-medium transition-colors ${
                activeFilter === tab
                  ? "text-blue-500 border-b-2 border-blue-500 pb-1"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索商品名称..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-100 rounded-full text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
      </div>

      {/* Card list */}
      <div className="flex-1 px-4 pt-4 pb-24 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-sm text-slate-400">加载资产中...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-sm text-red-500">{error}</p>
            <button
              onClick={fetchAssets}
              className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600"
            >
              <RefreshCw className="w-4 h-4" />
              重新加载
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <ImageIcon className="w-12 h-12 text-slate-300" />
            <p className="text-sm text-slate-400">
              {searchQuery || activeFilter !== "全部"
                ? "暂无匹配的资产"
                : "暂无资产，快去创建吧"}
            </p>
            {!searchQuery && activeFilter === "全部" && (
              <button
                onClick={() => setLocation("/")}
                className="mt-2 px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-full transition-colors"
              >
                去创建
              </button>
            )}
          </div>
        ) : (
          filtered.map((asset) => (
            <AssetCard
              key={asset.session_id}
              asset={asset}
              onOpenDetail={setDetailAsset}
            />
          ))
        )}
      </div>

      {/* Bottom tab navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex z-20">
        <button
          className="flex-1 flex flex-col items-center py-2.5 gap-0.5 text-slate-400 hover:text-slate-600"
          onClick={() => setLocation("/")}
        >
          <Home className="w-5 h-5" />
          <span className="text-xs">主页</span>
        </button>
        <button className="flex-1 flex flex-col items-center py-2.5 gap-0.5 text-blue-500">
          <FolderOpen className="w-5 h-5" />
          <span className="text-xs font-medium">资产</span>
        </button>
        <button
          className="flex-1 flex flex-col items-center py-2.5 gap-0.5 text-slate-400 hover:text-slate-600"
          onClick={() => setLocation("/account")}
        >
          <User className="w-5 h-5" />
          <span className="text-xs">账户</span>
        </button>
      </div>

      {/* Detail modal */}
      {detailAsset && (
        <DetailModal
          asset={detailAsset}
          onClose={() => setDetailAsset(null)}
        />
      )}
    </div>
  );
}
