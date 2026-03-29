const CREATE_FLOW_KEYS = [
  "current_session_id",
  "upload_slot_image_ids",
  "analysis_dirty",
  "analysis_snapshot_full",
  "analysisResult",
  "selectedProductType",
  "selectedPlatform",
  "selectedTheme",
  "productParams",
  "copywritings",
  "selected_asset_ids",
  "selectedImgCount",
  "selectedPlans",
  "paymentSuccess",
  "generatedImages",
  "hdImages",
  "current_result_version",
  "detail_current_version",
  "detail_result_autostart",
  "hdPaymentSuccess",
  "hd_unlocked_version",
];

export function clearCreateFlow() {
  CREATE_FLOW_KEYS.forEach((key) => sessionStorage.removeItem(key));
}

export function getResumeFlowPath(): string {
  if (sessionStorage.getItem("detail_current_version")) return "/create/detail-result";
  if (sessionStorage.getItem("hd_unlocked_version")) return "/create/hd-result";
  if (sessionStorage.getItem("current_result_version")) return "/create/result";
  if (sessionStorage.getItem("current_session_id")) return "/create/upload";
  return "/create/upload";
}
