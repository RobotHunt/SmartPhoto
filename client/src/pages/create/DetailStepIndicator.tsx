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
    <div className="w-full bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 py-3 sticky top-0 z-50">
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
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-[0_0_10px_rgba(6,182,212,0.1)] ${
                    done
                      ? "bg-cyan-600 text-white cursor-pointer hover:bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.2)]"
                      : active
                      ? "bg-cyan-500 text-white shadow-[0_0_12px_rgba(6,182,212,0.3)] ring-2 ring-cyan-100"
                      : "bg-slate-100 text-slate-500 border border-slate-200"
                  }`}
                >
                  {done ? <Check className="w-3.5 h-3.5" /> : step.id}
                </div>
                <span
                  onClick={() => clickable && setLocation(step.path)}
                  className={`text-[10px] font-medium whitespace-nowrap transition-all ${
                    active
                      ? "text-cyan-600 font-bold"
                      : done
                      ? "text-cyan-600 cursor-pointer hover:text-cyan-500"
                      : "text-slate-500"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < DETAIL_STEPS.length - 1 && (
                <div
                  className={`w-10 h-[2px] mb-4 rounded-full transition-all ${
                    done ? "bg-cyan-500" : "bg-slate-200"
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
