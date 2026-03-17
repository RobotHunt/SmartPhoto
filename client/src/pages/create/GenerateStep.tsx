import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Upload, X, LinkIcon, Plus, Pencil, FileText } from "lucide-react";
import { StepIndicator } from "@/components/StepIndicator";
import { Input } from "@/components/ui/input";

const PRODUCT_THEMES: Record<string, string[]> = {
  "空气净化器": ["宠物家庭", "甲醛净化", "过敏防护", "母婴安全", "办公室净化", "老人健康"],
  "加湿器": ["干燥季节", "办公室舒适", "卧室睡眠", "母婴护理", "美容护肤"],
  "除湿机": ["梅雨季节", "地下室防潮", "衣物干燥", "防霉除湿"],
  "厨房小家电": ["家庭烹饪", "健康饮食", "快手料理", "烘焙达人", "早餐神器"],
  "服装": ["职场通勤", "休闲度假", "运动健身", "约会穿搭", "居家舒适"],
  "电子产品": ["办公效率", "娱乐影音", "学习提升", "游戏电竞", "智能生活"],
  "家居用品": ["温馨家庭", "简约生活", "收纳整理", "品质生活"],
  "美妆护肤": ["日常护肤", "妆容打造", "抗衰修护", "敏感肌护理"],
  "食品饮料": ["健康营养", "美味享受", "能量补充", "送礼佳品"],
  "运动户外": ["健身塑形", "户外探险", "运动竞技", "休闲运动"],
  "母婴用品": ["新生儿护理", "婴幼儿成长", "孕妈关怀", "亲子互动"],
  "图书文具": ["学习提升", "办公必备", "创意设计", "阅读享受"],
  "其它": ["日常使用", "品质生活", "实用便捷", "多场景适用"],
};

interface ReferenceItem {
  id: string;
  type: 'link' | 'image';
  content: string;
  name?: string;
}

interface ParamItem {
  id: string;
  label: string;
  value: string;
}

interface SellingPoint {
  id: string;
  text: string;
}

