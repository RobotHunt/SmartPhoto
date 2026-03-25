import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, CheckCircle2, Loader2, Pencil, RefreshCw, Sparkles } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { sessionAPI } from "@/lib/api";

import { DetailStepIndicator } from "./DetailStepIndicator";

type DetailPlanItem = {
  slot_id?: string;
  panel_id?: string;
  panel_label?: string;
  panel_type?: string;
  display_order?: number;
  copy_lines?: string[];
  copy_blocks?: Record<string, any>;
  layout_notes?: string;
};

type PreviewCard = {
  id: string;
  label: string;
  description: string;
  previewUrl: string;
};

function parseSelectedIds(raw: string | null) {
  if (!raw) return [] as string[];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

function collectText(value: unknown): string[] {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectText);
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(collectText);
  }
  return [];
}

function buildPreviewCards(panelPlan: DetailPlanItem[], previewUrls: string[]) {
  const fallbackUrls = previewUrls.length > 0 ? previewUrls : ["/examples/air-purifier.jpg"];

  return panelPlan.map((item, index) => {
    const copyLines = [
      ...(Array.isArray(item.copy_lines) ? item.copy_lines : []),
      ...collectText(item.copy_blocks),
    ].filter(Boolean);

    return {
      id: String(item.slot_id || item.panel_id || index + 1),
      label: item.panel_label || item.panel_type || `详情图 ${index + 1}`,
      description: copyLines[0] || item.layout_notes || "将基于当前文案与平台规则生成详情图内容",
      previewUrl: fallbackUrls[index % fallbackUrls.length],
    };
  });
}

