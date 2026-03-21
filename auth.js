// ============================================
// SmartPhoto - Authentication Module
// ============================================

function friendlyError(err) {
  const msg = err.message || String(err);
  if (msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('net::ERR'))
    return '网络连接失败，请检查后端是否启动';
  if (msg.includes('401') || msg.includes('过期'))
    return '登录已过期，请重新登录';
  if (msg.includes('403'))
    return '没有权限';
  if (msg.includes('404'))
    return '接口不存在';
  if (msg.includes('500'))
    return '服务器内部错误';
  return msg;
}

const authState = {
  user: null,
  isLoggedIn: false,
};

// ===== Init auth from sessionStorage =====
let _refreshTimer = null;

function initAuth() {
  const token = sessionStorage.getItem('auth_token');
  const userStr = sessionStorage.getItem('auth_user');

  if (token && userStr) {
    try {
      authState.user = JSON.parse(userStr);
      authState.isLoggedIn = true;
    } catch {
      clearAuthData();
    }
  }

  updateAuthUI();
  startTokenRefreshTimer();
}

function clearAuthData() {
  sessionStorage.removeItem('auth_token');
  sessionStorage.removeItem('auth_user');
  authState.user = null;
  authState.isLoggedIn = false;
  stopTokenRefreshTimer();
}

function startTokenRefreshTimer() {
  stopTokenRefreshTimer();
  if (!authState.isLoggedIn) return;
  // Refresh token every 100 minutes
  _refreshTimer = setInterval(async () => {
    try {
      const data = await authAPI.refresh();
      if (data && data.access_token) {
        sessionStorage.setItem('auth_token', data.access_token);
      }
    } catch {
      console.warn('Token auto-refresh failed');
    }
  }, 100 * 60 * 1000);
}

function stopTokenRefreshTimer() {
  if (_refreshTimer) {
    clearInterval(_refreshTimer);
    _refreshTimer = null;
  }
}

// ===== Auth Actions =====
async function authLogin(email, password) {
  const data = await authAPI.login(email, password);
  sessionStorage.setItem('auth_token', data.access_token);

  // Backend login response already includes user object
  let user = data.user;
  if (!user) {
    // Fallback: fetch user info separately
    user = await authAPI.me();
  }
  sessionStorage.setItem('auth_user', JSON.stringify(user));
  authState.user = user;
  authState.isLoggedIn = true;

  updateAuthUI();
  startTokenRefreshTimer();
  return user;
}

async function authRegister(email, password, displayName) {
  const data = await authAPI.register(email, password, displayName);

  // Auto-login after register if token returned
  if (data.access_token) {
    sessionStorage.setItem('auth_token', data.access_token);
    let user = data.user;
    if (!user) {
      user = await authAPI.me();
    }
    sessionStorage.setItem('auth_user', JSON.stringify(user));
    authState.user = user;
    authState.isLoggedIn = true;
    updateAuthUI();
    startTokenRefreshTimer();
    return user;
  }

  // Otherwise need manual login
  return data;
}

async function authLogout() {
  try {
    await authAPI.logout();
  } catch {
    // Ignore errors on logout
  }
  clearAuthData();
  updateAuthUI();
  closeAuthModal();
  closeAccountPage();
  closeHistoryPage();
  showToast('已退出登录');
}

async function refreshCurrentUser() {
  try {
    const user = await authAPI.me();
    sessionStorage.setItem('auth_user', JSON.stringify(user));
    authState.user = user;
    return user;
  } catch {
    clearAuthData();
    updateAuthUI();
    return null;
  }
}

