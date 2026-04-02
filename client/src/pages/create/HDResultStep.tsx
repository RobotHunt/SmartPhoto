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
  carry_forward?: boolean;
  source_version_no?: number | null;
  fidelity_validation_status?: string | null;
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
      carry_forward: asset.carry_forward,
      source_version_no: asset.source_version_no,
      fidelity_validation_status: asset.fidelity_validation_status,
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
    <div className="border-t border-white/5 p-5 bg-black/40">
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-xs font-bold tracking-widest text-slate-400 w-16 shrink-0 pt-2.5">主标题</span>
          <input
            value={img.copy_blocks.headline}
            onChange={(e) => updateText(img.id, "headline", e.target.value)}
            className="flex-1 text-sm text-slate-100 bg-[#050914] border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all font-medium placeholder-slate-600 shadow-inner"
            placeholder="输入主标题..."
          />
        </div>
        <div className="flex items-start gap-3">
          <span className="text-xs font-bold tracking-widest text-slate-400 w-16 shrink-0 pt-2.5">副标题</span>
          <input
            value={img.copy_blocks.supporting}
            onChange={(e) => updateText(img.id, "supporting", e.target.value)}
            className="flex-1 text-sm text-slate-100 bg-[#050914] border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all font-medium placeholder-slate-600 shadow-inner"
            placeholder="输入副标题..."
          />
        </div>
        <div className="flex items-start gap-3">
          <span className="text-xs font-bold tracking-widest text-slate-400 w-16 shrink-0 pt-2.5">佐证短句</span>
          <textarea
            rows={3}
            value={copyLinesToTextarea(img.copy_blocks.proof_lines)}
            onChange={(e) => updateLineText(img.id, "proof_lines", e.target.value)}
            className="flex-1 text-sm text-slate-100 bg-[#050914] border border-white/10 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all font-medium placeholder-slate-600 shadow-inner"
            placeholder={"每行一条，例如：\n通过质检认证\n核心参数可视化"}
          />
        </div>
        <div className="flex items-start gap-3">
          <span className="text-xs font-bold tracking-widest text-slate-400 w-16 shrink-0 pt-2.5">标签短句</span>
          <textarea
            rows={3}
            value={copyLinesToTextarea(img.copy_blocks.matrix_lines)}
            onChange={(e) => updateLineText(img.id, "matrix_lines", e.target.value)}
            className="flex-1 text-sm text-slate-100 bg-[#050914] border border-white/10 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all font-medium placeholder-slate-600 shadow-inner"
            placeholder={"每行一条，例如：\n净化除湿二合一\n低噪运行"}
          />
        </div>
      </div>
      <button
        onClick={() => saveText(img.id)}
        className="mt-5 w-full flex items-center justify-center gap-1.5 text-sm text-teal-300 font-bold tracking-widest bg-teal-900/30 border border-teal-500/30 hover:bg-teal-900/50 hover:text-teal-200 rounded-xl py-2.5 transition-all outline-none"
      >
        <Check className="w-4 h-4" />
        保存文字更改
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
      <div className="min-h-screen aurora-bg z-0 relative flex flex-col">
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
      <div className="min-h-screen aurora-bg flex flex-col pt-8">
        <StepIndicator currentStep={5} />

        <div className="w-full max-w-7xl mx-auto px-4 relative z-10 pb-36">
          <div className="flex items-center justify-between gap-3 mb-6 bg-black/40 backdrop-blur-md border border-white/5 p-4 rounded-2xl">
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-widest text-slate-100 mb-1">
                已生成 <span className="text-cyan-400">{images.length}</span> 张图片
              </span>
              <span className="text-xs text-cyan-500/80 font-medium tracking-widest">
                预览图含水印，付费后生成无水印高清原图
              </span>
            </div>
            <button
              onClick={regenAll}
              className="flex items-center gap-1 text-xs font-bold tracking-widest text-slate-300 hover:text-white bg-white/5 border border-white/10 rounded-full px-4 py-2 transition hover:bg-white/10"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              全部重新生成
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {images.map((img) => (
              <div key={img.id} className="glass-panel overflow-hidden rounded-[24px] border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.3)]">
                <div className="relative select-none" onContextMenu={(e) => e.preventDefault()}>
                  {img.isRegenerating && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-10">
                      <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
                    </div>
                  )}
                  <img
                    src={img.url}
                    alt={img.type}
                    className="w-full aspect-square object-cover pointer-events-none"
                    draggable={false}
                  />
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div
                      className="text-white/25 font-bold text-xl select-none"
                      style={{
                        transform: "rotate(-30deg)",
                        textShadow: "0 1px 4px rgba(0,0,0,0.6)",
                        letterSpacing: "0.08em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      AI电商做图 · 预览版
                    </div>
                  </div>

                  {/* carry forward badge */}
                  {img.carry_forward && img.source_version_no != null && (
                    <div className="absolute top-3 left-3 z-20">
                      <div className="rounded-full bg-slate-800/80 backdrop-blur-md border border-white/20 px-2 py-0.5 text-[10px] font-bold tracking-widest text-slate-300 shadow-sm">
                        沿用自 V{img.source_version_no}
                      </div>
                    </div>
                  )}

                  {/* fidelity badge */}
                  {img.fidelity_validation_status === 'passed' && (
                    <div className="absolute bottom-3 left-3 z-20">
                      <div className="rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold tracking-widest text-emerald-400 shadow-sm">
                        保真通过
                      </div>
                    </div>
                  )}
                  {img.fidelity_validation_status === 'failed' && (
                    <div className="absolute bottom-3 left-3 z-20">
                      <div className="rounded-full bg-red-500/20 backdrop-blur-md border border-red-500/40 px-2 py-0.5 text-[10px] font-bold tracking-widest text-red-400 shadow-sm">
                        保真受限
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 bg-black/30">
                  <span className="text-sm font-bold tracking-widest text-slate-300">
                    {img.product} · <span className="text-cyan-400">{img.type}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleEdit(img.id)}
                      className={`flex items-center gap-1.5 text-xs font-bold tracking-widest rounded-full px-3 py-1 transition shadow-sm ${
                        img.editOpen
                          ? "bg-cyan-900/60 text-cyan-300 border border-cyan-500/50"
                          : "bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <Pencil className="w-3 h-3" />
                      修改文案
                    </button>
                    <button
                      onClick={() => regenSingle(img.id)}
                      className="flex items-center gap-1 text-xs font-bold tracking-widest text-slate-300 border border-white/10 bg-white/5 hover:bg-white/10 hover:text-white rounded-full px-3 py-1 transition shadow-sm"
                    >
                      <RefreshCw className="w-3 h-3" />
                      单独重绘
                    </button>
                  </div>
                </div>

                {img.editOpen && renderCopyEditor(img)}
              </div>
            ))}
          </div>

          <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#050914]/80 backdrop-blur-xl border-t border-white/10 px-4 py-4 md:py-6 sm:px-12 flex justify-center shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
            <div className="w-full max-w-4xl flex flex-col items-center">
              <button
                onClick={goToPayment}
                className="sci-fi-button w-full sm:w-[400px] h-14 rounded-[20px] flex items-center justify-center gap-2 text-base font-bold tracking-widest transition active:scale-95"
              >
                <Sparkles className="w-5 h-5" />
                生成无水印高清图
              </button>
              <p className="text-center text-xs font-medium tracking-widest text-slate-400 mt-2">共 {images.length} 张，确认后全部生成</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "hd-loading") {
    return (
      <div className="min-h-screen aurora-bg flex flex-col">
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
    <div className="min-h-screen aurora-bg flex flex-col pt-8">
      <StepIndicator currentStep={5} />

      <div className="w-full max-w-7xl mx-auto px-4 relative z-10 pb-44">
        {/* State Banner */}
        <div className="glass-panel border-cyan-500/30 bg-cyan-950/20 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.15)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/20">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-base font-bold tracking-widest text-cyan-50">高清图生成成功！</p>
              <p className="text-xs font-medium tracking-widest text-cyan-300/80 mt-0.5">无水印真高清 · 可直接用于电商上架</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-widest text-slate-100">高清成片</span>
            <span className="text-xs font-bold tracking-widest bg-white/10 px-2 py-0.5 rounded-md text-slate-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
              {images.length} 张
            </span>
          </div>
        </div>

        {/* --- Image grids --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {images.map((img) => (
            <div key={img.id} className="glass-panel overflow-hidden rounded-[24px] border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.5)] transition hover:border-cyan-500/30">
              <div className="relative select-none" onContextMenu={(e) => e.preventDefault()}>
                {img.isRegenerating && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-10">
                    <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                  </div>
                )}
                <img
                  src={img.url}
                  alt={img.type}
                  className="w-full aspect-square object-cover pointer-events-none"
                  draggable={false}
                />

                {/* carry forward badge */}
                {img.carry_forward && img.source_version_no != null && (
                  <div className="absolute top-3 left-3 z-20">
                    <div className="rounded-full bg-slate-800/80 backdrop-blur-md border border-white/20 px-2 py-0.5 text-[10px] font-bold tracking-widest text-slate-300 shadow-sm">
                      沿用自 V{img.source_version_no}
                    </div>
                  </div>
                )}

                {/* fidelity badge */}
                {img.fidelity_validation_status === 'passed' && (
                  <div className="absolute bottom-3 left-3 z-20">
                    <div className="rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold tracking-widest text-emerald-400 shadow-sm">
                      保真通过
                    </div>
                  </div>
                )}
                {img.fidelity_validation_status === 'failed' && (
                  <div className="absolute bottom-3 left-3 z-20">
                    <div className="rounded-full bg-red-500/20 backdrop-blur-md border border-red-500/40 px-2 py-0.5 text-[10px] font-bold tracking-widest text-red-400 shadow-sm">
                      保真受限
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between p-4 bg-black/30">
                <span className="text-sm font-bold tracking-widest text-slate-300">
                  {img.product} · <span className="text-cyan-400">{img.type}</span>
                </span>
                <button
                  onClick={() => toggleEdit(img.id)}
                  className={`flex items-center gap-1.5 text-xs font-bold tracking-widest rounded-full px-3 py-1 transition shadow-sm ${
                    img.editOpen
                      ? "bg-cyan-900/60 text-cyan-300 border border-cyan-500/50"
                      : "bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Pencil className="w-3 h-3" />
                  修改文案
                </button>
              </div>
              {img.editOpen && renderCopyEditor(img)}
            </div>
          ))}
        </div>

        {/* --- Bottom Actions Bar --- */}
        <div className="fixed bottom-0 left-0 right-0 z-30 flex flex-col">
          {!isAuthenticated && (
            <div className="bg-[#050914]/90 backdrop-blur-xl border-t border-white/10 px-6 py-3 flex flex-wrap items-center justify-center gap-4 relative z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-cyan-900/30 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <CloudUpload className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold tracking-widest text-slate-200">登录账号，自动保存全部设计资产</p>
                  <p className="text-[10px] font-medium tracking-widest text-slate-400 mt-0.5 text-cyan-500/80">避免高清原图丢失 终生可用</p>
                </div>
              </div>
              <a
                href={getLoginUrl()}
                className="shrink-0 bg-transparent hover:bg-white/5 border border-cyan-500/30 text-cyan-400 text-xs font-bold tracking-widest px-4 py-2 rounded-xl transition"
              >
                立即登录注册
              </a>
            </div>
          )}
          
          <div className="bg-[#050914]/90 backdrop-blur-xl border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.4)] px-4 py-4 md:py-6 flex justify-center w-full z-10">
            <div className="w-full max-w-4xl flex items-center gap-3 md:gap-4">
              <button
                className="flex-1 h-14 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold tracking-widest bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleDownload}
                disabled={downloading}
              >
                {downloading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
                一键下载高清图包
              </button>
              <button 
                className="w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white transition"
                onClick={() => setShowShareModal(true)}
              >
                <Share2 className="w-5 h-5" />
              </button>
              <button
                className="flex-[1.5] h-14 rounded-2xl flex items-center justify-center gap-2 text-base font-bold tracking-widest sci-fi-button text-white shadow-md shadow-blue-500/20 transition active:scale-95"
                onClick={goToDetailCopywriting}
              >
                <FileText className="w-5 h-5" />
                继续生成详情图
              </button>
            </div>
          </div>
        </div>

        {/* --- Share Modal --- */}
        {showShareModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto" onClick={() => setShowShareModal(false)}>
            <div className="absolute inset-0 bg-[#050914]/80 backdrop-blur-md" />
            <div
              className="relative glass-panel rounded-3xl w-[90%] max-w-sm pb-8 pt-6 px-6 shadow-[0_0_50px_rgba(34,211,238,0.15)] border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-bold tracking-widest text-slate-100 flex items-center gap-2"><Share2 className="w-4 h-4 text-cyan-400" />分享你的作品</h3>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-black/40 border border-white/10 hover:bg-white/10 text-slate-400 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <button
                className="w-full h-12 rounded-xl bg-cyan-600/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 font-bold tracking-widest text-sm transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                onClick={copyShareLink}
              >
                一键复制专属链接
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
