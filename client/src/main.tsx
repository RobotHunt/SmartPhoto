// ============================================================================
// [2026-03-16 静态化改造] 目标：移除 tRPC Provider，改为纯静态前端，不依赖后端 API
// ============================================================================

// --- 原始 import（已注释） ---
// import { trpc } from "@/lib/trpc";
// import { UNAUTHED_ERR_MSG } from '@shared/const';
// import { httpBatchLink, TRPCClientError } from "@trpc/client";
// import superjson from "superjson";
// import { getLoginUrl } from "./const";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

// --- 原始代码：tRPC 未授权重定向逻辑（已注释） ---
// [2026-03-16 静态化改造] 静态模式下无需 auth 重定向
/*
const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});
*/

// --- 原始代码：tRPC Client 创建（已注释） ---
// [2026-03-16 静态化改造] 静态模式下不再需要 tRPC client
/*
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});
*/

// --- 原始渲染代码（已注释） ---
// [2026-03-16 静态化改造] 去掉 <trpc.Provider> 包裹，只保留 QueryClientProvider
/*
createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
*/

// --- 新代码：纯静态渲染 ---
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
