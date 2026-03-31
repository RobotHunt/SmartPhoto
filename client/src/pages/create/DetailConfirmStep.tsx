import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { sessionAPI } from "@/lib/api";
import { resolveGenerationStageText } from "@/lib/generationStatus";

import { DetailStepIndicator } from "./DetailStepIndicator";

type DetailPlanItem = {
  slot_id?: string;
  panel_id?: string;
  panel_label?: string;
  panel_type?: string;
  narrative_section?: string;
  panel_goal?: string;
  copy_focus?: string;
  visual_truth_mode?: string;
  origin_note?: string;
  display_order?: number;
  copy_lines?: string[];
  copy_blocks?: Record<string, any>;
  layout_notes?: string;
  display_module_title?: string;
  display_module_kind?: string;
  display_module_intent?: string;
  display_tags?: string[];
};

type PlanningCard = {
  id: string;
  label: string;
  description: string;
  tags: string[];
  copyHighlights: string[];
  layoutNotes?: string;
  originNote?: string;
};

type Phase = "loading" | "planning" | "error";

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

function buildPlanningCards(panelPlan: DetailPlanItem[]): PlanningCard[] {
  return panelPlan.map((item, index) => {
    const copyHighlights = [
      ...(Array.isArray(item.copy_lines) ? item.copy_lines : []),
      ...collectText(item.copy_blocks),
    ]
      .map((line) => String(line).trim())
      .filter(Boolean)
      .slice(0, 3);

    const tags = Array.isArray(item.display_tags) ? item.display_tags : [];

    return {
      id: String(item.slot_id || item.panel_id || index + 1),
      label: item.display_module_title || item.panel_label || `详情图 ${index + 1}`,
      description:
        item.display_module_intent ||
        item.panel_goal ||
        item.copy_focus ||
        copyHighlights[0] ||
        item.layout_notes ||
        "将基于当前文案与平台规则生成详情图内容",
      tags,
      copyHighlights,
      layoutNotes: item.layout_notes || "",
      originNote: item.origin_note || "",
    };
  });
}

export default function DetailConfirmStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const sessionId = sessionStorage.getItem("current_session_id") || "";

  const [phase, setPhase] = useState<Phase>("loading");
  const [loadingText, setLoadingText] = useState("正在加载详情图方案...");
  const [error, setError] = useState("");
  const [cards, setCards] = useState<PlanningCard[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!sessionId) {
        setLocation("/create/copywriting");
        return;
      }

      try {
        setError("");
        setLoadingText("正在加载详情图方案...");

        const snapshot = await sessionAPI.get(sessionId);
        if (cancelled) return;

        if (Number(snapshot.detail_latest_result_version || 0) > 0) {
          const savedCopyHash = sessionStorage.getItem("detail_copy_hash");
          const currentCopyHash = JSON.stringify(snapshot.confirmed_copy || "");
          const copyChanged = savedCopyHash !== null && savedCopyHash !== currentCopyHash;

          if (!copyChanged) {
            setLocation("/create/detail-result");
            return;
          }
        }

        let preview = snapshot.detail_strategy_preview;
        if (!Array.isArray(preview?.panel_plan) || preview.panel_plan.length === 0) {
          const previewRes = await sessionAPI.previewDetailStrategy(sessionId);
          preview = previewRes?.detail_strategy_preview ?? preview;
        }

        const panelPlan = Array.isArray(preview?.panel_plan) ? preview.panel_plan : [];
        if (panelPlan.length === 0) {
          throw new Error("详情图方案尚未准备好，请先返回文案页确认内容后重试。");
        }

        if (!cancelled) {
          setCards(buildPlanningCards(panelPlan));
          setPhase("planning");
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "详情图方案加载失败");
          setPhase("error");
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [sessionId, setLocation]);

  const handleGoToPayment = () => {
    sessionStorage.setItem("detail_preview_count", String(cards.length));
    const snapshotVersion = sessionStorage.getItem("detail_current_version") || "0";
    sessionStorage.setItem("detail_preview_version", snapshotVersion);
    setLocation("/create/detail-payment");
  };

  const handleBack = () => {
    setLocation("/create/copywriting");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <DetailStepIndicator currentStep={2} />

      {phase === "loading" && (
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="mt-4 text-sm text-slate-500">{loadingText}</p>
        </div>
      )}

      {phase === "error" && (
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
          </div>
        </div>
      )}

      {phase === "planning" && (
        <>
          {/* Status bar */}
          <div className="bg-white border-b px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-semibold text-slate-800">
                已规划 {cards.length} 个详情模块
              </span>
            </div>
            <button
              onClick={handleBack}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-full px-2.5 py-1 transition"
            >
              <RefreshCw className="w-3 h-3" />
              返回文案页
            </button>
          </div>

          {/* Watermark notice */}
          <p className="px-4 py-2 text-xs text-amber-600 bg-amber-50 border-b border-amber-100">
            确认后将进入付费环节，付费后 AI 才会开始生成无水印高清详情图。
          </p>

          {/* Scrollable planning cards */}
          <div className="flex-1 overflow-y-auto pb-32 px-4 pt-4 space-y-4">
            {cards.map((card, index) => (
              <div
                key={card.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-medium text-blue-500">模块 {index + 1}</div>
                    <h3 className="mt-1 text-lg font-semibold text-slate-900">{card.label}</h3>
                  </div>
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-600">{card.description}</p>

                {card.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {card.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {card.copyHighlights.length > 0 && (
                  <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs font-medium text-slate-500">重点文案</div>
                    <div className="mt-2 space-y-2">
                      {card.copyHighlights.map((line) => (
                        <div key={line} className="text-sm text-slate-700">
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {card.layoutNotes && (
                  <div className="mt-4 text-xs leading-6 text-slate-500">
                    布局说明：{card.layoutNotes}
                  </div>
                )}

                {card.originNote && (
                  <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-700">
                    {card.originNote}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Fixed bottom CTA - navigate to payment, not direct generation */}
          <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t shadow-lg px-4 py-3">
            <button
              onClick={handleGoToPayment}
              className="w-full h-12 rounded-2xl flex items-center justify-center gap-2 text-base font-bold bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-200 transition"
            >
              确认方案，前往支付
            </button>
            <p className="text-center text-xs text-slate-400 mt-1.5">
              共 {cards.length} 个模块，付费后开始生成无水印高清详情图
            </p>
          </div>
        </>
      )}
    </div>
  );
}
