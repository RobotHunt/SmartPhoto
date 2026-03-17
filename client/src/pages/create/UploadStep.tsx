import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { CloudUpload, X, ChevronLeft, FileText } from "lucide-react";
import { StepIndicator } from "@/components/StepIndicator";
import { Button } from "@/components/ui/button";
// [2026-03-16 静态化改造] 注释掉 tRPC import，静态模式下不调用后端上传接口
// import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";

// sessionStorage key：存储每个 slot 的 base64 预览
const STORAGE_KEY = "uploadSlotPreviews";

interface SlotPreview {
  id: string;
  preview: string; // base64 data URL
}

interface UploadSlot {
  id: string;
  label: string;
  image: { file: File | null; preview: string } | null;
  type: 'angle' | 'general';
}

const INITIAL_SLOTS: Omit<UploadSlot, 'image'>[] = [
  { id: 'front', label: '正面图', type: 'angle' },
  { id: 'side', label: '侧面图', type: 'angle' },
  { id: 'top', label: '顶部图', type: 'angle' },
  { id: 'power', label: '产品开机图', type: 'general' },
  { id: 'inner', label: '产品内部图', type: 'general' },
  { id: 'parts', label: '产品配件图', type: 'general' },
];

/** 将 File 转为 base64 data URL */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

/** 从 sessionStorage 读取已保存的预览 */
function loadSavedPreviews(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const list: SlotPreview[] = JSON.parse(raw);
    return Object.fromEntries(list.map(s => [s.id, s.preview]));
  } catch {
    return {};
  }
}

