import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AlertCircle, Upload, CheckCircle2, ArrowRight } from "lucide-react";
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

interface MissingAngle {
  name: string;
  description: string;
  exampleImage: string;
}

export default function SuggestStep() {
  const [, setLocation] = useLocation();
  const [missingAngles, setMissingAngles] = useState<MissingAngle[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // 获取分析结果
    const resultData = sessionStorage.getItem("analysisResult");
    if (!resultData) {
      setLocation("/create/upload");
      return;
    }

    const result = JSON.parse(resultData);
    const detected = result.detectedAngles || [];

    // 定义所有建议角度
    const allAngles: MissingAngle[] = [
      {
        name: "正面",
        description: "产品正面完整展示",
        exampleImage: "/demo/angle-front.svg",
      },
      {
        name: "侧面",
        description: "产品侧面细节展示",
        exampleImage: "/demo/angle-side.svg",
      },
      {
        name: "顶视",
        description: "从上方俯视拍摄",
        exampleImage: "/demo/angle-top.svg",
      },
      {
        name: "45°角",
        description: "斜45度角度拍摄",
        exampleImage: "/demo/angle-45.svg",
      },
    ];

    // 找出缺失的角度
    const missing = allAngles.filter(
      (angle) => !detected.includes(angle.name)
    );

    setMissingAngles(missing);
    setIsComplete(missing.length === 0);
  }, [setLocation]);

  const handleNext = () => {
    setLocation("/create/remove-bg");
  };

  const handleBack = () => {
    setLocation("/create/analyze");
  };

  const handleAddMore = () => {
    setLocation("/create/upload");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <StepIndicator currentStep={3} steps={STEPS} />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            拍摄角度建议
          </h1>
          <p className="text-slate-600">
            为获得最佳生图效果，建议补充以下角度
          </p>
        </div>

        {/* 角度充足 */}
        {isComplete && (
          <Card className="p-8 text-center bg-green-50 border-green-200 mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-green-900 mb-2">
              角度充足！
            </h3>
            <p className="text-green-700">
              您已上传足够的角度图片，可以继续下一步
            </p>
          </Card>
        )}

        {/* 缺失角度提示 */}
        {!isComplete && missingAngles.length > 0 && (
          <div className="space-y-6">
            <Card className="p-6 bg-orange-50 border-orange-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-orange-600 mt-0.5" />
                <div>
                  <h3 className="font-bold text-orange-900 mb-1">
                    AI建议补充以下角度
                  </h3>
                  <p className="text-sm text-orange-700">
                    补充这些角度可以让AI生成更丰富、更专业的电商图片
                  </p>
                </div>
              </div>
            </Card>

            {/* 缺失角度展示 */}
            <div className="grid md:grid-cols-2 gap-6">
              {missingAngles.map((angle) => (
                <Card key={angle.name} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                    {/* 示范图占位符 */}
                    <div className="text-center p-8">
                      <div className="w-24 h-24 bg-white rounded-lg mx-auto mb-3 flex items-center justify-center">
                        <div className="text-4xl">📷</div>
                      </div>
                      <div className="text-sm text-slate-600 font-medium">
                        {angle.name}示范
                      </div>
                    </div>
                  </div>
                  <h4 className="font-bold text-slate-900 mb-1">
                    {angle.name}
                  </h4>
                  <p className="text-sm text-slate-600 mb-3">
                    {angle.description}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <ArrowRight className="w-4 h-4" />
                    <span>建议补充此角度</span>
                  </div>
                </Card>
              ))}
            </div>

            {/* 补充上传按钮 */}
            <Card className="p-6 bg-blue-50 border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-blue-900 mb-1">
                    想要更好的效果？
                  </h4>
                  <p className="text-sm text-blue-700">
                    返回上传页面补充缺失角度的图片
                  </p>
                </div>
                <Button onClick={handleAddMore} variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  补充上传
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* 底部按钮 */}
        <div className="flex justify-between items-center pt-6">
          <Button variant="outline" onClick={handleBack}>
            返回上一步
          </Button>
          <div className="flex gap-3">
            {!isComplete && (
              <Button variant="outline" onClick={handleNext}>
                跳过，继续
              </Button>
            )}
            <Button onClick={handleNext} size="lg" className="px-8">
              下一步：转白底图
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
