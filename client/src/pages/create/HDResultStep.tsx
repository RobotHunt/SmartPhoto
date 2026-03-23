import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Loader2, Crown, FileText, Share2, Pencil, Check,
  CloudUpload, X, RefreshCw, Sparkles, CheckCircle2, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepIndicator } from "@/components/StepIndicator";
import { useToast } from "@/hooks/use-toast";

interface TextFields {
  title: string;
  subtitle: string;
  footer: string;
}

interface PreviewImage {
  id: string;
  type: string;
  platform: string;
  product: string;
  url: string;
  editOpen: boolean;
  isRegenerating: boolean;
  texts: TextFields;
}

const DEFAULT_TEXTS: TextFields = {
  title: "为宠物家庭专研的空气净化机",
  subtitle: "吸毛/除臭/净化",
  footer: "250CADR净化器 符合亚马逊尺寸",
};

// ─── 阶段一：带水印预览选图 ───────────────────────────────────────────────────
function PreviewSelectStep({
  images,
  onToggleEdit,
  onUpdateText,
  onSaveText,
  onRegenerate,
  onRegenerateAll,
  onConfirm,
}: {
  images: PreviewImage[];
  onToggleEdit: (id: string) => void;
  onUpdateText: (id: string, field: keyof TextFields, value: string) => void;
  onSaveText: (id: string) => void;
  onRegenerate: (id: string) => void;
  onRegenerateAll: () => void;
  onConfirm: () => void;
}) {

  return (
    <div className="flex-1 flex flex-col">
      {/* 顶部状态栏 */}
      <div className="bg-white border-b px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-slate-800">已生成 {images.length} 张图片</span>
        </div>
        <button
          onClick={onRegenerateAll}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-full px-2.5 py-1 transition"
        >
          <RefreshCw className="w-3 h-3" />
          重新生成
        </button>
      </div>
      <p className="px-4 py-1.5 text-xs text-slate-400 bg-white border-b">预览图含水印，付费后生成高清清图</p>

      {/* 图片列表 */}
      <div className="flex-1 overflow-y-auto pb-28">
        {images.map((image) => (
          <div key={image.id} className="bg-white border-b">

            {/* 图片区域 */}
            <div
              className="relative select-none"
              onContextMenu={e => e.preventDefault()}
            >
              {image.isRegenerating && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
              <img
                src={image.url}
                alt={image.type}
                className="w-full object-cover pointer-events-none"
                draggable={false}
                style={{ maxHeight: "400px" }}
              />
              {/* 水印层 */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div
                  className="text-white/25 font-bold text-xl select-none"
                  style={{
                    transform: "rotate(-30deg)",
                    textShadow: "0 1px 4px rgba(0,0,0,0.4)",
                    letterSpacing: "0.08em",
                    whiteSpace: "nowrap",
                  }}
                >
                  AI电商做图 · 预览版
                </div>
              </div>

            </div>

            {/* 底部操作行 */}
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-sm text-slate-500">{image.product} · {image.type}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onToggleEdit(image.id)}
                  className={`flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border transition
                    ${image.editOpen
                      ? "text-blue-700 border-blue-400 bg-blue-100"
                      : "text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
                    }`}
                >
                  <Pencil className="w-3 h-3" />
                  编辑文字
                </button>
                <button
                  onClick={() => onRegenerate(image.id)}
                  className="flex items-center gap-1 text-xs text-slate-500 border border-slate-200 rounded-full px-2.5 py-1 hover:bg-slate-50 transition"
                >
                  <RefreshCw className="w-3 h-3" />
                  重新生成
                </button>
              </div>
            </div>

            {/* 编辑文字面板 */}
            {image.editOpen && (
              <div className="border-t border-slate-100 px-4 pb-4 pt-3 bg-slate-50">
                <div className="space-y-2">
                  {([
                    { field: "title" as keyof TextFields, label: "主标题" },
                    { field: "subtitle" as keyof TextFields, label: "副标题" },
                    { field: "footer" as keyof TextFields, label: "底部文字" },
                  ]).map(({ field, label }) => (
                    <div key={field} className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-14 shrink-0">{label}</span>
                      <input
                        value={image.texts[field]}
                        onChange={e => onUpdateText(image.id, field, e.target.value)}
                        className="flex-1 text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => onSaveText(image.id)}
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
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t shadow-lg px-4 py-3">
        <button
          onClick={onConfirm}
          className="w-full h-12 rounded-2xl flex items-center justify-center gap-2 text-base font-bold bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-200 transition"
        >
          <Sparkles className="w-5 h-5" />
          生成无水印高清图
        </button>
        <p className="text-center text-xs text-slate-400 mt-1.5">共 {images.length} 张，确认后全部生成</p>
      </div>
    </div>
  );
}

// ─── 阶段二：高清无水印结果 ───────────────────────────────────────────────────
function HDDoneStep({
  images,
  onToggleEdit,
  onUpdateText,
  onSaveText,
  onGoDetail,
  onShare,
  onDownloadAll,
}: {
  images: PreviewImage[];
  onToggleEdit: (id: string) => void;
  onUpdateText: (id: string, field: keyof TextFields, value: string) => void;
  onSaveText: (id: string) => void;
  onGoDetail: () => void;
  onShare: () => void;
  onDownloadAll: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col">
      {/* 成功横幅 */}
      <div className="bg-amber-50 border-b border-amber-100 px-4 py-2.5 flex items-center gap-2.5">
        <div className="w-7 h-7 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shrink-0">
          <Crown className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-amber-900">高清图生成成功！</p>
          <p className="text-xs text-amber-600">无水印 · 可直接用于电商上架</p>
        </div>
      </div>

      {/* 图片数量 */}
      <div className="px-4 py-2 flex items-center gap-1.5 bg-white border-b">
        <span className="text-sm font-semibold text-slate-700">高清图</span>
        <span className="text-xs text-slate-400">共 {images.length} 张</span>
      </div>

      {/* 图片列表（无水印） */}
      <div className="flex-1 overflow-y-auto pb-36">
        {images.map((image) => (
          <div key={image.id} className="bg-white border-b">
            <div className="relative select-none" onContextMenu={e => e.preventDefault()}>
              <img
                src={image.url}
                alt={image.type}
                className="w-full object-cover pointer-events-none"
                draggable={false}
                style={{ maxHeight: "400px" }}
              />
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-slate-500">{image.product} · {image.type}</span>
              <button
                onClick={() => onToggleEdit(image.id)}
                className={`flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border transition
                  ${image.editOpen
                    ? "text-blue-700 border-blue-400 bg-blue-100"
                    : "text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
                  }`}
              >
                <Pencil className="w-3 h-3" />
                编辑文字
              </button>
            </div>
            {image.editOpen && (
              <div className="border-t border-slate-100 px-4 pb-4 pt-3 bg-slate-50">
                <div className="space-y-2">
                  {([
                    { field: "title" as keyof TextFields, label: "主标题" },
                    { field: "subtitle" as keyof TextFields, label: "副标题" },
                    { field: "footer" as keyof TextFields, label: "底部文字" },
                  ]).map(({ field, label }) => (
                    <div key={field} className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-14 shrink-0">{label}</span>
                      <input
                        value={image.texts[field]}
                        onChange={e => onUpdateText(image.id, field, e.target.value)}
                        className="flex-1 text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => onSaveText(image.id)}
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
        <div className="bg-white border-t border-slate-100 px-4 py-2 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <CloudUpload className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-800">登录账号，自动保存你的设计资产</p>
            <p className="text-xs text-slate-400">避免图片丢失</p>
          </div>
          <a
            href="/login"
            className="shrink-0 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
          >
            登录 / 注册
          </a>
        </div>
        <div className="bg-white border-t border-slate-100 shadow-lg px-4 py-2.5 flex gap-2">
          <Button size="lg" variant="outline" className="flex-1 text-slate-600 gap-1.5 border-slate-200" onClick={onDownloadAll}>
            <Download className="w-4 h-4" />
            一键下载
          </Button>
          <Button size="lg" variant="ghost" className="px-3 text-slate-500" onClick={onShare}>
            <Share2 className="w-4 h-4" />
          </Button>
          <Button size="lg" className="flex-1 bg-blue-500 hover:bg-blue-600 text-white gap-1.5" onClick={onGoDetail}>
            <FileText className="w-4 h-4" />
            生成详情图
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────
export default function HDResultStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // phase: "loading" | "preview" | "hd-loading" | "hd-done"
  const [phase, setPhase] = useState<"loading" | "preview" | "hd-loading" | "hd-done">("loading");
  const [progress, setProgress] = useState(0);
  const [hdProgress, setHdProgress] = useState(0);
  const [images, setImages] = useState<PreviewImage[]>([]);
  const [shareOpen, setShareOpen] = useState(false);

  const productType = sessionStorage.getItem("selectedProductType") || "净化器";
  const platform = sessionStorage.getItem("selectedPlatform") || "天猫";

  const MOCK_IMAGES: PreviewImage[] = [
    { id: "1", type: "主图",   platform, product: productType, url: "/examples/air-purifier.jpg",       editOpen: false, isRegenerating: false, texts: { ...DEFAULT_TEXTS } },
    { id: "2", type: "主图",   platform, product: productType, url: "/examples/air-purifier-white.jpg", editOpen: false, isRegenerating: false, texts: { ...DEFAULT_TEXTS } },
    { id: "3", type: "场景图", platform, product: productType, url: "/examples/2.jpg",                   editOpen: false, isRegenerating: false, texts: { ...DEFAULT_TEXTS } },
    { id: "4", type: "场景图", platform, product: productType, url: "/examples/3.jpg",                   editOpen: false, isRegenerating: false, texts: { ...DEFAULT_TEXTS } },
    { id: "5", type: "场景图", platform, product: productType, url: "/examples/air-purifier.jpg",        editOpen: false, isRegenerating: false, texts: { ...DEFAULT_TEXTS } },
    { id: "6", type: "细节图", platform, product: productType, url: "/examples/air-purifier-white.jpg",  editOpen: false, isRegenerating: false, texts: { ...DEFAULT_TEXTS } },
    { id: "7", type: "细节图", platform, product: productType, url: "/examples/2.jpg",                   editOpen: false, isRegenerating: false, texts: { ...DEFAULT_TEXTS } },
  ];

  // 初始加载：检测是否从付费页返回（已付费）
  useEffect(() => {
    const paidAndBack = sessionStorage.getItem("hdPaymentSuccess") === "true";
    if (paidAndBack) {
      sessionStorage.removeItem("hdPaymentSuccess");
      sessionStorage.removeItem("hdFromPreview");
      // 直接进入高清生成阶段，需先设好图片列表
      setImages(MOCK_IMAGES);
      startHDGeneration();
      return;
    }
    // 正常流程：生成带水印预览图
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setImages(MOCK_IMAGES);
            setPhase("preview");
          }, 300);
          return 100;
        }
        return prev + 5;
      });
    }, 100);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleEdit = (id: string) => {
    setImages(prev => prev.map(img =>
      img.id === id ? { ...img, editOpen: !img.editOpen } : { ...img, editOpen: false }
    ));
  };

  const updateText = (id: string, field: keyof TextFields, value: string) => {
    setImages(prev => prev.map(img =>
      img.id === id ? { ...img, texts: { ...img.texts, [field]: value } } : img
    ));
  };

  const saveText = (id: string) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, editOpen: false } : img));
    toast({ title: "文字已保存" });
  };

  const handleRegenerate = (id: string) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, isRegenerating: true } : img));
    setTimeout(() => {
      setImages(prev => prev.map(img => img.id === id ? { ...img, isRegenerating: false } : img));
      toast({ title: "重新生成完成" });
    }, 2000);
  };

  const handleRegenerateAll = () => {
    toast({ title: "重新生成全部", description: "正在重新生成所有图片…" });
    setPhase("loading");
    setProgress(0);
  };

  // 点击「生成无水印高清图」→跳转付费页
  const handleConfirmHD = () => {
    sessionStorage.setItem("hdImgCount", String(images.length));
    sessionStorage.setItem("hdFromPreview", "true");
    setLocation("/create/hd-payment");
  };

  // 付费成功后返回此页并进入高清生成阶段
  const startHDGeneration = () => {
    setPhase("hd-loading");
    setHdProgress(0);
    const interval = setInterval(() => {
      setHdProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setImages(prev => prev.map(img => ({ ...img, editOpen: false })));
            setPhase("hd-done");
          }, 300);
          return 100;
        }
        return prev + 3;
      });
    }, 80);
  };

  const handleDownloadAll = () => {
    images.forEach((image, index) => {
      const link = document.createElement("a");
      link.href = image.url;
      link.download = `高清主图_${index + 1}_${image.type}.jpg`;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
    toast({ title: "开始下载", description: `共 ${images.length} 张图片已开始下载` });
  };

  const handleGoDetail = () => {
    // 高清主图完成，跳转到详情图文案流程
    // 保留产品信息（analysisResult, productParams），只清除主图相关的状态
    const keysToRemove = [
      "selectedImgCount", "selectedPlans",
      "paymentSuccess", "generatedImages", "hdImages",
      "hdImgCount", "hdFromPreview", "hdPaymentSuccess",
      "copywritings",
    ];
    keysToRemove.forEach(k => sessionStorage.removeItem(k));
    setLocation("/create/copywriting");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <StepIndicator currentStep={5} />

      {/* 阶段一：初始加载 */}
      {phase === "loading" && (
        <div className="flex flex-col items-center justify-center flex-1 px-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">正在生成预览图…</h2>
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

      {/* 阶段二：带水印预览选图 */}
      {phase === "preview" && (
        <PreviewSelectStep
          images={images}
          onToggleEdit={toggleEdit}
          onUpdateText={updateText}
          onSaveText={saveText}
          onRegenerate={handleRegenerate}
          onRegenerateAll={handleRegenerateAll}
          onConfirm={handleConfirmHD}
        />
      )}

      {/* 阶段三：高清生成中 */}
      {phase === "hd-loading" && (
        <div className="flex flex-col items-center justify-center flex-1 px-4">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-orange-200">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">正在生成无水印高清图…</h2>
          <p className="text-sm text-slate-500 mb-5">AI 正在处理，请稍候片刻</p>
          <div className="w-full max-w-xs mb-2">
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-400 to-orange-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${hdProgress}%` }}
              />
            </div>
          </div>
          <p className="text-sm text-slate-400">{hdProgress}% · 高清渲染中</p>
        </div>
      )}

      {/* 阶段四：高清无水印结果 */}
      {phase === "hd-done" && (
        <HDDoneStep
          images={images}
          onToggleEdit={toggleEdit}
          onUpdateText={updateText}
          onSaveText={saveText}
          onGoDetail={handleGoDetail}
          onShare={() => setShareOpen(true)}
          onDownloadAll={handleDownloadAll}
        />
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