export default function DetailConfirmStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const sessionId = sessionStorage.getItem("current_session_id") || "";
  const selectedIdsRaw = sessionStorage.getItem("selected_asset_ids");
  const currentMainVersionRaw = sessionStorage.getItem("current_result_version");
  const selectedIds = useMemo(() => parseSelectedIds(selectedIdsRaw), [selectedIdsRaw]);

  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [cards, setCards] = useState<PreviewCard[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview(forceRegenerate = false) {
      if (!sessionId) {
        setLocation("/create/copywriting");
        return;
      }

      try {
        setError("");
        if (!forceRegenerate) setLoading(true);
        if (forceRegenerate) setRegenerating(true);

        const snapshot = await sessionAPI.get(sessionId);

        let preview = snapshot.detail_strategy_preview;
        if (forceRegenerate || !Array.isArray(preview?.panel_plan) || preview.panel_plan.length === 0) {
          const previewRes = await sessionAPI.previewDetailStrategy(sessionId);
          preview = previewRes?.detail_strategy_preview ?? preview;
        }

        const panelPlan = Array.isArray(preview?.panel_plan) ? preview.panel_plan : [];
        if (panelPlan.length === 0) {
          throw new Error("详情图策略尚未生成，请先返回文案页确认内容后重试。");
        }

        let previewUrls: string[] = [];

        try {
          const results = await sessionAPI.getResults(
            sessionId,
            currentMainVersionRaw ? Number(currentMainVersionRaw) : undefined,
          );
          const assets = Array.isArray(results?.assets) ? results.assets : [];
          const filtered = selectedIds.length > 0
            ? assets.filter((asset) => selectedIds.includes(asset.asset_id))
            : assets;
          previewUrls = filtered
            .map((asset) => asset.thumbnail_url || asset.image_url)
            .filter(Boolean);
        } catch {
          // ignore and fall back to uploaded images
        }

        if (previewUrls.length === 0) {
          const images = await sessionAPI.listImages(sessionId);
          previewUrls = images.map((item) => item.url).filter(Boolean);
        }

        if (!cancelled) {
          setCards(buildPreviewCards(panelPlan, previewUrls));
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "详情图策略加载失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRegenerating(false);
        }
      }
    }

    loadPreview(false);
    return () => {
      cancelled = true;
    };
  }, [currentMainVersionRaw, selectedIds, sessionId, setLocation]);

  const handleBack = () => {
    setLocation("/create/copywriting");
  };

  const handleRegenerate = async () => {
    if (!sessionId || regenerating) return;

    try {
      setError("");
      setRegenerating(true);

      const snapshot = await sessionAPI.get(sessionId);
      const previewRes = await sessionAPI.previewDetailStrategy(sessionId);
      const preview = previewRes?.detail_strategy_preview ?? snapshot.detail_strategy_preview;
      const panelPlan = Array.isArray(preview?.panel_plan) ? preview.panel_plan : [];

      let previewUrls: string[] = [];
      try {
        const results = await sessionAPI.getResults(
          sessionId,
          currentMainVersionRaw ? Number(currentMainVersionRaw) : undefined,
        );
        const assets = Array.isArray(results?.assets) ? results.assets : [];
        const filtered = selectedIds.length > 0
          ? assets.filter((asset) => selectedIds.includes(asset.asset_id))
          : assets;
        previewUrls = filtered
          .map((asset) => asset.thumbnail_url || asset.image_url)
          .filter(Boolean);
      } catch {
        // ignore and fall back below
      }

      if (previewUrls.length === 0) {
        const images = await sessionAPI.listImages(sessionId);
        previewUrls = images.map((item) => item.url).filter(Boolean);
      }

      setCards(buildPreviewCards(panelPlan, previewUrls));
      toast({ title: "策略已更新", description: "已按当前文案重新规划详情图方案。" });
    } catch (err: any) {
      setError(err?.message || "重新规划详情图失败");
    } finally {
      setRegenerating(false);
    }
  };

  const handleConfirm = () => {
    if (!sessionId || submitting) return;
    setSubmitting(true);
    sessionStorage.setItem("detail_result_autostart", "true");
    setLocation("/create/detail-result");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <DetailStepIndicator currentStep={2} />

      <div className="bg-white border-b px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-slate-800">
            已规划 {cards.length > 0 ? cards.length : 0} 张详情图
          </span>
        </div>
        <button
          onClick={handleRegenerate}
          disabled={regenerating || loading}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-full px-2.5 py-1 transition disabled:opacity-60"
        >
          {regenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          重新生成
        </button>
      </div>
      <p className="px-4 py-1.5 text-xs text-slate-400 bg-white border-b">
        以下为生成示意，确认后生成高清详情图
      </p>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <div>
            <p className="text-base font-semibold text-slate-900">正在规划详情图方案</p>
            <p className="text-sm text-slate-500 mt-1">AI 正在根据当前文案与平台规则生成详情图布局。</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <div>
            <p className="text-base font-semibold text-slate-900">详情图方案加载失败</p>
            <p className="text-sm text-slate-500 mt-1 break-words">{error}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="px-4 py-2 rounded-full border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
            >
              返回文案页
            </button>
            <button
              onClick={handleRegenerate}
              className="px-4 py-2 rounded-full bg-blue-500 text-sm text-white hover:bg-blue-600"
            >
              重试
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pb-28">
          {cards.map((card) => (
            <div key={card.id} className="bg-white border-b">
              <div className="relative select-none" onContextMenu={(event) => event.preventDefault()}>
                <img
                  src={card.previewUrl}
                  alt={card.label}
                  className="w-full object-cover pointer-events-none"
                  draggable={false}
                  style={{ maxHeight: "400px" }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent pointer-events-none" />
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div
                    className="text-white/25 font-bold text-xl select-none"
                    style={{
                      transform: "rotate(-30deg)",
                      textShadow: "0 1px 4px rgba(0,0,0,0.4)",
                      letterSpacing: "0.08em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    AI电商做图 · 预览图
                  </div>
                </div>
                <div className="absolute left-4 right-4 bottom-4 text-white">
                  <p className="text-lg font-bold leading-tight">{card.label}</p>
                  <p className="text-sm text-white/85 mt-1 line-clamp-2">{card.description}</p>
                </div>
              </div>

              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-sm text-slate-500">{card.label}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBack}
                    className="flex items-center gap-1 text-xs text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-full px-2.5 py-1 transition"
                  >
                    <Pencil className="w-3 h-3" />
                    编辑文字
                  </button>
                  <button
                    onClick={handleRegenerate}
                    className="flex items-center gap-1 text-xs text-slate-500 border border-slate-200 rounded-full px-2.5 py-1 hover:bg-slate-50 transition"
                  >
                    <RefreshCw className="w-3 h-3" />
                    重新生成
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t shadow-lg px-4 py-3">
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="w-full h-12 rounded-2xl flex items-center justify-center gap-2 text-base font-bold bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-200 transition disabled:opacity-70"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            生成无水印高清图
          </button>
          <p className="text-center text-xs text-slate-400 mt-1.5">
            共 {cards.length} 张，确认后全部生成
          </p>
        </div>
      )}
    </div>
  );
}
