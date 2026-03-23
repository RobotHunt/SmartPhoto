import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { CloudUpload, X, ChevronLeft } from "lucide-react";
import { StepIndicator } from "@/components/StepIndicator";
import { Button } from "@/components/ui/button";
import { sessionAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ---------- types ----------

type SlotType = "front" | "side" | "top" | "power" | "inner" | "parts";

interface SlotDef {
  slotType: SlotType;
  label: string;
  displayOrder: number;
}

interface SlotState {
  /** backend image id – set after upload completes */
  imageId: string | null;
  /** object-URL or backend URL used for the <img> preview */
  previewUrl: string | null;
  /** true while the upload request is in-flight */
  uploading: boolean;
}

// ---------- constants ----------

const SESSION_KEY = "current_session_id";
const SLOT_IDS_KEY = "upload_slot_image_ids"; // persisted map slotType -> imageId

const SLOT_DEFS: SlotDef[] = [
  { slotType: "front", label: "正面图", displayOrder: 1 },
  { slotType: "angle45", label: "45°角", displayOrder: 2 },
  { slotType: "side", label: "侧面图", displayOrder: 3 },
  { slotType: "extra_1", label: "补充图1", displayOrder: 4 },
  { slotType: "extra_2", label: "补充图2", displayOrder: 5 },
  { slotType: "extra_3", label: "补充图3", displayOrder: 6 },
];

// ---------- helpers ----------

/** Load the persisted slotType->imageId map from sessionStorage. */
function loadPersistedSlotIds(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(SLOT_IDS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Persist the slotType->imageId map to sessionStorage. */
function persistSlotIds(map: Record<string, string>) {
  sessionStorage.setItem(SLOT_IDS_KEY, JSON.stringify(map));
}

// ---------- component ----------

export default function UploadStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Session id – initialised on mount
  const [sessionId, setSessionId] = useState<string | null>(
    () => sessionStorage.getItem(SESSION_KEY),
  );
  const sessionCreating = useRef(false);

  // Per-slot upload state
  const [slots, setSlots] = useState<Record<SlotType, SlotState>>(() => {
    const persisted = loadPersistedSlotIds();
    const initial: Record<string, SlotState> = {};
    for (const def of SLOT_DEFS) {
      initial[def.slotType] = {
        imageId: persisted[def.slotType] ?? null,
        // If we have a persisted imageId we cannot recover the preview URL
        // without a network call; we will hydrate previews in an effect below.
        previewUrl: null,
        uploading: false,
      };
    }
    return initial as Record<SlotType, SlotState>;
  });

  // Track whether we are navigating away (to disable button)
  const [navigating, setNavigating] = useState(false);

  // ---- ensure a backend session exists ----

  useEffect(() => {
    if (sessionId) return;
    if (sessionCreating.current) return;
    sessionCreating.current = true;

    (async () => {
      try {
        const res = await sessionAPI.create();
        const id = res.session_id;
        sessionStorage.setItem(SESSION_KEY, id);
        setSessionId(id);
      } catch (err) {
        console.error("Failed to create session:", err);
        toast({
          title: "\u521b\u5efa\u4f1a\u8bdd\u5931\u8d25",
          description: "\u8bf7\u5237\u65b0\u9875\u9762\u91cd\u8bd5",
          variant: "destructive",
        });
      } finally {
        sessionCreating.current = false;
      }
    })();
  }, [sessionId, toast]);

  // ---- hydrate preview URLs for images that were persisted (page refresh) ----

  useEffect(() => {
    if (!sessionId) return;

    // Check if any slot has an imageId but no previewUrl
    const needsHydration = SLOT_DEFS.some(
      (d) => slots[d.slotType].imageId && !slots[d.slotType].previewUrl,
    );
    if (!needsHydration) return;

    (async () => {
      try {
        const images: any[] = await sessionAPI.listImages(sessionId);
        if (!images || images.length === 0) return;

        setSlots((prev) => {
          const next = { ...prev };
          for (const img of images) {
            const st = img.slot_type as SlotType;
            if (next[st] && next[st].imageId === img.image_id) {
              next[st] = { ...next[st], previewUrl: img.url };
            }
          }
          return next;
        });
      } catch (err) {
        console.error("Failed to list images for preview hydration:", err);
      }
    })();
    // Only run once when sessionId becomes available
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ---- persist slot image ids whenever they change ----

  useEffect(() => {
    const map: Record<string, string> = {};
    for (const def of SLOT_DEFS) {
      const id = slots[def.slotType].imageId;
      if (id) map[def.slotType] = id;
    }
    persistSlotIds(map);
  }, [slots]);

  // ---- file selection & upload ----

  const uploadFile = useCallback(
    async (file: File, slotType: SlotType, displayOrder: number) => {
      // Wait for session if still creating
      let sid = sessionId;
      if (!sid) {
        // Try to read from sessionStorage (may have been set by concurrent creation)
        sid = sessionStorage.getItem(SESSION_KEY);
        if (sid) {
          setSessionId(sid);
        }
      }
      if (!sid) {
        // Still no session - create one synchronously
        try {
          const res = await sessionAPI.create();
          sid = res.session_id;
          sessionStorage.setItem(SESSION_KEY, sid);
          setSessionId(sid);
        } catch {
          toast({ title: "创建会话失败", description: "请刷新页面重试", variant: "destructive" });
          return;
        }
      }

      // Immediately show a local preview
      const localPreview = URL.createObjectURL(file);
      setSlots((prev) => ({
        ...prev,
        [slotType]: { imageId: null, previewUrl: localPreview, uploading: true },
      }));

      try {
        const backendSlotType = slotType.startsWith("extra") ? "extra" : slotType;
        const res = await sessionAPI.uploadImage(sid, file, backendSlotType, displayOrder);
        setSlots((prev) => ({
          ...prev,
          [slotType]: {
            imageId: res.image_id,
            previewUrl: res.url || localPreview,
            uploading: false,
          },
        }));
      } catch (err: any) {
        console.error(`Upload failed for slot ${slotType}:`, err);
        // Revoke the object URL and reset
        URL.revokeObjectURL(localPreview);
        setSlots((prev) => ({
          ...prev,
          [slotType]: { imageId: null, previewUrl: null, uploading: false },
        }));
        toast({
          title: "\u4e0a\u4f20\u5931\u8d25",
          description: err.message || "\u8bf7\u7a0d\u540e\u91cd\u8bd5",
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
      input.onchange = (e) => {
        const target = e.target as HTMLInputElement;
        handleFileSelect(target.files, slotType, displayOrder);
      };
      input.click();
    },
    [handleFileSelect],
  );

  // ---- remove image ----

  const removeImage = useCallback(
    async (slotType: SlotType) => {
      const imageId = slots[slotType].imageId;
      const prevPreview = slots[slotType].previewUrl;

      // Optimistically clear the slot
      setSlots((prev) => ({
        ...prev,
        [slotType]: { imageId: null, previewUrl: null, uploading: false },
      }));

      if (sessionId && imageId) {
        try {
          await sessionAPI.deleteImage(sessionId, imageId);
        } catch (err) {
          console.error(`Delete failed for ${slotType}:`, err);
          // Restore slot on failure
          setSlots((prev) => ({
            ...prev,
            [slotType]: { imageId, previewUrl: prevPreview, uploading: false },
          }));
          toast({
            title: "\u5220\u9664\u5931\u8d25",
            description: "\u8bf7\u7a0d\u540e\u91cd\u8bd5",
            variant: "destructive",
          });
        }
      }
    },
    [sessionId, slots, toast],
  );

  // ---- drag & drop ----

  const handleDrop = useCallback(
    (e: React.DragEvent, slotType: SlotType, displayOrder: number) => {
      e.preventDefault();
      handleFileSelect(e.dataTransfer.files, slotType, displayOrder);
    },
    [handleFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // ---- navigate to analysis ----

  const handleStartAnalysis = useCallback(() => {
    const hasImage = SLOT_DEFS.some((d) => slots[d.slotType].imageId);
    if (!hasImage) {
      toast({
        title: "\u8bf7\u5148\u4e0a\u4f20\u56fe\u7247",
        description: "\u81f3\u5c11\u4e0a\u4f20 1 \u5f20\u56fe\u7247\u624d\u80fd\u5f00\u59cb",
        variant: "destructive",
      });
      return;
    }

    setNavigating(true);
    setLocation("/create/analyze");
  }, [slots, toast, setLocation]);

  // ---- derived state ----

  const hasAnyImage = SLOT_DEFS.some((d) => slots[d.slotType].imageId);
  const anyUploading = SLOT_DEFS.some((d) => slots[d.slotType].uploading);

  // ---- render ----

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <StepIndicator currentStep={1} />
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* 标题区域 */}
        <div className="text-center mb-8">
          <h1 className="text-xl md:text-4xl font-bold text-slate-900 leading-snug">
            上传产品图片，AI助力一键生图
          </h1>
          <p className="mt-4 text-xs text-slate-400 whitespace-nowrap">
            ✨ 温馨提示：上传素材越多，生成越精准；手机实拍即可
          </p>
        </div>

        {/* 主卡片区域 */}
        <div className="bg-white rounded-3xl shadow-lg p-8 md:p-12">
          {/* 上传框网格 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {SLOT_DEFS.map((def) => {
              const slot = slots[def.slotType];
              const hasPreview = !!slot.previewUrl;

              return (
                <div key={def.slotType} className="relative">
                  {hasPreview ? (
                    /* 显示图片预览 */
                    <div className="relative group aspect-square">
                      <div className="w-full h-full rounded-xl overflow-hidden bg-slate-100 border-2 border-slate-200">
                        <img
                          src={slot.previewUrl!}
                          alt={def.label}
                          className="w-full h-full object-cover"
                        />
                        {slot.uploading && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                      {/* 删除按钮 */}
                      <button
                        onClick={() => removeImage(def.slotType)}
                        disabled={slot.uploading}
                        className="absolute -top-2 -right-2 w-7 h-7 bg-slate-800 text-white rounded-full flex items-center justify-center hover:bg-slate-900 transition-colors z-10 shadow-lg disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      {/* 标签 */}
                      <div className="absolute bottom-2 left-2 right-2 bg-black/60 text-white text-xs py-1 px-2 rounded text-center">
                        {def.label}
                      </div>
                    </div>
                  ) : (
                    /* 显示上传占位框 */
                    <div
                      onClick={() => triggerFileInput(def.slotType, def.displayOrder)}
                      onDrop={(e) => handleDrop(e, def.slotType, def.displayOrder)}
                      onDragOver={handleDragOver}
                      className="aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-slate-50 flex flex-col items-center justify-center cursor-pointer transition-all"
                    >
                      <CloudUpload className="w-12 h-12 text-slate-400 mb-2" strokeWidth={1.5} />
                      <div className="text-sm text-slate-700 font-medium px-2 text-center">
                        {def.label}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 格式提示 */}
          <div className="text-center text-sm text-slate-500 mb-8 whitespace-nowrap">
            支持 JPG / PNG，至少上传1张图片即可开始
          </div>

          <Button
            onClick={handleStartAnalysis}
            size="lg"
            className="w-full bg-blue-500 hover:bg-blue-600 text-white text-lg py-6 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!hasAnyImage || anyUploading || navigating}
          >
            {anyUploading ? "上传中..." : navigating ? "跳转中..." : "开始AI生图"}
          </Button>

          {/* 返回主页 */}
          <button
            onClick={() => {
              const keys = [
                SLOT_IDS_KEY,
                "uploadedImageUrls",
                "uploadedCount",
                "uploadedImages",
                "selectedProductType",
                "selectedPlatform",
                "selectedTheme",
                "analysisResult",
                "productParams",
                "copywritings",
                "selectedImgCount",
                "selectedPlans",
                "paymentSuccess",
                "generatedImages",
                "hdImages",
                SESSION_KEY,
              ];
              keys.forEach((k) => sessionStorage.removeItem(k));
              setLocation("/");
            }}
            className="mt-3 w-full flex items-center justify-center gap-1 text-slate-400 hover:text-slate-600 text-sm transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            返回主页
          </button>
        </div>
      </div>
    </div>
  );
}
