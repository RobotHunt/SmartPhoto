import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, FileText, Link as LinkIcon, Pencil, Plus, Upload, X } from "lucide-react";

import { StepIndicator } from "@/components/StepIndicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { jobAPI, sessionAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const REFERENCE_LINKS_KEY = "generate_reference_links";

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

interface ParamItem {
  id: string;
  label: string;
  value: string;
}

interface TextItem {
  id: string;
  text: string;
}

interface ReferenceLinkItem {
  id: string;
  type: "link";
  content: string;
  name: string;
}

interface ReferenceImageItem {
  id: string;
  type: "image";
  content: string;
  name: string;
  backendId?: string;
  displayOrder?: number;
}

interface AttachmentItem {
  id: string;
  name: string;
}

interface ParametersPayload {
  hero_scene: string;
  feature_highlights: string[];
  product_name: string;
  key_parameters: Array<{ key: string; label: string; value: string }>;
  core_selling_points: string[];
  product_advantages: string[];
}

function getSessionId(): string | null {
  return sessionStorage.getItem("current_session_id");
}

function normalizeTextItems(source: any): TextItem[] {
  if (!Array.isArray(source)) return [];

  return source
    .map((item, index) => {
      if (typeof item === "string") {
        return { id: `text-${index}`, text: item.trim() };
      }

      if (item && typeof item === "object") {
        const text = typeof item.text === "string" ? item.text.trim() : "";
        return { id: item.id || `text-${index}`, text };
      }

      return null;
    })
    .filter((item): item is TextItem => Boolean(item?.text));
}

function normalizeParams(source: any): ParamItem[] {
  if (!Array.isArray(source)) return [];

  return source
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const label = String(item.label || item.key || "").trim();
      const value = String(item.value || "").trim();
      if (!label || !value) return null;
      return { id: item.id || `param-${index}`, label, value };
    })
    .filter((item): item is ParamItem => Boolean(item && item.label && item.value));
}

function dedupeByText(items: TextItem[]): TextItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.text.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasStep3Content(snapshot: any): boolean {
  if (!snapshot || typeof snapshot !== "object") return false;
  if (typeof snapshot.hero_scene === "string" && snapshot.hero_scene.trim()) return true;
  if (normalizeTextItems(snapshot.core_selling_points).length > 0) return true;
  if (normalizeParams(snapshot.key_parameters).length > 0) return true;
  if (normalizeTextItems(snapshot.product_advantages).length > 0) return true;
  if (normalizeTextItems(snapshot.feature_highlights).length > 0) return true;
  return false;
}

function hasEditableFieldContent(snapshot: any, copyFields?: any): boolean {
  const resolvedHeroScene = String(copyFields?.hero_scene || snapshot?.hero_scene || "").trim();
  if (resolvedHeroScene) return true;
  if (normalizeParams(copyFields?.key_parameters || snapshot?.key_parameters).length > 0) return true;
  if (normalizeTextItems(copyFields?.core_selling_points || snapshot?.core_selling_points).length > 0) return true;
  if (normalizeTextItems(copyFields?.product_advantages || snapshot?.product_advantages).length > 0) return true;
  if (normalizeTextItems(copyFields?.feature_highlights || snapshot?.feature_highlights).length > 0) return true;
  return false;
}

