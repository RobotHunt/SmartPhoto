// ============================================
// SmartPhoto - Backend API Client
// Backend: http://152.136.121.153:8000/api/v2
// ============================================

const API_BASE = '/api/v2';

/**
 * Core fetch wrapper with JWT auth and response unwrapping
 * Backend returns { code: 0, message: "success", data: {...} }
 */
async function apiFetch(path, options = {}) {
  const token = sessionStorage.getItem('auth_token');
  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include', // for refresh_token cookie
  });

  if (res.status === 401) {
    // Try token refresh before logging out
    if (!options._isRetry && token) {
      try {
        const refreshData = await authAPI.refresh();
        if (refreshData && refreshData.access_token) {
          sessionStorage.setItem('auth_token', refreshData.access_token);
          // Retry original request with new token
          return apiFetch(path, { ...options, _isRetry: true });
        }
      } catch {
        // Refresh failed, proceed to logout
      }
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

  // Some endpoints return empty body (204)
  if (res.status === 204) return null;

  const json = await res.json();

  // Backend wraps response in { code, message, data }
  if (json && typeof json.code !== 'undefined') {
    if (json.code !== 0) {
      throw new Error(json.message || 'API error');
    }
    return json.data;
  }

  return json;
}

// ===== Auth API =====
const authAPI = {
  async register(email, password, displayName) {
    return apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, display_name: displayName }),
    });
  },

  async login(email, password) {
    return apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async logout() {
    return apiFetch('/auth/logout', { method: 'POST' });
  },

  async me() {
    return apiFetch('/auth/me');
  },

  async refresh() {
    return apiFetch('/auth/refresh', { method: 'POST' });
  },
};

