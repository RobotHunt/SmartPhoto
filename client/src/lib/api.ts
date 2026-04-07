// ============================================
// SmartPhoto - REST API Client (TypeScript)
// Backend: /api/v2 → proxied to FastAPI backend
// ============================================

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api/v2').replace(/\/$/, '');

function asArray<T = any>(value: any): T[] {
  return Array.isArray(value) ? value : [];
}

export interface AccountAssetPreview {
  image_url: string;
  asset_family?: string;
  role?: string;
}

export interface AccountAssetCounts {
  original: number;
  main: number;
  detail: number;
  white_bg: number;
}

export interface AccountAssetCard {
  session_id: string;
  product_name?: string | null;
  brand_name?: string | null;
  platform_id?: string | null;
  created_at?: string | null;
  last_generated_at?: string | null;
  latest_main_version: number;
  latest_detail_version: number;
  counts: AccountAssetCounts;
  previews: AccountAssetPreview[];
  tags: string[];
  results_url?: string;
  detail_results_url?: string;
  download_url?: string;
  detail_download_url?: string;
}

export interface AccountAssetListResponse {
  items: AccountAssetCard[];
  total: number;
  page: number;
  page_size: number;
}

export interface SessionImageItem {
  image_id: string;
  url: string;
  slot_type?: string | null;
  display_order?: number;
}

export interface SessionSnapshot {
  session_id: string;
  status: string;
  current_step: number;
  selected_platform_ids: string[];
  active_platform_id?: string | null;
  analysis_snapshot?: Record<string, any> | null;
  parameter_snapshot?: Record<string, any> | null;
  confirmed_copy?: Record<string, any> | null;
  strategy_preview?: Record<string, any> | null;
  detail_strategy_preview?: Record<string, any> | null;
  latest_generate_job_id?: string | null;
  latest_detail_generate_job_id?: string | null;
  latest_parameter_job_id?: string | null;
  generation_round: number;
  latest_result_version: number;
  detail_generation_round: number;
  detail_latest_result_version: number;
}

export interface VersionSummary {
  version_no: number;
  asset_count: number;
  ready_count: number;
  created_at?: string | null;
  job_type?: string | null;
  is_partial?: boolean;
  cover_asset_id?: string | null;
  cover_thumbnail_url?: string | null;
  missing_slot_ids?: string[];
  missing_panel_ids?: string[];
}

export interface SessionResultAsset {
  asset_id: string;
  role: string;
  slot_id?: string | null;
  expression_mode?: string | null;
  rule_pack_id?: string | null;
  status?: string;
  display_order: number;
  image_url: string;
  thumbnail_url?: string | null;
  version_no?: number;
  width?: number;
  height?: number;
  carry_forward?: boolean;
  source_version_no?: number | null;
  fidelity_validation_status?: string | null;
  quality_status?: string;
  quality_scores?: Record<string, any> | null;
  quality_review_job_id?: string | null;
  failure_reason?: string | null;
}

export interface SessionResults {
  session_id: string;
  status: string;
  generation_round: number;
  latest_result_version: number;
  requested_version: number;
  available_versions: number[];
  version_summaries: VersionSummary[];
  summary: {
    total_count: number;
    ready_count: number;
  };
  assets: SessionResultAsset[];
}

export interface MainGalleryCopyBlocks {
  headline: string;
  supporting: string;
  proof_lines: string[];
  matrix_lines: string[];
}

export interface PromptPreviewItem {
  role: string;
  slot_id?: string | null;
  slot_label?: string | null;
  role_label?: string | null;
  display_order: number;
  copy_blocks: MainGalleryCopyBlocks;
  risk_flags?: string[];
  selling_point_binding?: Record<string, any> | null;
  truth_contract?: Record<string, any> | null;
}

export interface PromptPreviewData {
  session_id: string;
  prompts: PromptPreviewItem[];
  latest_assets: Array<Record<string, any>>;
}

export interface StrategyOverrideItem {
  slot_id: string;
  copy_blocks_override: Partial<MainGalleryCopyBlocks>;
  raw_prompt_override?: string | null;
  expression_mode_override?: string | null;
  applied_preset_id?: string | null;
  locked?: boolean;
}

