import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Check, Pause, Play, ShoppingBag } from "lucide-react";

export default function StrategyStep() {
  const [, setLocation] = useLocation();
  const [countdown, setCountdown] = useState(5);
  const [isAutoStart, setIsAutoStart] = useState(true);

  useEffect(() => {
    if (isAutoStart && countdown === 0) {
      setLocation("/create/result");
    }
  }, [isAutoStart, countdown, setLocation]);

  useEffect(() => {
    if (!isAutoStart || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isAutoStart, countdown]);

  const handleModify = () => { setIsAutoStart(false); setLocation("/create/generate"); };
  const handleGenerate = () => { setIsAutoStart(false); setLocation("/create/result"); };

  const strategyData = {
    scene: "宠物家庭净化",
    performance: "CADR: 250 m³/h",
    sellingPoint: "专用吸毛技术",
    composition: "温馨家庭 + 萌宠元素",
    platform: "阿里巴巴",
    platformTips: "1:1 主图尺寸 · 白底+场景双版本 · 突出「厂家直供」信任背书"
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-4 px-4">
      <div className="max-w-2xl mx-auto">

        {/* 顶部标题 */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">AI已生成主图策略</h1>
          <p className="text-slate-500 text-xs max-w-md mx-auto">
            根据您的选择，AI已为您生成优化策略。请确认以下内容，符合预期后开始生成。
          </p>
        </div>

        {/* 策略卡片 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center">
              <Check className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">AI已生成主图策略</h2>
          </div>

          <div className="space-y-2">
            {/* 核心场景 */}
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
              <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-emerald-600" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500 mb-0.5">核心场景</div>
                <div className="text-sm font-semibold text-slate-900">{strategyData.scene}</div>
              </div>
            </div>

            {/* 核心性能 */}
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
              <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-emerald-600" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500 mb-0.5">核心性能</div>
                <div className="text-sm font-semibold text-slate-900">{strategyData.performance}</div>
              </div>
            </div>

            {/* 核心卖点 */}
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
              <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-emerald-600" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500 mb-0.5">核心卖点</div>
                <div className="text-sm font-semibold text-slate-900">{strategyData.sellingPoint}</div>
              </div>
            </div>

            {/* 主图构图建议 */}
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
              <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-emerald-600" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500 mb-0.5">主图构图建议</div>
                <div className="text-sm font-semibold text-slate-900">{strategyData.composition}</div>
              </div>
            </div>

            {/* 平台专属策略 */}
            <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
              <div className="w-5 h-5 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <ShoppingBag className="w-3 h-3 text-orange-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-slate-500">平台专属策略</span>
                  <span className="text-xs px-1.5 py-0.5 bg-orange-500 text-white rounded-full font-medium leading-none">专属优化</span>
                </div>
                <div className="text-sm font-bold text-orange-700 mb-0.5">{strategyData.platform}</div>
                <div className="text-xs text-orange-500 leading-relaxed">{strategyData.platformTips}</div>
              </div>
            </div>
          </div>

          {/* 进度条 */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500">
                {isAutoStart ? `${countdown}秒后自动开始生成主图...` : "已暂停，随时可手动开始"}
              </span>
              <button
                onClick={() => setIsAutoStart((v) => !v)}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-slate-300 hover:bg-slate-100 text-slate-600 transition-colors"
              >
                {isAutoStart ? <><Pause className="w-3 h-3" />暂停</> : <><Play className="w-3 h-3" />继续</>}
              </button>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-blue-500 transition-all duration-1000 ease-linear"
                style={{ width: `${((5 - countdown) / 5) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex gap-3">
          <Button
            onClick={handleModify}
            variant="outline"
            className="flex-1 h-12 text-sm font-semibold rounded-full border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50"
          >
            修改策略
          </Button>
          <Button
            onClick={handleGenerate}
            className="flex-1 h-12 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-full shadow-lg"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            立即生成
          </Button>
        </div>

      </div>
    </div>
  );
}
