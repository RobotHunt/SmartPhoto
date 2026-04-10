import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StepIndicator } from "@/components/StepIndicator";
import { sessionAPI } from "@/lib/api";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface AssetPlanItem {
  role: string;
  slot_id?: string;
  expression_mode?: string;
  display_order?: number;
  [key: string]: any;
}

interface ImageTypeDisplay {
  role: string;
  emoji: string;
  label: string;
  count: number;
}

/* ─── Role → Display mapping ─────────────────────────────────────────────── */

const ROLE_MAP: Record<string, { emoji: string; label: string }> = {
  hero:          { emoji: "📸", label: "主图" },
  scene:         { emoji: "🏠", label: "场景图" },
  selling_point: { emoji: "⭐", label: "卖点图" },
  structure:     { emoji: "🔧", label: "结构图" },
  white_bg:      { emoji: "⬜", label: "白底图" },
  feature:       { emoji: "💡", label: "功能图" },
};

function getRoleDisplay(role: string): { emoji: string; label: string } {
  return ROLE_MAP[role] || { emoji: "🖼️", label: role };
}

/* ─── Group asset_plan by role ───────────────────────────────────────────── */

function groupByRole(plan: AssetPlanItem[]): ImageTypeDisplay[] {
  const map = new Map<string, ImageTypeDisplay>();
  for (const item of plan) {
    const role = item.role || "unknown";
    const existing = map.get(role);
    if (existing) {
      existing.count += 1;
    } else {
      const display = getRoleDisplay(role);
      map.set(role, {
        role,
        emoji: display.emoji,
        label: display.label,
        count: 1,
      });
    }
  }
  return Array.from(map.values());
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export default function ConfirmStep() {
  const [, setLocation] = useLocation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const [productName, setProductName] = useState("");
  const [imageTypes, setImageTypes] = useState<ImageTypeDisplay[]>([]);
  const [totalImages, setTotalImages] = useState(0);

  /* ── Fetch strategy on mount ───────────────────────────────────────────── */

  useEffect(() => {
    const sessionId = sessionStorage.getItem("current_session_id");
    if (!sessionId) {
      setError("未找到会话，请返回重新开始");
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const strategyData = await sessionAPI.buildStrategy(sessionId);
        if (cancelled) return;

        const sp = strategyData?.strategy_preview ?? strategyData ?? {};
        const assetPlan: AssetPlanItem[] = sp.asset_plan ?? [];
        const grouped = groupByRole(assetPlan);

        // Read product info from sessionStorage
        const analysisResult = JSON.parse(
          sessionStorage.getItem("analysisResult") || "{}"
        );

        setProductName(
          analysisResult.product_name || sp.product_name || "产品"
        );
        setImageTypes(grouped);
        setTotalImages(assetPlan.length || sp.total_images || 0);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "加载方案信息失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ── Handlers ──────────────────────────────────────────────────────────── */

  const handleGenerate = () => {
    setConfirming(true);
    setLocation("/create/result");
  };

  const handleCopywriting = () => {
    setLocation("/create/copywriting");
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);

    const sessionId = sessionStorage.getItem("current_session_id");
    if (!sessionId) {
      setError("未找到会话");
      setLoading(false);
      return;
    }

    sessionAPI
      .buildStrategy(sessionId)
      .then((strategyData) => {
        const sp = strategyData?.strategy_preview ?? strategyData ?? {};
        const assetPlan: AssetPlanItem[] = sp.asset_plan ?? [];
        const grouped = groupByRole(assetPlan);

        const analysisResult = JSON.parse(
          sessionStorage.getItem("analysisResult") || "{}"
        );

        setProductName(
          analysisResult.product_name || sp.product_name || "产品"
        );
        setImageTypes(grouped);
        setTotalImages(assetPlan.length || sp.total_images || 0);
      })
      .catch((e: any) => setError(e.message || "加载失败"))
      .finally(() => setLoading(false));
  };

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <StepIndicator currentStep={5} step5Label="生成图片" />

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* ── Centered title ──────────────────────────────────────────── */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
            一键生成整套视觉
          </h1>
          <p className="text-slate-600">
            确认生成方案，AI将为您创建专业的电商图片
          </p>
        </div>

        {/* ── Loading ─────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
            <p className="text-sm font-semibold text-slate-600">
              正在生成方案...
            </p>
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────────── */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-sm text-red-600 font-medium">{error}</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setLocation("/create/copywriting")}
                className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                返回上一页
              </button>
              <button
                onClick={handleRetry}
                className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
              >
                重新加载
              </button>
            </div>
          </div>
        )}

        {/* ── Main content ────────────────────────────────────────────── */}
        {!loading && !error && (
          <>
            {/* ── Large gradient card: AI generation plan ─────────────── */}
            <Card className="p-8 mb-8 bg-gradient-to-br from-blue-50 to-emerald-50 border-2 border-blue-200">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                  AI即将为你生成：
                </h2>
                <p className="text-slate-600">
                  基于您上传的产品图片和提供的信息
                  {productName && <span className="ml-1">({productName})</span>}
                </p>
              </div>

              {/* ── Grid of image type cards ──────────────────────────── */}
              <div className="grid md:grid-cols-2 gap-4 mb-8">
                {imageTypes.map((item) => (
                  <div
                    key={item.role}
                    className="flex items-center gap-4 p-4 bg-white rounded-lg border-2 border-blue-200"
                  >
                    <div className="text-4xl">{item.emoji}</div>
                    <div className="flex-1">
                      <div className="font-bold text-slate-900 mb-1">{item.label}</div>
                      <div className="text-sm text-slate-600">
                        {item.count} 张
                      </div>
                    </div>
                    <CheckCircle2 className="w-6 h-6 text-blue-500" />
                  </div>
                ))}
              </div>

              {/* ── Total count ───────────────────────────────────────── */}
              <div className="text-center py-6 border-t-2 border-blue-200">
                <div className="text-slate-600 mb-2">总计生成</div>
                <div className="text-5xl font-bold text-blue-600 mb-2">
                  {totalImages}
                </div>
                <div className="text-slate-600">张专业电商图片</div>
              </div>
            </Card>

            {/* ── Preview section: 3 example images ───────────────────── */}
            <Card className="p-6 mb-8">
              <h3 className="font-semibold text-slate-900 mb-4">效果预览</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden">
                  <img
                    src="/case-1688-1.png"
                    alt="主图示例"
                    className="w-full h-full object-contain p-2"
                  />
                </div>
                <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden">
                  <img
                    src="/case-1688-4.jpg"
                    alt="场景图示例"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden">
                  <img
                    src="/case-1688-3.jpg"
                    alt="卖点图示例"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </Card>

            {/* ── Action buttons ──────────────────────────────────────── */}
            <div className="text-center">
              <button
                onClick={handleGenerate}
                disabled={confirming}
                className="bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 disabled:opacity-60 text-slate-900 px-12 py-6 text-xl font-bold shadow-lg hover:shadow-xl transition-all rounded-xl inline-flex items-center gap-3"
              >
                {confirming ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    正在生成中...
                  </>
                ) : (
                  "一键生成整套图片"
                )}
              </button>
              {confirming && (
                <p className="text-sm text-slate-600 mt-4">
                  AI正在创作中，预计30-60秒，请稍候...
                </p>
              )}
              <button
                onClick={handleCopywriting}
                className="mt-3 flex items-center justify-center gap-1.5 mx-auto text-slate-500 hover:text-blue-600 text-sm transition-colors"
              >
                直接生成详情文案
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
