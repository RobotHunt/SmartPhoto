import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StepIndicator } from "@/components/StepIndicator";

const STEPS = [
  { number: 1, title: "上传图片", description: "上传产品实拍图" },
  { number: 2, title: "AI分析", description: "智能识别产品" },
  { number: 3, title: "角度建议", description: "优化拍摄角度" },
  { number: 4, title: "转白底", description: "自动抠图" },
  { number: 5, title: "选平台", description: "选择电商平台" },
  { number: 6, title: "提取卖点", description: "AI识别特性" },
  { number: 7, title: "生成文案", description: "营销文案" },
  { number: 8, title: "确认方案", description: "生成预览" },
  { number: 9, title: "查看结果", description: "下载图片" },
];

export default function RemoveBgStep() {
  const [, setLocation] = useLocation();
  const [progress, setProgress] = useState(0);
  const [converting, setConverting] = useState(true);

  useEffect(() => {
    // 模拟转换进度
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setConverting(false);
          // 2秒后自动跳转
          setTimeout(() => {
            setLocation("/create/platform");
          }, 2000);
          return 100;
        }
        return prev + 10;
      });
    }, 300);

    return () => clearInterval(interval);
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <StepIndicator currentStep={4} steps={STEPS} />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 rounded-full mb-4">
            {converting ? (
              <>
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                <span className="text-blue-700 font-medium text-sm">
                  正在处理...
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span className="text-blue-700 font-medium text-sm">
                  转换完成
                </span>
              </>
            )}
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            正在为您特实物图处理为白底图...
          </h1>
          <p className="text-slate-600">
            这将发用是的产品图片，普助您...
          </p>
        </div>

        {/* 转换过程 */}
        <Card className="p-8">
          {/* Before/After 对比 */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Before */}
            <div>
              <div className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 bg-slate-500 text-slate-900 rounded-full flex items-center justify-center text-xs">
                  1
                </span>
                原图
              </div>
              <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl overflow-hidden p-4">
                <img
                  src="/case-1688-2.jpg"
                  alt="原图"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* After */}
            <div>
              <div className="text-sm font-semibold text-blue-600 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-500 text-slate-900 rounded-full flex items-center justify-center text-xs">
                  2
                </span>
                白底图
              </div>
              <div className="aspect-square bg-white rounded-xl overflow-hidden p-4 border-2 border-blue-200">
                {converting ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                  </div>
                ) : (
                  <img
                    src="/case-1688-1.png"
                    alt="白底图"
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            </div>
          </div>

          {/* 进度条 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600">转换进度</span>
              <span className="text-sm font-bold text-blue-600">
                {progress}%
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* 提示信息 */}
          {converting ? (
            <p className="text-sm text-slate-600 text-center">
              AI正在智能抠图，去除背景并生成纯白底图...
            </p>
          ) : (
            <div className="text-center">
              <CheckCircle2 className="w-12 h-12 text-blue-500 mx-auto mb-3" />
              <p className="text-lg font-semibold text-slate-900 mb-1">
                转换完成！
              </p>
              <p className="text-sm text-slate-600">
                正在自动跳转到下一步...
              </p>
            </div>
          )}
        </Card>

        {/* 产品名称 */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg">
            <span className="text-sm text-slate-600">参数不全：</span>
            <span className="text-sm font-semibold text-slate-900">
              空气净化器
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
