import { Check, ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";

// ─── 新版：5步骤固定流程（可点击跳转） ───────────────────────────────────────

export interface CreateStep {
  id: number;
  label: string;
  path: string;
}

export const CREATE_STEPS: CreateStep[] = [
  { id: 1, label: "上传图片", path: "/create/upload" },
  { id: 2, label: "AI识别", path: "/create/analyze" },
  { id: 3, label: "AI参数", path: "/create/generate" },
  { id: 4, label: "文案确认", path: "/create/copywriting" },
  { id: 5, label: "生成图片", path: "/create/result" },
];

interface NewStepIndicatorProps {
  currentStep: number; // 1-based，对应 CREATE_STEPS
  step5Label?: string;  // 覆盖第5步文字，默认「生成图片」
  steps?: never;
}

// ─── 旧版：自定义 steps 数组（向后兼容） ─────────────────────────────────────

interface LegacyStep {
  number: number;
  title: string;
  description: string;
}

interface LegacyStepIndicatorProps {
  currentStep: number;
  steps: LegacyStep[];
}

type StepIndicatorProps = NewStepIndicatorProps | LegacyStepIndicatorProps;

// ─── 组件 ─────────────────────────────────────────────────────────────────────

export function StepIndicator(props: StepIndicatorProps) {
  const [, setLocation] = useLocation();

  // 旧版模式：传入了 steps 数组
  if ("steps" in props && props.steps) {
    const { currentStep, steps } = props;
    return (
      <div className="w-full bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all
                      ${step.number < currentStep
                        ? "bg-blue-500 text-white"
                        : step.number === currentStep
                          ? "bg-blue-500 text-white ring-4 ring-blue-100"
                          : "bg-slate-200 text-slate-500"
                      }
                    `}
                  >
                    {step.number < currentStep ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      step.number
                    )}
                  </div>
                  <div className="mt-2 text-center hidden md:block">
                    <div className={`text-xs font-medium ${step.number <= currentStep ? "text-blue-600" : "text-slate-400"}`}>
                      {step.title}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{step.description}</div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 transition-all ${step.number < currentStep ? "bg-blue-500" : "bg-slate-200"}`} />
                )}
              </div>
            ))}
          </div>
          <div className="md:hidden mt-4 text-center">
            <div className="text-sm font-medium text-blue-600">{steps[currentStep - 1]?.title}</div>
            <div className="text-xs text-slate-500 mt-1">{steps[currentStep - 1]?.description}</div>
          </div>
        </div>
      </div>
    );
  }

  // 新版模式：使用 CREATE_STEPS 固定流程，支持点击跳回已完成步骤
  const { currentStep, step5Label } = props as NewStepIndicatorProps;
  const steps = step5Label
    ? CREATE_STEPS.map(s => s.id === 5 ? { ...s, label: step5Label } : s)
    : CREATE_STEPS;

  const handleStepClick = (step: CreateStep) => {
    // 允许点击任意步骤跳转（当前步骤除外）
    if (step.id !== currentStep) {
      setLocation(step.path);
    }
  };

  return (
    <div className="w-full bg-white border-b border-slate-100 px-4 py-2 sticky top-0 z-50">
      <div className="flex items-center justify-center max-w-md mx-auto">
        {steps.map((step, index) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          const isClickable = step.id !== currentStep;

          return (
            <div key={step.id} className="flex items-center">
              {/* 步骤节点 */}
              <div
                className={`flex flex-col items-center gap-1 ${isClickable ? "cursor-pointer group" : "cursor-default"}`}
                onClick={() => handleStepClick(step)}
              >
                {/* 圆形图标 */}
                <div
                  className={`
                    w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all
                    ${isCompleted
                      ? "bg-emerald-500 text-white shadow-sm shadow-emerald-200 group-hover:bg-emerald-600"
                      : isCurrent
                        ? "bg-blue-500 text-white shadow-sm shadow-blue-200 ring-2 ring-blue-100"
                        : "bg-slate-100 text-slate-400 border border-slate-200"
                    }
                  `}
                >
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  ) : (
                    <span>{step.id}</span>
                  )}
                </div>
                {/* 步骤文字 */}
                <span
                  className={`text-[10px] whitespace-nowrap leading-none transition-all
                    ${isCompleted
                      ? "text-emerald-600 font-medium group-hover:text-emerald-700"
                      : isCurrent
                        ? "text-blue-600 font-bold"
                        : "text-slate-400"
                    }
                  `}
                >
                  {step.label}
                </span>
              </div>

              {/* 连接线 */}
              {index < steps.length - 1 && (
                <div
                  className={`
                    h-[2px] w-6 sm:w-10 mx-1 mb-4 rounded-full transition-all
                    ${step.id < currentStep ? "bg-emerald-400" : "bg-slate-200"}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 同时导出为 default，方便新页面直接 import
export default StepIndicator;
