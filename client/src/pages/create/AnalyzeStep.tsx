import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2, CheckCircle2, Pencil, Lightbulb, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StepIndicator } from "@/components/StepIndicator";
import { sessionAPI, jobAPI } from "@/lib/api";

interface AnalysisResult {
  product_name: string;
  product_type: string;
  category: string;
  visual_features: string[];
  suggestions: string[];
}

export default function AnalyzeStep() {
  const [, setLocation] = useLocation();

  // Loading / progress state
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Analysis result state
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [productName, setProductName] = useState("");
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let fakeTimer: ReturnType<typeof setInterval>;

    const runAnalysis = async () => {
      const sessionId = sessionStorage.getItem("current_session_id");
      if (!sessionId) {
        setError("未找到会话ID，请返回重新上传图片。");
        setLoading(false);
        return;
      }

      try {
        // Quick ramp-up: 0 → 65% in ~3 seconds
        let fakeProgress = 0;
        fakeTimer = setInterval(() => {
          if (cancelled) return;
          fakeProgress += Math.random() * 8 + 2;
          if (fakeProgress > 65) fakeProgress = 65 + Math.random() * 2;
          setProgress(Math.min(Math.round(fakeProgress), 68));
        }, 300);

        // Trigger analysis
        const triggerResp = await sessionAPI.triggerAnalysis(sessionId);
        const jobId = triggerResp.job_id || triggerResp.jobId;
        if (cancelled) return;

        // Poll until done - slow progress from 68→92
        await jobAPI.pollUntilDone(jobId, (status) => {
          if (cancelled) return;
          const pct = status.progress_pct ?? status.progress ?? null;
          if (pct !== null && typeof pct === "number") {
            setProgress(Math.min(Math.round(68 + pct * 0.24), 92));
          }
        });

        if (cancelled) return;
        clearInterval(fakeTimer);
        setProgress(93);

        // Fetch the analysis snapshot
        const analysisResp = await sessionAPI.getAnalysis(sessionId);
        if (cancelled) return;

        // The real data is inside analysis_snapshot
        const snap = analysisResp?.analysis_snapshot || analysisResp || {};
        // recognized_product is nested
        const rp = snap.recognized_product || {};
        const copyDraft = snap.copy_draft || {};

        const parsed: AnalysisResult = {
          product_name:
            rp.product_name || snap.product_name || "未识别产品",
          product_type:
            rp.image_type || snap.product_type || "",
          category:
            rp.category || snap.category || "",
          visual_features:
            snap.suggested_styles || snap.visual_features || [],
          suggestions:
            snap.suggestions || [],
        };

        // If visual_features is a string, split it
        if (typeof parsed.visual_features === "string") {
          parsed.visual_features = (parsed.visual_features as string).split(/[,，;；]/).map((s: string) => s.trim()).filter(Boolean);
        }

        // Also save the full snapshot for downstream steps (GenerateStep needs key_parameters etc.)
        sessionStorage.setItem("analysis_snapshot_full", JSON.stringify(snap));

        setResult(parsed);
        setProductName(parsed.product_name);
        setProgress(100);
        sessionStorage.setItem("analysisResult", JSON.stringify(parsed));
      } catch (err: any) {
        if (cancelled) return;
        console.error("Analysis error:", err);
        setError(err?.message || "分析失败，请重试。");
      } finally {
        clearInterval(fakeTimer);
        if (!cancelled) setLoading(false);
      }
    };

    runAnalysis();

    return () => {
      cancelled = true;
      clearInterval(fakeTimer);
    };
  }, []);

  // Confirm and proceed to platform selection
  const handleConfirm = () => {
    if (result) {
      const updated = { ...result, product_name: productName };
      sessionStorage.setItem("analysisResult", JSON.stringify(updated));
    }
    setLocation("/create/platform");
  };

  // Go back to upload
  const handleBack = () => {
    setLocation("/create/upload");
  };

  // ── Error state ──
  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-white">
        <StepIndicator currentStep={2} />
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="text-red-500 text-lg font-semibold mb-2">分析出错</div>
          <p className="text-sm text-gray-500 text-center mb-6">{error}</p>
          <Button onClick={handleBack} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回上传
          </Button>
        </div>
      </div>
    );
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-white">
        <StepIndicator currentStep={2} />
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <p className="text-lg font-semibold text-gray-800 mb-2">
            {progress < 30 ? "正在上传图片到AI引擎..." :
             progress < 60 ? "AI正在识别产品特征..." :
             progress < 90 ? "正在生成分析报告..." :
             "即将完成..."}
          </p>
          <p className="text-sm text-gray-400 mb-6">
            {progress < 60 ? "请稍候，正在识别产品特征与类别" : "分析快要完成了"}
          </p>

          {/* Progress bar */}
          <div className="w-full max-w-xs">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>分析进度</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Analysis complete state ──
  const displayCategory = result?.category || result?.product_type || "—";

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <StepIndicator currentStep={2} />
      <div className="flex-1 px-4 pt-6 pb-8">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <h2 className="text-xl font-bold text-gray-900">分析完成</h2>
        </div>
        <p className="text-sm text-gray-400 mb-6 ml-7">
          AI已完成产品识别，请确认以下信息
        </p>

        {/* Product name */}
        <div className="mb-5">
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            产品名称
          </label>
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setEditingName(false);
                }}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={() => setEditingName(false)}
              >
                确定
              </Button>
            </div>
          ) : (
            <div
              className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => setEditingName(true)}
            >
              <span className="text-base font-semibold text-gray-900 flex-1">
                {productName}
              </span>
              <Pencil className="w-4 h-4 text-gray-400" />
            </div>
          )}
        </div>

        {/* Product category */}
        <div className="mb-5">
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            产品类别
          </label>
          <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
            <span className="text-base text-gray-800">{displayCategory}</span>
          </div>
        </div>

        {/* Visual features */}
        {result?.visual_features && result.visual_features.length > 0 && (
          <div className="mb-5">
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              视觉特征
            </label>
            <div className="flex flex-wrap gap-2">
              {result.visual_features.map((feature, i) => (
                <span
                  key={i}
                  className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2.5 py-1 rounded-full"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {result?.suggestions && result.suggestions.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-1.5 mb-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <label className="text-sm font-medium text-gray-700">
                分析建议
              </label>
            </div>
            <ul className="space-y-1.5 pl-1">
              {result.suggestions.map((suggestion, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-gray-600"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 mt-auto pt-4">
          <Button
            variant="outline"
            className="flex-1 h-11 rounded-xl"
            onClick={handleBack}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回上传
          </Button>
          <Button
            className="flex-1 h-11 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold"
            onClick={handleConfirm}
          >
            确认并继续
          </Button>
        </div>
      </div>
    </div>
  );
}
