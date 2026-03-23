import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Upload, X, LinkIcon, Plus, Pencil, FileText, AlertCircle } from "lucide-react";
import { StepIndicator } from "@/components/StepIndicator";
import { Input } from "@/components/ui/input";
import { sessionAPI } from "@/lib/api";

// ── Theme presets by product type ──

const PRODUCT_THEMES: Record<string, string[]> = {
  "空气净化器": ["宠物家庭", "甲醛净化", "过敏防护", "母婴安全", "办公室净化", "老人健康"],
  "加湿器": ["干燥季节", "办公室舒适", "卧室睡眠", "母婴护理", "美容护肤"],
  "除湿机": ["梅雨季节", "地下室防潮", "衣物干燥", "防霉除湿"],
  "厨房小家电": ["家庭烹饪", "健康饮食", "快手料理", "烘焙达人", "早餐神器"],
  "服装": ["职场通勤", "休闲度假", "运动健身", "约会穿搭", "居家舒适"],
  "电子产品": ["办公效率", "娱乐影音", "学习提升", "游戏电竞", "智能生活"],
  "家居用品": ["温馨家庭", "简约生活", "收纳整理", "品质生活"],
  "美妆护肤": ["日常护肤", "妆容打造", "抗衰修护", "敏感肌护理"],
  "食品饮料": ["健康营养", "美味享受", "能量补充", "送礼佳品"],
  "运动户外": ["健身塑形", "户外探险", "运动竞技", "休闲运动"],
  "母婴用品": ["新生儿护理", "婴幼儿成长", "孕妈关怀", "亲子互动"],
  "图书文具": ["学习提升", "办公必备", "创意设计", "阅读享受"],
  "其它": ["日常使用", "品质生活", "实用便捷", "多场景适用"],
};

// ── Type definitions ──

interface ParamItem {
  id: string;
  label: string;
  value: string;
}

interface TextItem {
  id: string;
  text: string;
}

interface ReferenceItem {
  id: string;
  type: "link" | "image";
  content: string;
  name?: string;
}

interface ParametersPayload {
  params: ParamItem[];
  sellingPoints: TextItem[];
  advantages: TextItem[];
  featureTexts: TextItem[];
  selectedTheme: string;
  productType: string;
  references: ReferenceItem[];
}

// ── Helper: get sessionId or null ──

function getSessionId(): string | null {
  return sessionStorage.getItem("current_session_id");
}

// ── Component ──

