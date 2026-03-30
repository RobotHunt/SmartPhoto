export const ANALYSIS_DIRTY_KEY = "analysis_dirty";
export const ANALYSIS_SNAPSHOT_KEY = "analysis_snapshot_full";
export const ANALYSIS_RESULT_KEY = "analysisResult";
export const ANALYSIS_SUPPLEMENT_LIST_KEY = "analysis_supplement_recommendations";
export const ANALYSIS_REFRESH_REQUIRED_KEY = "analysis_refresh_required";

export interface CandidateItem {
  type: string;
  confidence: number;
  reason: string;
}

export interface SupplementRecommendation {
  slot_type: string;
  label: string;
  reason: string;
  priority: number;
  upload_goal: string;
  must_show: string;
  framing_hint: string;
  example_caption: string;
  image_kind?: string | null;
}

export interface AnalysisResult {
  product_name: string;
  product_type: string;
  category: string;
  visual_features: string[];
  suggestions: string[];
  scene_tags: string[];
  category_candidates: CandidateItem[];
  supplement_image_recommendations: SupplementRecommendation[];
}

function parseStringList(value: any): string[] {
  if (Array.isArray(value)) {
    return value.map((item: any) => String(item || "").trim()).filter(Boolean);
  }
  return String(value || "")
    .split(/[,\uFF0C\u3001\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCandidates(snapshot: any, fallbackCategory: string): CandidateItem[] {
  const items = Array.isArray(snapshot?.category_candidates) ? snapshot.category_candidates : [];
  const parsed = items
    .map((item: any) => ({
      type: String(item?.category || "").trim(),
      confidence: Number(item?.confidence || 0),
      reason: String(item?.reason || "").trim(),
    }))
    .filter((item: CandidateItem) => item.type);
  if (parsed.length > 0) return parsed;
  return fallbackCategory
    ? [{ type: fallbackCategory, confidence: 98, reason: "当前识别结果的主类目。" }]
    : [{ type: "其他", confidence: 60, reason: "未识别到更明确的品类。" }];
}

function parseSupplementRecommendations(snapshot: any): SupplementRecommendation[] {
  const items = Array.isArray(snapshot?.supplement_image_recommendations)
    ? snapshot.supplement_image_recommendations
    : [];
  return items
    .map((item: any, index: number) => ({
      slot_type: String(item?.slot_type || "").trim(),
      label: String(item?.label || "").trim() || "补充图片",
      reason: String(item?.reason || "").trim(),
      priority: Number(item?.priority || index + 1),
      upload_goal: String(item?.upload_goal || "").trim(),
      must_show: String(item?.must_show || "").trim(),
      framing_hint: String(item?.framing_hint || "").trim(),
      example_caption: String(item?.example_caption || "").trim(),
      image_kind: item?.image_kind ? String(item.image_kind).trim() : null,
    }))
    .filter((item: SupplementRecommendation) => item.slot_type && item.label);
}

export function parseAnalysisSnapshot(snapshot: any): AnalysisResult {
  const recognized = snapshot?.recognized_product || {};
  const fallbackCategory =
    String(recognized.category || snapshot?.product_category || snapshot?.category || "其他").trim() ||
    "其他";
  const categoryCandidates = parseCandidates(snapshot, fallbackCategory);
  const supplementRecommendations = parseSupplementRecommendations(snapshot);

  return {
    product_name: String(recognized.product_name || snapshot?.product_name || "产品").trim() || "产品",
    product_type: String(recognized.image_type || snapshot?.product_type || "实物图").trim() || "实物图",
    category: fallbackCategory,
    visual_features: parseStringList(snapshot?.suggested_styles || snapshot?.visual_features),
    suggestions: parseStringList(snapshot?.suggestions),
    scene_tags: parseStringList(snapshot?.scene_tags),
    category_candidates: categoryCandidates,
    supplement_image_recommendations: supplementRecommendations,
  };
}

export function hasAnalysisContent(snapshot: any): boolean {
  if (!snapshot || typeof snapshot !== "object") return false;
  const recognized = snapshot.recognized_product || {};
  if (String(recognized.product_name || snapshot.product_name || "").trim()) return true;
  if (String(recognized.category || snapshot.product_category || snapshot.category || "").trim()) return true;
  if (parseStringList(snapshot.suggested_styles || snapshot.visual_features).length > 0) return true;
  if (parseStringList(snapshot.suggestions).length > 0) return true;
  if (parseStringList(snapshot.scene_tags).length > 0) return true;
  if (Array.isArray(snapshot.category_candidates) && snapshot.category_candidates.length > 0) return true;
  return false;
}

export function clearStoredAnalysisSnapshot() {
  sessionStorage.removeItem(ANALYSIS_SNAPSHOT_KEY);
  sessionStorage.removeItem(ANALYSIS_RESULT_KEY);
  sessionStorage.removeItem(ANALYSIS_SUPPLEMENT_LIST_KEY);
}

export function markAnalysisRefreshRequired() {
  sessionStorage.setItem(ANALYSIS_DIRTY_KEY, "1");
  sessionStorage.setItem(ANALYSIS_REFRESH_REQUIRED_KEY, "1");
  clearStoredAnalysisSnapshot();
}

export function cacheAnalysisSnapshot(snapshot: any): AnalysisResult {
  const parsed = parseAnalysisSnapshot(snapshot);
  sessionStorage.setItem(ANALYSIS_SNAPSHOT_KEY, JSON.stringify(snapshot));
  sessionStorage.setItem(ANALYSIS_RESULT_KEY, JSON.stringify(parsed));
  sessionStorage.setItem(
    ANALYSIS_SUPPLEMENT_LIST_KEY,
    JSON.stringify(parsed.supplement_image_recommendations),
  );
  return parsed;
}

export function completeAnalysisRefresh(snapshot: any): AnalysisResult {
  const parsed = cacheAnalysisSnapshot(snapshot);
  sessionStorage.removeItem(ANALYSIS_DIRTY_KEY);
  sessionStorage.removeItem(ANALYSIS_REFRESH_REQUIRED_KEY);
  return parsed;
}
