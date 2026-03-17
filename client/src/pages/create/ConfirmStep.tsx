import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, Image as ImageIcon, Rocket, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const IMAGE_TYPES = [
  { id: "main", name: "主图", count: 2, color: "bg-blue-100 text-blue-700", icon: "📸" },
  { id: "scene", name: "场景图", count: 2, color: "bg-purple-100 text-purple-700", icon: "🏠" },
  { id: "feature", name: "卖点图", count: 2, color: "bg-green-100 text-green-700", icon: "⭐" },
  { id: "structure", name: "结构图", count: 1, color: "bg-orange-100 text-orange-700", icon: "🔧" },
];

export default function ConfirmStep() {
  const [, setLocation] = useLocation();
  const [generating, setGenerating] = useState(false);

  const totalImages = IMAGE_TYPES.reduce((sum, type) => sum + type.count, 0);

  const handleGenerate = () => {
    setGenerating(true);
    // 模拟生成过程
    setTimeout(() => {
      setLocation("/create/result");
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <StepIndicator currentStep={8} steps={STEPS} />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
            一键生成整套视觉（高潮）
          </h1>
          <p className="text-slate-600">
            确认生成方案，AI将为您创建专业的电商图片
          </p>
        </div>

        {/* 生成方案卡片 */}
        <Card className="p-8 mb-8 bg-gradient-to-br from-blue-50 to-emerald-50 border-2 border-blue-200">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              AI即将为你生成：
            </h2>
            <p className="text-slate-600">
              基于您上传的产品图片和提供的信息
            </p>
          </div>

          {/* 图片类型列表 */}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {IMAGE_TYPES.map((type) => (
              <div
                key={type.id}
                className="flex items-center gap-4 p-4 bg-white rounded-lg border-2 border-blue-200"
              >
                <div className="text-4xl">{type.icon}</div>
                <div className="flex-1">
                  <div className="font-bold text-slate-900 mb-1">
                    {type.name}
                  </div>
                  <div className="text-sm text-slate-600">
                    {type.count} 张
                  </div>
                </div>
                <CheckCircle2 className="w-6 h-6 text-blue-500" />
              </div>
            ))}
          </div>

          {/* 总计 */}
          <div className="text-center py-6 border-t-2 border-blue-200">
            <div className="text-slate-600 mb-2">总计生成</div>
            <div className="text-5xl font-bold text-blue-600 mb-2">
              {totalImages}
            </div>
            <div className="text-slate-600">张专业电商图片</div>
          </div>
        </Card>

        {/* 预览示例 */}
        <Card className="p-6 mb-8">
          <h3 className="font-semibold text-slate-900 mb-4">效果预览</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden">
              <img
                src="/case-1688-1.png"
                alt="主图示例"
                className="w-full h-full object-contain p-2"
              />
            </div>
            <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden">
              <img
                src="/case-1688-4.jpg"
                alt="场景图示例"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden">
              <img
                src="/case-1688-3.jpg"
                alt="卖点图示例"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </Card>

        {/* 生成按钮 */}
        <div className="text-center">
          <Button
            onClick={handleGenerate}
            disabled={generating}
            size="lg"
            className="bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white px-12 py-6 text-xl font-bold shadow-lg hover:shadow-xl transition-all"
          >
            {generating ? (
              <>
                <ImageIcon className="w-6 h-6 mr-3 animate-spin" />
                正在生成中...
              </>
            ) : (
              <>
                <Rocket className="w-6 h-6 mr-3" />
                🚀 一键生成整套图片
              </>
            )}
          </Button>
          {generating && (
            <p className="text-sm text-slate-600 mt-4">
              AI正在创作中，预计30-60秒，请稍候...
            </p>
          )}
          <button
            onClick={() => setLocation("/create/copywriting")}
            className="mt-3 flex items-center justify-center gap-1.5 mx-auto text-slate-400 hover:text-blue-600 text-sm transition-colors"
          >
            <FileText className="w-4 h-4" />
            直接生成详情文案
          </button>
        </div>
      </div>
    </div>
  );
}
