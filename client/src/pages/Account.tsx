// [2026-03-18 改造] Account页面完整静态版
// 包含：用户信息、购买记录（支付/退款流程）、消息通知、账户安全、设置
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useState, useEffect, useCallback } from "react";
import {
  User, Settings, CreditCard, Bell, Shield,
  ChevronRight, Home, FolderOpen, HelpCircle, FileText,
  ImageIcon, Clock, CheckCircle2, XCircle, ArrowLeft, Lock, Mail, Phone,
  ChevronDown, ChevronUp, X, AlertTriangle, Loader2,
  Globe, Palette, Trash2, Info, BellRing, ShieldCheck, CreditCard as CreditCardIcon
} from "lucide-react";
// [2026-03-18 修复] 原: import { getLoginUrl } from "@/const"
// import { getLoginUrl } from "@/const";
// import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";

// ═══════════════════════════════════════════════════════════════════
//  假数据
// ═══════════════════════════════════════════════════════════════════

interface Order {
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

const INITIAL_ORDERS: Order[] = [
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
  // [2026-03-18 注释] 详情图流程不经过支付，注释掉对应的假订单数据
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

const MOCK_USER_DETAIL = {
  phone: "138****6789", registerDate: "2026-02-20",
  lastLogin: "2026-03-18 09:30", passwordSet: true,
};

const REFUND_REASONS = ["图片质量不满意", "生成结果与预期不符", "误操作购买", "其他"];

interface NotificationItem {
  id: string; type: "payment" | "refund" | "security" | "system";
  title: string; desc: string; time: string; read: boolean;
}

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  { id: "n1", type: "payment", title: "订单支付成功", desc: "订单 ORD-20260315002（主图高清·空气净化器）已支付 ¥69", time: "2026-03-15 14:30", read: true },
  // [2026-03-18 注释] 详情图流程不经过支付，注释掉对应的通知
  // { id: "n2", type: "payment", title: "订单支付成功", desc: "订单 ORD-20260314003（详情图高清·空气净化器）已支付 ¥89", time: "2026-03-14 10:15", read: true },
  { id: "n3", type: "refund", title: "退款已完成", desc: "订单 ORD-20260312004（主图高清·不锈钢面包机）已退款 ¥69 至原支付账户", time: "2026-03-13 09:00", read: true },
  { id: "n4", type: "security", title: "验证码发送成功", desc: "您的手机验证码已发送至 138****6789", time: "2026-03-10 16:20", read: false },
  { id: "n5", type: "security", title: "邮箱修改成功", desc: "您的邮箱已修改为 demo@example.com", time: "2026-03-08 11:30", read: false },
  { id: "n6", type: "system", title: "欢迎使用 SmartPhoto", desc: "您的账号已注册成功，快来体验 AI 电商做图吧！", time: "2026-02-20 10:00", read: true },
];

// ═══════════════════════════════════════════════════════════════════
//  工具组件
// ═══════════════════════════════════════════════════════════════════

function OrderStatusBadge({ status }: { status: string }) {
  const config: Record<string, { text: string; bg: string; color: string; icon: typeof CheckCircle2 }> = {
    paid: { text: "已支付", bg: "bg-green-50", color: "text-green-600", icon: CheckCircle2 },
    pending: { text: "待支付", bg: "bg-amber-50", color: "text-amber-600", icon: Clock },
    failed: { text: "支付失败", bg: "bg-red-50", color: "text-red-600", icon: XCircle },
    refunded: { text: "已退款", bg: "bg-slate-50", color: "text-slate-500", icon: XCircle },
    refund_pending: { text: "退款处理中", bg: "bg-orange-50", color: "text-orange-600", icon: Loader2 },
  };
  const c = config[status] || config.pending;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${c.bg} ${c.color}`}>
      <Icon className={`w-3 h-3 ${status === "refund_pending" ? "animate-spin" : ""}`} />
      {c.text}
    </span>
  );
}

function useCountdown(seconds: number) {
  const [count, setCount] = useState(0);
  const [active, setActive] = useState(false);
  useEffect(() => { if (!active || count <= 0) return; const t = setTimeout(() => setCount(c => c - 1), 1000); return () => clearTimeout(t); }, [active, count]);
  useEffect(() => { if (count <= 0 && active) setActive(false); }, [count, active]);
  const start = useCallback(() => { setCount(seconds); setActive(true); }, [seconds]);
  return { count, active, start };
}

function NotificationIcon({ type }: { type: string }) {
  const map: Record<string, { icon: typeof Bell; bg: string; color: string }> = {
    payment: { icon: CreditCardIcon, bg: "bg-green-50", color: "text-green-500" },
    refund: { icon: AlertTriangle, bg: "bg-orange-50", color: "text-orange-500" },
    security: { icon: ShieldCheck, bg: "bg-blue-50", color: "text-blue-500" },
    system: { icon: BellRing, bg: "bg-purple-50", color: "text-purple-500" },
  };
  const c = map[type] || map.system;
  const Icon = c.icon;
  return (
    <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
      <Icon className={`w-4.5 h-4.5 ${c.color}`} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  子页面：购买记录
// ═══════════════════════════════════════════════════════════════════

function PurchaseHistory({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [refundModalOrder, setRefundModalOrder] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundNote, setRefundNote] = useState("");
  const [refunding, setRefunding] = useState(false);
  // [2026-03-18 修复] 原: const [payingOrder, setPayingOrder] = useState<string | null>(null);
  // 原逻辑：点击去支付直接在列表中模拟2秒变为已支付，未跳转支付页面
  // 改为：点击去支付跳转到内嵌支付页面，支付完成后返回列表并更新状态
  const [payingOrderData, setPayingOrderData] = useState<Order | null>(null);
  const [payProgress, setPayProgress] = useState(false);

  // [2026-03-18 修复] 跳转到支付页面
  const handleGoToPay = (order: Order) => {
    setPayingOrderData(order);
  };

  // [2026-03-18 修复] 在支付页面中确认支付
  const handleConfirmPay = () => {
    if (!payingOrderData) return;
    setPayProgress(true);
    setTimeout(() => {
      const orderId = payingOrderData.id;
      setOrders(prev => prev.map(o =>
        o.id === orderId ? { ...o, status: "paid" as const, paymentMethod: "支付宝",
          images: ["/examples/air-purifier.jpg", "/examples/air-purifier-white.jpg", "/examples/2.jpg", "/examples/3.jpg"]
        } : o
      ));
      setPayProgress(false);
      setPayingOrderData(null);
      toast({ title: "支付成功", description: `订单 ${orderId} 已完成支付` });
    }, 2000);
  };

  // [2026-03-18 修复] 退款：提交后状态变为"退款处理中"
  const handleRefund = () => {
    if (!refundReason) { toast({ title: "请选择退款原因" }); return; }
    setRefunding(true);
    setTimeout(() => {
      setOrders(prev => prev.map(o =>
        o.id === refundModalOrder ? { ...o, status: "refund_pending" as const } : o
      ));
      setRefunding(false);
      setRefundModalOrder(null);
      setRefundReason("");
      setRefundNote("");
      toast({ title: "退款申请已提交", description: "商家将在 1-3 个工作日内处理，届时会通过消息通知您结果" });
    }, 2000);
  };

  // [2026-03-18 新增] 内嵌支付页面：点击去支付后跳到此页面
  if (payingOrderData) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
          <button onClick={() => !payProgress && setPayingOrderData(null)} className="text-slate-600 hover:text-slate-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold text-slate-900">订单支付</h1>
        </div>

        <div className="max-w-lg mx-auto px-4 py-6 flex-1">
          {/* 订单信息 */}
          <div className="bg-slate-50 rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                <ImageIcon className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-800">{payingOrderData.type}</p>
                <p className="text-xs text-slate-400">{payingOrderData.productName} · {payingOrderData.imageCount}张</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <span className="text-sm text-slate-500">订单号</span>
              <span className="text-xs text-slate-400 font-mono">{payingOrderData.id}</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-slate-500">下单时间</span>
              <span className="text-xs text-slate-400">{payingOrderData.createdAt}</span>
            </div>
          </div>

          {/* 支付金额 */}
          <div className="text-center mb-6">
            <p className="text-sm text-slate-500 mb-1">应付金额</p>
            <p className="text-4xl font-black text-slate-900">¥{payingOrderData.amount}</p>
          </div>

          {/* 支付方式选择 */}
          <p className="text-sm font-medium text-slate-700 mb-3">选择支付方式</p>
          <div className="space-y-2 mb-8">
            {[
              { name: "支付宝", color: "text-blue-600", bg: "bg-blue-50", checked: true },
              { name: "微信支付", color: "text-green-600", bg: "bg-green-50", checked: false },
            ].map(method => (
              <label key={method.name}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition ${method.checked ? "border-blue-400 bg-blue-50/50" : "border-slate-200"}`}>
                <div className={`w-8 h-8 rounded-lg ${method.bg} flex items-center justify-center`}>
                  <CreditCard className={`w-4 h-4 ${method.color}`} />
                </div>
                <span className="flex-1 text-sm text-slate-800">{method.name}</span>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${method.checked ? "border-blue-500" : "border-slate-300"}`}>
                  {method.checked && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                </div>
              </label>
            ))}
          </div>

          {/* 支付按钮 */}
          <button onClick={handleConfirmPay} disabled={payProgress}
            className="w-full bg-gradient-to-r from-blue-400 to-emerald-500 hover:from-blue-500 hover:to-emerald-600 disabled:opacity-70 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-base transition active:scale-95"
            style={{ boxShadow: '0 8px 24px rgba(20,184,166,0.35)' }}>
            {payProgress ? (
              <><Loader2 className="w-5 h-5 animate-spin" /><span>支付中…</span></>
            ) : (
              <><CheckCircle2 className="w-5 h-5" /><span>确认支付 ¥{payingOrderData.amount}</span></>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-slate-600 hover:text-slate-900"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-base font-bold text-slate-900">购买记录</h1>
      </div>

      <div className="flex-1 px-4 py-4 space-y-3 pb-8">
        {orders.map((order) => (
          <div key={order.id} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400 font-mono">{order.id}</span>
              <OrderStatusBadge status={order.status} />
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                <ImageIcon className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{order.type}</p>
                <p className="text-xs text-slate-400 truncate">{order.productName} · {order.imageCount}张</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-base font-bold text-slate-900">¥{order.amount}</p>
                {order.paymentMethod && <p className="text-[10px] text-slate-400">{order.paymentMethod}</p>}
              </div>
            </div>

            {/* 已支付：展开的图片预览 */}
            {order.status === "paid" && expandedOrder === order.id && order.images.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-3 pt-2 border-t border-slate-50">
                {order.images.map((img, i) => (
                  <div key={i} className="rounded-xl overflow-hidden border border-slate-100">
                    <img src={img} alt={`图片${i + 1}`} className="w-full aspect-square object-cover" />
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-50">
              <span className="text-xs text-slate-400">{order.createdAt}</span>
              <div className="flex items-center gap-2">
                {order.status === "paid" && (
                  <>
                    <button onClick={() => setExpandedOrder(prev => prev === order.id ? null : order.id)}
                      className="flex items-center gap-0.5 text-xs text-blue-500 hover:text-blue-600 font-medium">
                      {expandedOrder === order.id ? "收起图片" : "查看图片"}
                      {expandedOrder === order.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    <button onClick={() => { setRefundModalOrder(order.id); setRefundReason(""); setRefundNote(""); }}
                      className="text-xs text-red-400 hover:text-red-500 font-medium">申请退款</button>
                  </>
                )}
                {order.status === "pending" && (
                  <button onClick={() => handleGoToPay(order)}
                    className="text-xs text-white bg-blue-500 hover:bg-blue-600 font-medium px-3 py-1 rounded-full transition">
                    去支付
                  </button>
                )}
                {order.status === "refund_pending" && (
                  <span className="text-xs text-orange-500 font-medium">商家处理中…</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 退款弹窗 */}
      {refundModalOrder && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !refunding && setRefundModalOrder(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl px-5 pt-5 pb-8 shadow-2xl">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />申请退款
              </h3>
              <button onClick={() => !refunding && setRefundModalOrder(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-slate-400 mb-4">订单号：{refundModalOrder}</p>
            <p className="text-sm font-medium text-slate-700 mb-2">退款原因</p>
            <div className="space-y-2 mb-4">
              {REFUND_REASONS.map(reason => (
                <label key={reason} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition ${refundReason === reason ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-slate-300"}`}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${refundReason === reason ? "border-blue-500" : "border-slate-300"}`}>
                    {refundReason === reason && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                  </div>
                  <span className="text-sm text-slate-700">{reason}</span>
                  <input type="radio" name="refundReason" value={reason} checked={refundReason === reason} onChange={() => setRefundReason(reason)} className="sr-only" />
                </label>
              ))}
            </div>
            <p className="text-sm font-medium text-slate-700 mb-2">补充说明（可选）</p>
            <textarea value={refundNote} onChange={e => setRefundNote(e.target.value)} placeholder="请描述具体情况…" rows={3}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent mb-5" />
            <button onClick={handleRefund} disabled={refunding || !refundReason}
              className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition ${refunding || !refundReason ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-red-500 hover:bg-red-600 text-white active:scale-95"}`}>
              {refunding ? (<><Loader2 className="w-4 h-4 animate-spin" />处理中…</>) : "确认申请退款"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  子页面：消息通知
// ═══════════════════════════════════════════════════════════════════

function Notifications({ onBack }: { onBack: () => void }) {
  const [notifications] = useState(MOCK_NOTIFICATIONS);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-slate-600 hover:text-slate-900"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-base font-bold text-slate-900">消息通知</h1>
        <span className="text-xs text-slate-400 ml-auto">{notifications.filter(n => !n.read).length} 条未读</span>
      </div>

      <div className="flex-1 px-4 py-4 space-y-2 pb-8">
        {notifications.map(n => (
          <div key={n.id} className={`bg-white rounded-2xl p-4 shadow-sm flex gap-3 ${!n.read ? "border-l-2 border-blue-400" : ""}`}>
            <NotificationIcon type={n.type} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{n.desc}</p>
              <p className="text-[10px] text-slate-400 mt-1">{n.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  子页面：设置
// ═══════════════════════════════════════════════════════════════════

function SettingsPage({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const [language] = useState("简体中文");
  const [theme, setTheme] = useState("浅色模式");

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-slate-600 hover:text-slate-900"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-base font-bold text-slate-900">设置</h1>
      </div>

      <div className="px-4 py-4 space-y-3">
        <p className="text-xs text-slate-400 font-medium px-1">通用</p>
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center"><Globe className="w-4 h-4 text-blue-500" /></div>
            <span className="flex-1 text-sm text-slate-800">语言</span>
            <span className="text-sm text-slate-400">{language}</span>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </div>
          <button onClick={() => { setTheme(t => t === "浅色模式" ? "深色模式" : "浅色模式"); toast({ title: `已切换为${theme === "浅色模式" ? "深色模式" : "浅色模式"}` }); }}
            className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 text-left hover:bg-slate-50">
            <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center"><Palette className="w-4 h-4 text-purple-500" /></div>
            <span className="flex-1 text-sm text-slate-800">主题</span>
            <span className="text-sm text-slate-400">{theme}</span>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>
          <button onClick={() => toast({ title: "缓存已清除", description: "已释放 2.3MB 空间" })}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50">
            <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center"><Trash2 className="w-4 h-4 text-red-500" /></div>
            <span className="flex-1 text-sm text-slate-800">清除缓存</span>
            <span className="text-sm text-slate-400">2.3MB</span>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>
        </div>

        <p className="text-xs text-slate-400 font-medium px-1 mt-4">关于</p>
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center"><Info className="w-4 h-4 text-slate-500" /></div>
            <span className="flex-1 text-sm text-slate-800">版本号</span>
            <span className="text-sm text-slate-400">v1.0.0</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center"><FileText className="w-4 h-4 text-slate-400" /></div>
            <span className="flex-1 text-sm text-slate-800">开源许可</span>
            <span className="text-sm text-slate-400">MIT License</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  子页面：账户安全
// ═══════════════════════════════════════════════════════════════════

function AccountSecurity({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const [editingField, setEditingField] = useState<"phone" | "email" | null>(null);
  const [newValue, setNewValue] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const phoneCD = useCountdown(60);
  const emailCD = useCountdown(60);

  const handleSendCode = (type: "phone" | "email") => {
    if (!newValue.trim()) { toast({ title: type === "phone" ? "请输入手机号" : "请输入邮箱" }); return; }
    if (type === "phone") phoneCD.start(); else emailCD.start();
    setCodeSent(true);
    toast({ title: "验证码已发送", description: `已发送到 ${newValue}` });
  };

  const handleConfirm = (type: "phone" | "email") => {
    if (!verifyCode.trim()) { toast({ title: "请输入验证码" }); return; }
    toast({ title: type === "phone" ? "手机号修改成功" : "邮箱修改成功" });
    setEditingField(null); setNewValue(""); setVerifyCode(""); setCodeSent(false);
  };

  const cancel = () => { setEditingField(null); setNewValue(""); setVerifyCode(""); setCodeSent(false); };

  const renderEditForm = (type: "phone" | "email") => {
    const cd = type === "phone" ? phoneCD : emailCD;
    return (
      <div className="px-4 pb-4 space-y-2">
        <div className="flex gap-2">
          <input value={newValue} onChange={e => setNewValue(e.target.value)}
            placeholder={type === "phone" ? "输入新手机号" : "输入新邮箱地址"} type={type === "email" ? "email" : "text"}
            className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent" />
          <button onClick={() => handleSendCode(type)} disabled={cd.active}
            className={`shrink-0 text-xs px-3 py-2 rounded-xl font-medium transition ${cd.active ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-blue-50 text-blue-600 hover:bg-blue-100"}`}>
            {cd.active ? `${cd.count}s` : "发送验证码"}
          </button>
        </div>
        {codeSent && (<>
          <input value={verifyCode} onChange={e => setVerifyCode(e.target.value)} placeholder="输入验证码" maxLength={6}
            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent" />
          <button onClick={() => handleConfirm(type)} className="w-full text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-xl py-2 font-medium transition">确认修改</button>
        </>)}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-slate-600 hover:text-slate-900"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-base font-bold text-slate-900">账户安全</h1>
      </div>
      <div className="px-4 py-4 space-y-3">
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          {/* 手机号 */}
          <div className="border-b border-slate-100">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center"><Phone className="w-4 h-4 text-blue-500" /></div>
              <span className="flex-1 text-sm text-slate-800">手机号</span>
              <span className="text-sm text-slate-400 mr-1">{MOCK_USER_DETAIL.phone}</span>
              <button onClick={() => { if (editingField === "phone") cancel(); else { cancel(); setEditingField("phone"); } }} className="text-xs text-blue-500">
                {editingField === "phone" ? "取消" : "修改"}
              </button>
            </div>
            {editingField === "phone" && renderEditForm("phone")}
          </div>
          {/* 邮箱 */}
          <div className="border-b border-slate-100">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center"><Mail className="w-4 h-4 text-green-500" /></div>
              <span className="flex-1 text-sm text-slate-800">邮箱</span>
              <span className="text-sm text-slate-400 mr-1">demo@example.com</span>
              <button onClick={() => { if (editingField === "email") cancel(); else { cancel(); setEditingField("email"); } }} className="text-xs text-blue-500">
                {editingField === "email" ? "取消" : "修改"}
              </button>
            </div>
            {editingField === "email" && renderEditForm("email")}
          </div>
          {/* 密码 */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center"><Lock className="w-4 h-4 text-amber-500" /></div>
            <span className="flex-1 text-sm text-slate-800">登录密码</span>
            <span className="text-sm text-slate-400 mr-1">{MOCK_USER_DETAIL.passwordSet ? "已设置" : "未设置"}</span>
            <button onClick={() => toast({ title: "修改密码", description: "功能开发中" })} className="text-xs text-blue-500">修改</button>
          </div>
        </div>
        <p className="text-xs text-slate-400 font-medium px-1 mt-4">账户信息</p>
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
            <span className="text-sm text-slate-500">注册时间</span>
            <span className="flex-1 text-sm text-slate-800 text-right">{MOCK_USER_DETAIL.registerDate}</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="text-sm text-slate-500">最近登录</span>
            <span className="flex-1 text-sm text-slate-800 text-right">{MOCK_USER_DETAIL.lastLogin}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  主组件
// ═══════════════════════════════════════════════════════════════════

export default function Account() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [subPage, setSubPage] = useState<"main" | "purchase" | "security" | "notifications" | "settings">("main");

  const logout = { mutate: () => { window.location.href = "/"; }, isPending: false };

  if (loading) {
    return (<div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>);
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-2"><User className="w-8 h-8 text-blue-400" /></div>
        <h2 className="text-lg font-semibold text-slate-900">登录后查看账户</h2>
        <p className="text-sm text-slate-500 text-center">登录账号，管理你的个人信息和使用记录</p>
        <a href="#" className="mt-2 px-8 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-full transition-colors">登录 / 注册</a>
      </div>
    );
  }

  if (subPage === "purchase") return <PurchaseHistory onBack={() => setSubPage("main")} />;
  if (subPage === "security") return <AccountSecurity onBack={() => setSubPage("main")} />;
  if (subPage === "notifications") return <Notifications onBack={() => setSubPage("main")} />;
  if (subPage === "settings") return <SettingsPage onBack={() => setSubPage("main")} />;

  const unreadCount = MOCK_NOTIFICATIONS.filter(n => !n.read).length;

  const menuGroups = [
    {
      title: "账户管理",
      items: [
        { icon: <CreditCard className="w-4 h-4 text-blue-500" />, label: "我的购买记录", desc: `${INITIAL_ORDERS.length}笔订单`, onClick: () => setSubPage("purchase") },
        { icon: <Bell className="w-4 h-4 text-amber-500" />, label: "消息通知", desc: unreadCount > 0 ? `${unreadCount}条未读` : undefined, onClick: () => setSubPage("notifications") },
        { icon: <Shield className="w-4 h-4 text-green-500" />, label: "账户安全", desc: "手机 · 密码", onClick: () => setSubPage("security") },
        { icon: <Settings className="w-4 h-4 text-slate-500" />, label: "设置", onClick: () => setSubPage("settings") },
      ],
    },
    {
      title: "帮助与支持",
      items: [
        { icon: <HelpCircle className="w-4 h-4 text-purple-500" />, label: "帮助中心", onClick: () => setLocation("/help") },
        { icon: <FileText className="w-4 h-4 text-slate-400" />, label: "用户协议", onClick: () => setLocation("/terms") },
        { icon: <FileText className="w-4 h-4 text-slate-400" />, label: "隐私政策", onClick: () => setLocation("/privacy") },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 px-5 pt-8 pb-10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white text-xl font-bold border-2 border-white/40">
            {user.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div>
            <h2 className="text-white font-semibold text-base">{user.name || "用户"}</h2>
            <p className="text-blue-100 text-xs mt-0.5">{user.email || "暂无邮箱"}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {[{ label: "已生成图片", value: "12" }, { label: "本月使用", value: "5" }].map(stat => (
            <div key={stat.label} className="bg-white/15 rounded-xl py-2.5 text-center">
              <p className="text-white font-bold text-lg leading-none">{stat.value}</p>
              <p className="text-blue-100 text-xs mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 pt-4 pb-24 space-y-3">
        {menuGroups.map(group => (
          <div key={group.title}>
            <p className="text-xs text-slate-400 font-medium mb-1.5 px-1">{group.title}</p>
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              {group.items.map((item, i) => (
                <button key={item.label} onClick={item.onClick}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 active:bg-slate-100 transition-colors text-left ${i < group.items.length - 1 ? "border-b border-slate-100" : ""}`}>
                  <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">{item.icon}</div>
                  <span className="flex-1 text-sm text-slate-800">{item.label}</span>
                  {"desc" in item && item.desc && <span className="text-xs text-slate-400 mr-1">{item.desc}</span>}
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ))}
        <button onClick={() => logout.mutate()} disabled={logout.isPending}
          className="w-full bg-white rounded-2xl py-3.5 text-sm text-red-500 font-medium hover:bg-red-50 active:bg-red-100 transition-colors shadow-sm">
          {logout.isPending ? "退出中…" : "退出登录"}
        </button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex z-20">
        <button className="flex-1 flex flex-col items-center py-2.5 gap-0.5 text-slate-400 hover:text-slate-600" onClick={() => setLocation("/")}>
          <Home className="w-5 h-5" /><span className="text-xs">首页</span>
        </button>
        <button className="flex-1 flex flex-col items-center py-2.5 gap-0.5 text-slate-400 hover:text-slate-600" onClick={() => setLocation("/history")}>
          <FolderOpen className="w-5 h-5" /><span className="text-xs">资产</span>
        </button>
        <button className="flex-1 flex flex-col items-center py-2.5 gap-0.5 text-blue-500">
          <User className="w-5 h-5" /><span className="text-xs font-medium">账户</span>
        </button>
      </div>
    </div>
  );
}
