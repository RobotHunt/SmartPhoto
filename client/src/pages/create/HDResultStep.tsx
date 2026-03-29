import { useState, useEffect, useCallback } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { getLoginUrl } from "@/const";
import { sessionAPI, assetAPI, jobAPI } from "@/lib/api";
import { updateSessionRecord } from "@/lib/localUser";
import { useAuth } from "@/contexts/AuthContext";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TextFields {
  title: string;
  subtitle: string;
  footer: string;
}

interface PreviewImage {
  id: string;
  type: string;
  product: string;
  url: string;
  editOpen: boolean;
  isRegenerating: boolean;
  texts: TextFields;
}

type Phase = "loading" | "preview" | "hd-loading" | "hd-done";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function HDResultStep() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  // ---------- core state ----------
  const [phase, setPhase] = useState<Phase>("loading");
  const [images, setImages] = useState<PreviewImage[]>([]);
  const [progress, setProgress] = useState(0);
  const [hdProgress, setHdProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const sessionId = sessionStorage.getItem("current_session_id") || "";
  const unlockedVersion =
    sessionStorage.getItem("hd_unlocked_version") ||
    sessionStorage.getItem("current_result_version") ||
    "1";

  /* ---------------------------------------------------------------- */
  /*  Load images from API                                             */
  /* ---------------------------------------------------------------- */

  const loadImages = useCallback(async () => {
    if (!sessionId) return;
    const results = await sessionAPI.getResults(sessionId, Number(unlockedVersion));

    // Only show images the user selected on the result page
    const selectedRaw = sessionStorage.getItem("selected_asset_ids");
    const selectedIds: string[] | null = selectedRaw ? JSON.parse(selectedRaw) : null;

    const all: PreviewImage[] = (results.assets ?? results ?? []).map(
      (a: any) => ({
        id: a.asset_id ?? a.id,
        type: a.image_type ?? a.type ?? "",
        product: a.product_name ?? a.product ?? "",
        url: a.url ?? a.image_url ?? "",
        editOpen: false,
        isRegenerating: false,
        texts: {
          title: a.title ?? a.texts?.title ?? "",
          subtitle: a.subtitle ?? a.texts?.subtitle ?? "",
          footer: a.footer ?? a.texts?.footer ?? "",
        },
      })
    );

    const list = selectedIds ? all.filter((img) => selectedIds.includes(img.id)) : all;
    setImages(list);
    return list;
  }, [sessionId, unlockedVersion]);

  /* ---------------------------------------------------------------- */
  /*  Mount: decide flow based on hdPaymentSuccess                     */
  /* ---------------------------------------------------------------- */

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Helpers                                                          */
  /* ---------------------------------------------------------------- */

  const toggleEdit = (id: string) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === id ? { ...img, editOpen: !img.editOpen } : { ...img, editOpen: false }
      )
    );
  };

  const updateText = (id: string, field: keyof TextFields, value: string) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === id
          ? { ...img, texts: { ...img.texts, [field]: value } }
          : img
      )
    );
  };

  const regenSingle = async (id: string) => {
    const img = images.find((i) => i.id === id);
    if (!img) return;
    setImages((prev) =>
      prev.map((i) => (i.id === id ? { ...i, isRegenerating: true } : i))
    );
    try {
      const instruction = [img.texts.title, img.texts.subtitle, img.texts.footer]
        .filter(Boolean)
        .join(" / ");
      const { job_id } = await assetAPI.regenerate(id, instruction || "regenerate");
      await jobAPI.pollUntilDone(job_id);
      await loadImages();
      toast({ title: "重新生成完成" });
    } catch (err: any) {
      toast({ title: "重新生成失败", description: err.message, variant: "destructive" });
    } finally {
      setImages((prev) =>
        prev.map((i) => (i.id === id ? { ...i, isRegenerating: false } : i))
      );
    }
  };

  const regenAll = () => {
    navigate("/create/result");
  };

  const saveText = (id: string) => {
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, editOpen: false } : img)));
    toast({ title: "文字已保存" });
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await sessionAPI.downloadResults(sessionId);
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
    navigate("/create/payment");
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

  /* ================================================================ */
  /*  PHASE 1: Loading                                                 */
  /* ================================================================ */

  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <StepIndicator currentStep={5} />
        <div className="flex flex-col items-center justify-center flex-1 px-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">正在生成预览图…</h2>
          <p className="text-sm text-slate-500 mb-5">AI 正在处理，请稍候片刻</p>
          <div className="w-full max-w-xs mb-2">
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-400 to-blue-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <p className="text-sm text-slate-400">{Math.round(progress)}%</p>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /*  PHASE 2: Preview (watermark)                                     */
  /* ================================================================ */

  if (phase === "preview") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <StepIndicator currentStep={5} />

        {/* status bar */}
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
        <p className="px-4 py-1.5 text-xs text-slate-400 bg-white border-b">预览图含水印，付费后生成高清清图</p>

        {/* image list */}
        <div className="flex-1 overflow-y-auto pb-28">
          {images.map((img) => (
            <div key={img.id} className="bg-white border-b">
              {/* image with watermark */}
              <div
                className="relative select-none"
                onContextMenu={(e) => e.preventDefault()}
              >
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
                {/* watermark */}
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

              {/* bottom action row */}
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-sm text-slate-500">{img.product} · {img.type}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleEdit(img.id)}
                    className={`flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border transition
                      ${img.editOpen
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

              {/* edit panel */}
              {img.editOpen && (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3 bg-slate-50">
                  <div className="space-y-2">
                    {([
                      { field: "title" as keyof TextFields, label: "主标题" },
                      { field: "subtitle" as keyof TextFields, label: "副标题" },
                      { field: "footer" as keyof TextFields, label: "底部文字" },
                    ]).map(({ field, label }) => (
                      <div key={field} className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-14 shrink-0">{label}</span>
                        <input
                          value={img.texts[field]}
                          onChange={(e) => updateText(img.id, field, e.target.value)}
                          className="flex-1 text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => saveText(img.id)}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-xl py-2 font-medium transition"
                  >
                    <Check className="w-4 h-4" />
                    保存文字
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* fixed bottom CTA */}
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

  /* ================================================================ */
  /*  PHASE 3: HD Loading                                              */
  /* ================================================================ */

  if (phase === "hd-loading") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <StepIndicator currentStep={5} />
        <div className="flex flex-col items-center justify-center flex-1 px-4">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-orange-200">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">正在生成无水印高清图…</h2>
          <p className="text-sm text-slate-500 mb-5">AI 正在处理，请稍候片刻</p>
          <div className="w-full max-w-xs mb-2">
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-400 to-orange-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${hdProgress}%` }}
              />
            </div>
          </div>
          <p className="text-sm text-slate-400">{Math.round(hdProgress)}% · 高清渲染中</p>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /*  PHASE 4: HD Done                                                 */
  /* ================================================================ */

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <StepIndicator currentStep={5} />

      {/* success banner */}
      <div className="bg-amber-50 border-b border-amber-100 px-4 py-2.5 flex items-center gap-2.5">
        <div className="w-7 h-7 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shrink-0">
          <Crown className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-amber-900">高清图生成成功！</p>
          <p className="text-xs text-amber-600">无水印 · 可直接用于电商上架</p>
        </div>
      </div>

      {/* image count */}
      <div className="px-4 py-2 flex items-center gap-1.5 bg-white border-b">
        <span className="text-sm font-semibold text-slate-700">高清图</span>
        <span className="text-xs text-slate-400">共 {images.length} 张</span>
      </div>

      {/* image list (no watermark) */}
      <div className="flex-1 overflow-y-auto pb-36">
        {images.map((img) => (
          <div key={img.id} className="bg-white border-b">
            <div className="relative select-none" onContextMenu={(e) => e.preventDefault()}>
              <img
                src={img.url}
                alt={img.type}
                className="w-full object-cover pointer-events-none"
                draggable={false}
                style={{ maxHeight: "400px" }}
              />
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-slate-500">{img.product} · {img.type}</span>
              <button
                onClick={() => toggleEdit(img.id)}
                className={`flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border transition
                  ${img.editOpen
                    ? "text-blue-700 border-blue-400 bg-blue-100"
                    : "text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
                  }`}
              >
                <Pencil className="w-3 h-3" />
                编辑文字
              </button>
            </div>
            {img.editOpen && (
              <div className="border-t border-slate-100 px-4 pb-4 pt-3 bg-slate-50">
                <div className="space-y-2">
                  {([
                    { field: "title" as keyof TextFields, label: "主标题" },
                    { field: "subtitle" as keyof TextFields, label: "副标题" },
                    { field: "footer" as keyof TextFields, label: "底部文字" },
                  ]).map(({ field, label }) => (
                    <div key={field} className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-14 shrink-0">{label}</span>
                      <input
                        value={img.texts[field]}
                        onChange={(e) => updateText(img.id, field, e.target.value)}
                        className="flex-1 text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => saveText(img.id)}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-xl py-2 font-medium transition"
                >
                  <Check className="w-4 h-4" />
                  保存文字
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* fixed bottom: login bar + action buttons */}
      <div className="fixed bottom-0 left-0 right-0 z-30">
        {/* login prompt (hidden when logged in) */}
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
        {/* action buttons */}
        <div className="bg-white border-t border-slate-100 shadow-lg px-4 py-2.5 flex gap-2">
          <Button size="lg" variant="outline" className="flex-1 text-slate-600 gap-1.5 border-slate-200" onClick={handleDownload} disabled={downloading}>
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            一键下载
          </Button>
          <Button size="lg" variant="ghost" className="px-3 text-slate-500" onClick={() => setShowShareModal(true)}>
            <Share2 className="w-4 h-4" />
          </Button>
          <Button size="lg" className="flex-1 bg-blue-500 hover:bg-blue-600 text-white gap-1.5" onClick={goToDetailCopywriting}>
            <FileText className="w-4 h-4" />
            生成详情图
          </Button>
        </div>
      </div>

      {/* share modal (bottom sheet) */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowShareModal(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-t-2xl w-full max-w-sm pb-8 pt-5 px-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">选择分享方式</h3>
              <button onClick={() => setShowShareModal(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500">
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