// ===== Account API =====
const accountAPI = {
  async getOverview() {
    return apiFetch('/account/overview');
  },

  async getPurchases() {
    return apiFetch('/account/purchases');
  },

  async getNotifications() {
    return apiFetch('/account/notifications');
  },

  async getWallet() {
    return apiFetch('/account/wallet');
  },

  async getSettings() {
    return apiFetch('/account/settings');
  },

  async updateSettings(data) {
    return apiFetch('/account/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async changePassword(currentPassword, newPassword) {
    return apiFetch('/account/security/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
  },

  async getProfile() {
    return apiFetch('/account/profile');
  },

  async updateProfile(data) {
    return apiFetch('/account/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getWalletTransactions() {
    return apiFetch('/account/wallet/transactions');
  },

  async markNotificationRead(id) {
    return apiFetch(`/account/notifications/${id}/read`, { method: 'POST' });
  },

  async markAllNotificationsRead() {
    return apiFetch('/account/notifications/read-all', { method: 'POST' });
  },

  async getAssets(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiFetch('/account/assets' + (qs ? `?${qs}` : ''));
  },
};

// ===== Session API (6-step generation flow) =====
const sessionAPI = {
  async create() {
    return apiFetch('/sessions', { method: 'POST' });
  },

  async get(sessionId) {
    return apiFetch(`/sessions/${sessionId}`);
  },

  // Step 1: Upload images
  async uploadImage(sessionId, file, slotType, displayOrder) {
    const formData = new FormData();
    formData.append('file', file);
    if (slotType) formData.append('slot_type', slotType);
    if (displayOrder !== undefined) formData.append('display_order', String(displayOrder));
    return apiFetch(`/sessions/${sessionId}/images`, {
      method: 'POST',
      body: formData,
    });
  },

  async deleteImage(sessionId, imageId) {
    return apiFetch(`/sessions/${sessionId}/images/${imageId}`, { method: 'DELETE' });
  },

  async listImages(sessionId) {
    return apiFetch(`/sessions/${sessionId}/images`);
  },

  // Step 2: Analysis
  async triggerAnalysis(sessionId) {
    return apiFetch(`/sessions/${sessionId}/analysis`, { method: 'POST' });
  },

  async getAnalysis(sessionId) {
    return apiFetch(`/sessions/${sessionId}/analysis`);
  },

  // Step 3: Platform selection
  async savePlatformSelection(sessionId, platformIds, activeId) {
    return apiFetch(`/sessions/${sessionId}/platform-selection`, {
      method: 'PUT',
      body: JSON.stringify({ selected_platform_ids: platformIds, active_platform_id: activeId }),
    });
  },

  // Step 4: Copy
  async getCopy(sessionId) {
    return apiFetch(`/sessions/${sessionId}/copy`);
  },

  async saveCopy(sessionId, data) {
    return apiFetch(`/sessions/${sessionId}/copy`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // AI regenerate specific copy fields
  async regenerateCopy(sessionId, targets, instruction) {
    const body = { targets };
    if (instruction) body.instruction = instruction;
    body.based_on_current_values = true;
    return apiFetch(`/sessions/${sessionId}/copy/regenerate`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async getCopyRegenerateResult(sessionId, jobId) {
    return apiFetch(`/sessions/${sessionId}/copy/regenerate/${jobId}`);
  },

  // Step 5: Strategy preview
  async buildStrategy(sessionId) {
    return apiFetch(`/sessions/${sessionId}/strategy/preview`, { method: 'POST' });
  },

  // Step 6: Generation (requires credits in wallet)
  async generateGallery(sessionId) {
    return apiFetch(`/sessions/${sessionId}/generations`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async getResults(sessionId, version) {
    const qs = version ? `?version=${version}` : '';
    return apiFetch(`/sessions/${sessionId}/results${qs}`);
  },

  async downloadResults(sessionId) {
    const token = sessionStorage.getItem('auth_token');
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/download`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Download failed');
    return res.blob();
  },

  // Detail pages
  async generateDetailPage(sessionId) {
    return apiFetch(`/sessions/${sessionId}/detail-pages/generations`, { method: 'POST' });
  },

  async getDetailResults(sessionId) {
    return apiFetch(`/sessions/${sessionId}/detail-pages/results`);
  },

  // Regenerate results
  async regenerateResults(sessionId, body) {
    return apiFetch(`/sessions/${sessionId}/results/regenerate`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  // Global edit (formal function)
  async globalEdit(sessionId, instruction) {
    return apiFetch(`/sessions/${sessionId}/results/global-edit`, {
      method: 'POST',
      body: JSON.stringify({ instruction, scope: 'all' }),
    });
  },

  // Prompt preview
  async previewPrompts(sessionId) {
    return apiFetch(`/sessions/${sessionId}/prompts/preview`, { method: 'POST' });
  },

  // Parameters
  async getParameters(sessionId) {
    return apiFetch(`/sessions/${sessionId}/parameters`);
  },

  async updateParameters(sessionId, data) {
    return apiFetch(`/sessions/${sessionId}/parameters`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async extractParameters(sessionId) {
    return apiFetch(`/sessions/${sessionId}/parameters/extract`, { method: 'POST' });
  },

  // Strategy overrides
  async getStrategyOverrides(sessionId) {
    return apiFetch(`/sessions/${sessionId}/strategy/overrides`);
  },

  async updateStrategyOverrides(sessionId, data) {
    return apiFetch(`/sessions/${sessionId}/strategy/overrides`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Strategy reference images
  async uploadStrategyRefImage(sessionId, file) {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch(`/sessions/${sessionId}/strategy-reference-images`, {
      method: 'POST',
      body: formData,
    });
  },

  async listStrategyRefImages(sessionId) {
    return apiFetch(`/sessions/${sessionId}/strategy-reference-images`);
  },

  async deleteStrategyRefImage(sessionId, imgId) {
    return apiFetch(`/sessions/${sessionId}/strategy-reference-images/${imgId}`, { method: 'DELETE' });
  },

  // Parameter attachments
  async uploadParamAttachment(sessionId, file) {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch(`/sessions/${sessionId}/parameter-attachments`, {
      method: 'POST',
      body: formData,
    });
  },

  async listParamAttachments(sessionId) {
    return apiFetch(`/sessions/${sessionId}/parameter-attachments`);
  },

  async deleteParamAttachment(sessionId, attId) {
    return apiFetch(`/sessions/${sessionId}/parameter-attachments/${attId}`, { method: 'DELETE' });
  },

  // Detail page strategy & prompts
  async previewDetailStrategy(sessionId) {
    return apiFetch(`/sessions/${sessionId}/detail-pages/strategy/preview`, { method: 'POST' });
  },

  async getDetailOverrides(sessionId) {
    return apiFetch(`/sessions/${sessionId}/detail-pages/strategy/overrides`);
  },

  async updateDetailOverrides(sessionId, data) {
    return apiFetch(`/sessions/${sessionId}/detail-pages/strategy/overrides`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async previewDetailPrompts(sessionId) {
    return apiFetch(`/sessions/${sessionId}/detail-pages/prompts/preview`, { method: 'POST' });
  },

  // Detail page style images
  async uploadDetailStyleImage(sessionId, file) {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch(`/sessions/${sessionId}/detail-pages/style-images`, {
      method: 'POST',
      body: formData,
    });
  },

  async listDetailStyleImages(sessionId) {
    return apiFetch(`/sessions/${sessionId}/detail-pages/style-images`);
  },

  async deleteDetailStyleImage(sessionId, imgId) {
    return apiFetch(`/sessions/${sessionId}/detail-pages/style-images/${imgId}`, { method: 'DELETE' });
  },

  // Detail page results download
  async downloadDetailResults(sessionId) {
    const token = sessionStorage.getItem('auth_token');
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/detail-pages/download`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Detail download failed');
    return res.blob();
  },
};

// ===== Platform API =====
const platformAPI = {
  async list() {
    return apiFetch('/platforms');
  },
};

// ===== Job API =====
const jobAPI = {
  async getStatus(jobId) {
    return apiFetch(`/jobs/${jobId}`);
  },

  /**
   * Poll job until completion
   * @param {string} jobId
   * @param {function} onProgress - callback(status)
   * @param {number} interval - poll interval ms (default 3000)
   * @param {number} timeout - max wait ms (default 300000 = 5min)
   */
  async pollUntilDone(jobId, onProgress, interval = 3000, timeout = 300000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const status = await this.getStatus(jobId);
      if (onProgress) onProgress(status);

      if (status.status === 'completed' || status.status === 'done' || status.status === 'succeeded') {
        return status;
      }
      if (status.status === 'failed' || status.status === 'error') {
        throw new Error(status.error_message || status.error || 'Job failed');
      }

      await new Promise(r => setTimeout(r, interval));
    }
    throw new Error('Job timed out');
  },

  /**
   * Stream job events via SSE, with polling fallback
   * @param {string} jobId
   * @param {function} onEvent - callback({ type, data })
   * @returns {function} close - call to stop listening
   */
  streamEvents(jobId, onEvent) {
    const token = sessionStorage.getItem('auth_token');
    let closed = false;

    try {
      const url = `${API_BASE}/jobs/${jobId}/events`;
      const es = new EventSource(url + (token ? `?token=${encodeURIComponent(token)}` : ''));

      es.onmessage = (e) => {
        if (closed) return;
        try {
          const data = JSON.parse(e.data);
          onEvent({ type: data.type || 'message', data });
        } catch {
          onEvent({ type: 'message', data: e.data });
        }
      };

      es.addEventListener('complete', (e) => {
        if (closed) return;
        try { onEvent({ type: 'complete', data: JSON.parse(e.data) }); } catch {}
        es.close();
      });

      es.addEventListener('error', (e) => {
        if (closed) return;
        try { onEvent({ type: 'error', data: JSON.parse(e.data) }); } catch {}
        es.close();
      });

      es.onerror = () => {
        if (closed) return;
        es.close();
        // Fallback to polling
        this.pollUntilDone(jobId, (status) => {
          onEvent({ type: 'progress', data: status });
        }).then(status => {
          onEvent({ type: 'complete', data: status });
        }).catch(err => {
          onEvent({ type: 'error', data: { message: err.message } });
        });
      };

      return () => { closed = true; es.close(); };
    } catch {
      // EventSource not supported or failed, fallback to polling
      this.pollUntilDone(jobId, (status) => {
        onEvent({ type: 'progress', data: status });
      }).then(status => {
        onEvent({ type: 'complete', data: status });
      }).catch(err => {
        onEvent({ type: 'error', data: { message: err.message } });
      });
      return () => { closed = true; };
    }
  },
};

// ===== Asset API =====
const assetAPI = {
  async regenerate(assetId, instruction) {
    return apiFetch(`/assets/${assetId}/regenerate`, {
      method: 'POST',
      body: JSON.stringify({ instruction, keep_style_consistency: true }),
    });
  },
};

// ===== Prompt Preset API =====
const presetAPI = {
  async list() {
    return apiFetch('/prompt-presets');
  },

  async create(data) {
    return apiFetch('/prompt-presets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(presetId, data) {
    return apiFetch(`/prompt-presets/${presetId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async archive(presetId) {
    return apiFetch(`/prompt-presets/${presetId}/archive`, { method: 'POST' });
  },

  async clone(presetId) {
    return apiFetch(`/prompt-presets/${presetId}/clone`, { method: 'POST' });
  },
};
