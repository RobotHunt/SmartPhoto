import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, Loader2, Sparkles } from "lucide-react";

import { StepIndicator } from "@/components/StepIndicator";
import { sessionAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface PreviewAsset {
  asset_id: string;
  image_url: string;
  role: string;
}

const HIGHLIGHTS = [
  "确认后进入当前版本高清结果页",
  "继续沿用当前会话和已选图片",
  "支持当前版本整组下载",
  "可继续进入详情图链路",
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
            title: "结果确认页加载失败",
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
        title: "已确认当前版本",
        description: "正在进入高清结果页。",
      });
      setLocation("/create/hd-result");
    }, 1200);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <StepIndicator currentStep={5} step5Label="支付确认" />
        <div className="flex min-h-[60vh] flex-col items-center justify-center">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-500" />
          <span className="text-sm text-slate-500">正在加载当前版本结果...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <StepIndicator currentStep={5} step5Label="支付确认" />

      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <button
          onClick={() => setLocation("/create/result")}
          className="text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-slate-900">确认当前版本结果</h1>
      </div>

      <div className="mx-auto max-w-lg px-4 pb-48">
        <div className="mb-4 mt-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-blue-500" />
          <span className="text-sm font-semibold text-slate-800">
            已选择 <span className="text-blue-600">{selectedCount}</span> 张图片
          </span>
          {currentVersion > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
              当前版本 V{currentVersion}
            </span>
          )}
        </div>

        <div className="flex gap-2.5 mb-6">
          {previewImages.map((asset) => (
            <div key={asset.asset_id} className="relative shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-slate-100 shadow-sm">
              <img src={asset.image_url} alt={asset.role} className="w-full h-full object-cover" />
            </div>
          ))}
          {remaining > 0 && (
            <div className="shrink-0 w-24 h-24 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center bg-slate-50">
              <span className="text-xl font-black text-slate-400">+{remaining}</span>
              <span className="text-[10px] text-slate-400 mt-0.5">张图片</span>
            </div>
          )}
        </div>

        <div className="mb-4 rounded-3xl border border-blue-100 bg-blue-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-200">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-900">当前版本结果已准备完成</div>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                确认后将沿用当前版本、当前会话和已选图片，继续进入高清结果页。
              </p>
            </div>
          </div>
        </div>

        <div className="mb-5 rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">当前版本高清结果</span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-600">
              已就绪
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black tracking-tight text-slate-900">确认继续</span>
            <span className="text-sm text-slate-400">进入当前版本高清结果页</span>
          </div>
        </div>

        <button
          onClick={handlePay}
          disabled={paying || selectedCount === 0}
          className="w-full bg-gradient-to-r from-blue-400 to-emerald-500 hover:from-blue-500 hover:to-emerald-600 disabled:opacity-70 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-base transition active:scale-95 mb-6"
          style={{ boxShadow: '0 8px 24px rgba(20,184,166,0.35)' }}
        >
          {paying ? (
            <>
              <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              <span>支付中…</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>确认并继续</span>
            </>
          )}
        </button>

        <div className="space-y-3">
          {HIGHLIGHTS.map((highlight) => (
            <div key={highlight} className="flex items-center gap-2.5">
              <span className="text-blue-500 font-bold text-base shrink-0">✓</span>
              <span className="text-sm text-slate-700">{highlight}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t border-slate-100 px-4 py-3 z-30">
        <p className="text-center text-[10px] text-slate-400">
          确认后将继续使用当前版本结果进入下一步流程。
        </p>
      </div>
    </div>
  );
}
