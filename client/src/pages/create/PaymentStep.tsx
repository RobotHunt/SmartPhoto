import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { StepIndicator } from "@/components/StepIndicator";
import { accountAPI, pricingAPI, sessionAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface PricingRule {
  action?: string;
  type?: string;
  name?: string;
  credits?: number;
  price?: number;
  unit_price?: number;
}

interface WalletData {
  balance?: number;
  credits?: number;
}

interface PreviewAsset {
  asset_id: string;
  image_url: string;
  role: string;
}

const PERKS = [
  "解锁当前版本高清图",
  "当前结果无水印查看",
  "支持整组下载",
  "可继续进入详情图流程",
];

function resolveSelectedIds(raw: string | null) {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function PaymentStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [cost, setCost] = useState(69);
  const [originalPrice, setOriginalPrice] = useState(99);
  const [previewAssets, setPreviewAssets] = useState<PreviewAsset[]>([]);

  const sessionId = sessionStorage.getItem("current_session_id") || "";
  const currentVersion = Number(sessionStorage.getItem("current_result_version") || "0");
  const selectedAssetIdsRaw = sessionStorage.getItem("selected_asset_ids");
  const selectedAssetIds = useMemo(
    () => resolveSelectedIds(selectedAssetIdsRaw),
    [selectedAssetIdsRaw],
  );

  useEffect(() => {
    let cancelled = false;

    const loadPageData = async () => {
      if (authLoading) return;
      if (!user) {
        setLoading(false);
        return;
      }
      if (!sessionId) {
        toast({
          title: "缺少会话",
          description: "请先返回生成结果页选择图片",
          variant: "destructive",
        });
        setLocation("/create/result");
        return;
      }

      setLoading(true);
      try {
        const [walletData, pricingRules, results] = await Promise.all([
          accountAPI.getWallet().catch(() => null),
          pricingAPI.getRules().catch(() => []),
          sessionAPI.getResults(sessionId, currentVersion || undefined),
        ]);

        if (cancelled) return;

        setWallet(walletData);

        const rules = Array.isArray(pricingRules) ? pricingRules : [];
        const hdRule = rules.find((rule: PricingRule) =>
          ["generate_gallery", "generate_hd", "unlock_hd"].includes(rule.action || "") ||
          ["generate_gallery", "hd_generation", "unlock_hd"].includes(rule.type || "") ||
          /高清|无水印|主图/.test(rule.name || ""),
        );

        if (hdRule) {
          const nextCost = hdRule.credits ?? hdRule.price ?? hdRule.unit_price;
          if (typeof nextCost === "number" && nextCost > 0) {
            setCost(nextCost);
          }

          const nextOriginalPrice = hdRule.price ?? hdRule.unit_price;
          if (typeof nextOriginalPrice === "number" && nextOriginalPrice > 0) {
            setOriginalPrice(nextOriginalPrice);
          }
        }

        const filteredAssets =
          selectedAssetIds.length > 0
            ? results.assets.filter((asset) => selectedAssetIds.includes(asset.asset_id))
            : results.assets;

        setPreviewAssets(
          filteredAssets.map((asset) => ({
            asset_id: asset.asset_id,
            image_url: asset.image_url,
            role: asset.role,
          })),
        );
      } catch (err: any) {
        if (!cancelled) {
          toast({
            title: "支付页加载失败",
            description: err.message || "请返回结果页后重试",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPageData();
    return () => {
      cancelled = true;
    };
  }, [authLoading, currentVersion, selectedAssetIdsRaw, sessionId, setLocation, toast, user]);

  const selectedCount = previewAssets.length;
  const previewImages = previewAssets.slice(0, 3);
  const remaining = Math.max(0, selectedCount - 3);
  const balance = wallet?.credits ?? wallet?.balance ?? 0;
  const sufficient = balance >= cost;
  const priceText = useMemo(() => `￥${cost}`, [cost]);
  const originalPriceText = useMemo(() => `￥${originalPrice}`, [originalPrice]);

  const handlePay = async () => {
    if (selectedCount === 0) return;

    setPaying(true);
    try {
      sessionStorage.setItem("hdPaymentSuccess", "true");
      sessionStorage.setItem("hd_unlocked_version", String(currentVersion || 0));
      sessionStorage.setItem("selectedImgCount", String(selectedCount));

      toast({
        title: sufficient ? "支付成功" : "已进入高清测试流程",
        description: sufficient
          ? "正在进入高清无水印结果页"
          : "当前主图高清仍为前端模拟流程，已直接进入高清结果页",
      });

      setLocation("/create/hd-result");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <StepIndicator currentStep={5} step5Label="确认支付" />
        <div className="flex min-h-[60vh] flex-col items-center justify-center">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-500" />
          <span className="text-sm text-slate-500">正在加载支付信息...</span>
        </div>
      </div>
    );
  }

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-white">
        <StepIndicator currentStep={5} step5Label="确认支付" />
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
          <div className="mb-3 text-lg font-bold text-slate-900">请先登录后继续支付</div>
          <p className="mb-6 max-w-sm text-sm text-slate-500">
            当前前端已将登录门禁后移到高清支付前。登录成功后会回到结果页，你可以继续点击“生成无水印高清图”进入支付。
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/create/result")}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              返回结果页
            </button>
            <button
              onClick={() => setLocation(`/login?redirect=${encodeURIComponent("/create/result")}`)}
              className="rounded-xl bg-blue-500 px-5 py-2.5 text-sm text-white transition hover:bg-blue-600"
            >
              登录 / 注册
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <StepIndicator currentStep={5} step5Label="确认支付" />

      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <button
          onClick={() => setLocation("/create/result")}
          className="text-slate-600 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-bold text-slate-900">生成无水印高清图</h1>
      </div>

      <div className="mx-auto max-w-lg px-4 pb-48">
        <div className="mb-4 mt-4 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-blue-500" />
          <span className="text-sm font-semibold text-slate-800">
            已选择 <span className="text-blue-600">{selectedCount}</span> 张图片
          </span>
          {currentVersion > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
              当前版本 V{currentVersion}
            </span>
          )}
        </div>

        <div className="mb-6 flex gap-2.5">
          {previewImages.map((asset) => (
            <div
              key={asset.asset_id}
              className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-100 shadow-sm"
            >
              <img src={asset.image_url} alt={asset.role} className="h-full w-full object-cover" />
            </div>
          ))}
          {remaining > 0 && (
            <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
              <span className="text-xl font-black text-slate-400">+{remaining}</span>
              <span className="mt-0.5 text-[10px] text-slate-400">张图片</span>
            </div>
          )}
        </div>

        <div className="mb-5 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-800">天猫主图 · AI生成</span>
        </div>

        <div className="mb-5 flex items-center gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-slate-400 line-through">{originalPriceText}</span>
            <span className="text-4xl font-black tracking-tight text-slate-900">{priceText}</span>
          </div>
          <div className="rounded-lg bg-orange-500 px-2.5 py-1.5 text-center leading-snug text-white">
            <div className="text-[11px] font-semibold">高清解锁</div>
            <div className="text-[11px]">基于当前版本</div>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="mb-1 text-sm font-semibold text-slate-800">钱包额度</div>
          <div className="text-2xl font-bold text-slate-900">{balance}</div>
          {!sufficient && (
            <p className="mt-2 text-xs text-red-500">
              当前余额不足，但这一轮仍按前端假流程放行，方便继续联调页面。
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            当前主图高清无水印仍是前端模拟流程，后续会替换成真实后端订单与交付能力。
          </p>
        </div>

        <button
          onClick={handlePay}
          disabled={paying || selectedCount === 0}
          className="mb-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-400 to-emerald-500 py-4 text-base font-bold text-white transition active:scale-95 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-400"
          style={{ boxShadow: "0 8px 24px rgba(20,184,166,0.35)" }}
        >
          {paying ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>支付中...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              <span>立即生成高清图 {priceText}</span>
            </>
          )}
        </button>

        <div className="space-y-3">
          {PERKS.map((perk) => (
            <div key={perk} className="flex items-center gap-2.5">
              <span className="shrink-0 text-base font-bold text-blue-500">✓</span>
              <span className="text-sm text-slate-700">{perk}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-100 bg-white/80 px-4 py-3 backdrop-blur-sm">
        <p className="text-center text-[10px] text-slate-400">
          支付即代表同意
          <Link href="/terms" className="mx-0.5 text-blue-500 hover:text-blue-600 hover:underline">
            《用户协议》
          </Link>
          和
          <Link href="/privacy" className="mx-0.5 text-blue-500 hover:text-blue-600 hover:underline">
            《隐私政策》
          </Link>
        </p>
      </div>
    </div>
  );
}