// ===== UI Updates =====
function updateAuthUI() {
  const avatarBtn = document.getElementById('navUserAvatar');
  const loginBtn = document.getElementById('navLoginBtn');
  const userDropdown = document.getElementById('userDropdown');

  if (!avatarBtn || !loginBtn) return;

  if (authState.isLoggedIn && authState.user) {
    const initial = (authState.user.display_name || authState.user.email || 'U')[0].toUpperCase();
    avatarBtn.textContent = initial;
    avatarBtn.style.display = 'flex';
    loginBtn.style.display = 'none';
  } else {
    avatarBtn.style.display = 'none';
    loginBtn.style.display = 'flex';
  }

  // Close dropdown
  if (userDropdown) userDropdown.classList.remove('active');
}

function toggleUserDropdown() {
  if (!authState.isLoggedIn) {
    openAuthModal();
    return;
  }
  const dropdown = document.getElementById('userDropdown');
  if (dropdown) dropdown.classList.toggle('active');
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('userDropdown');
  const avatar = document.getElementById('navUserAvatar');
  if (dropdown && !dropdown.contains(e.target) && e.target !== avatar) {
    dropdown.classList.remove('active');
  }
});

// ===== Auth Modal =====
function openAuthModal(mode = 'login') {
  const modal = document.getElementById('authModal');
  if (!modal) return;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  switchAuthTab(mode);
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
  clearAuthErrors();
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));

  const tabEl = document.querySelector(`.auth-tab[data-tab="${tab}"]`);
  const formEl = document.getElementById(`${tab}Form`);
  if (tabEl) tabEl.classList.add('active');
  if (formEl) formEl.classList.add('active');
  clearAuthErrors();
}

function clearAuthErrors() {
  document.querySelectorAll('.auth-error').forEach(e => e.textContent = '');
}

