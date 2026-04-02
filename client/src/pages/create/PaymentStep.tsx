import { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import { ArrowLeft, CheckCircle2, Loader2, Sparkles } from "lucide-react";

import { StepIndicator } from "@/components/StepIndicator";
import { sessionAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface PreviewAsset {
  asset_id: string;
  image_url: string;
  role: string;
}

const PERKS = [
  "无水印高清图",
  "电商主图尺寸",
  "可直接亚马逊 / 天猫上架",
  "永久保存",
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

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
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
        const results = await sessionAPI.getResults(sessionId, currentVersion || undefined);

        if (cancelled) return;

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
  }, [currentVersion, selectedAssetIds, sessionId, setLocation, toast]);

  const selectedCount = previewAssets.length;
  const previewImages = previewAssets.slice(0, 3);
  const remaining = Math.max(0, selectedCount - 3);

  const handlePay = () => {
    if (selectedCount === 0 || paying) return;
    setPaying(true);
    setTimeout(() => {
      setPaying(false);
      sessionStorage.setItem("hdPaymentSuccess", "true");
      sessionStorage.setItem("hd_unlocked_version", String(currentVersion || 0));
      sessionStorage.setItem("selectedImgCount", String(selectedCount));
      toast({
        title: "支付成功",
        description: "正在生成高清图。",
      });
      setLocation("/create/hd-result");
    }, 1200);
  };

  if (loading) {
    return (
      <div className="min-h-screen aurora-bg">
        <StepIndicator currentStep={5} step5Label="支付确认" />
        <div className="flex flex-col items-center justify-center max-w-sm mx-auto mt-32 glass-panel p-10 rounded-[32px] border border-white/10 shadow-2xl">
          <Loader2 className="mb-4 h-10 w-10 animate-spin text-cyan-400" />
          <span className="text-sm font-medium tracking-widest text-cyan-100">正在加载支付信息...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen aurora-bg pb-24">
      <StepIndicator currentStep={5} />

      <div className="max-w-lg mx-auto mt-8 sm:mt-12 px-4 relative z-10">
        <div className="glass-panel border-white/10 rounded-[32px] overflow-hidden shadow-[0_0_50px_rgba(34,211,238,0.15)] flex flex-col">
          {/* 顶部导航 */}
          <div className="flex items-center gap-3 px-6 py-5 bg-white/5 border-b border-white/10">
            <button
              onClick={() => setLocation("/create/result")}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-black/40 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-lg font-bold tracking-widest text-slate-100">生成无水印高清图</h1>
          </div>

          <div className="p-6 sm:p-8">
            {/* 已选图片数量 */}
            <div className="flex items-center gap-2 mb-6 bg-black/40 border border-cyan-500/20 px-4 py-2 rounded-xl inline-flex shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-bold tracking-widest text-cyan-100">
                已选择 <span className="text-cyan-400 px-1">{selectedCount}</span> 张图片
              </span>
            </div>

            {/* 图片缩略图预览 */}
            <div className="flex gap-3 mb-8">
              {previewImages.map((asset) => (
                <div key={asset.asset_id} className="relative shrink-0 w-24 h-24 rounded-2xl overflow-hidden border border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                  <img src={asset.image_url} alt={asset.role} className="w-full h-full object-cover" />
                </div>
              ))}
              {remaining > 0 && (
                <div className="shrink-0 w-24 h-24 rounded-2xl border border-white/10 bg-black/40 flex flex-col items-center justify-center shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
                  <span className="text-xl font-black text-slate-300">+{remaining}</span>
                  <span className="text-[10px] tracking-widest font-bold text-slate-500 mt-1">张图片</span>
                </div>
              )}
            </div>

            {/* 套餐名称 */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold tracking-widest text-slate-300 flex items-center gap-2">
                <div className="w-1.5 h-4 bg-cyan-500 rounded-full"></div>
                天猫主图 · AI生成
              </span>
            </div>

            {/* 价格区域 */}
            <div className="flex flex-wrap items-center gap-4 mb-8 bg-black/30 border border-white/5 p-4 rounded-2xl">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold tracking-widest text-slate-500 line-through">¥99/套</span>
                <span className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-cyan-300 to-blue-500 drop-shadow-sm">¥69</span>
              </div>
              <div className="bg-gradient-to-r from-amber-600 to-orange-500 text-white rounded-xl px-3 py-1.5 shadow-[0_0_15px_rgba(249,115,22,0.3)]">
                <div className="text-xs font-bold tracking-widest leading-none mb-1 shadow-sm">新用户首套</div>
                <div className="text-[10px] font-medium tracking-wide opacity-90 leading-none">后续续订 <span className="font-black tracking-tighter">¥99</span></div>
              </div>
            </div>

            {/* 权益列表 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {PERKS.map(perk => (
                <div key={perk} className="flex items-center gap-2">
                  <div className="w-5 h-5 flex items-center justify-center rounded-full bg-cyan-900/40 border border-cyan-500/30 shrink-0">
                    <span className="text-cyan-400 font-bold text-[10px]">✓</span>
                  </div>
                  <span className="text-xs font-bold tracking-widest text-slate-300">{perk}</span>
                </div>
              ))}
            </div>

            {/* 支付按钮 */}
            <button
              onClick={handlePay}
              disabled={paying || selectedCount === 0}
              className="sci-fi-button w-full h-14 rounded-2xl flex items-center justify-center gap-2 text-base font-bold tracking-widest transition active:scale-95 disabled:opacity-50"
            >
              {paying ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>处理支付请求…</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>立即生成高清图 ¥69</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 底部协议文字 */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#050914]/80 backdrop-blur-xl border-t border-white/5 py-4 z-30">
        <p className="text-center text-[11px] tracking-widest text-slate-500 font-bold">
          支付即代表同意
          <Link href="/terms" className="text-cyan-500 hover:text-cyan-400 hover:underline mx-1">《用户协议》</Link>
          和
          <Link href="/privacy" className="text-cyan-500 hover:text-cyan-400 hover:underline mx-1">《隐私政策》</Link>
        </p>
      </div>
    </div>
  );
}
