import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Check, CheckCircle2, Cpu, Pencil, X, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StepIndicator } from "@/components/StepIndicator";
import {
  ANALYSIS_DIRTY_KEY,
  ANALYSIS_SUPPLEMENT_LIST_KEY,
  type AnalysisResult,
  type CandidateItem,
  completeAnalysisRefresh,
  parseAnalysisSnapshot,
} from "@/lib/analysisSnapshot";
import { updateSessionRecord } from "@/lib/localUser";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { jobAPI, sessionAPI } from "@/lib/api";

const RECOGNITION_STEPS = ["产品类别识别", "产品结构识别", "应用场景识别"];
const ANALYZE_SUPPLEMENT_KEY = "from_analyze_supplement";

export default function AnalyzeStep() {
  const [, setLocation] = useLocation();
  const [analyzing, setAnalyzing] = useState(true);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
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
      const parsed = completeAnalysisRefresh(snapshot);
      const nextCandidates = parsed.category_candidates;
      const nextSelectedCategory =
        parsed.category ||
        nextCandidates[0]?.type ||
        "其他";

      const sid = sessionStorage.getItem("current_session_id");
      if (sid) {
        updateSessionRecord(sid, {
          product_name: parsed.product_name || "",
          thumbnail_url: snapshot?.images?.[0]?.url || "",
        });
      }
      sessionStorage.removeItem(ANALYZE_SUPPLEMENT_KEY);

      setCandidates(nextCandidates);
      setResult(parsed);
      setSelectedCategory(nextSelectedCategory);
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
      sessionStorage.setItem(
        ANALYSIS_SUPPLEMENT_LIST_KEY,
        JSON.stringify(updatedResult.supplement_image_recommendations || []),
      );
    sessionStorage.removeItem(ANALYZE_SUPPLEMENT_KEY);
    setLocation("/create/platform");
  };

  const handleSupplementImages = () => {
    if (result?.supplement_image_recommendations?.length) {
        sessionStorage.setItem(
          ANALYSIS_SUPPLEMENT_LIST_KEY,
          JSON.stringify(result.supplement_image_recommendations),
        );
    }
    sessionStorage.setItem(ANALYZE_SUPPLEMENT_KEY, "1");
    setLocation("/create/upload");
  };

  const topCandidate = candidates[0];
  const row1Tags = candidates.map((candidate) => candidate.type);
  const row2Tags = result?.scene_tags || [];
  const availableCategories = useMemo(() => {
    const values = [
      selectedCategory,
      result?.category,
      ...candidates.map((candidate) => candidate.type),
      "其他",
    ]
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    return Array.from(new Set(values));
  }, [candidates, result?.category, selectedCategory]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col aurora-bg">
        <StepIndicator currentStep={2} />
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <div className="mb-2 text-lg font-semibold text-red-500">识别失败</div>
          <p className="mb-6 text-center text-sm text-slate-400">{error}</p>
          <div className="flex items-center gap-3">
            <Button onClick={() => window.location.reload()} variant="outline" className="bg-white/5 text-white border-white/20 hover:bg-white/10 hover:text-white">
              重试识别
            </Button>
            <Button onClick={() => setLocation("/create/upload")} variant="outline" className="bg-white/5 text-white border-white/20 hover:bg-white/10 hover:text-white">
              返回上传
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (analyzing) {
    return (
      <div className="flex min-h-screen flex-col aurora-bg">
        <StepIndicator currentStep={2} />
        <div className="flex-1 px-4 pb-6 pt-4 relative z-10">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-white">AI 视觉识别</h2>
            <p className="mt-0.5 text-sm text-slate-300">正在识别产品品类与结构特征</p>
          </div>
          
          <div className="mb-4 glass-panel rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              <span className="text-sm font-medium text-white">识别进度</span>
            </div>
            <div className="space-y-2 pl-4">
              {RECOGNITION_STEPS.map((step) => (
                <div key={step} className="flex items-center gap-3 text-sm text-slate-300">
                  <div className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-slate-600 animate-spin">
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  </div>
                  {step}
                </div>
              ))}
            </div>
          </div>

          <div className="relative mb-5 flex h-[340px] items-center justify-center overflow-hidden rounded-[32px] glass-panel border-cyan-500/10 shadow-[0_0_40px_rgba(6,182,212,0.15)] transition-all">
            {/* 扫描线动画 */}
            <div className="scanner-line h-1.5 opacity-80"></div>
            
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {/* Gemini Blobs behind the image */}
              <div className="absolute flex items-center justify-center w-full h-full opacity-70">
                <div className="gemini-blob gemini-blob-1"></div>
                <div className="gemini-blob gemini-blob-2"></div>
                <div className="gemini-blob gemini-blob-3"></div>
              </div>

              <div className="h-[240px] w-[240px] animate-[ping_4s_ease-in-out_infinite] rounded-full border border-cyan-400/30" />
              <div className="absolute h-40 w-40 rounded-full border border-cyan-400/40 shadow-[0_0_30px_rgba(34,211,238,0.2)]" />
              <div className="absolute h-28 w-28 rounded-full border border-cyan-300/50" />
            </div>
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent pointer-events-none" />
            
            {/* 角标 */}
            <div className="absolute left-3 top-3 h-6 w-6 rounded-tl-lg border-l-2 border-t-2 border-cyan-400/60" />
            <div className="absolute right-3 top-3 h-6 w-6 rounded-tr-lg border-r-2 border-t-2 border-cyan-400/60" />
            <div className="absolute bottom-3 left-3 h-6 w-6 rounded-bl-lg border-b-2 border-l-2 border-cyan-400/60" />
            <div className="absolute bottom-3 right-3 h-6 w-6 rounded-br-lg border-b-2 border-r-2 border-cyan-400/60" />
            
            {firstImageUrl ? (
              <img src={firstImageUrl} alt="产品" className="relative z-10 h-64 w-64 md:h-72 md:w-72 object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.25)] mix-blend-normal" />
            ) : (
              <Cpu className="relative z-10 h-24 w-24 text-cyan-400/90 drop-shadow-[0_0_20px_rgba(34,211,238,0.6)]" />
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
    <div className="flex min-h-screen flex-col aurora-bg">
      <StepIndicator currentStep={2} />
      <div className="flex-1 px-4 pb-6 pt-4 relative z-10">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white">AI 视觉识别</h2>
          <p className="mt-0.5 text-sm text-slate-300">正在识别产品品类与结构特征</p>
        </div>

        <div className="mb-4 glass-panel rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            <span className="text-sm font-medium text-white">识别进度</span>
          </div>
          <div className="space-y-2 pl-4">
            {RECOGNITION_STEPS.map((step) => (
              <div key={step} className="flex items-center gap-3 text-sm text-slate-200">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-cyan-400" />
                {step}
              </div>
            ))}
          </div>
        </div>

        <div className="relative mb-5 flex h-[340px] items-center justify-center overflow-hidden rounded-[32px] glass-panel border-cyan-500/10 shadow-[0_0_40px_rgba(6,182,212,0.1)] transition-all">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             {/* Dimmer Gemini Blobs for finished state */}
              <div className="absolute flex items-center justify-center w-full h-full opacity-30">
                <div className="gemini-blob gemini-blob-1"></div>
                <div className="gemini-blob gemini-blob-2"></div>
                <div className="gemini-blob gemini-blob-3"></div>
              </div>
            <div className="h-[200px] w-[200px] rounded-full border border-cyan-500/20" />
            <div className="absolute h-36 w-36 rounded-full border border-cyan-400/30" />
            <div className="absolute h-24 w-24 rounded-full border border-cyan-300/40" />
          </div>
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent pointer-events-none" />
          <div className="absolute left-3 top-3 h-6 w-6 rounded-tl-lg border-l-2 border-t-2 border-cyan-400/60" />
          <div className="absolute right-3 top-3 h-6 w-6 rounded-tr-lg border-r-2 border-t-2 border-cyan-400/60" />
          <div className="absolute bottom-3 left-3 h-6 w-6 rounded-bl-lg border-b-2 border-l-2 border-cyan-400/60" />
          <div className="absolute bottom-3 right-3 h-6 w-6 rounded-br-lg border-b-2 border-r-2 border-cyan-400/60" />
          {firstImageUrl ? (
            <img src={firstImageUrl} alt="产品" className="relative z-10 h-64 w-64 md:h-72 md:w-72 object-contain drop-shadow-[0_0_25px_rgba(255,255,255,0.2)] mix-blend-normal" />
          ) : (
            <Cpu className="relative z-10 h-24 w-24 text-cyan-400/60" />
          )}
        </div>

        <div className="mb-2 glass-panel rounded-2xl p-4">
          <p className="mb-2 text-sm text-slate-400">识别结果</p>
          <div className="mb-3 flex items-center justify-between">
            {editingName ? (
              <div className="mr-2 flex flex-1 items-center gap-2">
                <input
                  autoFocus
                  value={editedName}
                  onChange={(event) => setEditedName(event.target.value)}
                  className="min-w-0 flex-1 border-b-2 border-cyan-400 bg-transparent text-lg font-bold text-white outline-none placeholder:text-slate-500"
                />
                <button onClick={commitEditedName} className="text-cyan-400 hover:text-cyan-300">
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setEditedName(result.product_name);
                    setEditingName(false);
                  }}
                  className="text-slate-400 hover:text-slate-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold text-white tracking-wide">
                  {editedName || result.product_name}
                </span>
                <button
                  onClick={() => {
                    setEditedName(editedName || result.product_name);
                    setEditingName(true);
                  }}
                  className="text-slate-400 transition-colors hover:text-cyan-400"
                  title="修改产品名称"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {topCandidate && !editingName && (
              <span className="shrink-0 rounded-full bg-cyan-900/60 border border-cyan-500/30 px-2.5 py-1 text-xs font-semibold text-cyan-300">
                置信度 {Math.round(topCandidate.confidence)}%
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

        <div className="mb-4 rounded-2xl glass-panel border-white/10 p-5 shadow-lg">
          <p className="mb-2 text-sm font-semibold text-slate-200">确认产品类别</p>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="mb-2 w-full rounded-xl border-white/10 bg-black/40 text-sm text-slate-100 hover:bg-black/60 focus:ring-cyan-500">
              <SelectValue placeholder="选择产品类型" />
            </SelectTrigger>
            <SelectContent>
              {availableCategories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <p className="mb-4 text-xs text-cyan-400/80">
            AI 建议：{result.category || "其他"}，您可以确认或修改
          </p>

          {(result.expected_components?.length || result.confusion_pairs?.length) ? (
            <div className="mb-4 bg-orange-900/20 border border-orange-500/30 rounded-xl p-3">
              <p className="text-xs font-bold text-orange-400 mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> 类目物理规律强化校验
              </p>
              {result.expected_components && result.expected_components.length > 0 && (
                <div className="mb-2">
                  <p className="text-[10px] text-slate-400 mb-1">预期识别件：</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.expected_components.map((comp, idx) => (
                      <span key={idx} className="bg-orange-500/10 border border-orange-500/20 text-orange-300 text-[10px] px-2 py-0.5 rounded-full font-medium">
                        {comp}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {result.confusion_pairs && result.confusion_pairs.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-400 mb-1">易混淆组件特征：</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.confusion_pairs.map((pair, idx) => (
                      <span key={idx} className="bg-red-500/10 border border-red-500/20 text-red-300 text-[10px] px-2 py-0.5 rounded-full font-medium">
                        {pair[0]} <span className="text-slate-500 mx-0.5">vs</span> {pair[1]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {result.supplement_image_recommendations.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-slate-400">建议补传以下图片：</p>
              <div className="space-y-3">
                {result.supplement_image_recommendations
                  .slice()
                  .sort((a, b) => a.priority - b.priority)
                  .map((item, index) => (
                    <div key={`${item.slot_type}-${item.image_kind || "base"}-${index}`} className="rounded-xl border border-white/5 bg-black/20 p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-200">{item.label}</div>
                          <div className="mt-1 text-xs text-slate-400 leading-relaxed">{item.reason}</div>
                        </div>
                        <span className="rounded-full bg-cyan-900/40 border border-cyan-500/20 px-2 py-0.5 text-[11px] font-medium text-cyan-300 shrink-0">
                          P{item.priority}
                        </span>
                      </div>
                      <div className="mt-3 space-y-1.5 text-xs text-slate-300">
                        {item.upload_goal && <p>补图目标：{item.upload_goal}</p>}
                        {item.must_show && <p>必须拍到：{item.must_show}</p>}
                        {item.framing_hint && <p>构图建议：{item.framing_hint}</p>}
                        {item.example_caption && <p>示例标题：{item.example_caption}</p>}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {result.suggestions.length > 0 && (
            <div className="mb-4 bg-black/20 rounded-xl p-3 border border-white/5">
              <p className="mb-2 text-xs text-slate-400">补充说明：</p>
              <ul className="space-y-1.5">
                {result.suggestions.map((suggestion, index) => (
                  <li
                    key={`${suggestion}-${index}`}
                    className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-500/60 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
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
              className="h-11 flex-1 rounded-xl border-white/10 bg-white/5 text-sm text-slate-200 hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              确认
            </Button>
            <Button
              size="sm"
              className="h-11 flex-1 rounded-xl bg-cyan-600/80 text-sm text-white hover:bg-cyan-500 transition-colors shadow-lg shadow-cyan-900/50"
              onClick={handleSupplementImages}
            >
              补充图片
            </Button>
          </div>
        </div>

        {/* DEV INFO BLOCK */}
        {(import.meta.env.DEV || localStorage.getItem("dev_debug") === "1") && ((result.risk_flags?.length ?? 0) > 0 || result.selling_point_entities || result.evidence_scores) && (
          <div className="mb-4 rounded-2xl glass-panel border-purple-500/30 p-5 shadow-lg bg-purple-900/10">
            <h3 className="mb-3 text-sm font-bold text-purple-400 flex items-center gap-2">
               <AlertCircle className="w-4 h-4" /> 内部调试 / 开发数据
            </h3>
            
            {result.risk_flags && result.risk_flags.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-slate-400 mb-1.5">风险提示 (Risk Flags):</p>
                <div className="flex flex-wrap gap-2">
                  {result.risk_flags.map((rf, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-red-900/40 border border-red-500/30 text-[11px] text-red-300">
                      {rf}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {result.selling_point_entities && (
              <div className="mb-3">
                <p className="text-xs text-slate-400 mb-1.5">卖点实体解析 (Selling Point Entities):</p>
                <pre className="text-[10px] text-slate-300 bg-black/40 p-2 rounded max-h-32 overflow-auto custom-scrollbar border border-white/5">
                  {JSON.stringify(result.selling_point_entities, null, 2)}
                </pre>
              </div>
            )}

            {result.evidence_scores && (
               <div>
                <p className="text-xs text-slate-400 mb-1.5">数据支撑置信区间 (Evidence Scores):</p>
                <pre className="text-[10px] text-slate-300 bg-black/40 p-2 rounded max-h-32 overflow-auto custom-scrollbar border border-white/5 whitespace-pre-wrap">
                   {JSON.stringify(result.evidence_scores, null, 2)}
                </pre>
               </div>
            )}
          </div>
        )}

        <Button
          onClick={handleConfirmAndNext}
          disabled={!selectedCategory}
          className="sci-fi-button h-14 w-full text-base font-bold tracking-wider"
        >
          下一步
        </Button>
      </div>
    </div>
  );
}
