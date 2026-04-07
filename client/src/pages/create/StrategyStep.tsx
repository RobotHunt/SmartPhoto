import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, Check, Loader2, Pause, Play, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { jobAPI, sessionAPI, platformAPI } from "@/lib/api";
import { resolveAssetLabel } from "@/lib/assetLabels";
import { useToast } from "@/hooks/use-toast";
import GenerationWaitingUI from "@/components/GenerationWaitingUI";

const ALL_COPY_TARGETS = [
  "headline",
  "selling_points",
  "usage_scenes",
  "specs",
];

function isCopyEmpty(data: any): boolean {
  if (!data) return true;
  return (
    !data.headline &&
    !data.hero_scene &&
    !data.selling_points &&
    !data.core_selling_points?.length &&
    !data.usage_scenes &&
    !data.specs &&
    !data.key_parameters?.length &&
    !data.product_name
  );
}

function firstNonEmpty(items: any[], keys: string[]) {
  for (const item of items) {
    for (const key of keys) {
      const value = item?.[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return "";
}

export default function StrategyStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const sessionId = sessionStorage.getItem("current_session_id") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [isAutoStart, setIsAutoStart] = useState(true);
  const [strategyPreview, setStrategyPreview] = useState<Record<string, any> | null>(null);
  const [expressionModes, setExpressionModes] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;

    const ensureStrategyPreview = async () => {
      if (!sessionId) {
        setError("缺少会话信息，请返回重新开始。");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const snapshot = await sessionAPI.get(sessionId).catch(() => null);
        let preview = snapshot?.strategy_preview;

        if (!preview || !Array.isArray(preview.asset_plan) || preview.asset_plan.length === 0) {
          let copyData = snapshot?.confirmed_copy;

          if (!copyData || isCopyEmpty(copyData)) {
            const existingCopy = await sessionAPI.getCopy(sessionId).catch(() => null);
            copyData = existingCopy;
          }

          if (!copyData || isCopyEmpty(copyData)) {
            const regenerate = await sessionAPI.regenerateCopy(sessionId, ALL_COPY_TARGETS);
            if (regenerate?.job_id) {
              await jobAPI.pollUntilDone(regenerate.job_id, undefined, 2000, 120000);
            }
          }

          const built = await sessionAPI.buildStrategy(sessionId);
          preview = built?.strategy_preview ?? built;
        }

        if (cancelled) return;

        if (!preview || !Array.isArray(preview.asset_plan) || preview.asset_plan.length === 0) {
          throw new Error("策略预览为空，请返回上一步重试。");
        }

        setStrategyPreview(preview);
        setCountdown(5);
      } catch (err: any) {
        if (cancelled) return;
        const message = err?.message || "策略生成失败，请稍后重试。";
        setError(message);
        toast({
          title: "策略生成失败",
          description: message,
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    ensureStrategyPreview();

    return () => {
      cancelled = true;
    };
  }, [sessionId, toast]);

  useEffect(() => {
    if (loading || error || !isAutoStart || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((previous) => {
        if (previous <= 1) {
          clearInterval(timer);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown, error, isAutoStart, loading]);

  useEffect(() => {
    if (!loading && !error && isAutoStart && countdown === 0) {
      setLocation("/create/result");
    }
  }, [countdown, error, isAutoStart, loading, setLocation]);

  useEffect(() => {
    if (!strategyPreview) return;
    const platform = String(strategyPreview?.platform_strategy || "").replace(/\s*主图标准\s*$/, "").trim() || sessionStorage.getItem("selectedPlatform") || "全部";
    
    let cancelled = false;
    platformAPI.getExpressionModes(platform).then((data: any) => {
      if (cancelled) return;
      let parsed: any[] = [];
      if (Array.isArray(data)) parsed = data;
      else if (data?.modes && Array.isArray(data.modes)) parsed = data.modes;
      else if (data?.data && Array.isArray(data.data)) parsed = data.data;
      setExpressionModes(parsed);
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [strategyPreview]);

  const assetPlan = useMemo(
    () => (Array.isArray(strategyPreview?.asset_plan) ? strategyPreview?.asset_plan : []),
    [strategyPreview],
  );

  const strategyData = useMemo(() => {
    const heroPlan =
      assetPlan.find((item) => item?.role === "hero" || item?.slot_id === "primary_kv") ||
      assetPlan[0] ||
      null;
    const keyParameters = Array.isArray(strategyPreview?.key_parameters)
      ? strategyPreview.key_parameters
      : [];
    const coreSellingPoints = Array.isArray(strategyPreview?.core_selling_points)
      ? strategyPreview.core_selling_points.filter(Boolean)
      : [];
    const platformName =
      String(strategyPreview?.platform_strategy || "")
        .replace(/\s*主图标准\s*$/, "")
        .trim() ||
      sessionStorage.getItem("selectedPlatform") ||
      "当前平台";
    const planLabels = assetPlan
      .map((item) =>
        item?.role_label ||
        item?.slot_label ||
        resolveAssetLabel(item?.slot_id, item?.role)
      )
      .filter(Boolean)
      .slice(0, 5);

    return {
      scene: strategyPreview?.hero_scene || strategyPreview?.core_scene || "待补充",
      performance:
        strategyPreview?.core_performance ||
        firstNonEmpty(keyParameters, ["value"]) ||
        "待补充",
      sellingPoint:
        coreSellingPoints[0] ||
        strategyPreview?.core_selling_point ||
        strategyPreview?.headline ||
        "待补充",
      composition:
        heroPlan?.composition_hint ||
        heroPlan?.goal ||
        "商品主体清晰，构图简洁。",
      platform: platformName,
      platformTips:
        planLabels.length > 0
          ? `${strategyPreview?.image_count || assetPlan.length || 0} 张主图规划 · ${planLabels.join(" · ")}`
          : "已根据当前平台规则完成主图规划",
    };
  }, [assetPlan, strategyPreview]);

  const handleModify = () => {
    setIsAutoStart(false);
    setLocation("/create/generate");
  };

  const handleGenerate = () => {
    setIsAutoStart(false);
    setLocation("/create/result");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col aurora-bg z-50">
        <GenerationWaitingUI kind="analysis" progress={0} stage="正在生成主图策略" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen aurora-bg flex items-center justify-center px-4 py-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center rounded-[32px] glass-panel px-6 py-20 border border-white/10">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-900/40 border border-red-500/30">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <h1 className="mb-2 text-xl font-bold text-white">主图策略生成失败</h1>
          <p className="mb-6 max-w-md text-center text-sm text-slate-400">{error}</p>
          <div className="flex gap-3">
            <Button variant="outline" className="border-white/20 text-slate-300 hover:text-white hover:bg-white/10" onClick={() => setLocation("/create/generate")}>
              返回修改参数
            </Button>
            <Button className="sci-fi-button text-white" onClick={() => window.location.reload()}>重新生成策略</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen aurora-bg px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 text-center">
          <h1 className="mb-2 text-3xl font-bold text-white tracking-wide">AI已生成主图策略</h1>
          <p className="mx-auto max-w-md text-sm text-slate-400">
            根据您的选择，AI已为您生成优化策略。请确认以下内容，符合预期后开始生成。
          </p>
        </div>

        <div className="mb-6 rounded-[24px] glass-panel border border-white/10 p-6 shadow-2xl">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-900/40 border border-cyan-500/40">
              <Check className="h-4 w-4 text-cyan-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-100 tracking-wide">主图策略分析报告</h2>
          </div>

          <div className="space-y-4 grid sm:grid-cols-2 gap-4 auto-rows-min">
            <div className="flex items-start gap-4 rounded-2xl bg-black/40 border border-white/5 p-4 sm:mt-4">
              <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-cyan-900/30 border border-cyan-500/20">
                <Check className="h-3 w-3 text-cyan-500" />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold tracking-wider text-slate-500 uppercase">核心场景</div>
                <div className="text-sm text-slate-200 leading-relaxed">{strategyData.scene}</div>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-2xl bg-black/40 border border-white/5 p-4">
              <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-cyan-900/30 border border-cyan-500/20">
                <Check className="h-3 w-3 text-cyan-500" />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold tracking-wider text-slate-500 uppercase">核心性能</div>
                <div className="text-sm text-slate-200 leading-relaxed">{strategyData.performance}</div>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-2xl bg-black/40 border border-white/5 p-4 sm:col-span-2">
              <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-cyan-900/30 border border-cyan-500/20">
                <Check className="h-3 w-3 text-cyan-500" />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold tracking-wider text-slate-500 uppercase">核心卖点</div>
                <div className="text-sm text-slate-200 leading-relaxed">{strategyData.sellingPoint}</div>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-2xl bg-black/40 border border-white/5 p-4 sm:col-span-2">
              <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-cyan-900/30 border border-cyan-500/20">
                <Check className="h-3 w-3 text-cyan-500" />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold tracking-wider text-slate-500 uppercase">主图构图建议</div>
                <div className="text-sm text-slate-200 leading-relaxed">{strategyData.composition}</div>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-2xl border border-orange-500/30 bg-orange-900/20 p-4 sm:col-span-2 shadow-[0_0_15px_rgba(249,115,22,0.1)]">
              <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-500/20 border border-orange-500/40">
                <ShoppingBag className="h-4 w-4 text-orange-400" />
              </div>
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-3">
                  <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">平台专属策略</span>
                  <span className="rounded border border-orange-500/60 bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-orange-400">
                    专属优化
                  </span>
                </div>
                <div className="mb-1 text-base font-bold text-slate-100">{strategyData.platform}</div>
                <div className="text-sm leading-relaxed text-orange-200/80">{strategyData.platformTips}</div>
              </div>
            </div>

            {expressionModes.length > 0 && (
              <div className="flex items-start gap-4 rounded-2xl bg-black/40 border border-indigo-500/30 p-4 sm:col-span-2 shadow-[0_0_15px_rgba(99,102,241,0.1)]">
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-900/30 border border-indigo-500/20">
                  <Check className="h-3 w-3 text-indigo-500" />
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">可选表达形态</div>
                  <div className="flex flex-wrap gap-2">
                    {expressionModes.map((mode, i) => {
                      const txt = typeof mode === "string" ? mode : mode?.mode_name || mode?.label || mode?.mode || mode?.id || JSON.stringify(mode);
                      return (
                        <span key={i} className="px-2 py-1 rounded-md text-[10px] font-bold tracking-widest bg-indigo-500/20 border border-indigo-500/30 text-indigo-300">
                          {txt}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-white/10 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-slate-400 font-medium tracking-wide">
                {isAutoStart ? `${countdown}秒后自动开始生成主图...` : "已暂停，随时可手动开始"}
              </span>
              <button
                onClick={() => setIsAutoStart((value) => !value)}
                className="flex items-center gap-1.5 rounded-full border border-white/20 px-4 py-1.5 text-xs font-bold text-slate-300 transition-all hover:bg-white/10 hover:text-white"
              >
                {isAutoStart ? (
                  <>
                    <Pause className="h-3.5 w-3.5" />
                    暂停计时
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    继续计时
                  </>
                )}
              </button>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-black/40 border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-cyan-600 to-cyan-300 transition-all duration-1000 ease-linear shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                style={{ width: `${((5 - countdown) / 5) * 100}%` }}
              />
            </div>
          </div>
          
          {/* DEV INFO BLOCK for Strategy */}
          {(import.meta.env.DEV || localStorage.getItem("dev_debug") === "1") && assetPlan.some((p: any) => Object.keys(p.truth_contract || {}).length > 0 || Object.keys(p.selling_point_binding || {}).length > 0 || p.risk_flags?.length > 0) && (
            <div className="mt-6 rounded-2xl glass-panel border-purple-500/30 p-5 shadow-lg bg-purple-900/10">
              <h3 className="mb-3 text-sm font-bold text-purple-400 flex items-center gap-2">
                 <AlertCircle className="w-4 h-4" /> 内部调试 / 策略底层分析数据 (Prompt Items)
              </h3>
              <div className="space-y-4 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                {assetPlan.map((plan: any, idx: number) => {
                   if (!plan.truth_contract && !plan.selling_point_binding && (!plan.risk_flags || plan.risk_flags.length === 0)) return null;
                   return (
                     <div key={idx} className="bg-black/40 border border-white/5 rounded-xl p-3">
                        <div className="font-bold text-xs text-slate-300 mb-2">Slot: {plan.slot_id || plan.role}</div>
                        {plan.risk_flags && plan.risk_flags.length > 0 && (
                          <div className="mb-2">
                            <span className="text-[10px] text-slate-500 mr-2">风险 (Risk Flags):</span>
                            {plan.risk_flags.map((rf: string, rIdx: number) => (
                               <span key={rIdx} className="px-2 py-0.5 rounded bg-red-900/40 border border-red-500/30 text-[10px] text-red-300 mr-1">{rf}</span>
                            ))}
                          </div>
                        )}
                        {plan.selling_point_binding && (
                          <div className="mb-2">
                             <div className="text-[10px] text-slate-500 mb-1">卖点关联结构 (Selling Point Binding):</div>
                             <pre className="text-[10px] text-slate-300 bg-black/60 p-2 rounded max-h-20 overflow-auto whitespace-pre-wrap">{JSON.stringify(plan.selling_point_binding, null, 2)}</pre>
                          </div>
                        )}
                        {plan.truth_contract && (
                          <div>
                             <div className="text-[10px] text-slate-500 mb-1">生成与物理真值约束 (Truth Contract):</div>
                             <pre className="text-[10px] text-slate-300 bg-black/60 p-2 rounded max-h-20 overflow-auto whitespace-pre-wrap">{JSON.stringify(plan.truth_contract, null, 2)}</pre>
                          </div>
                        )}
                     </div>
                   );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <Button
            onClick={handleModify}
            variant="outline"
            className="h-14 flex-1 rounded-2xl border-2 border-white/10 bg-black/40 text-sm font-bold tracking-widest text-slate-300 hover:border-white/30 hover:bg-white/5 hover:text-white transition-all backdrop-blur-md"
          >
            修改策略参数
          </Button>
          <Button
            onClick={handleGenerate}
            className="sci-fi-button h-14 flex-1 rounded-2xl text-base font-bold tracking-widest"
          >
            <svg className="mr-2 h-5 w-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            开始生成主图
          </Button>
        </div>
      </div>
    </div>
  );
}
