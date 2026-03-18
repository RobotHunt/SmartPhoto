// [2026-03-18 新增] 详情图支付页面，参考 PaymentStep/HDPaymentStep 结构
import { useState } from "react";
import { useLocation, Link } from "wouter";
import {
  CheckCircle2, ArrowLeft, Sparkles
} from "lucide-react";
import { DetailStepIndicator } from "./DetailResultStep";

const ALL_IMAGES = [
  "/examples/air-purifier.jpg",
  "/examples/air-purifier-white.jpg",
  "/examples/2.jpg",
  "/examples/3.jpg",
];

const PERKS = [
  "无水印高清详情图",
  "电商详情页尺寸",
  "可直接用于商品详情页上架",
  "永久保存",
];

export default function DetailPaymentStep() {
  const [, setLocation] = useLocation();
  const [paying, setPaying] = useState(false);

  const imgCount = parseInt(sessionStorage.getItem("detailImgCount") || "4");
  const PREVIEW_MAX = 3;
  const previewImages = ALL_IMAGES.slice(0, PREVIEW_MAX);
  const remaining = Math.max(0, imgCount - PREVIEW_MAX);

  const handlePay = () => {
    setPaying(true);
    setTimeout(() => {
      setPaying(false);
      sessionStorage.setItem("detailPaymentSuccess", "true");
      setLocation("/create/detail-result");
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-white">
      <DetailStepIndicator currentStep={2} />

      {/* 顶部导航 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
        <button
          onClick={() => setLocation("/create/detail-confirm")}
          className="text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-slate-900">生成无水印高清详情图</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-48">

        {/* 已选图片数量 */}
        <div className="flex items-center gap-2 mt-4 mb-4">
          <CheckCircle2 className="w-5 h-5 text-blue-500" />
          <span className="text-sm font-semibold text-slate-800">
            共 <span className="text-blue-600">{imgCount}</span> 张详情图
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

        {/* 套餐名称 */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-slate-800">详情图 · AI生成</span>
        </div>

        {/* 价格区域 */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-slate-400 line-through">¥129/套</span>
            <span className="text-4xl font-black text-slate-900 tracking-tight">¥89</span>
          </div>
          <div className="bg-orange-500 text-white rounded-lg px-2.5 py-1.5 leading-snug text-center">
            <div className="text-[11px] font-semibold">新用户首套</div>
            <div className="text-[11px]">后续续费<span className="font-black"> 129</span></div>
          </div>
        </div>

        {/* 支付按钮 */}
        <button
          onClick={handlePay}
          disabled={paying}
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
              <span>立即生成高清详情图 ¥89</span>
            </>
          )}
        </button>

        {/* 权益列表 */}
        <div className="space-y-3">
          {PERKS.map(perk => (
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
          <span>支付即代表同意</span>
          <Link href="/terms" className="text-blue-500 hover:text-blue-600 hover:underline mx-0.5">《用户协议》</Link>
          <span>和</span>
          <Link href="/privacy" className="text-blue-500 hover:text-blue-600 hover:underline mx-0.5">《隐私政策》</Link>
        </p>
      </div>
    </div>
  );
}