export default function GenerateStep() {
  const [, setLocation] = useLocation();

  // Loading & status
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Product type & theme
  const [productType, setProductType] = useState<string>("");
  const [selectedTheme, setSelectedTheme] = useState<string>("");

  // Editable parameter data -- all start empty, populated from backend
  const [params, setParams] = useState<ParamItem[]>([]);
  const [sellingPoints, setSellingPoints] = useState<TextItem[]>([]);
  const [advantages, setAdvantages] = useState<TextItem[]>([]);
  const [featureTexts, setFeatureTexts] = useState<TextItem[]>([]);

  // References
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [referenceUrl, setReferenceUrl] = useState("");

  // Edit modes
  const [editingParams, setEditingParams] = useState(false);
  const [editingPoints, setEditingPoints] = useState(false);
  const [editingAdvantages, setEditingAdvantages] = useState(false);
  const [editingFeatures, setEditingFeatures] = useState(false);

  // Add-new text inputs
  const [newPointText, setNewPointText] = useState("");
  const [newAdvantageText, setNewAdvantageText] = useState("");
  const [newFeatureText, setNewFeatureText] = useState("");

  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const referenceImageInputRef = useRef<HTMLInputElement>(null);

  const availableThemes = PRODUCT_THEMES[productType] || PRODUCT_THEMES["其它"];

  // ── Load existing parameters on mount ──

  useEffect(() => {
    const sessionId = getSessionId();
    const savedProductType = sessionStorage.getItem("selectedProductType") || "";
    const savedTheme = sessionStorage.getItem("selectedTheme") || "";
    setProductType(savedProductType);
    setSelectedTheme(savedTheme);

    if (!sessionId) {
      setLoadError("会话不存在，请返回重新开始");
      setIsLoading(false);
      return;
    }

    // Helper: populate state from a snapshot object (parameter_snapshot or analysis_snapshot)
    const populateFromSnapshot = (snap: any) => {
      if (snap.key_parameters && Array.isArray(snap.key_parameters)) {
        setParams(snap.key_parameters.map((p: any, i: number) => ({
          id: `p${i}`,
          label: p.label || p.key || '',
          value: p.value || '',
        })));
      }
      if (snap.core_selling_points && Array.isArray(snap.core_selling_points)) {
        setSellingPoints(snap.core_selling_points.map((s: string, i: number) => ({
          id: `sp${i}`,
          text: typeof s === 'string' ? s : (s as any).text || '',
        })));
      }
      if (snap.product_advantages && Array.isArray(snap.product_advantages)) {
        setAdvantages(snap.product_advantages.map((a: string, i: number) => ({
          id: `adv${i}`,
          text: typeof a === 'string' ? a : (a as any).text || '',
        })));
      }
      // Try copy_draft from analysis
      const cd = snap.copy_draft || {};
      if (cd.selling_points && sellingPoints.length === 0) {
        const pts = String(cd.selling_points).split(/[|｜\n]/).filter(Boolean);
        if (pts.length > 0) {
          setSellingPoints(pts.map((s: string, i: number) => ({ id: `sp${i}`, text: s.trim() })));
        }
      }
    };

    // Try backend parameters first
    sessionAPI
      .getParameters(sessionId)
      .then((data: any) => {
        if (data) {
          const snap = data.parameter_snapshot || data;
          const copyFields = data.applied_copy_fields || {};
          populateFromSnapshot(snap);
          if (copyFields.product_name || snap.product_name) {
            setProductType(copyFields.product_name || snap.product_name || "");
            sessionStorage.setItem("selectedProductType", copyFields.product_name || snap.product_name || "");
          }
        }
      })
      .catch(() => {
        // Fallback: load from analysis_snapshot saved in sessionStorage
        try {
          const fullSnap = JSON.parse(sessionStorage.getItem("analysis_snapshot_full") || "{}");
          if (fullSnap && Object.keys(fullSnap).length > 0) {
            populateFromSnapshot(fullSnap);
            const rp = fullSnap.recognized_product || {};
            if (rp.product_name) {
              setProductType(rp.product_name);
              sessionStorage.setItem("selectedProductType", rp.product_name);
            }
          }
        } catch { /* ignore */ }
      })
      .finally(() => setIsLoading(false));
  }, []);

  // ── Build payload for save ──

  const buildPayload = useCallback((): ParametersPayload => {
    return {
      key_parameters: params.map(p => ({ key: p.label, label: p.label, value: p.value })),
      core_selling_points: sellingPoints.map(sp => sp.text),
      product_advantages: advantages.map(a => a.text),
      featureTexts,
      selectedTheme,
      productType,
      references,
    };
  }, [params, sellingPoints, advantages, featureTexts, selectedTheme, productType, references]);

  // ── Save parameters to backend ──

  const saveParameters = useCallback(async (): Promise<boolean> => {
    const sessionId = getSessionId();
    if (!sessionId) {
      setSaveError("会话不存在，请返回重新开始");
      return false;
    }

    setSaveError(null);
    setIsSaving(true);
    try {
      const payload = buildPayload();
      await sessionAPI.updateParameters(sessionId, payload);
      // Also persist to sessionStorage for offline access
      sessionStorage.setItem("product_parameters", JSON.stringify(payload));
      return true;
    } catch (err: any) {
      const msg = err.message || "保存失败，请重试";
      setSaveError(msg);
      console.error("Failed to save parameters:", err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [buildPayload]);

  // ── File upload: upload attachment then extract parameters ──

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      alert("请上传图片（JPG/PNG）或PDF文件");
      return;
    }

    const sessionId = getSessionId();
    if (!sessionId) {
      alert("会话不存在，请返回重新开始");
      return;
    }

    setIsExtracting(true);
    try {
      // Step 1: Upload the file as a parameter attachment
      await sessionAPI.uploadParamAttachment(sessionId, file);

      // Step 2: Trigger server-side parameter extraction
      const extracted: any = await sessionAPI.extractParameters(sessionId);

      if (extracted) {
        if (Array.isArray(extracted.params) && extracted.params.length > 0) {
          setParams(extracted.params);
        }
        if (Array.isArray(extracted.sellingPoints) && extracted.sellingPoints.length > 0) {
          setSellingPoints(extracted.sellingPoints);
        }
        if (Array.isArray(extracted.advantages) && extracted.advantages.length > 0) {
          setAdvantages(extracted.advantages);
        }
        if (Array.isArray(extracted.featureTexts) && extracted.featureTexts.length > 0) {
          setFeatureTexts(extracted.featureTexts);
        }
      }

      alert("产品信息识别成功！");
    } catch (err: any) {
      alert("识别失败：" + (err.message || "请重试"));
    } finally {
      setIsExtracting(false);
      // Reset the file input so the same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Reference URL ──

  const handleAddReferenceUrl = () => {
    const trimmed = referenceUrl.trim();
    if (!trimmed) return;
    try {
      new URL(trimmed);
      setReferences((prev) => [
        ...prev,
        { id: Date.now().toString(), type: "link", content: trimmed, name: trimmed },
      ]);
      setReferenceUrl("");
    } catch {
      alert("请输入有效的URL");
    }
  };

  // ── Reference image ──

  const handleAddReferenceImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setReferences((prev) => [
          ...prev,
          {
            id: Date.now().toString() + Math.random(),
            type: "image",
            content: event.target?.result as string,
            name: file.name,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  // ── Navigate: save then go to next step ──

  const handleNext = async (target: string) => {
    const ok = await saveParameters();
    if (ok) {
      setLocation(target);
    }
  };

  // ── Loading state ──

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4" />
          <p className="text-slate-500 text-sm">正在加载产品参数...</p>
        </div>
      </div>
    );
  }

  // ── Error: no session ──

  if (loadError) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-slate-700 text-sm mb-4">{loadError}</p>
          <Button onClick={() => setLocation("/create/upload")} variant="outline">
            返回上传步骤
          </Button>
        </div>
      </div>
    );
  }

  // ── Main render ──

  return (
    <div className="min-h-screen bg-white">
      <StepIndicator currentStep={3} />

      <div className="max-w-2xl mx-auto py-4 px-4">

        {/* ── Header ── */}
        <div className="mb-3">
          <h1 className="text-xl font-bold text-slate-900">AI 参数设置</h1>
          <p className="text-xs text-slate-400 mt-1">上传产品资料自动识别，或手动填写产品参数</p>
        </div>

        {/* ── 1. Upload spec to auto-extract ── */}
        <div className="border border-slate-200 rounded-xl p-3 mb-3 bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-semibold text-slate-900 text-sm">
              自动识别产品参数
              <span className="ml-1.5 text-xs font-normal text-slate-400">（可选）</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isExtracting}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExtracting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span>识别中...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>上传说明书 / 产品参数图</span>
                </>
              )}
            </button>
            <span className="text-slate-300 text-xs">|</span>
            <span className="text-xs text-slate-400">支持图片/PDF格式</span>
            <svg className="w-3.5 h-3.5 text-slate-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* ── 2. Theme / scene selector ── */}
        <div className="border border-slate-200 rounded-xl p-4 mb-3 bg-white shadow-sm">
          <h3 className="font-semibold text-slate-900 text-sm mb-3">选择主图首图场景</h3>
          <Input
            type="text"
            list="theme-options"
            value={selectedTheme}
            onChange={(e) => {
              setSelectedTheme(e.target.value);
              sessionStorage.setItem("selectedTheme", e.target.value);
            }}
            placeholder="选择或输入主题场景"
            className="w-full"
          />
          <datalist id="theme-options">
            {availableThemes.map((theme) => (
              <option key={theme} value={theme} />
            ))}
          </datalist>
          {availableThemes.length > 0 && (
            <p className="text-xs text-slate-400 mt-2">
              AI建议：{availableThemes.slice(0, 3).join(" · ")}
            </p>
          )}
        </div>

        {/* ── 3. Selling points ── */}
        <div className="border border-slate-200 rounded-xl p-4 mb-3 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900 text-sm">核心卖点</h3>
            <button
              onClick={() => setEditingPoints(!editingPoints)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              <Pencil className="w-3 h-3" />
              {editingPoints ? "完成" : "修改"}
              {!editingPoints && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </div>

          {sellingPoints.length === 0 && !editingPoints ? (
            <p className="text-xs text-slate-400 italic">暂无卖点，点击修改添加</p>
          ) : (
            <div className="space-y-2">
              {sellingPoints.map((point) => (
                <div key={point.id} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                  {editingPoints ? (
                    <Input
                      value={point.text}
                      onChange={(e) =>
                        setSellingPoints((prev) =>
                          prev.map((p) => (p.id === point.id ? { ...p, text: e.target.value } : p))
                        )
                      }
                      className="h-7 text-xs flex-1"
                    />
                  ) : (
                    <span className="text-sm text-slate-700">{point.text}</span>
                  )}
                  {editingPoints && (
                    <button
                      onClick={() => setSellingPoints((prev) => prev.filter((p) => p.id !== point.id))}
                      className="p-0.5 hover:bg-slate-100 rounded"
                    >
                      <X className="w-3 h-3 text-slate-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {editingPoints ? (
            <div className="flex gap-2 mt-3">
              <Input
                value={newPointText}
                onChange={(e) => setNewPointText(e.target.value)}
                placeholder="输入新卖点"
                className="h-7 text-xs flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newPointText.trim()) {
                    setSellingPoints((prev) => [
                      ...prev,
                      { id: Date.now().toString(), text: newPointText.trim() },
                    ]);
                    setNewPointText("");
                  }
                }}
              />
              <button
                onClick={() => {
                  if (newPointText.trim()) {
                    setSellingPoints((prev) => [
                      ...prev,
                      { id: Date.now().toString(), text: newPointText.trim() },
                    ]);
                    setNewPointText("");
                  }
                }}
                className="px-2 py-1 text-xs bg-blue-500 text-white rounded-lg"
              >
                添加
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingPoints(true)}
              className="mt-3 flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              添加卖点
            </button>
          )}
        </div>

        {/* ── 4. Core parameters ── */}
        <div className="border border-slate-200 rounded-xl p-4 mb-3 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900 text-sm">核心参数</h3>
            <button
              onClick={() => setEditingParams(!editingParams)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              <Pencil className="w-3 h-3" />
              {editingParams ? "完成" : "修改"}
              {!editingParams && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </div>

          {params.length === 0 && !editingParams ? (
            <p className="text-xs text-slate-400 italic">暂无参数，上传产品资料自动识别或手动添加</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {params.map((param) => (
                <div key={param.id} className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-20 flex-shrink-0 flex items-center gap-1 truncate">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {editingParams ? (
                      <Input
                        value={param.label}
                        onChange={(e) =>
                          setParams((prev) =>
                            prev.map((p) => (p.id === param.id ? { ...p, label: e.target.value } : p))
                          )
                        }
                        className="h-6 text-xs w-16"
                      />
                    ) : (
                      param.label
                    )}
                  </span>
                  {editingParams ? (
                    <Input
                      value={param.value}
                      onChange={(e) =>
                        setParams((prev) =>
                          prev.map((p) => (p.id === param.id ? { ...p, value: e.target.value } : p))
                        )
                      }
                      className="h-7 text-xs flex-1"
                    />
                  ) : (
                    <span className="text-sm font-medium text-slate-800">{param.value}</span>
                  )}
                  {editingParams && (
                    <button
                      onClick={() => setParams((prev) => prev.filter((p) => p.id !== param.id))}
                      className="p-0.5 hover:bg-slate-100 rounded"
                    >
                      <X className="w-3 h-3 text-slate-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => {
              setParams((prev) => [...prev, { id: Date.now().toString(), label: "参数", value: "" }]);
              if (!editingParams) setEditingParams(true);
            }}
            className="mt-3 flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            添加参数
          </button>
        </div>

        {/* ── 5. Product advantages ── */}
        <div className="border border-slate-200 rounded-xl p-4 mb-3 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900 text-sm">产品优势</h3>
            <button
              onClick={() => setEditingAdvantages(!editingAdvantages)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              <Pencil className="w-3 h-3" />
              {editingAdvantages ? "完成" : "修改"}
              {!editingAdvantages && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </div>

          {advantages.length === 0 && !editingAdvantages ? (
            <p className="text-xs text-slate-400 italic">暂无优势描述，点击修改添加</p>
          ) : (
            <div className="space-y-2">
              {advantages.map((adv) => (
                <div key={adv.id} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                  {editingAdvantages ? (
                    <Input
                      value={adv.text}
                      onChange={(e) =>
                        setAdvantages((prev) =>
                          prev.map((a) => (a.id === adv.id ? { ...a, text: e.target.value } : a))
                        )
                      }
                      className="h-7 text-xs flex-1"
                    />
                  ) : (
                    <span className="text-sm text-slate-700">{adv.text}</span>
                  )}
                  {editingAdvantages && (
                    <button
                      onClick={() => setAdvantages((prev) => prev.filter((a) => a.id !== adv.id))}
                      className="p-0.5 hover:bg-slate-100 rounded"
                    >
                      <X className="w-3 h-3 text-slate-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {editingAdvantages ? (
            <div className="flex gap-2 mt-3">
              <Input
                value={newAdvantageText}
                onChange={(e) => setNewAdvantageText(e.target.value)}
                placeholder="输入产品优势描述"
                className="h-7 text-xs flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newAdvantageText.trim()) {
                    setAdvantages((prev) => [
                      ...prev,
                      { id: Date.now().toString(), text: newAdvantageText.trim() },
                    ]);
                    setNewAdvantageText("");
                  }
                }}
              />
              <button
                onClick={() => {
                  if (newAdvantageText.trim()) {
                    setAdvantages((prev) => [
                      ...prev,
                      { id: Date.now().toString(), text: newAdvantageText.trim() },
                    ]);
                    setNewAdvantageText("");
                  }
                }}
                className="px-2 py-1 text-xs bg-blue-500 text-white rounded-lg"
              >
                添加
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingAdvantages(true)}
              className="mt-3 flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              添加优势
            </button>
          )}
        </div>

        {/* ── 6. Feature descriptions (optional) ── */}
        <div className="border border-slate-200 rounded-xl p-4 mb-3 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900 text-sm">
              功能展示
              <span className="ml-1.5 text-xs font-normal text-slate-400">（可选）</span>
            </h3>
            <button
              onClick={() => setEditingFeatures(!editingFeatures)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              <Pencil className="w-3 h-3" />
              {editingFeatures ? "完成" : "修改"}
              {!editingFeatures && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </div>

          {featureTexts.length === 0 && !editingFeatures ? (
            <p className="text-xs text-slate-400 italic">暂无功能描述，点击修改添加</p>
          ) : (
            <div className="space-y-2">
              {featureTexts.map((feat) => (
                <div key={feat.id} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                  {editingFeatures ? (
                    <Input
                      value={feat.text}
                      onChange={(e) =>
                        setFeatureTexts((prev) =>
                          prev.map((f) => (f.id === feat.id ? { ...f, text: e.target.value } : f))
                        )
                      }
                      className="h-7 text-xs flex-1"
                    />
                  ) : (
                    <span className="text-sm text-slate-700">{feat.text}</span>
                  )}
                  {editingFeatures && (
                    <button
                      onClick={() => setFeatureTexts((prev) => prev.filter((f) => f.id !== feat.id))}
                      className="p-0.5 hover:bg-slate-100 rounded"
                    >
                      <X className="w-3 h-3 text-slate-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {editingFeatures ? (
            <div className="flex gap-2 mt-3">
              <Input
                value={newFeatureText}
                onChange={(e) => setNewFeatureText(e.target.value)}
                placeholder="输入功能描述"
                className="h-7 text-xs flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newFeatureText.trim()) {
                    setFeatureTexts((prev) => [
                      ...prev,
                      { id: Date.now().toString(), text: newFeatureText.trim() },
                    ]);
                    setNewFeatureText("");
                  }
                }}
              />
              <button
                onClick={() => {
                  if (newFeatureText.trim()) {
                    setFeatureTexts((prev) => [
                      ...prev,
                      { id: Date.now().toString(), text: newFeatureText.trim() },
                    ]);
                    setNewFeatureText("");
                  }
                }}
                className="px-2 py-1 text-xs bg-blue-500 text-white rounded-lg"
              >
                添加
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingFeatures(true)}
              className="mt-3 flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              添加功能
            </button>
          )}
        </div>

        {/* ── 7. Reference materials (optional) ── */}
        <div className="border border-slate-200 rounded-xl p-4 mb-6 bg-white shadow-sm">
          <h3 className="font-semibold text-slate-900 text-sm mb-3">
            添加参考内容
            <span className="ml-1.5 text-xs font-normal text-slate-400">（可选）</span>
          </h3>
          <div className="flex gap-2 mb-3">
            <Input
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
              placeholder="输入竞品链接或参考页面URL"
              className="flex-1 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddReferenceUrl();
              }}
            />
            <Button onClick={handleAddReferenceUrl} variant="outline" size="sm" className="flex-shrink-0">
              <LinkIcon className="w-3.5 h-3.5 mr-1" />
              添加
            </Button>
          </div>
          <button
            onClick={() => referenceImageInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-slate-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm text-slate-500"
          >
            <Upload className="w-4 h-4" />
            上传参考图片（支持多张）
          </button>
          <input
            ref={referenceImageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleAddReferenceImage}
            className="hidden"
          />

          {references.length > 0 && (
            <div className="mt-3 space-y-2">
              {references.map((ref) => (
                <div key={ref.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg">
                  {ref.type === "link" ? (
                    <LinkIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  ) : (
                    <img
                      src={ref.content}
                      alt={ref.name}
                      className="w-10 h-10 object-cover rounded flex-shrink-0"
                    />
                  )}
                  <span className="text-sm text-slate-700 flex-1 truncate">
                    {ref.name || ref.content}
                  </span>
                  <button
                    onClick={() => setReferences((prev) => prev.filter((r) => r.id !== ref.id))}
                    className="p-1 hover:bg-slate-200 rounded"
                  >
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Save error feedback ── */}
        {saveError && (
          <div className="mb-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {/* ── Bottom actions ── */}
        <Button
          onClick={() => handleNext("/create/copywriting")}
          disabled={isSaving}
          className="w-full h-12 bg-blue-500 hover:bg-blue-600 text-white text-base font-semibold rounded-xl shadow disabled:opacity-60"
        >
          {isSaving ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              保存中...
            </span>
          ) : (
            "生成主图文案"
          )}
        </Button>

        <button
          onClick={() => handleNext("/create/copywriting")}
          disabled={isSaving}
          className="w-full mt-3 flex items-center justify-center gap-1.5 text-sm text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-50"
        >
          <FileText className="w-4 h-4" />
          直接生成详情文案
        </button>
      </div>
    </div>
  );
}
