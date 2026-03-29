import { useMemo } from "react";
import { Link, useLocation } from "wouter";
import {
  User,
  LogOut,
  ChevronRight,
  Image,
  Clock,
  Settings,
  HelpCircle,
  MessageSquare,
  Home,
  FolderOpen,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getLoginUrl } from "@/const";
import { getSessionHistory } from "@/lib/localUser";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function Account() {
  const { user, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();

  /* ---------- stats from local session history ---------- */
  const stats = useMemo(() => {
    const history = getSessionHistory();
    let totalImages = 0;
    history.forEach((s: any) => {
      totalImages += s.imageCount ?? s.image_count ?? 0;
    });
    return { totalSessions: history.length, totalImages };
  }, []);

  /* ---------- handle logout ---------- */
  const handleLogout = () => {
    logout();
    navigate("/");
  };

  /* ================================================================ */
  /*  Not authenticated                                                */
  /* ================================================================ */

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        {/* header */}
        <div className="bg-white px-4 pt-12 pb-6 text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-slate-300" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">
            登录后查看本地资料
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            登录后可在当前浏览器保存本地资料和历史记录，不依赖后端账户。
          </p>
          <a
            href={getLoginUrl()}
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-8 py-2.5 rounded-xl transition"
          >
            登录 / 注册
          </a>
        </div>

        {/* menu items */}
        <div className="mt-3 bg-white">
          <MenuItem icon={HelpCircle} label="帮助中心" />
          <MenuItem icon={MessageSquare} label="意见反馈" />
          <MenuItem icon={Settings} label="设置" last />
        </div>

        {/* bottom nav */}
        <BottomNav />
      </div>
    );
  }

  /* ================================================================ */
  /*  Authenticated                                                    */
  /* ================================================================ */

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* profile header */}
      <div className="bg-white px-4 pt-12 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center shrink-0">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt="avatar"
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <User className="w-8 h-8 text-blue-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900 truncate">
              {user?.nickname || "本地用户"}
            </h2>
            <p className="text-sm text-slate-500 truncate">
              {user?.phone || "资料仅保存在当前浏览器"}
            </p>
          </div>
        </div>
      </div>

      {/* stats */}
      <div className="bg-white mt-px px-4 py-4">
        <div className="flex items-center justify-around">
          <div className="text-center">
            <p className="text-xl font-bold text-slate-900">
              {stats.totalImages}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">生成图片</p>
          </div>
          <div className="w-px h-8 bg-slate-100" />
          <div className="text-center">
            <p className="text-xl font-bold text-slate-900">
              {stats.totalSessions}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">创建次数</p>
          </div>
        </div>
      </div>

      {/* menu items */}
      <div className="mt-3 bg-white">
        <Link href="/history">
          <MenuItem icon={Image} label="我的图片" />
        </Link>
        <Link href="/history">
          <MenuItem icon={Clock} label="历史记录" last />
        </Link>
      </div>

      <div className="mt-3 bg-white">
        <MenuItem icon={HelpCircle} label="帮助中心" />
        <MenuItem icon={MessageSquare} label="意见反馈" />
        <MenuItem icon={Settings} label="设置" last />
      </div>

      {/* logout */}
      <div className="mt-3 bg-white">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-red-500 hover:bg-red-50 transition"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">退出本地登录</span>
        </button>
      </div>

      {/* bottom nav */}
      <BottomNav />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MenuItem                                                           */
/* ------------------------------------------------------------------ */

function MenuItem({
  icon: Icon,
  label,
  last = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition ${
        last ? "" : "border-b border-slate-100"
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-slate-400" />
        <span className="text-sm text-slate-700">{label}</span>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  BottomNav                                                          */
/* ------------------------------------------------------------------ */

function BottomNav() {
  const [location] = useLocation();

  const tabs = [
    { label: "首页", href: "/", icon: Home },
    { label: "资产", href: "/history", icon: FolderOpen },
    { label: "账户", href: "/account", icon: User },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex items-center justify-around py-2 z-40">
      {tabs.map((tab) => {
        const active = location === tab.href;
        return (
          <Link key={tab.href} href={tab.href}>
            <div className="flex flex-col items-center gap-0.5 min-w-[56px]">
              <tab.icon
                className={`w-5 h-5 ${
                  active ? "text-blue-500" : "text-slate-400"
                }`}
              />
              <span
                className={`text-xs ${
                  active
                    ? "text-blue-500 font-medium"
                    : "text-slate-400"
                }`}
              >
                {tab.label}
              </span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
