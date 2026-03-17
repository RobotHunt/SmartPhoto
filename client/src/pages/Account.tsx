import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import {
  User, Settings, CreditCard, Bell, Shield,
  ChevronRight, LogOut, Home, FolderOpen, HelpCircle, FileText
} from "lucide-react";
import { getLoginUrl } from "@/const";
// [2026-03-16 静态化改造] 注释掉 tRPC import，静态模式下不调用后端登出接口
// import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  desc?: string;
  onClick: () => void;
}

export default function Account() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  // --- 原始代码：tRPC 登出 mutation（已注释） ---
  // [2026-03-16 静态化改造] 目标：不调后端，直接跳转首页
  /*
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
  });
  */
  // --- 新代码：Mock 登出，直接跳转首页 ---
  const logout = { mutate: () => { window.location.href = "/"; }, isPending: false };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 未登录
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-2">
          <User className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">登录后查看账户</h2>
        <p className="text-sm text-slate-500 text-center">登录账号，管理你的个人信息和使用记录</p>
        <a
          href={getLoginUrl()}
          className="mt-2 px-8 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-full transition-colors"
        >
          登录 / 注册
        </a>
      </div>
    );
  }

  const menuGroups: { title: string; items: MenuItem[] }[] = [
    {
      title: "账户管理",
      items: [
        {
          icon: <CreditCard className="w-4 h-4 text-blue-500" />,
          label: "我的购买记录",
          onClick: () => toast({ title: "套餐管理", description: "功能开发中" }),
        },
        {
          icon: <Bell className="w-4 h-4 text-amber-500" />,
          label: "消息通知",
          onClick: () => toast({ title: "消息通知", description: "功能开发中" }),
        },
        {
          icon: <Shield className="w-4 h-4 text-green-500" />,
          label: "账户安全",
          onClick: () => toast({ title: "账户安全", description: "功能开发中" }),
        },
        {
          icon: <Settings className="w-4 h-4 text-slate-500" />,
          label: "设置",
          onClick: () => toast({ title: "设置", description: "功能开发中" }),
        },
      ],
    },
    {
      title: "帮助与支持",
      items: [
        {
          icon: <HelpCircle className="w-4 h-4 text-purple-500" />,
          label: "帮助中心",
          onClick: () => toast({ title: "帮助中心", description: "功能开发中" }),
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

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* 顶部用户信息卡 */}
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

        {/* 使用统计 */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          {[
            { label: "已生成图片", value: "12" },
            { label: "本月使用", value: "5" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/15 rounded-xl py-2.5 text-center">
              <p className="text-white font-bold text-lg leading-none">{stat.value}</p>
              <p className="text-blue-100 text-xs mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 菜单卡片 */}
      <div className="flex-1 px-4 pt-4 pb-24 space-y-3">
        {menuGroups.map((group) => (
          <div key={group.title}>
            <p className="text-xs text-slate-400 font-medium mb-1.5 px-1">{group.title}</p>
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              {group.items.map((item, i) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 active:bg-slate-100 transition-colors text-left ${
                    i < group.items.length - 1 ? "border-b border-slate-100" : ""
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
                    {item.icon}
                  </div>
                  <span className="flex-1 text-sm text-slate-800">{item.label}</span>
                  {item.desc && (
                    <span className="text-xs text-slate-400 mr-1">{item.desc}</span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* 退出登录 */}
        <button
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="w-full bg-white rounded-2xl py-3.5 text-sm text-red-500 font-medium hover:bg-red-50 active:bg-red-100 transition-colors shadow-sm"
        >
          {logout.isPending ? "退出中…" : "退出登录"}
        </button>
      </div>

      {/* 底部导航 */}
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
