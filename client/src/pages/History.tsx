import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  accountAPI,
  sessionAPI,
  type AccountAssetCard,
  type SessionImageItem,
  type SessionResults,
  type SessionSnapshot,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FolderOpen,
  Home,
  ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  User,
  X,
} from "lucide-react";

type StatusFilter = "all" | "completed" | "processing" | "failed" | "incomplete";

interface HistoryFilters {
  q: string;
  platform_id: string;
  image_type: string;
  style_tag: string;
  brand_name: string;
  status: StatusFilter;
  page: number;
}

interface HistoryRecord {
  card: AccountAssetCard;
  snapshot: SessionSnapshot;
  derivedStatus: Exclude<StatusFilter, "all">;
  previewUrl: string | null;
}

interface DetailState {
  record: HistoryRecord | null;
  snapshot: SessionSnapshot | null;
  images: SessionImageItem[];
  results: SessionResults | null;
  currentVersion: number;
  loading: boolean;
  downloading: boolean;
  error: string | null;
}

const PAGE_SIZE = 12;

const DEFAULT_FILTERS: HistoryFilters = {
  q: "",
  platform_id: "",
  image_type: "",
  style_tag: "",
  brand_name: "",
  status: "all",
  page: 1,
};

const STATUS_META: Record<Exclude<StatusFilter, "all">, { label: string; badge: string }> = {
  completed: { label: "已完成", badge: "bg-emerald-50 text-emerald-700" },
  processing: { label: "处理中", badge: "bg-blue-50 text-blue-700" },
  failed: { label: "已失败", badge: "bg-red-50 text-red-700" },
  incomplete: { label: "未完成", badge: "bg-amber-50 text-amber-700" },
};

const PLATFORM_LABELS: Record<string, string> = {
  "1688": "1688",
  taobao: "淘宝",
  tmall: "天猫",
  jd: "京东",
  pdd: "拼多多",
  douyin: "抖音",
  xiaohongshu: "小红书",
  amazon: "Amazon",
  alibaba_intl: "Alibaba",
};

const PLATFORM_SORT_ORDER = ["taobao", "tmall", "jd", "pdd", "douyin", "xiaohongshu", "1688", "amazon", "alibaba_intl"];

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "completed", label: "已完成" },
  { value: "processing", label: "处理中" },
  { value: "failed", label: "已失败" },
  { value: "incomplete", label: "未完成" },
];

function readFiltersFromUrl(): HistoryFilters {
  const params = new URLSearchParams(window.location.search);
  return {
    q: params.get("q") || "",
    platform_id: params.get("platform_id") || "",
    image_type: params.get("image_type") || "",
    style_tag: params.get("style_tag") || "",
    brand_name: params.get("brand_name") || "",
    status: (params.get("status") as StatusFilter) || "all",
    page: Math.max(1, Number(params.get("page") || "1")),
  };
}

function writeFiltersToUrl(filters: HistoryFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.platform_id) params.set("platform_id", filters.platform_id);
  if (filters.image_type) params.set("image_type", filters.image_type);
  if (filters.style_tag) params.set("style_tag", filters.style_tag);
  if (filters.brand_name) params.set("brand_name", filters.brand_name);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.page > 1) params.set("page", String(filters.page));
  window.history.replaceState({}, "", params.toString() ? `/history?${params}` : "/history");
}

