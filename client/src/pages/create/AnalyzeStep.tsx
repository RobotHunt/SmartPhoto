import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Check, CheckCircle2, Cpu, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StepIndicator } from "@/components/StepIndicator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { jobAPI, sessionAPI } from "@/lib/api";

interface AnalysisResult {
  product_name: string;
  product_type: string;
  category: string;
  visual_features: string[];
  suggestions: string[];
}

const PRODUCT_CATEGORIES = [
  "空气净化器",
  "加湿器",
  "除湿机",
  "厨房小家电",
  "服装",
  "电子产品",
  "家居用品",
  "美妆护肤",
  "食品饮料",
  "运动户外",
  "母婴用品",
  "图书文具",
  "其他",
];

const RECOGNITION_STEPS = ["产品类别识别", "产品结构识别", "应用场景识别"];
const ANALYSIS_DIRTY_KEY = "analysis_dirty";
const ANALYZE_SUPPLEMENT_KEY = "from_analyze_supplement";

function getMockCandidates(category: string) {
  if (category === "空气净化器") {
    return [
      { type: "空气净化器", confidence: 98 },
      { type: "家用电器", confidence: 15 },
      { type: "定制家居", confidence: 8 },
    ];
  }

  return [{ type: category || "其他", confidence: 98 }];
}

function getMockSceneTags(category: string) {
  if (category === "空气净化器") return ["家居场景", "白底产品"];
  if (category === "服装") return ["模特展示", "细节特写"];
  if (category === "美妆护肤") return ["清爽场景", "成分表达"];
  return [];
}

function parseAnalysisSnapshot(snapshot: any): AnalysisResult {
  const recognized = snapshot?.recognized_product || {};
  const rawVisualFeatures =
    snapshot?.suggested_styles || snapshot?.visual_features || [];

  return {
    product_name: recognized.product_name || snapshot?.product_name || "产品",
    product_type: recognized.image_type || snapshot?.product_type || "实物图",
    category: recognized.category || snapshot?.category || "其他",
    visual_features: Array.isArray(rawVisualFeatures)
      ? rawVisualFeatures
      : String(rawVisualFeatures)
          .split(/[,\uFF0C\u3001\n]/)
          .map((item) => item.trim())
          .filter(Boolean),
    suggestions: Array.isArray(snapshot?.suggestions) ? snapshot.suggestions : [],
  };
}

