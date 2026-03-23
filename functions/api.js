// ESA Edge Routine 边缘函数入口
// 将 /api/v2/* 请求代理到后端服务器
const BACKEND = 'https://smartphoto.ins.chat';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': 'https://smartphoto.vip',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

async function proxyToBackend(request) {
  const url = new URL(request.url);
  const targetUrl = `${BACKEND}${url.pathname}${url.search}`;

  // 转发请求头（去掉边缘节点相关头）
  const headers = new Headers(request.headers);
  headers.set('Host', 'api.wppjkw.online');
  headers.delete('cf-connecting-ip');
  headers.delete('cf-ray');
  headers.delete('x-forwarded-for');

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    });

    // 添加 CORS 头
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders()).forEach(([k, v]) => newHeaders.set(k, v));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: '后端服务不可达', detail: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }
}

// ESA Pages 边缘函数要求默认导出包含 fetch 方法的对象
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...corsHeaders(), 'Access-Control-Max-Age': '86400' },
      });
    }

    // /api/* 请求代理到后端
    if (path.startsWith('/api/') || path === '/healthz') {
      return await proxyToBackend(request);
    }

    // 静态资源直接返回
    const ext = path.split('.').pop();
    const staticExts = ['js', 'css', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'woff', 'woff2', 'ttf', 'json', 'map'];
    if (staticExts.includes(ext)) {
      return fetch(request);
    }

    // 其他路径（SPA 路由）返回 index.html
    const indexUrl = new URL('/index.html', url.origin);
    return fetch(indexUrl.toString());
  },
};
