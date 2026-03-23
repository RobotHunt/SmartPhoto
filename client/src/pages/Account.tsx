import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { accountAPI } from "@/lib/api";
import { useLocation } from "wouter";
import {
  User, Settings, CreditCard, Bell, Shield,
  ChevronRight, LogOut, Home, FolderOpen, HelpCircle, FileText,
  Check, X, Pencil, Loader2, ArrowLeft, Eye, EyeOff,
  CheckCheck, Clock, Package,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ───── Type Definitions ─────

interface AccountOverview {
  total_generated_assets: number;
  generated_assets_this_month: number;
  session_count: number;
  wallet_balance: number;
  unread_notification_count: number;
}

interface Notification {
  id: string;
  notification_id?: string;
  category?: string;
  title: string;
  content: string;
  created_at: string;
  time?: string;
  read?: boolean;
  is_read?: boolean;
  payload?: Record<string, any>;
}

interface Purchase {
  id: string;
  order_no: string;
  plan_name: string;
  amount: number;
  status: string;
  created_at: string;
  time?: string;
}

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  desc?: string;
  badge?: number;
  onClick: () => void;
}

type SubModal = "purchases" | "notifications" | "security" | null;

// ───── Sub-Modal Wrapper ─────

function SubModalPanel({
  open,
  title,
  onBack,
  children,
}: {
  open: boolean;
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`fixed inset-0 z-30 bg-slate-50 transition-transform duration-300 ease-in-out ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {/* Sub-modal header */}
      <div className="sticky top-0 bg-white border-b border-slate-100 z-10">
        <div className="flex items-center h-12 px-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600 transition-colors -ml-1 mr-3"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </button>
          <h3 className="text-sm font-semibold text-slate-900 flex-1 text-center pr-12">
            {title}
          </h3>
        </div>
      </div>

      {/* Sub-modal body */}
      <div className="overflow-y-auto h-[calc(100vh-48px)] px-4 pt-4 pb-8">
        {children}
      </div>
    </div>
  );
}

// ───── Purchases Sub-Modal Content ─────

function PurchasesContent() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    accountAPI
      .getPurchases()
      .then((data) => {
        if (!cancelled) setPurchases(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  if (purchases.length === 0) {
    return (
      <div className="text-center py-16">
        <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-400">暂无购买记录</p>
      </div>
    );
  }

  const statusLabels: Record<string, { text: string; color: string }> = {
    completed: { text: "已完成", color: "text-green-600 bg-green-50" },
    paid: { text: "已支付", color: "text-green-600 bg-green-50" },
    success: { text: "成功", color: "text-green-600 bg-green-50" },
    pending: { text: "待支付", color: "text-amber-600 bg-amber-50" },
    failed: { text: "失败", color: "text-red-600 bg-red-50" },
    refunded: { text: "已退款", color: "text-slate-600 bg-slate-100" },
  };

  return (
    <div className="space-y-3">
      {purchases.map((p) => {
        const st = statusLabels[p.status] ?? {
          text: p.status,
          color: "text-slate-600 bg-slate-100",
        };
        return (
          <div
            key={p.id || p.order_no}
            className="bg-white rounded-xl p-4 shadow-sm"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {p.plan_name || "套餐"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  {p.order_no}
                </p>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}
              >
                {st.text}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold text-slate-900">
                ¥{typeof p.amount === "number" ? p.amount.toFixed(2) : p.amount}
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(p.created_at || p.time)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ───── Notifications Sub-Modal Content ─────

function NotificationsContent({
  onCountChange,
}: {
  onCountChange: (count: number) => void;
}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingIds, setMarkingIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const loadNotifications = useCallback(() => {
    setLoading(true);
    setError(null);
    accountAPI
      .getNotifications()
      .then((data: any) => {
        // Backend returns { items: [...], total, unread_count }
        const rawList = Array.isArray(data) ? data : (data?.items ?? []);
        // Map notification_id → id for frontend consistency
        const list: Notification[] = rawList.map((n: any) => ({
          ...n,
          id: n.id || n.notification_id || "",
          payload: n.payload || {},
        }));
        setNotifications(list);
        const unread =
          typeof data?.unread_count === "number"
            ? data.unread_count
            : list.filter((n: Notification) => !n.read && !n.is_read).length;
        onCountChange(unread);
      })
      .catch((err: any) => setError(err.message || "加载失败"))
      .finally(() => setLoading(false));
  }, [onCountChange]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  function isUnread(n: Notification) {
    return !n.read && !n.is_read;
  }

  async function handleMarkRead(id: string) {
    setMarkingIds((prev) => new Set(prev).add(id));
    try {
      // Backend expects notification_id in the URL
      await accountAPI.markNotificationRead(id);
      setNotifications((prev) => {
        const updated = prev.map((n) =>
          (n.id === id || n.notification_id === id) ? { ...n, read: true, is_read: true } : n
        );
        const unread = updated.filter(isUnread).length;
        onCountChange(unread);
        return updated;
      });
      toast({ title: "已标记为已读" });
    } catch (err: any) {
      toast({
        title: "操作失败",
        description: err.message || "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setMarkingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await accountAPI.markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, is_read: true }))
      );
      onCountChange(0);
      toast({ title: "已全部标记为已读" });
    } catch (err: any) {
      toast({
        title: "操作失败",
        description: err.message || "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setMarkingAll(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  const unreadCount = notifications.filter(isUnread).length;

  if (notifications.length === 0) {
    return (
      <div className="text-center py-16">
        <Bell className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-400">暂无通知</p>
      </div>
    );
  }

  return (
    <div>
      {/* Mark all read button */}
      {unreadCount > 0 && (
        <div className="flex justify-end mb-3">
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-600 disabled:opacity-50 transition-colors px-2 py-1 rounded-lg hover:bg-blue-50"
          >
            {markingAll ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCheck className="w-3.5 h-3.5" />
            )}
            全部标记已读
          </button>
        </div>
      )}

      <div className="space-y-3">
        {notifications.map((n) => {
          const unread = isUnread(n);
          const nid = n.id || n.notification_id || "";
          // Extract credit info from payload if available
          const creditsDelta = n.payload?.credits_delta ?? n.payload?.charged_credits ?? null;
          const balanceAfter = n.payload?.balance_after ?? null;
          return (
            <div
              key={nid}
              className={`bg-white rounded-xl p-4 shadow-sm ${
                unread ? "border-l-2 border-blue-500" : "opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {unread && (
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />
                    )}
                    <p
                      className={`text-sm truncate ${
                        unread
                          ? "font-semibold text-slate-900"
                          : "font-medium text-slate-600"
                      }`}
                    >
                      {n.title}
                    </p>
                    {n.category && (
                      <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">
                        {n.category}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {n.content}
                  </p>
                  {/* Credit consumption display */}
                  {creditsDelta !== null && (
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className={`text-xs font-medium ${Number(creditsDelta) < 0 ? "text-red-500" : "text-green-600"}`}>
                        {Number(creditsDelta) < 0 ? "" : "+"}{creditsDelta} 额度
                      </span>
                      {balanceAfter !== null && (
                        <span className="text-xs text-slate-400">
                          余额: {balanceAfter}
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(n.created_at || n.time)}
                  </p>
                </div>

                {unread && (
                  <button
                    onClick={() => handleMarkRead(nid)}
                    disabled={markingIds.has(nid)}
                    className="flex-shrink-0 text-xs text-blue-500 hover:text-blue-600 disabled:opacity-50 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    {markingIds.has(nid) ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      "标记已读"
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ───── Security / Password Change Sub-Modal Content ─────

function SecurityContent() {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (!currentPassword) {
      errs.currentPassword = "请输入当前密码";
    }
    if (!newPassword) {
      errs.newPassword = "请输入新密码";
    } else if (newPassword.length < 8) {
      errs.newPassword = "新密码至少需要8个字符";
    }
    if (!confirmPassword) {
      errs.confirmPassword = "请确认新密码";
    } else if (newPassword !== confirmPassword) {
      errs.confirmPassword = "两次输入的密码不一致";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await accountAPI.changePassword(currentPassword, newPassword);
      toast({ title: "密码修改成功" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setErrors({});
    } catch (err: any) {
      toast({
        title: "修改失败",
        description: err.message || "请检查当前密码是否正确",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function renderPasswordField(
    label: string,
    value: string,
    onChange: (v: string) => void,
    show: boolean,
    toggleShow: () => void,
    error?: string,
    placeholder?: string
  ) {
    return (
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              if (errors[Object.keys(errors)[0]]) setErrors({});
            }}
            placeholder={placeholder || label}
            className={`w-full px-3 py-2.5 text-sm border rounded-xl bg-white outline-none transition-colors pr-10 ${
              error
                ? "border-red-300 focus:ring-2 focus:ring-red-100 focus:border-red-400"
                : "border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
            }`}
          />
          <button
            type="button"
            onClick={toggleShow}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {show ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
        <h4 className="text-sm font-semibold text-slate-900 mb-1">修改密码</h4>

        {renderPasswordField(
          "当前密码",
          currentPassword,
          setCurrentPassword,
          showCurrent,
          () => setShowCurrent(!showCurrent),
          errors.currentPassword,
          "请输入当前密码"
        )}

        {renderPasswordField(
          "新密码",
          newPassword,
          setNewPassword,
          showNew,
          () => setShowNew(!showNew),
          errors.newPassword,
          "至少8个字符"
        )}

        {renderPasswordField(
          "确认新密码",
          confirmPassword,
          setConfirmPassword,
          showConfirm,
          () => setShowConfirm(!showConfirm),
          errors.confirmPassword,
          "再次输入新密码"
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {submitting ? "提交中..." : "确认修改"}
      </button>
    </form>
  );
}

// ───── Helpers ─────

function formatTime(raw?: string): string {
  if (!raw) return "-";
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return raw;
  }
}

// ───── Main Component ─────

export default function Account() {
  const { user, loading, logout, refreshUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Account data state
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [dataLoading, setDataLoading] = useState(false);

  // Inline name editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Sub-modal state
  const [activeModal, setActiveModal] = useState<SubModal>(null);

  // Load account data from backend on mount
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    setDataLoading(true);

    async function loadAccountData() {
      const results = await Promise.allSettled([
        accountAPI.getOverview(),
        accountAPI.getNotifications(),
      ]);

      if (cancelled) return;

      // Overview stats
      if (results[0].status === "fulfilled") {
        const data = results[0].value;
        setOverview({
          total_generated_assets: data.total_generated_assets ?? 0,
          generated_assets_this_month: data.generated_assets_this_month ?? 0,
          session_count: data.session_count ?? 0,
          wallet_balance: data.wallet_balance ?? 0,
          unread_notification_count: data.unread_notification_count ?? 0,
        });
        // Use overview's unread_notification_count for the badge
        if (typeof data.unread_notification_count === "number") {
          setNotificationCount(data.unread_notification_count);
        }
      }

      // Notification badge count (unread count)
      if (results[1].status === "fulfilled") {
        const notifData: any = results[1].value;
        if (notifData && typeof notifData === "object" && !Array.isArray(notifData) && typeof notifData.unread_count === "number") {
          setNotificationCount(notifData.unread_count);
        } else if (Array.isArray(notifData)) {
          const unread = notifData.filter(
            (n: any) => !n.read && !n.is_read
          ).length;
          setNotificationCount(unread);
        }
      }

      setDataLoading(false);
    }

    loadAccountData();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // Handle name save
  async function handleSaveName() {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === (user?.display_name || user?.name)) {
      setIsEditingName(false);
      return;
    }

    setSavingName(true);
    try {
      await accountAPI.updateProfile({ display_name: trimmed });
      await refreshUser();
      toast({ title: "昵称已更新" });
    } catch (err: any) {
      toast({
        title: "更新失败",
        description: err.message || "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setSavingName(false);
      setIsEditingName(false);
    }
  }

  // Handle logout
  async function handleLogout() {
    try {
      await logout();
      setLocation("/");
    } catch {
      setLocation("/");
    }
  }

  // Callback for notification count updates from sub-modal
  const handleNotificationCountChange = useCallback((count: number) => {
    setNotificationCount(count);
  }, []);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Not logged in ──
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-2">
          <User className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">登录后查看账户</h2>
        <p className="text-sm text-slate-500 text-center">
          登录账号，管理你的个人信息和使用记录
        </p>
        <button
          onClick={() => setLocation("/login")}
          className="mt-2 px-8 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-full transition-colors"
        >
          登录 / 注册
        </button>

        {/* Bottom tab navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex z-20">
          <button
            className="flex-1 flex flex-col items-center py-2.5 gap-0.5 text-slate-400 hover:text-slate-600"
            onClick={() => setLocation("/")}
          >
            <Home className="w-5 h-5" />
            <span className="text-xs">首页</span>
          </button>
          <button
            className="flex-1 flex flex-col items-center py-2.5 gap-0.5 text-slate-400 hover:text-slate-600"
            onClick={() => setLocation("/history")}
          >
            <FolderOpen className="w-5 h-5" />
            <span className="text-xs">资产</span>
          </button>
          <button className="flex-1 flex flex-col items-center py-2.5 gap-0.5 text-blue-500">
            <User className="w-5 h-5" />
            <span className="text-xs font-medium">账户</span>
          </button>
        </div>
      </div>
    );
  }

  // ── Derived values ──
  const displayName = user.display_name || user.name || "用户";
  const displayEmail = user.email || "暂无邮箱";
  const avatarLetter = displayName[0]?.toUpperCase() ?? "U";

  const stats = [
    {
      label: "已生成图片",
      value: dataLoading ? "..." : String(overview?.total_generated_assets ?? 0),
    },
    {
      label: "本月使用",
      value: dataLoading ? "..." : String(overview?.generated_assets_this_month ?? 0),
    },
  ];

  const menuGroups: { title: string; items: MenuItem[] }[] = [
    {
      title: "账户管理",
      items: [
        {
          icon: <CreditCard className="w-4 h-4 text-blue-500" />,
          label: "购买记录",
          onClick: () => setActiveModal("purchases"),
        },
        {
          icon: <Bell className="w-4 h-4 text-amber-500" />,
          label: "消息通知",
          badge: notificationCount,
          onClick: () => setActiveModal("notifications"),
        },
        {
          icon: <Shield className="w-4 h-4 text-green-500" />,
          label: "账户安全",
          desc: "修改密码",
          onClick: () => setActiveModal("security"),
        },
        {
          icon: <Settings className="w-4 h-4 text-slate-500" />,
          label: "设置",
          onClick: () => toast({ title: "设置", description: "开发中" }),
        },
      ],
    },
    {
      title: "帮助与支持",
      items: [
        {
          icon: <HelpCircle className="w-4 h-4 text-purple-500" />,
          label: "帮助中心",
          onClick: () =>
            toast({ title: "帮助中心", description: "开发中" }),
        },
        {
          icon: <FileText className="w-4 h-4 text-slate-400" />,
          label: "用户协议",
          onClick: () => setLocation("/terms"),
        },
        {
          icon: <FileText className="w-4 h-4 text-slate-400" />,
          label: "隐私政策",
          onClick: () => setLocation("/privacy"),
        },
      ],
    },
  ];

  // ── Render ──
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* ────── Header - blue gradient with user profile ────── */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 px-5 pt-8 pb-10">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white text-xl font-bold border-2 border-white/40">
            {avatarLetter}
          </div>

          {/* Name & email */}
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") setIsEditingName(false);
                  }}
                  disabled={savingName}
                  className="bg-white/20 text-white placeholder-blue-200 text-sm font-semibold rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-white/50 w-full max-w-[160px]"
                  maxLength={30}
                />
                {savingName ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin flex-shrink-0" />
                ) : (
                  <>
                    <button
                      onClick={handleSaveName}
                      className="p-1 rounded-full hover:bg-white/20 transition-colors"
                    >
                      <Check className="w-4 h-4 text-white" />
                    </button>
                    <button
                      onClick={() => setIsEditingName(false)}
                      className="p-1 rounded-full hover:bg-white/20 transition-colors"
                    >
                      <X className="w-4 h-4 text-white/70" />
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-white font-semibold text-base truncate">
                  {displayName}
                </h2>
                <button
                  onClick={() => {
                    setEditName(displayName);
                    setIsEditingName(true);
                  }}
                  className="p-1 rounded-full hover:bg-white/20 transition-colors flex-shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5 text-white/70" />
                </button>
              </div>
            )}
            <p className="text-blue-100 text-xs mt-0.5 truncate">
              {displayEmail}
            </p>
          </div>
        </div>

        {/* Stats cards */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-white/15 rounded-xl py-2.5 text-center"
            >
              <p className="text-white font-bold text-lg leading-none">
                {stat.value}
              </p>
              <p className="text-blue-100 text-xs mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ────── Menu groups ────── */}
      <div className="flex-1 px-4 pt-4 pb-24 space-y-3">
        {menuGroups.map((group) => (
          <div key={group.title}>
            <p className="text-xs text-slate-400 font-medium mb-1.5 px-1">
              {group.title}
            </p>
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              {group.items.map((item, i) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 active:bg-slate-100 transition-colors text-left ${
                    i < group.items.length - 1
                      ? "border-b border-slate-100"
                      : ""
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
                    {item.icon}
                  </div>
                  <span className="flex-1 text-sm text-slate-800">
                    {item.label}
                  </span>
                  {item.badge != null && item.badge > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                  {item.desc && (
                    <span className="text-xs text-slate-400 mr-1">
                      {item.desc}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="w-full bg-white rounded-2xl py-3.5 flex items-center justify-center gap-2 text-sm text-red-500 font-medium hover:bg-red-50 active:bg-red-100 transition-colors shadow-sm"
        >
          <LogOut className="w-4 h-4" />
          退出登录
        </button>
      </div>

      {/* ────── Bottom tab navigation ────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex z-20">
        <button
          className="flex-1 flex flex-col items-center py-2.5 gap-0.5 text-slate-400 hover:text-slate-600"
          onClick={() => setLocation("/")}
        >
          <Home className="w-5 h-5" />
          <span className="text-xs">首页</span>
        </button>
        <button
          className="flex-1 flex flex-col items-center py-2.5 gap-0.5 text-slate-400 hover:text-slate-600"
          onClick={() => setLocation("/history")}
        >
          <FolderOpen className="w-5 h-5" />
          <span className="text-xs">资产</span>
        </button>
        <button className="flex-1 flex flex-col items-center py-2.5 gap-0.5 text-blue-500">
          <User className="w-5 h-5" />
          <span className="text-xs font-medium">账户</span>
        </button>
      </div>

      {/* ────── Sub-Modals (slide-in panels) ────── */}

      {/* Purchases */}
      <SubModalPanel
        open={activeModal === "purchases"}
        title="购买记录"
        onBack={() => setActiveModal(null)}
      >
        {activeModal === "purchases" && <PurchasesContent />}
      </SubModalPanel>

      {/* Notifications */}
      <SubModalPanel
        open={activeModal === "notifications"}
        title="消息通知"
        onBack={() => setActiveModal(null)}
      >
        {activeModal === "notifications" && (
          <NotificationsContent
            onCountChange={handleNotificationCountChange}
          />
        )}
      </SubModalPanel>

      {/* Security / Password Change */}
      <SubModalPanel
        open={activeModal === "security"}
        title="账户安全"
        onBack={() => setActiveModal(null)}
      >
        {activeModal === "security" && <SecurityContent />}
      </SubModalPanel>
    </div>
  );
}
