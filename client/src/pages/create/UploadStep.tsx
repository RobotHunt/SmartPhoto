import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, CloudUpload, X } from "lucide-react";

import { StepIndicator } from "@/components/StepIndicator";
import { Button } from "@/components/ui/button";
import { sessionAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type SlotType = "front" | "angle45" | "side" | "extra_1" | "extra_2" | "extra_3";

interface SlotDef {
  slotType: SlotType;
  label: string;
  displayOrder: number;
}

interface SlotState {
  imageId: string | null;
  previewUrl: string | null;
  uploading: boolean;
}

const SESSION_KEY = "current_session_id";
const SLOT_IDS_KEY = "upload_slot_image_ids";
const ANALYSIS_DIRTY_KEY = "analysis_dirty";
const ANALYZE_SUPPLEMENT_KEY = "from_analyze_supplement";

const SLOT_DEFS: SlotDef[] = [
  { slotType: "front", label: "正面图", displayOrder: 1 },
  { slotType: "angle45", label: "45°角", displayOrder: 2 },
  { slotType: "side", label: "侧面图", displayOrder: 3 },
  { slotType: "extra_1", label: "补充图1", displayOrder: 4 },
  { slotType: "extra_2", label: "补充图2", displayOrder: 5 },
  { slotType: "extra_3", label: "补充图3", displayOrder: 6 },
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

export default function UploadStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [sessionId, setSessionId] = useState<string | null>(() =>
    sessionStorage.getItem(SESSION_KEY),
  );
  const [slots, setSlots] = useState<Record<SlotType, SlotState>>(() => {
    const persisted = loadPersistedSlotIds();
    const initial = {} as Record<SlotType, SlotState>;
    for (const def of SLOT_DEFS) {
      initial[def.slotType] = {
        imageId: persisted[def.slotType] ?? null,
        previewUrl: null,
        uploading: false,
      };
    }
    return initial;
  });
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    const needsHydration = SLOT_DEFS.some((def) => {
      const slot = slots[def.slotType];
      return !!slot.imageId && !slot.previewUrl;
    });
    if (!needsHydration) return;

    let cancelled = false;
    const slotOrder = new Map(SLOT_DEFS.map((def) => [def.displayOrder, def.slotType]));

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
    for (const def of SLOT_DEFS) {
      const imageId = slots[def.slotType].imageId;
      if (imageId) map[def.slotType] = imageId;
    }
    persistSlotIds(map);
  }, [slots]);

  const uploadFile = useCallback(
    async (file: File, slotType: SlotType, displayOrder: number) => {
      let sid = sessionId || sessionStorage.getItem(SESSION_KEY);

      if (!sid) {
        try {
          const created = await sessionAPI.create();
          sid = created.session_id;
          sessionStorage.setItem(SESSION_KEY, sid);
          setSessionId(sid);
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
        const backendSlotType = slotType.startsWith("extra") ? "extra" : slotType;
        const uploaded = await sessionAPI.uploadImage(sid, file, backendSlotType, displayOrder);
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
    const hasImage = SLOT_DEFS.some((def) => !!slots[def.slotType].imageId);
    if (!hasImage) {
      toast({
        title: "请先上传图片",
        description: "至少上传 1 张图片后才能进入 AI 识别。",
        variant: "destructive",
      });
      return;
    }

    setNavigating(true);
    setLocation("/create/analyze");
  }, [setLocation, slots, toast]);

  const hasAnyImage = useMemo(
    () => SLOT_DEFS.some((def) => !!slots[def.slotType].imageId),
    [slots],
  );
  const anyUploading = useMemo(
    () => SLOT_DEFS.some((def) => slots[def.slotType].uploading),
    [slots],
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <StepIndicator currentStep={1} />

      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-5xl">
            上传产品图片，AI 助力一键生图
          </h1>
          <p className="mt-4 text-sm text-slate-400 md:text-base">
            温馨提示：素材越丰富，结果越稳定；手机实拍图即可直接开始。
          </p>
        </div>

        <div className="rounded-[32px] bg-white p-8 shadow-lg shadow-slate-100 md:p-10">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {SLOT_DEFS.map((def) => {
              const slot = slots[def.slotType];
              const hasPreview = !!slot.previewUrl;

              return (
                <div key={def.slotType} className="relative">
                  {hasPreview ? (
                    <div className="relative aspect-square">
                      <div className="h-full w-full overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-100">
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
                      </div>

                      <button
                        onClick={() => removeImage(def.slotType)}
                        disabled={slot.uploading}
                        className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-white shadow-lg transition hover:bg-slate-900 disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                      </button>

                      <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-black/60 px-2 py-1 text-center text-xs text-white">
                        {def.label}
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => triggerFileInput(def.slotType, def.displayOrder)}
                      onDrop={(event) => handleDrop(event, def.slotType, def.displayOrder)}
                      onDragOver={(event) => event.preventDefault()}
                      className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 transition hover:border-blue-400 hover:bg-slate-50"
                    >
                      <CloudUpload className="mb-3 h-12 w-12 text-slate-400" strokeWidth={1.5} />
                      <div className="px-2 text-center text-sm font-medium text-slate-700">
                        {def.label}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-8 text-center text-sm text-slate-500">
            支持 JPG / PNG，至少上传 1 张图片即可开始
          </div>

          <Button
            onClick={handleStartAnalysis}
            size="lg"
            disabled={!hasAnyImage || anyUploading || navigating}
            className="mt-8 h-14 w-full rounded-2xl bg-blue-500 text-base font-semibold text-white shadow-lg shadow-blue-100 hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {anyUploading ? "图片上传中..." : navigating ? "正在进入识别..." : "开始 AI 识别"}
          </Button>

          <button
            onClick={() => setLocation("/")}
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
