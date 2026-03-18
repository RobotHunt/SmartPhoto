// [2026-03-18 新增] 帮助中心页面
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function HelpCenter() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-white">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => history.back()}
          className="p-1.5 rounded-full hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h1 className="text-base font-semibold text-slate-900">帮助中心</h1>
      </div>

      {/* 正文内容 */}
      <div className="max-w-2xl mx-auto px-5 py-6 text-sm text-slate-700 leading-relaxed space-y-5">
        <section>
          <h2 className="font-semibold text-slate-900 mb-2">一、常见问题</h2>
          <p>
            <strong>Q：如何上传产品图片？</strong>
          </p>
          <p className="mt-1">
            A：在首页点击"开始制作"，选择或拍摄产品图片上传即可。
          </p>

          <p className="mt-3">
            <strong>Q：支持哪些电商平台？</strong>
          </p>
          <p className="mt-1">
            A：支持天猫、淘宝、京东、拼多多、亚马逊、1688、抖音电商、小红书等主流平台。
          </p>

          <p className="mt-3">
            <strong>Q：生成的图片可以商用吗？</strong>
          </p>
          <p className="mt-1">
            A：可以，付费后生成的高清无水印图片可直接用于电商上架。
          </p>

          <p className="mt-3">
            <strong>Q：如何申请退款？</strong>
          </p>
          <p className="mt-1">
            A：在"账户 &gt; 购买记录"中找到对应订单，点击"申请退款"。
          </p>

          <p className="mt-3">
            <strong>Q：生成图片需要多长时间？</strong>
          </p>
          <p className="mt-1">
            A：通常在30秒内完成生成。
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 mb-2">二、使用指南</h2>
          <p>第一步：上传产品图片</p>
          <p className="mt-2">第二步：AI自动识别产品并分析</p>
          <p className="mt-2">第三步：选择目标电商平台</p>
          <p className="mt-2">第四步：AI生成参数和策略</p>
          <p className="mt-2">第五步：预览并生成高清图</p>
          <p className="mt-2">第六步：生成详情页图片</p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 mb-2">三、联系我们</h2>
          <p>
            客服邮箱：<a href="mailto:support@smartphoto.vip" className="text-blue-600 underline">support@smartphoto.vip</a>
          </p>
          <p className="mt-2">
            工作时间：周一至周五 9:00-18:00
          </p>
        </section>

        <p className="text-xs text-slate-400 pt-4 border-t border-slate-100">
          © 2025 AI电商做图平台 版权所有
        </p>
      </div>
    </div>
  );
}
