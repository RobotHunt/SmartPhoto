import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Loader2, Wallet, Sparkles,
} from "lucide-react";
import { StepIndicator } from "@/components/StepIndicator";
import { Button } from "@/components/ui/button";
import { accountAPI, pricingAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ── Types ────────────────────────────────────────────────────────────────────

interface PricingRule {
  action?: string;
  type?: string;
  price?: number;
  unit_price?: number;
  credits?: number;
  name?: string;
  [key: string]: any;
}

interface WalletData {
  balance: number;
  credits?: number;
  [key: string]: any;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PaymentStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Loading & action states
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  // API data
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [cost, setCost] = useState<number>(0);
  const [costLabel, setCostLabel] = useState<string>("主图生成");

  // ── Fetch wallet + pricing on mount ────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [walletData, pricingData] = await Promise.all([
          accountAPI.getWallet(),
          pricingAPI.getRules(),
        ]);

        if (cancelled) return;

        // Wallet
        setWallet(walletData);

        // Find generate_gallery pricing rule
        const rules: PricingRule[] = Array.isArray(pricingData)
          ? pricingData
          : pricingData?.rules ?? pricingData?.items ?? [];

        const galleryRule = rules.find(
          (r: PricingRule) =>
            r.action === "generate_gallery" ||
            r.type === "generate_gallery" ||
            r.action === "generate_hd" ||
            r.type === "hd_generation" ||
            r.name?.includes("主图") ||
            r.name?.includes("生成")
        );

        if (galleryRule) {
          setCost(galleryRule.credits ?? galleryRule.price ?? galleryRule.unit_price ?? 0);
          if (galleryRule.name) setCostLabel(galleryRule.name);
        }
      } catch (err: any) {
        console.error("获取价格/钱包信息失败:", err);
        toast({
          title: "加载失败",
          description: "无法获取额度信息，请刷新重试",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [toast]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const balance = wallet?.credits ?? wallet?.balance ?? 0;
  const sufficient = balance >= cost;

  // ── Pay handler ────────────────────────────────────────────────────────────

  const handleConfirmPay = async () => {
    if (!sufficient) return;
    setPaying(true);
    try {
      sessionStorage.setItem("hdPaymentSuccess", "true");
      toast({ title: "扣费成功", description: "正在生成高清无水印图片..." });
      setLocation("/create/hd-result");
    } catch (err: any) {
      toast({
        title: "支付失败",
        description: err.message || "请重试",
        variant: "destructive",
      });
    } finally {
      setPaying(false);
    }
  };

  // ── Render: loading state ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f6f8]">
        <StepIndicator currentStep={5} step5Label="确认支付" />
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
          <span className="text-sm text-slate-500">加载额度信息...</span>
        </div>
      </div>
    );
  }

  // ── Render: main ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <StepIndicator currentStep={5} step5Label="确认支付" />

      <div className="max-w-lg mx-auto px-4 pt-6 pb-32">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-xl">
            💰
          </div>
          <h1 className="text-xl font-bold text-slate-900">额度确认</h1>
        </div>

        {/* Pricing breakdown card */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-100 p-5 mb-4">
          <h2 className="text-sm font-semibold text-slate-500 mb-4">费用明细</h2>

          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-slate-800">{costLabel}</span>
            </div>
            <span className="text-sm font-bold text-slate-900">
              {cost} 额度
            </span>
          </div>

          <div className="flex items-center justify-between pt-3">
            <span className="text-sm font-semibold text-slate-700">合计</span>
            <span className="text-lg font-black text-blue-600">
              {cost} 额度
            </span>
          </div>
        </div>

        {/* Wallet balance card */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-100 p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-500">钱包余额</h2>
          </div>

          <div className="text-4xl font-black text-slate-900 tracking-tight mb-3">
            {balance}
            <span className="text-base font-medium text-slate-400 ml-1.5">额度</span>
          </div>

          {/* Sufficient / insufficient badge */}
          {sufficient ? (
            <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 rounded-full px-3 py-1 text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              余额充足
            </div>
          ) : (
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 rounded-full px-3 py-1 text-sm font-medium">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                余额不足
              </div>
              <p className="text-xs text-red-500">
                当前余额不足以完成本次生成，请先充值后再试。
              </p>
            </div>
          )}
        </div>

        {/* Confirm payment button */}
        <Button
          onClick={handleConfirmPay}
          disabled={!sufficient || paying}
          className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-base gap-2 shadow-md shadow-blue-200 active:scale-[0.98] transition-all mb-3"
        >
          {paying ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              处理中...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              确认支付并生成高清图
            </>
          )}
        </Button>

        {/* Insufficient balance hint */}
        {!sufficient && (
          <p className="text-center text-xs text-slate-400 mb-3">
            余额不足，请联系管理员充值后重试
          </p>
        )}

        {/* Back button */}
        <Button
          variant="outline"
          onClick={() => setLocation("/create/result")}
          className="w-full h-11 rounded-2xl gap-1.5 text-slate-600"
        >
          <ArrowLeft className="w-4 h-4" />
          返回查看结果
        </Button>
      </div>
    </div>
  );
}
