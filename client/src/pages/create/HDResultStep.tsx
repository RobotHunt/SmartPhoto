import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  Loader2,
  Crown,
  FileText,
  Share2,
  Pencil,
  Check,
  CloudUpload,
  X,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Download,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { StepIndicator } from "@/components/StepIndicator";
import GenerationWaitingUI from "@/components/GenerationWaitingUI";
import { useToast } from "@/hooks/use-toast";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/contexts/AuthContext";
import { resolveAssetLabel } from "@/lib/assetLabels";
import {
  assetAPI,
  jobAPI,
  sessionAPI,
  type MainGalleryCopyBlocks,
  type PromptPreviewItem,
  type SessionResults,
  type StrategyOverrideItem,
} from "@/lib/api";
import {
  copyLinesToTextarea,
  resolveMainGalleryAssetCopy,
  textareaToCopyLines,
  upsertStrategyOverride,
} from "@/lib/mainGalleryCopy";
import { updateSessionRecord } from "@/lib/localUser";

type PreviewImage = {
  id: string;
  role: string;
  slot_id: string;
  display_order: number;
  type: string;
  product: string;
  url: string;
  editOpen: boolean;
  isRegenerating: boolean;
  resolved_slot_id: string | null;
  copy_blocks: MainGalleryCopyBlocks;
};

type Phase = "loading" | "preview" | "hd-loading" | "hd-done";

function buildPreviewImages(
  results: SessionResults,
  prompts: PromptPreviewItem[],
  overrides: StrategyOverrideItem[],
  productName: string,
): PreviewImage[] {
  return (results.assets ?? []).map((asset, index) => {
    const resolved = resolveMainGalleryAssetCopy(asset, prompts, overrides);
    return {
      id: asset.asset_id,
      role: asset.role,
      slot_id: asset.slot_id || "",
      display_order: asset.display_order ?? index,
      type: resolveAssetLabel(asset.role, asset.slot_id || ""),
      product: productName,
      url: asset.image_url,
      editOpen: false,
      isRegenerating: false,
      resolved_slot_id: resolved.slotId,
      copy_blocks: resolved.copyBlocks,
    };
  });
}

