import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, Sparkles, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StepIndicator } from "@/components/StepIndicator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

// 产品类型与主题场景的映射关系
const PRODUCT_THEMES: Record<string, string[]> = {
  "空气净化器": ["宠物家庭", "甲醛净化", "过敏防护", "母婴安全", "办公室净化", "老人健康"],
  "加湿器": ["干燥季节", "办公室舒适", "卧室睡眠", "母婴护理", "美容护肤"],
  "除湿机": ["梅雨季节", "地下室防潮", "衣物干燥", "防霉除湿"],
  "厨房小家电": ["家庭烹饪", "健康饮食", "快手料理", "烘焙达人", "早餐神器"],
  "服装": ["职场通勤", "休闲度假", "运动健身", "约会穿搭", "居家舒适"],
  "电子产品": ["办公效率", "娱乐影音", "学习提升", "游戏电竞", "智能生活"],
  "家居用品": ["温馨家庭", "简约生活", "收纳整理", "品质生活"],
  "美妆护肤": ["日常护肤", "妆容打造", "抗衰修护", "敏感肌护理"],
  "食品饮料": ["健康营养", "美味享受", "能量补充", "送礼佳品"],
  "运动户外": ["健身塑形", "户外探险", "运动竞技", "休闲运动"],
  "母婴用品": ["新生儿护理", "婴幼儿成长", "孕妈关怀", "亲子互动"],
  "图书文具": ["学习提升", "办公必备", "创意设计", "阅读享受"],
  "其它": ["日常使用", "品质生活", "实用便捷", "多场景适用"],
};

interface ImagePlan {
  id: string;
  name: string;
  count: number;
  description: string;
  enabled: boolean;
}

export default function RecommendStep() {
  const [, setLocation] = useLocation();
  const [productType, setProductType] = useState<string>("空气净化器");
  const [selectedTheme, setSelectedTheme] = useState<string>("");
  const [plans, setPlans] = useState<ImagePlan[]>([
    {
      id: "main",
      name: "主图",
      count: 2,
      description: "产品主图，突出产品整体",
      enabled: true,
    },
    {
      id: "scene",
      name: "场景图",
      count: 2,
      description: "宠物家庭使用场景",
      enabled: true,
    },
    {
      id: "feature",
      name: "卖点图",
      count: 2,
      description: "突出产品核心卖点",
      enabled: true,
    },
    {
      id: "structure",
      name: "结构拆解图",
      count: 1,
      description: "展示产品内部结构",
      enabled: true,
    },
  ]);

  // 从sessionStorage读取用户选择的产品类型
  useEffect(() => {
    const savedProductType = sessionStorage.getItem("selectedProductType");
    if (savedProductType) {
      setProductType(savedProductType);
      // 设置默认主题为该产品类型的第一个主题
      const themes = PRODUCT_THEMES[savedProductType] || PRODUCT_THEMES["其它"];
      setSelectedTheme(themes[0]);
    } else {
      // 默认使用空气净化器
      setSelectedTheme(PRODUCT_THEMES["空气净化器"][0]);
    }
  }, []);

  // 当主题改变时，更新场景图的描述
  useEffect(() => {
    if (selectedTheme) {
      setPlans(plans.map(p => 
        p.id === "scene" 
          ? { ...p, description: `${selectedTheme}使用场景` }
          : p
      ));
    }
  }, [selectedTheme]);

  const togglePlan = (id: string) => {
    setPlans(plans.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };

  const handleNext = () => {
    const selectedPlans = plans.filter(p => p.enabled);
    sessionStorage.setItem("selectedPlans", JSON.stringify(selectedPlans));
    sessionStorage.setItem("selectedTheme", selectedTheme);
    setLocation("/create/features");
  };

  const totalImages = plans.filter(p => p.enabled).reduce((sum, p) => sum + p.count, 0);
  const availableThemes = PRODUCT_THEMES[productType] || PRODUCT_THEMES["其它"];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <StepIndicator currentStep={5} steps={STEPS} />

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 rounded-full mb-4">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-blue-700 font-medium text-sm">
              AI智能推荐
            </span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            AI为您生成整套内容方案
          </h1>
          <p className="text-slate-600">
            根据产品类型智能推荐主题场景，一键生成专业电商图片
          </p>
        </div>

        {/* 主题场景选择 */}
        <Card className="p-6 bg-gradient-to-br from-blue-50 to-emerald-50 border-blue-200 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <Sparkles className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="font-bold text-slate-900 mb-2">选择主要场景（推荐）</h3>
              <p className="text-sm text-slate-700 mb-4">
                根据产品类型：<strong>{productType}</strong>，AI为您推荐以下热门主题场景
              </p>
              
              {/* 主题选择下拉框 */}
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  选择主题（推荐）
                </label>
                <Select value={selectedTheme} onValueChange={setSelectedTheme}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择主题场景" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableThemes.map((theme) => (
                      <SelectItem key={theme} value={theme}>
                        {theme}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-2">
                  💡 选择最符合您目标客户群体的主题，AI将生成对应的场景图
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* 推荐方案列表 */}
        <div className="space-y-4 mb-8">
          <h2 className="text-xl font-bold text-slate-900">AI推荐内容</h2>
          
          <div className="grid md:grid-cols-2 gap-4">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`p-6 transition-all ${
                  plan.enabled
                    ? "border-blue-500 bg-white"
                    : "border-slate-200 bg-slate-50 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        plan.enabled ? "bg-blue-100" : "bg-slate-200"
                      }`}
                    >
                      <ImageIcon
                        className={`w-6 h-6 ${
                          plan.enabled ? "text-blue-600" : "text-slate-400"
                        }`}
                      />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{plan.name}</h3>
                      <p className="text-sm text-slate-600">
                        {plan.count} 张
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={plan.enabled}
                    onCheckedChange={() => togglePlan(plan.id)}
                  />
                </div>
                <p className="text-sm text-slate-600">{plan.description}</p>
                {plan.enabled && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>已选择</span>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>

        {/* 示例预览 */}
        <Card className="p-6 mb-8">
          <h3 className="font-semibold text-slate-900 mb-4">效果预览</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden">
              <img
                src="/case-1688-1.png"
                alt="主图示例"
                className="w-full h-full object-contain p-4"
              />
              <div className="p-2 bg-white">
                <p className="text-xs text-slate-600 text-center">主图示例</p>
              </div>
            </div>
            <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden">
              <img
                src="/case-1688-4.jpg"
                alt="场景图示例"
                className="w-full h-full object-cover"
              />
              <div className="p-2 bg-white">
                <p className="text-xs text-slate-600 text-center">场景图示例</p>
              </div>
            </div>
            <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden">
              <img
                src="/case-1688-3.jpg"
                alt="卖点图示例"
                className="w-full h-full object-cover"
              />
              <div className="p-2 bg-white">
                <p className="text-xs text-slate-600 text-center">卖点图示例</p>
              </div>
            </div>
          </div>
        </Card>

        {/* 底部统计和按钮 */}
        <div className="flex items-center justify-between">
          <div className="text-slate-600">
            <span className="text-sm">将生成 </span>
            <span className="text-2xl font-bold text-blue-600">{totalImages}</span>
            <span className="text-sm"> 张图片</span>
          </div>
          <Button
            onClick={handleNext}
            size="lg"
            className="bg-blue-500 hover:bg-blue-600 px-8"
            disabled={!selectedTheme}
          >
            继续下一步
          </Button>
        </div>
      </div>
    </div>
  );
}
