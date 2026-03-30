import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { StepIndicator } from "@/components/StepIndicator";
import { jobAPI, sessionAPI } from "@/lib/api";
import {
  cacheAnalysisSnapshot,
  hasAnalysisContent,
  markAnalysisRefreshRequired,
} from "@/lib/analysisSnapshot";
import { useToast } from "@/hooks/use-toast";

const PLATFORMS = [
  { id: "1688", name: "1688", logo: "https://d2xsxph8kpxj0f.cloudfront.net/310519663275834844/FqDWyGWuKYUEGqpy3yF7qj/1688_31c661d3.png" },
  { id: "alibaba_intl", name: "阿里国际站", logo: "/platforms/alibaba-intl.jpg" },
  { id: "taobao", name: "淘宝", logo: "/platforms/taobao.png" },
  { id: "douyin", name: "抖音", logo: "/platforms/douyin.png" },
  { id: "tiktok", name: "TikTok", logo: "/platforms/tiktok.png" },
  { id: "jd", name: "京东", logo: "/platforms/jd.png" },
  { id: "pdd", name: "拼多多", logo: "/platforms/pdd.png" },
  { id: "temu", name: "Temu", logo: "/platforms/temu.jpg" },
  { id: "xiaohongshu", name: "小红书", logo: "/platforms/xiaohongshu.png" },
  { id: "amazon", name: "亚马逊", logo: "/platforms/amazon.png" },
  { id: "official_site", name: "官网/独立站", logo: null },
  { id: "custom", name: "自定义", logo: "plus", isCustom: true },
];

export default function PlatformStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [isContinuing, setIsContinuing] = useState(false);

  const togglePlatform = (id: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(id)
        ? prev.filter(p => p !== id)
        : [...prev, id]
    );
  };

  const handleNext = async () => {
    if (isContinuing) return;
    if (selectedPlatforms.length === 0) {
      alert("请至少选择一个平台");
      return;
    }

    setIsContinuing(true);

    // Save selected platforms to sessionStorage for later steps
    sessionStorage.setItem("selectedPlatforms", JSON.stringify(selectedPlatforms));

    // Save platform selection to backend
    const sessionId = sessionStorage.getItem("current_session_id");
    if (sessionId) {
      try {
        markAnalysisRefreshRequired();
        await sessionAPI.savePlatformSelection(sessionId, selectedPlatforms, selectedPlatforms[0]);

        toast({
          title: "正在重新执行 AI 分析",
          description: "分析完成后会自动进入参数页。",
        });

        const trigger = await sessionAPI.triggerAnalysis(sessionId);
        await jobAPI.pollUntilDone(trigger.job_id);

        const startedAt = Date.now();
        const timeoutMs = 30000;
        const intervalMs = 1500;
        let freshSnapshot: any = null;

        while (Date.now() - startedAt < timeoutMs) {
          const analysisResponse = await sessionAPI.getAnalysis(sessionId).catch(() => null);
          const analysisSnapshot =
            analysisResponse?.analysis_snapshot || analysisResponse || null;

          if (analysisSnapshot && hasAnalysisContent(analysisSnapshot)) {
            freshSnapshot = analysisSnapshot;
            break;
          }

          await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
        }

        if (!freshSnapshot) {
          throw new Error("AI 分析结果刷新超时，请稍后重试。");
        }

        const parsed = cacheAnalysisSnapshot(freshSnapshot);
        if (parsed.category) {
          sessionStorage.setItem("selectedProductType", parsed.category);
        }
      } catch (err) {
        console.error("Failed to save platform selection:", err);
        toast({
          title: "进入下一步失败",
          description: err instanceof Error ? err.message : "请稍后重试。",
          variant: "destructive",
        });
        setIsContinuing(false);
        return;
      }
    }

    // 跳转到主图文案生成页面
    setLocation("/create/generate");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <StepIndicator currentStep={2} />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 标题区域 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-base font-bold text-white shadow">
            3
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">选择平台与类型</h1>
            <p className="text-xs text-slate-500 mt-0.5">按照平台规范精准生图</p>
          </div>
        </div>

        {/* 平台网格 */}
        <div className="grid grid-cols-3 md:grid-cols-4 gap-4 mb-8">
          {PLATFORMS.map((platform) => {
            const isSelected = selectedPlatforms.includes(platform.id);
            return (
              <div
                key={platform.id}
                onClick={() => togglePlatform(platform.id)}
                className={`bg-white rounded-xl flex flex-col items-center justify-center py-4 px-2 relative cursor-pointer transition-all hover:scale-105 shadow-sm border ${
                  isSelected ? 'ring-2 ring-blue-500 border-blue-300' : 'border-slate-100'
                }`}
              >
                {/* 平台Logo */}
                {platform.logo === "plus" ? (
                  <div className="w-12 h-12 flex items-center justify-center mb-2">
                    <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
                    </svg>
                  </div>
                ) : platform.logo ? (
                  <div className="w-12 h-12 rounded-xl overflow-hidden mb-2 flex-shrink-0">
                    <img
                      src={platform.logo}
                      alt={platform.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 flex items-center justify-center mb-2 bg-slate-100 rounded-lg">
                    <span className="text-2xl font-bold text-slate-400">官</span>
                  </div>
                )}

                {/* 平台名称 */}
                <div className="text-[11px] font-medium text-slate-900 text-center whitespace-nowrap leading-tight">
                  {platform.name}
                </div>

                {/* 选中标记 */}
                {isSelected && (
                  <div className="absolute inset-0 bg-blue-500 bg-opacity-10 rounded-xl flex items-center justify-center">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 已选平台提示 */}
        {selectedPlatforms.length > 0 && (
          <div className="bg-blue-50 rounded-xl p-4 mb-6 border border-blue-200">
            <p className="text-slate-700 text-sm">
              已选择 <span className="font-bold text-blue-600">{selectedPlatforms.length}</span> 个平台
            </p>
          </div>
        )}

        {/* 底部按钮 */}
        <Button
          onClick={handleNext}
          disabled={selectedPlatforms.length === 0 || isContinuing}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-6 text-xl rounded-full disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {isContinuing ? "AI分析中..." : "下一步"}
          {!isContinuing && (
            <svg className="w-6 h-6 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
            </svg>
          )}
        </Button>
      </div>
    </div>
  );
}
