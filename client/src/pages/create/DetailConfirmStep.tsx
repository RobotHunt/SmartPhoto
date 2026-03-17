import { useLocation } from "wouter";
import { Sparkles, RefreshCw, Pencil } from "lucide-react";
import { CheckCircle2 } from "lucide-react";
import { DetailStepIndicator } from "./DetailResultStep";

// 6个详情图模块（带水印预览）
const MOCK_THUMBNAILS = [
  { id: 1, label: "产品展示", url: "/examples/air-purifier.jpg" },
  { id: 2, label: "核心卖点", url: "/examples/air-purifier-white.jpg" },
  { id: 3, label: "功能说明", url: "/examples/2.jpg" },
  { id: 4, label: "产品细节", url: "/examples/3.jpg" },
  { id: 5, label: "使用场景", url: "/examples/4.jpg" },
  { id: 6, label: "产品参数", url: "/examples/air-purifier.jpg" },
];

export default function DetailConfirmStep() {
  const [, setLocation] = useLocation();

  const handlePay = () => {
    setLocation("/create/detail-result");
  };

  const handleBack = () => {
    setLocation("/create/copywriting");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <DetailStepIndicator currentStep={2} />

      {/* 顶部状态栏 */}
      <div className="bg-white border-b px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-slate-800">已生成 {MOCK_THUMBNAILS.length} 张详情图</span>
        </div>
        <button
          onClick={handleBack}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-full px-2.5 py-1 transition"
        >
          <RefreshCw className="w-3 h-3" />
          重新生成
        </button>
      </div>
      <p className="px-4 py-1.5 text-xs text-slate-400 bg-white border-b">预览图含水印，付费后生成高清详情图</p>

      {/* 图片列表 */}
      <div className="flex-1 overflow-y-auto pb-28">
        {MOCK_THUMBNAILS.map((img) => (
          <div key={img.id} className="bg-white border-b">

            {/* 图片区域（带水印） */}
            <div
              className="relative select-none"
              onContextMenu={(e) => e.preventDefault()}
            >
              <img
                src={img.url}
                alt={img.label}
                // [2026-03-17 修复] 原: className="w-full object-cover ..." style={{ maxHeight: "400px" }} — 图片被裁剪只显示一部分
                className="w-full object-contain pointer-events-none"
                draggable={false}
              />
              {/* 水印层 */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div
                  className="text-white/25 font-bold text-xl select-none"
                  style={{
                    transform: "rotate(-30deg)",
                    textShadow: "0 1px 4px rgba(0,0,0,0.4)",
                    letterSpacing: "0.08em",
                    whiteSpace: "nowrap",
                  }}
                >
                  AI电商做图 · 预览版
                </div>
              </div>
            </div>

            {/* 底部操作行 */}
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-sm text-slate-500">{img.label}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1 text-xs text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-full px-2.5 py-1 transition"
                >
                  <Pencil className="w-3 h-3" />
                  编辑文字
                </button>
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1 text-xs text-slate-500 border border-slate-200 rounded-full px-2.5 py-1 hover:bg-slate-50 transition"
                >
                  <RefreshCw className="w-3 h-3" />
                  重新生成
                </button>
              </div>
            </div>

          </div>
        ))}
      </div>

      {/* 底部固定操作栏 */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t shadow-lg px-4 py-3">
        <button
          onClick={handlePay}
          className="w-full h-12 rounded-2xl flex items-center justify-center gap-2 text-base font-bold bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-200 transition"
        >
          <Sparkles className="w-5 h-5" />
          生成无水印高清图
        </button>
        <p className="text-center text-xs text-slate-400 mt-1.5">共 {MOCK_THUMBNAILS.length} 张，确认后全部生成</p>
      </div>
    </div>
  );
}
