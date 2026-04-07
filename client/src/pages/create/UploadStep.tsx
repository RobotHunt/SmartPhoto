import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, CloudUpload, X } from "lucide-react";

import { StepIndicator } from "@/components/StepIndicator";
import { Button } from "@/components/ui/button";
import { sessionAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { addSessionRecord } from "@/lib/localUser";
import { ANALYSIS_SUPPLEMENT_LIST_KEY, type SupplementRecommendation } from "@/lib/analysisSnapshot";

type SlotType = string;

interface SlotDef {
  slotType: SlotType;
  label: string;
  displayOrder: number;
  recommendation?: SupplementRecommendation;
}

interface SlotState {
  imageId: string | null;
  previewUrl: string | null;
  uploading: boolean;
}


const SESSION_KEY = "current_session_id";
const SLOT_IDS_KEY = "upload_slot_image_ids";
const ANALYSIS_DIRTY_KEY = "analysis_dirty";

const SLOT_DEFS: SlotDef[] = [
  { slotType: "front", label: "正面图", displayOrder: 1 },
  { slotType: "side", label: "侧面图", displayOrder: 2 },
  { slotType: "angle45", label: "顶部图", displayOrder: 3 },
  { slotType: "extra_1", label: "产品开机图", displayOrder: 4 },
  { slotType: "extra_2", label: "产品内部图", displayOrder: 5 },
  { slotType: "extra_3", label: "产品配件图", displayOrder: 6 },
];

function loadPersistedSlotIds(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(SLOT_IDS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistSlotIds(map: Record<string, string>) {
  sessionStorage.setItem(SLOT_IDS_KEY, JSON.stringify(map));
}

function markAnalysisDirty() {
  sessionStorage.setItem(ANALYSIS_DIRTY_KEY, "1");
  sessionStorage.removeItem("analysis_snapshot_full");
  sessionStorage.removeItem("analysisResult");
}

const MAX_DIMENSION = 2048;
const COMPRESS_QUALITY = 0.85;

function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/") || file.type === "image/gif") {
      resolve(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width <= MAX_DIMENSION && height <= MAX_DIMENSION && file.size <= 2 * 1024 * 1024) {
        resolve(file);
        return;
      }

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file);
            return;
          }
          const compressed = new File([blob], file.name, {
            type: file.type === "image/png" ? "image/png" : "image/jpeg",
            lastModified: Date.now(),
          });
          resolve(compressed);
        },
        file.type === "image/png" ? "image/png" : "image/jpeg",
        COMPRESS_QUALITY,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

