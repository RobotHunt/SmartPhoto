import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, Check, Loader2, Pause, Play, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { jobAPI, sessionAPI } from "@/lib/api";
import { resolveAssetLabel } from "@/lib/assetLabels";
import { useToast } from "@/hooks/use-toast";

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-8">
        <div className="mx-auto flex max-w-2xl flex-col items-center justify-center rounded-3xl bg-white px-6 py-20 shadow-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
            <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
          </div>
          <h1 className="mb-2 text-xl font-bold text-slate-900">AI 正在生成主图策略</h1>
          <p className="text-sm text-slate-500">正在根据当前商品信息整理主图策略，请稍候。</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-8">
        <div className="mx-auto flex max-w-2xl flex-col items-center justify-center rounded-3xl bg-white px-6 py-20 shadow-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="h-7 w-7 text-red-500" />
          </div>
          <h1 className="mb-2 text-xl font-bold text-slate-900">主图策略生成失败</h1>
          <p className="mb-6 max-w-md text-center text-sm text-slate-500">{error}</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setLocation("/create/generate")}>
              返回修改参数
            </Button>
            <Button onClick={() => window.location.reload()}>重新生成策略</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-4">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 text-center">
          <h1 className="mb-1 text-2xl font-bold text-slate-900">AI已生成主图策略</h1>
          <p className="mx-auto max-w-md text-xs text-slate-500">
            根据您的选择，AI已为您生成优化策略。请确认以下内容，符合预期后开始生成。
          </p>
        </div>

        <div className="mb-3 rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500">
              <Check className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">AI已生成主图策略</h2>
          </div>

          <div className="space-y-2">
            <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
              <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <Check className="h-3 w-3 text-emerald-600" />
              </div>
              <div>
                <div className="mb-0.5 text-xs font-medium text-slate-500">核心场景</div>
                <div className="text-sm font-semibold text-slate-900">{strategyData.scene}</div>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
              <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <Check className="h-3 w-3 text-emerald-600" />
              </div>
              <div>
                <div className="mb-0.5 text-xs font-medium text-slate-500">核心性能</div>
                <div className="text-sm font-semibold text-slate-900">{strategyData.performance}</div>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
              <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <Check className="h-3 w-3 text-emerald-600" />
              </div>
              <div>
                <div className="mb-0.5 text-xs font-medium text-slate-500">核心卖点</div>
                <div className="text-sm font-semibold text-slate-900">{strategyData.sellingPoint}</div>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
              <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <Check className="h-3 w-3 text-emerald-600" />
              </div>
              <div>
                <div className="mb-0.5 text-xs font-medium text-slate-500">主图构图建议</div>
                <div className="text-sm font-semibold text-slate-900">{strategyData.composition}</div>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3">
              <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-orange-100">
                <ShoppingBag className="h-3 w-3 text-orange-500" />
              </div>
              <div className="flex-1">
                <div className="mb-0.5 flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">平台专属策略</span>
                  <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-xs font-medium leading-none text-white">
                    专属优化
                  </span>
                </div>
                <div className="mb-0.5 text-sm font-bold text-orange-700">{strategyData.platform}</div>
                <div className="text-xs leading-relaxed text-orange-500">{strategyData.platformTips}</div>
              </div>
            </div>
          </div>

          <div className="mt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {isAutoStart ? `${countdown}秒后自动开始生成主图...` : "已暂停，随时可手动开始"}
              </span>
              <button
                onClick={() => setIsAutoStart((value) => !value)}
                className="flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-100"
              >
                {isAutoStart ? (
                  <>
                    <Pause className="h-3 w-3" />
                    暂停
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3" />
                    继续
                  </>
                )}
              </button>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-blue-500 transition-all duration-1000 ease-linear"
                style={{ width: `${((5 - countdown) / 5) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleModify}
            variant="outline"
            className="h-12 flex-1 rounded-full border-2 border-slate-300 text-sm font-semibold hover:border-slate-400 hover:bg-slate-50"
          >
            修改策略
          </Button>
          <Button
            onClick={handleGenerate}
            className="h-12 flex-1 rounded-full bg-emerald-500 text-sm font-semibold text-white shadow-lg hover:bg-emerald-600"
          >
            <svg className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            立即生成
          </Button>
        </div>
      </div>
    </div>
  );
}
