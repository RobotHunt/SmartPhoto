import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Clock3, FolderOpen, Search, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { clearCreateFlow } from "@/lib/createFlow";

const FLOW_STEPS = [
  {
    step: "01",
    title: "上传商品实拍图",
    description: "至少上传 1 张商品图片，建议带正面图和补充角度图。",
  },
  {
    step: "02",
    title: "AI 识别与策略生成",
    description: "自动分析商品、提取参数并生成适配平台的主图策略。",
  },
  {
    step: "03",
    title: "主图与详情图输出",
    description: "生成主图后可继续进入详情图链路，完整跑通真实创作流程。",
  },
];

export default function Home() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    clearCreateFlow();
  }, []);

  const startCreateFlow = () => {
    clearCreateFlow();
    setLocation("/create/upload");
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/">
            <div className="flex cursor-pointer items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500 shadow-sm">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-base font-bold text-slate-900">AI 电商做图</div>
                <div className="text-xs text-slate-400">SmartPhoto Studio</div>
              </div>
            </div>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            <Link href="/">
              <span className="cursor-pointer text-sm font-medium text-blue-500">首页</span>
            </Link>
            <Link href="/history">
              <span className="cursor-pointer text-sm text-slate-500 transition hover:text-slate-800">
                历史
              </span>
            </Link>
            <Link href="/account">
              <span className="cursor-pointer text-sm text-slate-500 transition hover:text-slate-800">
                账户
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <button className="hidden rounded-xl p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 md:flex">
              <Search className="h-5 w-5" />
            </button>
            <Link href="/account">
              <Button className="rounded-2xl bg-blue-500 px-5 text-white hover:bg-blue-600">
                纯图片模式
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_26%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.05fr_0.95fr] md:items-center md:py-20">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-4 py-2 text-sm text-blue-600">
              <Sparkles className="h-4 w-4" />
              实拍上传，真实后端生成
            </div>

            <h1 className="text-4xl font-black leading-tight tracking-tight text-slate-900 md:text-5xl">
              上传商品图片，
              <br />
              AI 助力一键生图
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-slate-500 md:text-lg">
              从上传、识别、参数、策略到主图与详情图，按真实后端链路完成整套创作流程。
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                className="h-12 rounded-2xl bg-blue-500 px-7 text-base text-white shadow-lg shadow-blue-200 hover:bg-blue-600"
                onClick={startCreateFlow}
              >
                立即生图
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Link href="/history">
                <Button
                  variant="outline"
                  className="h-12 rounded-2xl border-slate-200 bg-white px-7 text-base text-slate-700 hover:bg-slate-50"
                >
                  查看历史
                </Button>
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-5 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-blue-500" />
                支持主图与详情图完整链路
              </div>
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-blue-500" />
                当前会话可继续查看与下载结果
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card className="overflow-hidden rounded-[28px] border-white/60 bg-white/85 p-3 shadow-xl shadow-slate-100">
              <div className="mb-3 text-sm font-semibold text-slate-700">原图</div>
              <div className="aspect-square overflow-hidden rounded-2xl bg-slate-50">
                <img
                  src="/examples/air-purifier-white.jpg"
                  alt="原图示例"
                  className="h-full w-full object-contain p-3"
                />
              </div>
            </Card>
            <Card className="overflow-hidden rounded-[28px] border-white/60 bg-white/85 p-3 shadow-xl shadow-slate-100">
              <div className="mb-3 text-sm font-semibold text-slate-700">生成效果</div>
              <div className="aspect-square overflow-hidden rounded-2xl bg-slate-50">
                <img
                  src="/examples/air-purifier.jpg"
                  alt="生成效果示例"
                  className="h-full w-full object-cover"
                />
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-black text-slate-900 md:text-3xl">三步跑通整条创作链路</h2>
            <p className="mt-3 text-sm text-slate-500 md:text-base">
              保持甲方模板节奏，同时接入真实后端接口与会话流程。
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {FLOW_STEPS.map((item) => (
              <Card
                key={item.step}
                className="rounded-[28px] border-slate-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500 text-sm font-bold text-white">
                  {item.step}
                </div>
                <div className="text-lg font-bold text-slate-900">{item.title}</div>
                <p className="mt-3 text-sm leading-7 text-slate-500">{item.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-10">
        <div className="mx-auto max-w-6xl px-4">
          <div className="rounded-[32px] bg-slate-900 px-6 py-8 text-white md:flex md:items-center md:justify-between md:px-10">
            <div>
              <div className="text-2xl font-black">现在开始新的创作流程</div>
              <p className="mt-2 text-sm text-slate-300 md:text-base">
                系统会自动清空上一次创作会话，从上传页开始新的商品生图流程。
              </p>
            </div>
            <div className="mt-5 md:mt-0">
              <Button
                className="h-12 rounded-2xl bg-white px-7 text-base font-semibold text-slate-900 hover:bg-slate-100"
                onClick={startCreateFlow}
              >
                开始创建
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
