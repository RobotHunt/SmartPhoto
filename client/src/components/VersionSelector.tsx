import React, { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Check, ChevronDown, Clock, Image as ImageIcon, AlertTriangle, Layers } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { VersionSummary } from "@/lib/api";

interface VersionSelectorProps {
  versions: number[];
  currentVersion: number;
  summaries: VersionSummary[];
  onSelectVersion: (version: number) => void;
  isLoading?: boolean;
  className?: string;
  triggerLabel?: React.ReactNode;
}

export function VersionSelector({
  versions,
  currentVersion,
  summaries,
  onSelectVersion,
  isLoading,
  className = "",
  triggerLabel
}: VersionSelectorProps) {
  const [open, setOpen] = useState(false);
  const currentSummary = summaries.find((s) => s.version_no === currentVersion);

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return "";
    try {
      return formatDistanceToNow(new Date(isoString), { addSuffix: true, locale: zhCN });
    } catch {
      return "";
    }
  };
  const jobTypeMap: Record<string, string> = {
    generate_gallery: "初次主图生成",
    regenerate_asset: "局部重绘",
    edit_asset_text: "文案修改",
    strategy_modification: "修改策略重绘",
    generate_detail: "初次长图拼接",
  };
  const resolveJobType = (type?: string) => type ? (jobTypeMap[type] || type) : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
         <Button 
           variant="outline" 
           disabled={isLoading || versions.length <= 1}
           className={`relative justify-between min-w-[200px] h-10 bg-white border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm transition-all ${className}`}
         >
           {triggerLabel ? triggerLabel : (
             <div className="flex items-center gap-2 overflow-hidden text-sm font-bold tracking-widest">
               <Layers className="w-4 h-4 text-blue-600" />
               <span>Version {currentVersion} {currentSummary?.is_partial ? "(部分生成)" : ""}</span>
             </div>
           )}
           <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
         </Button>
      </PopoverTrigger>
      
      <PopoverContent align="end" className="w-[320px] p-0 border-slate-200 bg-white shadow-xl outline-none rounded-2xl overflow-hidden z-[60]">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
           <h3 className="text-sm font-bold tracking-widest text-slate-700">生成历史版本</h3>
           <p className="text-[10px] text-slate-400 mt-1">切换查看过往渲染结果，点击即可回溯</p>
        </div>
        
        <ScrollArea className="h-[360px]">
          <div className="p-2 space-y-1">
            {versions.map((ver) => {
              const sum = summaries.find(s => s.version_no === ver);
              const isActive = ver === currentVersion;
              return (
                <button
                  key={ver}
                  onClick={() => {
                     if (!isActive) onSelectVersion(ver);
                     setOpen(false);
                  }}
                  className={`w-full text-left p-3 rounded-xl transition-all flex gap-3 group relative overflow-hidden ${
                    isActive ? "bg-blue-50 border border-blue-300" : "hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="w-14 h-14 bg-slate-100 rounded-lg shrink-0 overflow-hidden border border-slate-200 relative flex items-center justify-center">
                    {sum?.cover_thumbnail_url ? (
                      <img src={sum.cover_thumbnail_url} className="w-full h-full object-cover" alt="cover" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-slate-600" />
                    )}
                    {(sum?.is_partial || (sum?.missing_panel_ids?.length || 0) > 0 || (sum?.missing_slot_ids?.length || 0) > 0) && (
                      <div className="absolute top-0 right-0 w-2 h-2 m-1 bg-orange-500 rounded-full " title="部分成图或存在缺失" />
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-bold tracking-widest ${isActive ? "text-blue-600" : "text-slate-700"}`}>
                        Version {ver}
                      </span>
                      {isActive && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>{formatTime(sum?.created_at) || "未知时间"}</span>
                      {sum?.job_type && (
                         <>
                           <span className="scale-75 text-slate-600">|</span>
                           <span className="text-blue-500/70 truncate">{resolveJobType(sum.job_type)}</span>
                         </>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-500">
                        {sum?.ready_count ?? 0}/{sum?.asset_count ?? 0} 图完成
                      </span>
                      {sum?.is_partial || (sum?.missing_panel_ids?.length || 0) > 0 || (sum?.missing_slot_ids?.length || 0) > 0 ? (
                        <span className="text-orange-400 flex items-center gap-1 font-medium">
                           <AlertTriangle className="w-3 h-3" />
                           存在图缺
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-medium tracking-wider">完整</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
