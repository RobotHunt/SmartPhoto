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
  "确认当前版本结果",
  "进入兼容高清结果页查看",
  "支持整组下载当前版本图片",
  "继续进入详情图流程",
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
  const [continuing, setContinuing] = useState(false);
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

  const handleContinue = async () => {
    if (selectedCount === 0 || continuing) return;

    setContinuing(true);
    try {
      sessionStorage.setItem("hdPaymentSuccess", "true");
      sessionStorage.setItem("hd_unlocked_version", String(currentVersion || 0));
      sessionStorage.setItem("selectedImgCount", String(selectedCount));

      toast({
        title: "已进入结果查看页",
        description: "当前版本结果已准备好，继续前往兼容高清结果页。",
      });

      setLocation("/create/hd-result");
    } finally {
      setContinuing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <StepIndicator currentStep={5} step5Label="结果确认" />
        <div className="flex min-h-[60vh] flex-col items-center justify-center">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-500" />
          <span className="text-sm text-slate-500">正在加载当前版本结果...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <StepIndicator currentStep={5} step5Label="结果确认" />

      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <button
          onClick={() => setLocation("/create/result")}
          className="text-slate-600 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-bold text-slate-900">确认当前版本结果</h1>
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

        <div className="mb-4 rounded-3xl border border-blue-100 bg-blue-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-200">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-900">当前为纯图片 SaaS 联调模式</div>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                本页不再处理支付、额度和账户归档，只保留当前版本结果确认与后续下载入口。
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleContinue}
          disabled={selectedCount === 0 || continuing}
          className="mb-5 flex h-16 w-full items-center justify-center gap-2 rounded-[24px] bg-gradient-to-r from-blue-500 to-emerald-500 text-xl font-bold text-white shadow-[0_16px_40px_rgba(59,130,246,0.25)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {continuing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
          进入当前版本下载页
        </button>

        <ul className="space-y-4">
          {HIGHLIGHTS.map((item) => (
            <li key={item} className="flex items-center gap-3 text-lg text-slate-700">
              <CheckCircle2 className="h-5 w-5 text-blue-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="mt-10 text-center text-xs text-slate-400">
          当前页面仅作为过渡确认页，真实下载与继续创作都基于当前 session 和版本完成。
        </div>
      </div>
    </div>
  );
}
