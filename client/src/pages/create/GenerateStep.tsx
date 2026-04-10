import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, FileText, Link as LinkIcon, Pencil, Plus, Upload, X, ChevronLeft } from "lucide-react";

import { StepIndicator } from "@/components/StepIndicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { jobAPI, sessionAPI } from "@/lib/api";
import {
  ANALYSIS_REFRESH_REQUIRED_KEY,
  ANALYSIS_SNAPSHOT_KEY,
  completeAnalysisRefresh,
  hasAnalysisContent,
} from "@/lib/analysisSnapshot";
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
  const [loadingMessage, setLoadingMessage] = useState("正在等待 AI 分析完成...");
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

  const resetEditableFields = useCallback(() => {
    setSelectedTheme("");
    setParams([]);
    setSellingPoints([]);
    setAdvantages([]);
    setFeatureTexts([]);
    sessionStorage.removeItem("selectedTheme");
  }, []);

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

  const waitForAnalysisReady = useCallback(async (sessionId: string) => {
    const timeoutMs = 90000;
    const intervalMs = 2000;
    const startedAt = Date.now();
    const forceFreshAnalysis = sessionStorage.getItem(ANALYSIS_REFRESH_REQUIRED_KEY) === "1";

    while (Date.now() - startedAt < timeoutMs) {
      if (forceFreshAnalysis) {
        const cachedAnalysis = sessionStorage.getItem(ANALYSIS_SNAPSHOT_KEY);
        if (cachedAnalysis) {
          try {
            const parsed = JSON.parse(cachedAnalysis);
            if (hasAnalysisContent(parsed)) {
              const session = await sessionAPI.get(sessionId).catch(() => null);
              completeAnalysisRefresh(parsed);
              return {
                session,
                analysisSnapshot: parsed,
              };
            }
          } catch {
            sessionStorage.removeItem(ANALYSIS_SNAPSHOT_KEY);
          }
        }
      }

      const analysisResponse = await sessionAPI.getAnalysis(sessionId).catch(() => null);
      const analysisSnapshot =
        analysisResponse?.analysis_snapshot || analysisResponse || null;
      if (analysisSnapshot && hasAnalysisContent(analysisSnapshot)) {
        const session = await sessionAPI.get(sessionId).catch(() => null);
        completeAnalysisRefresh(analysisSnapshot);
        return {
          session,
          analysisSnapshot,
        };
      }

      if (!forceFreshAnalysis) {
        const session = await sessionAPI.get(sessionId).catch(() => null);
        if (session?.analysis_snapshot && hasAnalysisContent(session.analysis_snapshot)) {
          completeAnalysisRefresh(session.analysis_snapshot);
          return {
            session,
            analysisSnapshot: session.analysis_snapshot,
          };
        }
      }

      setLoadingMessage("AI 分析尚未完成，正在等待后端返回结果...");
      await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
    }

    throw new Error("AI 分析结果尚未准备完成，请稍后重试。");
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
        setLoadingMessage("正在等待 AI 分析完成...");

        const { session, analysisSnapshot } = await waitForAnalysisReady(sessionId);
        if (cancelled) return;

        setLoadingMessage("正在同步 AI 参数内容...");

        const [parametersResult] = await Promise.allSettled([
          sessionAPI.getParameters(sessionId),
          loadParamAttachments(sessionId),
          loadReferenceImages(sessionId),
        ]);

        if (cancelled) return;

        resetEditableFields();

        populateFromSnapshot(analysisSnapshot);
        const recognized = analysisSnapshot?.recognized_product || {};
        const nextProductName = String(
          recognized.product_name || analysisSnapshot?.product_name || "",
        ).trim();
        if (nextProductName) setProductName(nextProductName);
        const nextCategory = String(
          recognized.category || analysisSnapshot?.product_category || "",
        ).trim();
        if (nextCategory) {
          setProductCategory(nextCategory);
          sessionStorage.setItem("selectedProductType", nextCategory);
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
          hasEditableFieldContent(
            currentSnapshot,
            parametersResult.status === "fulfilled"
              ? parametersResult.value?.applied_copy_fields
              : undefined,
          );

        if (!hasCurrentContent && analysisSnapshot && !autoExtractAttemptedRef.current) {
          autoExtractAttemptedRef.current = true;
          setLoadingMessage("AI 分析已完成，正在生成参数内容...");
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
  }, [loadParamAttachments, loadReferenceImages, populateFromSnapshot, resetEditableFields]);

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
      <div className="min-h-screen aurora-bg flex items-center justify-center p-4">
        <div className="text-center glass-panel px-10 py-16 rounded-[32px] border border-blue-200 shadow-sm">
          <div className="inline-block animate-[spin_2s_linear_infinite] rounded-full h-12 w-12 border-b-2 border-t-2 border-blue-400 mb-6 drop-shadow-sm" />
          <p className="text-blue-600 text-sm tracking-wide font-medium">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen aurora-bg flex items-center justify-center p-4">
        <div className="text-center glass-panel px-8 py-16 rounded-[32px] max-w-lg border border-red-500/20">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-slate-600 text-sm mb-6">{loadError}</p>
          <Button onClick={() => setLocation("/create/upload")} className="sci-fi-button">
            返回上传步骤
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen aurora-bg flex flex-col items-center">
      <StepIndicator currentStep={3} />

      <div className="w-full max-w-4xl py-6 px-4">
        <div className="mb-6 flex items-center justify-center sm:justify-start">
          <h1 className="text-2xl font-bold text-slate-900 tracking-wide">AI 正在自动生成参数</h1>
        </div>

        <div className="glass-panel border-slate-200 rounded-2xl p-5 mb-5 shadow-xl transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <span className="font-bold tracking-wide text-slate-700 text-base">
              自动识别产品参数
              <span className="ml-2 text-xs font-medium text-slate-500 tracking-normal border border-slate-200 px-1.5 py-0.5 rounded">可选</span>
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isExtracting}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-600 font-bold tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200"
            >
              {isExtracting ? (
                <>
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span>提取中...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>上传说明书 / 产品参数图</span>
                </>
              )}
            </button>
            <span className="text-slate-600 text-xs px-2">|</span>
            <span className="text-xs text-slate-500 flex-1">支持图/PDF。一次性精准识别大段内容参数及优势</span>
            <svg className="w-4 h-4 text-blue-500/50 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple onChange={handleFileUpload} className="hidden" />

          {paramAttachments.length > 0 && (
            <div className="mt-4 space-y-2">
              {paramAttachments.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 bg-white/80 border border-slate-200 rounded-xl">
                  <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span className="text-sm text-slate-700 font-medium flex-1 truncate">{item.name}</span>
                  <button onClick={() => handleDeleteAttachment(item.id)} className="p-1.5 hover:bg-red-500/20 hover:text-red-400 text-slate-500 rounded-lg transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-5 mb-5 w-full">
          <div className="glass-panel border-slate-200 rounded-2xl p-5 shadow-xl flex flex-col transition-all h-full">
            <div className="flex items-center gap-2 mb-4">
               <div className="w-2 h-6 bg-blue-500 rounded-full"></div>
               <h3 className="font-bold tracking-wide text-slate-900 text-base">选择主图首图场景</h3>
            </div>
            
            <Input
              type="text"
              list="theme-options"
              value={selectedTheme}
              onChange={(e) => {
                setSelectedTheme(e.target.value);
                sessionStorage.setItem("selectedTheme", e.target.value);
              }}
              placeholder="选择或输入主题场景"
              className="w-full bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-500 focus-visible:ring-blue-500/50 mb-4 h-12"
            />
            <datalist id="theme-options">
              {availableThemes.map((theme) => (
                <option key={theme} value={theme} />
              ))}
            </datalist>
            <div className="mt-auto pt-2">
               <p className="text-xs text-slate-500 bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg inline-flex items-center gap-2">
                 <span className="font-bold text-blue-600">AI建议</span> 
                 {availableThemes.slice(0, 3).join(" · ")}
               </p>
            </div>
          </div>

          {/* 核心卖点 block now adjacent in the grid */}
          <div className="glass-panel border-slate-200 rounded-2xl p-5 shadow-xl transition-all h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-6 bg-indigo-500 rounded-full"></div>
                 <h3 className="font-bold tracking-wide text-slate-900 text-base">核心卖点</h3>
              </div>
              <button
                onClick={() => setEditingPoints(!editingPoints)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900"
              >
                <Pencil className="w-3.5 h-3.5" />
                {editingPoints ? "完成修改" : "修改内容"}
                {!editingPoints && <ChevronLeft className="w-3.5 h-3.5 rotate-180" />}
              </button>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {sellingPoints.map((point) => (
                <div key={point.id} className="flex items-start gap-3 group">
                  <div className="w-2 h-2 mt-2 rounded-full bg-blue-400 shadow-sm flex-shrink-0" />
                  {editingPoints ? (
                    <Input
                      value={point.text}
                      onChange={(e) => setSellingPoints((prev) => prev.map((item) => (item.id === point.id ? { ...item, text: e.target.value } : item)))}
                      className="h-9 text-sm flex-1 bg-slate-50 border-slate-300 text-slate-900 focus-visible:ring-blue-500/50"
                    />
                  ) : (
                    <span className="text-sm font-medium text-slate-600 leading-relaxed mt-0.5">{point.text}</span>
                  )}
                  {editingPoints && (
                    <button onClick={() => setSellingPoints((prev) => prev.filter((item) => item.id !== point.id))} className="p-2 opacity-60 hover:opacity-100 hover:bg-red-500/20 text-red-400 rounded-lg transition-all mt-0.5">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {editingPoints ? (
              <div className="flex gap-2 mt-4 pt-3 border-t border-slate-200">
                <Input
                  value={newPointText}
                  onChange={(e) => setNewPointText(e.target.value)}
                  placeholder="输入新卖点"
                  className="h-10 text-sm flex-1 bg-blue-50 border-blue-300 text-slate-900 placeholder:text-slate-500 focus-visible:ring-blue-500"
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
                className="px-3 py-1.5 text-xs font-bold tracking-wide bg-blue-600 hover:bg-blue-500 text-slate-900 rounded-lg shadow-sm transition-all"
              >
                添加
              </button>
            </div>
          ) : (
            <button onClick={() => setEditingPoints(true)} className="mt-4 flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors">
              <Plus className="w-3.5 h-3.5" />
              添加额外卖点
            </button>
          )}
        </div>
        </div>

        <div className="glass-panel border-slate-200 rounded-2xl p-5 mb-5 shadow-xl transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
               <div className="w-2 h-6 bg-pink-500 rounded-full"></div>
               <h3 className="font-bold tracking-wide text-slate-900 text-base">核心参数</h3>
            </div>
            <button
              onClick={() => setEditingParams(!editingParams)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900"
            >
              <Pencil className="w-3.5 h-3.5" />
              {editingParams ? "完成修改" : "修改参数"}
              {!editingParams && <ChevronLeft className="w-3.5 h-3.5 rotate-180" />}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {params.map((param) => (
              <div key={param.id} className="flex items-center gap-3">
                <span className="text-xs font-bold tracking-widest text-slate-500 w-24 flex-shrink-0 flex items-center gap-1.5 truncate">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                  {param.label}
                </span>
                {editingParams ? (
                  <Input
                    value={param.value}
                    onChange={(e) => setParams((prev) => prev.map((item) => (item.id === param.id ? { ...item, value: e.target.value } : item)))}
                    className="h-8 text-sm flex-1 bg-slate-50 border-slate-300 text-slate-900 focus-visible:ring-blue-500/50"
                  />
                ) : (
                  <span className="text-sm font-medium text-slate-700">{param.value}</span>
                )}
                {editingParams && (
                  <button onClick={() => setParams((prev) => prev.filter((item) => item.id !== param.id))} className="p-1 hover:bg-red-500/20 hover:text-red-400 text-slate-500 rounded-lg transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => setParams((prev) => [...prev, { id: `param-${Date.now()}`, label: "参数", value: "" }])}
            className="mt-4 flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            添加参数
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-5 mb-5 w-full">
          <div className="glass-panel border-slate-200 rounded-2xl p-5 shadow-xl transition-all h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-6 bg-purple-500 rounded-full"></div>
                 <h3 className="font-bold tracking-wide text-slate-900 text-base">产品优势</h3>
              </div>
              <button
                onClick={() => setEditingAdvantages(!editingAdvantages)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900"
              >
                <Pencil className="w-3.5 h-3.5" />
                {editingAdvantages ? "完成修改" : "修改优势"}
                {!editingAdvantages && <ChevronLeft className="w-3.5 h-3.5 rotate-180" />}
              </button>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {advantages.map((item) => (
                <div key={item.id} className="flex items-start gap-3 group">
                  <div className="w-2 h-2 mt-2 rounded-full bg-purple-400  flex-shrink-0" />
                  {editingAdvantages ? (
                    <Input
                      value={item.text}
                      onChange={(e) => setAdvantages((prev) => prev.map((current) => (current.id === item.id ? { ...current, text: e.target.value } : current)))}
                      className="h-9 text-sm flex-1 bg-slate-50 border-slate-300 text-slate-900 focus-visible:ring-purple-500/50"
                    />
                  ) : (
                    <span className="text-sm font-medium text-slate-600 leading-relaxed mt-0.5">{item.text}</span>
                  )}
                  {editingAdvantages && (
                    <button onClick={() => setAdvantages((prev) => prev.filter((current) => current.id !== item.id))} className="p-2 opacity-60 hover:opacity-100 hover:bg-red-500/20 text-red-400 rounded-lg transition-all mt-0.5">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {editingAdvantages ? (
              <div className="flex gap-2 mt-4 pt-3 border-t border-slate-200">
                <Input
                  value={newAdvantageText}
                  onChange={(e) => setNewAdvantageText(e.target.value)}
                  placeholder="输入产品优势描述"
                  className="h-10 text-sm flex-1 bg-blue-50 border-blue-300 text-slate-900 placeholder:text-slate-500 focus-visible:ring-blue-500"
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
                  className="px-3 py-1.5 text-xs font-bold tracking-wide bg-blue-600 hover:bg-blue-500 text-slate-900 rounded-lg shadow-sm transition-all"
                >
                  添加
                </button>
              </div>
            ) : (
              <button onClick={() => setEditingAdvantages(true)} className="mt-4 flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors">
                <Plus className="w-3.5 h-3.5" />
                添加优势
              </button>
            )}
          </div>

          <div className="glass-panel border-slate-200 rounded-2xl p-5 shadow-xl transition-all h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-6 bg-amber-500 rounded-full"></div>
                 <h3 className="font-bold tracking-wide text-slate-900 text-base">
                   功能展示
                   <span className="ml-2 text-xs font-medium text-slate-500 tracking-normal border border-slate-200 px-1.5 py-0.5 rounded">可选</span>
                 </h3>
              </div>
              <button
                onClick={() => setEditingFeatures(!editingFeatures)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900"
              >
                <Pencil className="w-3.5 h-3.5" />
                {editingFeatures ? "完成修改" : "修改展示"}
                {!editingFeatures && <ChevronLeft className="w-3.5 h-3.5 rotate-180" />}
              </button>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {featureTexts.map((item) => (
                <div key={item.id} className="flex items-start gap-3 group">
                  <div className="w-2 h-2 mt-2 rounded-full bg-amber-400  flex-shrink-0" />
                  {editingFeatures ? (
                    <Input
                      value={item.text}
                      onChange={(e) => setFeatureTexts((prev) => prev.map((current) => (current.id === item.id ? { ...current, text: e.target.value } : current)))}
                      className="h-9 text-sm flex-1 bg-slate-50 border-slate-300 text-slate-900 focus-visible:ring-amber-500/50"
                    />
                  ) : (
                    <span className="text-sm font-medium text-slate-600 leading-relaxed mt-0.5">{item.text}</span>
                  )}
                  {editingFeatures && (
                    <button onClick={() => setFeatureTexts((prev) => prev.filter((current) => current.id !== item.id))} className="p-2 opacity-60 hover:opacity-100 hover:bg-red-500/20 text-red-400 rounded-lg transition-all mt-0.5">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {editingFeatures ? (
              <div className="flex gap-2 mt-4 pt-3 border-t border-slate-200">
                <Input
                  value={newFeatureText}
                  onChange={(e) => setNewFeatureText(e.target.value)}
                  placeholder="输入功能描述"
                  className="h-10 text-sm flex-1 bg-blue-50 border-blue-300 text-slate-900 placeholder:text-slate-500 focus-visible:ring-blue-500"
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
                  className="px-3 py-1.5 text-xs font-bold tracking-wide bg-blue-600 hover:bg-blue-500 text-slate-900 rounded-lg shadow-sm transition-all"
                >
                  添加
                </button>
              </div>
            ) : (
              <button onClick={() => setEditingFeatures(true)} className="mt-4 flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors">
                <Plus className="w-3.5 h-3.5" />
                添加功能
              </button>
            )}
          </div>
        </div>

        <div className="glass-panel border-slate-200 rounded-2xl p-5 mb-8 shadow-xl transition-all">
          <h3 className="font-bold tracking-wide text-slate-900 text-base mb-4">
            添加参考内容
            <span className="ml-2 text-xs font-medium text-slate-500 tracking-normal border border-slate-200 px-1.5 py-0.5 rounded">可选</span>
          </h3>
          <div className="flex gap-3 mb-4">
            <Input
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
              placeholder="输入竞品链接或参考页面URL"
              className="flex-1 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-500 h-11"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddReferenceUrl();
              }}
            />
            <Button onClick={handleAddReferenceUrl} variant="outline" className="flex-shrink-0 h-11 border-slate-300 bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200">
              <LinkIcon className="w-4 h-4 mr-2" />
              添加
            </Button>
          </div>
          <button
            onClick={() => referenceImageInputRef.current?.click()}
            disabled={isUploadingReferenceImages}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-blue-300 rounded-xl bg-blue-50 hover:border-blue-400 hover:bg-blue-100 transition-all text-sm font-bold tracking-wide text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-5 h-5" />
            {isUploadingReferenceImages ? "上传中..." : "上传参考图片（支持多张）"}
          </button>
          <input ref={referenceImageInputRef} type="file" accept="image/*" multiple onChange={handleAddReferenceImage} className="hidden" />
          {(referenceLinks.length > 0 || referenceImages.length > 0) && (
            <div className="mt-4 space-y-2">
              {referenceLinks.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 bg-white/80 border border-slate-200 rounded-xl">
                  <LinkIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-700 flex-1 truncate">{item.name}</span>
                  <button onClick={() => setReferenceLinks((prev) => prev.filter((current) => current.id !== item.id))} className="p-1.5 hover:bg-red-500/20 hover:text-red-400 text-slate-500 rounded-lg transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {referenceImages.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 bg-white/80 border border-slate-200 rounded-xl">
                  <img src={item.content} alt={item.name} className="w-12 h-12 object-cover rounded shadow-md border border-slate-200 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-700 flex-1 truncate">{item.name}</span>
                  <button onClick={() => handleDeleteReferenceImage(item)} className="p-1.5 hover:bg-red-500/20 hover:text-red-400 text-slate-500 rounded-lg transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {saveError && (
          <div className="mb-4 flex items-center gap-3 text-sm text-red-400 bg-red-950/40 border border-red-500/30 rounded-xl px-4 py-3 backdrop-blur-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        <Button
          onClick={handleNext}
          disabled={isSaving}
          className="sci-fi-button w-full h-14 text-base font-bold tracking-widest rounded-2xl shadow-lg disabled:opacity-50"
        >
          {isSaving ? (
            <span className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
          className="w-full mt-5 flex items-center justify-center gap-2 text-sm font-bold tracking-wide text-slate-500 hover:text-blue-600 transition-colors"
        >
          <FileText className="w-4 h-4" />
          直接跑去生成详情文案
        </button>
      </div>
    </div>
  );
}
