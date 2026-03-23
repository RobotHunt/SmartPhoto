import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Loader2, CheckCircle2, AlertCircle, ArrowLeft,
  Rocket, Wallet, Package, Globe, Image as ImageIcon, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StepIndicator } from "@/components/StepIndicator";
import { sessionAPI, accountAPI, pricingAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ── Types for API responses ──────────────────────────────────────────────────

interface StrategyPreview {
  product_name?: string;
  platforms?: string[];
  total_images?: number;
  image_types?: { type: string; label: string; count: number }[];
  selling_points?: string[];
  [key: string]: any;
}

interface WalletData {
  balance: number;
  [key: string]: any;
}

interface PricingRule {
  action?: string;
  type?: string;
  price?: number;
  unit_price?: number;
  name?: string;
  [key: string]: any;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ConfirmStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Loading / error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // API data
  const [strategy, setStrategy] = useState<StrategyPreview | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [cost, setCost] = useState<number>(0);

  // Action state
  const [confirming, setConfirming] = useState(false);

  // ── Fetch all data on mount ──────────────────────────────────────────────

  useEffect(() => {
    const sessionId = sessionStorage.getItem("current_session_id");
    if (!sessionId) {
      setError("未找到会话，请返回重新开始");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchAll = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fire all three requests in parallel
        const [strategyData, walletData, pricingData] = await Promise.all([
          sessionAPI.buildStrategy(sessionId),
          accountAPI.getWallet(),
          pricingAPI.getRules(),
        ]);

        if (cancelled) return;

        // Strategy - data is nested in strategy_preview
        const sp = strategyData?.strategy_preview || strategyData || {};
        // Build a summary from the strategy
        const assetPlan = sp.asset_plan || [];
        const analysisResult = JSON.parse(sessionStorage.getItem("analysisResult") || "{}");
        const platforms = JSON.parse(sessionStorage.getItem("selectedPlatforms") || "[]");

        setStrategy({
          product_name: analysisResult.product_name || sp.product_name || "产品",
          platforms: platforms,
          total_images: assetPlan.length || sp.total_images || 0,
          image_types: assetPlan.map((a: any) => ({
            type: a.role || a.slot_id || "unknown",
            label: a.expression_mode || a.role || "",
            count: 1,
          })),
          selling_points: analysisResult.visual_features || [],
        });

        // Wallet
        setWallet(walletData);

        // Pricing: find the main gallery generation cost
        // pricingData could be an object with rules array, or an array directly
        const rules: PricingRule[] = Array.isArray(pricingData)
          ? pricingData
          : pricingData?.rules ?? pricingData?.items ?? [];

        const galleryRule = rules.find(
          (r: PricingRule) =>
            r.action === "generate_gallery" ||
            r.type === "main_gallery" ||
            r.type === "gallery" ||
            r.name?.includes("主图") ||
            r.name?.includes("gallery")
        );

        const price = galleryRule?.price ?? galleryRule?.unit_price ?? 0;
        setCost(price);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "加载方案信息失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAll();
    return () => { cancelled = true; };
  }, []);

  // ── Derived values ─────────────────────────────────────────────────────────

  const balance = wallet?.balance ?? 0;
  const hasSufficientBalance = balance >= cost;
  const productName = strategy?.product_name || sessionStorage.getItem("productName") || "产品";
  const platforms = strategy?.platforms ?? [];
  const totalImages = strategy?.total_images ?? strategy?.image_types?.reduce((s, t) => s + t.count, 0) ?? 0;
  const imageTypes = strategy?.image_types ?? [];
  const sellingPoints = strategy?.selling_points ?? [];

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      // Strategy was already built on mount; navigate to result page
      // which will call generateGallery
      setLocation("/create/result");
    } catch (err: any) {
      toast({
        title: "确认失败",
        description: err.message || "请重试",
        variant: "destructive",
      });
    } finally {
      setConfirming(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    // Re-trigger by remounting effect
    const sessionId = sessionStorage.getItem("current_session_id");
    if (!sessionId) {
      setError("未找到会话");
      setLoading(false);
      return;
    }

    Promise.all([
      sessionAPI.buildStrategy(sessionId),
      accountAPI.getWallet(),
      pricingAPI.getRules(),
    ])
      .then(([s, w, p]) => {
        setStrategy(s);
        setWallet(w);
        const rules: PricingRule[] = Array.isArray(p) ? p : p?.rules ?? p?.items ?? [];
        const rule = rules.find(
          (r: PricingRule) =>
            r.action === "generate_gallery" ||
            r.type === "main_gallery" ||
            r.type === "gallery" ||
            r.name?.includes("主图") ||
            r.name?.includes("gallery")
        );
        setCost(rule?.price ?? rule?.unit_price ?? 0);
      })
      .catch((e: any) => setError(e.message || "加载失败"))
      .finally(() => setLoading(false));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <StepIndicator currentStep={5} step5Label="生成图片" />

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
            确认方案
          </h1>
          <p className="text-slate-500 text-sm">
            确认以下生成方案后，AI将为您创建专业电商图片
          </p>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
            <p className="text-sm font-semibold text-slate-600">正在加载方案信息...</p>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-sm text-red-600 font-medium">{error}</p>
            <Button onClick={handleRetry} variant="outline">
              重新加载
            </Button>
          </div>
        )}

        {/* Main content */}
        {!loading && !error && strategy && (
          <>
            {/* ── Strategy Summary Card ─────────────────────────────── */}
            <Card className="p-6 mb-6 border-2 border-blue-100 bg-gradient-to-br from-blue-50/60 to-white">
              {/* Product name */}
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-blue-100">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-xs text-slate-400">产品名称</div>
                  <div className="text-lg font-bold text-slate-900">{productName}</div>
                </div>
              </div>

              {/* Selected platforms */}
              {platforms.length > 0 && (
                <div className="flex items-start gap-3 mb-5 pb-4 border-b border-blue-100">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mt-0.5">
                    <Globe className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">目标平台</div>
                    <div className="flex flex-wrap gap-2">
                      {platforms.map((p) => (
                        <span
                          key={p}
                          className="text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Image count */}
              <div className="flex items-start gap-3 mb-5 pb-4 border-b border-blue-100">
                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center mt-0.5">
                  <ImageIcon className="w-5 h-5 text-violet-600" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-slate-400 mb-1">生成图片</div>
                  <div className="text-lg font-bold text-violet-700">{totalImages} 张</div>
                  {imageTypes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {imageTypes.map((t) => (
                        <span
                          key={t.type}
                          className="text-[11px] bg-violet-50 text-violet-600 border border-violet-200 px-2 py-0.5 rounded-full"
                        >
                          {t.label} x{t.count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Selling points */}
              {sellingPoints.length > 0 && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mt-0.5">
                    <Star className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">核心卖点</div>
                    <div className="space-y-1">
                      {sellingPoints.slice(0, 5).map((sp, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-sm text-slate-700">
                          <span className="text-amber-500 mt-0.5 shrink-0">&#x2022;</span>
                          <span>{sp}</span>
                        </div>
                      ))}
                      {sellingPoints.length > 5 && (
                        <div className="text-xs text-slate-400">
                          ...等共 {sellingPoints.length} 个卖点
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* ── Wallet & Pricing Card ─────────────────────────────── */}
            <Card className="p-5 mb-8 border border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                <Wallet className="w-5 h-5 text-slate-600" />
                <span className="font-semibold text-slate-800 text-sm">费用确认</span>
              </div>

              {/* Cost row */}
              <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
                <span className="text-sm text-slate-500">主图生成费用</span>
                <span className="text-sm font-bold text-slate-900">
                  {cost > 0 ? `¥${cost.toFixed(2)}` : "免费"}
                </span>
              </div>

              {/* Balance row */}
              <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
                <span className="text-sm text-slate-500">钱包余额</span>
                <span className="text-sm font-bold text-slate-900">
                  ¥{balance.toFixed(2)}
                </span>
              </div>

              {/* Balance status */}
              <div className="mt-3">
                {hasSufficientBalance ? (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-sm font-medium text-emerald-700">
                      余额充足
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="text-sm font-medium text-red-600">
                      余额不足，还需充值 ¥{(cost - balance).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </Card>

            {/* ── Action Buttons ─────────────────────────────────────── */}
            <div className="flex flex-col items-center gap-3">
              <Button
                onClick={handleConfirm}
                disabled={confirming || !hasSufficientBalance}
                size="lg"
                className="w-full max-w-sm bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 disabled:opacity-50 text-white px-8 py-5 text-base font-bold shadow-lg hover:shadow-xl transition-all"
              >
                {confirming ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    确认中...
                  </>
                ) : (
                  <>
                    <Rocket className="w-5 h-5 mr-2" />
                    确认生成
                  </>
                )}
              </Button>

              <button
                onClick={() => setLocation("/create/copywriting")}
                className="flex items-center gap-1.5 text-slate-400 hover:text-blue-600 text-sm transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                返回修改
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
