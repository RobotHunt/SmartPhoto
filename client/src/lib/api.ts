// [2026-03-19 新增] 前端 API 模拟层
// 现阶段：读取本地假数据，模拟后端 API 响应
// 后续接入后端时：把每个函数的实现从本地数据改为 fetch("/api/xxx")
// API 路径和数据格式保持一致，前端其他代码不需要改动

// ═══════════════════════════════════════════════════════════════════
//  数据类型定义（与数据库字段设计文档 v2.0 一致）
// ═══════════════════════════════════════════════════════════════════

export interface UserInfo {
  id: string | number;
  name: string;
  email: string;
  phone: string;
  passwordSet: boolean;
  role: string;
  createdAt: string;
  lastSignedIn: string;
}

export interface UserStats {
  totalImages: number;
  monthlyUsage: number;
}

export interface Order {
  id: string;
  type: string;
  productName: string;
  amount: number;
  status: "pending" | "paid" | "refund_pending" | "refunded" | "failed";
  paymentMethod: string;
  imageCount: number;
  images: string[];
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  type: "payment" | "refund" | "security" | "system";
  title: string;
  desc: string;
  time: string;
  read: boolean;
}

// ═══════════════════════════════════════════════════════════════════
//  假数据（与 KV 中填入的种子数据一致）
//  后续接入后端时删除这些常量，改为 fetch 调用
// ═══════════════════════════════════════════════════════════════════

const MOCK_USER: UserInfo = {
  id: "user_001",
  name: "演示用户",
  email: "demo@example.com",
  phone: "138****6789",
  passwordSet: true,
  role: "user",
  createdAt: "2026-02-20",
  lastSignedIn: "2026-03-18 09:30",
};

const MOCK_STATS: UserStats = {
  totalImages: 12,
  monthlyUsage: 5,
};

const MOCK_ORDERS: Order[] = [
  {
    id: "ORD-20260316001", type: "主图高清", productName: "便携式蓝牙音箱",
    amount: 69, status: "pending", paymentMethod: "", imageCount: 4, images: [],
    createdAt: "2026-03-16 18:20",
  },
  {
    id: "ORD-20260315002", type: "主图高清", productName: "空气净化器",
    amount: 69, status: "paid", paymentMethod: "支付宝", imageCount: 4,
    images: ["/examples/air-purifier.jpg", "/examples/air-purifier-white.jpg", "/examples/2.jpg", "/examples/3.jpg"],
    createdAt: "2026-03-15 14:30",
  },
  // [2026-03-18 注释] 详情图流程不经过支付，注释掉对应订单
  // {
  //   id: "ORD-20260314003", type: "详情图高清", productName: "空气净化器",
  //   amount: 89, status: "paid", paymentMethod: "微信支付", imageCount: 4,
  //   images: ["/examples/air-purifier.jpg", "/examples/air-purifier-white.jpg", "/examples/2.jpg", "/examples/3.jpg"],
  //   createdAt: "2026-03-14 10:15",
  // },
  {
    id: "ORD-20260312004", type: "主图高清", productName: "不锈钢面包机",
    amount: 69, status: "refunded", paymentMethod: "支付宝", imageCount: 4, images: [],
    createdAt: "2026-03-12 16:45",
  },
];

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  { id: "n1", type: "payment", title: "订单支付成功", desc: "订单 ORD-20260315002（主图高清·空气净化器）已支付 ¥69", time: "2026-03-15 14:30", read: true },
  // [2026-03-18 注释] 详情图流程不经过支付
  // { id: "n2", type: "payment", title: "订单支付成功", desc: "订单 ORD-20260314003（详情图高清·空气净化器）已支付 ¥89", time: "2026-03-14 10:15", read: true },
  { id: "n3", type: "refund", title: "退款已完成", desc: "订单 ORD-20260312004（主图高清·不锈钢面包机）已退款 ¥69 至原支付账户", time: "2026-03-13 09:00", read: true },
  { id: "n4", type: "security", title: "验证码发送成功", desc: "您的手机验证码已发送至 138****6789", time: "2026-03-10 16:20", read: false },
  { id: "n5", type: "security", title: "邮箱修改成功", desc: "您的邮箱已修改为 demo@example.com", time: "2026-03-08 11:30", read: false },
  { id: "n6", type: "system", title: "欢迎使用 SmartPhoto", desc: "您的账号已注册成功，快来体验 AI 电商做图吧！", time: "2026-02-20 10:00", read: true },
];

// ═══════════════════════════════════════════════════════════════════
//  API 函数（模拟后端接口）
//  每个函数对应一个 API 路径，返回 Promise 模拟异步请求
//  后续接入后端时，只需把函数体改为 fetch() 调用
// ═══════════════════════════════════════════════════════════════════

// 模拟网络延迟
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// GET /api/user — 获取当前用户信息
export async function getUser(): Promise<UserInfo> {
  // 后续: const res = await fetch("/api/user"); return res.json();
  await delay(300);
  return { ...MOCK_USER };
}

// GET /api/user/stats — 获取使用统计
export async function getUserStats(): Promise<UserStats> {
  // 后续: const res = await fetch("/api/user/stats"); return res.json();
  await delay(200);
  return { ...MOCK_STATS };
}

// GET /api/orders — 获取订单列表
export async function getOrders(): Promise<Order[]> {
  // 后续: const res = await fetch("/api/orders"); return res.json();
  await delay(400);
  // 从 sessionStorage 读取可能被支付/退款修改过的订单
  const stored = sessionStorage.getItem("mock_orders");
  if (stored) {
    try { return JSON.parse(stored); } catch { /* ignore */ }
  }
  return MOCK_ORDERS.map(o => ({ ...o }));
}

// POST /api/order/{id}/pay — 模拟支付
export async function payOrder(orderId: string): Promise<{ success: boolean; order: Order }> {
  // 后续: const res = await fetch(`/api/order/${orderId}/pay`, { method: "POST" }); return res.json();
  await delay(2000);
  const orders = await getOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) throw new Error("订单不存在");
  if (order.status !== "pending") throw new Error("订单状态不允许支付");

  order.status = "paid";
  order.paymentMethod = "支付宝";
  order.images = ["/examples/air-purifier.jpg", "/examples/air-purifier-white.jpg", "/examples/2.jpg", "/examples/3.jpg"];

  const updatedOrders = orders.map(o => o.id === orderId ? order : o);
  sessionStorage.setItem("mock_orders", JSON.stringify(updatedOrders));

  return { success: true, order };
}

// POST /api/order/{id}/refund — 申请退款
export async function refundOrder(orderId: string, reason: string, note: string): Promise<{ success: boolean }> {
  // 后续: const res = await fetch(`/api/order/${orderId}/refund`, { method: "POST", body: JSON.stringify({ reason, note }) }); return res.json();
  await delay(2000);
  const orders = await getOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) throw new Error("订单不存在");

  order.status = "refund_pending";

  const updatedOrders = orders.map(o => o.id === orderId ? order : o);
  sessionStorage.setItem("mock_orders", JSON.stringify(updatedOrders));

  return { success: true };
}

// GET /api/notifications — 获取消息通知
export async function getNotifications(): Promise<NotificationItem[]> {
  // 后续: const res = await fetch("/api/notifications"); return res.json();
  await delay(300);
  return MOCK_NOTIFICATIONS.map(n => ({ ...n }));
}
