// [2026-03-18 新增] ESA Edge Routine 边缘函数入口
// 配合 ESA Edge KV 存储，为 SmartPhoto 提供轻量后端 API
// 文档：https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/get-started-with-edge-kv

// ─── KV 存储空间实例（需在 ESA 控制台创建对应的存储空间）───────────────
// 创建方式：ESA 控制台 → 边缘计算 → KV 存储 → 创建存储空间
const users = new EdgeKV({ namespace: "smartphoto-users" });
const orders = new EdgeKV({ namespace: "smartphoto-orders" });
const sessions = new EdgeKV({ namespace: "smartphoto-sessions" });

// ─── 预置假数据（首次部署时写入 KV）────────────────────────────────────
const SEED_USER = {
  id: "user_001",
  name: "演示用户",
  email: "demo@example.com",
  phone: "138****6789",
  passwordSet: true,
  role: "user",
  createdAt: "2026-02-20T10:00:00Z",
  lastSignedIn: "2026-03-18T09:30:00Z",
};

const SEED_ORDERS = [
  {
    id: "ORD-20260316001", type: "主图高清", productName: "便携式蓝牙音箱",
    amount: 69, status: "pending", paymentMethod: "", imageCount: 4, images: [],
    createdAt: "2026-03-16 18:20", userId: "user_001",
  },
  {
    id: "ORD-20260315002", type: "主图高清", productName: "空气净化器",
    amount: 69, status: "paid", paymentMethod: "支付宝", imageCount: 4,
    images: ["/examples/air-purifier.jpg", "/examples/air-purifier-white.jpg", "/examples/2.jpg", "/examples/3.jpg"],
    createdAt: "2026-03-15 14:30", userId: "user_001",
  },
  // [2026-03-19 注释] 详情图流程不经过支付，注释掉对应订单
  // {
  //   id: "ORD-20260314003", type: "详情图高清", productName: "空气净化器",
  //   amount: 89, status: "paid", paymentMethod: "微信支付", imageCount: 4,
  //   images: ["/examples/air-purifier.jpg", "/examples/air-purifier-white.jpg", "/examples/2.jpg", "/examples/3.jpg"],
  //   createdAt: "2026-03-14 10:15", userId: "user_001",
  // },
  {
    id: "ORD-20260312004", type: "主图高清", productName: "不锈钢面包机",
    amount: 69, status: "refunded", paymentMethod: "支付宝", imageCount: 4, images: [],
    createdAt: "2026-03-12 16:45", userId: "user_001",
  },
];

const SEED_NOTIFICATIONS = [
  { id: "n1", type: "payment", title: "订单支付成功", desc: "订单 ORD-20260315002（主图高清·空气净化器）已支付 ¥69", time: "2026-03-15 14:30", read: true },
  // [2026-03-19 注释] 详情图流程不经过支付，注释掉对应通知
  // { id: "n2", type: "payment", title: "订单支付成功", desc: "订单 ORD-20260314003（详情图高清·空气净化器）已支付 ¥89", time: "2026-03-14 10:15", read: true },
  { id: "n3", type: "refund", title: "退款已完成", desc: "订单 ORD-20260312004 已退款 ¥69 至原支付账户", time: "2026-03-13 09:00", read: true },
  { id: "n4", type: "security", title: "验证码发送成功", desc: "您的手机验证码已发送至 138****6789", time: "2026-03-10 16:20", read: false },
  { id: "n5", type: "security", title: "邮箱修改成功", desc: "邮箱已修改为 demo@example.com", time: "2026-03-08 11:30", read: false },
  { id: "n6", type: "system", title: "欢迎使用 SmartPhoto", desc: "账号注册成功，快来体验 AI 电商做图吧！", time: "2026-02-20 10:00", read: true },
];

// ─── 工具函数 ─────────────────────────────────────────────────────
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

// ─── 数据初始化（往 KV 写入种子数据）──────────────────────────────────
async function seedData() {
  // 检查是否已初始化
  const existing = await users.get("user_001", { type: "json" });
  if (existing) return jsonResponse({ message: "数据已存在，跳过初始化" });

  // 写入用户
  await users.put("user_001", JSON.stringify(SEED_USER));

  // 写入订单列表（按用户ID索引）
  await orders.put("list:user_001", JSON.stringify(SEED_ORDERS));

  // 写入每个订单的独立记录（按订单号索引）
  for (const order of SEED_ORDERS) {
    await orders.put(order.id, JSON.stringify(order));
  }

  // 写入通知列表
  await users.put("notifications:user_001", JSON.stringify(SEED_NOTIFICATIONS));

  // 写入统计数据
  await users.put("stats:user_001", JSON.stringify({
    totalImages: 12,
    monthlyUsage: 5,
  }));

  return jsonResponse({ message: "种子数据初始化成功" });
}

// ─── API 路由处理 ─────────────────────────────────────────────────

// GET /api/user — 获取用户信息
async function handleGetUser() {
  const user = await users.get("user_001", { type: "json" });
  if (!user) return jsonResponse({ error: "用户不存在" }, 404);
  return jsonResponse(user);
}

