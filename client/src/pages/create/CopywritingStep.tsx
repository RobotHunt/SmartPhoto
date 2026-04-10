import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  Loader2,
  Zap,
  Edit2,
  Share2,
  ChevronRight,
  Monitor,
  Star,
  Search,
  MapPin,
  BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { sessionAPI, jobAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { DetailStepIndicator } from "./DetailStepIndicator";
import GenerationWaitingUI from "@/components/GenerationWaitingUI";

// ── Types ────────────────────────────────────────────────────────────────────

interface CopyData {
  product_name?: string;
  category?: string;
  category_name?: string;
  hero_scene?: string;
  headline?: string;
  core_selling_points?: string[];
  selling_points_text?: string;
  key_parameters?: Array<{ key?: string; label?: string; value?: string }>;
  specs_text?: string;
  product_advantages?: string[];
  scenes_text?: string;
  usage_scenes?: string;
  copy_draft?: string;
  [key: string]: any;
}

interface AnalysisSnapshot {
  product_name?: string;
  category?: string;
  visual_features?: string[];
  suggestions?: string[];
  [key: string]: any;
}

// ── MODULE_CONFIG with 6 modules ─────────────────────────────────────────────

interface ModuleConfig {
  key: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  label: string;
  styleTag: string;
  styleDesc: string;
  extractContent: (copy: CopyData, snap: AnalysisSnapshot) => string[];
}

const MODULE_CONFIG: ModuleConfig[] = [
  {
    key: "product_display",
    icon: Monitor,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    label: "产品展示",
    styleTag: "全景展示",
    styleDesc: "产品全景·品质感",
    extractContent: (copy) => {
      const lines: string[] = [];
      const name = copy.product_name || "";
      const cat = copy.category || "";
      if (name) lines.push(`产品名称: ${name}`);
      if (cat) lines.push(`产品品类: ${cat}`);
      const scene = copy.hero_scene || "";
      if (scene) lines.push(`核心场景: ${scene}`);
      return lines;
    },
  },
  {
    key: "core_selling_point",
    icon: Star,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    label: "核心卖点",
    styleTag: "卖点图",
    styleDesc: "痛点击中·技术风",
    extractContent: (copy) => {
      return copy.core_selling_points || [];
    },
  },
  {
    key: "function_description",
    icon: Zap,
    color: "text-violet-600",
    bgColor: "bg-violet-50",
    label: "功能说明",
    styleTag: "功能图",
    styleDesc: "制图高清·制图风格",
    extractContent: (copy) => {
      return copy.product_advantages || [];
    },
  },
  {
    key: "product_details",
    icon: Search,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    label: "产品细节",
    styleTag: "细节图",
    styleDesc: "工艺细节·品质感",
    extractContent: (copy) => {
      const lines: string[] = [];
      if (copy.selling_points_text) {
        lines.push(...copy.selling_points_text.split(/[|｜\n]/).filter(Boolean).map(s => s.trim()));
      }
      if (lines.length === 0 && copy.headline) {
        lines.push(copy.headline);
      }
      return lines;
    },
  },
  {
    key: "usage_scenarios",
    icon: MapPin,
    color: "text-green-600",
    bgColor: "bg-green-50",
    label: "使用场景",
    styleTag: "场景图",
    styleDesc: "生活场景·温馨风",
    extractContent: (copy) => {
      const lines: string[] = [];
      if (copy.scenes_text) {
        lines.push(...copy.scenes_text.split(/[|｜\n]/).filter(Boolean).map(s => s.trim()));
      } else if (copy.usage_scenes) {
        lines.push(...String(copy.usage_scenes).split(/[|｜\n]/).filter(Boolean).map(s => s.trim()));
      }
      return lines;
    },
  },
  {
    key: "product_parameters",
    icon: BarChart2,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    label: "产品参数",
    styleTag: "参数图",
    styleDesc: "数据清晰·专业风",
    extractContent: (copy) => {
      const params = copy.key_parameters || [];
      if (params.length > 0) {
        return params.map(
          (p: any) => `${p.label || p.key || "参数"}: ${p.value || ""}`
        );
      }
      return [];
    },
  },
];

const MODULE_ORDER = [
  "product_display",
  "core_selling_point",
  "function_description",
  "product_details",
  "usage_scenarios",
  "product_parameters",
];

// ── All regeneration targets (must match backend COPY_TARGETS) ──────────────

const ALL_TARGETS = [
  "headline",
  "selling_points",
  "usage_scenes",
  "specs",
];

// ── Component ────────────────────────────────────────────────────────────────

export default function CopywritingStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const detailFlowOrigin = sessionStorage.getItem("detail_flow_origin") || "generate";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyData, setCopyData] = useState<CopyData>({});
  const [analysisSnapshot, setAnalysisSnapshot] = useState<AnalysisSnapshot>(
    {}
  );

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── helpers ──────────────────────────────────────────────────────────────

  const getSessionId = useCallback((): string => {
    const id = sessionStorage.getItem("current_session_id") || "";
    if (!id) throw new Error("缺少会话ID，请返回重新开始");
    return id;
  }, []);

  const isCopyEmpty = (data: any): boolean => {
    if (!data) return true;
    return (
      !data.headline &&
      !data.hero_scene &&
      !data.selling_points_text &&
      !data.core_selling_points?.length &&
      !data.scenes_text &&
      !data.specs_text &&
      !data.key_parameters?.length &&
      !data.product_name
    );
  };

  // ── load analysis snapshot ─────────────────────────────────────────────

  const loadAnalysisSnapshot = useCallback(async (sessionId: string) => {
    try {
      const analysis = await sessionAPI.getAnalysis(sessionId);
      const snap = analysis?.analysis_snapshot || analysis || {};
      if (mountedRef.current) setAnalysisSnapshot(snap);
      return snap;
    } catch {
      // Fallback to sessionStorage
      try {
        const stored = sessionStorage.getItem("analysis_snapshot_full");
        if (stored) {
          const snap = JSON.parse(stored);
          if (mountedRef.current) setAnalysisSnapshot(snap);
          return snap;
        }
      } catch {
        // ignore
      }
      return {};
    }
  }, []);

  // ── load or generate copy on mount ─────────────────────────────────────

  const loadOrGenerateCopy = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sessionId = getSessionId();

      // Load analysis snapshot in parallel with copy
      const [, existingCopy] = await Promise.allSettled([
        loadAnalysisSnapshot(sessionId),
        sessionAPI.getCopy(sessionId).catch(() => null),
      ]);

      const copyResult =
        existingCopy.status === "fulfilled" ? existingCopy.value : null;

      if (copyResult && !isCopyEmpty(copyResult)) {
        if (mountedRef.current) setCopyData(copyResult);
        return;
      }

      // No copy exists — trigger generation
      const { job_id } = await sessionAPI.regenerateCopy(
        sessionId,
        ALL_TARGETS
      );
      await jobAPI.pollUntilDone(job_id, undefined, 2000, 120000);

      const result = await sessionAPI.getCopy(sessionId);
      if (!result || isCopyEmpty(result)) {
        throw new Error("生成结果为空，请重试");
      }
      if (mountedRef.current) setCopyData(result);
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.message || "加载文案失败");
        toast({
          title: "加载失败",
          description: err.message || "未知错误",
          variant: "destructive",
        });
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [getSessionId, loadAnalysisSnapshot, toast]);

  // ── force regenerate copy (always re-generates, ignores existing) ─────

  const forceRegenerateCopy = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sessionId = getSessionId();

      await loadAnalysisSnapshot(sessionId);

      const { job_id } = await sessionAPI.regenerateCopy(
        sessionId,
        ALL_TARGETS
      );
      await jobAPI.pollUntilDone(job_id, undefined, 2000, 120000);

      const result = await sessionAPI.getCopy(sessionId);
      if (!result || isCopyEmpty(result)) {
        throw new Error("生成结果为空，请重试");
      }
      if (mountedRef.current) {
        setCopyData(result);
        toast({ title: "文案已重新生成" });
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.message || "重新生成失败");
        toast({
          title: "重新生成失败",
          description: err.message || "未知错误",
          variant: "destructive",
        });
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [getSessionId, loadAnalysisSnapshot, toast]);

  useEffect(() => {
    loadOrGenerateCopy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── navigation ─────────────────────────────────────────────────────────

  const handleModify = useCallback(() => {
    setLocation(detailFlowOrigin === "hd-result" ? "/create/hd-result" : "/create/generate");
  }, [detailFlowOrigin, setLocation]);

  const handleGenerateAll = useCallback(() => {
    sessionStorage.setItem("generation_target", "detail_page");
    setLocation("/create/detail-confirm");
  }, [setLocation]);

  // ── ordered modules ────────────────────────────────────────────────────

  const orderedModules = MODULE_ORDER.map(
    (key) => MODULE_CONFIG.find((m) => m.key === key)!
  );

  const handleShare = useCallback(() => {
    const modules = MODULE_ORDER
      .map((key) => {
        const mod = MODULE_CONFIG.find((m) => m.key === key)!;
        const content = mod.extractContent(copyData, analysisSnapshot);
        if (content.length === 0) return "";
        return `【${mod.label}】\n${content.join("\n")}`;
      })
      .filter(Boolean)
      .join("\n\n");
    navigator.clipboard.writeText(modules).catch(() => {});
    toast({ title: "已复制全部文案到剪贴板" });
  }, [copyData, analysisSnapshot, toast]);

  // ── render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen aurora-bg flex flex-col pt-8 sm:pt-12">
      <div className="w-full max-w-5xl mx-auto px-4 relative z-10 w-full pb-28">
        <DetailStepIndicator currentStep={1} />

      {/* ── Loading state ─────────────────────────────────────────────── */}
      {loading && (
        <GenerationWaitingUI kind="analysis" progress={0} stage="正在生成专属策略" />
      )}

      {/* ── Error state ───────────────────────────────────────────────── */}
      {!loading && error && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 py-32 h-[50vh]">
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl backdrop-blur-md">
            <p className="text-base font-bold tracking-wide text-red-400">{error}</p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => setLocation("/create/generate")}
              className="px-6 h-12 bg-slate-100 border border-slate-200 hover:bg-slate-200 hover:border-slate-300 text-slate-600 rounded-xl font-bold tracking-widest font-sm"
            >
              返回上一页
            </Button>
            <Button
              onClick={forceRegenerateCopy}
              className="px-6 h-12 bg-blue-600 hover:bg-blue-500 text-slate-900 rounded-xl shadow-md font-bold tracking-widest font-sm"
            >
              重新连接引擎
            </Button>
          </div>
        </div>
      )}

      {/* ── Content ───────────────────────────────────────────────────── */}
      {!loading && !error && (
        <div className="flex-1 w-full pb-10">
          <div className="glass-panel border-slate-200 rounded-2xl p-6 sm:p-8 mb-8 mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-1.5 h-6 bg-blue-400 rounded-full shadow-sm"></div>
                  <h1 className="text-xl font-bold tracking-widest text-slate-900">AI 执行策略已生成</h1>
                </div>
                <p className="text-sm font-medium tracking-wide text-slate-500 pl-4">
                  根据商品分析与参数提取，已为您规划核心卖点。
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto bg-blue-100 border border-blue-200 text-blue-600 text-xs font-bold px-4 py-2 rounded-xl">
                <Zap className="w-3.5 h-3.5" />
                标准流程
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* ── Module cards (only show modules with content) ──────── */}
            {orderedModules.map((mod) => {
              const Icon = mod.icon;
              const content = mod.extractContent(copyData, analysisSnapshot);

              // Skip modules with no real content
              if (content.length === 0) return null;

              const titleLine = content[0] || "";
              const bodyLines = content.slice(1);

              return (
                <div key={mod.key} className="glass-panel border-slate-200 rounded-2xl p-5 shadow-xl flex flex-col h-full hover:border-blue-300 transition-all group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${mod.bgColor.replace('50', '950/40')} border ${mod.bgColor.replace('bg-', 'border-').replace('50', '500/20')}`}>
                        <Icon className={`w-4 h-4 ${mod.color.replace('600', '400')}`} />
                      </div>
                      <span className="text-base font-bold tracking-wider text-slate-900 group-hover:text-slate-900 transition-colors">{mod.label}</span>
                    </div>
                    <div className="px-2.5 py-1 rounded border border-slate-200 bg-slate-100 text-[10px] text-slate-500 uppercase tracking-widest">
                      Module
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-3">
                    {titleLine && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-3">
                        <p className="text-sm font-bold tracking-wide text-slate-700 leading-snug">{titleLine}</p>
                      </div>
                    )}
                    
                    {bodyLines.length > 0 && (
                      <div className="space-y-3 px-2">
                        {bodyLines.map((line, i) => (
                          <div key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                            <div className={`mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full ${mod.bgColor.replace('bg-', 'bg-').replace('50', '400')} `}></div>
                            <span className="leading-relaxed font-medium tracking-wide">{line.replace(/^[•·\-\*]\s*/, "")}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold tracking-wider text-blue-600 bg-blue-100 border border-blue-200 px-2 py-1 rounded-md">
                        {mod.styleTag}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-slate-500">{mod.styleDesc}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer stats */}
          <div className="mt-10 px-4 py-3 flex items-center justify-center">
            <div className="px-4 py-1.5 bg-white/80 border border-slate-200 rounded-full">
               <span className="text-xs font-bold tracking-widest text-slate-500 uppercase">
                 已完成基于商品图片的参数提取与卖点生成
               </span>
            </div>
          </div>
        </div>
      )}

      {/* Button dock */}
      {!loading && !error && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 p-4 flex justify-center z-50">
          <div className="w-full max-w-4xl flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleModify}
              className="h-14 px-6 bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-2xl tracking-widest text-sm font-bold shadow-lg"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              调整方案
            </Button>
            <Button
              onClick={handleGenerateAll}
              className="sci-fi-button flex-1 h-14 bg-blue-600 hover:bg-blue-500 text-white font-bold tracking-widest text-base rounded-2xl shadow-md flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5 fill-white/80 shrink-0" />
              确认卖点，继续生成
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleShare}
              className="h-14 w-14 border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-blue-600 rounded-2xl shrink-0 transition-colors shadow-lg"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}
      </div></div>
  );
}
