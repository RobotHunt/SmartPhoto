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

// --- 新代码：Mock useAuth，返回假用户，始终已登录 ---
// [2026-03-16 静态化改造] 不接真实 API，硬编码演示用户

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
