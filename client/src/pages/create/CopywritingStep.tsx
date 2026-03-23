import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Loader2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StepIndicator } from "@/components/StepIndicator";
import { sessionAPI, jobAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

/** Shape returned by GET /sessions/:id/copy */
interface CopyData {
  product_name: string;
  category_name: string;
  headline: string;
  selling_points_text: string;
  scenes_text: string;
  specs_text: string;
  key_parameters: string[];
  product_advantages: string[];
}

/** Fields that support AI regeneration */
const REGENERABLE_TARGETS = [
  "headline",
  "selling_points",
  "scenes",
  "specs",
] as const;

type RegenerableField = (typeof REGENERABLE_TARGETS)[number];

/** Map regeneration target names to CopyData keys */
const TARGET_TO_KEY: Record<RegenerableField, keyof CopyData> = {
  headline: "headline",
  selling_points: "selling_points_text",
  scenes: "scenes_text",
  specs: "specs_text",
};

const ALL_TARGETS = [
  "headline",
  "selling_points",
  "scenes",
  "specs",
  "product_name",
  "category",
];

export default function CopywritingStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // ── state ──────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regeneratingField, setRegeneratingField] = useState<string | null>(null);

  const [productName, setProductName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [headline, setHeadline] = useState("");
  const [sellingPoints, setSellingPoints] = useState("");
  const [scenes, setScenes] = useState("");
  const [specs, setSpecs] = useState("");

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── helpers ────────────────────────────────────────────────────────────
  const getSessionId = useCallback((): string => {
    const id = sessionStorage.getItem("current_session_id") || "";
    if (!id) throw new Error("缺少会话ID，请返回重新开始");
    return id;
  }, []);

  /** Apply backend copy response to local state */
  const applyCopy = useCallback((data: CopyData) => {
    setProductName(data.product_name || "");
    setCategoryName(data.category_name || data.category || "");
    // Backend may return structured fields or legacy text fields
    setHeadline(data.headline || data.hero_scene || "");
    setSellingPoints(
      data.selling_points_text ||
      (Array.isArray(data.core_selling_points) ? data.core_selling_points.join("\n") : "") ||
      data.selling_points || ""
    );
    setScenes(
      data.scenes_text ||
      data.usage_scenes || ""
    );
    setSpecs(
      data.specs_text ||
      (Array.isArray(data.key_parameters)
        ? data.key_parameters.map((p: any) => `${p.label || p.key}: ${p.value}`).join("\n")
        : "") ||
      data.specs || ""
    );
  }, []);

  /** Check if the copy data is essentially empty */
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

  // ── load or generate copy on mount ─────────────────────────────────────
  const loadOrGenerateCopy = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sessionId = getSessionId();

      // 1) Try loading existing copy
      let copyData: CopyData | null = null;
      try {
        copyData = await sessionAPI.getCopy(sessionId);
      } catch {
        // No copy yet, will generate below
      }

      if (copyData && !isCopyEmpty(copyData)) {
        if (mountedRef.current) applyCopy(copyData);
        return;
      }

      // 2) No copy exists — trigger generation
      const { job_id } = await sessionAPI.regenerateCopy(sessionId, ALL_TARGETS);

      // 3) Poll until complete
      await jobAPI.pollUntilDone(job_id, undefined, 2000, 120000);

      // 4) Fetch generated copy
      const result = await sessionAPI.getCopy(sessionId);
      if (!result || isCopyEmpty(result)) {
        throw new Error("生成结果为空，请重试");
      }
      if (mountedRef.current) applyCopy(result);
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.message || "加载文案失败");
        toast({ title: "加载失败", description: err.message || "未知错误", variant: "destructive" });
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [getSessionId, applyCopy, toast]);

  useEffect(() => {
    loadOrGenerateCopy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── single-field AI regeneration ───────────────────────────────────────
  const handleRegenerate = useCallback(
    async (field: RegenerableField) => {
      if (regeneratingField) return; // one at a time
      setRegeneratingField(field);
      try {
        const sessionId = getSessionId();
        const { job_id } = await sessionAPI.regenerateCopy(sessionId, [field]);
        await jobAPI.pollUntilDone(job_id, undefined, 2000, 120000);
        const result = await sessionAPI.getCopy(sessionId);
        if (result && mountedRef.current) {
          // Only update the regenerated field
          const key = TARGET_TO_KEY[field];
          const value = (result as any)[key] || "";
          switch (field) {
            case "headline":
              setHeadline(value);
              break;
            case "selling_points":
              setSellingPoints(value);
              break;
            case "scenes":
              setScenes(value);
              break;
            case "specs":
              setSpecs(value);
              break;
          }
          toast({ title: "重新生成成功" });
        }
      } catch (err: any) {
        toast({
          title: "重新生成失败",
          description: err.message || "未知错误",
          variant: "destructive",
        });
      } finally {
        if (mountedRef.current) setRegeneratingField(null);
      }
    },
    [regeneratingField, getSessionId, toast]
  );

  // ── save & navigate ────────────────────────────────────────────────────
  const handleNext = useCallback(async () => {
    setSaving(true);
    try {
      const sessionId = getSessionId();
      await sessionAPI.saveCopy(sessionId, {
        product_name: productName,
        category: categoryName,
        hero_scene: headline,
        core_selling_points: sellingPoints.split("\n").filter(Boolean),
        product_advantages: [],
        key_parameters: specs.split("\n").filter(Boolean).map(line => {
          const [label, ...rest] = line.split(/[:：]/);
          return { key: label?.trim() || '', label: label?.trim() || '', value: rest.join(':').trim() };
        }),
        // Legacy fields for backward compatibility
        headline,
        selling_points: sellingPoints,
        usage_scenes: scenes,
        specs,
      });
      setLocation("/create/confirm");
    } catch (err: any) {
      toast({
        title: "保存失败",
        description: err.message || "未知错误",
        variant: "destructive",
      });
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [
    getSessionId,
    productName,
    categoryName,
    headline,
    sellingPoints,
    scenes,
    specs,
    setLocation,
    toast,
  ]);

  const handleBack = useCallback(() => {
    setLocation("/create/generate");
  }, [setLocation]);

  // ── render helpers ─────────────────────────────────────────────────────

  /** A textarea field with an optional AI regeneration button */
  const renderTextareaField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    field: RegenerableField,
    rows = 4
  ) => {
    const isRegenerating = regeneratingField === field;
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700">{label}</label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!!regeneratingField}
            onClick={() => handleRegenerate(field)}
            className="h-7 text-xs gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            {isRegenerating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            AI重新生成
          </Button>
        </div>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          disabled={isRegenerating}
          className={isRegenerating ? "opacity-50" : ""}
        />
      </div>
    );
  };

  // ── UI ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Step indicator — step 4 */}
      <StepIndicator currentStep={4} />

      {/* Header */}
      <div className="bg-white border-b px-4 py-3">
        <h1 className="text-base font-bold text-slate-900">文案确认</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          确认AI生成的文案内容，可直接编辑或点击"AI重新生成"刷新单个字段。
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
          <p className="text-sm font-semibold text-slate-700">AI 正在生成文案...</p>
          <div className="space-y-1 text-xs text-slate-400 text-center">
            <p className="animate-pulse">正在分析产品信息...</p>
            <p className="animate-pulse">正在生成营销文案...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20">
          <p className="text-sm text-slate-500">{error}</p>
          <Button onClick={loadOrGenerateCopy} className="bg-blue-500 hover:bg-blue-600">
            重新生成
          </Button>
        </div>
      )}

      {/* Form fields */}
      {!loading && !error && (
        <div className="flex-1 overflow-y-auto pb-24">
          <div className="max-w-2xl mx-auto px-4 py-4 space-y-5">
            {/* Product name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">产品名称</label>
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="请输入产品名称"
              />
            </div>

            {/* Category name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">品类名称</label>
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="请输入品类名称"
              />
            </div>

            {/* Main image headline */}
            {renderTextareaField(
              "主图标题",
              headline,
              setHeadline,
              "headline",
              3
            )}

            {/* Core selling points */}
            {renderTextareaField(
              "核心卖点",
              sellingPoints,
              setSellingPoints,
              "selling_points",
              5
            )}

            {/* Usage scenarios */}
            {renderTextareaField(
              "使用场景",
              scenes,
              setScenes,
              "scenes",
              5
            )}

            {/* Product specs */}
            {renderTextareaField(
              "产品规格",
              specs,
              setSpecs,
              "specs",
              5
            )}
          </div>
        </div>
      )}

      {/* Bottom action bar */}
      {!loading && !error && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-3 flex items-center gap-3 z-50">
          <Button
            variant="outline"
            onClick={handleBack}
            className="flex items-center gap-1.5 text-sm px-4"
          >
            <ChevronLeft className="w-4 h-4" />
            返回
          </Button>
          <Button
            onClick={handleNext}
            disabled={saving}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm flex items-center justify-center gap-1.5"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            {saving ? "保存中..." : "下一步"}
          </Button>
        </div>
      )}
    </div>
  );
}
