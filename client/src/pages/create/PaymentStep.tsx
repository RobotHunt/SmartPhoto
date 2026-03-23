import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import {
  ArrowLeft, CheckCircle2, Sparkles, Loader2,
} from "lucide-react";
import { StepIndicator } from "@/components/StepIndicator";
import { accountAPI, pricingAPI, sessionAPI } from "@/lib/api";
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

// ── Perks list ───────────────────────────────────────────────────────────────

const PERKS = [
  "无水印高清图",
  "电商主图尺寸",
  "可直接上架",
  "永久保存",
];

// ── Component ────────────────────────────────────────────────────────────────

export default function PaymentStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Loading & action states
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  // API data
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [cost, setCost] = useState<number>(69);
  const [originalPrice] = useState<number>(99);

  // Image thumbnails loaded from session results
  const [thumbnails, setThumbnails] = useState<string[]>([]);

  // Read selectedImgCount from sessionStorage (set by ResultStep)
  const selectedCount = (() => {
    // Try selected_asset_ids first (set by ResultStep when navigating here)
    try {
      const ids = sessionStorage.getItem("selected_asset_ids");
      if (ids) {
        const parsed = JSON.parse(ids);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.length;
      }
    } catch { /* ignore */ }
    // Fallback to hdImgCount
    const hd = sessionStorage.getItem("hdImgCount");
    if (hd) return parseInt(hd, 10) || 0;
    return 0;
  })();

  const PREVIEW_MAX = 3;
  const previewImages = thumbnails.slice(0, PREVIEW_MAX);
  const remaining = Math.max(0, selectedCount - PREVIEW_MAX);

  // ── Fetch wallet + pricing + thumbnails on mount ───────────────────────────

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch wallet and pricing in parallel
        const [walletData, pricingData] = await Promise.all([
          accountAPI.getWallet(),
          pricingAPI.getRules(),
        ]);

        if (cancelled) return;

        // Wallet
        setWallet(walletData);

        // Find generate_gallery / hd pricing rule
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
            r.name?.includes("生成"),
        );

        if (galleryRule) {
          const rulePrice = galleryRule.credits ?? galleryRule.price ?? galleryRule.unit_price;
          if (rulePrice !== undefined && rulePrice > 0) {
            setCost(rulePrice);
          }
        }

        // Load thumbnails from session results
        const sessionId = sessionStorage.getItem("current_session_id");
        if (sessionId) {
          try {
            const data = await sessionAPI.getResults(sessionId);
            const rawAssets: any[] =
              data?.assets ?? data?.images ?? data?.results ?? (Array.isArray(data) ? data : []);

            // If we have selected_asset_ids, filter to only those
            let selectedIds: string[] | null = null;
            try {
              const idsStr = sessionStorage.getItem("selected_asset_ids");
              if (idsStr) selectedIds = JSON.parse(idsStr);
            } catch { /* ignore */ }

            let relevantAssets = rawAssets;
            if (selectedIds && selectedIds.length > 0) {
              const idSet = new Set(selectedIds);
              relevantAssets = rawAssets.filter(
                (a: any) => idSet.has(a.asset_id ?? a.id),
              );
              // Fallback to all if filter returns nothing
              if (relevantAssets.length === 0) relevantAssets = rawAssets;
            }

            const urls = relevantAssets
              .map((a: any) => a.image_url ?? a.url ?? "")
              .filter(Boolean);
            if (!cancelled) setThumbnails(urls);
          } catch {
            // thumbnails are nice-to-have, not critical
          }
        }
      } catch (err: any) {
        console.error("获取价格/钱包信息失败:", err);
        if (!cancelled) {
          toast({
            title: "加载失败",
            description: "无法获取额度信息，请刷新重试",
            variant: "destructive",
          });
        }
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

  const handlePay = async () => {
    if (!sufficient) {
      toast({
        title: "余额不足",
        description: `当前余额 ${balance} 额度，需要 ${cost} 额度，请先充值。`,
        variant: "destructive",
      });
      return;
    }

    setPaying(true);
    try {
      // Mark payment success so downstream pages know
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
      <div className="min-h-screen bg-white">
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
    <div className="min-h-screen bg-white">
      <StepIndicator currentStep={5} step5Label="确认支付" />

      {/* 顶部导航 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
        <button
          onClick={() => setLocation("/create/result")}
          className="text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-slate-900">生成无水印高清图</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-48">

        {/* 已选图片数量 */}
        <div className="flex items-center gap-2 mt-4 mb-4">
          <CheckCircle2 className="w-5 h-5 text-blue-500" />
          <span className="text-sm font-semibold text-slate-800">
            已选择 <span className="text-blue-600">{selectedCount}</span> 张图片
          </span>
        </div>

        {/* 图片缩略图预览 */}
        <div className="flex gap-2.5 mb-6">
          {previewImages.map((src, i) => (
            <div key={i} className="relative shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-slate-100 shadow-sm">
              <img src={src} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
          {remaining > 0 && (
            <div className="shrink-0 w-24 h-24 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center bg-slate-50">
              <span className="text-xl font-black text-slate-400">+{remaining}</span>
              <span className="text-[10px] text-slate-400 mt-0.5">张图片</span>
            </div>
          )}
        </div>

        {/* 套餐名称 + AI生成 label */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-slate-800">无水印高清图 · AI生成</span>
        </div>

        {/* 价格区域 */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-slate-400 line-through">¥{originalPrice}/套</span>
            <span className="text-4xl font-black text-slate-900 tracking-tight">¥{cost}</span>
          </div>
          <div className="bg-orange-500 text-white rounded-lg px-2.5 py-1.5 leading-snug text-center">
            <div className="text-[11px] font-semibold">新用户首套</div>
            <div className="text-[11px]">后续续费<span className="font-black"> {originalPrice}</span></div>
          </div>
        </div>

        {/* 余额不足警告 */}
        {!sufficient && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4">
            <p className="text-sm text-red-600 font-medium">
              余额不足：当前 {balance} 额度，需要 {cost} 额度
            </p>
            <p className="text-xs text-red-400 mt-1">
              请联系管理员充值后重试
            </p>
          </div>
        )}

        {/* 支付按钮 */}
        <button
          onClick={handlePay}
          disabled={paying || !sufficient}
          className="w-full bg-gradient-to-r from-blue-400 to-emerald-500 hover:from-blue-500 hover:to-emerald-600 disabled:opacity-70 disabled:from-slate-300 disabled:to-slate-400 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-base transition active:scale-95 mb-6"
          style={{ boxShadow: sufficient ? "0 8px 24px rgba(20,184,166,0.35)" : "none" }}
        >
          {paying ? (
            <>
              <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              <span>支付中…</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>立即生成高清图 ¥{cost}</span>
            </>
          )}
        </button>

        {/* 权益列表 */}
        <div className="space-y-3">
          {PERKS.map((perk) => (
            <div key={perk} className="flex items-center gap-2.5">
              <span className="text-blue-500 font-bold text-base shrink-0">✓</span>
              <span className="text-sm text-slate-700">{perk}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 底部协议文字 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t border-slate-100 px-4 py-3 z-30">
        <p className="text-center text-[10px] text-slate-400">
          支付即代表同意
          <Link href="/terms" className="text-blue-500 hover:text-blue-600 hover:underline mx-0.5">《用户协议》</Link>
          和
          <Link href="/privacy" className="text-blue-500 hover:text-blue-600 hover:underline mx-0.5">《隐私政策》</Link>
        </p>
      </div>
    </div>
  );
}
