import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Link } from "wouter";
import {
  Search, MoreHorizontal, ImageIcon,
  Home, FolderOpen, User, PackageOpen
} from "lucide-react";
import { getLoginUrl } from "@/const";
import { useToast } from "@/hooks/use-toast";
import { createPortal } from "react-dom";
import { getSessionHistory, type SessionRecord } from "@/lib/localUser";
import { Button } from "@/components/ui/button";

// ── 筛选标签 ──────────────────────────────────────────────
const FILTER_TABS = ["全部", "平台", "图片类型", "风格", "品牌"];

// 单个商品卡片
function AssetCard({ record }: { record: SessionRecord }) {
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const openMenu = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.top, right: window.innerWidth - rect.right });
    }
    setMenuOpen(true);
  };

  const handleDownload = () => {
    toast({ title: "功能开发中", description: "下载功能即将上线" });
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
    } catch {
      return iso;
    }
  };

  // 展示缩略图（只有一张 thumbnail）
  const thumbs = [
    record.thumbnail_url || null,
    null,
    null,
  ];

  return (
    <div className="glass-panel text-slate-700 rounded-[24px] p-4 mx-4 md:mx-auto max-w-2xl mb-4 border border-slate-200 shadow-sm transition-all hover:shadow-md">
      {/* 顶部：日期 + 三点菜单 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-700">{formatDate(record.created_at)}</span>
        <div className="relative">
          <button
            ref={btnRef}
            onClick={openMenu}
            className="text-slate-500 hover:text-slate-900 active:scale-95 transition-all p-0.5"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && createPortal(
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div
                className="fixed z-50 bg-white rounded-xl shadow-xl border border-slate-100 py-1 min-w-[120px]"
                style={{ top: menuPos.top + 20, right: menuPos.right }}
              >
                <button
                  onClick={() => { setMenuOpen(false); handleDownload(); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 active:bg-slate-200"
                >
                  批量下载
                </button>
              </div>
            </>,
            document.body
          )}
        </div>
      </div>

      {/* 平台 & 步骤信息行 */}
      <p className="text-xs text-slate-500 mb-3">
        平台：{record.platform || "未知"} &middot; {record.last_step || "未知步骤"}
      </p>

      {/* 标签行 */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mb-3">
        <span className="flex-shrink-0 flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-blue-50 text-blue-600 border border-blue-200">
          {record.product_name || "未命名"}
        </span>
        {record.image_count > 0 && (
          <span className="flex-shrink-0 flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-600 border border-slate-200">
            {record.image_count} 张图片
          </span>
        )}
      </div>

      {/* 三张等宽缩略图 */}
      <div className="flex gap-1.5 mb-2.5" style={{ height: 90 }}>
        {thumbs.map((img, idx) => (
          <div
            key={idx}
            className="flex-1 rounded-xl overflow-hidden bg-white/80 border border-slate-200 flex items-center justify-center relative"
          >
            {img ? (
              <img src={img} alt="" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="w-5 h-5 text-slate-600" />
            )}
            {/* 最后一张显示 +N 角标 */}
            {idx === 2 && record.image_count > 3 && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-xl">
                <span className="text-slate-900 text-sm font-bold">+{record.image_count - 3}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 底部操作行 */}
      <div className="flex gap-2">
        <button
          onClick={() => toast({ title: "功能开发中", description: "查看全部图片功能即将上线" })}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-sm text-slate-600 hover:bg-slate-200 active:bg-white/20 transition-colors"
        >
          查看全部
          <span className="text-slate-500">&rsaquo;</span>
        </button>
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-sm text-slate-600 hover:bg-slate-200 active:bg-white/20 transition-colors"
        >
          下载
          <span className="text-base leading-none">↓</span>
        </button>
      </div>
    </div>
  );
}

// ── 主页面 ────────────────────────────────────────────────
export default function History() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [activeFilter, setActiveFilter] = useState("全部");
  const [searchQuery, setSearchQuery] = useState("");

  // 未登录：引导登录
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 px-6">
        <div className="text-center py-20 glass-panel border-slate-200 rounded-3xl mx-4">
          <PackageOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-700 mb-2">暂无历史记录</h2>
          <p className="text-slate-500 mb-8 max-w-sm mx-auto">
            您还没有生成过任何商品图片，快去体验一下强大的 AI 视觉创作吧。
          </p>
          <Button
            onClick={() => setLocation("/")}
            className="sci-fi-button px-8 py-6 rounded-full text-lg shadow-md"
          >
            开始创作
          </Button>
        </div>
      </div>
    );
  }

  // 读取 localStorage session 历史
  const sessions = getSessionHistory();

  // 按平台筛选
  const afterPlatformFilter = activeFilter === "全部"
    ? sessions
    : activeFilter === "平台"
      ? sessions
      : sessions;

  // 搜索过滤
  const filtered = afterPlatformFilter.filter((r) =>
    r.product_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen aurora-bg flex flex-col">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-50 glass-panel border-b border-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.05)] pl-8 pr-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-xl flex items-center justify-center">
              <FolderOpen className="w-4 h-4 text-slate-900" />
            </div>
            <h1 className="text-base font-bold text-slate-900">我的资产</h1>
          </div>
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-slate-900 text-xs font-bold">
            <h1 className="ml-4 text-lg md:text-xl font-bold text-slate-900 tracking-wide">
              历史创作
            </h1>
          </div>
          <div className="flex gap-2">
            <div className="bg-white/80 backdrop-blur-md rounded-2xl p-1 border border-slate-200 hidden md:flex min-w-[200px]">
              {(["create", "history"] as const).map((tab) => (
                <button
                  key={tab}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                    tab === "history"
                      ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 筛选标签 */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 font-medium transition-colors ${
                activeFilter === tab
                  ? "text-blue-500 border-b-2 border-blue-500 pb-1"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="搜索商品名称..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-100 rounded-full text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
      </div>

      {/* 卡片列表 */}
      <div className="flex-1 px-4 pt-4 pb-24 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <ImageIcon className="w-12 h-12 text-slate-600" />
            <p className="text-sm text-slate-500">还没有生成过图片</p>
          </div>
        ) : (
          filtered.map((record) => <AssetCard key={record.session_id} record={record} />)
        )}
      </div>

      {/* 底部导航 */}
      <div className="fixed bottom-0 left-0 right-0 glass-panel border-t border-slate-200/50 flex z-20">
        <Link
          href="/"
          className="flex-1 flex flex-col items-center py-2.5 gap-0.5 text-slate-500 hover:text-slate-600"
        >
          <Home className="w-5 h-5" />
          <span className="text-xs">首页</span>
        </Link>
        <Link
          href="/history"
          className="flex-1 flex flex-col items-center py-2.5 gap-0.5 text-blue-500"
        >
          <FolderOpen className="w-5 h-5" />
          <span className="text-xs font-medium">资产</span>
        </Link>
        <Link
          href="/account"
          className="flex-1 flex flex-col items-center py-2.5 gap-0.5 text-slate-500 hover:text-slate-600"
        >
          <User className="w-5 h-5" />
          <span className="text-xs">账户</span>
        </Link>
      </div>
    </div>
  );
}
