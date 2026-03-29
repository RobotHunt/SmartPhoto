// Constants - no longer need shared module or OAuth
export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 31_536_000;

// 生成登录页 URL（纯前端路由，不依赖后端 OAuth）
export const getLoginUrl = (redirect?: string) => {
  const path = redirect || window.location.pathname;
  return `/login?redirect=${encodeURIComponent(path)}`;
};