function formatDate(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function formatPlatform(platformId?: string | null) {
  if (!platformId) return "未选择平台";
  return PLATFORM_LABELS[platformId] || platformId;
}

function roleLabel(role?: string | null) {
  const roleMap: Record<string, string> = {
    hero: "白底主图",
    main: "主图",
    white_bg: "白底图",
    scene: "场景图",
    selling_point: "卖点图",
    detail: "详情图",
    feature: "功能图",
  };
  return role && roleMap[role] ? roleMap[role] : role || "图片";
}

function deriveAnalysisResult(snapshot: any, fallbackName?: string | null) {
  const recognized = snapshot?.recognized_product || {};
  const rawVisual = snapshot?.suggested_styles || snapshot?.visual_features || [];
  return {
    product_name: recognized.product_name || snapshot?.product_name || fallbackName || "产品",
    product_type: recognized.image_type || snapshot?.product_type || "实物图",
    category: recognized.category || snapshot?.category || "其他",
    visual_features: Array.isArray(rawVisual)
      ? rawVisual
      : String(rawVisual)
          .split(/[,，、\n]/)
          .map((item) => item.trim())
          .filter(Boolean),
    suggestions: Array.isArray(snapshot?.suggestions) ? snapshot.suggestions : [],
  };
}

function hasBusinessTrace(card: AccountAssetCard, snapshot: SessionSnapshot) {
  return Boolean(
    card.counts.original > 0 ||
      card.counts.main > 0 ||
      card.counts.detail > 0 ||
      snapshot.analysis_snapshot ||
      snapshot.parameter_snapshot ||
      snapshot.confirmed_copy ||
      snapshot.strategy_preview ||
      snapshot.active_platform_id ||
      snapshot.selected_platform_ids.length > 0 ||
      snapshot.latest_generate_job_id ||
      snapshot.latest_parameter_job_id ||
      snapshot.latest_result_version > 0,
  );
}

function deriveStatus(card: AccountAssetCard, snapshot: SessionSnapshot): Exclude<StatusFilter, "all"> | null {
  const status = snapshot.status || "created";
  const businessTrace = hasBusinessTrace(card, snapshot);
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  if (status === "analyzing" || status === "generating") return "processing";
  if (["created", "images_uploaded", "analyzed", "platform_selected", "copy_ready", "strategy_ready"].includes(status)) {
    return businessTrace ? "incomplete" : null;
  }
  if (card.latest_main_version > 0 || card.counts.main > 0 || card.counts.detail > 0) return "completed";
  return businessTrace ? "incomplete" : null;
}

function mapBackendSlotToUploadSlot(image: SessionImageItem) {
  const order = image.display_order || 0;
  if (image.slot_type === "front") return "front";
  if (image.slot_type === "side") return "side";
  if (image.slot_type === "angle45") return "angle45";
  if (image.slot_type === "extra") {
    if (order === 4) return "extra_1";
    if (order === 5) return "extra_2";
    if (order === 6) return "extra_3";
  }
  if (order === 1) return "front";
  if (order === 2) return "angle45";
  if (order === 3) return "side";
  if (order === 4) return "extra_1";
  if (order === 5) return "extra_2";
  if (order === 6) return "extra_3";
  return null;
}

function resetDetail(): DetailState {
  return {
    record: null,
    snapshot: null,
    images: [],
    results: null,
    currentVersion: 0,
    loading: false,
    downloading: false,
    error: null,
  };
}

function comparePlatformIds(left: string, right: string) {
  const leftIndex = PLATFORM_SORT_ORDER.indexOf(left);
  const rightIndex = PLATFORM_SORT_ORDER.indexOf(right);

  if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
  if (leftIndex === -1) return 1;
  if (rightIndex === -1) return -1;
  return leftIndex - rightIndex;
}

async function fetchHistoryRecords(serverParams: Record<string, string> = {}) {
  const items: AccountAssetCard[] = [];
  let page = 1;
  let total = 0;

  do {
    const response = await accountAPI.getAssets({ ...serverParams, page: String(page), page_size: "50" });
    items.push(...response.items);
    total = response.total;
    page += 1;
  } while (items.length < total && total > 0);

  const snapshots = await Promise.allSettled(items.map((item) => sessionAPI.get(item.session_id)));
  return items
    .map((card, index) => {
      const snapshot = snapshots[index].status === "fulfilled"
        ? snapshots[index].value
        : ({
            session_id: card.session_id,
            status: card.latest_main_version > 0 ? "completed" : "created",
            current_step: 1,
            selected_platform_ids: card.platform_id ? [card.platform_id] : [],
            active_platform_id: card.platform_id || null,
            analysis_snapshot: null,
            parameter_snapshot: null,
            confirmed_copy: null,
            strategy_preview: null,
            detail_strategy_preview: null,
            latest_generate_job_id: null,
            latest_detail_generate_job_id: null,
            latest_parameter_job_id: null,
            generation_round: card.latest_main_version,
            latest_result_version: card.latest_main_version,
            detail_generation_round: card.latest_detail_version,
            detail_latest_result_version: card.latest_detail_version,
          } as SessionSnapshot);

      const derivedStatus = deriveStatus(card, snapshot);
      if (!derivedStatus) return null;
      return {
        card,
        snapshot,
        derivedStatus,
        previewUrl: card.previews[0]?.image_url || null,
      } satisfies HistoryRecord;
    })
    .filter((item): item is HistoryRecord => Boolean(item));
}

function DetailModal({
  detail,
  onClose,
  onVersionChange,
  onDownload,
  onContinue,
}: {
  detail: DetailState;
  onClose: () => void;
  onVersionChange: (version: number) => void;
  onDownload: () => void;
  onContinue: () => void;
}) {
  if (!detail.record) return null;

  const record = detail.record;
  const snapshot = detail.snapshot || record.snapshot;
  const meta = STATUS_META[record.derivedStatus];
  const resultsAssets = detail.results?.assets || [];
  const availableVersions = detail.results?.available_versions || [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-t-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">{record.card.product_name || "未命名商品"}</h2>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.badge}`}>{meta.label}</span>
            </div>
            <p className="text-xs text-slate-400">
              {formatDate(record.card.created_at)} · {formatPlatform(snapshot.active_platform_id || record.card.platform_id)}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-148px)] overflow-y-auto px-5 py-5">
          {detail.loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm text-slate-400">正在加载详情...</p>
            </div>
          ) : detail.error ? (
            <div className="py-12 text-center text-sm text-red-500">{detail.error}</div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-3 rounded-3xl bg-slate-50 p-4 md:grid-cols-3">
                <div>
                  <div className="text-xs text-slate-400">平台</div>
                  <div className="mt-1 text-sm font-medium text-slate-800">
                    {formatPlatform(snapshot.active_platform_id || record.card.platform_id)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">当前状态</div>
                  <div className="mt-1 text-sm font-medium text-slate-800">{meta.label}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">后端步骤</div>
                  <div className="mt-1 text-sm font-medium text-slate-800">{snapshot.status}</div>
                </div>
              </div>

              {availableVersions.length > 1 && (
                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-800">版本管理</div>
                  <div className="flex flex-wrap gap-2">
                    {availableVersions.map((version) => (
                      <button
                        key={version}
                        onClick={() => onVersionChange(version)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          version === detail.currentVersion
                            ? "border-blue-500 bg-blue-500 text-white"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        V{version}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {resultsAssets.length > 0 && (
                <div>
                  <div className="mb-3 text-sm font-semibold text-slate-800">当前版本结果</div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {resultsAssets.map((asset) => (
                      <div key={asset.asset_id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="aspect-square bg-slate-100">
                          <img src={asset.image_url} alt={roleLabel(asset.role)} className="h-full w-full object-cover" />
                        </div>
                        <div className="px-3 py-2 text-xs font-medium text-slate-700">{roleLabel(asset.role)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detail.images.length > 0 && (
                <div>
                  <div className="mb-3 text-sm font-semibold text-slate-800">已上传原图</div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {detail.images.map((image) => (
                      <div key={image.image_id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="aspect-square bg-slate-100">
                          <img src={image.url} alt={image.slot_type || "原图"} className="h-full w-full object-cover" />
                        </div>
                        <div className="px-3 py-2 text-xs font-medium text-slate-700">
                          {image.slot_type ? `机位：${image.slot_type}` : "上传原图"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {record.derivedStatus !== "completed" && (
                <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-500">
                  当前记录只会恢复到后端已落库的最后稳定步骤，不恢复未提交的临时编辑内容。
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-slate-100 px-5 py-4">
          <button
            onClick={onContinue}
            className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            {record.derivedStatus === "completed" ? "回到结果页" : "继续当前流程"}
          </button>
          <button
            onClick={onDownload}
            disabled={detail.downloading || resultsAssets.length === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-500 py-3 text-sm font-bold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {detail.downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {detail.downloading ? "下载中..." : "下载当前版本"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function History() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [filters, setFilters] = useState<HistoryFilters>(() => readFiltersFromUrl());
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [optionRecords, setOptionRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailState>(resetDetail());

  useEffect(() => {
    writeFiltersToUrl(filters);
  }, [filters]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const serverParams = {
          ...(filters.q ? { q: filters.q } : {}),
          ...(filters.platform_id ? { platform_id: filters.platform_id } : {}),
          ...(filters.image_type ? { image_type: filters.image_type } : {}),
          ...(filters.style_tag ? { style_tag: filters.style_tag } : {}),
          ...(filters.brand_name ? { brand_name: filters.brand_name } : {}),
        };
        const nextRecords = await fetchHistoryRecords(serverParams);
        if (!cancelled) setRecords(nextRecords);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "加载历史记录失败");
          setRecords([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [filters.brand_name, filters.image_type, filters.platform_id, filters.q, filters.style_tag, user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadOptionRecords = async () => {
      try {
        const nextRecords = await fetchHistoryRecords();
        if (!cancelled) setOptionRecords(nextRecords);
      } catch {
        if (!cancelled) setOptionRecords([]);
      }
    };

    loadOptionRecords();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filteredRecords = useMemo(
    () => records.filter((record) => filters.status === "all" || record.derivedStatus === filters.status),
    [filters.status, records],
  );

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const currentPage = Math.min(filters.page, totalPages);
  const pagedRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (filters.page !== currentPage) {
      setFilters((previous) => ({ ...previous, page: currentPage }));
    }
  }, [currentPage, filters.page]);

  const platformOptions = useMemo(
    () =>
      Array.from(new Set(optionRecords.map((record) => record.snapshot.active_platform_id || record.card.platform_id || "").filter(Boolean)))
        .sort(comparePlatformIds),
    [optionRecords],
  );
  const styleOptions = useMemo(
    () =>
      Array.from(new Set(optionRecords.flatMap((record) => record.card.tags || []).filter(Boolean))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [optionRecords],
  );
  const brandOptions = useMemo(
    () =>
      Array.from(new Set(optionRecords.map((record) => record.card.brand_name || "").filter(Boolean))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [optionRecords],
  );

  const openDetail = async (record: HistoryRecord, version?: number) => {
    setDetail((previous) => ({
      ...previous,
      record,
      loading: true,
      error: null,
      currentVersion: version || previous.currentVersion || record.card.latest_main_version || 0,
    }));

    try {
      const snapshot = await sessionAPI.get(record.card.session_id).catch(() => record.snapshot);
      const currentVersionValue = version || snapshot.latest_result_version || record.card.latest_main_version || 0;
      const [images, results] = await Promise.all([
        sessionAPI.listImages(record.card.session_id).catch(() => []),
        currentVersionValue > 0
          ? sessionAPI.getResults(record.card.session_id, currentVersionValue).catch(() => null)
          : Promise.resolve(null),
      ]);

      setDetail({
        record,
        snapshot,
        images,
        results,
        currentVersion: results?.requested_version || currentVersionValue || 0,
        loading: false,
        downloading: false,
        error: null,
      });
    } catch (err: any) {
      setDetail((previous) => ({ ...previous, loading: false, error: err.message || "加载详情失败" }));
    }
  };

  const handleDownload = async () => {
    if (!detail.record) return;
    setDetail((previous) => ({ ...previous, downloading: true }));
    try {
      const blob = await sessionAPI.downloadResults(detail.record.card.session_id, detail.currentVersion || undefined);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${detail.record.card.product_name || "history"}-v${detail.currentVersion || 1}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({
        title: "下载失败",
        description: err.message || "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setDetail((previous) => ({ ...previous, downloading: false }));
    }
  };

  const handleContinue = () => {
    if (!detail.record || !detail.snapshot) return;
    const record = detail.record;
    const snapshot = detail.snapshot;

    sessionStorage.setItem("current_session_id", record.card.session_id);
    if (snapshot.selected_platform_ids.length > 0) {
      sessionStorage.setItem("selectedPlatforms", JSON.stringify(snapshot.selected_platform_ids));
    }
    if (snapshot.active_platform_id) {
      sessionStorage.setItem("selectedPlatform", snapshot.active_platform_id);
    }
    if (snapshot.analysis_snapshot) {
      const analysisResult = deriveAnalysisResult(snapshot.analysis_snapshot, record.card.product_name);
      sessionStorage.setItem("analysis_snapshot_full", JSON.stringify(snapshot.analysis_snapshot));
      sessionStorage.setItem("analysisResult", JSON.stringify(analysisResult));
      sessionStorage.setItem("selectedProductType", analysisResult.category);
    }
    if (snapshot.parameter_snapshot) {
      sessionStorage.setItem("product_parameters", JSON.stringify(snapshot.parameter_snapshot));
      if (snapshot.parameter_snapshot.hero_scene) {
        sessionStorage.setItem("selectedTheme", snapshot.parameter_snapshot.hero_scene);
      }
    } else if (snapshot.confirmed_copy?.hero_scene) {
      sessionStorage.setItem("selectedTheme", snapshot.confirmed_copy.hero_scene);
    }
    if (detail.currentVersion > 0) {
      sessionStorage.setItem("current_result_version", String(detail.currentVersion));
    }
    if (detail.images.length > 0) {
      const slotMap: Record<string, string> = {};
      const previewItems: Array<{ slotType: string; preview: string }> = [];
      detail.images.forEach((image) => {
        const slot = mapBackendSlotToUploadSlot(image);
        if (!slot) return;
        slotMap[slot] = image.image_id;
        previewItems.push({ slotType: slot, preview: image.url });
      });
      if (Object.keys(slotMap).length > 0) {
        sessionStorage.setItem("upload_slot_image_ids", JSON.stringify(slotMap));
        sessionStorage.setItem("uploadSlotPreviews", JSON.stringify(previewItems));
      }
    }

    const status = snapshot.status;
    if (status === "created" || status === "images_uploaded") return setLocation("/create/upload");
    if (status === "analyzing" || status === "analyzed") return setLocation("/create/analyze");
    if (status === "platform_selected") return setLocation("/create/generate");
    if (status === "copy_ready") return setLocation("/create/strategy");
    if (status === "strategy_ready") return setLocation("/create/strategy");
    setLocation("/create/result");
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
          <FolderOpen className="h-8 w-8 text-blue-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">登录后查看历史记录</h2>
        <p className="text-center text-sm text-slate-500">登录后可查看已完成、失败和未完成记录，并继续之前的创作流程。</p>
        <button
          onClick={() => setLocation("/login")}
          className="rounded-full bg-blue-500 px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-600"
        >
          登录 / 注册
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f6f8] pb-24">
      <div className="sticky top-0 z-20 border-b border-slate-100 bg-white px-4 pb-4 pt-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-500">
              <FolderOpen className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">我的历史记录</h1>
              <p className="text-xs text-slate-400">支持平台、图片类型、风格、品牌、状态和关键词筛选</p>
            </div>
          </div>
          <button onClick={() => window.location.reload()} className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.q}
            onChange={(event) => setFilters((previous) => ({ ...previous, q: event.target.value, page: 1 }))}
            placeholder="搜索商品名、品牌、风格或会话 ID"
            className="h-11 w-full rounded-full bg-slate-100 pl-10 pr-4 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilters((previous) => ({ ...previous, status: option.value, page: 1 }))}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                filters.status === option.value ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="grid gap-2 md:grid-cols-4">
          <select
            value={filters.platform_id}
            onChange={(event) => setFilters((previous) => ({ ...previous, platform_id: event.target.value, page: 1 }))}
            className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="">全部平台</option>
            {platformOptions.map((platform) => (
              <option key={platform} value={platform}>{formatPlatform(platform)}</option>
            ))}
          </select>

          <select
            value={filters.image_type}
            onChange={(event) => setFilters((previous) => ({ ...previous, image_type: event.target.value, page: 1 }))}
            className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="">全部图片类型</option>
            <option value="original">原图</option>
            <option value="main">主图</option>
            <option value="detail">详情图</option>
            <option value="white_bg">白底图</option>
          </select>

          <select
            value={filters.style_tag}
            onChange={(event) => setFilters((previous) => ({ ...previous, style_tag: event.target.value, page: 1 }))}
            className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="">全部风格</option>
            {styleOptions.map((style) => (
              <option key={style} value={style}>{style}</option>
            ))}
          </select>

          <select
            value={filters.brand_name}
            onChange={(event) => setFilters((previous) => ({ ...previous, brand_name: event.target.value, page: 1 }))}
            className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="">全部品牌</option>
            {brandOptions.map((brand) => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-slate-400">共 {filteredRecords.length} 条记录</span>
          <button onClick={() => setFilters(DEFAULT_FILTERS)} className="text-xs text-slate-500 transition hover:text-slate-700">
            清空筛选
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-slate-400">正在加载历史记录...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <p className="text-sm text-red-500">{error}</p>
            <button onClick={() => window.location.reload()} className="flex items-center gap-2 text-sm text-blue-500">
              <RefreshCw className="h-4 w-4" />
              重新加载
            </button>
          </div>
        ) : pagedRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <ImageIcon className="h-12 w-12 text-slate-300" />
            <p className="text-sm text-slate-400">{records.length === 0 ? "暂无历史记录" : "当前筛选条件下没有匹配记录"}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pagedRecords.map((record) => {
              const meta = STATUS_META[record.derivedStatus];
              const counts = record.card.counts;
              const chips = [
                counts.original > 0 ? `原图 ${counts.original}` : null,
                counts.main > 0 ? `主图 ${counts.main}` : null,
                counts.detail > 0 ? `详情 ${counts.detail}` : null,
                counts.white_bg > 0 ? `白底 ${counts.white_bg}` : null,
              ].filter(Boolean);

              return (
                <button
                  key={record.card.session_id}
                  onClick={() => openDetail(record)}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="aspect-[1.25/1] bg-slate-100">
                    {record.previewUrl ? (
                      <img src={record.previewUrl} alt={record.card.product_name || "history"} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center"><ImageIcon className="h-10 w-10 text-slate-300" /></div>
                    )}
                  </div>
                  <div className="space-y-3 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="line-clamp-1 text-sm font-semibold text-slate-900">{record.card.product_name || "未命名商品"}</h3>
                        <p className="mt-1 text-xs text-slate-400">
                          {formatDate(record.card.created_at)} · {formatPlatform(record.snapshot.active_platform_id || record.card.platform_id)}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.badge}`}>{meta.label}</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {chips.map((chip) => (
                        <span key={chip} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">{chip}</span>
                      ))}
                      {record.card.brand_name && (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">品牌 {record.card.brand_name}</span>
                      )}
                      {record.card.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-blue-50 px-2 py-1 text-[11px] text-blue-600">{tag}</span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">会话 ID：{record.card.session_id.slice(0, 8)}</span>
                      <span className="font-medium text-blue-600">查看详情</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {filteredRecords.length > PAGE_SIZE && (
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={() => setFilters((previous) => ({ ...previous, page: Math.max(1, previous.page - 1) }))}
              disabled={currentPage <= 1}
              className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </button>
            <span className="text-sm text-slate-500">{currentPage} / {totalPages}</span>
            <button
              onClick={() => setFilters((previous) => ({ ...previous, page: Math.min(totalPages, previous.page + 1) }))}
              disabled={currentPage >= totalPages}
              className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-slate-100 bg-white">
        <button className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-slate-400 transition hover:text-slate-600" onClick={() => setLocation("/")}>
          <Home className="h-5 w-5" />
          <span className="text-xs">首页</span>
        </button>
        <button className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-blue-500">
          <FolderOpen className="h-5 w-5" />
          <span className="text-xs font-medium">历史</span>
        </button>
        <button className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-slate-400 transition hover:text-slate-600" onClick={() => setLocation("/account")}>
          <User className="h-5 w-5" />
          <span className="text-xs">账户</span>
        </button>
      </div>

      {detail.record && (
        <DetailModal
          detail={detail}
          onClose={() => setDetail(resetDetail())}
          onVersionChange={(version) => detail.record && openDetail(detail.record, version)}
          onDownload={handleDownload}
          onContinue={handleContinue}
        />
      )}
    </div>
  );
}
