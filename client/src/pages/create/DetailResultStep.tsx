import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Loader2, Crown, Share2, Pencil, Check,
  X, Sparkles, Download, CloudUpload, Info, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
// [2026-03-18 修复] 原: import { getLoginUrl } from "@/const" — 静态模式下环境变量缺失导致 Invalid URL 崩溃
// import { getLoginUrl } from "@/const";

// ─── 详情图流程步骤指示器（3步，可点击跳转）────────────────────────────────
const DETAIL_STEPS = [
  { id: 1, label: "文案确认", path: "/create/copywriting" },
  { id: 2, label: "详情图确认", path: "/create/detail-confirm" },
  { id: 3, label: "生成详情图", path: "/create/detail-result" },
];

export function DetailStepIndicator({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  const [, setLocation] = useLocation();
  return (
    <div className="bg-white border-b border-slate-100 px-4 py-3">
      <div className="flex items-center justify-center gap-1">
        {DETAIL_STEPS.map((step, index) => {
          const done = step.id < currentStep;
          const active = step.id === currentStep;
          const clickable = done;
          return (
            <div key={step.id} className="flex items-center gap-1">
              <div className="flex flex-col items-center gap-1">
                <div
                  onClick={() => clickable && setLocation(step.path)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    done
                      ? "bg-green-500 text-white cursor-pointer hover:bg-green-600"
                      : active
                      ? "bg-blue-500 text-white"
                      : "bg-slate-200 text-slate-400"
                  }`}
                >
                  {done ? <Check className="w-3.5 h-3.5" /> : step.id}
                </div>
                <span
                  onClick={() => clickable && setLocation(step.path)}
                  className={`text-[10px] font-medium whitespace-nowrap ${
                    active ? "text-blue-600" : done ? "text-green-600 cursor-pointer hover:underline" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < DETAIL_STEPS.length - 1 && (
                <div
                  className={`w-10 h-0.5 mb-4 rounded-full transition-colors ${
                    done ? "bg-green-400" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 模拟详情图数据 ───────────────────────────────────────────────────────────
// [2026-03-18 修复] 原: 6张图片含不存在的4.jpg和重复图片，改为4张不重复的实际示例图
const MOCK_DETAIL_IMAGES = [
  { id: "d1", label: "产品展示", url: "/examples/air-purifier.jpg" },
  { id: "d2", label: "核心卖点", url: "/examples/air-purifier-white.jpg" },
  { id: "d3", label: "功能说明", url: "/examples/2.jpg" },
  { id: "d4", label: "产品细节", url: "/examples/3.jpg" },
  // { id: "d5", label: "使用场景", url: "/examples/4.jpg" },
  // { id: "d6", label: "产品参数", url: "/examples/air-purifier.jpg" },
];

interface DetailImage {
  id: string;
  label: string;
  url: string;
  editOpen: boolean;
  isRegenerating: boolean;
  text: string;
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────
export default function DetailResultStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [phase, setPhase] = useState<"loading" | "done">("loading");
  const [progress, setProgress] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [brandSavedName, setBrandSavedName] = useState("");
  const [brandSuccessOpen, setBrandSuccessOpen] = useState(false);
  const [images, setImages] = useState<DetailImage[]>(
    MOCK_DETAIL_IMAGES.map(img => ({ ...img, editOpen: false, isRegenerating: false, text: img.label }))
  );

  const productType = sessionStorage.getItem("selectedProductType") || "净化器";

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setPhase("done"), 300);
          return 100;
        }
        return prev + 4;
      });
    }, 120);
    return () => clearInterval(interval);
  }, []);

  const toggleEdit = (id: string) => {
    setImages(prev => prev.map(img =>
      img.id === id ? { ...img, editOpen: !img.editOpen } : { ...img, editOpen: false }
    ));
  };

  const updateText = (id: string, value: string) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, text: value } : img));
  };

  const saveText = (id: string) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, editOpen: false } : img));
    toast({ title: "文字已保存" });
  };

  const handleDownloadAll = () => {
    images.forEach((image, index) => {
      const link = document.createElement("a");
      link.href = image.url;
      link.download = `详情图_${index + 1}_${image.label}.jpg`;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
    toast({ title: "开始下载", description: `共 ${images.length} 张详情图已开始下载` });
  };

  const handleSaveBrand = () => {
    if (!brandName.trim()) return;
    const name = brandName.trim();
    setBrandSavedName(name);
    setBrandOpen(false);
    setBrandName("");
    setBrandSuccessOpen(true);
  };

  const handleBrandSuccessClose = () => {
    setBrandSuccessOpen(false);
    const keysToRemove = [
      "uploadSlotPreviews", "uploadedImageUrls", "uploadedCount",
      "uploadedImages", "selectedProductType", "selectedPlatform",
      "selectedTheme", "analysisResult", "productParams",
      "copywritings", "selectedImgCount", "selectedPlans",
      "paymentSuccess", "generatedImages", "hdImages",
      "hdImgCount", "hdFromPreview", "hdPaymentSuccess",
      "detailCopySections", "detailPaymentSuccess",
    ];
    keysToRemove.forEach(k => sessionStorage.removeItem(k));
    setLocation("/");
  };

  const handleGoHome = () => {
    const keysToRemove = [
      "uploadSlotPreviews", "uploadedImageUrls", "uploadedCount",
      "uploadedImages", "selectedProductType", "selectedPlatform",
      "selectedTheme", "analysisResult", "productParams",
      "copywritings", "selectedImgCount", "selectedPlans",
      "paymentSuccess", "generatedImages", "hdImages",
      "hdImgCount", "hdFromPreview", "hdPaymentSuccess",
      "detailCopySections", "detailPaymentSuccess",
    ];
    keysToRemove.forEach(k => sessionStorage.removeItem(k));
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <DetailStepIndicator currentStep={3} />

      {/* 加载阶段 */}
      {phase === "loading" && (
        <div className="flex flex-col items-center justify-center flex-1 px-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">正在生成详情图…</h2>
          <p className="text-sm text-slate-500 mb-5">AI 正在处理，请稍候片刻</p>
          <div className="w-full max-w-xs mb-2">
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-400 to-blue-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <p className="text-sm text-slate-400">{progress}%</p>
        </div>
      )}

      {/* 完成阶段 */}
      {phase === "done" && (
        <div className="flex-1 flex flex-col">
          {/* 成功横幅 */}
          <div className="bg-amber-50 border-b border-amber-100 px-4 py-2.5 flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shrink-0">
              <Crown className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-900">详情图生成成功！</p>
              <p className="text-xs text-amber-600">无水印 · 可直接用于阿里巴巴上架</p>
            </div>
          </div>

          {/* 图片数量 */}
          <div className="px-4 py-2 flex items-center gap-1.5 bg-white border-b">
            <span className="text-sm font-semibold text-slate-700">详情图</span>
            <span className="text-xs text-slate-400">共 {images.length} 张</span>
          </div>

          {/* 图片列表（无水印） */}
          <div className="flex-1 overflow-y-auto pb-36">
            {images.map(img => (
              <div key={img.id} className="bg-white border-b">
                {/* 图片区域 */}
                <div className="relative select-none" onContextMenu={e => e.preventDefault()}>
                  {img.isRegenerating ? (
                    <div className="w-full" style={{ minHeight: "200px", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9" }}>
                      <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                    </div>
                  ) : (
                    <img
                      src={img.url}
                      alt={img.label}
                      // [2026-03-17 修复] 原: className="w-full object-cover ..." style={{ maxHeight: "400px" }} — 图片被裁剪只显示一部分
                      className="w-full object-contain pointer-events-none"
                      draggable={false}
                    />
                  )}
                </div>

                {/* 底部操作行 */}
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-slate-500">{productType} · {img.label}</span>
                  <button
                    onClick={() => toggleEdit(img.id)}
                    className={`flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border transition
                      ${img.editOpen
                        ? "text-blue-700 border-blue-400 bg-blue-100"
                        : "text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
                      }`}
                  >
                    <Pencil className="w-3 h-3" />
                    编辑文字
                  </button>
                </div>

                {/* 编辑文字面板 */}
                {img.editOpen && (
                  <div className="border-t border-slate-100 px-4 pb-4 pt-3 bg-slate-50">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-14 shrink-0">标注文字</span>
                        <input
                          value={img.text}
                          onChange={e => updateText(img.id, e.target.value)}
                          className="flex-1 text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                          placeholder="输入标注文字"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => saveText(img.id)}
                      className="mt-3 w-full flex items-center justify-center gap-1.5 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-xl py-2 font-medium transition"
                    >
                      <Check className="w-4 h-4" />
                      保存文字
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 底部固定操作栏 */}
          <div className="fixed bottom-0 left-0 right-0 z-30">
            {/* 登录提示 */}
            <div className="bg-white border-t border-slate-100 px-4 py-2 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                <CloudUpload className="w-4 h-4 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800">登录账号，自动保存你的设计资产</p>
                <p className="text-xs text-slate-400">避免图片丢失</p>
              </div>
              {/* [2026-03-19 修复] 原: <a href="/auth"> — a标签会触发页面刷新，改为 button + setLocation */}
              <button
                onClick={() => setLocation("/auth")}
                className="shrink-0 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
              >
                登录 / 注册
              </button>
            </div>
            {/* 操作按钮 */}
            <div className="bg-white border-t border-slate-100 shadow-lg px-4 py-2.5 flex gap-2">
              <Button size="lg" variant="outline" className="flex-1 text-slate-600 gap-1.5 border-slate-200" onClick={handleDownloadAll}>
                <Download className="w-4 h-4" />
                一键下载
              </Button>
              <Button size="lg" variant="ghost" className="px-3 text-slate-500" onClick={() => setShareOpen(true)}>
                <Share2 className="w-4 h-4" />
              </Button>
              <Button size="lg" className="flex-1 bg-blue-500 hover:bg-blue-600 text-white gap-1.5" onClick={() => setBrandOpen(true)}>
                记住品牌风格
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 保存品牌风格弹窗 */}
      {brandOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setBrandOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-t-2xl w-full max-w-sm pb-8 pt-5 px-5 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            {/* 关闭按钮 */}
            <button
              onClick={() => setBrandOpen(false)}
              className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>

            {/* 标题 */}
            <h3 className="text-lg font-bold text-slate-900 mb-1">保存品牌/店铺风格?</h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              模型可以记录你生成过的品牌风格偏好，以后生成该品牌图片时，选择品牌会将相应可自动应用一致风格。
            </p>

            {/* 品牌名称输入 */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">品牌 / 店铺名称</label>
              <input
                type="text"
                value={brandName}
                onChange={e => setBrandName(e.target.value)}
                placeholder="例如：NaoNao宠物、小米官方旗舰店"
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder:text-slate-300"
              />
            </div>

            {/* 保存品牌风格卡片 */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-4 mb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-sm font-semibold text-blue-900">保存品牌风格</span>
                <Info className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-3">
                模型可以记录你生成过的品牌风格。以后生成的同品牌图片时，选择品牌即可自动生成一致风格。
              </p>
              <ul className="space-y-1.5">
                {["产品实拍", "全套展示", "渲染图", "详情页注版"].map(item => (
                  <li key={item} className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* 确认按钮 */}
            <button
              onClick={handleSaveBrand}
              disabled={!brandName.trim()}
              className={`w-full h-11 rounded-2xl font-semibold text-sm transition-colors ${
                brandName.trim()
                  ? "bg-blue-500 hover:bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-300 cursor-not-allowed"
              }`}
            >
              保存品牌风格
            </button>
          </div>
        </div>
      )}

      {/* 品牌风格保存成功弹窗 */}
      {brandSuccessOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-3xl w-full max-w-sm px-6 py-8 shadow-2xl flex flex-col items-center text-center">
            {/* 成功图标 */}
            <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-green-200">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            {/* 标题 */}
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              已为您记住「{brandSavedName}」品牌风格
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              下次生成该品牌图片时，选择「{brandSavedName}」将自动应用一致风格，无需重复设置。
            </p>
            <button
              onClick={handleBrandSuccessClose}
              className="w-full h-11 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-semibold text-sm transition-colors"
            >
              好的，返回主页
            </button>
          </div>
        </div>
      )}

      {/* 分享弹窗 */}
      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShareOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-t-2xl w-full max-w-sm pb-8 pt-5 px-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">选择分享方式</h3>
              <button onClick={() => setShareOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <button
              className="w-full h-11 rounded-full bg-blue-500 hover:bg-blue-600 text-white font-semibold text-sm transition-colors"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href).catch(() => {});
                toast({ title: "已复制链接" });
                setShareOpen(false);
              }}
            >
              复制链接
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