// GET /api/user/stats — 获取用户统计
async function handleGetStats() {
  const stats = await users.get("stats:user_001", { type: "json" });
  return jsonResponse(stats || { totalImages: 0, monthlyUsage: 0 });
}

// GET /api/orders — 获取订单列表
async function handleGetOrders() {
  const list = await orders.get("list:user_001", { type: "json" });
  return jsonResponse(list || []);
}

// GET /api/order/:id — 获取单个订单
async function handleGetOrder(orderId) {
  const order = await orders.get(orderId, { type: "json" });
  if (!order) return jsonResponse({ error: "订单不存在" }, 404);
  return jsonResponse(order);
}

// POST /api/order/:id/pay — 模拟支付
async function handlePayOrder(orderId) {
  const order = await orders.get(orderId, { type: "json" });
  if (!order) return jsonResponse({ error: "订单不存在" }, 404);
  if (order.status !== "pending") return jsonResponse({ error: "订单状态不允许支付" }, 400);

  order.status = "paid";
  order.paymentMethod = "支付宝";
  order.images = ["/examples/air-purifier.jpg", "/examples/air-purifier-white.jpg", "/examples/2.jpg", "/examples/3.jpg"];

  await orders.put(orderId, JSON.stringify(order));

  // 更新订单列表
  const list = await orders.get("list:user_001", { type: "json" }) || [];
  const updatedList = list.map(o => o.id === orderId ? order : o);
  await orders.put("list:user_001", JSON.stringify(updatedList));

  return jsonResponse({ message: "支付成功", order });
}

// POST /api/order/:id/refund — 申请退款
async function handleRefundOrder(orderId, request) {
  const order = await orders.get(orderId, { type: "json" });
  if (!order) return jsonResponse({ error: "订单不存在" }, 404);
  if (order.status !== "paid") return jsonResponse({ error: "订单状态不允许退款" }, 400);

  const body = await request.json();
  order.status = "refund_pending";
  order.refundReason = body.reason || "";
  order.refundNote = body.note || "";
  order.refundAt = new Date().toISOString();

  await orders.put(orderId, JSON.stringify(order));

  const list = await orders.get("list:user_001", { type: "json" }) || [];
  const updatedList = list.map(o => o.id === orderId ? order : o);
  await orders.put("list:user_001", JSON.stringify(updatedList));

  return jsonResponse({ message: "退款申请已提交", order });
}

// GET /api/notifications — 获取通知列表
async function handleGetNotifications() {
  const list = await users.get("notifications:user_001", { type: "json" });
  return jsonResponse(list || []);
}

// POST /api/seed — 初始化种子数据
async function handleSeed() {
  return await seedData();
}

// ─── 主入口 ───────────────────────────────────────────────────────
// [2026-03-19 修复] 原: addEventListener("fetch", ...) — ESA Pages 要求 ES module 格式默认导出
// addEventListener("fetch", (event) => {
//   event.respondWith(handleRequest(event.request));
// });

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS 预检
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // [2026-03-19 修复] 原: 非 /api/ 请求返回 null — 已移到 export default 中处理
  // 这里只处理 /api/ 请求

  try {
    // 路由分发
    if (path === "/api/seed" && method === "POST") return await handleSeed();
    if (path === "/api/user" && method === "GET") return await handleGetUser();
    if (path === "/api/user/stats" && method === "GET") return await handleGetStats();
    if (path === "/api/orders" && method === "GET") return await handleGetOrders();
    if (path === "/api/notifications" && method === "GET") return await handleGetNotifications();

    // 订单操作路由: /api/order/{orderId}/pay 或 /api/order/{orderId}/refund
    const orderMatch = path.match(/^\/api\/order\/([^/]+)$/);
    if (orderMatch && method === "GET") return await handleGetOrder(orderMatch[1]);

    const payMatch = path.match(/^\/api\/order\/([^/]+)\/pay$/);
    if (payMatch && method === "POST") return await handlePayOrder(payMatch[1]);

    const refundMatch = path.match(/^\/api\/order\/([^/]+)\/refund$/);
    if (refundMatch && method === "POST") return await handleRefundOrder(refundMatch[1], request);

    return jsonResponse({ error: "API 路由不存在" }, 404);
  } catch (err) {
    return jsonResponse({ error: "服务器内部错误", detail: err.message }, 500);
  }
}

// [2026-03-19 修复] ESA Pages 边缘函数要求默认导出包含 fetch 方法的对象
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 只处理 /api/ 开头的请求
    if (path.startsWith("/api/")) {
      return await handleRequest(request);
    }

    // [2026-03-19 修复] 非 API 请求：不用 fetch(request) 回源（会导致代理错误）
    // 而是请求同域名下的 /index.html，实现 SPA 路由回退
    // 先尝试请求原始路径的静态资源，如果是 .js/.css/.jpg 等静态文件直接返回
    const ext = path.split('.').pop();
    const staticExts = ['js', 'css', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'woff', 'woff2', 'ttf', 'map'];
    if (staticExts.includes(ext)) {
      return fetch(request);
    }

    // 其他路径（如 /auth, /account, /history 等 SPA 路由）返回 index.html
    const indexUrl = new URL('/index.html', url.origin);
    return fetch(indexUrl.toString());
  }
};
