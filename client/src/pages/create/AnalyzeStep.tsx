import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, Upload, Cpu, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepIndicator } from "@/components/StepIndicator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// [2026-03-16 静态化改造] 注释掉 tRPC import，静态模式下不调用后端 AI 识别接口
// import { trpc } from "@/lib/trpc";

interface AnalysisResult {
  imageType: string;
  productName: string;
  productCategory: string;
  suggestions: string[];
}

const PRODUCT_CATEGORIES = [
  "空气净化器", "加湿器", "除湿机", "厨房小家电", "服装",
  "电子产品", "家居用品", "美妆护肤", "食品饮料", "运动户外",
  "母婴用品", "图书文具", "其它",
];

const getMockCandidates = (category: string) => {
  if (category === "空气净化器") {
    return [
      { type: "空气净化器", confidence: 98 },
      { type: "家用电器", confidence: 15 },
      { type: "定制家居", confidence: 8 },
    ];
  }
  return [{ type: category, confidence: 98 }];
};

const getMockSceneTags = (category: string) => {
  if (category === "空气净化器") return ["家居场景", "白底产品"];
  return [];
};

const RECOGNITION_STEPS = ["产品类别识别", "产品结构识别", "应用场景识别"];

export default function AnalyzeStep() {
  const [, setLocation] = useLocation();
  const [analyzing, setAnalyzing] = useState(true);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [candidates, setCandidates] = useState<Array<{ type: string; confidence: number }>>([]);
  const [firstImageUrl, setFirstImageUrl] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // [2026-03-16 静态化改造] 注释掉 tRPC AI 识别 mutation，用纯 mock 数据替代
  // const analyzeImageMutation = trpc.project.analyzeImage.useMutation();

  useEffect(() => {
    const previewsStr = sessionStorage.getItem("uploadSlotPreviews");
    if (previewsStr) {
      try {
        // uploadSlotPreviews 存储格式为 [{id, preview}] 数组
        const previews = JSON.parse(previewsStr);
        if (Array.isArray(previews) && previews.length > 0) {
          setFirstImageUrl(previews[0].preview || null);
        }
      } catch {
        // ignore
      }
    }

    // --- 原始代码：通过 tRPC 调用后端 AI 图像识别（已注释） ---
    // [2026-03-16 静态化改造] 目标：不调后端 API，直接用 mock 数据模拟识别结果
    /*
    const timer = setTimeout(async () => {
      try {
        const imageUrl = sessionStorage.getItem("firstUploadedImageUrl");
        const productType = sessionStorage.getItem("selectedProductType") || "空气净化器";

        let analysisResult;
        if (imageUrl) {
          const res = await analyzeImageMutation.mutateAsync({ imageUrl });
          analysisResult = res;
        }

        const mockResult: AnalysisResult = {
          imageType: "实物图",
          productName: analysisResult?.productName || "空气净化器",
          productCategory: analysisResult?.productType || productType,
          suggestions: analysisResult?.suggestions || ["正面展示", "背面结构", "顶部进风口", "使用场景图"],
        };

        const mockCandidates = getMockCandidates(mockResult.productCategory);
        setCandidates(mockCandidates);
        setResult(mockResult);
        setSelectedCategory(mockResult.productCategory);
        setAnalyzing(false);

        sessionStorage.setItem("analysisResult", JSON.stringify(mockResult));
      } catch {
        const fallback: AnalysisResult = {
          imageType: "实物图",
          productName: "产品",
          productCategory: "其它",
          suggestions: ["正面展示", "背面结构"],
        };
        setCandidates([{ type: "其它", confidence: 70 }]);
        setResult(fallback);
        setSelectedCategory("其它");
        setAnalyzing(false);
        sessionStorage.setItem("analysisResult", JSON.stringify(fallback));
      }
    }, 2500);
    */

    // --- 新代码：纯 Mock AI 识别，2.5s 动画后直接返回假数据 ---
    const timer = setTimeout(() => {
      const productType = sessionStorage.getItem("selectedProductType") || "空气净化器";

      const mockResult: AnalysisResult = {
        imageType: "实物图",
        productName: "空气净化器",
        productCategory: productType,
        suggestions: ["正面展示", "背面结构", "顶部进风口", "使用场景图"],
      };

      const mockCandidates = getMockCandidates(mockResult.productCategory);
      setCandidates(mockCandidates);
      setResult(mockResult);
      setSelectedCategory(mockResult.productCategory);
      setAnalyzing(false);

      sessionStorage.setItem("analysisResult", JSON.stringify(mockResult));
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const handleStartGeneration = () => {
    if (!selectedCategory) return;
    const updatedResult = { ...result, productCategory: selectedCategory };
    sessionStorage.setItem("analysisResult", JSON.stringify(updatedResult));
    sessionStorage.setItem("selectedProductType", selectedCategory);
    setLocation("/create/platform");
  };

  const topCandidate = candidates[0];
  const row1Tags = candidates.map((c) => c.type);
  const row2Tags = result ? getMockSceneTags(result.productCategory) : [];

  // ── 加载中 ──
  if (analyzing) {
    return (
      <div className="flex flex-col min-h-screen bg-white">
        <StepIndicator currentStep={1} />
        <div className="flex-1 px-4 pt-4 pb-6">
          {/* 标题 */}
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900">AI视觉识别</h2>
            <p className="text-sm text-gray-400 mt-0.5">正在识别产品品类别与结构特征</p>
          </div>

          {/* 识别进度 */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm font-medium text-gray-700">识别进度</span>
            </div>
            <div className="space-y-1.5 pl-4">
              {RECOGNITION_STEPS.map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-400">
                  <div className="w-4 h-4 rounded-full border-2 border-gray-200 flex items-center justify-center animate-spin">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                  </div>
                  {step}
                </div>
              ))}
            </div>
          </div>

          {/* 产品图（科技感） */}
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#0a1628] via-[#0d2040] to-[#0a1628] h-36 flex items-center justify-center mb-5">
            {/* 同心圆光晕 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 rounded-full border border-cyan-500/20 animate-ping" style={{ animationDuration: "3s" }} />
              <div className="absolute w-24 h-24 rounded-full border border-cyan-400/30" />
              <div className="absolute w-16 h-16 rounded-full border border-cyan-300/40" />
            </div>
            {/* 横向光线 */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
            {/* 四角装饰 */}
            <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-400/60 rounded-tl" />
            <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-400/60 rounded-tr" />
            <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-400/60 rounded-bl" />
            <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-400/60 rounded-br" />
            {/* 产品图 */}
            {firstImageUrl ? (
              <img src={firstImageUrl} alt="产品" className="relative z-10 h-24 w-24 object-contain drop-shadow-lg" />
            ) : (
              <Cpu className="relative z-10 w-12 h-12 text-cyan-400/60" />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── 识别完成 ──
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <StepIndicator currentStep={1} />
      <div className="flex-1 px-4 pt-4 pb-6">
        {/* 标题 */}
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">AI视觉识别</h2>
          <p className="text-sm text-gray-400 mt-0.5">正在识别产品品类别与结构特征</p>
        </div>

        {/* 识别进度（完成） */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-sm font-medium text-gray-700">识别进度</span>
          </div>
          <div className="space-y-1.5 pl-4">
            {RECOGNITION_STEPS.map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                {step}
              </div>
            ))}
          </div>
        </div>

        {/* 产品图（科技感） */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#0a1628] via-[#0d2040] to-[#0a1628] h-36 flex items-center justify-center mb-5">
          {/* 同心圆光晕 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full border border-cyan-500/20" />
            <div className="absolute w-24 h-24 rounded-full border border-cyan-400/30" />
            <div className="absolute w-16 h-16 rounded-full border border-cyan-300/40" />
          </div>
          {/* 横向光线 */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
          {/* 四角装饰 */}
          <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-400/60 rounded-tl" />
          <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-400/60 rounded-tr" />
          <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-400/60 rounded-bl" />
          <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-400/60 rounded-br" />
          {/* 产品图 */}
          {firstImageUrl ? (
            <img src={firstImageUrl} alt="产品" className="relative z-10 h-24 w-24 object-contain drop-shadow-lg" />
          ) : (
            <Cpu className="relative z-10 w-12 h-12 text-cyan-400/60" />
          )}
        </div>

        {/* ── 识别结果（无卡片，直接贴白底） ── */}
        <div className="mb-2">
          <p className="text-sm text-gray-500 mb-1">识别结果</p>
          <div className="flex items-center justify-between mb-3">
            {editingName ? (
              <div className="flex items-center gap-2 flex-1 mr-2">
                <input
                  autoFocus
                  value={editedName}
                  onChange={e => setEditedName(e.target.value)}
                  className="text-lg font-bold text-gray-900 border-b-2 border-blue-400 outline-none bg-transparent flex-1 min-w-0"
                />
                <button onClick={() => { if (result) { setResult({ ...result, productName: editedName }); } setEditingName(false); }} className="text-green-500 hover:text-green-600">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setEditingName(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold text-gray-900">
                  {result?.productName || result?.productCategory}
                </span>
                <button
                  onClick={() => { setEditedName(result?.productName || result?.productCategory || ""); setEditingName(true); }}
                  className="text-gray-400 hover:text-blue-500 transition-colors"
                  title="修改产品名称"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {topCandidate && !editingName && (
              <span className="text-xs font-semibold bg-green-500 text-white px-2.5 py-0.5 rounded-full shrink-0">
                置信度 {topCandidate.confidence}%
              </span>
            )}
          </div>
          {/* 第一行标签 */}
          {row1Tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-1.5">
              {row1Tags.map((tag, i) => (
                <span key={i} className="text-xs border border-gray-200 text-gray-500 px-2.5 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {/* 第二行标签（场景） */}
          {row2Tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {row2Tags.map((tag, i) => (
                <span key={i} className="text-xs border border-gray-200 text-gray-500 px-2.5 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── 确认产品类别（浅灰卡片背景） ── */}
        <div className="bg-gray-50 rounded-2xl p-4 mb-4">
          <p className="text-sm font-semibold text-gray-800 mb-2">确认产品类别</p>

          {/* 下拉选择（标题正下方） */}
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full text-sm border-gray-200 rounded-lg bg-white mb-1">
              <SelectValue placeholder="选择产品类型" />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-400 mb-3">
            AI建议：{result?.productCategory}，您可以确认或修改
          </p>

          {/* 建议补充图片列表 */}
          {result?.suggestions && result.suggestions.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-1.5">建议补充以下图片：</p>
              <ul className="space-y-1">
                {result.suggestions.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 确认 / 补充图片 按钮 */}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleStartGeneration}
              disabled={!selectedCategory}
              variant="outline"
              className="flex-1 rounded-lg text-sm h-9 border-gray-200 text-gray-700 bg-white disabled:opacity-50"
            >
              确认
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm h-9"
              onClick={() => setLocation("/create/upload")}
            >
              补充图片
            </Button>
          </div>
        </div>

        {/* ── 开始AI生成图片按钮 ── */}
        <Button
          onClick={handleStartGeneration}
          disabled={!selectedCategory}
          className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold rounded-2xl text-base shadow-lg disabled:opacity-50"
        >
          下一步
        </Button>

        {/* 隐藏的文件输入 */}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" />
      </div>
    </div>
  );
}
