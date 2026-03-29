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
    styleTag: "主图展示",
    styleDesc: "产品全景·品质感",
    extractContent: (copy) => {
      const lines: string[] = [];
      const name = copy.product_name || "";
      const cat = copy.category || "";
      if (name) lines.push(`产品名称: ${name}`);
      if (cat) lines.push(`产品品类: ${cat}`);
      const scene = copy.hero_scene || "";
      if (scene) lines.push(`主图场景: ${scene}`);
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
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <DetailStepIndicator currentStep={1} />

      {/* ── Loading state ─────────────────────────────────────────────── */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <Loader2 className="w-9 h-9 text-blue-600 animate-spin" />
          </div>
          <p className="text-base font-semibold text-slate-700">
            AI 正在生成详情页执行方案...
          </p>
          <div className="space-y-1.5 text-center">
            <p className="text-xs text-slate-400 animate-pulse">
              正在分析产品信息与卖点...
            </p>
            <p className="text-xs text-slate-400 animate-pulse">
              正在生成六大模块内容...
            </p>
          </div>
        </div>
      )}

      {/* ── Error state ───────────────────────────────────────────────── */}
      {!loading && error && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20">
          <p className="text-sm text-slate-500">{error}</p>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setLocation("/create/generate")}
              variant="outline"
            >
              返回上一页
            </Button>
            <Button
              onClick={forceRegenerateCopy}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              重新生成
            </Button>
          </div>
        </div>
      )}

      {/* ── Content ───────────────────────────────────────────────────── */}
      {!loading && !error && (
        <div className="flex-1 overflow-y-auto pb-20">
          {/* ── White header bar ─────────────────────────────────────── */}
          <div className="bg-white border-b px-4 py-3">
            <h1 className="text-base font-bold text-slate-900">AI已生成详情页执行方案</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              根据商品图已生成平台规则，AI已为您规划可直接生成的详情页内容。
            </p>
          </div>

          {/* ── Yellow "生产流程" badge ──────────────────────────────── */}
          <div className="bg-white border-b px-4 py-2 flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-yellow-400 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              <Zap className="w-3 h-3" />
              生产流程
              <ChevronRight className="w-3 h-3" />
            </div>
          </div>

            {/* ── Module cards (only show modules with content) ──────── */}
            {orderedModules.map((mod) => {
              const Icon = mod.icon;
              const content = mod.extractContent(copyData, analysisSnapshot);

              // Skip modules with no real content
              if (content.length === 0) return null;

              const titleLine = content[0] || "";
              const bodyLines = content.slice(1);

              return (
                <div
                  key={mod.key}
                  className="bg-white border-b"
                >
                  {/* 模块编号标题 */}
                  <div className="px-4 py-2.5 flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-700">{mod.label}</span>
                  </div>

                  {/* 内容区：文案 */}
                  <div className="px-4 pb-3">
                    <div className="w-full">
                      {/* 标题文案 */}
                      {titleLine && (
                        <div className={`${mod.bgColor} rounded-lg px-3 py-2 mb-2`}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <Icon className={`w-3.5 h-3.5 ${mod.color} shrink-0`} />
                            <span className={`text-xs font-semibold ${mod.color}`}>{mod.label}</span>
                          </div>
                          <p className="text-sm font-medium text-slate-800 leading-snug">{titleLine}</p>
                        </div>
                      )}
                      {/* 正文内容 */}
                      {bodyLines.length > 0 && (
                        <div className="space-y-0.5">
                          {bodyLines.map((line, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                              <span className="mt-0.5 shrink-0 text-slate-300">&bull;</span>
                              <span className="leading-relaxed">{line.replace(/^[•·\-\*]\s*/, "")}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 风格标签行 */}
                  <div className="px-4 pb-3 flex items-center gap-2">
                    <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full cursor-pointer hover:bg-blue-100">
                      {mod.styleTag}
                    </span>
                    <span className="text-xs text-slate-500">{mod.styleDesc}</span>
                    <ChevronRight className="w-3 h-3 text-slate-300 ml-auto" />
                  </div>
                </div>
              );
            })}

          {/* ── Footer text ─────────────────────────────────────────── */}
          <div className="px-4 py-1.5 text-xs text-slate-400 text-center">
            AI 预计生成：6-8 张详情图
          </div>
        </div>
      )}

      {/* ── Bottom fixed bar ──────────────────────────────────────────── */}
      {!loading && !error && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-3 flex items-center gap-2 z-50">
          <Button
            variant="outline"
            onClick={handleModify}
            className="flex items-center gap-1.5 text-sm px-4"
          >
            <Edit2 className="w-4 h-4" />
            修改内容
          </Button>
          <Button
            onClick={handleGenerateAll}
            className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-white font-bold text-sm flex items-center justify-center gap-1.5"
          >
            <Zap className="w-4 h-4" />
            生成全部详情图
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleShare}
            className="shrink-0"
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