/** 将当前 slots 的预览保存到 sessionStorage */
function savePreviews(slots: UploadSlot[]) {
  const list: SlotPreview[] = slots
    .filter(s => s.image !== null)
    .map(s => ({ id: s.id, preview: s.image!.preview }));
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export default function UploadStep() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  // [2026-03-16 静态化改造] 注释掉 tRPC 上传 mutation，静态模式下不调用后端
  // const uploadImageMutation = trpc.project.uploadImage.useMutation();
  const [isUploading, setIsUploading] = useState(false);

  // 初始化时从 sessionStorage 恢复预览
  const [slots, setSlots] = useState<UploadSlot[]>(() => {
    const saved = loadSavedPreviews();
    return INITIAL_SLOTS.map(s => ({
      ...s,
      image: saved[s.id] ? { file: null, preview: saved[s.id] } : null,
    }));
  });

  // slots 变化时同步到 sessionStorage
  useEffect(() => {
    savePreviews(slots);
  }, [slots]);

  const handleFileSelect = async (files: FileList | null, slotId: string) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    // 转为 base64 以便持久化
    const preview = await fileToBase64(file);
    setSlots(prev => prev.map(slot => {
      if (slot.id === slotId) {
        return { ...slot, image: { file, preview } };
      }
      return slot;
    }));
  };

  const triggerFileInput = (slotId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      handleFileSelect(target.files, slotId);
    };
    input.click();
  };

  const removeImage = (slotId: string) => {
    setSlots(prev => prev.map(slot => {
      if (slot.id === slotId) {
        return { ...slot, image: null };
      }
      return slot;
    }));
  };

  const handleDrop = (e: React.DragEvent, slotId: string) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files, slotId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // --- 原始代码：通过 tRPC 调用后端上传图片（已注释） ---
  // [2026-03-16 静态化改造] 目标：不调后端，直接用 base64 preview 作为图片 URL 存入 sessionStorage
  /*
  const handleStartAnalysis = async () => {
    const uploadedImages = slots.filter(s => s.image !== null);

    if (uploadedImages.length === 0) {
      setLocation("/create/analyze");
      return;
    }

    setIsUploading(true);

    try {
      const uploadedUrls: string[] = [];

      for (const slot of uploadedImages) {
        const preview = slot.image!.preview; // base64 data URL
        const base64Data = preview;

        const result = await uploadImageMutation.mutateAsync({
          imageData: base64Data,
          filename: `${slot.id}.jpg`,
        });

        uploadedUrls.push(result.url);
      }

      sessionStorage.setItem("uploadedImageUrls", JSON.stringify(uploadedUrls));
      sessionStorage.setItem("uploadedCount", uploadedImages.length.toString());

      toast({
        title: "上传成功",
        description: `已上传 ${uploadedImages.length} 张图片`,
      });

      setLocation("/create/analyze");
    } catch (error) {
      console.error("上传失败:", error);
      toast({
        title: "上传失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };
  */

  // --- 新代码：静态模式 Mock 上传，直接用 base64 preview 作为 URL ---
  const handleStartAnalysis = async () => {
    const uploadedImages = slots.filter(s => s.image !== null);

    if (uploadedImages.length === 0) {
      setLocation("/create/analyze");
      return;
    }

    setIsUploading(true);

    try {
      // [2026-03-16 静态化改造] 直接取 base64 preview 当 URL，无需调后端
      const uploadedUrls = uploadedImages.map(slot => slot.image!.preview);

      sessionStorage.setItem("uploadedImageUrls", JSON.stringify(uploadedUrls));
      sessionStorage.setItem("uploadedCount", uploadedImages.length.toString());
      sessionStorage.setItem("firstUploadedImageUrl", uploadedUrls[0]);

      toast({
        title: "上传成功",
        description: `已上传 ${uploadedImages.length} 张图片`,
      });

      setLocation("/create/analyze");
    } catch (error) {
      console.error("上传失败:", error);
      toast({
        title: "上传失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const hasAnyImage = slots.some(s => s.image !== null);

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
            {slots.map((slot) => (
              <div key={slot.id} className="relative">
                {slot.image ? (
                  // 显示图片预览
                  <div className="relative group aspect-square">
                    <div className="w-full h-full rounded-xl overflow-hidden bg-slate-100 border-2 border-slate-200">
                      <img
                        src={slot.image.preview}
                        alt={slot.label}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {/* 删除按钮 */}
                    <button
                      onClick={() => removeImage(slot.id)}
                      className="absolute -top-2 -right-2 w-7 h-7 bg-slate-800 text-white rounded-full flex items-center justify-center hover:bg-slate-900 transition-colors z-10 shadow-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    {/* 标签 */}
                    <div className="absolute bottom-2 left-2 right-2 bg-black/60 text-white text-xs py-1 px-2 rounded text-center">
                      {slot.label}
                    </div>
                  </div>
                ) : (
                  // 显示上传占位框
                  <div
                    onClick={() => triggerFileInput(slot.id)}
                    onDrop={(e) => handleDrop(e, slot.id)}
                    onDragOver={handleDragOver}
                    className="aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-slate-50 flex flex-col items-center justify-center cursor-pointer transition-all"
                  >
                    <CloudUpload className="w-12 h-12 text-slate-400 mb-2" strokeWidth={1.5} />
                    <div className="text-sm text-slate-700 font-medium px-2 text-center">
                      {slot.label}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 格式提示 */}
          <div className="text-center text-sm text-slate-500 mb-8 whitespace-nowrap">
            支持 JPG / PNG，至少上传1张图片即可开始
          </div>

          <Button
            onClick={handleStartAnalysis}
            size="lg"
            className="w-full bg-blue-500 hover:bg-blue-600 text-white text-lg py-6 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!hasAnyImage || isUploading}
          >
            {isUploading ? "上传中..." : "开始AI生图"}
          </Button>

          {/* 返回主页 */}
          <button
            onClick={() => {
              const keys = [
                "uploadSlotPreviews", "uploadedImageUrls", "uploadedCount",
                "uploadedImages", "selectedProductType", "selectedPlatform",
                "selectedTheme", "analysisResult", "productParams",
                "copywritings", "selectedImgCount", "selectedPlans",
                "paymentSuccess", "generatedImages", "hdImages",
              ];
              keys.forEach(k => sessionStorage.removeItem(k));
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