export default function GenerateStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isUploadingReferenceImages, setIsUploadingReferenceImages] = useState(false);

  const [productCategory, setProductCategory] = useState<string>("其它");
  const [productName, setProductName] = useState<string>("");
  const [selectedTheme, setSelectedTheme] = useState<string>("");

  const [params, setParams] = useState<ParamItem[]>([]);
  const [sellingPoints, setSellingPoints] = useState<TextItem[]>([]);
  const [advantages, setAdvantages] = useState<TextItem[]>([]);
  const [featureTexts, setFeatureTexts] = useState<TextItem[]>([]);

  const [paramAttachments, setParamAttachments] = useState<AttachmentItem[]>([]);
  const [referenceLinks, setReferenceLinks] = useState<ReferenceLinkItem[]>([]);
  const [referenceImages, setReferenceImages] = useState<ReferenceImageItem[]>([]);
  const [referenceUrl, setReferenceUrl] = useState("");

  const [editingParams, setEditingParams] = useState(false);
  const [editingPoints, setEditingPoints] = useState(false);
  const [editingAdvantages, setEditingAdvantages] = useState(false);
  const [editingFeatures, setEditingFeatures] = useState(false);

  const [newPointText, setNewPointText] = useState("");
  const [newAdvantageText, setNewAdvantageText] = useState("");
  const [newFeatureText, setNewFeatureText] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const referenceImageInputRef = useRef<HTMLInputElement>(null);
  const autoExtractAttemptedRef = useRef(false);

  const availableThemes =
    PRODUCT_THEMES[productCategory] && PRODUCT_THEMES[productCategory].length > 0
      ? PRODUCT_THEMES[productCategory]
      : PRODUCT_THEMES["其它"];

  const populateFromSnapshot = useCallback((snapshot: any, copyFields?: any) => {
    if (!snapshot || typeof snapshot !== "object") return;

    const nextProductName = String(copyFields?.product_name || snapshot.product_name || "").trim();
    if (nextProductName) {
      setProductName(nextProductName);
    }

    const nextCategory = String(
      copyFields?.category ||
        copyFields?.product_category ||
        snapshot.product_category ||
        sessionStorage.getItem("selectedProductType") ||
        "",
    ).trim();
    if (nextCategory) {
      setProductCategory(nextCategory);
      sessionStorage.setItem("selectedProductType", nextCategory);
    }

    const nextTheme = String(snapshot.hero_scene || sessionStorage.getItem("selectedTheme") || "").trim();
    const resolvedHeroScene = String(copyFields?.hero_scene || nextTheme).trim();
    if (resolvedHeroScene) {
      setSelectedTheme(resolvedHeroScene);
      sessionStorage.setItem("selectedTheme", resolvedHeroScene);
    }

    const nextParams = normalizeParams(copyFields?.key_parameters || snapshot.key_parameters);
    if (nextParams.length > 0) setParams(nextParams);

    const nextSellingPoints = dedupeByText(
      normalizeTextItems(copyFields?.core_selling_points || snapshot.core_selling_points),
    );
    if (nextSellingPoints.length > 0) setSellingPoints(nextSellingPoints);

    const nextAdvantages = dedupeByText(
      normalizeTextItems(copyFields?.product_advantages || snapshot.product_advantages),
    );
    if (nextAdvantages.length > 0) setAdvantages(nextAdvantages);

    const nextFeatures = dedupeByText(normalizeTextItems(copyFields?.feature_highlights || snapshot.feature_highlights));
    if (nextFeatures.length > 0) setFeatureTexts(nextFeatures);
  }, []);

  const loadParamAttachments = useCallback(async (sessionId: string) => {
    try {
      const items = await sessionAPI.listParamAttachments(sessionId);
      setParamAttachments(
        items.map((item: any, index: number) => ({
          id: item.attachment_id || item.id || `attachment-${index}`,
          name: item.file_name || item.filename || item.name || `参数附件${index + 1}`,
        })),
      );
    } catch {
      setParamAttachments([]);
    }
  }, []);

  const loadReferenceImages = useCallback(async (sessionId: string) => {
    try {
      const images = await sessionAPI.listStrategyRefImages(sessionId);
      setReferenceImages(
        images.map((image: any, index: number) => ({
          id: `image-${image?.image_id || index}`,
          type: "image",
          content: image?.url || "",
          name: image?.file_name || `参考图片${index + 1}`,
          backendId: image?.image_id,
          displayOrder: Number(image?.display_order || index + 1),
        })),
      );
    } catch {
      setReferenceImages([]);
    }
  }, []);

  useEffect(() => {
    const sessionId = getSessionId();
    const savedLinks = sessionStorage.getItem(REFERENCE_LINKS_KEY);
    const savedCategory = sessionStorage.getItem("selectedProductType");
    const savedTheme = sessionStorage.getItem("selectedTheme");

    if (savedLinks) {
      try {
        const parsed = JSON.parse(savedLinks);
        if (Array.isArray(parsed)) {
          setReferenceLinks(
            parsed
              .filter((item) => item && item.type === "link" && item.content)
              .map((item, index) => ({
                id: item.id || `link-${index}`,
                type: "link" as const,
                content: String(item.content),
                name: String(item.name || item.content),
              })),
          );
        }
      } catch {
        sessionStorage.removeItem(REFERENCE_LINKS_KEY);
      }
    }

    if (savedCategory) setProductCategory(savedCategory);
    if (savedTheme) setSelectedTheme(savedTheme);

    if (!sessionId) {
      setLoadError("未找到当前会话，请返回上传页面重新开始。");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const [parametersResult, sessionResult] = await Promise.allSettled([
          sessionAPI.getParameters(sessionId),
          sessionAPI.get(sessionId),
          loadParamAttachments(sessionId),
          loadReferenceImages(sessionId),
        ]);

        if (cancelled) return;

        if (sessionResult.status === "fulfilled") {
          const session = sessionResult.value || {};
          if (session.confirmed_copy) {
            populateFromSnapshot(session.confirmed_copy, session.confirmed_copy);
          }
          if (session.analysis_snapshot) {
            populateFromSnapshot(session.analysis_snapshot);
            const recognized = session.analysis_snapshot.recognized_product || {};
            const nextProductName = String(
              recognized.product_name || session.analysis_snapshot.product_name || "",
            ).trim();
            if (nextProductName) setProductName(nextProductName);
            const nextCategory = String(
              recognized.category || session.analysis_snapshot.product_category || "",
            ).trim();
            if (nextCategory) {
              setProductCategory(nextCategory);
              sessionStorage.setItem("selectedProductType", nextCategory);
            }
          }
          if (parametersResult.status === "fulfilled") {
            const data = parametersResult.value || {};
            const snapshot = data.parameter_snapshot || data;
            if (hasEditableFieldContent(snapshot, data.applied_copy_fields)) {
              populateFromSnapshot(snapshot, data.applied_copy_fields);
            }
          }

          const currentSnapshot =
            parametersResult.status === "fulfilled"
              ? parametersResult.value?.parameter_snapshot || parametersResult.value || {}
              : {};
          const hasCurrentContent =
            hasEditableFieldContent(currentSnapshot, parametersResult.status === "fulfilled" ? parametersResult.value?.applied_copy_fields : undefined) ||
            hasEditableFieldContent(session.confirmed_copy, session.confirmed_copy);

          if (!hasCurrentContent && session.analysis_snapshot && !autoExtractAttemptedRef.current) {
            autoExtractAttemptedRef.current = true;
            try {
              const trigger = await sessionAPI.extractParameters(sessionId);
              await jobAPI.pollUntilDone(trigger.job_id);
              const extracted = await sessionAPI.getParameters(sessionId);
              const extractedSnapshot = extracted?.parameter_snapshot || extracted;
              if (hasEditableFieldContent(extractedSnapshot, extracted?.applied_copy_fields)) {
                populateFromSnapshot(extractedSnapshot, extracted?.applied_copy_fields);
              }
            } catch (extractError) {
              console.warn("Auto parameter extraction skipped:", extractError);
            }
          }
        } else {
          const cachedSnapshot = sessionStorage.getItem("analysis_snapshot_full");
          if (cachedSnapshot) {
            const parsed = JSON.parse(cachedSnapshot);
            populateFromSnapshot(parsed);
            const recognized = parsed?.recognized_product || {};
            const nextProductName = String(recognized.product_name || parsed.product_name || "").trim();
            if (nextProductName) setProductName(nextProductName);
            const nextCategory = String(recognized.category || parsed.product_category || "").trim();
            if (nextCategory) {
              setProductCategory(nextCategory);
              sessionStorage.setItem("selectedProductType", nextCategory);
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "参数加载失败，请稍后重试。");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [loadParamAttachments, loadReferenceImages, populateFromSnapshot]);

  useEffect(() => {
    sessionStorage.setItem(REFERENCE_LINKS_KEY, JSON.stringify(referenceLinks));
  }, [referenceLinks]);

  const buildPayload = useCallback((): ParametersPayload => {
    return {
      hero_scene: selectedTheme.trim(),
      feature_highlights: featureTexts.map((item) => item.text.trim()).filter(Boolean),
      product_name: (productName || productCategory).trim(),
      key_parameters: params
        .map((item) => ({
          key: item.label.trim(),
          label: item.label.trim(),
          value: item.value.trim(),
        }))
        .filter((item) => item.key || item.value),
      core_selling_points: sellingPoints.map((item) => item.text.trim()).filter(Boolean),
      product_advantages: advantages.map((item) => item.text.trim()).filter(Boolean),
    };
  }, [advantages, featureTexts, params, productCategory, productName, selectedTheme, sellingPoints]);

  const saveParameters = useCallback(async (): Promise<boolean> => {
    const sessionId = getSessionId();
    if (!sessionId) {
      setSaveError("未找到当前会话，请返回上传页面重新开始。");
      return false;
    }

    setSaveError(null);
    setIsSaving(true);

    try {
      await sessionAPI.updateParameters(sessionId, buildPayload());
      sessionStorage.setItem("selectedTheme", selectedTheme.trim());
      sessionStorage.setItem("selectedProductType", productCategory.trim());
      return true;
    } catch (err: any) {
      const message = err?.message || "参数保存失败，请稍后重试。";
      console.warn("Save parameters failed:", message);
      setSaveError(message);
      toast({
        title: "参数保存失败",
        description: message,
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [buildPayload, productCategory, selectedTheme, toast]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const sessionId = getSessionId();

    if (!sessionId) {
      setSaveError("未找到当前会话，请返回上传页面重新开始。");
      return;
    }
    if (files.length === 0) return;

    setIsExtracting(true);
    setSaveError(null);

    try {
      const currentAttachments = await sessionAPI.listParamAttachments(sessionId).catch(() => []);
      const startOrder = currentAttachments.length;

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        await sessionAPI.uploadParamAttachment(sessionId, file, startOrder + index + 1);
      }

      await loadParamAttachments(sessionId);

      const trigger = await sessionAPI.extractParameters(sessionId);
      await jobAPI.pollUntilDone(trigger.job_id);

      const latest = await sessionAPI.getParameters(sessionId);
      const extractedSnapshot = latest?.parameter_snapshot || latest;
      populateFromSnapshot(extractedSnapshot, latest?.applied_copy_fields);
      toast({
        title: "参数刷新完成",
        description: "已根据当前商品分析和附件整页更新 Step3 内容。",
      });
    } catch (err: any) {
      toast({
        title: "参数提取失败",
        description: err?.message || "请稍后重试。",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAddReferenceUrl = () => {
    const trimmed = referenceUrl.trim();
    if (!trimmed) return;

    try {
      new URL(trimmed);
      setReferenceLinks((prev) => [
        ...prev,
        {
          id: `link-${Date.now()}`,
          type: "link",
          content: trimmed,
          name: trimmed,
        },
      ]);
      setReferenceUrl("");
    } catch {
      toast({
        title: "链接格式不正确",
        description: "请输入有效的参考链接。",
        variant: "destructive",
      });
    }
  };

  const handleAddReferenceImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const sessionId = getSessionId();

    if (!sessionId) {
      setSaveError("未找到当前会话，请返回上传页面重新开始。");
      return;
    }
    if (files.length === 0) return;

    setIsUploadingReferenceImages(true);

    try {
      const startOrder = referenceImages.length;
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        await sessionAPI.uploadStrategyRefImage(sessionId, file, startOrder + index + 1);
      }
      await loadReferenceImages(sessionId);
      toast({
        title: "参考图上传成功",
        description: "后续策略生成会使用这些参考图片。",
      });
    } catch (err: any) {
      toast({
        title: "参考图上传失败",
        description: err?.message || "请稍后重试。",
        variant: "destructive",
      });
    } finally {
      setIsUploadingReferenceImages(false);
      if (referenceImageInputRef.current) referenceImageInputRef.current.value = "";
    }
  };

  const handleDeleteReferenceImage = async (item: ReferenceImageItem) => {
    const sessionId = getSessionId();
    if (!sessionId || !item.backendId) return;

    try {
      await sessionAPI.deleteStrategyRefImage(sessionId, item.backendId);
      await loadReferenceImages(sessionId);
    } catch (err: any) {
      toast({
        title: "删除参考图失败",
        description: err?.message || "请稍后重试。",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    const sessionId = getSessionId();
    if (!sessionId) return;

    try {
      await sessionAPI.deleteParamAttachment(sessionId, attachmentId);
      await loadParamAttachments(sessionId);
    } catch (err: any) {
      toast({
        title: "删除附件失败",
        description: err?.message || "请稍后重试。",
        variant: "destructive",
      });
    }
  };

  const handleNext = async () => {
    const ok = await saveParameters();
    if (ok) {
      sessionStorage.setItem("generation_target", "main_gallery");
      setLocation("/create/strategy");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4" />
          <p className="text-slate-500 text-sm">AI正在分析产品特性...</p>
        </div>
      </div>
    );
  }

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

  return (
    <div className="min-h-screen bg-white">
      <StepIndicator currentStep={3} />

      <div className="max-w-2xl mx-auto py-4 px-4">
        <div className="mb-3">
          <h1 className="text-xl font-bold text-slate-900">AI 正在自动生成参数</h1>
        </div>

        <div className="border border-slate-200 rounded-xl p-3 mb-3 bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-slate-500" />
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
                  <span>提取中...</span>
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
          <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple onChange={handleFileUpload} className="hidden" />

          {paramAttachments.length > 0 && (
            <div className="mt-3 space-y-2">
              {paramAttachments.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg">
                  <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-sm text-slate-700 flex-1 truncate">{item.name}</span>
                  <button onClick={() => handleDeleteAttachment(item.id)} className="p-1 hover:bg-slate-200 rounded">
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

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
          <p className="text-xs text-slate-400 mt-2">AI建议：{availableThemes.slice(0, 3).join(" · ")}</p>
        </div>

        <div className="border border-slate-200 rounded-xl p-4 mb-3 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900 text-sm">核心卖点</h3>
            <button
              onClick={() => setEditingPoints(!editingPoints)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              <Pencil className="w-3 h-3" />
              {editingPoints ? "完成" : "修改"}
              {!editingPoints && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>}
            </button>
          </div>
          <div className="space-y-2">
            {sellingPoints.map((point) => (
              <div key={point.id} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                {editingPoints ? (
                  <Input
                    value={point.text}
                    onChange={(e) => setSellingPoints((prev) => prev.map((item) => (item.id === point.id ? { ...item, text: e.target.value } : item)))}
                    className="h-7 text-xs flex-1"
                  />
                ) : (
                  <span className="text-sm text-slate-700">{point.text}</span>
                )}
                {editingPoints && (
                  <button onClick={() => setSellingPoints((prev) => prev.filter((item) => item.id !== point.id))} className="p-0.5 hover:bg-slate-100 rounded">
                    <X className="w-3 h-3 text-slate-400" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {editingPoints ? (
            <div className="flex gap-2 mt-3">
              <Input
                value={newPointText}
                onChange={(e) => setNewPointText(e.target.value)}
                placeholder="输入新卖点"
                className="h-7 text-xs flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newPointText.trim()) {
                    setSellingPoints((prev) => [...prev, { id: `point-${Date.now()}`, text: newPointText.trim() }]);
                    setNewPointText("");
                  }
                }}
              />
              <button
                onClick={() => {
                  if (newPointText.trim()) {
                    setSellingPoints((prev) => [...prev, { id: `point-${Date.now()}`, text: newPointText.trim() }]);
                    setNewPointText("");
                  }
                }}
                className="px-2 py-1 text-xs bg-blue-500 text-white rounded-lg"
              >
                添加
              </button>
            </div>
          ) : (
            <button onClick={() => setEditingPoints(true)} className="mt-3 flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors">
              <Plus className="w-3.5 h-3.5" />
              添加卖点
            </button>
          )}
        </div>

        <div className="border border-slate-200 rounded-xl p-4 mb-3 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900 text-sm">核心参数</h3>
            <button
              onClick={() => setEditingParams(!editingParams)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              <Pencil className="w-3 h-3" />
              {editingParams ? "完成" : "修改"}
              {!editingParams && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {params.map((param) => (
              <div key={param.id} className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-20 flex-shrink-0 flex items-center gap-1 truncate">
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {param.label}
                </span>
                {editingParams ? (
                  <Input
                    value={param.value}
                    onChange={(e) => setParams((prev) => prev.map((item) => (item.id === param.id ? { ...item, value: e.target.value } : item)))}
                    className="h-7 text-xs flex-1"
                  />
                ) : (
                  <span className="text-sm font-medium text-slate-800">{param.value}</span>
                )}
                {editingParams && (
                  <button onClick={() => setParams((prev) => prev.filter((item) => item.id !== param.id))} className="p-0.5 hover:bg-slate-100 rounded">
                    <X className="w-3 h-3 text-slate-400" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => setParams((prev) => [...prev, { id: `param-${Date.now()}`, label: "参数", value: "" }])}
            className="mt-3 flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            添加参数
          </button>
        </div>

        <div className="border border-slate-200 rounded-xl p-4 mb-3 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900 text-sm">产品优势</h3>
            <button
              onClick={() => setEditingAdvantages(!editingAdvantages)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              <Pencil className="w-3 h-3" />
              {editingAdvantages ? "完成" : "修改"}
              {!editingAdvantages && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>}
            </button>
          </div>
          <div className="space-y-2">
            {advantages.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                {editingAdvantages ? (
                  <Input
                    value={item.text}
                    onChange={(e) => setAdvantages((prev) => prev.map((current) => (current.id === item.id ? { ...current, text: e.target.value } : current)))}
                    className="h-7 text-xs flex-1"
                  />
                ) : (
                  <span className="text-sm text-slate-700">{item.text}</span>
                )}
                {editingAdvantages && (
                  <button onClick={() => setAdvantages((prev) => prev.filter((current) => current.id !== item.id))} className="p-0.5 hover:bg-slate-100 rounded">
                    <X className="w-3 h-3 text-slate-400" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {editingAdvantages ? (
            <div className="flex gap-2 mt-3">
              <Input
                value={newAdvantageText}
                onChange={(e) => setNewAdvantageText(e.target.value)}
                placeholder="输入产品优势描述"
                className="h-7 text-xs flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newAdvantageText.trim()) {
                    setAdvantages((prev) => [...prev, { id: `advantage-${Date.now()}`, text: newAdvantageText.trim() }]);
                    setNewAdvantageText("");
                  }
                }}
              />
              <button
                onClick={() => {
                  if (newAdvantageText.trim()) {
                    setAdvantages((prev) => [...prev, { id: `advantage-${Date.now()}`, text: newAdvantageText.trim() }]);
                    setNewAdvantageText("");
                  }
                }}
                className="px-2 py-1 text-xs bg-blue-500 text-white rounded-lg"
              >
                添加
              </button>
            </div>
          ) : (
            <button onClick={() => setEditingAdvantages(true)} className="mt-3 flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors">
              <Plus className="w-3.5 h-3.5" />
              添加优势
            </button>
          )}
        </div>

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
              {!editingFeatures && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>}
            </button>
          </div>
          <div className="space-y-2">
            {featureTexts.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                {editingFeatures ? (
                  <Input
                    value={item.text}
                    onChange={(e) => setFeatureTexts((prev) => prev.map((current) => (current.id === item.id ? { ...current, text: e.target.value } : current)))}
                    className="h-7 text-xs flex-1"
                  />
                ) : (
                  <span className="text-sm text-slate-700">{item.text}</span>
                )}
                {editingFeatures && (
                  <button onClick={() => setFeatureTexts((prev) => prev.filter((current) => current.id !== item.id))} className="p-0.5 hover:bg-slate-100 rounded">
                    <X className="w-3 h-3 text-slate-400" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {editingFeatures ? (
            <div className="flex gap-2 mt-3">
              <Input
                value={newFeatureText}
                onChange={(e) => setNewFeatureText(e.target.value)}
                placeholder="输入功能描述"
                className="h-7 text-xs flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newFeatureText.trim()) {
                    setFeatureTexts((prev) => [...prev, { id: `feature-${Date.now()}`, text: newFeatureText.trim() }]);
                    setNewFeatureText("");
                  }
                }}
              />
              <button
                onClick={() => {
                  if (newFeatureText.trim()) {
                    setFeatureTexts((prev) => [...prev, { id: `feature-${Date.now()}`, text: newFeatureText.trim() }]);
                    setNewFeatureText("");
                  }
                }}
                className="px-2 py-1 text-xs bg-blue-500 text-white rounded-lg"
              >
                添加
              </button>
            </div>
          ) : (
            <button onClick={() => setEditingFeatures(true)} className="mt-3 flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors">
              <Plus className="w-3.5 h-3.5" />
              添加功能
            </button>
          )}
        </div>

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
            disabled={isUploadingReferenceImages}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-slate-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm text-slate-500 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Upload className="w-4 h-4" />
            {isUploadingReferenceImages ? "上传中..." : "上传参考图片（支持多张）"}
          </button>
          <input ref={referenceImageInputRef} type="file" accept="image/*" multiple onChange={handleAddReferenceImage} className="hidden" />
          {(referenceLinks.length > 0 || referenceImages.length > 0) && (
            <div className="mt-3 space-y-2">
              {referenceLinks.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg">
                  <LinkIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span className="text-sm text-slate-700 flex-1 truncate">{item.name}</span>
                  <button onClick={() => setReferenceLinks((prev) => prev.filter((current) => current.id !== item.id))} className="p-1 hover:bg-slate-200 rounded">
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              ))}
              {referenceImages.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg">
                  <img src={item.content} alt={item.name} className="w-10 h-10 object-cover rounded flex-shrink-0" />
                  <span className="text-sm text-slate-700 flex-1 truncate">{item.name}</span>
                  <button onClick={() => handleDeleteReferenceImage(item)} className="p-1 hover:bg-slate-200 rounded">
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {saveError && (
          <div className="mb-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        <Button
          onClick={handleNext}
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
          onClick={() => {
            sessionStorage.setItem("detail_flow_origin", "generate");
            setLocation("/create/copywriting");
          }}
          className="w-full mt-3 flex items-center justify-center gap-1.5 text-sm text-slate-400 hover:text-blue-600 transition-colors"
        >
          <FileText className="w-4 h-4" />
          直接生成详情文案
        </button>
      </div>
    </div>
  );
}
