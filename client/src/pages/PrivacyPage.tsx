import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
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
        <h1 className="text-base font-semibold text-slate-900">隐私政策</h1>
      </div>

      {/* 正文内容 */}
      <div className="max-w-2xl mx-auto px-5 py-6 text-sm text-slate-700 leading-relaxed space-y-5">
        <p className="text-xs text-slate-400">最后更新日期：2025年1月1日</p>

        <p>
          <strong>AI电商做图平台</strong>（以下简称"我们"）非常重视您的个人信息和隐私保护。本隐私政策说明我们如何收集、使用和保护您的信息。
        </p>

        <section>
          <h2 className="font-semibold text-slate-900 mb-2">一、我们收集的信息</h2>
          <p>
            1.1 <strong>账户信息</strong>：您通过第三方登录时，我们会获取您的基本账户信息（如昵称、头像）。
          </p>
          <p className="mt-2">
            1.2 <strong>上传图片</strong>：您上传的产品图片仅用于 AI 生成服务，我们不会将其用于其他任何目的。
          </p>
          <p className="mt-2">
            1.3 <strong>使用数据</strong>：我们会收集您的操作日志、生成记录等，用于改善服务质量。
          </p>
          <p className="mt-2">
            1.4 <strong>支付信息</strong>：支付由第三方支付平台处理，我们不存储您的银行卡或支付账户信息。
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 mb-2">二、信息的使用</h2>
          <p>
            我们使用收集的信息用于：提供和改善 AI 生成服务、处理您的订单和支付、向您发送服务通知、防止欺诈和滥用行为。
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 mb-2">三、信息的存储与保护</h2>
          <p>
            3.1 您上传的图片和生成的图片存储在安全的云存储服务中，我们采用加密传输和存储措施保护您的数据。
          </p>
          <p className="mt-2">
            3.2 上传的原始图片在生成完成后 30 天内自动删除，生成的图片永久保存供您下载。
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 mb-2">四、信息的共享</h2>
          <p>
            我们不会将您的个人信息出售给第三方。仅在以下情况下可能共享：经您明确同意、法律法规要求、保护平台和用户安全所必需。
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 mb-2">五、您的权利</h2>
          <p>
            您有权访问、更正、删除您的个人信息，以及撤回对信息处理的同意。如需行使上述权利，请通过平台客服联系我们。
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 mb-2">六、Cookie 使用</h2>
          <p>
            我们使用 Cookie 保持您的登录状态和偏好设置。您可以在浏览器设置中管理 Cookie，但这可能影响部分功能的使用。
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 mb-2">七、未成年人保护</h2>
          <p>
            本平台不面向 14 周岁以下未成年人提供服务。如发现未成年人使用本平台，请联系我们处理。
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 mb-2">八、联系我们</h2>
          <p>
            如您对本隐私政策有任何疑问或投诉，请通过平台客服渠道与我们联系，我们将在 15 个工作日内回复。
          </p>
        </section>

        <p className="text-xs text-slate-400 pt-4 border-t border-slate-100">
          © 2025 AI电商做图平台 版权所有
        </p>
      </div>
    </div>
  );
}
