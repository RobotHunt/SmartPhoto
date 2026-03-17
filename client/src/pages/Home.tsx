import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Search,
  ChevronDown,
  Upload,
  ShoppingBag,
  Sparkles,
  Check,
  Zap,
  Globe,
  TrendingUp,
  Shield,
  Home as HomeIcon,
  FolderOpen,
  User,
  LayoutGrid,
  FileText,
  Clock
} from "lucide-react";
import { Link, useLocation } from "wouter";

export default function Home() {
  const { user, loading } = useAuth();
  const [currentPath] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* 顶部导航栏 */}
      <nav className="bg-white text-slate-800 sticky top-0 z-50 border-b border-slate-100 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-lg text-slate-900">AI电商做图</span>
              </div>
            </Link>

            {/* 桌面端文字菜单 */}
            <div className="hidden md:flex items-center gap-6">
              <Link href="/">
                <span className="text-blue-500 font-medium cursor-pointer">主页</span>
              </Link>
              <Link href="/history">
                <span className="text-slate-500 hover:text-slate-800 transition-colors cursor-pointer">资产</span>
              </Link>
              {user && (
                <Link href="/history">
                  <span className="text-slate-500 hover:text-slate-800 transition-colors cursor-pointer">账户</span>
                </Link>
              )}
            </div>

            {/* 右侧操作区 */}
            <div className="flex items-center gap-2">
              {/* 桌面端显示搜索图标 */}
              <button className="hidden md:flex p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
                <Search className="w-5 h-5" />
              </button>
              {/* --- 原始代码（已注释）--- */}
              {/* [2026-03-16 静态化改造] 头像原指向 /profile（路由不存在），改为 /account；未登录分支原调 getLoginUrl()，改为 /create/upload */}
              {/*
              {user ? (
                <Link href="/profile">
                  <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center cursor-pointer hover:bg-blue-600 transition-colors">
                    <span className="text-white font-bold text-sm">
                      {(user.name || user.openId || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                </Link>
              ) : (
                <a href={getLoginUrl()}>
                  <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl">
                    登录
                  </Button>
                </a>
              )}
              */}
              {/* --- 新代码 --- */}
              {user ? (
                <Link href="/account">
                  <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center cursor-pointer hover:bg-blue-600 transition-colors">
                    <span className="text-white font-bold text-sm">
                      {(user.name || user.openId || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                </Link>
              ) : (
                <Link href="/create/upload">
                  <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl">
                    登录
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero区域 */}
      <section className="relative bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzPjxwYXR0ZXJuIGlkPSJncmlkIiB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPjxwYXRoIGQ9Ik0gNDAgMCBMIDAgMCAwIDQwIiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMTQ3LCAxOTcsIDI1MywgMC4xKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>

        {/* 手机端布局：竖向排列，首屏完整显示 */}
        <div className="md:hidden container mx-auto px-5 pt-8 pb-6 relative">
          <div className="flex flex-col gap-5">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-slate-900 leading-snug">
                产品实拍图，<br />
                生成全平台电商主图 & 详情图
              </h1>
              <p className="text-sm text-slate-500">拍照上传一键生成· 平台选图配文</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/create/upload">
                <Button className="bg-blue-500 hover:bg-blue-600 text-white px-6 rounded-xl shadow-md">
                  立即生成 <Sparkles className="w-4 h-4 ml-1.5" />
                </Button>
              </Link>
              <Button variant="outline" className="px-5 rounded-xl border border-slate-200 bg-white/70"
                onClick={() => document.getElementById('steps-section')?.scrollIntoView({ behavior: 'smooth' })}>
                请前往查看 <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-700 mb-2">生成效果示例</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-slate-100 h-36">
                    <img src="/examples/air-purifier-white.jpg" alt="原图" className="w-full h-full object-contain p-2" />
                  </div>
                  <div className="mt-1.5 text-sm font-medium text-slate-700">原图</div>
                  <button className="mt-0.5 text-xs text-slate-400 flex items-center gap-0.5">请前往查看 <span>&rsaquo;</span></button>
                </div>
                <div>
                  <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-100 h-36">
                    <img src="/examples/air-purifier.jpg" alt="效果图" className="w-full h-full object-cover" />
                  </div>
                  <div className="mt-1.5 text-sm font-medium text-slate-700 flex items-center gap-0.5">效果图 <span className="text-slate-400 text-xs">&rsaquo;</span></div>
                  <button className="mt-0.5 text-xs text-slate-400 flex items-center gap-0.5">请前往查看 <span>&rsaquo;</span></button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 桌面端布局：原来的左右两栏 */}
        <div className="hidden md:block container mx-auto px-4 py-16 md:py-24 relative">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900 leading-tight">
                产品实拍图，<br />
                生成全平台电商主图 & 详情图
              </h1>
              <p className="text-lg text-slate-600">拍照上传一键生成· 平台选图配文</p>
              <div className="flex flex-wrap gap-4">
                <Link href="/create/upload">
                  <Button size="lg" className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-6 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all">
                    立即生成 <Sparkles className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="px-8 py-6 text-lg rounded-xl border-2 hover:bg-white/50"
                  onClick={() => document.getElementById('steps-section')?.scrollIntoView({ behavior: 'smooth' })}>
                  请前往查看 <ChevronDown className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
            <div>
              <div className="text-base font-semibold text-slate-800 mb-3">生成效果示例</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-slate-100">
                    <img src="/examples/air-purifier-white.jpg" alt="原图" className="w-full aspect-square object-contain p-3" />
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-700">原图</div>
                  <button className="mt-1 text-xs text-slate-400 flex items-center gap-0.5">请前往查看 <span>&rsaquo;</span></button>
                </div>
                <div>
                  <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                    <img src="/examples/air-purifier.jpg" alt="效果图" className="w-full aspect-square object-cover" />
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-700 flex items-center gap-0.5">效果图 <span className="text-slate-400 text-xs">&rsaquo;</span></div>
                  <button className="mt-1 text-xs text-slate-400 flex items-center gap-0.5">请前往查看 <span>&rsaquo;</span></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 简单3步流程 - 明亮浅色背景 */}
      <section id="steps-section" className="bg-slate-50 text-slate-900 py-8">
        <div className="container mx-auto px-4">
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold mb-1 text-slate-900">
              简单<span className="text-blue-500">3</span>步，让做图变简单
            </h2>
            <p className="text-slate-500 text-sm">
              为中国智造一键出图
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {/* 步骤1 */}
            <Card className="bg-white border-slate-200 p-3 hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  1
                </div>
                <h3 className="text-sm font-bold text-slate-900">上传产品实拍图</h3>
              </div>
              <p className="text-xs text-slate-500 mb-1.5">最佳 3 张，首 1 张效果明显</p>
              <div className="grid grid-cols-3 gap-1">
                <div className="aspect-square rounded-lg overflow-hidden bg-slate-50">
                  <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663275834844/FqDWyGWuKYUEGqpy3yF7qj/pur_angle1_f3ae9cf5.jpg" alt="正面图" className="w-full h-full object-cover" />
                </div>
                <div className="aspect-square rounded-lg overflow-hidden bg-slate-50">
                  <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663275834844/FqDWyGWuKYUEGqpy3yF7qj/pur_angle2_a47629a3.jpg" alt="俧面图" className="w-full h-full object-cover" />
                </div>
                <div className="aspect-square rounded-lg overflow-hidden bg-slate-50">
                  <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663275834844/FqDWyGWuKYUEGqpy3yF7qj/pur_angle3_5d0e30e9.jpg" alt="反面图" className="w-full h-full object-cover" />
                </div>
              </div>
            </Card>

            {/* 步骤2 */}
            <Card className="bg-white border-slate-200 p-3 hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  2
                </div>
                <h3 className="text-sm font-bold text-slate-900">选择平台与类型</h3>
              </div>
              <p className="text-xs text-slate-500 mb-1.5">按照平台标准规范精准生图</p>
              <div className="space-y-1">
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { name: '1688', logo: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663275834844/FqDWyGWuKYUEGqpy3yF7qj/1688_31c661d3.png' },
                    { name: '阿里国际站', logo: '/platforms/alibaba-intl.jpg' },
                    { name: '淘宝', logo: '/platforms/taobao.png' },
                    { name: '抖音', logo: '/platforms/douyin.png' },
                    { name: 'TikTok', logo: '/platforms/tiktok.png' },
                    { name: '京东', logo: '/platforms/jd.png' },
                    { name: '拼多多', logo: '/platforms/pdd.png' },
                    { name: 'Temu', logo: '/platforms/temu.jpg' },
                    { name: '小红书', logo: '/platforms/xiaohongshu.png' },
                    { name: '亚马逊', logo: '/platforms/amazon.png' },
                    { name: '官网自定义', logo: null },
                    { name: '自定义', logo: 'plus', isCustom: true },
                  ].map((platform) => (
                    <div
                      key={platform.name}
                      className="aspect-square bg-slate-50 rounded-lg flex items-center justify-center p-1.5 relative"
                    >
                      <div className="text-center w-full">
                        {platform.logo === 'plus' ? (
                          <div className="w-6 h-6 mx-auto mb-0.5 border-2 border-dashed border-slate-400 rounded flex items-center justify-center">
                            <span className="text-sm text-slate-600">+</span>
                          </div>
                        ) : platform.logo ? (
                          <img
                            src={platform.logo}
                            alt={platform.name}
                            className="w-6 h-6 mx-auto mb-0.5 object-contain"
                          />
                        ) : (
                          <div className="w-6 h-6 mx-auto mb-0.5 bg-gradient-to-br from-purple-400 to-pink-400 rounded flex items-center justify-center">
                            <Globe className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <div className="text-[9px] text-slate-700 font-medium leading-tight">{platform.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Check className="w-3 h-3 text-blue-500" />按平台标准出图</span>
                  <span className="flex items-center gap-1"><Check className="w-3 h-3 text-blue-500" />支挆11+平台</span>
                </div>
              </div>
            </Card>

            {/* 步骤3 */}
            <Card className="bg-white border-slate-200 p-3 hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  3
                </div>
                <h3 className="text-sm font-bold text-slate-900">智能生成主图与详情</h3>
              </div>
              <div className="space-y-1.5">
                <div className="aspect-[4/3] bg-gradient-to-br from-blue-50 to-sky-50 rounded-lg p-2 relative">
                  <div className="absolute top-1.5 right-1.5 bg-yellow-400 text-slate-900 text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                    AI生成
                  </div>
                  <div className="h-full flex flex-col gap-1">
                    <div>
                      <div className="text-xs font-bold text-slate-900">产品名称</div>
                      <div className="text-[10px] text-slate-500">产品特点描述...</div>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                      <img
                        src="https://d2xsxph8kpxj0f.cloudfront.net/310519663275834844/FqDWyGWuKYUEGqpy3yF7qj/pur_angle2_a47629a3.jpg"
                        alt="AI生成效果图"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Check className="w-3 h-3 text-blue-500" />专属图片智能生成</span>
                  <span className="flex items-center gap-1"><Check className="w-3 h-3 text-blue-500" />平台规范精准出图</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* 能力亮点 */}
      <section className="py-10 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">我们的亮点</h2>
            <p className="text-sm text-slate-500">智能文案，精准生图，图片可再编辑</p>
          </div>

          <div className="max-w-lg mx-auto divide-y divide-slate-100">
            {[
              { icon: <Sparkles className="w-5 h-5 text-slate-600" />, title: '智能批量生成', desc: '批量处理产品图，智能生成多平台适配图片，提高工作效獱0倍以上' },
              { icon: <LayoutGrid className="w-5 h-5 text-slate-600" />, title: '全平台一键适配', desc: '支持全平台图片规格，一键生成符合各平台要求的标准图片' },
              { icon: <FileText className="w-5 h-5 text-slate-600" />, title: '提供各类指南', desc: '根据产品特点和平台特性，智能推荐最佳图片方案' },
              { icon: <Clock className="w-5 h-5 text-slate-600" />, title: '流程提交管理', desc: '完整的历史记录管理，随时查看和下载已生成的图片' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4 py-5">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  {item.icon}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-0.5">{item.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 示例展示 */}
      <section className="py-20 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">AI 电商做图核心亮点</h2>
            <p className="text-slate-600 text-lg">
              覆盖主流电商平台，从主图到详情页，一站式生成专业产品图
            </p>
          </div>

          <div className="space-y-12">
            {/* 阿里巴巴案例 */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                  <img src="/platforms/1688.png" alt="1688" className="w-8 h-8 object-contain" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">1688 / 阿里巴巴</h3>
                  <p className="text-slate-600">主图示例 · 详情图示例</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="aspect-square bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-shadow">
                  <img src="/case-1688-1.png" alt="空气净化器原图" className="w-full h-full object-contain p-2" />
                </div>
                <div className="aspect-square bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-shadow">
                  <img src="/case-1688-2.jpg" alt="静音运行卖点" className="w-full h-full object-cover" />
                </div>
                <div className="aspect-square bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-shadow">
                  <img src="/case-1688-3.jpg" alt="空气质量显示" className="w-full h-full object-cover" />
                </div>
                <div className="aspect-square bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-shadow">
                  <img src="/case-1688-4.jpg" alt="滤网系统" className="w-full h-full object-cover" />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">主图</span>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">详情图</span>
                </div>
                <Button variant="outline" size="sm">
                  查看更多案例
                </Button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* CTA区域 */}
      <section className="py-20 bg-gradient-to-br from-blue-600 to-blue-700 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">立即开始，让AI为你的产品赋能</h2>
          <p className="text-xl text-blue-100 mb-8">助力中国智造，让中国智造走向世界</p>
          {/* --- 原始代码（已注释）--- */}
          {/* [2026-03-16 静态化改造] 静态模式下始终跳转到 upload，不判断登录状态 */}
          {/* <Link href={user ? "/create/upload" : getLoginUrl()}> */}
          {/* --- 新代码 --- */}
          <Link href="/create/upload">
            <Button size="lg" variant="secondary" className="text-lg px-8 py-6">
              开始使用 <Sparkles className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-100 text-slate-500 py-12 border-t border-slate-200">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-6 h-6 text-blue-500" />
                <span className="text-slate-800 font-bold text-lg">AI电商做图</span>
              </div>
              <p className="text-sm">为中国智造一键出图，让电商运营更简单</p>
            </div>
            <div>
              <h4 className="text-slate-700 font-semibold mb-4">支持平台</h4>
              <ul className="space-y-2 text-sm">
                <li>1688 / 阿里国际站</li>
                <li>淘宝 / 天猫 / 京东</li>
                <li>抖音 / 拼多多 / Temu</li>
                <li>亚马逊 / TikTok / 小红书</li>
              </ul>
            </div>
          </div>

        </div>
      </footer>
      {/* 底部固定Tab导航栏 */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100 shadow-[0_-1px_8px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-4">
          <Link href="/">
            <button className={`flex flex-col items-center gap-1 px-6 py-2 transition-colors ${currentPath === '/' ? 'text-blue-500' : 'text-slate-400 hover:text-slate-600'
              }`}>
              <HomeIcon className="w-5 h-5" />
              <span className="text-xs font-medium">主页</span>
            </button>
          </Link>
          <Link href="/history">
            <button className={`flex flex-col items-center gap-1 px-6 py-2 transition-colors ${currentPath === '/history' ? 'text-blue-500' : 'text-slate-400 hover:text-slate-600'
              }`}>
              <FolderOpen className="w-5 h-5" />
              <span className="text-xs font-medium">资产</span>
            </button>
          </Link>
          <Link href="/account">
            <button className={`flex flex-col items-center gap-1 px-6 py-2 transition-colors ${currentPath === '/account' ? 'text-blue-500' : 'text-slate-400 hover:text-slate-600'
              }`}>
              <User className="w-5 h-5" />
              <span className="text-xs font-medium">账户</span>
            </button>
          </Link>
        </div>
      </nav>
      {/* 底部导航栏占位，防止内容被遗盖 */}
      <div className="h-16" />
    </div>
  );
}