export interface StrategyOverridesData {
  session_id: string;
  overrides: StrategyOverrideItem[];
}

function normalizeAccountAssets(data: any): AccountAssetListResponse {
  return {
    items: asArray<AccountAssetCard>(data?.items).map((item: any) => ({
      session_id: String(item?.session_id || ''),
      product_name: item?.product_name ?? null,
      brand_name: item?.brand_name ?? null,
      platform_id: item?.platform_id ?? null,
      created_at: item?.created_at ?? null,
      last_generated_at: item?.last_generated_at ?? null,
      latest_main_version: Number(item?.latest_main_version || 0),
      latest_detail_version: Number(item?.latest_detail_version || 0),
      counts: {
        original: Number(item?.counts?.original || 0),
        main: Number(item?.counts?.main || 0),
        detail: Number(item?.counts?.detail || 0),
        white_bg: Number(item?.counts?.white_bg || 0),
      },
      previews: asArray<AccountAssetPreview>(item?.previews).map((preview: any) => ({
        image_url: String(preview?.image_url || ''),
        asset_family: preview?.asset_family,
        role: preview?.role,
      })),
      tags: asArray<string>(item?.tags),
      results_url: item?.results_url,
      detail_results_url: item?.detail_results_url,
      download_url: item?.download_url,
      detail_download_url: item?.detail_download_url,
    })),
    total: Number(data?.total || 0),
    page: Number(data?.page || 1),
    page_size: Number(data?.page_size || 20),
  };
}

function normalizeSessionImages(data: any): SessionImageItem[] {
  const rawImages = asArray<any>(data?.images ?? data);
  return rawImages.map((image, index) => ({
    image_id: String(image?.image_id || image?.id || image?.resource_id || index + 1),
    url: String(image?.url || image?.image_url || image?.source_url || ''),
    slot_type: image?.slot_type ?? null,
    display_order: typeof image?.display_order === 'number' ? image.display_order : undefined,
  }));
}

function normalizeSessionSnapshot(data: any): SessionSnapshot {
  return {
    session_id: String(data?.session_id || ''),
    status: String(data?.status || 'created'),
    current_step: Number(data?.current_step || 1),
    selected_platform_ids: asArray<string>(data?.selected_platform_ids),
    active_platform_id: data?.active_platform_id ?? null,
    analysis_snapshot: data?.analysis_snapshot ?? null,
    parameter_snapshot: data?.parameter_snapshot ?? null,
    confirmed_copy: data?.confirmed_copy ?? null,
    strategy_preview: data?.strategy_preview ?? null,
    detail_strategy_preview: data?.detail_strategy_preview ?? null,
    latest_generate_job_id: data?.latest_generate_job_id ?? null,
    latest_detail_generate_job_id: data?.latest_detail_generate_job_id ?? null,
    latest_parameter_job_id: data?.latest_parameter_job_id ?? null,
    generation_round: Number(data?.generation_round || 0),
    latest_result_version: Number(data?.latest_result_version || 0),
    detail_generation_round: Number(data?.detail_generation_round || 0),
    detail_latest_result_version: Number(data?.detail_latest_result_version || 0),
  };
}