function showAuthError(formId, message) {
  const errorEl = document.querySelector(`#${formId} .auth-error`);
  if (errorEl) errorEl.textContent = message;
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn = document.getElementById('loginSubmitBtn');

  if (!email || !password) {
    showAuthError('loginForm', '请填写邮箱和密码');
    return;
  }

  btn.disabled = true;
  btn.textContent = '登录中...';
  clearAuthErrors();

  try {
    await authLogin(email, password);
    closeAuthModal();
    showToast('登录成功');
  } catch (err) {
    showAuthError('loginForm', err.message || '登录失败');
  } finally {
    btn.disabled = false;
    btn.textContent = '登录';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;
  const confirmPassword = document.getElementById('registerConfirmPassword').value;
  const displayName = document.getElementById('registerDisplayName').value.trim();
  const btn = document.getElementById('registerSubmitBtn');

  if (!email || !password || !displayName) {
    showAuthError('registerForm', '请填写所有必填项');
    return;
  }
  if (password.length < 8) {
    showAuthError('registerForm', '密码至少需要 8 位');
    return;
  }
  if (password !== confirmPassword) {
    showAuthError('registerForm', '两次输入的密码不一致');
    return;
  }

  btn.disabled = true;
  btn.textContent = '注册中...';
  clearAuthErrors();

  try {
    const result = await authRegister(email, password, displayName);
    if (authState.isLoggedIn) {
      closeAuthModal();
      showToast('注册成功');
    } else {
      // Need to login manually
      showToast('注册成功，请登录');
      switchAuthTab('login');
      document.getElementById('loginEmail').value = email;
    }
  } catch (err) {
    showAuthError('registerForm', err.message || '注册失败');
  } finally {
    btn.disabled = false;
    btn.textContent = '注册';
  }
}

// ===== Auth Guard =====
function requireAuth(action) {
  if (!authState.isLoggedIn) {
    openAuthModal();
    showToast('请先登录');
    return false;
  }
  return true;
}

// ===== Account Page =====
async function openAccountPage() {
  if (!requireAuth()) return;

  const page = document.getElementById('accountPage');
  if (!page) return;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Close dropdown
  const dropdown = document.getElementById('userDropdown');
  if (dropdown) dropdown.classList.remove('active');

  loadAccountData();
}

function closeAccountPage() {
  const page = document.getElementById('accountPage');
  if (page) page.classList.remove('active');
  document.body.style.overflow = '';
  closeAccountSubModal();
}

async function loadAccountData() {
  const userInfoEl = document.getElementById('accountUserInfo');
  const statsEl = document.getElementById('accountStats');

  // User info with edit button
  if (userInfoEl && authState.user) {
    const u = authState.user;
    userInfoEl.innerHTML = `
      <div class="account-avatar">${(u.display_name || u.email || 'U')[0].toUpperCase()}</div>
      <div class="account-user-detail">
        <h3 id="profileDisplayName">${u.display_name || '用户'}</h3>
        <p>${u.email || ''}</p>
        <span class="account-status">${u.status || 'active'}</span>
      </div>
      <button class="btn-edit-profile" onclick="toggleProfileEdit()" style="margin-left:auto;padding:6px 14px;border:1px solid var(--border-color,#ddd);border-radius:6px;background:transparent;cursor:pointer;font-size:0.85rem;">✏️ 编辑</button>
    `;
    // Inline edit form (hidden by default)
    const editForm = document.createElement('div');
    editForm.id = 'profileEditForm';
    editForm.style.display = 'none';
    editForm.style.marginTop = '12px';
    editForm.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="text" id="profileEditInput" value="${u.display_name || ''}" placeholder="输入新昵称"
               style="flex:1;padding:8px 12px;border:1px solid var(--border-color,#ddd);border-radius:6px;font-size:0.9rem;">
        <button onclick="saveProfileEdit()" style="padding:8px 16px;background:var(--primary,#6c5ce7);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.85rem;">保存</button>
        <button onclick="toggleProfileEdit()" style="padding:8px 12px;border:1px solid var(--border-color,#ddd);border-radius:6px;background:transparent;cursor:pointer;font-size:0.85rem;">取消</button>
      </div>
      <p id="profileEditError" style="color:red;font-size:0.8rem;margin-top:4px;"></p>
    `;
    userInfoEl.appendChild(editForm);
  }

  // Load stats
  try {
    const stats = await accountAPI.getOverview();
    if (statsEl && stats) {
      statsEl.innerHTML = `
        <div class="stat-card">
          <div class="stat-value">${stats.total_generated_assets || 0}</div>
          <div class="stat-label">总生成图片</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.generated_assets_this_month || 0}</div>
          <div class="stat-label">本月生成</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.session_count || 0}</div>
          <div class="stat-label">会话次数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.wallet_balance || 0}</div>
          <div class="stat-label">账户余额</div>
        </div>
      `;
    }
  } catch (err) {
    if (statsEl) statsEl.innerHTML = `<p class="account-error">加载统计数据失败: ${friendlyError(err)}</p>`;
  }

  // Pre-fetch unread notification count for badge
  try {
    const notifications = await accountAPI.getNotifications();
    const items = Array.isArray(notifications) ? notifications : (notifications.items || []);
    const unread = items.filter(n => !n.is_read).length;
    const badge = document.getElementById('notifBadge');
    if (badge) {
      if (unread > 0) {
        badge.textContent = unread;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
  } catch { /* ignore */ }
}

// ===== Account Sub-Modal =====
const SUB_MODAL_TITLES = { notifications: '通知', purchases: '购买记录', wallet: '额度明细' };

function openAccountSubModal(type) {
  const modal = document.getElementById('accountSubModal');
  const title = document.getElementById('accountSubTitle');
  const body = document.getElementById('accountSubBody');
  if (!modal || !body) return;

  title.textContent = SUB_MODAL_TITLES[type] || type;
  body.innerHTML = '<p style="text-align:center;color:var(--text-muted,#888);padding:40px 0;">加载中...</p>';
  modal.classList.add('active');

  if (type === 'notifications') loadSubNotifications(body);
  else if (type === 'purchases') loadSubPurchases(body);
  else if (type === 'wallet') loadSubWallet(body);
}

function closeAccountSubModal() {
  const modal = document.getElementById('accountSubModal');
  if (modal) modal.classList.remove('active');
}

async function loadSubNotifications(container) {
  try {
    const notifications = await accountAPI.getNotifications();
    const items = Array.isArray(notifications) ? notifications : (notifications.items || []);
    if (items.length === 0) {
      container.innerHTML = '<p class="account-empty">暂无通知</p>';
      return;
    }
    const hasUnread = items.some(n => !n.is_read);
    container.innerHTML = `
      <div class="account-list">
        ${hasUnread ? `<div style="margin-bottom:10px;text-align:right;">
          <button onclick="markAllNotificationsRead()" style="padding:4px 12px;border:1px solid var(--border-color,#ddd);border-radius:6px;background:transparent;cursor:pointer;font-size:0.8rem;">全部已读</button>
        </div>` : ''}
        ${items.map(n => {
          const nid = n.notification_id || n.id;
          return `
          <div class="notification-item ${n.is_read ? '' : 'unread'}" id="notif-${nid}">
            <div class="notification-title">${n.title || ''}</div>
            <div class="notification-content">${n.content || ''}</div>
            <div class="notification-time" style="display:flex;justify-content:space-between;align-items:center;">
              <span>${n.created_at ? new Date(n.created_at).toLocaleString('zh-CN') : ''}</span>
              ${!n.is_read ? `<button onclick="markNotificationRead('${nid}')" style="padding:2px 8px;border:1px solid var(--border-color,#ddd);border-radius:4px;background:transparent;cursor:pointer;font-size:0.75rem;">标记已读</button>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>`;
  } catch (err) {
    container.innerHTML = `<p class="account-error">加载通知失败: ${friendlyError(err)}</p>`;
  }
}

async function loadSubPurchases(container) {
  try {
    const purchases = await accountAPI.getPurchases();
    const items = Array.isArray(purchases) ? purchases : (purchases.items || []);
    if (items.length === 0) {
      container.innerHTML = '<p class="account-empty">暂无购买记录</p>';
      return;
    }
    container.innerHTML = `
      <div class="account-list">
        ${items.map(p => `
          <div class="purchase-item">
            <div class="purchase-info">
              <span class="purchase-name">${p.plan_name || p.order_no || p.order_id || ''}</span>
              <span class="purchase-amount">${p.amount || 0} 积分</span>
            </div>
            <div class="purchase-meta">
              <span class="purchase-status ${p.status}">${p.status || ''}</span>
              <span class="purchase-time">${p.created_at ? new Date(p.created_at).toLocaleString('zh-CN') : ''}</span>
            </div>
          </div>
        `).join('')}
      </div>`;
  } catch (err) {
    container.innerHTML = `<p class="account-error">加载购买记录失败: ${friendlyError(err)}</p>`;
  }
}

async function loadSubWallet(container) {
  try {
    const txData = await accountAPI.getWalletTransactions();
    const txItems = Array.isArray(txData) ? txData : (txData.items || []);
    if (txItems.length === 0) {
      container.innerHTML = '<p class="account-empty">暂无额度变动记录</p>';
      return;
    }
    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
          <thead>
            <tr style="border-bottom:1px solid var(--border-color,#eee);text-align:left;">
              <th style="padding:8px 6px;">类型</th>
              <th style="padding:8px 6px;">积分变动</th>
              <th style="padding:8px 6px;">余额</th>
              <th style="padding:8px 6px;">备注</th>
              <th style="padding:8px 6px;">时间</th>
            </tr>
          </thead>
          <tbody>
            ${txItems.map(tx => {
              const amount = tx.credits_delta ?? tx.amount ?? tx.credits ?? 0;
              const sign = amount >= 0 ? '+' : '';
              const color = amount >= 0 ? '#27ae60' : '#e74c3c';
              const balance = tx.balance_after ?? tx.balance ?? '-';
              return `<tr style="border-bottom:1px solid var(--border-color,#f0f0f0);">
                <td style="padding:6px;">${tx.transaction_type || tx.type || tx.action || '-'}</td>
                <td style="padding:6px;color:${color};font-weight:600;">${sign}${amount}</td>
                <td style="padding:6px;">${balance}</td>
                <td style="padding:6px;color:var(--text-muted,#888);">${tx.note || tx.remark || tx.description || '-'}</td>
                <td style="padding:6px;color:var(--text-muted,#888);">${tx.created_at ? new Date(tx.created_at).toLocaleString('zh-CN') : '-'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    container.innerHTML = `<p class="account-error">加载额度明细失败: ${friendlyError(err)}</p>`;
  }
}

// ===== Profile Edit =====
function toggleProfileEdit() {
  const form = document.getElementById('profileEditForm');
  if (!form) return;
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function saveProfileEdit() {
  const input = document.getElementById('profileEditInput');
  const errorEl = document.getElementById('profileEditError');
  const displayName = input?.value.trim();
  if (!displayName) {
    if (errorEl) errorEl.textContent = '昵称不能为空';
    return;
  }

  try {
    await accountAPI.updateProfile({ display_name: displayName });
    authState.user.display_name = displayName;
    sessionStorage.setItem('auth_user', JSON.stringify(authState.user));
    const nameEl = document.getElementById('profileDisplayName');
    if (nameEl) nameEl.textContent = displayName;
    updateAuthUI();
    toggleProfileEdit();
    showToast('✅ 昵称已更新');
  } catch (err) {
    if (errorEl) errorEl.textContent = err.message || '保存失败';
  }
}

// ===== Notification Read =====
async function markNotificationRead(id) {
  try {
    await accountAPI.markNotificationRead(id);
    const el = document.getElementById(`notif-${id}`);
    if (el) {
      el.classList.remove('unread');
      const btn = el.querySelector('button[onclick*="markNotificationRead"]');
      if (btn) btn.remove();
    }
    showToast('已标记为已读');
  } catch (err) {
    showToast('标记失败: ' + err.message);
  }
}

async function markAllNotificationsRead() {
  try {
    await accountAPI.markAllNotificationsRead();
    document.querySelectorAll('.notification-item.unread').forEach(el => {
      el.classList.remove('unread');
      const btn = el.querySelector('button[onclick*="markNotificationRead"]');
      if (btn) btn.remove();
    });
    const markAllBtn = document.querySelector('button[onclick*="markAllNotificationsRead"]');
    if (markAllBtn) markAllBtn.parentElement.remove();
    showToast('已全部标记为已读');
  } catch (err) {
    showToast('操作失败: ' + err.message);
  }
}

// ===== Change Password =====
async function handleChangePassword(e) {
  e.preventDefault();
  const current = document.getElementById('currentPassword').value;
  const newPwd = document.getElementById('newPassword').value;
  const confirmPwd = document.getElementById('confirmNewPassword').value;
  const errorEl = document.getElementById('changePasswordError');

  if (!current || !newPwd) {
    errorEl.textContent = '请填写所有字段';
    return;
  }
  if (newPwd.length < 8) {
    errorEl.textContent = '新密码至少需要 8 位';
    return;
  }
  if (newPwd !== confirmPwd) {
    errorEl.textContent = '两次输入的新密码不一致';
    return;
  }

  try {
    await accountAPI.changePassword(current, newPwd);
    showToast('密码修改成功');
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmNewPassword').value = '';
    errorEl.textContent = '';
  } catch (err) {
    errorEl.textContent = err.message || '密码修改失败';
  }
}

// ===== History Page =====
async function openHistoryPage() {
  if (!requireAuth()) return;

  const page = document.getElementById('historyPage');
  if (!page) return;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';

  const dropdown = document.getElementById('userDropdown');
  if (dropdown) dropdown.classList.remove('active');

  loadHistoryData();
}

function closeHistoryPage() {
  const page = document.getElementById('historyPage');
  if (page) page.classList.remove('active');
  document.body.style.overflow = '';
}

async function loadHistoryData() {
  const grid = document.getElementById('historyGrid');
  if (!grid) return;

  grid.innerHTML = '<div class="history-loading"><div class="loading-spinner"></div><p>加载中...</p></div>';

  try {
    const assets = await accountAPI.getAssets();
    const items = Array.isArray(assets) ? assets : (assets.items || []);

    if (items.length === 0) {
      grid.innerHTML = '<p class="account-empty">暂无生成记录</p>';
      return;
    }

    grid.innerHTML = items.map(asset => {
      // Preview URL: handle various backend formats
      const previews = asset.previews || asset.result_urls || [];
      let thumbUrl = '';
      if (previews.length > 0) {
        const first = previews[0];
        thumbUrl = (typeof first === 'string') ? first : (first.image_url || first.url || first.preview_url || first.thumbnail_url || '');
      }
      if (!thumbUrl) {
        thumbUrl = asset.preview_url || asset.thumbnail_url || '';
      }
      // Counts: sum all generated image types (exclude 'original' which are uploaded refs)
      const rawCounts = asset.counts;
      let counts = 0;
      if (typeof rawCounts === 'object' && rawCounts !== null) {
        counts = (rawCounts.main || 0) + (rawCounts.white_bg || 0) + (rawCounts.detail || 0);
        if (counts === 0) counts = rawCounts.total || 0;
      } else {
        counts = rawCounts || asset.image_count || 0;
      }
      return `
        <div class="history-card" style="cursor:pointer;" onclick="openHistoryDetail('${asset.session_id}', '${(asset.product_name || '').replace(/'/g, "\\'")}')">
          <div class="history-thumb">
            ${thumbUrl ? `<img src="${thumbUrl}" alt="预览" onerror="this.parentElement.innerHTML='<div class=\\'history-no-thumb\\'>暂无预览</div>'">` : '<div class="history-no-thumb">暂无预览</div>'}
          </div>
          <div class="history-info">
            <h4>${asset.product_name || '未命名'}</h4>
            <p>${asset.platform_id || ''}</p>
            <span class="history-time">${asset.created_at ? new Date(asset.created_at).toLocaleString('zh-CN') : ''}</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    grid.innerHTML = `<p class="account-error">加载历史记录失败: ${friendlyError(err)}</p>`;
  }
}

// ===== History Detail View =====
async function openHistoryDetail(sessionId, productName, version) {
  const grid = document.getElementById('historyGrid');
  if (!grid) return;

  grid.innerHTML = `
    <div style="grid-column:1/-1;">
      <button onclick="loadHistoryData()" style="margin-bottom:16px;padding:6px 16px;border:1px solid var(--border-color,#ddd);border-radius:6px;background:transparent;cursor:pointer;">← 返回列表</button>
      <h3 style="margin-bottom:12px;">${productName || '生成结果'}</h3>
      <p style="color:var(--text-muted,#888);margin-bottom:16px;">加载中...</p>
    </div>
  `;

  try {
    const results = await sessionAPI.getResults(sessionId, version || undefined);
    const items = Array.isArray(results) ? results : (results.assets || results.items || results.images || []);
    const availableVersions = results.available_versions || [];
    const currentVersion = version || results.latest_result_version || results.requested_version || 1;

    if (items.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;">
          <button onclick="loadHistoryData()" style="margin-bottom:16px;padding:6px 16px;border:1px solid var(--border-color,#ddd);border-radius:6px;background:transparent;cursor:pointer;">← 返回列表</button>
          <p class="account-empty">该会话暂无生成结果</p>
        </div>
      `;
      return;
    }

    const ROLE_LABELS = { hero: '主图', white_bg: '白底图', selling_point: '卖点图', scene: '场景图', reason_why: '理由图', detail: '详情图', primary_kv: '主视觉图', proof_authority: '权威背书图', benefit_scene_or_compare: '场景对比图', closing_selling_point: '核心卖点图' };

    // Version selector
    let versionHtml = '';
    if (availableVersions.length > 1) {
      const maxVer = Math.max(...availableVersions);
      const options = availableVersions.map(v =>
        `<option value="${v}" ${v === currentVersion ? 'selected' : ''}>第 ${v} 版${v === maxVer ? '（最新）' : ''}</option>`
      ).join('');
      versionHtml = `
        <div style="margin-bottom:16px;">
          <span style="font-size:0.85rem;color:var(--text-secondary,#888);margin-right:8px;">历史版本:</span>
          <select onchange="openHistoryDetail('${sessionId}', '${(productName || '').replace(/'/g, "\\'")}', parseInt(this.value))"
                  style="padding:6px 12px;border:1px solid var(--border-color,#ddd);border-radius:6px;font-size:0.85rem;background:#fff;cursor:pointer;">
            ${options}
          </select>
        </div>`;
    }

    grid.innerHTML = `
      <div style="grid-column:1/-1;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <button onclick="loadHistoryData()" style="padding:6px 16px;border:1px solid var(--border-color,#ddd);border-radius:6px;background:transparent;cursor:pointer;">← 返回列表</button>
          <button onclick="downloadHistorySession('${sessionId}')" style="padding:8px 20px;background:var(--primary,#6c5ce7);color:#fff;border:none;border-radius:6px;cursor:pointer;">📥 下载全部</button>
        </div>
        <h3 style="margin-bottom:12px;">${productName || '生成结果'}（${items.length} 张）</h3>
        ${versionHtml}
      </div>
      ${items.map((r, i) => {
        const url = r.image_url || r.thumbnail_url || r.url || '';
        const label = ROLE_LABELS[r.role] || ROLE_LABELS[r.slot_id] || r.role || '';
        const desc = r.description || r.desc || r.slot_id || '';
        const orderNum = r.display_order != null ? r.display_order : (i + 1);
        return `<div class="history-card">
          <div class="history-thumb" style="cursor:pointer;" onclick="if(document.getElementById('imageModal')){document.getElementById('modalImage').src='${r.image_url || url}';document.getElementById('imageModal').classList.add('active');}">
            ${url ? `<img src="${url}" alt="${label}" style="object-fit:cover;width:100%;height:100%;">` : '<div class="history-no-thumb">暂无预览</div>'}
          </div>
          <div class="history-info">
            <h4>${label} #${orderNum}</h4>
            ${desc ? `<p style="font-size:0.8rem;color:var(--text-secondary,#666);margin-top:4px;word-break:break-all;">${desc}</p>` : ''}
            ${r.expression_mode ? `<p style="font-size:0.75rem;color:var(--text-muted,#999);margin-top:2px;">${r.expression_mode}</p>` : ''}
          </div>
        </div>`;
      }).join('')}
    `;
  } catch (err) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;">
        <button onclick="loadHistoryData()" style="margin-bottom:16px;padding:6px 16px;border:1px solid var(--border-color,#ddd);border-radius:6px;background:transparent;cursor:pointer;">← 返回列表</button>
        <p class="account-error">加载详情失败: ${friendlyError(err)}</p>
      </div>
    `;
  }
}

async function downloadHistorySession(sessionId) {
  try {
    showToast('正在打包下载...');
    const blob = await sessionAPI.downloadResults(sessionId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SmartPhoto_${sessionId}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('下载完成');
  } catch (err) {
    showToast('下载失败: ' + friendlyError(err));
  }
}

// ===== Listen for auth:logout event =====
window.addEventListener('auth:logout', () => {
  clearAuthData();
  updateAuthUI();
  openAuthModal();
});

// ===== Init on DOM ready =====
document.addEventListener('DOMContentLoaded', initAuth);
