/* ------------------------------------------------------------------ */
/*  纯前端用户系统 — localStorage 实现                                  */
/*  后端不做用户体系，前端自己管理用户信息和 session 历史               */
/* ------------------------------------------------------------------ */

export interface LocalUser {
  id: string;
  nickname: string;
  phone?: string;
  avatar?: string;
  created_at: string;
}

export interface SessionRecord {
  session_id: string;
  product_name: string;
  platform: string;
  thumbnail_url: string;
  created_at: string;
  last_step: string;
  image_count: number;
}

const USER_KEY = "sp_local_user";
const SESSIONS_KEY = "sp_session_history";
const MAX_HISTORY = 50;

/* ------------------------------------------------------------------ */
/*  User CRUD                                                          */
/* ------------------------------------------------------------------ */

export function getLocalUser(): LocalUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setLocalUser(user: LocalUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearLocalUser(): void {
  localStorage.removeItem(USER_KEY);
}

export function isLoggedIn(): boolean {
  return !!getLocalUser();
}

export function generateUserId(): string {
  return "u_" + crypto.randomUUID();
}

/* ------------------------------------------------------------------ */
/*  Session history                                                    */
/* ------------------------------------------------------------------ */

export function getSessionHistory(): SessionRecord[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveSessionHistory(list: SessionRecord[]): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
}

export function addSessionRecord(record: SessionRecord): void {
  const list = getSessionHistory();
  const exists = list.findIndex((r) => r.session_id === record.session_id);
  if (exists >= 0) {
    list[exists] = { ...list[exists], ...record };
  } else {
    list.unshift(record);
  }
  saveSessionHistory(list);
}

export function updateSessionRecord(
  sessionId: string,
  updates: Partial<SessionRecord>,
): void {
  const list = getSessionHistory();
  const index = list.findIndex((r) => r.session_id === sessionId);
  if (index >= 0) {
    list[index] = { ...list[index], ...updates };
    saveSessionHistory(list);
  }
}

export function removeSessionRecord(sessionId: string): void {
  const list = getSessionHistory().filter((r) => r.session_id !== sessionId);
  saveSessionHistory(list);
}

export function clearSessionHistory(): void {
  localStorage.removeItem(SESSIONS_KEY);
}
