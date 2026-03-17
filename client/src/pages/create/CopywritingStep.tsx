import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Loader2, Zap, Edit2, Share2, ChevronRight,
  Monitor, Star, Search, MapPin, BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailStepIndicator } from "./DetailResultStep";
// [2026-03-16 静态化改造] 注释掉 tRPC import，静态模式下不调用后端文案生成接口
// import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";

interface Section {
  id: string;
  type: string;
  title: string;
  content: string;
}

// 6个模块配置
const MODULE_CONFIG: Record<string, {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  label: string;
  styleTag: string;
  styleDesc: string;
  placeholderImg?: string;
}> = {
  product_display: {
    icon: Monitor, color: "text-blue-600", bgColor: "bg-blue-50",
    label: "产品展示", styleTag: "主图展示", styleDesc: "产品全景·品质感",
    placeholderImg: "https://private-us-east-1.manuscdn.com/sessionFile/FqDWyGWuKYUEGqpy3yF7qj/sandbox/nNLMBqkpuCCnbzJEJHMFJZ-images_1739240895_1739240895_0.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRnFEV3lHV3VLWVVFaHFweTNZRjdxai9zYW5kYm94L25OTE1CcWtwdUNDbmJ6SkVKSE1GSlotaW1hZ2VzXzE3MzkyNDA4OTVfMTczOTI0MDg5NV8wLnBuZyIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc3NTAzMDQwMH19fV19&Key-Pair-Id=K2ZIVPTIP2JMPK&Signature=AHqjBiXaL5KCOhfr0Tl2kRrGVKNKXjJRiQMpNXkv4OGqxFuKqPFWuDZVQfDnFfkpEFGILFVTHN5Ow5gFBIBiJCHuC4eTWXmIVTFjQXSUMIFVPMFJbVtCVGFfGfqUCJEBJCRPPTUzCMwJXnCOVLPKJMNMVGZOGEGXXHQNJQ__",
  },
  core_selling_point: {
    icon: Star, color: "text-amber-600", bgColor: "bg-amber-50",
    label: "核心卖点", styleTag: "卖点图", styleDesc: "痛点击中·技术风",
    placeholderImg: "https://private-us-east-1.manuscdn.com/sessionFile/FqDWyGWuKYUEGqpy3yF7qj/sandbox/nNLMBqkpuCCnbzJEJHMFJZ-images_1739240895_1739240895_0.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRnFEV3lHV3VLWVVFaHFweTNZRjdxai9zYW5kYm94L25OTE1CcWtwdUNDbmJ6SkVKSE1GSlotaW1hZ2VzXzE3MzkyNDA4OTVfMTczOTI0MDg5NV8wLnBuZyIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc3NTAzMDQwMH19fV19&Key-Pair-Id=K2ZIVPTIP2JMPK&Signature=AHqjBiXaL5KCOhfr0Tl2kRrGVKNKXjJRiQMpNXkv4OGqxFuKqPFWuDZVQfDnFfkpEFGILFVTHN5Ow5gFBIBiJCHuC4eTWXmIVTFjQXSUMIFVPMFJbVtCVGFfGfqUCJEBJCRPPTUzCMwJXnCOVLPKJMNMVGZOGEGXXHQNJQ__",
  },
  function_description: {
    icon: Zap, color: "text-violet-600", bgColor: "bg-violet-50",
    label: "功能说明", styleTag: "功能图", styleDesc: "制图高清·制图风格",
    placeholderImg: "https://private-us-east-1.manuscdn.com/sessionFile/FqDWyGWuKYUEGqpy3yF7qj/sandbox/nNLMBqkpuCCnbzJEJHMFJZ-images_1739240895_1739240895_0.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRnFEV3lHV3VLWVVFaXFweTNZRjdxai9zYW5kYm94L25OTE1CcWtwdUNDbmJ6SkVKSE1GSlotaW1hZ2VzXzE3MzkyNDA4OTVfMTczOTI0MDg5NV8wLnBuZyIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc3NTAzMDQwMH19fV19&Key-Pair-Id=K2ZIVPTIP2JMPK&Signature=AHqjBiXaL5KCOhfr0Tl2kRrGVKNKXjJRiQMpNXkv4OGqxFuKqPFWuDZVQfDnFfkpEFGILFVTHN5Ow5gFBIBiJCHuC4eTWXmIVTFjQXSUMIFVPMFJbVtCVGFfGfqUCJEBJCRPPTUzCMwJXnCOVLPKJMNMVGZOGEGXXHQNJQ__",
  },
  product_details: {
    icon: Search, color: "text-indigo-600", bgColor: "bg-indigo-50",
    label: "产品细节", styleTag: "细节图", styleDesc: "工艺细节·品质感",
    placeholderImg: "https://private-us-east-1.manuscdn.com/sessionFile/FqDWyGWuKYUEGqpy3yF7qj/sandbox/nNLMBqkpuCCnbzJEJHMFJZ-images_1739240895_1739240895_0.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRnFEV3lHV3VLWVVFaXFweTNZRjdxai9zYW5kYm94L25OTE1CcWtwdUNDbmJ6SkVKSE1GSlotaW1hZ2VzXzE3MzkyNDA4OTVfMTczOTI0MDg5NV8wLnBuZyIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc3NTAzMDQwMH19fV19&Key-Pair-Id=K2ZIVPTIP2JMPK&Signature=AHqjBiXaL5KCOhfr0Tl2kRrGVKNKXjJRiQMpNXkv4OGqxFuKqPFWuDZVQfDnFfkpEFGILFVTHN5Ow5gFBIBiJCHuC4eTWXmIVTFjQXSUMIFVPMFJbVtCVGFfGfqUCJEBJCRPPTUzCMwJXnCOVLPKJMNMVGZOGEGXXHQNJQ__",
  },
  usage_scenarios: {
    icon: MapPin, color: "text-green-600", bgColor: "bg-green-50",
    label: "使用场景", styleTag: "场景图", styleDesc: "生活场景·温馨风",
    placeholderImg: "https://private-us-east-1.manuscdn.com/sessionFile/FqDWyGWuKYUEGqpy3yF7qj/sandbox/nNLMBqkpuCCnbzJEJHMFJZ-images_1739240895_1739240895_0.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRnFEV3lHV3VLWVVFaXFweTNZRjdxai9zYW5kYm94L25OTE1CcWtwdUNDbmJ6SkVKSE1GSlotaW1hZ2VzXzE3MzkyNDA4OTVfMTczOTI0MDg5NV8wLnBuZyIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc3NTAzMDQwMH19fV19&Key-Pair-Id=K2ZIVPTIP2JMPK&Signature=AHqjBiXaL5KCOhfr0Tl2kRrGVKNKXjJRiQMpNXkv4OGqxFuKqPFWuDZVQfDnFfkpEFGILFVTHN5Ow5gFBIBiJCHuC4eTWXmIVTFjQXSUMIFVPMFJbVtCVGFfGfqUCJEBJCRPPTUzCMwJXnCOVLPKJMNMVGZOGEGXXHQNJQ__",
  },
  product_parameters: {
    icon: BarChart2, color: "text-cyan-600", bgColor: "bg-cyan-50",
    label: "产品参数", styleTag: "参数图", styleDesc: "数据清晰·专业风",
    placeholderImg: "https://private-us-east-1.manuscdn.com/sessionFile/FqDWyGWuKYUEGqpy3yF7qj/sandbox/nNLMBqkpuCCnbzJEJHMFJZ-images_1739240895_1739240895_0.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRnFEV3lHV3VLWVVFaXFweTNZRjdxai9zYW5kYm94L25OTE1CcWtwdUNDbmJ6SkVKSE1GSlotaW1hZ2VzXzE3MzkyNDA4OTVfMTczOTI0MDg5NV8wLnBuZyIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc3NTAzMDQwMH19fV19&Key-Pair-Id=K2ZIVPTIP2JMPK&Signature=AHqjBiXaL5KCOhfr0Tl2kRrGVKNKXjJRiQMpNXkv4OGqxFuKqPFWuDZVQfDnFfkpEFGILFVTHN5Ow5gFBIBiJCHuC4eTWXmIVTFjQXSUMIFVPMFJbVtCVGFfGfqUCJEBJCRPPTUzCMwJXnCOVLPKJMNMVGZOGEGXXHQNJQ__",
  },
};

