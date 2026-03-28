import { Sparkles } from "lucide-react";
import { useLocation } from "wouter";

import { Button } from "@/components/ui/button";
import { clearCreateFlow, getResumeFlowPath } from "@/lib/createFlow";

interface FeatureRemovedPageProps {
  title: string;
  description: string;
  badge?: string;
}

export function FeatureRemovedPage({
  title,
  description,
  badge = "纯图片 SaaS 模式",
}: FeatureRemovedPageProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center justify-center">
        <div className="w-full rounded-[32px] border border-white/70 bg-white/90 p-8 shadow-[0_28px_90px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600">
            <Sparkles className="h-4 w-4" />
            {badge}
          </div>

          <h1 className="text-3xl font-black tracking-tight text-slate-900">{title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-500">{description}</p>
          <p className="mt-4 text-sm text-slate-400">
            后端当前只保留基于 `service_id + session_id` 的创作、生成和下载链路，登录认领、账户中心、历史归档等用户能力已下线。
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              className="rounded-2xl bg-blue-500 px-6 text-white hover:bg-blue-600"
              onClick={() => setLocation(getResumeFlowPath())}
            >
              继续当前会话
            </Button>
            <Button
              variant="outline"
              className="rounded-2xl border-slate-200 bg-white px-6 text-slate-700 hover:bg-slate-50"
              onClick={() => {
                clearCreateFlow();
                setLocation("/create/upload");
              }}
            >
              开始新的创作
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
