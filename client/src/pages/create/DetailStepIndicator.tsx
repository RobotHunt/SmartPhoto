import { Check } from "lucide-react";
import { useLocation } from "wouter";

const DETAIL_STEPS = [
  { id: 1, label: "文案确认", path: "/create/copywriting" },
  { id: 2, label: "详情图确认", path: "/create/detail-confirm" },
  { id: 3, label: "支付确认", path: "/create/detail-payment" },
  { id: 4, label: "生成详情图", path: "/create/detail-result" },
] as const;

export function DetailStepIndicator({ currentStep }: { currentStep: 1 | 2 | 3 | 4 }) {
  const [, setLocation] = useLocation();

  return (
    <div className="bg-white border-b border-slate-100 px-4 py-3">
      <div className="flex items-center justify-center gap-1">
        {DETAIL_STEPS.map((step, index) => {
          const done = step.id < currentStep;
          const active = step.id === currentStep;
          const clickable = done;

          return (
            <div key={step.id} className="flex items-center gap-1">
              <div className="flex flex-col items-center gap-1">
                <div
                  onClick={() => clickable && setLocation(step.path)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    done
                      ? "bg-green-500 text-white cursor-pointer hover:bg-green-600"
                      : active
                      ? "bg-blue-500 text-white"
                      : "bg-slate-200 text-slate-400"
                  }`}
                >
                  {done ? <Check className="w-3.5 h-3.5" /> : step.id}
                </div>
                <span
                  onClick={() => clickable && setLocation(step.path)}
                  className={`text-[10px] font-medium whitespace-nowrap ${
                    active
                      ? "text-blue-600"
                      : done
                      ? "text-green-600 cursor-pointer hover:underline"
                      : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < DETAIL_STEPS.length - 1 && (
                <div
                  className={`w-10 h-0.5 mb-4 rounded-full transition-colors ${
                    done ? "bg-green-400" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