// 模块顺序
const MODULE_ORDER = [
  "product_display",
  "core_selling_point",
  "function_description",
  "product_details",
  "usage_scenarios",
  "product_parameters",
];

export default function CopywritingStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [sections, setSections] = useState<Section[]>([]);

  const productParams = (() => {
    try { return JSON.parse(sessionStorage.getItem("productParams") || "{}"); }
    catch { return {}; }
  })();
  const analysisResult = (() => {
    try {
      const raw = sessionStorage.getItem("analysisResult");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();
  const selectedPlatform = sessionStorage.getItem("selectedPlatform") || "阿里巴巴";
  const productType = productParams.productType || analysisResult?.productType || "产品";
  const productName = productParams.productName || analysisResult?.productName || productType;
  const features = productParams.features || analysisResult?.sellingPoints || [];

  // --- 原始代码：通过 tRPC 调用后端 LLM 生成详情页文案（已注释） ---
  // [2026-03-16 静态化改造] 目标：不调后端 API，用本地 mock 数据模拟 6 模块文案生成
  /*
  const generateMutation = trpc.project.generateDetailCopy.useMutation({
    onSuccess: (data: { sections: { type: string; title: string; content: string }[] }) => {
      const sorted = MODULE_ORDER.map(type =>
        data.sections.find(s => s.type === type)
      ).filter(Boolean) as { type: string; title: string; content: string }[];
      const extra = data.sections.filter(s => !MODULE_ORDER.includes(s.type));
      setSections([...sorted, ...extra].map((s, i) => ({
        id: `section-${i}`,
        type: s.type,
        title: s.title,
        content: s.content,
      })));
    },
    onError: (err: { message: string }) => {
      toast({ title: "生成失败", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    generateMutation.mutate({
      productType,
      productName,
      platform: selectedPlatform,
      features: features.length > 0 ? features : undefined,
      analysisResult: analysisResult ? JSON.stringify(analysisResult) : undefined,
    });
  }, []);

  const isLoading = generateMutation.isPending;
  */

  // --- 新代码：Mock 文案生成，2s 延迟后返回 6 模块假数据 ---
  const [isLoading, setIsLoading] = useState(true);
  const [genError, setGenError] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        // [2026-03-16 静态化改造] 硬编码 6 模块文案 mock 数据
        const mockSections = [
          { type: "product_display", title: "宠物家庭专研空气净化器", content: "为宠物家庭专研的空气净化机\n高效吸附宠物毛发与皮屑\nCADR值220m³/h 快速净化\n四重过滤系统 层层净化" },
          { type: "core_selling_point", title: "核心卖点", content: "宠物毛发专用吸附技术\n电负性纤维主动捕捉浮毛\n异味分解率99.2%\n运行噪音低至22dB 不惊扰宠物" },
          { type: "function_description", title: "四重过滤系统", content: "四重深度净化 层层守护\n初效滤网拦截大颗粒毛发\nHEPA H13过滤99.97%微粒\n活性炭层吸附甲醛异味\n负离子清新空气" },
          { type: "product_details", title: "工艺细节", content: "匠心工艺 品质之选\n一体成型机身 无缝隙设计\n磁吸式滤网盖 便捷更换\nLED触控面板 操作直觉化" },
          { type: "usage_scenarios", title: "使用场景", content: "多场景守护 全屋净化\n客厅：大面积30m²覆盖\n卧室：静音模式安心睡眠\n宠物区：集中吸附毛发异味" },
          { type: "product_parameters", title: "产品参数", content: "产品规格参数\nCADR: 220m³/h\n功率: 45W\n噪音: 22-52dB\n适用面积: 15-30m²\n滤网寿命: 6-8个月" },
        ];
        setSections(mockSections.map((s, i) => ({ id: `section-${i}`, ...s })));
        setIsLoading(false);
      } catch {
        setGenError(true);
        setIsLoading(false);
      }
    }, 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerateAll = () => {
    sessionStorage.setItem("detailCopySections", JSON.stringify(sections));
    toast({ title: "开始生成详情图", description: "正在跳转到图片生成页面..." });
    setLocation("/create/detail-confirm");
  };

  const handleEdit = () => {
    // 跳转到参数确认页修改内容
    setLocation("/create/confirm");
  };

  const handleShare = () => {
    const text = sections.map(s => `【${s.title}】\n${s.content}`).join("\n\n");
    navigator.clipboard.writeText(text).catch(() => {});
    toast({ title: "已复制全部文案到剪贴板" });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <DetailStepIndicator currentStep={1} />

      {/* 顶部标题区 */}
      <div className="bg-white border-b px-4 py-3">
        <h1 className="text-base font-bold text-slate-900">AI已生成详情页执行方案</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          根据商品图已生成平台规则，AI已为您规划可直接生成的详情页内容。
        </p>
      </div>

      {/* 生产流程标签 */}
      <div className="bg-white border-b px-4 py-2 flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-yellow-400 text-white text-xs font-bold px-2.5 py-1 rounded-full">
          <Zap className="w-3 h-3" />
          生产流程
          <ChevronRight className="w-3 h-3" />
        </div>
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
          <p className="text-sm font-semibold text-slate-700">AI 正在生成详情页执行方案...</p>
          <div className="space-y-1 text-xs text-slate-400 text-center">
            <p className="animate-pulse">正在分析产品卖点...</p>
            <p className="animate-pulse">正在规划6张详情图内容...</p>
            <p className="animate-pulse">正在优化1688风格文案...</p>
          </div>
        </div>
      )}

      {/* 模块列表 */}
      {!isLoading && sections.length > 0 && (
        <div className="flex-1 overflow-y-auto pb-20">
          {sections.map((section, index) => {
            const cfg = MODULE_CONFIG[section.type] || {
              icon: Monitor, color: "text-blue-600", bgColor: "bg-blue-50",
              label: section.title, styleTag: "展示图", styleDesc: "产品风格",
            };
            const Icon = cfg.icon;
            // 解析文案内容为行
            const lines = section.content.split("\n").filter(l => l.trim());
            const titleLine = lines[0] || "";
            const bodyLines = lines.slice(1);

            return (
              <div key={section.id} className="bg-white border-b">
                {/* 模块编号标题 */}
                <div className="px-4 py-2.5 flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-700">{cfg.label}</span>
                </div>

                {/* 内容区：文案 */}
                  <div className="px-4 pb-3">
                  <div className="w-full">
                    {/* 标题文案 */}
                    {titleLine && (
                      <div className={`${cfg.bgColor} rounded-lg px-3 py-2 mb-2`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className={`w-3.5 h-3.5 ${cfg.color} shrink-0`} />
                          <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-800 leading-snug">{titleLine}</p>
                      </div>
                    )}
                    {/* 正文内容 */}
                    {bodyLines.length > 0 && (
                      <div className="space-y-0.5">
                        {bodyLines.map((line, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                            <span className="mt-0.5 shrink-0 text-slate-300">•</span>
                            <span className="leading-relaxed">{line.replace(/^[•·\-\*]\s*/, "")}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 风格标签行 */}
                <div className="px-4 pb-3 flex items-center gap-2">
                  <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full cursor-pointer hover:bg-blue-100">
                    {cfg.styleTag}
                  </span>
                  <span className="text-xs text-slate-500">{cfg.styleDesc}</span>
                  <ChevronRight className="w-3 h-3 text-slate-300 ml-auto" />
                </div>
              </div>
            );
          })}

          {/* AI预计生成数量 */}
          <div className="px-4 py-1.5 text-xs text-slate-400 text-center">
            AI 预计生成：6-8 张详情图
          </div>
        </div>
      )}

      {/* 生成失败 */}
      {/* [2026-03-16 静态化改造] 原代码引用 generateMutation.isError，改为 genError state */}
      {/*
      {!isLoading && sections.length === 0 && generateMutation.isError && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
          <p className="text-sm text-slate-500">文案生成失败，请重试</p>
          <Button
            onClick={() => generateMutation.mutate({
              productType, productName, platform: selectedPlatform,
              features: features.length > 0 ? features : undefined,
            })}
            className="bg-blue-500 hover:bg-blue-600"
          >
            重新生成
          </Button>
        </div>
      )}
      */}
      {!isLoading && sections.length === 0 && genError && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
          <p className="text-sm text-slate-500">文案生成失败，请重试</p>
          <Button
            onClick={() => window.location.reload()}
            className="bg-blue-500 hover:bg-blue-600"
          >
            重新生成
          </Button>
        </div>
      )}

      {/* 底部固定操作栏 */}
      {!isLoading && sections.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-3 flex items-center gap-2 z-50">
          <Button
            variant="outline"
            onClick={handleEdit}
            className="flex items-center gap-1.5 text-sm px-4"
          >
            <Edit2 className="w-4 h-4" />
            修改内容
          </Button>
          <Button
            onClick={handleGenerateAll}
            className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-white font-bold text-sm flex items-center justify-center gap-1.5"
          >
            <Zap className="w-4 h-4" />
            生成全部详情图
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleShare}
            className="shrink-0"
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