export default function HDResultStep() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  const [phase, setPhase] = useState<Phase>("loading");
  const [images, setImages] = useState<PreviewImage[]>([]);
  const [promptPreviews, setPromptPreviews] = useState<PromptPreviewItem[]>([]);
  const [strategyOverrides, setStrategyOverrides] = useState<StrategyOverrideItem[]>([]);
  const [progress, setProgress] = useState(0);
  const [hdProgress, setHdProgress] = useState(0);
  const generateStartRef = useRef(Date.now());
  const [downloading, setDownloading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const sessionId = sessionStorage.getItem("current_session_id") || "";
  const unlockedVersion =
    sessionStorage.getItem("hd_unlocked_version") ||
    sessionStorage.getItem("current_result_version") ||
    "1";
  const productName =
    sessionStorage.getItem("selectedProductType") ||
    (() => {
      try {
        const raw = sessionStorage.getItem("analysisResult");
        return raw ? JSON.parse(raw).product_name : "";
      } catch {
        return "";
      }
    })() ||
    "产品";

  const loadImages = useCallback(async () => {
    if (!sessionId) return [];

    const [results, promptPreviewRes, overrideRes] = await Promise.all([
      sessionAPI.getResults(sessionId, Number(unlockedVersion)),
      sessionAPI.previewPrompts(sessionId, { include_latest_assets: true }).catch(() => null),
      sessionAPI.getStrategyOverrides(sessionId).catch(() => null),
    ]);

    const prompts = promptPreviewRes?.prompts || [];
    const overrides = overrideRes?.overrides || [];
    const all = buildPreviewImages(results, prompts, overrides, productName);

    const selectedRaw = sessionStorage.getItem("selected_asset_ids");
    const selectedIds: string[] | null = selectedRaw ? JSON.parse(selectedRaw) : null;
    const list = selectedIds ? all.filter((img) => selectedIds.includes(img.id)) : all;

    setPromptPreviews(prompts);
    setStrategyOverrides(overrides);
    setImages(list);
    return list;
  }, [productName, sessionId, unlockedVersion]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const paid = sessionStorage.getItem("hdPaymentSuccess");

      if (paid) {
        setPhase("hd-loading");
        const fake = setInterval(() => {
          setHdProgress((p) => (p >= 95 ? 95 : p + Math.random() * 8));
        }, 400);
        try {
          await loadImages();
        } finally {
          clearInterval(fake);
        }
        if (!cancelled) {
          setHdProgress(100);
          setTimeout(() => {
            if (!cancelled) {
              setPhase("hd-done");
              if (sessionId) updateSessionRecord(sessionId, { last_step: "hd-result" });
            }
          }, 600);
        }
        sessionStorage.removeItem("hdPaymentSuccess");
      } else {
        setPhase("loading");
        const fake = setInterval(() => {
          setProgress((p) => (p >= 95 ? 95 : p + Math.random() * 10));
        }, 350);
        try {
          await loadImages();
        } finally {
          clearInterval(fake);
        }
        if (!cancelled) {
          setProgress(100);
          setTimeout(() => {
            if (!cancelled) setPhase("preview");
          }, 500);
        }
      }
    }

    init().catch((err) => {
      console.error("HDResultStep init error", err);
      toast({ title: "加载失败", description: err.message, variant: "destructive" });
    });

    return () => {
      cancelled = true;
    };
  }, [loadImages, sessionId, toast]);

  const toggleEdit = (id: string) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === id ? { ...img, editOpen: !img.editOpen } : { ...img, editOpen: false },
      ),
    );
  };

  const updateText = (id: string, field: "headline" | "supporting", value: string) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === id
          ? { ...img, copy_blocks: { ...img.copy_blocks, [field]: value } }
          : img,
      ),
    );
  };

  const updateLineText = (
    id: string,
    field: "proof_lines" | "matrix_lines",
    value: string,
  ) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === id
          ? {
              ...img,
              copy_blocks: {
                ...img.copy_blocks,
                [field]: textareaToCopyLines(value),
              },
            }
          : img,
      ),
    );
  };

  const regenerateImage = useCallback(
    async (id: string, instruction: string) => {
      setImages((prev) =>
        prev.map((img) => (img.id === id ? { ...img, isRegenerating: true } : img)),
      );
      try {
        const { job_id } = await assetAPI.regenerate(id, instruction || "重新生成");
        await jobAPI.pollUntilDone(job_id);
        await loadImages();
        toast({
          title: "重新生成完成",
          description: instruction ? `已按指示调整：${instruction}` : undefined,
        });
      } catch (err: any) {
        toast({ title: "重新生成失败", description: err.message, variant: "destructive" });
      } finally {
        setImages((prev) =>
          prev.map((img) => (img.id === id ? { ...img, isRegenerating: false } : img)),
        );
      }
    },
    [loadImages, toast],
  );

  const regenSingle = async (id: string) => {
    await regenerateImage(id, "重新生成");
  };

  const saveText = async (id: string) => {
    const img = images.find((item) => item.id === id);
    if (!img || !sessionId) return;

    const slotId =
      img.resolved_slot_id ||
      resolveMainGalleryAssetCopy(
        {
          role: img.role,
          slot_id: img.slot_id || null,
          display_order: img.display_order,
        },
        promptPreviews,
        strategyOverrides,
      ).slotId;

    if (!slotId) {
      toast({
        title: "保存失败",
        description: "当前图片缺少可用槽位标识，暂时无法保存文案。",
        variant: "destructive",
      });
      return;
    }

    setImages((prev) =>
      prev.map((item) => (item.id === id ? { ...item, editOpen: false } : item)),
    );

    try {
      const nextOverrides = upsertStrategyOverride(strategyOverrides, slotId, img.copy_blocks);
      const saved = await sessionAPI.saveStrategyOverrides(sessionId, {
        overrides: nextOverrides,
      });
      setStrategyOverrides(saved.overrides || nextOverrides);
      await regenerateImage(id, "按当前文案 override 重生");
    } catch (err: any) {
      toast({ title: "保存失败", description: err.message, variant: "destructive" });
    }
  };

  const renderCopyEditor = (img: PreviewImage) => (
    <div className="border-t border-slate-100 px-4 pb-4 pt-3 bg-slate-50">
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <span className="text-xs text-slate-400 w-14 shrink-0 pt-2">主标题</span>
          <input
            value={img.copy_blocks.headline}
            onChange={(e) => updateText(img.id, "headline", e.target.value)}
            className="flex-1 text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            placeholder="输入主标题..."
          />
        </div>
        <div className="flex items-start gap-2">
          <span className="text-xs text-slate-400 w-14 shrink-0 pt-2">副标题</span>
          <input
            value={img.copy_blocks.supporting}
            onChange={(e) => updateText(img.id, "supporting", e.target.value)}
            className="flex-1 text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            placeholder="输入副标题..."
          />
        </div>
        <div className="flex items-start gap-2">
          <span className="text-xs text-slate-400 w-14 shrink-0 pt-2">佐证短句</span>
          <textarea
            rows={3}
            value={copyLinesToTextarea(img.copy_blocks.proof_lines)}
            onChange={(e) => updateLineText(img.id, "proof_lines", e.target.value)}
            className="flex-1 text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            placeholder={"每行一条，例如：\n通过质检认证\n核心参数可视化"}
          />
        </div>
        <div className="flex items-start gap-2">
          <span className="text-xs text-slate-400 w-14 shrink-0 pt-2">标签短句</span>
          <textarea
            rows={3}
            value={copyLinesToTextarea(img.copy_blocks.matrix_lines)}
            onChange={(e) => updateLineText(img.id, "matrix_lines", e.target.value)}
            className="flex-1 text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            placeholder={"每行一条，例如：\n净化除湿二合一\n低噪运行"}
          />
        </div>
      </div>
      <button
        onClick={() => saveText(img.id)}
        className="mt-3 w-full flex items-center justify-center gap-1.5 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-xl py-2 font-medium transition"
      >
        <Check className="w-4 h-4" />
        保存文字
      </button>
    </div>
  );

  const regenAll = () => {
    navigate("/create/result");
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await sessionAPI.downloadResults(sessionId, Number(unlockedVersion));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `smartphoto-hd-${sessionId}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "下载已开始" });
    } catch (err: any) {
      toast({ title: "下载失败", description: err.message, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const goToPayment = () => {
    sessionStorage.setItem("hdFromPreview", "true");
    sessionStorage.setItem("hdImgCount", String(images.length));
    navigate("/create/hd-payment");
  };

  const goToDetailCopywriting = () => {
    sessionStorage.removeItem("hdPaymentSuccess");
    sessionStorage.removeItem("hdFromPreview");
    sessionStorage.removeItem("hdImgCount");
    navigate("/create/copywriting");
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "已复制链接" });
      setShowShareModal(false);
    } catch {
      toast({ title: "复制失败", variant: "destructive" });
    }
  };

  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <StepIndicator currentStep={5} />
        <GenerationWaitingUI
          kind="main"
          progress={progress}
          stage="正在生成预览图"
        />
      </div>
    );
  }

  if (phase === "preview") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <StepIndicator currentStep={5} />

        <div className="bg-white border-b px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-semibold text-slate-800">
              已生成 {images.length} 张图片
            </span>
          </div>
          <button
            onClick={regenAll}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-full px-2.5 py-1 transition"
          >
            <RefreshCw className="w-3 h-3" />
            重新生成
          </button>
        </div>
        <p className="px-4 py-1.5 text-xs text-slate-400 bg-white border-b">
          预览图含水印，付费后生成高清清图
        </p>

        <div className="flex-1 overflow-y-auto pb-28">
          {images.map((img) => (
            <div key={img.id} className="bg-white border-b">
              <div className="relative select-none" onContextMenu={(e) => e.preventDefault()}>
                {img.isRegenerating && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  </div>
                )}
                <img
                  src={img.url}
                  alt={img.type}
                  className="w-full object-cover pointer-events-none"
                  draggable={false}
                  style={{ maxHeight: "400px" }}
                />
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div
                    className="text-white/25 font-bold text-xl select-none"
                    style={{
                      transform: "rotate(-30deg)",
                      textShadow: "0 1px 4px rgba(0,0,0,0.4)",
                      letterSpacing: "0.08em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    AI电商做图 · 预览版
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-sm text-slate-500">
                  {img.product} · {img.type}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleEdit(img.id)}
                    className={`flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border transition ${
                      img.editOpen
                        ? "text-blue-700 border-blue-400 bg-blue-100"
                        : "text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
                    }`}
                  >
                    <Pencil className="w-3 h-3" />
                    编辑文字
                  </button>
                  <button
                    onClick={() => regenSingle(img.id)}
                    className="flex items-center gap-1 text-xs text-slate-500 border border-slate-200 rounded-full px-2.5 py-1 hover:bg-slate-50 transition"
                  >
                    <RefreshCw className="w-3 h-3" />
                    重新生成
                  </button>
                </div>
              </div>

              {img.editOpen && renderCopyEditor(img)}
            </div>
          ))}
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t shadow-lg px-4 py-3">
          <button
            onClick={goToPayment}
            className="w-full h-12 rounded-2xl flex items-center justify-center gap-2 text-base font-bold bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-200 transition"
          >
            <Sparkles className="w-5 h-5" />
            生成无水印高清图
          </button>
          <p className="text-center text-xs text-slate-400 mt-1.5">共 {images.length} 张，确认后全部生成</p>
        </div>
      </div>
    );
  }

  if (phase === "hd-loading") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <StepIndicator currentStep={5} />
        <GenerationWaitingUI
          kind="hd"
          progress={hdProgress}
          stage="正在生成无水印高清图"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <StepIndicator currentStep={5} />

      <div className="bg-amber-50 border-b border-amber-100 px-4 py-2.5 flex items-center gap-2.5">
        <div className="w-7 h-7 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shrink-0">
          <Crown className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-amber-900">高清图生成成功！</p>
          <p className="text-xs text-amber-600">无水印 · 可直接用于电商上架</p>
        </div>
      </div>

      <div className="px-4 py-2 flex items-center gap-1.5 bg-white border-b">
        <span className="text-sm font-semibold text-slate-700">高清图</span>
        <span className="text-xs text-slate-400">共 {images.length} 张</span>
      </div>

      <div className="flex-1 overflow-y-auto pb-36">
        {images.map((img) => (
          <div key={img.id} className="bg-white border-b">
            <div className="relative select-none" onContextMenu={(e) => e.preventDefault()}>
              {img.isRegenerating && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
              <img
                src={img.url}
                alt={img.type}
                className="w-full object-cover pointer-events-none"
                draggable={false}
                style={{ maxHeight: "400px" }}
              />
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-slate-500">
                {img.product} · {img.type}
              </span>
              <button
                onClick={() => toggleEdit(img.id)}
                className={`flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border transition ${
                  img.editOpen
                    ? "text-blue-700 border-blue-400 bg-blue-100"
                    : "text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
                }`}
              >
                <Pencil className="w-3 h-3" />
                编辑文字
              </button>
            </div>
            {img.editOpen && renderCopyEditor(img)}
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30">
        {!isAuthenticated && (
          <div className="bg-white border-t border-slate-100 px-4 py-2 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <CloudUpload className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-800">登录账号，自动保存你的设计资产</p>
              <p className="text-xs text-slate-400">避免图片丢失</p>
            </div>
            <a
              href={getLoginUrl()}
              className="shrink-0 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
            >
              登录 / 注册
            </a>
          </div>
        )}
        <div className="bg-white border-t border-slate-100 shadow-lg px-4 py-2.5 flex gap-2">
          <Button
            size="lg"
            variant="outline"
            className="flex-1 text-slate-600 gap-1.5 border-slate-200"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            一键下载
          </Button>
          <Button size="lg" variant="ghost" className="px-3 text-slate-500" onClick={() => setShowShareModal(true)}>
            <Share2 className="w-4 h-4" />
          </Button>
          <Button
            size="lg"
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white gap-1.5"
            onClick={goToDetailCopywriting}
          >
            <FileText className="w-4 h-4" />
            生成详情图
          </Button>
        </div>
      </div>

      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowShareModal(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-t-2xl w-full max-w-sm pb-8 pt-5 px-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">选择分享方式</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <button
              className="w-full h-11 rounded-full bg-blue-500 hover:bg-blue-600 text-white font-semibold text-sm transition-colors"
              onClick={copyShareLink}
            >
              复制链接
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
