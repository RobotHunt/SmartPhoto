import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  Loader2, RefreshCw, Sparkles, RotateCcw,
  Pencil, Wand2, X, Check
} from "lucide-react";
import { StepIndicator } from "@/components/StepIndicator";
import { useToast } from "@/hooks/use-toast";

interface TextFields {
  title: string;
  subtitle: string;
  footer: string;
}

interface GeneratedImage {
  id: string;
  type: string;
  product: string;
  url: string;
  isRegenerating: boolean;
  selected: boolean;
  editOpen: boolean;
  texts: TextFields;
}

const DEFAULT_TEXTS: TextFields = {
  title: "为宠物家庭专研的空气净化机",
  subtitle: "吸毛/除臭/净化",
  footer: "250CADR净化器 符合亚马逊尺寸",
};

export default function ResultStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(true);
  const [progress, setProgress] = useState(0);
  const [images, setImages] = useState<GeneratedImage[]>([]);

  // 重新生成意见弹窗
  const [regenModalOpen, setRegenModalOpen] = useState(false);
  const [regenTargetId, setRegenTargetId] = useState<string | null>(null);
  const [regenFeedback, setRegenFeedback] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // AI优化图片弹窗
  const [aiOptModalOpen, setAiOptModalOpen] = useState(false);
  const [aiOptFeedback, setAiOptFeedback] = useState("");
  const [aiOptimizing, setAiOptimizing] = useState(false);
  const aiOptRef = useRef<HTMLTextAreaElement>(null);

  const confirmAiOpt = () => {
    setAiOptModalOpen(false);
    setAiOptimizing(true);
    setTimeout(() => {
      setAiOptimizing(false);
      toast({ title: "AI优化完成", description: aiOptFeedback ? `已按建议优化：${aiOptFeedback}` : "已完成整体优化" });
      setAiOptFeedback("");
    }, 2500);
  };

  // 更改风格弹窗
  const [styleModalOpen, setStyleModalOpen] = useState(false);
  const [currentStyle, setCurrentStyle] = useState("场景氛围");
  const [customStyle, setCustomStyle] = useState("");
  const customStyleRef = useRef<HTMLInputElement>(null);

  const PRESET_STYLES = [
    { id: "scene", name: "场景氛围", desc: "真实生活场景，有温度感", emoji: "🏠" },
    { id: "white", name: "简约白底", desc: "纯白背景，突出产品", emoji: "⬜" },
    { id: "festival", name: "节日促销", desc: "喜庆红色，适合大促", emoji: "🎉" },
    { id: "tech", name: "科技感", desc: "深色背景，蓝光特效", emoji: "💡" },
    { id: "outdoor", name: "户外自然", desc: "绿植/户外背景", emoji: "🌿" },
    { id: "luxury", name: "高端质感", desc: "金色/大理石背景", emoji: "✨" },
  ];

  const productType = sessionStorage.getItem("selectedProductType") || "净化器";

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            const makeImg = (id: string, url: string, selected: boolean): GeneratedImage => ({
              id, type: "主图", product: productType, url,
              isRegenerating: false, selected, editOpen: false,
              texts: { ...DEFAULT_TEXTS },
            });
            // [2026-03-18 修复] 原: 7张图片含重复和不存在的4.jpg，改为4张不重复的实际示例图
            setImages([
              makeImg("1", "/examples/air-purifier.jpg", true),
              makeImg("2", "/examples/air-purifier-white.jpg", true),
              makeImg("3", "/examples/2.jpg", false),
              makeImg("4", "/examples/3.jpg", false),
              // makeImg("5", "/examples/4.jpg", false),
              // makeImg("6", "/examples/air-purifier.jpg", false),
              // makeImg("7", "/examples/air-purifier-white.jpg", false),
            ]);
            setGenerating(false);
          }, 400);
          return 100;
        }
        return prev + 5;
      });
    }, 150);
    return () => clearInterval(interval);
  }, []);

  const toggleSelect = (id: string) => {
    setImages(prev => prev.map(img =>
      img.id === id ? { ...img, selected: !img.selected } : img
    ));
  };

  const toggleEdit = (imgId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setImages(prev => prev.map(img =>
      img.id === imgId
        ? { ...img, editOpen: !img.editOpen }
        : { ...img, editOpen: false }
    ));
  };

  const updateText = (imgId: string, field: keyof TextFields, value: string) => {
    setImages(prev => prev.map(img =>
      img.id === imgId
        ? { ...img, texts: { ...img.texts, [field]: value } }
        : img
    ));
  };

  const openRegenModal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRegenTargetId(id);
    setRegenFeedback("");
    setRegenModalOpen(true);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const confirmRegen = () => {
    if (!regenTargetId) return;
    setRegenModalOpen(false);
    setImages(prev => prev.map(img =>
      img.id === regenTargetId ? { ...img, isRegenerating: true, editOpen: false } : img
    ));
    setTimeout(() => {
      setImages(prev => prev.map(img =>
        img.id === regenTargetId ? { ...img, isRegenerating: false } : img
      ));
      toast({ title: "重新生成完成", description: regenFeedback ? `已按意见调整：${regenFeedback}` : "已重新生成" });
      setRegenTargetId(null);
    }, 2500);
  };

  const selectedCount = images.filter(i => i.selected).length;

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <StepIndicator currentStep={5} />

      {/* 生成中 */}
      {generating && (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">AI 正在生成图片…</h2>
          <div className="w-full max-w-xs mb-2">
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <p className="text-sm text-slate-500">{progress}% · 预计还需 {Math.ceil((100 - progress) / 5)} 秒</p>
        </div>
      )}

      {/* 预览结果 */}
      {!generating && (
        <div className="max-w-lg mx-auto px-3 pb-44">
          {/* 顶部标题行 */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                </svg>
              </span>
              <span className="font-bold text-slate-900 text-base">已生成 {images.length} 张图片</span>
            </div>
            <button
              onClick={() => setLocation("/create/generate")}
              className="flex items-center gap-1.5 text-sm text-blue-600 border border-blue-300 rounded-full px-3 py-1 bg-white hover:bg-blue-50 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重新生成
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-3 -mt-1">预览图含水印，付费后生成高清清图</p>

          {/* 图片列表 */}
          <div className="space-y-3">
            {images.map((image) => (
              <div
                key={image.id}
                className={`bg-white rounded-2xl overflow-hidden transition-all
                  ${image.selected
                    ? "ring-2 ring-blue-400 shadow-md shadow-blue-100"
                    : "ring-1 ring-slate-100 shadow-sm"
                  }`}
              >
                {/* 图片区域 1:1 */}
                <div
                  className="relative w-full cursor-pointer"
                  style={{ aspectRatio: "1 / 1" }}
                  onClick={() => toggleSelect(image.id)}
                >
                  {image.isRegenerating && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-20 gap-3">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                      <span className="text-white text-sm">AI 重新生成中…</span>
                    </div>
                  )}

                  <img
                    src={image.url}
                    alt={image.type}
                    className="w-full h-full object-cover select-none"
                    style={{ filter: "brightness(0.93)" }}
                    draggable={false}
                  />

                  {/* 水印 */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                    <span
                      className="text-white/25 font-bold tracking-widest rotate-[-30deg] whitespace-nowrap"
                      style={{ fontSize: "clamp(16px, 4.5vw, 24px)", textShadow: "0 1px 3px rgba(0,0,0,0.2)" }}
                    >
                      AI电商做图 · 预览水印
                    </span>
                  </div>

                  {/* 右上角选中圆圈 */}
                  <div className={`absolute top-2.5 right-2.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
                    ${image.selected ? "bg-blue-500 border-blue-500" : "bg-white/60 border-white/80 backdrop-blur-sm"}`}>
                    {image.selected && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* 信息行 */}
                <div
                  className="flex items-center justify-between px-3 py-2.5"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600 font-medium">
                      {image.product} · {image.type}
                    </span>
                    <button
                      onClick={(e) => toggleEdit(image.id, e)}
                      className={`flex items-center gap-1 text-xs rounded-full px-2 py-0.5 border transition
                        ${image.editOpen
                          ? "text-blue-700 border-blue-400 bg-blue-100"
                          : "text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
                        }`}
                    >
                      <Pencil className="w-3 h-3" />
                      编辑文字
                    </button>
                  </div>
                  <button
                    onClick={(e) => openRegenModal(image.id, e)}
                    disabled={image.isRegenerating}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 border border-slate-200 hover:border-blue-300 rounded-full px-2.5 py-1 transition disabled:opacity-40 bg-slate-50 hover:bg-blue-50"
                  >
                    <RefreshCw className="w-3 h-3" />
                    重新生成
                  </button>
                </div>

                {/* 编辑文字面板：在图片下方展开，图片本身完全干净 */}
                {image.editOpen && (
                  <div
                    className="border-t border-slate-100 px-3 pb-3 pt-2 bg-slate-50"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="space-y-2">
                      {[
                        { field: "title" as keyof TextFields, label: "主标题" },
                        { field: "subtitle" as keyof TextFields, label: "副标题" },
                        { field: "footer" as keyof TextFields, label: "底部文字" },
                      ].map(({ field, label }) => (
                        <div key={field} className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 w-14 shrink-0">{label}</span>
                          <input
                            value={image.texts[field]}
                            onChange={e => updateText(image.id, field, e.target.value)}
                            className="flex-1 text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={(e) => {
                        toggleEdit(image.id, e);
                        toast({ title: "文字已保存", description: "点击重新生成可应用新文字" });
                      }}
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
        </div>
      )}

      {/* 底部固定操作栏 */}
      {!generating && (
        <div className="fixed bottom-0 left-0 right-0 z-30">

          <div className="bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-4 py-3">
            <div className="max-w-lg mx-auto flex items-center gap-3">
              <div className="flex-1 min-w-0">
                {selectedCount > 0 ? (
                  <>
                    <p className="text-sm font-semibold text-slate-900">已选择 <span className="text-blue-600">{selectedCount}</span> 张</p>
                    <p className="text-xs text-slate-400 truncate">确认后生成无水印高清图…</p>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">点击图片选择要生成高清版的图片</p>
                )}
              </div>
              <button
                disabled={selectedCount === 0}
                onClick={() => {
                  sessionStorage.setItem("selectedImgCount", String(selectedCount));
                  setLocation("/create/payment");
                }}
                className={`flex items-center gap-2 font-bold text-sm px-5 py-3 rounded-2xl transition-all shrink-0
                  ${selectedCount > 0
                    ? "bg-gradient-to-r from-blue-500 to-emerald-500 text-white shadow-md shadow-blue-200 hover:from-blue-600 hover:to-emerald-600 active:scale-95"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  }`}
              >
                <Sparkles className="w-4 h-4" />
                生成无水印高清图
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI优化图片弹窗 */}
      {aiOptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setAiOptModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl px-5 pt-5 pb-8 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-slate-900 text-base">AI优化图片</h3>
              <button onClick={() => setAiOptModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-3">告诉 AI 你希望对所有图片做哪些整体调整</p>
            <textarea
              ref={aiOptRef}
              value={aiOptFeedback}
              onChange={e => setAiOptFeedback(e.target.value)}
              placeholder="例如：整体色调更暖、产品放大一些、背景更简洁、增加品牌感…"
              rows={4}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
            <div className="flex flex-wrap gap-2 mt-3 mb-5">
              {["色调更暖", "产品放大", "背景更简洁", "增加品牌感", "对比度更强", "去除杂乱元素"].map(tag => (
                <button
                  key={tag}
                  onClick={() => setAiOptFeedback(prev => prev ? `${prev}，${tag}` : tag)}
                  className="text-xs text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-full px-3 py-1 transition"
                >
                  + {tag}
                </button>
              ))}
            </div>
            <button
              onClick={confirmAiOpt}
              className="w-full bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition active:scale-95"
            >
              <Wand2 className="w-4 h-4" />
              确认，开始AI优化
            </button>
          </div>
        </div>
      )}

      {/* 更改风格弹窗 */}
      {styleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setStyleModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl px-5 pt-5 pb-8 shadow-2xl animate-in slide-in-from-bottom-4 duration-300 max-h-[85vh] overflow-y-auto">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-base">更改风格</h3>
              <button onClick={() => setStyleModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 当前风格 */}
            <div className="mb-4">
              <p className="text-xs text-slate-400 mb-2">当前风格</p>
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <span className="text-lg">{PRESET_STYLES.find(s => s.name === currentStyle)?.emoji ?? "🎨"}</span>
                <div>
                  <p className="text-sm font-semibold text-blue-700">{currentStyle}</p>
                  <p className="text-xs text-blue-500">{PRESET_STYLES.find(s => s.name === currentStyle)?.desc ?? customStyle}</p>
                </div>
                <span className="ml-auto text-xs bg-blue-500 text-white rounded-full px-2 py-0.5">已选</span>
              </div>
            </div>

            {/* 预设风格列表 */}
            <p className="text-xs text-slate-400 mb-2">选择其他风格</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {PRESET_STYLES.filter(s => s.name !== currentStyle).map(style => (
                <button
                  key={style.id}
                  onClick={() => {
                    setCurrentStyle(style.name);
                    setCustomStyle("");
                  }}
                  className="flex items-center gap-2 border border-slate-200 hover:border-blue-300 hover:bg-blue-50 rounded-xl px-3 py-2.5 text-left transition"
                >
                  <span className="text-xl">{style.emoji}</span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{style.name}</p>
                    <p className="text-xs text-slate-400">{style.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* 自定义风格 */}
            <p className="text-xs text-slate-400 mb-2">自定义风格</p>
            <div className="flex gap-2 mb-5">
              <input
                ref={customStyleRef}
                value={customStyle}
                onChange={e => setCustomStyle(e.target.value)}
                placeholder="描述你想要的风格，如：赛博朋克、日系清新…"
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
              <button
                onClick={() => {
                  if (customStyle.trim()) setCurrentStyle(customStyle.trim());
                }}
                disabled={!customStyle.trim()}
                className="text-sm text-white bg-blue-500 hover:bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400 rounded-xl px-4 py-2 font-medium transition"
              >
                应用
              </button>
            </div>

            <button
              onClick={() => {
                setStyleModalOpen(false);
                toast({ title: "风格已更新", description: `当前风格：${currentStyle}，点击重新生成可应用` });
              }}
              className="w-full bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition active:scale-95"
            >
              <Check className="w-4 h-4" />
              确认风格
            </button>
          </div>
        </div>
      )}

      {/* 重新生成意见弹窗 */}
      {regenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRegenModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl px-5 pt-5 pb-8 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-base">重新生成</h3>
              <button onClick={() => setRegenModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-3">请告诉 AI 你希望如何调整这张图片（可选）</p>
            <textarea
              ref={textareaRef}
              value={regenFeedback}
              onChange={e => setRegenFeedback(e.target.value)}
              placeholder="例如：背景换成白色、产品更突出、去掉宠物元素、文字更大…"
              rows={4}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
            <div className="flex flex-wrap gap-2 mt-3 mb-5">
              {["背景换白色", "产品更突出", "文字更大", "去掉文字", "换横版构图"].map(tag => (
                <button
                  key={tag}
                  onClick={() => setRegenFeedback(prev => prev ? `${prev}，${tag}` : tag)}
                  className="text-xs text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-full px-3 py-1 transition"
                >
                  + {tag}
                </button>
              ))}
            </div>
            <button
              onClick={confirmRegen}
              className="w-full bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              确认，开始重新生成
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
