// ============================================
// SmartPhoto - REST API Client (TypeScript)
// Backend: /api/v2 → proxied to FastAPI backend
// ============================================

import { toast as sonnerToast } from 'sonner';

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
}

export interface SessionResultAsset {
  asset_id: string;
  role: string;
  slot_id?: string | null;
  status?: string;
  display_order: number;
  image_url: string;
  thumbnail_url?: string | null;
  version_no?: number;
  width?: number;
  height?: number;
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
    status: item?.status,
    display_order: Number(item?.display_order ?? index),
    image_url: String(item?.image_url || item?.url || ''),
    thumbnail_url: item?.thumbnail_url ?? null,
    version_no: typeof item?.version_no === 'number' ? item.version_no : undefined,
    width: typeof item?.width === 'number' ? item.width : undefined,
    height: typeof item?.height === 'number' ? item.height : undefined,
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

function normalizePricingRules(data: any) {
  return asArray<any>(data?.items ?? data?.rules ?? data);
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

// ===== Core fetch wrapper =====
export async function apiFetch<T = any>(path: string, options: RequestInit & { _isRetry?: boolean } = {}): Promise<T> {
  const token = sessionStorage.getItem('auth_token');
  const hadToken = !!token;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 401) {
    if (!options._isRetry && token) {
      try {
        const refreshData = await authAPI.refresh();
        if (refreshData && refreshData.access_token) {
          sessionStorage.setItem('auth_token', refreshData.access_token);
          return apiFetch(path, { ...options, _isRetry: true });
        }
      } catch { /* refresh failed */ }
    }
    const authMessage = hadToken ? '登录已过期，请重新登录' : '请先登录后继续';
    const authReason = hadToken ? 'expired' : 'unauthenticated';
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_user');
    window.dispatchEvent(new CustomEvent('auth:logout', {
      detail: {
        reason: authReason,
        path,
        message: authMessage,
      },
    }));
    sonnerToast.error(authMessage, {
      description: hadToken
        ? '登录状态已经失效，当前操作需要重新登录。'
        : '当前操作需要登录后才能继续。',
    });
    throw new Error(authMessage);
  }

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
  register(email: string, password: string, displayName: string) {
    return apiFetch<{ access_token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, display_name: displayName }),
    });
  },
  login(email: string, password: string) {
    return apiFetch<{ access_token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  logout() {
    return apiFetch('/auth/logout', { method: 'POST' });
  },
  me() {
    return apiFetch<any>('/auth/me');
  },
  refresh() {
    return apiFetch<{ access_token: string }>('/auth/refresh', { method: 'POST' });
  },
};

// ===== Account API =====
export const accountAPI = {
  getOverview() { return apiFetch<any>('/account/overview'); },
  async getPurchases() {
    const data = await apiFetch<any>('/account/purchases');
    return asArray<any>(data?.items ?? data);
  },
  getNotifications() { return apiFetch<any[]>('/account/notifications'); },
  getWallet() { return apiFetch<any>('/account/wallet'); },
  getSettings() { return apiFetch<any>('/account/settings'); },
  updateSettings(data: any) {
    return apiFetch('/account/settings', { method: 'PUT', body: JSON.stringify(data) });
  },
  changePassword(currentPassword: string, newPassword: string) {
    return apiFetch('/account/security/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
  },
  getProfile() { return apiFetch<any>('/account/profile'); },
  updateProfile(data: any) {
    return apiFetch('/account/profile', { method: 'PUT', body: JSON.stringify(data) });
  },
  async getWalletTransactions() {
    const data = await apiFetch<any>('/account/wallet/transactions');
    return asArray<any>(data?.items ?? data);
  },
  markNotificationRead(id: string) {
    return apiFetch(`/account/notifications/${id}/read`, { method: 'POST' });
  },
  markAllNotificationsRead() {
    return apiFetch('/account/notifications/read-all', { method: 'POST' });
  },
  async getAssets(params: Record<string, string> = {}) {
    const qs = new URLSearchParams(params).toString();
    const data = await apiFetch<any>('/account/assets' + (qs ? `?${qs}` : ''));
    return normalizeAccountAssets(data);
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

    // Step 2: Upload to COS via our Vite proxy to avoid CORS issues
    // Rewrite: https://xxx.cos.ap-beijing.myqcloud.com/path -> /cos-proxy/path
    const cosUrl = new URL(presign.upload_url);
    const proxiedUrl = `/__cos_proxy__${cosUrl.pathname}${cosUrl.search}`;

    const uploadRes = await fetch(proxiedUrl, {
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
    const token = sessionStorage.getItem('auth_token');
    const qs = version ? `?version=${version}` : '';
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/download${qs}`, {
      headers: { 'Authorization': `Bearer ${token || ''}` },
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
    const token = sessionStorage.getItem('auth_token');
    const qs = version ? `?version=${version}` : '';
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/detail-pages/download${qs}`, {
      headers: { 'Authorization': `Bearer ${token || ''}` },
    });
    if (!res.ok) throw new Error('Detail download failed');
    return res.blob();
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
        throw new Error(status.error_message || status.error || 'Job failed');
      }
      await new Promise(r => setTimeout(r, interval));
    }
    throw new Error('Job timed out');
  },

  streamEvents(jobId: string, onEvent: (evt: { type: string; data: any }) => void) {
    const token = sessionStorage.getItem('auth_token');
    let closed = false;
    try {
      const url = `${API_BASE}/jobs/${jobId}/events`;
      const es = new EventSource(url + (token ? `?token=${encodeURIComponent(token)}` : ''));
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
  regenerate(assetId: string, instruction: string) {
    return apiFetch(`/assets/${assetId}/regenerate`, {
      method: 'POST',
      body: JSON.stringify({ instruction, keep_style_consistency: true }),
    });
  },
};

// ===== Pricing API =====
export const pricingAPI = {
  async getRules() {
    const data = await apiFetch<any>('/account/pricing');
    return normalizePricingRules(data);
  },
};
