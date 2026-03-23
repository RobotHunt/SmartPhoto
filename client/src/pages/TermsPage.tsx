import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function TermsPage() {
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
        <h1 className="text-base font-semibold text-slate-900">用户协议</h1>
      </div>

      {/* 正文内容 */}
      <div className="max-w-2xl mx-auto px-5 py-6 text-sm text-slate-700 leading-relaxed space-y-5">
        <p className="text-xs text-slate-400">最后更新日期：2025年1月1日</p>

        <p>
          欢迎使用 <strong>AI电商做图平台</strong>（以下简称"本平台"）。请您在使用本平台服务前，仔细阅读并充分理解本协议的全部内容。
        </p>

        <section>
          <h2 className="font-semibold text-slate-900 mb-2">一、服务说明</h2>
          <p>
            本平台提供基于人工智能技术的电商产品图片生成服务，包括但不限于：AI生成主图、更改风格、AI优化图片、无水印高清图下载等功能。
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 mb-2">二、用户权利与义务</h2>
          <p>
            2.1 您上传的产品图片须为您合法拥有或经授权使用的图片，不得侵犯他人知识产权。
          </p>
          <p className="mt-2">
            2.2 您不得将本平台生成的图片用于任何违法、违规或侵权用途。
          </p>
          <p className="mt-2">
            2.3 本平台生成的图片版权归您所有，您可自由用于合法的商业用途。
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 mb-2">三、付费与退款</h2>
          <p>
            3.1 本平台采用按套付费模式，新用户首套优惠价 ¥69，后续续费 ¥99/套。
          </p>
          <p className="mt-2">
            3.2 一经支付成功并生成高清图，原则上不支持退款。如因平台技术原因导致无法正常生成，可联系客服申请退款。
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 mb-2">四、免责声明</h2>
          <p>
            4.1 本平台基于 AI 技术生成图片，生成结果可能存在偏差，本平台不对生成效果作出任何明示或暗示的保证。
          </p>
          <p className="mt-2">
            4.2 因不可抗力、网络故障等原因导致的服务中断，本平台不承担责任。
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 mb-2">五、协议修改</h2>
          <p>
            本平台有权随时修改本协议内容。修改后的协议将在平台公告后生效，继续使用本平台即视为接受修改后的协议。
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 mb-2">六、联系我们</h2>
          <p>
            如您对本协议有任何疑问，请通过平台客服渠道与我们联系。
          </p>
        </section>

        <p className="text-xs text-slate-400 pt-4 border-t border-slate-100">
          © 2025 AI电商做图平台 版权所有
        </p>
      </div>
    </div>
  );
}