function normalizeSessionResults(data: any): SessionResults {
  const assets = asArray<any>(data?.assets ?? data?.images ?? data?.results).map((item: any, index: number) => ({
    asset_id: String(item?.asset_id || item?.id || index + 1),
    role: String(item?.role || item?.asset_role || 'hero'),
    slot_id: item?.slot_id ?? null,
    expression_mode: item?.expression_mode ?? null,
    rule_pack_id: item?.rule_pack_id ?? null,
    status: item?.status,
    display_order: Number(item?.display_order ?? index),
    image_url: String(item?.image_url || item?.url || ''),
    thumbnail_url: item?.thumbnail_url ?? null,
    version_no: typeof item?.version_no === 'number' ? item.version_no : undefined,
    width: typeof item?.width === 'number' ? item.width : undefined,
    height: typeof item?.height === 'number' ? item.height : undefined,
    carry_forward: Boolean(item?.carry_forward),
    source_version_no: typeof item?.source_version_no === 'number' ? item.source_version_no : null,
    fidelity_validation_status: item?.fidelity_validation_status ?? null,
    quality_status: item?.quality_status ?? "unchecked",
    quality_scores: item?.quality_scores ?? null,
    quality_review_job_id: item?.quality_review_job_id ?? null,
    failure_reason: item?.failure_reason ?? null,
  }));

  return {
    session_id: String(data?.session_id || ''),
    status: String(data?.status || ''),
    generation_round: Number(data?.generation_round || 0),
    latest_result_version: Number(data?.latest_result_version || data?.requested_version || 0),
    requested_version: Number(data?.requested_version || data?.latest_result_version || 0),
    available_versions: asArray<number>(data?.available_versions).map((version) => Number(version || 0)).filter(Boolean),
    version_summaries: asArray<VersionSummary>(data?.version_summaries).map((summary: any) => ({
      version_no: Number(summary?.version_no || 0),
      asset_count: Number(summary?.asset_count || 0),
      ready_count: Number(summary?.ready_count || 0),
      created_at: summary?.created_at ?? null,
      job_type: summary?.job_type ?? null,
      is_partial: Boolean(summary?.is_partial),
      cover_asset_id: summary?.cover_asset_id ?? null,
      cover_thumbnail_url: summary?.cover_thumbnail_url ?? null,
      missing_slot_ids: asArray<string>(summary?.missing_slot_ids),
      missing_panel_ids: asArray<string>(summary?.missing_panel_ids),
    })),
    summary: {
      total_count: Number(data?.summary?.total_count || assets.length),
      ready_count: Number(data?.summary?.ready_count || assets.length),
    },
    assets,
  };
}

function normalizePlatformList(data: any) {
  return asArray<any>(data?.items ?? data?.platforms ?? data);
}

function stringifyErrorValue(value: any): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function removedFeature(name: string): Promise<never> {
  return Promise.reject(new Error(`${name} 已下线：后端已切换为纯图片 SaaS 模式。`));
}

// ===== Core fetch wrapper =====
export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message =
      stringifyErrorValue(errData.message) ||
      stringifyErrorValue(errData.detail) ||
      `HTTP ${res.status}`;
    throw new Error(message);
  }

  if (res.status === 204) return null as T;

  const json = await res.json();

  if (json && typeof json.code !== 'undefined') {
    if (json.code !== 0) {
      throw new Error(json.message || 'API error');
    }
    return json.data;
  }

  return json;
}

// ===== Auth API =====
export const authAPI = {
  register(_email: string, _password: string, _displayName: string) {
    return removedFeature('登录/注册');
  },
  login(_email: string, _password: string) {
    return removedFeature('登录');
  },
  logout() {
    return removedFeature('退出登录');
  },
  me() {
    return removedFeature('账户信息');
  },
  refresh() {
    return removedFeature('登录刷新');
  },
};

// ===== Account API =====
export const accountAPI = {
  getOverview() { return removedFeature('账户总览'); },
  getPurchases() { return removedFeature('购买记录'); },
  getNotifications() { return removedFeature('账户通知'); },
  getWallet() { return removedFeature('钱包额度'); },
  getSettings() { return removedFeature('账户设置'); },
  updateSettings(_data: any) {
    return removedFeature('账户设置');
  },
  changePassword(_currentPassword: string, _newPassword: string) {
    return removedFeature('密码修改');
  },
  getProfile() { return removedFeature('个人资料'); },
  updateProfile(_data: any) {
    return removedFeature('个人资料');
  },
  getWalletTransactions() { return removedFeature('钱包流水'); },
  markNotificationRead(_id: string) {
    return removedFeature('账户通知');
  },
  markAllNotificationsRead() {
    return removedFeature('账户通知');
  },
  getAssets(_params: Record<string, string> = {}) {
    return removedFeature('历史资产');
  },
};