export default function AnalyzeStep() {
  const [, setLocation] = useLocation();
  const [analyzing, setAnalyzing] = useState(true);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [candidates, setCandidates] = useState<Array<{ type: string; confidence: number }>>([]);
  const [firstImageUrl, setFirstImageUrl] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadFirstImage = async (sessionId: string) => {
      const previewsStr = sessionStorage.getItem("uploadSlotPreviews");
      if (previewsStr) {
        try {
          const previews = JSON.parse(previewsStr);
          if (Array.isArray(previews) && previews.length > 0) {
            setFirstImageUrl(previews[0].preview || null);
            return;
          }
        } catch {
          // ignore local cache parse errors
        }
      }

      const images = await sessionAPI.listImages(sessionId).catch(() => []);
      if (!cancelled && images.length > 0) {
        setFirstImageUrl(images[0].url);
      }
    };

    const applySnapshot = (snapshot: any) => {
      const parsed = parseAnalysisSnapshot(snapshot);
      const nextCandidates = getMockCandidates(parsed.category || parsed.product_name);

      sessionStorage.setItem("analysis_snapshot_full", JSON.stringify(snapshot));
      sessionStorage.setItem("analysisResult", JSON.stringify(parsed));
      sessionStorage.removeItem(ANALYSIS_DIRTY_KEY);
      sessionStorage.removeItem(ANALYZE_SUPPLEMENT_KEY);

      setCandidates(nextCandidates);
      setResult(parsed);
      setSelectedCategory(parsed.category || parsed.product_name);
      setEditedName(parsed.product_name);
      setError(null);
      setAnalyzing(false);
    };

    const runAnalysis = async () => {
      const sessionId = sessionStorage.getItem("current_session_id");
      if (!sessionId) {
        setError("未找到会话，请返回上传页面重新开始。");
        setAnalyzing(false);
        return;
      }

      await loadFirstImage(sessionId);

      try {
        const forceReanalyze = sessionStorage.getItem(ANALYSIS_DIRTY_KEY) === "1";
        const snapshot = await sessionAPI.get(sessionId).catch(() => null);

        if (
          !forceReanalyze &&
          snapshot?.analysis_snapshot &&
          [
            "analyzed",
            "platform_selected",
            "copy_ready",
            "strategy_ready",
            "generating",
            "completed",
            "failed",
          ].includes(snapshot.status)
        ) {
          if (!cancelled) applySnapshot(snapshot.analysis_snapshot);
          return;
        }

        progressTimerRef.current = setInterval(() => {
          if (cancelled || !progressTimerRef.current) return;
        }, 300);

        const triggerResp = await sessionAPI.triggerAnalysis(sessionId);
        if (cancelled) return;

        await jobAPI.pollUntilDone(triggerResp.job_id);
        if (cancelled) return;

        const analysisResp = await sessionAPI.getAnalysis(sessionId);
        if (cancelled) return;

        const snapshotData = analysisResp?.analysis_snapshot || analysisResp || {};
        applySnapshot(snapshotData);
      } catch (err) {
        if (cancelled) return;
        const nextError =
          err instanceof Error && err.message
            ? err.message
            : "AI 识别失败，请返回上传页重试。";
        setCandidates([]);
        setResult(null);
        setSelectedCategory("");
        setEditedName("");
        setError(nextError);
        setAnalyzing(false);
      } finally {
        if (progressTimerRef.current) {
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
      }
    };

    runAnalysis();

    return () => {
      cancelled = true;
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, []);

  const commitEditedName = () => {
    if (!result) return;
    const nextName = editedName.trim() || result.product_name;
    setEditedName(nextName);
    setResult((prev) => (prev ? { ...prev, product_name: nextName } : prev));
    setEditingName(false);
  };

  const handleConfirmAndNext = () => {
    if (!result || !selectedCategory) return;

    const updatedResult = {
      ...result,
      category: selectedCategory,
      product_name: (editedName || result.product_name).trim() || result.product_name,
    };

    sessionStorage.setItem("analysisResult", JSON.stringify(updatedResult));
    sessionStorage.setItem("selectedProductType", selectedCategory);
    sessionStorage.removeItem(ANALYZE_SUPPLEMENT_KEY);
    setLocation("/create/platform");
  };

  const handleSupplementImages = () => {
    sessionStorage.setItem(ANALYZE_SUPPLEMENT_KEY, "1");
    setLocation("/create/upload");
  };

  const topCandidate = candidates[0];
  const row1Tags = candidates.map((candidate) => candidate.type);
  const row2Tags = result ? getMockSceneTags(result.category || result.product_name) : [];

  if (error) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <StepIndicator currentStep={2} />
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <div className="mb-2 text-lg font-semibold text-red-500">识别失败</div>
          <p className="mb-6 text-center text-sm text-gray-500">{error}</p>
          <div className="flex items-center gap-3">
            <Button onClick={() => window.location.reload()} variant="outline">
              重试识别
            </Button>
            <Button onClick={() => setLocation("/create/upload")} variant="outline">
              返回上传
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (analyzing) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <StepIndicator currentStep={2} />
        <div className="flex-1 px-4 pb-6 pt-4">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900">AI 视觉识别</h2>
            <p className="mt-0.5 text-sm text-gray-400">正在识别产品品类与结构特征</p>
          </div>

          <div className="mb-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
              <span className="text-sm font-medium text-gray-700">识别进度</span>
            </div>
            <div className="space-y-1.5 pl-4">
              {RECOGNITION_STEPS.map((step) => (
                <div key={step} className="flex items-center gap-2 text-sm text-gray-400">
                  <div className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-gray-200 animate-spin">
                    <div className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                  </div>
                  {step}
                </div>
              ))}
            </div>
          </div>

          <div className="relative mb-5 flex h-36 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a1628] via-[#0d2040] to-[#0a1628]">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-32 w-32 animate-ping rounded-full border border-cyan-500/20" style={{ animationDuration: "3s" }} />
              <div className="absolute h-24 w-24 rounded-full border border-cyan-400/30" />
              <div className="absolute h-16 w-16 rounded-full border border-cyan-300/40" />
            </div>
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
            <div className="absolute left-2 top-2 h-4 w-4 rounded-tl border-l-2 border-t-2 border-cyan-400/60" />
            <div className="absolute right-2 top-2 h-4 w-4 rounded-tr border-r-2 border-t-2 border-cyan-400/60" />
            <div className="absolute bottom-2 left-2 h-4 w-4 rounded-bl border-b-2 border-l-2 border-cyan-400/60" />
            <div className="absolute bottom-2 right-2 h-4 w-4 rounded-br border-b-2 border-r-2 border-cyan-400/60" />
            {firstImageUrl ? (
              <img src={firstImageUrl} alt="产品" className="relative z-10 h-24 w-24 object-contain drop-shadow-lg" />
            ) : (
              <Cpu className="relative z-10 h-12 w-12 text-cyan-400/60" />
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <StepIndicator currentStep={2} />
      <div className="flex-1 px-4 pb-6 pt-4">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">AI 视觉识别</h2>
          <p className="mt-0.5 text-sm text-gray-400">正在识别产品品类与结构特征</p>
        </div>

        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-400" />
            <span className="text-sm font-medium text-gray-700">识别进度</span>
          </div>
          <div className="space-y-1.5 pl-4">
            {RECOGNITION_STEPS.map((step) => (
              <div key={step} className="flex items-center gap-2 text-sm text-gray-700">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
                {step}
              </div>
            ))}
          </div>
        </div>

        <div className="relative mb-5 flex h-36 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a1628] via-[#0d2040] to-[#0a1628]">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-32 w-32 rounded-full border border-cyan-500/20" />
            <div className="absolute h-24 w-24 rounded-full border border-cyan-400/30" />
            <div className="absolute h-16 w-16 rounded-full border border-cyan-300/40" />
          </div>
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
          <div className="absolute left-2 top-2 h-4 w-4 rounded-tl border-l-2 border-t-2 border-cyan-400/60" />
          <div className="absolute right-2 top-2 h-4 w-4 rounded-tr border-r-2 border-t-2 border-cyan-400/60" />
          <div className="absolute bottom-2 left-2 h-4 w-4 rounded-bl border-b-2 border-l-2 border-cyan-400/60" />
          <div className="absolute bottom-2 right-2 h-4 w-4 rounded-br border-b-2 border-r-2 border-cyan-400/60" />
          {firstImageUrl ? (
            <img src={firstImageUrl} alt="产品" className="relative z-10 h-24 w-24 object-contain drop-shadow-lg" />
          ) : (
            <Cpu className="relative z-10 h-12 w-12 text-cyan-400/60" />
          )}
        </div>

        <div className="mb-2">
          <p className="mb-1 text-sm text-gray-500">识别结果</p>
          <div className="mb-3 flex items-center justify-between">
            {editingName ? (
              <div className="mr-2 flex flex-1 items-center gap-2">
                <input
                  autoFocus
                  value={editedName}
                  onChange={(event) => setEditedName(event.target.value)}
                  className="min-w-0 flex-1 border-b-2 border-blue-400 bg-transparent text-lg font-bold text-gray-900 outline-none"
                />
                <button onClick={commitEditedName} className="text-green-500 hover:text-green-600">
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setEditedName(result.product_name);
                    setEditingName(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold text-gray-900">
                  {editedName || result.product_name}
                </span>
                <button
                  onClick={() => {
                    setEditedName(editedName || result.product_name);
                    setEditingName(true);
                  }}
                  className="text-gray-400 transition-colors hover:text-blue-500"
                  title="修改产品名称"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {topCandidate && !editingName && (
              <span className="shrink-0 rounded-full bg-green-500 px-2.5 py-0.5 text-xs font-semibold text-white">
                置信度 {topCandidate.confidence}%
              </span>
            )}
          </div>

          {row1Tags.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-2">
              {row1Tags.map((tag, index) => (
                <span
                  key={`${tag}-${index}`}
                  className="rounded-full border border-gray-200 px-2.5 py-0.5 text-xs text-gray-500"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {row2Tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {row2Tags.map((tag, index) => (
                <span
                  key={`${tag}-${index}`}
                  className="rounded-full border border-gray-200 px-2.5 py-0.5 text-xs text-gray-500"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mb-4 rounded-2xl bg-gray-50 p-4">
          <p className="mb-2 text-sm font-semibold text-gray-800">确认产品类别</p>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="mb-1 w-full rounded-lg border-gray-200 bg-white text-sm">
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

          <p className="mb-3 text-xs text-gray-400">
            AI 建议：{result.category || "其他"}，您可以确认或修改
          </p>

          {result.suggestions.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 text-xs text-gray-400">建议补充以下图片：</p>
              <ul className="space-y-1">
                {result.suggestions.map((suggestion, index) => (
                  <li
                    key={`${suggestion}-${index}`}
                    className="flex items-center gap-2 text-xs text-gray-600"
                  >
                    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-400" />
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleConfirmAndNext}
              disabled={!selectedCategory}
              variant="outline"
              className="h-9 flex-1 rounded-lg border-gray-200 bg-white text-sm text-gray-700 disabled:opacity-50"
            >
              确认
            </Button>
            <Button
              size="sm"
              className="h-9 flex-1 rounded-lg bg-green-500 text-sm text-white hover:bg-green-600"
              onClick={handleSupplementImages}
            >
              补充图片
            </Button>
          </div>
        </div>

        <Button
          onClick={handleConfirmAndNext}
          disabled={!selectedCategory}
          className="h-12 w-full rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 text-base font-semibold text-white shadow-lg hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50"
        >
          下一步
        </Button>
      </div>
    </div>
  );
}
