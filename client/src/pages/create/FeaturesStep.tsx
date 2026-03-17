import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2, CheckCircle2, Plus, X, Edit2, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

interface ProductParam {
  id: string;
  label: string;
  value: string;
  isEditing: boolean;
}

export default function FeaturesStep() {
  const [, setLocation] = useLocation();
  const [analyzing, setAnalyzing] = useState(true);
  const [params, setParams] = useState<ProductParam[]>([]);

  useEffect(() => {
    // 模拟AI识别参数
    setTimeout(() => {
      setParams([
        { id: "1", label: "CADR值", value: "250m³/h", isEditing: false },
        { id: "2", label: "适用面积", value: "30㎡", isEditing: false },
        { id: "3", label: "核心卖点", value: "宠物毛发专用", isEditing: false },
        { id: "4", label: "过滤方式", value: "4层过滤", isEditing: false },
      ]);
      setAnalyzing(false);
    }, 2500);
  }, []);

  const toggleEdit = (id: string) => {
    setParams(params.map(p => 
      p.id === id ? { ...p, isEditing: !p.isEditing } : p
    ));
  };

  const updateValue = (id: string, value: string) => {
    setParams(params.map(p => 
      p.id === id ? { ...p, value } : p
    ));
  };

  const deleteParam = (id: string) => {
    setParams(params.filter(p => p.id !== id));
  };

  const addParam = () => {
    const newId = String(params.length + 1);
    setParams([...params, {
      id: newId,
      label: "新参数",
      value: "",
      isEditing: true
    }]);
  };

  const handleNext = () => {
    sessionStorage.setItem("productParams", JSON.stringify(params));
    setLocation("/create/copywriting");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <StepIndicator currentStep={6} steps={STEPS} />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 rounded-full mb-4">
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                <span className="text-blue-700 font-medium text-sm">
                  AI正在识别...
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span className="text-blue-700 font-medium text-sm">
                  识别完成
                </span>
              </>
            )}
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            AI自动参数识别（体验爆炸点）
          </h1>
          <p className="text-slate-600">
            AI已自动识别产品参数，您可以编辑或添加更多信息
          </p>
        </div>

        {/* 分析中状态 */}
        {analyzing && (
          <Card className="p-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-4">
                AI正在识别产品信息...
              </h2>
              <div className="max-w-md mx-auto space-y-2 text-sm text-slate-600">
                <p className="animate-pulse">✓ 分析产品图片...</p>
                <p className="animate-pulse delay-100">✓ 提取技术参数...</p>
                <p className="animate-pulse delay-200">✓ 识别核心卖点...</p>
              </div>
            </div>
          </Card>
        )}

        {/* 识别结果 */}
        {!analyzing && (
          <div className="space-y-6">
            <Card className="p-6 bg-blue-50 border-blue-200">
              <div className="flex items-center gap-3 mb-3">
                <Sparkles className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold text-slate-900">
                  AI已识别以下产品信息（可编辑）
                </h2>
              </div>
              <p className="text-sm text-blue-800">
                AI已自动提取产品的关键参数和卖点，您可以点击编辑按钮进行修改，或添加更多信息
              </p>
            </Card>

            {/* 参数列表 */}
            <div className="space-y-3">
              {params.map((param) => (
                <Card key={param.id} className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 grid md:grid-cols-2 gap-4">
                      {/* 标签 */}
                      <div>
                        <div className="text-xs text-slate-500 mb-1">参数名称</div>
                        {param.isEditing ? (
                          <Input
                            value={param.label}
                            onChange={(e) => updateValue(param.id, e.target.value)}
                            className="text-sm"
                          />
                        ) : (
                          <div className="font-semibold text-slate-900">
                            {param.label}
                          </div>
                        )}
                      </div>

                      {/* 值 */}
                      <div>
                        <div className="text-xs text-slate-500 mb-1">参数值</div>
                        {param.isEditing ? (
                          <Input
                            value={param.value}
                            onChange={(e) => updateValue(param.id, e.target.value)}
                            className="text-sm"
                          />
                        ) : (
                          <div className="font-semibold text-blue-600">
                            {param.value}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleEdit(param.id)}
                      >
                        {param.isEditing ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Edit2 className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteParam(param.id)}
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}

              {/* 添加按钮 */}
              <Button
                variant="outline"
                className="w-full border-2 border-dashed border-blue-300 hover:border-blue-500 hover:bg-blue-50"
                onClick={addParam}
              >
                <Plus className="w-4 h-4 mr-2" />
                添加更多参数
              </Button>
            </div>

            {/* 底部按钮 */}
            <div className="flex justify-end pt-4">
              <Button
                onClick={handleNext}
                size="lg"
                className="bg-blue-500 hover:bg-blue-600 px-8"
              >
                下一步：生成文案
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