// ===== Session API (6-step generation flow) =====
export const sessionAPI = {
  create() {
    return apiFetch<{ session_id: string }>('/sessions', { method: 'POST' });
  },
  async get(sessionId: string) {
    const data = await apiFetch<any>(`/sessions/${sessionId}`);
    return normalizeSessionSnapshot(data);
  },

  // Step 1: Upload images (presign-based direct upload)
  async uploadImage(sessionId: string, file: File, slotType?: string, displayOrder?: number) {
    return this.uploadWithPresign(sessionId, file, 'session_image', {
      slot_type: slotType || null,
      display_order: displayOrder,
    });
  },

  async uploadWithPresign(
    sessionId: string,
    file: File,
    uploadKind: 'session_image' | 'detail_style_image' | 'parameter_attachment' | 'strategy_reference_image',
    extra: { slot_type?: string | null; display_order?: number } = {},
  ) {
    // Ensure display_order is at least 1 (backend requirement)
    const displayOrder = Math.max(1, Number(extra.display_order ?? 1));

    // Step 1: Request presigned upload URL
    const presign = await apiFetch<{
      upload_id: string;
      method: string;
      upload_url: string;
      headers: Record<string, string>;
      form_fields: Record<string, string>;
    }>('/uploads/presign', {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionId,
        upload_kind: uploadKind,
        original_name: file.name,
        content_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        display_order: displayOrder,
        slot_type: extra.slot_type ?? null,
      }),
    });

    // Step 2: Upload to COS
    // In development (Vite), use proxy to avoid CORS: /__cos_proxy__ -> COS
    // In production, CORS is configured on COS bucket, use presigned URL directly
    const cosUrl = new URL(presign.upload_url);
    const uploadUrl = import.meta.env.DEV
      ? `/__cos_proxy__${cosUrl.pathname}${cosUrl.search}`
      : presign.upload_url;

    const uploadRes = await fetch(uploadUrl, {
      method: presign.method || 'PUT',
      headers: {
        ...(presign.headers || {}),
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
    });

    if (!uploadRes.ok) {
      throw new Error(`Upload failed: HTTP ${uploadRes.status}`);
    }

    // Step 3: Complete the upload
    // Backend returns: { upload_id, session_id, upload_kind, object_key, completed, resource_id, resource: { resource_id, display_order, url, slot_type } }
    // Map to the { image_id, url } format expected by UploadStep
    const completeRes = await apiFetch<{
      resource_id: string;
      resource: { resource_id: string; display_order: number; url: string; slot_type?: string };
    }>('/uploads/complete', {
      method: 'POST',
      body: JSON.stringify({ upload_id: presign.upload_id }),
    });
    return {
      image_id: completeRes.resource_id,
      url: completeRes.resource?.url || '',
    };
  },
  deleteImage(sessionId: string, imageId: string) {
    return apiFetch(`/sessions/${sessionId}/images/${imageId}`, { method: 'DELETE' });
  },
  async listImages(sessionId: string) {
    const data = await apiFetch<any>(`/sessions/${sessionId}/images`);
    return normalizeSessionImages(data);
  },

  // Step 2: Analysis
  triggerAnalysis(sessionId: string) {
    return apiFetch<{ job_id: string }>(`/sessions/${sessionId}/analysis`, { method: 'POST' });
  },
  getAnalysis(sessionId: string) {
    return apiFetch<any>(`/sessions/${sessionId}/analysis`);
  },

  // Step 3: Platform selection
  savePlatformSelection(sessionId: string, platformIds: string[], activeId?: string) {
    return apiFetch(`/sessions/${sessionId}/platform-selection`, {
      method: 'PUT',
      body: JSON.stringify({ selected_platform_ids: platformIds, active_platform_id: activeId }),
    });
  },

  // Step 4: Copy
  getCopy(sessionId: string) { return apiFetch<any>(`/sessions/${sessionId}/copy`); },
  saveCopy(sessionId: string, data: any) {
    return apiFetch(`/sessions/${sessionId}/copy`, { method: 'PUT', body: JSON.stringify(data) });
  },
  regenerateCopy(sessionId: string, targets: string[], instruction?: string) {
    const body: any = { targets, based_on_current_values: true };
    if (instruction) body.instruction = instruction;
    return apiFetch<{ job_id: string }>(`/sessions/${sessionId}/copy/regenerate`, {
      method: 'POST', body: JSON.stringify(body),
    });
  },
  previewPrompts(
    sessionId: string,
    options: { instruction?: string | null; include_latest_assets?: boolean } = {},
  ) {
    return apiFetch<PromptPreviewData>(`/sessions/${sessionId}/prompts/preview`, {
      method: 'POST',
      body: JSON.stringify({
        instruction: options.instruction ?? null,
        include_latest_assets: options.include_latest_assets ?? true,
      }),
    });
  },
  getStrategyOverrides(sessionId: string) {
    return apiFetch<StrategyOverridesData>(`/sessions/${sessionId}/strategy/overrides`);
  },
  saveStrategyOverrides(sessionId: string, data: { overrides: StrategyOverrideItem[] }) {
    return apiFetch<StrategyOverridesData>(`/sessions/${sessionId}/strategy/overrides`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Step 5: Strategy preview
  buildStrategy(sessionId: string) {
    return apiFetch<any>(`/sessions/${sessionId}/strategy/preview`, { method: 'POST' });
  },

  // Step 6: Generation
  generateGallery(sessionId: string) {
    return apiFetch<{ job_id: string }>(`/sessions/${sessionId}/generations`, {
      method: 'POST', body: JSON.stringify({}),
    });
  },
  async getResults(sessionId: string, version?: number) {
    const qs = version ? `?version=${version}` : '';
    const data = await apiFetch<any>(`/sessions/${sessionId}/results${qs}`);
    return normalizeSessionResults(data);
  },
  async downloadResults(sessionId: string, version?: number): Promise<Blob> {
    const qs = version ? `?version=${version}` : '';
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/download${qs}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Download failed');
    return res.blob();
  },

  // Detail pages
  previewDetailStrategy(sessionId: string, plannerInstruction?: string) {
    const body = plannerInstruction ? { planner_instruction: plannerInstruction } : {};
    return apiFetch<any>(`/sessions/${sessionId}/detail-pages/strategy/preview`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  generateDetailPage(sessionId: string) {
    return apiFetch(`/sessions/${sessionId}/detail-pages/generations`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },
  getDetailResults(sessionId: string, version?: number) {
    const qs = version ? `?version=${version}` : '';
    return apiFetch<any>(`/sessions/${sessionId}/detail-pages/results${qs}`);
  },
  async downloadDetailResults(sessionId: string, version?: number): Promise<Blob> {
    const qs = version ? `?version=${version}` : '';
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/detail-pages/download${qs}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Detail download failed');
    return res.blob();
  },
  claimGuestSession(_sessionId: string) {
    return removedFeature('会话认领');
  },

  // Global edit
  globalEdit(sessionId: string, instruction: string) {
    return apiFetch(`/sessions/${sessionId}/results/global-edit`, {
      method: 'POST', body: JSON.stringify({ instruction, scope: 'all' }),
    });
  },

  // Parameters
  getParameters(sessionId: string) { return apiFetch<any>(`/sessions/${sessionId}/parameters`); },
  updateParameters(sessionId: string, data: any) {
    return apiFetch(`/sessions/${sessionId}/parameters`, { method: 'PUT', body: JSON.stringify(data) });
  },
  extractParameters(sessionId: string) {
    return apiFetch<{ job_id: string; status?: string }>(`/sessions/${sessionId}/parameters/extract`, { method: 'POST' });
  },
  completeParameters(sessionId: string, completionInstruction?: string) {
    return apiFetch<any>(`/sessions/${sessionId}/parameters/complete`, {
      method: 'POST',
      body: JSON.stringify({
        completion_instruction: completionInstruction || null,
      }),
    });
  },

  // Strategy reference images
  uploadStrategyRefImage(sessionId: string, file: File, displayOrder = 1) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('display_order', String(displayOrder));
    return apiFetch(`/sessions/${sessionId}/strategy-reference-images`, { method: 'POST', body: fd });
  },
  async listStrategyRefImages(sessionId: string) {
    const data = await apiFetch<any>(`/sessions/${sessionId}/strategy-reference-images`);
    return asArray<any>(data?.images ?? data?.items ?? data);
  },
  deleteStrategyRefImage(sessionId: string, imgId: string) {
    return apiFetch(`/sessions/${sessionId}/strategy-reference-images/${imgId}`, { method: 'DELETE' });
  },

  // Parameter attachments
  uploadParamAttachment(sessionId: string, file: File, displayOrder = 1) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('display_order', String(displayOrder));
    return apiFetch(`/sessions/${sessionId}/parameter-attachments`, { method: 'POST', body: fd });
  },
  async listParamAttachments(sessionId: string) {
    const data = await apiFetch<any>(`/sessions/${sessionId}/parameter-attachments`);
    return asArray<any>(data?.attachments ?? data?.items ?? data);
  },
  deleteParamAttachment(sessionId: string, attId: string) {
    return apiFetch(`/sessions/${sessionId}/parameter-attachments/${attId}`, { method: 'DELETE' });
  },
};

// ===== Platform API =====
export const platformAPI = {
  async list() {
    const data = await apiFetch<any>('/platforms');
    return normalizePlatformList(data);
  },
  async getExpressionModes(platformId: string) {
    return apiFetch<any>(`/platforms/${platformId}/expression-modes`);
  },
};

// ===== Job API =====
export const jobAPI = {
  getStatus(jobId: string) {
    return apiFetch<any>(`/jobs/${jobId}`);
  },

  async pollUntilDone(
    jobId: string,
    onProgress?: (status: any) => void,
    interval = 3000,
    timeout = 300000
  ) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const status = await this.getStatus(jobId);
      onProgress?.(status);
      if (['completed', 'done', 'succeeded'].includes(status.status)) return status;
      if (['failed', 'error'].includes(status.status)) {
        const error: any = new Error(status.error_message || status.error || 'Job failed');
        error.code = status.error_code || null;
        error.result_payload = status.result_payload || null;
        error.jobStatus = status;
        throw error;
      }
      await new Promise(r => setTimeout(r, interval));
    }
    const timeoutError: any = new Error('Job timed out');
    timeoutError.code = 'job_timeout';
    throw timeoutError;
  },

  streamEvents(jobId: string, onEvent: (evt: { type: string; data: any }) => void) {
    let closed = false;
    try {
      const url = `${API_BASE}/jobs/${jobId}/events`;
      const es = new EventSource(url);
      es.onmessage = (e) => {
        if (closed) return;
        try { onEvent({ type: 'message', data: JSON.parse(e.data) }); }
        catch { onEvent({ type: 'message', data: e.data }); }
      };
      es.addEventListener('complete', (e: any) => {
        if (closed) return;
        try { onEvent({ type: 'complete', data: JSON.parse(e.data) }); } catch {}
        es.close();
      });
      es.addEventListener('error', (e: any) => {
        if (closed) return;
        try { onEvent({ type: 'error', data: JSON.parse(e.data) }); } catch {}
        es.close();
      });
      es.onerror = () => {
        if (closed) return;
        es.close();
        this.pollUntilDone(jobId, (s) => onEvent({ type: 'progress', data: s }))
          .then(s => onEvent({ type: 'complete', data: s }))
          .catch(err => onEvent({ type: 'error', data: { message: err.message } }));
      };
      return () => { closed = true; es.close(); };
    } catch {
      this.pollUntilDone(jobId, (s) => onEvent({ type: 'progress', data: s }))
        .then(s => onEvent({ type: 'complete', data: s }))
        .catch(err => onEvent({ type: 'error', data: { message: err.message } }));
      return () => { closed = true; };
    }
  },
};

// ===== Asset API =====
export const assetAPI = {
  regenerate(
    assetId: string, 
    instruction: string,
    editConstraints?: {
      keep?: string[];
      change?: Record<string, string>;
      remove?: string[];
    }
  ) {
    return apiFetch(`/assets/${assetId}/regenerate`, {
      method: 'POST',
      body: JSON.stringify({ 
        instruction, 
        keep_style_consistency: true,
        ...(editConstraints ? { edit_constraints: editConstraints } : {})
      }),
    });
  },
  submitFeedback(assetId: string, data: { rating: number; issue_tags?: string[]; comment?: string }) {
    return apiFetch(`/assets/${assetId}/feedback`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  getFeedback(assetId: string) {
    return apiFetch<any>(`/assets/${assetId}/feedback`);
  },
  getHistory(assetId: string) {
    return apiFetch<any>(`/assets/${assetId}/history`);
  },
  restore(assetId: string) {
    return apiFetch<any>(`/assets/${assetId}/restore`, { method: 'POST' });
  },
};

// ===== Pricing API =====
export const pricingAPI = {
  getRules() {
    return removedFeature('价格规则');
  },
};
