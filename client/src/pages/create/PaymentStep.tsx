import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
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

function resolveSelectedIds(raw: string | null): string[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
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
  const selectedAssetIds = useMemo(
    () => resolveSelectedIds(sessionStorage.getItem("selected_asset_ids")),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPageData() {
      if (authLoading) return;
      if (!sessionId) {
        toast({
          title: "缺少会话",
          description: "请先返回结果页选择图片。",
          variant: "destructive",
        });
        setLocation("/create/result");
        return;
      }

      setLoading(true);
      try {
        const [walletData, pricingRules, results] = await Promise.all([
          user ? accountAPI.getWallet().catch(() => null) : Promise.resolve(null),
          user ? pricingAPI.getRules().catch(() => []) : Promise.resolve([]),
          sessionAPI.getResults(sessionId, currentVersion || undefined),
        ]);

        if (cancelled) return;

        setWallet(walletData);

        const rules = Array.isArray(pricingRules) ? pricingRules : [];
        const hdRule = rules.find(
          (rule: PricingRule) =>
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
      } catch (error: any) {
        if (!cancelled) {
          toast({
            title: "支付页加载失败",
            description: error?.message || "请稍后重试。",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPageData();
    return () => {
      cancelled = true;
    };
  }, [authLoading, currentVersion, selectedAssetIds, sessionId, setLocation, toast, user]);

  const selectedCount = previewAssets.length;
  const previewImages = previewAssets.slice(0, 3);
  const remaining = Math.max(0, selectedCount - 3);
  const balance = wallet?.credits ?? wallet?.balance ?? 0;
  const sufficient = balance >= cost;

  const handlePay = async () => {
    if (selectedCount === 0 || paying) return;

    setPaying(true);
    try {
      sessionStorage.setItem("hdPaymentSuccess", "true");
      sessionStorage.setItem("hd_unlocked_version", String(currentVersion || 0));
      sessionStorage.setItem("selectedImgCount", String(selectedCount));

      toast({
        title: sufficient ? "已进入高清结果页" : "已进入联调高清流程",
        description: sufficient
          ? "当前按已接入逻辑继续进入高清无水印结果页。"
          : "当前余额不足时，仍按联调阶段逻辑继续验证高清流程。",
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

        <div className="mb-4 text-sm font-semibold text-slate-800">主图高清版 · AI 生成</div>

        <div className="mb-5 flex items-center gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-slate-400 line-through">¥{originalPrice}</span>
            <span className="text-4xl font-black tracking-tight text-slate-900">¥{cost}</span>
          </div>
          <div className="rounded-lg bg-orange-500 px-2.5 py-1.5 text-center leading-snug text-white">
            <div className="text-[11px] font-semibold">高清解锁</div>
            <div className="text-[11px]">基于当前版本</div>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="mb-1 text-sm font-semibold text-slate-800">钱包额度</div>
          <div className="text-2xl font-bold text-slate-900">{balance}</div>
          {!user && (
            <p className="mt-2 text-xs text-slate-500">
              当前未登录，本页仍按当前联调逻辑继续验证高清流程，不阻断页面跳转。
            </p>
          )}
          {user && !sufficient && (
            <p className="mt-2 text-xs text-red-500">
              当前账户额度不足，但这一轮仍按联调阶段逻辑继续放行，便于验证结果页流程。
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            当前主图高清无水印仍按现阶段联调逻辑处理，后续再接入真实支付与高清解锁接口。
          </p>
        </div>

        <button
          onClick={handlePay}
          disabled={selectedCount === 0 || paying}
          className="mb-5 flex h-16 w-full items-center justify-center gap-2 rounded-[24px] bg-gradient-to-r from-blue-500 to-emerald-500 text-xl font-bold text-white shadow-[0_16px_40px_rgba(59,130,246,0.25)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {paying ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
          立即生成高清图 ¥{cost}
        </button>

        <ul className="space-y-4">
          {PERKS.map((perk) => (
            <li key={perk} className="flex items-center gap-3 text-lg text-slate-700">
              <CheckCircle2 className="h-5 w-5 text-blue-500" />
              <span>{perk}</span>
            </li>
          ))}
        </ul>

        <div className="mt-10 text-center text-xs text-slate-400">
          支付即代表同意《用户协议》和《隐私政策》
        </div>
      </div>
    </div>
  );
}
