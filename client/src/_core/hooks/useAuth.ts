// ============================================================================
// [2026-03-16 静态化改造] 目标：移除 tRPC auth 调用，返回 mock 用户，始终"已登录"
// ============================================================================

// --- 原始 import（已注释） ---
// import { getLoginUrl } from "@/const";
// import { trpc } from "@/lib/trpc";
// import { TRPCClientError } from "@trpc/client";
// import { useCallback, useEffect, useMemo } from "react";

import { useCallback, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

// --- 原始代码：通过 tRPC 查询 auth.me 获取登录状态（已注释） ---
/*
export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    localStorage.setItem(
      "manus-runtime-user-info",
      JSON.stringify(meQuery.data)
    );
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
*/

// --- 原始代码：Mock useAuth，返回假用户，始终已登录（已注释） ---
// [2026-03-16 静态化改造] 不接真实 API，硬编码演示用户
// [2026-03-19 改造] 改为基于 sessionStorage 的登录状态管理，支持登录/登出/多用户
/*
const MOCK_USER = {
  id: 1,
  name: "演示用户",
  email: "demo@example.com",
  openId: "demo-static-user",
};

export function useAuth(_options?: UseAuthOptions) {
  const logout = useCallback(() => {
    window.location.href = "/";
  }, []);

  const state = useMemo(() => ({
    user: MOCK_USER,
    loading: false,
    error: null,
    isAuthenticated: true,
  }), []);

  return {
    ...state,
    refresh: () => {},
    logout,
  };
}
*/

// ─── [2026-03-19 新增] 预置测试用户 ────────────────────────────────
const TEST_USERS = [
  { id: 1, phone: "13075578896", password: "123456", name: "测试用户A", email: "testA@smartphoto.vip", openId: "test-user-a" },
  { id: 2, phone: "18810109315", password: "123456", name: "测试用户B", email: "testB@smartphoto.vip", openId: "test-user-b" },
];

// 登录验证（供 AuthPage 调用）
export function authLogin(phone: string, password: string): { success: boolean; user?: typeof TEST_USERS[0]; error?: string } {
  const found = TEST_USERS.find(u => u.phone === phone);
  if (!found) return { success: false, error: "手机号未注册" };
  if (found.password !== password) return { success: false, error: "密码错误" };
  // 存入 sessionStorage
  const userData = { id: found.id, name: found.name, email: found.email, openId: found.openId, phone: found.phone };
  sessionStorage.setItem("auth_user", JSON.stringify(userData));
  return { success: true, user: found };
}

// 验证码登录（静态模式下只验证手机号是否存在）
export function authLoginByCode(phone: string, _code: string): { success: boolean; user?: typeof TEST_USERS[0]; error?: string } {
  const found = TEST_USERS.find(u => u.phone === phone);
  if (!found) return { success: false, error: "手机号未注册" };
  const userData = { id: found.id, name: found.name, email: found.email, openId: found.openId, phone: found.phone };
  sessionStorage.setItem("auth_user", JSON.stringify(userData));
  return { success: true, user: found };
}

// 注册（静态模式下只检查手机号是否已存在）
export function authRegister(phone: string, password: string, _code: string): { success: boolean; error?: string } {
  const existing = TEST_USERS.find(u => u.phone === phone);
  if (existing) return { success: false, error: "该手机号已注册" };
  // 静态模式下模拟注册成功，创建新用户存入 sessionStorage
  const newUser = { id: Date.now(), name: `用户${phone.slice(-4)}`, email: "", openId: `user-${phone}`, phone };
  sessionStorage.setItem("auth_user", JSON.stringify(newUser));
  return { success: true };
}

// 登出
export function authLogout() {
  sessionStorage.removeItem("auth_user");
}

// 获取当前用户
function getCurrentUser() {
  const stored = sessionStorage.getItem("auth_user");
  if (!stored) return null;
  try { return JSON.parse(stored); } catch { return null; }
}

export function useAuth(_options?: UseAuthOptions) {
  const user = getCurrentUser();

  const logout = useCallback(() => {
    authLogout();
    // [2026-03-19 修复] 原: window.location.href = "/auth" — 会触发页面刷新被边缘函数拦截
    // 改为跳转首页，由前端路由控制，不触发完整页面刷新
    window.location.href = "/";
  }, []);

  const state = useMemo(() => ({
    user,
    loading: false,
    error: null,
    isAuthenticated: Boolean(user),
  }), [user]);

  return {
    ...state,
    refresh: () => {},
    logout,
  };
}
