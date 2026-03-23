// ============================================
// SmartPhoto - REST API Client (TypeScript)
// Backend: /api/v2 → proxied to FastAPI backend
// ============================================

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api/v2').replace(/\/$/, '');

// ===== Core fetch wrapper =====
export async function apiFetch<T = any>(path: string, options: RequestInit & { _isRetry?: boolean } = {}): Promise<T> {
  const token = sessionStorage.getItem('auth_token');
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
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_user');
    window.dispatchEvent(new Event('auth:logout'));
    throw new Error('登录已过期，请重新登录');
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || errData.detail || `HTTP ${res.status}`);
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
  getPurchases() { return apiFetch<any[]>('/account/purchases'); },
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
  getWalletTransactions() { return apiFetch<any[]>('/account/wallet/transactions'); },
  markNotificationRead(id: string) {
    return apiFetch(`/account/notifications/${id}/read`, { method: 'POST' });
  },
  markAllNotificationsRead() {
    return apiFetch('/account/notifications/read-all', { method: 'POST' });
  },
  getAssets(params: Record<string, string> = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiFetch<any[]>('/account/assets' + (qs ? `?${qs}` : ''));
  },
};

// ===== Session API (6-step generation flow) =====
export const sessionAPI = {
  create() {
    return apiFetch<{ session_id: string }>('/sessions', { method: 'POST' });
  },
  get(sessionId: string) {
    return apiFetch<any>(`/sessions/${sessionId}`);
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
  listImages(sessionId: string) {
    return apiFetch<any[]>(`/sessions/${sessionId}/images`);
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
  getResults(sessionId: string, version?: number) {
    const qs = version ? `?version=${version}` : '';
    return apiFetch<any>(`/sessions/${sessionId}/results${qs}`);
  },
  async downloadResults(sessionId: string): Promise<Blob> {
    const token = sessionStorage.getItem('auth_token');
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/download`, {
      headers: { 'Authorization': `Bearer ${token || ''}` },
    });
    if (!res.ok) throw new Error('Download failed');
    return res.blob();
  },

  // Detail pages
  generateDetailPage(sessionId: string) {
    return apiFetch(`/sessions/${sessionId}/detail-pages/generations`, { method: 'POST' });
  },
  getDetailResults(sessionId: string) {
    return apiFetch<any>(`/sessions/${sessionId}/detail-pages/results`);
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
    return apiFetch(`/sessions/${sessionId}/parameters/extract`, { method: 'POST' });
  },

  // Strategy reference images
  uploadStrategyRefImage(sessionId: string, file: File) {
    const fd = new FormData(); fd.append('file', file);
    return apiFetch(`/sessions/${sessionId}/strategy-reference-images`, { method: 'POST', body: fd });
  },
  listStrategyRefImages(sessionId: string) {
    return apiFetch<any[]>(`/sessions/${sessionId}/strategy-reference-images`);
  },
  deleteStrategyRefImage(sessionId: string, imgId: string) {
    return apiFetch(`/sessions/${sessionId}/strategy-reference-images/${imgId}`, { method: 'DELETE' });
  },

  // Parameter attachments
  uploadParamAttachment(sessionId: string, file: File) {
    const fd = new FormData(); fd.append('file', file);
    return apiFetch(`/sessions/${sessionId}/parameter-attachments`, { method: 'POST', body: fd });
  },
  listParamAttachments(sessionId: string) {
    return apiFetch<any[]>(`/sessions/${sessionId}/parameter-attachments`);
  },
  deleteParamAttachment(sessionId: string, attId: string) {
    return apiFetch(`/sessions/${sessionId}/parameter-attachments/${attId}`, { method: 'DELETE' });
  },
};

// ===== Platform API =====
export const platformAPI = {
  list() { return apiFetch<any[]>('/platforms'); },
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
  getRules() { return apiFetch<any>('/account/pricing'); },
};