export default function UploadStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [sessionId, setSessionId] = useState<string | null>(() =>
    sessionStorage.getItem(SESSION_KEY),
  );
  const [recommendations] = useState<SupplementRecommendation[]>(() => {
    try {
      const raw = sessionStorage.getItem(ANALYSIS_SUPPLEMENT_LIST_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const allSlotDefs = useMemo(() => {
    const uniqueDefs = new Map<string, SlotDef>();
    
    // AI Recommendations go first
    recommendations.forEach((rec, idx) => {
      const st = rec.slot_type || `rec_${idx}`;
      uniqueDefs.set(st, {
        slotType: st,
        label: rec.label || "补充图片",
        displayOrder: -rec.priority || -1,
        recommendation: rec,
      });
    });

    // Fallback standard slots
    SLOT_DEFS.forEach((def) => {
      if (!uniqueDefs.has(def.slotType)) {
        uniqueDefs.set(def.slotType, def);
      }
    });

    return Array.from(uniqueDefs.values());
  }, [recommendations]);

  const [slots, setSlots] = useState<Record<SlotType, SlotState>>(() => {
    const persisted = loadPersistedSlotIds();
    const initial = {} as Record<SlotType, SlotState>;
    
    for (const def of SLOT_DEFS) {
      initial[def.slotType] = { imageId: persisted[def.slotType] ?? null, previewUrl: null, uploading: false };
    }
    
    let raw: SupplementRecommendation[] = [];
    try {
      const str = sessionStorage.getItem(ANALYSIS_SUPPLEMENT_LIST_KEY);
      if (str) raw = JSON.parse(str);
    } catch {}
    
    raw.forEach((rec, idx) => {
      const st = rec.slot_type || `rec_${idx}`;
      initial[st] = { imageId: persisted[st] ?? null, previewUrl: null, uploading: false };
    });

    for (const key of Object.keys(persisted)) {
      if (!initial[key]) initial[key] = { imageId: persisted[key], previewUrl: null, uploading: false };
    }

    return initial;
  });
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    const needsHydration = allSlotDefs.some((def) => {
      const slot = slots[def.slotType];
      return slot && !!slot.imageId && !slot.previewUrl;
    });
    if (!needsHydration) return;

    let cancelled = false;
    const slotOrder = new Map(allSlotDefs.map((def) => [def.displayOrder, def.slotType]));

    (async () => {
      try {
        const images = await sessionAPI.listImages(sessionId);
        if (cancelled || !images.length) return;

        setSlots((prev) => {
          const next = { ...prev };
          for (const image of images) {
            const preferredSlot =
              (image.slot_type === "extra"
                ? slotOrder.get(Number(image.display_order || 0))
                : image.slot_type) as SlotType | undefined;
            const fallbackSlot =
              slotOrder.get(Number(image.display_order || 0)) ||
              (image.slot_type ? (`${image.slot_type}` as SlotType) : undefined);
            const slotType = preferredSlot && next[preferredSlot] ? preferredSlot : fallbackSlot;

            if (!slotType || !next[slotType]) continue;
            next[slotType] = {
              imageId: image.image_id,
              previewUrl: image.url,
              uploading: false,
            };
          }
          return next;
        });
      } catch (error) {
        console.error("Failed to hydrate uploaded images:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, slots]);

  useEffect(() => {
    const map: Record<string, string> = {};
    for (const def of allSlotDefs) {
      const imageId = slots[def.slotType]?.imageId;
      if (imageId) map[def.slotType] = imageId;
    }
    persistSlotIds(map);
  }, [allSlotDefs, slots]);

  const uploadFile = useCallback(
    async (file: File, slotType: SlotType, displayOrder: number) => {
      let sid = sessionId || sessionStorage.getItem(SESSION_KEY);

      if (!sid) {
        try {
          const created = await sessionAPI.create();
          sid = created.session_id;
          sessionStorage.setItem(SESSION_KEY, sid);
          setSessionId(sid);
          addSessionRecord({
            session_id: sid,
            product_name: "",
            platform: "",
            thumbnail_url: "",
            created_at: new Date().toISOString(),
            last_step: "upload",
            image_count: 0,
          });
        } catch (error: any) {
          toast({
            title: "创建会话失败",
            description: error?.message || "请刷新页面后重试。",
            variant: "destructive",
          });
          return;
        }
      }

      const localPreview = URL.createObjectURL(file);
      setSlots((prev) => ({
        ...prev,
        [slotType]: { imageId: null, previewUrl: localPreview, uploading: true },
      }));

      try {
        const compressed = await compressImage(file);
        const backendSlotType = slotType.startsWith("extra") ? "extra" : slotType;
        const uploaded = await sessionAPI.uploadImage(sid, compressed, backendSlotType, displayOrder);
        markAnalysisDirty();

        setSlots((prev) => ({
          ...prev,
          [slotType]: {
            imageId: uploaded.image_id,
            previewUrl: uploaded.url || localPreview,
            uploading: false,
          },
        }));
      } catch (error: any) {
        URL.revokeObjectURL(localPreview);
        setSlots((prev) => ({
          ...prev,
          [slotType]: { imageId: null, previewUrl: null, uploading: false },
        }));
        toast({
          title: "上传失败",
          description: error?.message || "请稍后重试。",
          variant: "destructive",
        });
      }
    },
    [sessionId, toast],
  );

  const handleFileSelect = useCallback(
    (files: FileList | null, slotType: SlotType, displayOrder: number) => {
      if (!files || files.length === 0) return;
      uploadFile(files[0], slotType, displayOrder);
    },
    [uploadFile],
  );

  const triggerFileInput = useCallback(
    (slotType: SlotType, displayOrder: number) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = (event) => {
        const target = event.target as HTMLInputElement;
        handleFileSelect(target.files, slotType, displayOrder);
      };
      input.click();
    },
    [handleFileSelect],
  );

  const removeImage = useCallback(
    async (slotType: SlotType) => {
      const current = slots[slotType];
      if (!current.imageId) return;

      setSlots((prev) => ({
        ...prev,
        [slotType]: { imageId: null, previewUrl: null, uploading: false },
      }));

      try {
        if (sessionId) {
          await sessionAPI.deleteImage(sessionId, current.imageId);
          markAnalysisDirty();
        }
      } catch (error) {
        console.error("Delete image failed:", error);
        setSlots((prev) => ({
          ...prev,
          [slotType]: current,
        }));
        toast({
          title: "删除失败",
          description: "请稍后重试。",
          variant: "destructive",
        });
      }
    },
    [sessionId, slots, toast],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent, slotType: SlotType, displayOrder: number) => {
      event.preventDefault();
      handleFileSelect(event.dataTransfer.files, slotType, displayOrder);
    },
    [handleFileSelect],
  );

  const handleStartAnalysis = useCallback(() => {
    const hasImage = allSlotDefs.some((def) => !!slots[def.slotType]?.imageId);
    if (!hasImage) {
      toast({
        title: "请先上传图片",
        description: "至少上传 1 张图片后才能开始AI生图。",
        variant: "destructive",
      });
      return;
    }

    sessionStorage.removeItem(ANALYSIS_SUPPLEMENT_LIST_KEY);
    setNavigating(true);
    setLocation("/create/analyze");
  }, [allSlotDefs, slots, toast, setLocation]);

  const hasAnyImage = useMemo(
    () => allSlotDefs.some((def) => !!slots[def.slotType]?.imageId),
    [allSlotDefs, slots],
  );
  const anyUploading = useMemo(
    () => allSlotDefs.some((def) => slots[def.slotType]?.uploading),
    [allSlotDefs, slots],
  );

  const aiRecommendations = allSlotDefs.filter(d => !!d.recommendation);
  const standardDefs = allSlotDefs.filter(d => !d.recommendation);

  const renderSlot = (def: typeof allSlotDefs[0]) => {
    const slot = slots[def.slotType];
    const hasPreview = !!slot?.previewUrl;
    const isRec = !!def.recommendation;

    return (
      <div key={def.slotType} className="relative">
        {hasPreview ? (
          <div className="relative flex aspect-square flex-col">
            <div className={`relative h-full w-full overflow-hidden rounded-2xl border-2 ${isRec ? 'border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : 'border-white/20'} bg-slate-800/50`}>
              <img
                src={slot.previewUrl!}
                alt={def.label}
                className="h-full w-full object-cover"
              />
              {slot.uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/80 border-t-transparent" />
                </div>
              )}
              {isRec && (
                <div className="absolute top-0 left-0 bg-orange-500/90 text-white text-[10px] px-2 py-0.5 rounded-br-lg font-bold tracking-widest backdrop-blur-md">
                  AI 推荐
                </div>
              )}
            </div>

            <button
              onClick={() => removeImage(def.slotType)}
              disabled={slot.uploading}
              className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-600 disabled:opacity-50 z-10"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-black/70 backdrop-blur-sm px-2 py-1 text-center text-xs text-white border border-white/10">
              {def.label}
            </div>
          </div>
        ) : (
          <div
            onClick={() => triggerFileInput(def.slotType, def.displayOrder)}
            onDrop={(event) => handleDrop(event, def.slotType, def.displayOrder)}
            onDragOver={(event) => event.preventDefault()}
            className={`flex aspect-square cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition relative overflow-hidden group ${
              isRec 
                ? 'border-orange-500/60 bg-orange-950/20 hover:border-orange-400 hover:bg-orange-900/30' 
                : 'border-slate-600 bg-slate-900/40 hover:border-cyan-500/50 hover:bg-cyan-950/30'
            }`}
          >
            {isRec && (
              <div className="absolute top-0 left-0 bg-orange-500/90 text-white text-[10px] px-2 py-0.5 rounded-br-lg font-bold tracking-widest z-10">
                AI 推荐
              </div>
            )}
            
            <CloudUpload className={`mb-2 h-8 w-8 ${isRec ? 'text-orange-400/80 group-hover:text-orange-400' : 'text-slate-500 group-hover:text-cyan-400'}`} strokeWidth={1.5} />
            <div className={`px-2 text-center text-sm font-bold tracking-widest mb-1 ${isRec ? 'text-orange-300' : 'text-slate-300'}`}>
              {def.label}
            </div>
            
            {isRec && def.recommendation && (
              <div className="px-3 mt-1 w-full flex flex-col gap-1 text-[10px]">
                {def.recommendation.must_show && (
                  <div className="bg-orange-500/10 border border-orange-500/20 text-orange-200/90 px-1.5 py-0.5 rounded truncate w-full text-center" title={`必拍: ${def.recommendation.must_show}`}>
                    必拍: {def.recommendation.must_show}
                  </div>
                )}
                {def.recommendation.framing_hint && (
                  <div className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-200/90 px-1.5 py-0.5 rounded truncate w-full text-center" title={`构图: ${def.recommendation.framing_hint}`}>
                    构图: {def.recommendation.framing_hint}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen aurora-bg">
      <StepIndicator currentStep={1} />

      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">上传商品原图</h1>
            <p className="text-sm text-slate-300 mt-1">支持批量上传，单张最大10MB</p>
          </div>
        </div>

        {aiRecommendations.length > 0 && (
          <div className="glass-panel border-orange-500/20 rounded-3xl p-6 md:p-8 mb-6 shadow-[0_0_30px_rgba(249,115,22,0.05)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 blur-[80px] pointer-events-none rounded-full" />
            <h2 className="text-lg font-bold text-orange-400 tracking-widest mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              AI 智能缺图推荐
            </h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 relative z-10">
              {aiRecommendations.map(renderSlot)}
            </div>
          </div>
        )}

        <div className="glass-panel border-white/10 rounded-3xl p-6 md:p-8 mb-8 shadow-xl">
          {aiRecommendations.length > 0 && (
            <h2 className="text-sm font-bold text-slate-400 tracking-widest mb-4">常规视角补充</h2>
          )}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {standardDefs.map(renderSlot)}
          </div>

          <div className="mt-8 text-center text-sm text-slate-400">
            支持 JPG / PNG，至少上传1张图片即可开始
          </div>

          <Button
            onClick={handleStartAnalysis}
            size="lg"
            disabled={!hasAnyImage || anyUploading || navigating}
            className="mt-8 h-14 w-full rounded-2xl sci-fi-button text-base font-semibold text-white shadow-lg shadow-blue-100 disabled:cursor-not-allowed"
          >
            {anyUploading ? "图片上传中..." : navigating ? "正在进入识别..." : "开始AI生图"}
          </Button>

          <button
            onClick={() => {
              sessionStorage.removeItem(ANALYSIS_SUPPLEMENT_LIST_KEY);
              setLocation("/");
            }}
            className="mt-4 flex w-full items-center justify-center gap-1 text-sm text-slate-400 transition hover:text-slate-600"
          >
            <ChevronLeft className="h-4 w-4" />
            返回首页
          </button>
        </div>
      </div>
    </div>
  );
}
