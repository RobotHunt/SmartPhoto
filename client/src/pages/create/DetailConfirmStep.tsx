import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { sessionAPI } from "@/lib/api";
import { resolveGenerationStageText } from "@/lib/generationStatus";

import { DetailStepIndicator } from "./DetailStepIndicator";
import GenerationWaitingUI from "@/components/GenerationWaitingUI";

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
    <div className="min-h-screen aurora-bg flex flex-col pt-8 sm:pt-12">
      <div className="w-full max-w-5xl mx-auto px-4 relative z-10 w-full pb-28">
        <DetailStepIndicator currentStep={2} />

        {phase === "loading" && (
          <GenerationWaitingUI kind="detail" progress={0} stage="正在配置详情图方案" />
        )}

        {phase === "error" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 py-32 h-[50vh]">
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl backdrop-blur-md">
              <p className="text-base font-bold tracking-wide text-red-400">{error || "详情图方案加载失败"}</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="px-6 h-12 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-300 rounded-xl font-bold tracking-widest text-sm transition-colors"
              >
                返回文案页
              </button>
            </div>
          </div>
        )}

        {phase === "planning" && (
          <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header info */}
            <div className="glass-panel border-white/10 rounded-2xl p-6 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-1.5 h-6 bg-cyan-400 rounded-full shadow-[0_0_8px_#22d3ee]"></div>
                  <h1 className="text-xl font-bold tracking-widest text-slate-100">
                    已规划 {cards.length} 个详情模块
                  </h1>
                </div>
                <p className="text-sm font-medium tracking-wide text-slate-400 pl-4">
                  确认后将进入结账环节，支付完成后 AI 将生成极清无水印的详情图资产。
                </p>
              </div>
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-cyan-400 border border-white/10 bg-white/5 rounded-xl px-4 py-2 transition self-start sm:self-auto"
              >
                <RefreshCw className="w-4 h-4" />
                重新配置
              </button>
            </div>

            {/* Scrollable planning cards grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cards.map((card, index) => (
                <div
                  key={card.id}
                  className="glass-panel border-white/10 rounded-2xl p-6 shadow-xl flex flex-col h-full hover:border-cyan-500/30 transition-all group"
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest bg-cyan-950/40 border border-cyan-500/20 px-2 py-0.5 rounded">
                          模块 {index + 1}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-100 group-hover:text-white transition-colors">
                        {card.label}
                      </h3>
                    </div>
                  </div>

                  <p className="text-sm leading-relaxed text-slate-400 font-medium mb-5 flex-1">
                    {card.description}
                  </p>

                  <div className="space-y-4">
                    {card.copyHighlights.length > 0 && (
                      <div className="rounded-xl border border-white/5 bg-black/40 p-4">
                         <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">核心文案</div>
                         <div className="space-y-2">
                           {card.copyHighlights.map((line, i) => (
                             <div key={i} className="flex items-start gap-2 text-sm text-slate-300">
                               <div className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.8)]"></div>
                               <span className="leading-relaxed font-medium">{line}</span>
                             </div>
                           ))}
                         </div>
                      </div>
                    )}

                    {card.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {card.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-xs font-medium text-slate-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {card.layoutNotes && (
                      <div className="text-xs leading-relaxed text-slate-500 font-medium">
                        布局说明: <span className="text-slate-400">{card.layoutNotes}</span>
                      </div>
                    )}

                    {card.originNote && (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium leading-relaxed text-amber-200/80">
                        {card.originNote}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Sticky Action Area */}
            <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#050914]/80 backdrop-blur-xl border-t border-white/10 p-4 flex justify-center">
              <div className="w-full max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="hidden sm:block">
                  <span className="text-sm font-bold text-slate-300">共 {cards.length} 个独立高转化模块</span>
                </div>
                <button
                  onClick={handleGoToPayment}
                  className="sci-fi-button w-full sm:w-auto px-10 h-14 bg-cyan-600 hover:bg-cyan-500 text-white font-bold tracking-widest text-base rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 transition-all"
                >
                  确认方案并继续
                  <CheckCircle2 className="w-5 h-5 ml-1 opacity-80" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