export default function GenerateStep() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [referenceUrl, setReferenceUrl] = useState("");
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [productType, setProductType] = useState<string>("空气净化器");
  const [selectedTheme, setSelectedTheme] = useState<string>("宠物家庭");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const referenceImageInputRef = useRef<HTMLInputElement>(null);

  const [params, setParams] = useState<ParamItem[]>([
    { id: "1", label: "CADR", value: "220m³/h" },
    { id: "2", label: "功率", value: "45W" },
    { id: "3", label: "噪音", value: "22dB" },
    { id: "4", label: "适用面积", value: "30m²" },
  ]);
  const [editingParams, setEditingParams] = useState(false);

  const [sellingPoints, setSellingPoints] = useState<SellingPoint[]>([
    { id: "1", text: "宠物毛发专用吸附" },
    { id: "2", text: "四重过滤" },
    { id: "3", text: "静音设计" },
  ]);
  const [editingPoints, setEditingPoints] = useState(false);
  const [newPointText, setNewPointText] = useState("");

  const [advantages, setAdvantages] = useState<{ id: string; text: string }[]>([
    { id: "1", text: "净化效率行业领先，CADR值高达220m³/h" },
    { id: "2", text: "超低噪音运行，夜间模式低至22dB" },
  ]);
  const [editingAdvantages, setEditingAdvantages] = useState(false);
  const [newAdvantageText, setNewAdvantageText] = useState("");

  const [featureTexts, setFeatureTexts] = useState<{ id: string; text: string }[]>([
    { id: "1", text: "智能传感器自动调节风速" },
    { id: "2", text: "APP远程控制" },
  ]);
  const [editingFeatures, setEditingFeatures] = useState(false);
  const [newFeatureText, setNewFeatureText] = useState("");

  const availableThemes = PRODUCT_THEMES[productType] || PRODUCT_THEMES["其它"];

  useEffect(() => {
    const savedProductType = sessionStorage.getItem("selectedProductType") || "空气净化器";
    const savedTheme = sessionStorage.getItem("selectedTheme") || "宠物家庭";
    setProductType(savedProductType);
    setSelectedTheme(savedTheme);
    setTimeout(() => setIsLoading(false), 800);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type)) { alert('请上传图片（JPG/PNG）或PDF文件'); return; }
    setIsExtracting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2500));
      setParams([
        { id: "1", label: "CADR", value: "400m³/h" },
        { id: "2", label: "功率", value: "55W" },
        { id: "3", label: "噪音", value: "22dB" },
        { id: "4", label: "适用面积", value: "50m²" },
      ]);
      setSellingPoints([
        { id: "1", text: "宠物毛发专用吸附技术" },
        { id: "2", text: "四重HEPA过滤系统" },
        { id: "3", text: "22dB超静音运行" },
      ]);
      alert('✅ 产品信息识别成功！');
    } catch { alert('❌ 识别失败，请重试'); }
    finally { setIsExtracting(false); }
  };

  const handleAddReferenceUrl = () => {
    if (!referenceUrl.trim()) return;
    try {
      new URL(referenceUrl);
      setReferences(prev => [...prev, { id: Date.now().toString(), type: 'link', content: referenceUrl, name: referenceUrl }]);
      setReferenceUrl('');
    } catch { alert('请输入有效的URL'); }
  };

  const handleAddReferenceImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setReferences(prev => [...prev, { id: Date.now().toString() + Math.random(), type: 'image', content: event.target?.result as string, name: file.name }]);
      };
      reader.readAsDataURL(file);
    });
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-slate-500 text-sm">AI正在分析产品特性...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <StepIndicator currentStep={3} />

      <div className="max-w-2xl mx-auto py-4 px-4">

        {/* ── 顶部标题 ── */}
        <div className="mb-3">
          <h1 className="text-xl font-bold text-slate-900">AI 正在自动生成参数</h1>
        </div>

        {/* ── 1. 自动识别产品参数 ── */}
        <div className="border border-slate-200 rounded-xl p-3 mb-3 bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </div>
            <span className="font-semibold text-slate-900 text-sm">
              自动识别产品参数
              <span className="ml-1.5 text-xs font-normal text-slate-400">（可选）</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isExtracting}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExtracting ? (
                <><div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /><span>识别中...</span></>
              ) : (
                <><Upload className="w-3.5 h-3.5" /><span>上传说明书 / 产品参数图</span></>
              )}
            </button>
            <span className="text-slate-300 text-xs">|</span>
            <span className="text-xs text-slate-400">支持图片/PDF格式</span>
            <svg className="w-3.5 h-3.5 text-slate-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
            </svg>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" />
        </div>

        {/* ── 2. 选择主题场景 ── */}
        <div className="border border-slate-200 rounded-xl p-4 mb-3 bg-white shadow-sm">
          <h3 className="font-semibold text-slate-900 text-sm mb-3">选择主图首图场景</h3>
          <Input
            type="text"
            list="theme-options"
            value={selectedTheme}
            onChange={(e) => { setSelectedTheme(e.target.value); sessionStorage.setItem("selectedTheme", e.target.value); }}
            placeholder="选择或输入主题场景"
            className="w-full"
          />
          <datalist id="theme-options">
            {availableThemes.map((theme) => (
              <option key={theme} value={theme} />
            ))}
          </datalist>
          <p className="text-xs text-slate-400 mt-2">AI建议：{availableThemes.slice(0, 3).join(' · ')}</p>
        </div>

        {/* ── 3. 产品卖点 ── */}
        <div className="border border-slate-200 rounded-xl p-4 mb-3 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900 text-sm">核心卖点</h3>
            <button
              onClick={() => setEditingPoints(!editingPoints)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              <Pencil className="w-3 h-3" />
              {editingPoints ? "完成" : "修改"}
              {!editingPoints && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>}
            </button>
          </div>
          <div className="space-y-2">
            {sellingPoints.map((point) => (
              <div key={point.id} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                {editingPoints ? (
                  <Input
                    value={point.text}
                    onChange={(e) => setSellingPoints(prev => prev.map(p => p.id === point.id ? { ...p, text: e.target.value } : p))}
                    className="h-7 text-xs flex-1"
                  />
                ) : (
                  <span className="text-sm text-slate-700">{point.text}</span>
                )}
                {editingPoints && (
                  <button onClick={() => setSellingPoints(prev => prev.filter(p => p.id !== point.id))} className="p-0.5 hover:bg-slate-100 rounded">
                    <X className="w-3 h-3 text-slate-400" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {editingPoints ? (
            <div className="flex gap-2 mt-3">
              <Input
                value={newPointText}
                onChange={(e) => setNewPointText(e.target.value)}
                placeholder="输入新卖点"
                className="h-7 text-xs flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newPointText.trim()) {
                    setSellingPoints(prev => [...prev, { id: Date.now().toString(), text: newPointText.trim() }]);
                    setNewPointText("");
                  }
                }}
              />
              <button
                onClick={() => {
                  if (newPointText.trim()) {
                    setSellingPoints(prev => [...prev, { id: Date.now().toString(), text: newPointText.trim() }]);
                    setNewPointText("");
                  }
                }}
                className="px-2 py-1 text-xs bg-blue-500 text-white rounded-lg"
              >
                添加
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingPoints(true)}
              className="mt-3 flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              添加卖点
            </button>
          )}
        </div>

        {/* ── 4. 核心参数 ── */}
        <div className="border border-slate-200 rounded-xl p-4 mb-3 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900 text-sm">核心参数</h3>
            <button
              onClick={() => setEditingParams(!editingParams)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              <Pencil className="w-3 h-3" />
              {editingParams ? "完成" : "修改"}
              {!editingParams && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {params.map((param) => (
              <div key={param.id} className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-20 flex-shrink-0 flex items-center gap-1 truncate">
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                  </svg>
                  {param.label}
                </span>
                {editingParams ? (
                  <Input
                    value={param.value}
                    onChange={(e) => setParams(prev => prev.map(p => p.id === param.id ? { ...p, value: e.target.value } : p))}
                    className="h-7 text-xs flex-1"
                  />
                ) : (
                  <span className="text-sm font-medium text-slate-800">{param.value}</span>
                )}
                {editingParams && (
                  <button onClick={() => setParams(prev => prev.filter(p => p.id !== param.id))} className="p-0.5 hover:bg-slate-100 rounded">
                    <X className="w-3 h-3 text-slate-400" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => setParams(prev => [...prev, { id: Date.now().toString(), label: "参数", value: "" }])}
            className="mt-3 flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            添加参数
          </button>
        </div>

        {/* ── 5. 产品优势 ── */}
        <div className="border border-slate-200 rounded-xl p-4 mb-3 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900 text-sm">产品优势</h3>
            <button
              onClick={() => setEditingAdvantages(!editingAdvantages)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              <Pencil className="w-3 h-3" />
              {editingAdvantages ? "完成" : "修改"}
              {!editingAdvantages && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>}
            </button>
          </div>
          <div className="space-y-2">
            {advantages.map((adv) => (
              <div key={adv.id} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                {editingAdvantages ? (
                  <Input
                    value={adv.text}
                    onChange={(e) => setAdvantages(prev => prev.map(a => a.id === adv.id ? { ...a, text: e.target.value } : a))}
                    className="h-7 text-xs flex-1"
                  />
                ) : (
                  <span className="text-sm text-slate-700">{adv.text}</span>
                )}
                {editingAdvantages && (
                  <button onClick={() => setAdvantages(prev => prev.filter(a => a.id !== adv.id))} className="p-0.5 hover:bg-slate-100 rounded">
                    <X className="w-3 h-3 text-slate-400" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {editingAdvantages ? (
            <div className="flex gap-2 mt-3">
              <Input
                value={newAdvantageText}
                onChange={(e) => setNewAdvantageText(e.target.value)}
                placeholder="输入产品优势描述"
                className="h-7 text-xs flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newAdvantageText.trim()) {
                    setAdvantages(prev => [...prev, { id: Date.now().toString(), text: newAdvantageText.trim() }]);
                    setNewAdvantageText("");
                  }
                }}
              />
              <button
                onClick={() => {
                  if (newAdvantageText.trim()) {
                    setAdvantages(prev => [...prev, { id: Date.now().toString(), text: newAdvantageText.trim() }]);
                    setNewAdvantageText("");
                  }
                }}
                className="px-2 py-1 text-xs bg-blue-500 text-white rounded-lg"
              >
                添加
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingAdvantages(true)}
              className="mt-3 flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              添加优势
            </button>
          )}
        </div>

        {/* ── 6. 功能展示（可选）── */}
        <div className="border border-slate-200 rounded-xl p-4 mb-3 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900 text-sm">
              功能展示
              <span className="ml-1.5 text-xs font-normal text-slate-400">（可选）</span>
            </h3>
            <button
              onClick={() => setEditingFeatures(!editingFeatures)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              <Pencil className="w-3 h-3" />
              {editingFeatures ? "完成" : "修改"}
              {!editingFeatures && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>}
            </button>
          </div>
          <div className="space-y-2">
            {featureTexts.map((feat) => (
              <div key={feat.id} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                {editingFeatures ? (
                  <Input
                    value={feat.text}
                    onChange={(e) => setFeatureTexts(prev => prev.map(f => f.id === feat.id ? { ...f, text: e.target.value } : f))}
                    className="h-7 text-xs flex-1"
                  />
                ) : (
                  <span className="text-sm text-slate-700">{feat.text}</span>
                )}
                {editingFeatures && (
                  <button onClick={() => setFeatureTexts(prev => prev.filter(f => f.id !== feat.id))} className="p-0.5 hover:bg-slate-100 rounded">
                    <X className="w-3 h-3 text-slate-400" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {editingFeatures ? (
            <div className="flex gap-2 mt-3">
              <Input
                value={newFeatureText}
                onChange={(e) => setNewFeatureText(e.target.value)}
                placeholder="输入功能描述"
                className="h-7 text-xs flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFeatureText.trim()) {
                    setFeatureTexts(prev => [...prev, { id: Date.now().toString(), text: newFeatureText.trim() }]);
                    setNewFeatureText("");
                  }
                }}
              />
              <button
                onClick={() => {
                  if (newFeatureText.trim()) {
                    setFeatureTexts(prev => [...prev, { id: Date.now().toString(), text: newFeatureText.trim() }]);
                    setNewFeatureText("");
                  }
                }}
                className="px-2 py-1 text-xs bg-blue-500 text-white rounded-lg"
              >
                添加
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingFeatures(true)}
              className="mt-3 flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              添加功能
            </button>
          )}
        </div>

        {/* ── 6. 添加参考内容（可选）── */}
        <div className="border border-slate-200 rounded-xl p-4 mb-6 bg-white shadow-sm">
          <h3 className="font-semibold text-slate-900 text-sm mb-3">
            添加参考内容
            <span className="ml-1.5 text-xs font-normal text-slate-400">（可选）</span>
          </h3>
          <div className="flex gap-2 mb-3">
            <Input
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
              placeholder="输入竞品链接或参考页面URL"
              className="flex-1 text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddReferenceUrl(); }}
            />
            <Button onClick={handleAddReferenceUrl} variant="outline" size="sm" className="flex-shrink-0">
              <LinkIcon className="w-3.5 h-3.5 mr-1" />
              添加
            </Button>
          </div>
          <button
            onClick={() => referenceImageInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-slate-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm text-slate-500"
          >
            <Upload className="w-4 h-4" />
            上传参考图片（支持多张）
          </button>
          <input ref={referenceImageInputRef} type="file" accept="image/*" multiple onChange={handleAddReferenceImage} className="hidden" />
          {references.length > 0 && (
            <div className="mt-3 space-y-2">
              {references.map((ref) => (
                <div key={ref.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg">
                  {ref.type === 'link' ? (
                    <LinkIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  ) : (
                    <img src={ref.content} alt={ref.name} className="w-10 h-10 object-cover rounded flex-shrink-0" />
                  )}
                  <span className="text-sm text-slate-700 flex-1 truncate">{ref.name || ref.content}</span>
                  <button onClick={() => setReferences(prev => prev.filter(r => r.id !== ref.id))} className="p-1 hover:bg-slate-200 rounded">
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 底部按钮 ── */}
        <Button
          onClick={() => setLocation("/create/strategy")}
          className="w-full h-12 bg-blue-500 hover:bg-blue-600 text-white text-base font-semibold rounded-xl shadow"
        >
          生成主图文案
        </Button>
        <button
          onClick={() => setLocation("/create/copywriting")}
          className="w-full mt-3 flex items-center justify-center gap-1.5 text-sm text-slate-400 hover:text-blue-600 transition-colors"
        >
          <FileText className="w-4 h-4" />
          直接生成详情文案
        </button>
      </div>
    </div>
  );
}
