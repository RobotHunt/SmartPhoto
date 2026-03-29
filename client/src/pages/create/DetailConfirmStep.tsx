import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Sparkles } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { jobAPI, sessionAPI } from "@/lib/api";
import { resolveGenerationStageText } from "@/lib/generationStatus";
import { updateSessionRecord } from "@/lib/localUser";

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

type Phase = "loading" | "planning" | "generating" | "error";

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

function visualTruthLabel(mode?: string) {
  return {
    faithful_closeup: "真实局部图",
    mechanism_illustration: "机制示意图",
    scene_reconstruction: "场景重建图",
    parameter_board: "参数信息图",
  }[String(mode || "")] || "";
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

    const tags = [
      item.panel_type,
      item.narrative_section,
      visualTruthLabel(item.visual_truth_mode),
    ].filter(Boolean) as string[];

    return {
      id: String(item.slot_id || item.panel_id || index + 1),
      label: item.panel_label || item.panel_type || `详情图 ${index + 1}`,
      description:
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
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState("正在加载详情图方案...");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cards, setCards] = useState<PlanningCard[]>([]);

  async function startPolling(jobId: string, initialText = "正在生成详情图...") {
    setPhase("generating");
    setError("");
    setLoadingText(initialText);
    setProgress(8);
    setBusy(true);

    await jobAPI.pollUntilDone(
      jobId,
      (status) => {
        const nextProgress = Number(status?.progress || status?.progress_pct || 0);
        if (nextProgress > 0) {
          setProgress(Math.max(8, Math.min(99, Math.round(nextProgress))));
        }
        setLoadingText(resolveGenerationStageText(status?.stage || status?.status, "detail"));
      },
      2000,
      300000,
    );

    setProgress(100);
    setLoadingText("正在打开详情结果...");
    setBusy(false);

    if (sessionId) {
      updateSessionRecord(sessionId, { last_step: "detail-confirm" });
    }

    toast({ title: "详情图生成完成" });
    setLocation("/create/detail-result");
  }

  async function tryResumeExistingJob(): Promise<boolean> {
    try {
      const snapshot = await sessionAPI.get(sessionId);
      const jobId = snapshot.latest_detail_generate_job_id;
      if (!jobId) return false;

      const jobStatus = String(
        (await jobAPI.getStatus(jobId).catch(() => null))?.status || "",
      ).toLowerCase();
      const isFinal = ["failed", "error", "completed", "done", "succeeded"].includes(jobStatus);
      if (isFinal) return false;

      await startPolling(jobId, "正在恢复详情图生成任务...");
      return true;
    } catch {
      return false;
    }
  }

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

        if (snapshot.latest_detail_generate_job_id) {
          const jobStatus = String(
            (await jobAPI.getStatus(snapshot.latest_detail_generate_job_id).catch(() => null))
              ?.status || "",
          ).toLowerCase();
          const isFinal = ["failed", "error", "completed", "done", "succeeded"].includes(jobStatus);
          if (!isFinal) {
            await startPolling(snapshot.latest_detail_generate_job_id, "正在恢复详情图生成任务...");
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

  const handleGenerate = async () => {
    if (!sessionId || busy) return;
    setBusy(true);

    try {
      setError("");
      const snapshot = await sessionAPI.get(sessionId);
      sessionStorage.setItem("detail_copy_hash", JSON.stringify(snapshot.confirmed_copy || ""));

      const generation = await sessionAPI.generateDetailPage(sessionId);
      const jobId = generation?.job_id || generation?.jobId;
      if (!jobId) {
        throw new Error("未拿到详情图任务 ID");
      }
      await startPolling(jobId);
    } catch (err: any) {
      const resumed = await tryResumeExistingJob();
      if (resumed) return;

      setBusy(false);
      setError(err?.message || "详情图生成失败");
      setPhase("error");
    }
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

      {phase === "generating" && (
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-slate-900">{loadingText}</h2>
          <p className="mb-6 text-sm text-slate-500">请耐心等待，AI 正在为您生成详情图</p>
          <div className="mb-2 w-full max-w-xs">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-400">{progress}%</p>
        </div>
      )}

      {phase === "error" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <div>
            <p className="text-base font-semibold text-slate-900">详情图生成失败</p>
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
              onClick={handleGenerate}
              className="px-4 py-2 rounded-full bg-blue-500 text-sm text-white hover:bg-blue-600"
            >
              重试
            </button>
          </div>
        </div>
      )}

      {phase === "planning" && (
        <>
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
          <p className="px-4 py-2 text-xs text-slate-500 bg-white border-b">
            当前展示的是详情图规划内容。确认后将按此方案生成真实详情图。
          </p>

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

          <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t shadow-lg px-4 py-3">
            <button
              onClick={handleGenerate}
              disabled={busy}
              className="w-full h-12 rounded-2xl flex items-center justify-center gap-2 text-base font-bold bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-200 transition disabled:opacity-70"
            >
              <Sparkles className="w-5 h-5" />
              确认并生成详情图
            </button>
            <p className="text-center text-xs text-slate-400 mt-1.5">
              共 {cards.length} 个模块，确认后开始生成真实详情图
            </p>
          </div>
        </>
      )}
    </div>
  );
}
