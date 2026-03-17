import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import {
  Search, MoreHorizontal, ImageIcon,
  Home, FolderOpen, User
} from "lucide-react";
import { getLoginUrl } from "@/const";
import { useToast } from "@/hooks/use-toast";
import { createPortal } from "react-dom";

// ── 模拟数据 ──────────────────────────────────────────────
const MOCK_ASSETS = [
  {
    id: "1",
    name: "空气净化器",
    date: "2024.04.25",
    style: "北欧风",
    platform: "阿里巴巴",
    brand: "无",
    tags: ["原图", "主图", "详情图", "白底图"],
    images: [
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663275834844/FqDWyGWuKYUEGqpy3yF7qj/yELYX870fsiK_920cb20d.jpg",
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663275834844/FqDWyGWuKYUEGqpy3yF7qj/ffMawZalnb0G_dbc5616c.jpg",
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663275834844/FqDWyGWuKYUEGqpy3yF7qj/UVgsVEUsYXeg_f91173e1.jpg",
    ],
  },
  {
    id: "2",
    name: "不锈钢面包机",
    date: "2024.04.24",
    style: "极简风",
    platform: "天猫",
    brand: "无",
    tags: ["原图", "主图", "详情图", "白底图"],
    images: [null, null, null],
  },
];

const FILTER_TABS = ["全部", "平台", "图片类型", "风格", "品牌"];

// 模拟每个标签对应的图片数量
const TAG_COUNTS: Record<string, number> = {
  "原图": 1,
  "主图": 3,
  "详情图": 1,
  "白底图": 1,
};

// 模拟每个标签对应的图片（实际项目中应从数据库读取）
const EXTRA_COUNT = 5; // 超出3张的额外图片数

// 单个商品卡片
function AssetCard({ asset }: { asset: typeof MOCK_ASSETS[0] }) {
  const validImages = asset.images.filter(Boolean) as string[];
  const { toast } = useToast();
  const [activeTag, setActiveTag] = useState(asset.tags[1] ?? asset.tags[0]); // 默认选中主图
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
    if (validImages.length === 0) {
      toast({ title: "暂无可下载的图片" });
      return;
    }
    validImages.forEach((url, i) => {
      setTimeout(() => {
        const link = document.createElement("a");
        link.href = url;
        link.download = `${asset.name}_${i + 1}.jpg`;
        link.target = "_blank";
        link.click();
      }, i * 300);
    });
    toast({ title: "下载已开始", description: `共 ${validImages.length} 张图片正在下载…` });
  };

  // 展示3张缩略图
  const thumbs = [
    validImages[0] ?? null,
    validImages[1] ?? null,
    validImages[2] ?? null,
  ];

  return (
    <div className="bg-white rounded-2xl p-3.5 mb-3 shadow-sm">
      {/* 顶部：日期 + 三点菜单 */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-slate-800">{asset.date}</span>
        <div className="relative">
          <button
            ref={btnRef}
            onClick={openMenu}
            className="text-slate-400 hover:text-slate-600 active:scale-95 transition-all p-0.5"
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
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 active:bg-slate-100"
                >
                  批量下载
                </button>
              </div>
            </>,
            document.body
          )}
        </div>
      </div>

      {/* 平台 & 品牌信息行 */}
      <p className="text-xs text-slate-400 mb-2.5">
        平台：{asset.platform} &middot; {asset.brand === "无" ? "无品牌" : asset.brand}
      </p>

      {/* 标签行（带数量，可切换） */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar mb-2.5">
        {asset.tags.map((tag) => {
          const count = TAG_COUNTS[tag] ?? 0;
          const isActive = tag === activeTag;
          return (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`flex-shrink-0 flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                isActive
                  ? "bg-blue-500 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tag}
              {count > 0 && <span className={isActive ? "text-blue-100" : "text-slate-400"}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* 三张等宽缩略图 */}
      <div className="flex gap-1.5 mb-2.5" style={{ height: 90 }}>
        {thumbs.map((img, idx) => (
          <div
            key={idx}
            className="flex-1 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center relative"
          >
            {img ? (
              <img src={img} alt="" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="w-5 h-5 text-slate-300" />
            )}
            {/* 最后一张显示 +N 角标 */}
            {idx === 2 && EXTRA_COUNT > 0 && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl">
                <span className="text-white text-sm font-bold">+{EXTRA_COUNT}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 底部操作行 */}
      <div className="flex gap-2">
        <button
          onClick={() => toast({ title: "功能开发中", description: "查看全部图片功能即将上线" })}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 active:bg-slate-100 transition-colors"
        >
          查看全部
          <span className="text-slate-400">&rsaquo;</span>
        </button>
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 active:bg-slate-100 transition-colors"
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
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeFilter, setActiveFilter] = useState("全部");
  const [searchQuery, setSearchQuery] = useState("");

  // 未登录：引导登录
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-2">
          <FolderOpen className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">登录后查看资产</h2>
        <p className="text-sm text-slate-500 text-center">登录账号，自动保存你的设计资产，避免图片丢失</p>
        <a
          href={getLoginUrl()}
          className="mt-2 px-8 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-full transition-colors"
        >
          登录 / 注册
        </a>
      </div>
    );
  }

  const filtered = MOCK_ASSETS.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* 顶部标题栏 */}
      <div className="bg-white px-4 pt-5 pb-3 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-xl flex items-center justify-center">
              <FolderOpen className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-base font-bold text-slate-900">我的资产</h1>
          </div>
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
            {user.name?.[0]?.toUpperCase() ?? "S"}
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
            <ImageIcon className="w-12 h-12 text-slate-300" />
            <p className="text-sm text-slate-400">暂无匹配的资产</p>
          </div>
        ) : (
          filtered.map((asset) => <AssetCard key={asset.id} asset={asset} />)
        )}
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
        <button className="flex-1 flex flex-col items-center py-2.5 gap-0.5 text-blue-500">
          <FolderOpen className="w-5 h-5" />
          <span className="text-xs font-medium">资产</span>
        </button>
        <button
          className="flex-1 flex flex-col items-center py-2.5 gap-0.5 text-slate-400 hover:text-slate-600"
          onClick={() => setLocation("/account")}
        >
          <User className="w-5 h-5" />
          <span className="text-xs">账户</span>
        </button>
      </div>
    </div>
  );
}
