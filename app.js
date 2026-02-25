// ============================================
// SmartPhoto - AI电商做图平台
// 豆包 Seedream + Seed Vision API
// ============================================

// ===== State Management =====
const appState = {
  currentStep: 1,
  fsCurrentStep: 1,
  uploadedFiles: [],
  uploadedPreviews: [],       // data URLs of uploaded images
  fsSlotFiles: {},            // slot index -> File
  fsSlotPreviews: {},         // slot index -> data URL
  selectedPlatforms: [],
  generatedImages: [],
  isGenerating: false,
  productAnalysis: null,      // AI analysis result
  confirmedCategory: null,    // 用户确认的品类 key (e.g. 'air_purifier')
  selectedSellingPoints: [],  // 用户勾选的卖点
  selectedScenes: [],         // 用户勾选的场景
  userSpecs: {},              // 用户填写的核心参数 { label: value }
  whiteBackgroundImage: null,  // 白底图 data URL
  copyTexts: {                 // Step 5 可编辑文案
    productName: '',
    categoryName: '',
    headline: '',
    sellingPointsText: '',
    scenesText: '',
    specsText: '',
  },
};

// ===== 品类知识库 =====
// Jane: "先框定品类，比如空气净化器，除湿机"
// 卖点来自市场趋势/电商热词，而非从图片提取
const CATEGORY_KB = {
  air_purifier: {
    name: '空气净化器',
    aliases: ['空气净化器', '净化器', '空气清新机', '空净', 'air purifier'],
    // 市场热门卖点 —— 来自电商平台热搜词 & 竞品分析
    sellingPoints: [
      '除甲醛99.9%',
      '宠物毛发专用吸附',
      '四重过滤系统',
      'H13级HEPA滤网',
      '静音设计≤33dB',
      '负离子净化',
      '智能空气质量检测',
      '儿童安全锁',
      '除菌率99.99%',
      '睡眠模式',
      'APP远程操控',
      '大CADR高效净化',
      '滤网更换提醒',
      '无耗材电离技术',
    ],
    // 推荐场景/背景 —— 合理的场景匹配
    scenes: [
      { id: 'living_room', name: '客厅', desc: '现代简约风格客厅，大面积落地窗，阳光透过窗帘洒入，浅色沙发和木质茶几旁' },
      { id: 'bedroom', name: '卧室', desc: '温馨安静的卧室，靠近床头柜一侧，柔和的暖色灯光，整洁舒适的床品' },
      { id: 'nursery', name: '母婴房', desc: '温馨的婴儿房，柔和的粉色或蓝色色调，婴儿床旁边，安全温馨的氛围' },
      { id: 'pet_home', name: '宠物家庭', desc: '有宠物的温馨家庭环境，沙发旁有猫咪或小狗，体现宠物毛发净化需求' },
      { id: 'office', name: '办公室', desc: '现代简洁的办公桌旁，电脑显示器一侧，体现办公环境空气质量关注' },
      { id: 'new_house', name: '新装修房', desc: '新装修的现代房间，淡色墙壁和家具，窗户半开，体现除甲醛场景' },
    ],
    // 核心参数模板
    specs: [
      { key: 'cadr', label: 'CADR值', placeholder: '如: 450 m³/h', unit: 'm³/h' },
      { key: 'noise', label: '噪音等级', placeholder: '如: 33 dB', unit: 'dB' },
      { key: 'area', label: '适用面积', placeholder: '如: 30-60 m²', unit: 'm²' },
      { key: 'filter', label: '滤网类型', placeholder: '如: H13 HEPA + 活性炭' },
      { key: 'power', label: '额定功率', placeholder: '如: 55W', unit: 'W' },
    ],
    // 主图构图框架
    compositions: [
      { name: '产品居中 + 性能参数环绕', desc: '产品置于画面中心，周围用图标和文字标注核心参数' },
      { name: '场景融合 + 功能可视化', desc: '产品在使用场景中，用粒子/气流动画展示净化效果' },
      { name: '对比展示', desc: '左右分屏，展示使用前后空气质量对比' },
    ],
    // 背景色推荐
    bgColors: ['纯白', '浅灰', '淡蓝渐变', '清新绿色渐变'],
  },
  dehumidifier: {
    name: '除湿机',
    aliases: ['除湿机', '除湿器', '抽湿机', '抽湿器', 'dehumidifier'],
    sellingPoints: [
      '日除湿量20L/天',
      '大容量水箱免频繁倒水',
      '一键智能除湿',
      '静音运行≤38dB',
      '干衣模式快速烘干',
      '智能湿度显示',
      '满水自动停机',
      '360°万向轮移动',
      '连续排水设计',
      '除湿+净化二合一',
      '防霉除菌',
      '节能省电压缩机',
      '地下室专用大功率',
      '衣帽间小型静音',
    ],
    scenes: [
      { id: 'bathroom', name: '卫生间', desc: '明亮整洁的卫生间，瓷砖墙面，洗手台旁边，体现防潮除湿需求' },
      { id: 'basement', name: '地下室', desc: '地下室储物空间，略暗的环境光，周围有储物架，体现地下室除湿刚需' },
      { id: 'closet', name: '衣帽间', desc: '整齐的衣帽间内，衣架上挂满衣物，体现衣物防潮保护' },
      { id: 'laundry', name: '晾衣区', desc: '室内晾衣区域，晾衣架上有衣物，体现辅助干衣功能' },
      { id: 'bedroom_humid', name: '卧室', desc: '南方潮湿季节的卧室环境，窗外有雨，营造除湿舒适感' },
      { id: 'living_room', name: '客厅', desc: '梅雨季节的客厅，现代家居风格，体现全屋除湿场景' },
    ],
    specs: [
      { key: 'capacity', label: '日除湿量', placeholder: '如: 20 L/天', unit: 'L/天' },
      { key: 'tank', label: '水箱容量', placeholder: '如: 4.5 L', unit: 'L' },
      { key: 'area', label: '适用面积', placeholder: '如: 20-40 m²', unit: 'm²' },
      { key: 'noise', label: '噪音等级', placeholder: '如: 38 dB', unit: 'dB' },
      { key: 'power', label: '额定功率', placeholder: '如: 240W', unit: 'W' },
    ],
    compositions: [
      { name: '产品居中 + 除湿量标注', desc: '产品置于画面中心，突出显示日除湿量数据' },
      { name: '使用场景 + 水珠可视化', desc: '产品在潮湿环境中，用水珠/湿度图标展示除湿效果' },
      { name: '多功能展示', desc: '分区展示除湿、干衣、净化等多种模式' },
    ],
    bgColors: ['纯白', '浅灰', '淡蓝色', '清爽水蓝渐变'],
  },
};

/**
 * 根据 AI 识别结果匹配知识库品类
 * @param {string} productName - AI 识别的产品名
 * @param {string} category - AI 识别的品类
 * @returns {string|null} 匹配到的品类 key
 */
function matchCategory(productName, category) {
  const text = `${productName} ${category}`.toLowerCase();
  for (const [key, kb] of Object.entries(CATEGORY_KB)) {
    for (const alias of kb.aliases) {
      if (text.includes(alias.toLowerCase())) return key;
    }
  }
  return null;
}

/**
 * 获取当前确认品类的知识库数据
 */
function getCurrentKB() {
  return CATEGORY_KB[appState.confirmedCategory] || null;
}

// ===== API Configuration =====
const API_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';

function getApiConfig() {
  return {
    apiKey: localStorage.getItem('smartphoto_api_key') || '',
    model: localStorage.getItem('smartphoto_model') || 'doubao-seedream-4-5-251128',
    style: localStorage.getItem('smartphoto_style') || 'photorealistic',
    size: localStorage.getItem('smartphoto_size') || '1920x1920',
  };
}

// ===== Demo Image Paths =====
const DEMO_IMAGES = {
  original: 'images/product_original.png',
  scene: 'images/product_scene.png',
  structure: 'images/product_structure.png',
  sellingPoint: 'images/product_selling_point.png',
};

// ===== Style Map =====
const STYLE_MAP = {
  photorealistic: '写实摄影风格，专业相机拍摄效果',
  commercial: '高端商业广告摄影风格',
  minimalist: '极简现代设计风格',
  lifestyle: '自然生活方式摄影风格',
};

// ===== Platform Strategies =====
const PLATFORM_STRATEGIES = {
  '1688': { name: '1688 / 阿里巴巴', style: 'B2B批发风格，强调性价比与源头实力', promptAddon: '1688电商批发风格，明确标注核心参数，展现源头工厂实力，高性价比商业视觉' },
  'alibaba': { name: '阿里国际站', style: '国际B2B风格，强调专业与认证', promptAddon: '国际站B2B风格，专业严谨的商业摄影，强调品质与国际化标准' },
  'taobao': { name: '淘宝', style: 'C端零售风格，高视觉冲击力', promptAddon: '淘宝爆款电商风格，视觉冲击力强，精致修图，突出核心卖点的高清主图' },
  'douyin': { name: '抖音', style: '兴趣电商风格，动态感强，吸引眼球', promptAddon: '抖音短视频电商风格，强烈的视觉吸引力，动态感，适合竖屏流展示' },
  'tiktok': { name: 'TikTok', style: '海外潮流风格，高饱和视觉', promptAddon: 'TikTok潮流电商风格，欧美流行视觉，高饱和度，吸引眼球的创意展示' },
  'jd': { name: '京东', style: '品质电商风格，强调正品与质感', promptAddon: '京东品质电商风格，高级灰底或纯净背景，强调产品质感与正品可靠性' },
  'pdd': { name: '拼多多', style: '下沉市场风格，卖点醒目直接', promptAddon: '拼多多高转化风格，色彩鲜艳，卖点直白醒目，视觉直接明了' },
  'temu': { name: 'Temu', style: '跨境性价比规范，白底直观', promptAddon: 'Temu跨境白底图风格，清晰展示产品全貌，无多余元素，直接突出核心产品' },
  'xiaohongshu': { name: '小红书', style: '种草美学风格，注重氛围与生活感', promptAddon: '小红书种草美学风格，生活化场景，自然光影，高级氛围感，真实且具有高级审美' },
  'amazon': { name: '亚马逊', style: '严格白底极简规范，纯净高级', promptAddon: '亚马逊标准白底图规范，纯白背景RGB 255,255,255，极简高级质感，无水印和复杂修饰' },
  'custom-official': { name: '官网自定义', style: '品牌高级克制风格', promptAddon: '品牌官网高级视觉风格，设计克制，质感极佳，符合高端品牌调性' },
  'custom': { name: '自定义', style: '通用电商标准', promptAddon: '通用电商高标准视觉表现' },
};

// ===== Dynamic Result Type Builders =====
// These build prompt templates using KB data + user selections + Step 5 editable copy
function buildResultTypes(analysis) {
  analysis = analysis || {};
  const ct = appState.copyTexts || {};
  // 优先使用 Step 5 用户编辑的值
  const product = ct.productName || analysis.productName || '产品';
  const kb = getCurrentKB();
  const category = ct.categoryName || (kb ? kb.name : (analysis.category || '产品'));

  // 卖点：优先用用户选中的，否则用 KB 默认
  const sellingPoints = appState.selectedSellingPoints.length > 0
    ? appState.selectedSellingPoints
    : (kb ? kb.sellingPoints.slice(0, 3) : ['优质设计']);
  // 用 Step 5 编辑过的卖点文案做 prompt 文字
  const featureStr = ct.sellingPointsText || sellingPoints.slice(0, 3).join('、');

  // 场景：从 KB 中按用户选择获取详细描述
  const selectedSceneData = [];
  if (kb && appState.selectedScenes.length > 0) {
    for (const sid of appState.selectedScenes) {
      const scene = kb.scenes.find(s => s.id === sid);
      if (scene) selectedSceneData.push(scene);
    }
  }
  // fallback
  if (selectedSceneData.length === 0 && kb) {
    selectedSceneData.push(kb.scenes[0], kb.scenes[1]);
  }

  // 参数字符串
  const specStr = Object.entries(appState.userSpecs)
    .filter(([_, v]) => v)
    .map(([k, v]) => {
      const spec = kb?.specs.find(s => s.key === k);
      return spec ? `${spec.label}${v}` : v;
    }).join('，') || '';
  const specPromptPart = specStr ? `，核心参数：${specStr}` : '';

  // 构图框架
  const composition = kb ? kb.compositions[0]?.name : '';

  const results = [];
  const platforms = appState.selectedPlatforms && appState.selectedPlatforms.length > 0
    ? appState.selectedPlatforms
    : ['custom'];

  platforms.forEach(platformKey => {
    const pDef = PLATFORM_STRATEGIES[platformKey] || PLATFORM_STRATEGIES['custom'];
    const pName = pDef.name;
    const pPrompt = pDef.promptAddon;

    // 1. 白底主图
    results.push({
      type: `${pName} · 白底主图`,
      badge: 'badge-white',
      desc: `符合${pName}规范的${product}主图`,
      image: DEMO_IMAGES.original,
      editPlaceholder: '修改描述：如"换成浅灰色背景"',
      prompt: `一张专业电商${category}产品主图，纯白色背景，完整展示${product}的整体外观，高清晰度正面角度拍摄，商业摄影品质，突出${featureStr}等特点${specPromptPart}。画面需满足【${pName}】平台风格要求：${pPrompt}`,
    });

    // 2. 场景主图 (取第1个场景避免生成过多)
    if (selectedSceneData.length > 0) {
      const scene = selectedSceneData[0];
      results.push({
        type: `${pName} · 场景图 (${scene.name})`,
        badge: 'badge-scene',
        desc: `${pName}环境下的${scene.name}展示`,
        image: DEMO_IMAGES.scene,
        editPlaceholder: '修改描述：如"换个使用环境"',
        prompt: `${product}放在${scene.desc}，自然光线照射，展示${product}在实际${scene.name}场景中的使用效果，专业室内摄影效果，突出${featureStr}${specPromptPart}。画面需满足【${pName}】平台风格要求：${pPrompt}`,
      });
    }

    // 3. 卖点图 (取第1个卖点避免生成过多)
    if (sellingPoints.length > 0) {
      const sp = sellingPoints[0];
      results.push({
        type: `${pName} · 卖点图 (${sp.substring(0, 6)}...)`,
        badge: 'badge-selling',
        desc: `突出展示${product}的${sp}`,
        image: DEMO_IMAGES.sellingPoint,
        editPlaceholder: '修改描述：如"突出其他卖点"',
        prompt: `${product}的特写展示图，视觉重点突出「${sp}」这个核心卖点，专业产品摄影风格，白色或简洁背景${specPromptPart}。视觉表现需满足【${pName}】平台风格要求：${pPrompt}`,
      });
    }
  });

  // 4. 通用结构图（爆炸视图），仅生成一张
  results.push({
    type: '通用策略 · 爆炸视图',
    badge: 'badge-structure',
    desc: `${product}内部结构爆炸图`,
    image: DEMO_IMAGES.structure,
    editPlaceholder: '修改描述：如"增加尺寸标注"',
    prompt: `${product}的爆炸视图结构图，将各个组件分解展示，标注每个部件名称和功能，白色背景，技术图纸风格，工程制图效果，展示${featureStr}等核心技术`,
  });

  return results;
}

// Fallback result types when no analysis available
const DEFAULT_RESULT_TYPES = [
  { type: '白底主图', badge: 'badge-white', desc: '纯白背景产品主图', image: DEMO_IMAGES.original, editPlaceholder: '修改描述', prompt: '专业电商产品主图，纯白色背景，高清正面角度' },
  { type: '场景主图 · 客厅', badge: 'badge-scene', desc: '客厅使用场景', image: DEMO_IMAGES.scene, editPlaceholder: '修改描述', prompt: '产品在现代客厅中的使用场景' },
  { type: '场景主图 · 卧室', badge: 'badge-scene', desc: '卧室使用场景', image: DEMO_IMAGES.scene, editPlaceholder: '修改描述', prompt: '产品在温馨卧室中的使用场景' },
  { type: '卖点图 · 核心卖点', badge: 'badge-selling', desc: '核心卖点展示', image: DEMO_IMAGES.sellingPoint, editPlaceholder: '修改描述', prompt: '产品核心卖点特写展示图' },
  { type: '卖点图 · 产品特性', badge: 'badge-selling', desc: '产品特性展示', image: DEMO_IMAGES.sellingPoint, editPlaceholder: '修改描述', prompt: '产品重要特性技术图解' },
  { type: '结构图 · 爆炸视图', badge: 'badge-structure', desc: '产品结构爆炸图', image: DEMO_IMAGES.structure, editPlaceholder: '修改描述', prompt: '产品爆炸视图结构图' },
  { type: '白底主图 · 45°角', badge: 'badge-white', desc: '45度角产品图', image: DEMO_IMAGES.original, editPlaceholder: '修改描述', prompt: '产品45度角白底展示图' },
];

// ===== Navigation =====
function scrollToApp() {
  openFullscreenWizard();
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

// ===== Fullscreen Wizard =====
function openFullscreenWizard() {
  const wizard = document.getElementById('fsWizard');
  wizard.classList.add('active');
  document.body.style.overflow = 'hidden';
  fsGoToStep(1);
}

function closeFullscreenWizard() {
  const wizard = document.getElementById('fsWizard');
  wizard.classList.remove('active');
  document.body.style.overflow = '';
}

function fsGoToStep(step) {
  appState.fsCurrentStep = step;

  // Update progress bar
  document.querySelectorAll('.fs-progress-step').forEach((ps) => {
    const s = parseInt(ps.dataset.fsstep);
    ps.classList.remove('active', 'completed');
    if (s === step) ps.classList.add('active');
    else if (s < step) ps.classList.add('completed');
  });

  document.querySelectorAll('.fs-progress-line').forEach((line, i) => {
    line.classList.toggle('active', i < step - 1);
  });

  // Switch panels
  document.querySelectorAll('.fs-panel').forEach((p) => p.classList.remove('active'));
  const panel = document.getElementById(`fs-panel-${step}`);
  if (panel) panel.classList.add('active');

  // Step-specific logic
  if (step === 2) fsRunAnalysis();
  if (step === 4) fsRunCopyGeneration();
  if (step === 5) fsShowConfirmation();
  if (step === 6) fsStartGeneration();
}

// ===== FS Step 1: Upload with Slots =====
function triggerFsUpload(slotIndex) {
  // If slot already has image, don't re-upload (user can remove first)
  if (appState.fsSlotPreviews[slotIndex]) return;

  const input = document.getElementById('fileInput');
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('⚠️ 请上传图片文件'); return; }
    if (file.size > 10 * 1024 * 1024) { showToast('⚠️ 文件大小不能超过 10MB'); return; }

    appState.fsSlotFiles[slotIndex] = file;
    appState.uploadedFiles = Object.values(appState.fsSlotFiles);

    const reader = new FileReader();
    reader.onload = (ev) => {
      appState.fsSlotPreviews[slotIndex] = ev.target.result;
      appState.uploadedPreviews = Object.values(appState.fsSlotPreviews);
      renderFsSlot(slotIndex, ev.target.result);
      updateFsUploadButton();
      // Reset analysis & KB state
      appState.productAnalysis = null;
      appState.confirmedCategory = null;
      appState.whiteBackgroundImage = null;
      appState.selectedSellingPoints = [];
      appState.selectedScenes = [];
      appState.userSpecs = {};
      appState.copyTexts = { productName: '', categoryName: '', headline: '', sellingPointsText: '', scenesText: '', specsText: '' };
      triggerAutoAnalysis();
    };
    reader.readAsDataURL(file);
    input.value = '';
    input.onchange = null;
  };
  input.click();
}

function renderFsSlot(slotIndex, dataUrl) {
  const slot = document.getElementById(`fsSlot${slotIndex}`);
  if (!slot) return;
  const parentSlot = slot.parentElement;
  parentSlot.classList.add('has-image');
  slot.innerHTML = `
    <img src="${dataUrl}" class="fs-upload-slot-img" alt="预览">
    <button class="fs-remove-btn" onclick="event.stopPropagation(); removeFsSlot(${slotIndex})">✕</button>
  `;
}

function removeFsSlot(slotIndex) {
  delete appState.fsSlotFiles[slotIndex];
  delete appState.fsSlotPreviews[slotIndex];
  appState.uploadedFiles = Object.values(appState.fsSlotFiles);
  appState.uploadedPreviews = Object.values(appState.fsSlotPreviews);

  const slot = document.getElementById(`fsSlot${slotIndex}`);
  const parentSlot = slot.parentElement;
  parentSlot.classList.remove('has-image');

  const labels = ['正面图', '45°角', '侧面图', '', '上传产品片', '上传产品片'];
  if (slotIndex === 3) {
    slot.innerHTML = `<div class="fs-upload-add-icon">＋</div>`;
  } else {
    slot.innerHTML = `
      <div class="fs-upload-icon">☁️</div>
      <span class="fs-upload-slot-label">${labels[slotIndex] || '上传'}</span>
    `;
  }
  updateFsUploadButton();
  appState.productAnalysis = null;
  appState.confirmedCategory = null;
  appState.whiteBackgroundImage = null;
  appState.selectedSellingPoints = [];
  appState.selectedScenes = [];
  appState.userSpecs = {};
  appState.copyTexts = { productName: '', categoryName: '', headline: '', sellingPointsText: '', scenesText: '', specsText: '' };
}

function updateFsUploadButton() {
  const btn = document.getElementById('btnFsUploadNext');
  btn.disabled = Object.keys(appState.fsSlotFiles).length === 0;
}

// ===== FS Step 2: AI Analysis =====
async function fsRunAnalysis() {
  const thumb = document.getElementById('fsAnalysisThumb');
  const productName = document.getElementById('fsAnalysisProductName');
  const category = document.getElementById('fsAnalysisCategory');
  const suggestions = document.getElementById('fsAnalysisSuggestions');
  const correctionArea = document.getElementById('fsCategoryCorrection');

  // Show first uploaded image as thumbnail
  if (appState.uploadedPreviews.length > 0) {
    thumb.innerHTML = `<img src="${appState.uploadedPreviews[0]}" alt="产品">`;
  }

  if (appState.productAnalysis) {
    // Already analyzed — show cached
    const analysis = appState.productAnalysis;
    productName.textContent = analysis.productName || '产品';
    const kb = getCurrentKB();
    category.textContent = kb ? `✅ ${kb.name}` : (analysis.category || '产品');
    renderAnalysisSuggestions(analysis, suggestions);
    renderCategoryCorrection(correctionArea, analysis);
    return;
  }

  productName.textContent = '识别中...';
  category.textContent = '分析中...';
  suggestions.innerHTML = '<li>正在通过 AI 识别产品品类...</li>';
  if (correctionArea) correctionArea.style.display = 'none';

  const config = getApiConfig();
  if (config.apiKey && config.apiKey.length > 10 && appState.uploadedPreviews.length > 0) {
    try {
      showToast('🤖 正在通过 AI 识别产品品类...');
      const analysis = await analyzeProductImage();
      if (analysis) {
        appState.productAnalysis = analysis;
        productName.textContent = analysis.productName || '产品';
        const kb = getCurrentKB();
        category.textContent = kb ? `✅ ${kb.name}` : (analysis.category || '产品');

        renderAnalysisSuggestions(analysis, suggestions);
        renderCategoryCorrection(correctionArea, analysis);

        showToast(kb ? `✅ 已识别为「${kb.name}」，知识库已匹配` : '✅ 产品识别完成');
        return;
      }
    } catch (err) {
      console.warn('AI analysis failed:', err.message);
    }
  }

  // Fallback demo
  setTimeout(() => {
    productName.textContent = '产品（演示模式）';
    category.textContent = '产品类型';
    suggestions.innerHTML = [
      '建议补充顶部图片',
      '请设置 API Key 获取真实产品分析结果',
    ].map(s => `<li>${s}</li>`).join('');
    // 演示模式也显示纠偏和知识库
    renderCategoryCorrection(correctionArea, null);
  }, 800);
}

function renderAnalysisSuggestions(analysis, suggestionsEl) {
  const kb = getCurrentKB();
  const items = [];

  if (kb) {
    items.push(`✅ 已匹配品类知识库：「${kb.name}」`);
    items.push(`已加载 ${kb.sellingPoints.length} 个市场热门卖点`);
    items.push(`已推荐 ${kb.scenes.length} 个适配场景`);
    if (analysis.visualFeatures && analysis.visualFeatures.length > 0) {
      items.push(`AI 识别外观特征：${analysis.visualFeatures.slice(0, 3).join('、')}`);
    }
  } else {
    items.push(`识别为「${analysis.productName || '产品'}」，暂未匹配知识库`);
    items.push('建议手动选择品类以获取更精准的卖点推荐');
    if (analysis.visualFeatures) {
      items.push(`AI 识别外观特征：${analysis.visualFeatures.join('、')}`);
    }
  }
  items.push('如品类识别有误，请在下方手动修正');

  suggestionsEl.innerHTML = items.map(s => `<li>${s}</li>`).join('');
}

function renderCategoryCorrection(container, analysis) {
  if (!container) return;
  container.style.display = 'block';

  const currentKey = appState.confirmedCategory;
  const options = Object.entries(CATEGORY_KB).map(([key, kb]) =>
    `<option value="${key}" ${key === currentKey ? 'selected' : ''}>${kb.name}</option>`
  ).join('');

  container.innerHTML = `
    <div class="fs-correction-card">
      <h4>📋 品类确认</h4>
      <p class="fs-correction-hint">如AI识别有误，请手动选择正确品类：</p>
      <div class="fs-correction-row">
        <select id="fsCategorySelect" onchange="onCategoryManualChange(this.value)">
          <option value="">-- 手动选择品类 --</option>
          ${options}
        </select>
        <input type="text" id="fsCategoryCustom" placeholder="或输入自定义品类名称" class="fs-correction-input">
      </div>
    </div>
  `;
}

function onCategoryManualChange(categoryKey) {
  if (!categoryKey) return;
  appState.confirmedCategory = categoryKey;
  const kb = CATEGORY_KB[categoryKey];
  if (!kb) return;

  // 更新显示
  const categoryEl = document.getElementById('fsAnalysisCategory');
  if (categoryEl) categoryEl.textContent = `✅ ${kb.name}（已手动确认）`;

  // 重新加载默认卖点和场景
  appState.selectedSellingPoints = kb.sellingPoints.slice(0, 5);
  appState.selectedScenes = kb.scenes.slice(0, 2).map(s => s.id);
  appState.userSpecs = {};

  showToast(`✅ 已切换到「${kb.name}」品类知识库`);
}

/**
 * 从知识库填充 Step 4 策略页 —— 卖点、场景、参数全部动态化
 */
function populateStrategyFromKB() {
  const kb = getCurrentKB();
  if (!kb) return;

  // === 卖点区域 ===
  const spContainer = document.getElementById('fsSellingPoints');
  if (spContainer) {
    spContainer.innerHTML = kb.sellingPoints.map((sp, i) => {
      const checked = appState.selectedSellingPoints.includes(sp);
      return `<div class="fs-sp-item fs-sp-selectable ${checked ? 'selected' : ''}"
                onclick="toggleSellingPoint(this, '${sp.replace(/'/g, "\\'")}')">
        <span class="fs-sp-checkbox">${checked ? '✓' : ''}</span> ${sp}
      </div>`;
    }).join('');
  }

  // === 场景区域 ===
  const themeOptions = document.getElementById('fsThemeOptions');
  if (themeOptions) {
    themeOptions.innerHTML = `
      <div class="fs-theme-option ${appState.selectedScenes.length === 0 ? 'selected' : ''}"
           onclick="selectTheme(this, '产品图')">
        <div class="fs-theme-thumb"></div>
        <span>纯产品图</span>
      </div>
    ` + kb.scenes.map(scene => {
      const selected = appState.selectedScenes.includes(scene.id);
      return `<div class="fs-theme-option ${selected ? 'selected' : ''}"
                  onclick="toggleScene(this, '${scene.id}')"
                  data-scene-id="${scene.id}">
        ${selected ? '<span class="fs-theme-check">✓</span>' : ''}
        <span>${scene.name}</span>
        <br><small style="color:var(--text-muted)">${scene.desc.substring(0, 20)}...</small>
      </div>`;
    }).join('');
  }

  // === 参数区域 ===
  const specRows = document.getElementById('fsSpecRows');
  if (specRows) {
    specRows.innerHTML = kb.specs.map(spec => {
      const val = appState.userSpecs[spec.key] || '';
      return `<div class="fs-spec-row">
        <span class="fs-spec-label">${spec.label}:</span>
        <input type="text" class="fs-spec-input" placeholder="${spec.placeholder}"
               value="${val}" data-spec-key="${spec.key}"
               onchange="onSpecChange('${spec.key}', this.value)">
      </div>`;
    }).join('');
  }

  // === 构图框架 ===
  const scenePreview = document.getElementById('fsScenePreview');
  if (scenePreview) {
    scenePreview.innerHTML = `<div class="fs-composition-list">` +
      kb.compositions.map((comp, i) =>
        `<div class="fs-composition-item">
          <strong>${comp.name}</strong>
          <p style="color:var(--text-muted);font-size:0.85rem;margin:4px 0 0">${comp.desc}</p>
        </div>`
      ).join('') + `</div>`;
  }

  // === 主题名称 ===
  const themeName = document.getElementById('fsThemeName');
  const themeDesc = document.getElementById('fsThemeDesc');
  if (themeName) themeName.textContent = kb.scenes[0]?.name || '场景图';
  if (themeDesc) themeDesc.textContent = kb.name;

  // === Step 6 确认页也同步更新 ===
  updateConfirmFromSelections();
}

function toggleSellingPoint(el, sp) {
  const idx = appState.selectedSellingPoints.indexOf(sp);
  if (idx === -1) {
    appState.selectedSellingPoints.push(sp);
    el.classList.add('selected');
    el.querySelector('.fs-sp-checkbox').textContent = '✓';
  } else {
    appState.selectedSellingPoints.splice(idx, 1);
    el.classList.remove('selected');
    el.querySelector('.fs-sp-checkbox').textContent = '';
  }
  updateConfirmFromSelections();
}

function toggleScene(el, sceneId) {
  const idx = appState.selectedScenes.indexOf(sceneId);
  if (idx === -1) {
    appState.selectedScenes.push(sceneId);
    el.classList.add('selected');
    if (!el.querySelector('.fs-theme-check')) {
      el.insertAdjacentHTML('afterbegin', '<span class="fs-theme-check">✓</span>');
    }
  } else {
    appState.selectedScenes.splice(idx, 1);
    el.classList.remove('selected');
    const check = el.querySelector('.fs-theme-check');
    if (check) check.remove();
  }
  updateConfirmFromSelections();
}

function onSpecChange(key, value) {
  appState.userSpecs[key] = value;
  updateConfirmFromSelections();
}

/**
 * 从用户的实际选择 + Step 4 文案编辑 更新 Step 5 确认页
 */
function updateConfirmFromSelections() {
  const kb = getCurrentKB();
  const ct = appState.copyTexts || {};

  const confirmScene = document.getElementById('fsConfirmScene');
  const confirmSpec = document.getElementById('fsConfirmSpec');
  const confirmSP = document.getElementById('fsConfirmSP');
  const confirmLayout = document.getElementById('fsConfirmLayout');
  const confirmProduct = document.getElementById('fsConfirmProduct');

  if (confirmProduct) {
    const productLabel = ct.productName || (appState.productAnalysis?.productName) || '产品';
    const categoryLabel = ct.categoryName || (kb ? kb.name : '');
    confirmProduct.textContent = categoryLabel ? `${productLabel}（${categoryLabel}）` : productLabel;
  }

  if (confirmScene) {
    if (ct.scenesText) {
      confirmScene.textContent = ct.scenesText;
    } else if (kb && appState.selectedScenes.length > 0) {
      const sceneNames = appState.selectedScenes.map(sid => {
        const s = kb.scenes.find(sc => sc.id === sid);
        return s ? s.name : sid;
      });
      confirmScene.textContent = sceneNames.join('、');
    } else {
      confirmScene.textContent = '纯产品图';
    }
  }

  if (confirmSpec) {
    if (ct.specsText) {
      confirmSpec.textContent = ct.specsText;
    } else {
      const specItems = Object.entries(appState.userSpecs)
        .filter(([_, v]) => v)
        .map(([k, v]) => {
          const spec = kb?.specs?.find(s => s.key === k);
          return spec ? `${spec.label}: ${v}` : `${k}: ${v}`;
        });
      confirmSpec.textContent = specItems.join(' | ') || '待填写';
    }
  }

  if (confirmSP) {
    confirmSP.textContent = ct.sellingPointsText || appState.selectedSellingPoints.slice(0, 3).join('、') || '未选择';
  }

  if (confirmLayout) {
    confirmLayout.textContent = ct.headline || (kb ? kb.compositions[0]?.name : '') || '标准构图';
  }

  const confirmPlatformStrategy = document.getElementById('fsConfirmPlatformStrategy');
  if (confirmPlatformStrategy) {
    const platforms = appState.selectedPlatforms && appState.selectedPlatforms.length > 0
      ? appState.selectedPlatforms
      : ['custom'];
    const pNames = platforms.map(p => {
      const def = PLATFORM_STRATEGIES[p] || PLATFORM_STRATEGIES['custom'];
      return `${def.name}策略 (${def.style})`;
    });
    confirmPlatformStrategy.textContent = pNames.join(' | ');
  }
}

// ===== FS Step 3: Platform Selection =====
function fsTogglePlatform(el) {
  const platform = el.dataset.platform;
  const idx = appState.selectedPlatforms.indexOf(platform);
  if (idx === -1) {
    appState.selectedPlatforms.push(platform);
    el.classList.add('selected');
  } else {
    appState.selectedPlatforms.splice(idx, 1);
    el.classList.remove('selected');
  }
  document.getElementById('btnFsPlatformNext').disabled = appState.selectedPlatforms.length === 0;
}

// ===== FS Step 4: Theme Selection =====
function selectTheme(el, themeName) {
  document.querySelectorAll('.fs-theme-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}

// ===== FS Step 4: Generate Copy (merged from old Step 4 + Step 5) =====
async function fsRunCopyGeneration() {
  const kb = getCurrentKB();
  const analysis = appState.productAnalysis || {};

  // 如果 KB 已匹配但还没有默认选中卖点/场景，自动填入 KB 默认值
  if (kb) {
    if (appState.selectedSellingPoints.length === 0) {
      appState.selectedSellingPoints = kb.sellingPoints.slice(0, 5);
    }
    if (appState.selectedScenes.length === 0) {
      appState.selectedScenes = kb.scenes.slice(0, 2).map(s => s.id);
    }
  }

  // 产品名称
  const productName = analysis.productName || (kb ? kb.name : '产品');
  // 品类名称
  const categoryName = kb ? kb.name : (analysis.category || '');

  // 主图标题文案：从选中的前3个卖点自动拼接
  const topSP = appState.selectedSellingPoints.slice(0, 3);
  const headline = topSP.length > 0 ? topSP.join(' | ') : '';

  // 核心卖点文案
  const sellingPointsText = appState.selectedSellingPoints.join('、');

  // 使用场景描述
  let scenesText = '';
  if (kb && appState.selectedScenes.length > 0) {
    const sceneDescs = appState.selectedScenes.map(sid => {
      const s = kb.scenes.find(sc => sc.id === sid);
      return s ? s.name : sid;
    });
    scenesText = sceneDescs.join('、');
  }

  // 产品规格参数
  const specItems = Object.entries(appState.userSpecs)
    .filter(([_, v]) => v)
    .map(([k, v]) => {
      const spec = kb?.specs?.find(s => s.key === k);
      return spec ? `${spec.label}: ${v}` : `${k}: ${v}`;
    });
  const specsText = specItems.join(' | ');

  // 写入 appState
  appState.copyTexts = { productName, categoryName, headline, sellingPointsText, scenesText, specsText };

  // 填充到表单
  document.getElementById('copyProductName').value = productName;
  document.getElementById('copyCategoryName').value = categoryName;
  document.getElementById('copyHeadline').value = headline;
  document.getElementById('copySellingPoints').value = sellingPointsText;
  document.getElementById('copyScenes').value = scenesText;
  document.getElementById('copySpecs').value = specsText;
}

// Step 5 文案字段变更处理
function onCopyFieldChange(field, value) {
  appState.copyTexts[field] = value;
}

// ===== FS Step 5: Confirm Strategy =====
function fsShowConfirmation() {
  // 从用户实际选择更新确认页
  updateConfirmFromSelections();

  // Animate progress bar
  const bar = document.getElementById('fsConfirmProgressBar');
  const countdown = document.getElementById('fsConfirmCountdown');
  bar.style.width = '0%';

  let seconds = 3;
  countdown.textContent = `${seconds}秒后自动开始生成主图...`;

  const timer = setInterval(() => {
    seconds--;
    if (seconds <= 0) {
      clearInterval(timer);
      countdown.textContent = '即将开始生成...';
      bar.style.width = '100%';
    } else {
      countdown.textContent = `${seconds}秒后自动开始生成主图...`;
      bar.style.width = `${((3 - seconds) / 3) * 100}%`;
    }
  }, 1000);
}

// ===== FS Step 6: Generation =====
async function fsStartGeneration() {
  if (appState.isGenerating) return;
  appState.isGenerating = true;

  const loading = document.getElementById('generationLoading');
  const results = document.getElementById('resultsSection');
  const progressBar = document.getElementById('progressBar');
  const loadingText = document.getElementById('loadingText');
  const loadingStatus = document.getElementById('loadingStatus');

  loading.style.display = 'block';
  results.style.display = 'none';

  // Call the shared generation logic
  await startGeneration();
}

// Cache DOM elements for scroll event
const navbar = document.getElementById('navbar');
const navLinks = document.querySelectorAll('.nav-links a');
const sectionIds = ['hero', 'steps-flow', 'comparison'];
const sections = sectionIds.map(id => document.getElementById(id)).filter(Boolean);

window.addEventListener('scroll', () => {
  if (window.scrollY > 50) navbar.classList.add('scrolled');
  else navbar.classList.remove('scrolled');

  let current = '';
  sections.forEach((section) => {
    if (section.getBoundingClientRect().top <= 200) current = section.id;
  });
  navLinks.forEach((a) => {
    a.classList.toggle('active', a.getAttribute('href') === '#' + current);
  });
});

function toggleMobileNav() {
  const links = document.querySelector('.nav-links');
  links.style.display = links.style.display === 'flex' ? 'none' : 'flex';
}

// ===== Scroll Animations =====
const observer = new IntersectionObserver(
  (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }),
  { threshold: 0.1 }
);
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.animate-on-scroll').forEach((el) => observer.observe(el));
});

// ===== Wizard Steps (Legacy - kept for compatibility) =====
function goToStep(step) {
  // Redirect to fullscreen wizard
  openFullscreenWizard();
  fsGoToStep(step);
}

// ===== Step 1: Upload =====
// File input is now shared - handled by triggerFsUpload in fullscreen wizard

function handleFiles(files) {
  Array.from(files).forEach((file) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) { showToast('⚠️ 文件大小不能超过 10MB'); return; }
    appState.uploadedFiles.push(file);
    const reader = new FileReader();
    reader.onload = (e) => { appState.uploadedPreviews.push(e.target.result); };
    reader.readAsDataURL(file);
  });
}

function renderPreviews() {
  // No longer needed - handled by fullscreen wizard slots
}

function removePreview(index) {
  appState.uploadedFiles.splice(index, 1);
  appState.uploadedPreviews.splice(index, 1);
}

// ===== Auto-analyze after upload =====
let _analysisTimer = null;
let _isAnalyzing = false;

function triggerAutoAnalysis() {
  // Debounce: wait 500ms after last upload before calling API
  clearTimeout(_analysisTimer);
  _analysisTimer = setTimeout(async () => {
    const config = getApiConfig();
    if (!config.apiKey || config.apiKey.length < 10) return;
    if (_isAnalyzing) return;
    _isAnalyzing = true;

    showToast('🤖 正在自动分析产品图片...');
    try {
      const analysis = await analyzeProductImage();
      if (analysis) {
        appState.productAnalysis = analysis;
        showToast('✅ 产品识别完成：' + (analysis.productName || '产品'));
      }
    } catch (err) {
      console.warn('Auto-analysis failed:', err.message);
    }
    _isAnalyzing = false;
  }, 500);
}

// ===== Step 2: Platform Selection (Legacy) =====
function togglePlatform(el) {
  fsTogglePlatform(el);
}

// ===== 豆包 Vision API: Image Understanding =====

/**
 * Call doubao-seed-2-0-mini-260215 to analyze the uploaded product image
 * Uses /api/v3/responses endpoint with input_image
 */
async function callVisionAPI(imageDataUrl, textPrompt) {
  const config = getApiConfig();
  const apiUrl = `${API_BASE_URL}/responses`;

  const requestBody = {
    model: 'doubao-seed-2-0-mini-260215',
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_image',
            image_url: imageDataUrl,  // data URL of the uploaded image
          },
          {
            type: 'input_text',
            text: textPrompt,
          },
        ],
      },
    ],
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();

  // Extract text response
  if (data.output && data.output.length > 0) {
    for (const item of data.output) {
      if (item.type === 'message' && item.content) {
        for (const c of item.content) {
          if (c.type === 'output_text') return c.text;
        }
      }
    }
  }

  // Fallback: try choices format
  if (data.choices && data.choices[0]) {
    return data.choices[0].message?.content || '';
  }

  throw new Error('Vision API 未返回文字分析结果');
}

/**
 * Analyze the product image — first identify category, then enrich from KB
 */
async function analyzeProductImage() {
  const config = getApiConfig();
  if (!config.apiKey || config.apiKey.length < 10) return null;
  if (appState.uploadedPreviews.length === 0) return null;

  const imageDataUrl = appState.uploadedPreviews[0];

  // Step 1: 品类识别 prompt —— 简化，专注识别
  const categoryPrompt = `你是一个电商产品识别专家。请仔细观察这张产品图片，识别产品类型。
请严格只返回JSON，不要其他文字：

{
  "productName": "产品名称，如：智能空气净化器 Pro",
  "category": "产品大类，如：空气净化器",
  "subCategory": "产品子类，如：家用除甲醛型",
  "confidence": 0.95,
  "visualFeatures": ["从图片中观察到的外观特征1", "特征2", "特征3"]
}`;

  try {
    const responseText = await callVisionAPI(imageDataUrl, categoryPrompt);

    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();
    const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (braceMatch) jsonStr = braceMatch[0];

    const recognition = JSON.parse(jsonStr);

    // Step 2: 匹配知识库品类
    const matchedKey = matchCategory(recognition.productName, recognition.category);
    if (matchedKey) {
      appState.confirmedCategory = matchedKey;
      const kb = CATEGORY_KB[matchedKey];
      // 用知识库数据充实分析结果
      recognition.matchedCategory = matchedKey;
      recognition.matchedCategoryName = kb.name;
      recognition.kbSellingPoints = kb.sellingPoints;
      recognition.kbScenes = kb.scenes;
      recognition.kbSpecs = kb.specs;
      recognition.kbCompositions = kb.compositions;
      // 默认选中前 5 个卖点
      appState.selectedSellingPoints = kb.sellingPoints.slice(0, 5);
      // 默认选中前 2 个场景
      appState.selectedScenes = kb.scenes.slice(0, 2).map(s => s.id);
    }

    return recognition;
  } catch (err) {
    console.error('Product analysis parsing error:', err);
    return null;
  }
}

/**
 * Run AI Analysis — uses real Vision API if API key is set, otherwise falls back to demo
 */
async function runAIAnalysis() {
  const panel = document.getElementById('aiAnalysisPanel');
  if (appState.selectedPlatforms.length === 0) { panel.style.display = 'none'; return; }

  panel.style.display = 'block';

  const categoryEl = document.getElementById('analysisCategory');
  const featuresEl = document.getElementById('analysisFeatures');
  const copyEl = document.getElementById('analysisCopy');
  const tagsEl = document.getElementById('analysisTags');

  // Reset
  categoryEl.textContent = '🔍 AI 正在分析产品图片...';
  featuresEl.textContent = '分析中...';
  copyEl.textContent = '分析中...';
  tagsEl.innerHTML = '';

  const config = getApiConfig();
  const hasApiKey = config.apiKey && config.apiKey.length > 10;

  // If already analyzed, use cached result
  if (appState.productAnalysis) {
    displayAnalysis(appState.productAnalysis);
    return;
  }

  if (hasApiKey && appState.uploadedPreviews.length > 0) {
    // === Real API Analysis ===
    try {
      showToast('🤖 正在通过 AI 分析产品图片...');
      const analysis = await analyzeProductImage();

      if (analysis) {
        appState.productAnalysis = analysis;
        displayAnalysis(analysis);
        showToast('✅ 产品分析完成：' + (analysis.productName || '产品'));
        return;
      }
    } catch (err) {
      console.error('AI analysis error:', err);
      showToast('⚠️ AI 分析失败，使用默认数据');
    }
  }

  // === Fallback: Demo analysis ===
  displayDemoAnalysis();
}

function displayAnalysis(analysis) {
  const categoryEl = document.getElementById('analysisCategory');
  const copyEl = document.getElementById('analysisCopy');
  const tagsEl = document.getElementById('analysisTags');

  const kb = getCurrentKB();
  const categoryText = kb
    ? `${analysis.productName} · ${kb.name}（知识库已匹配）`
    : `${analysis.productName} · ${analysis.category}`;
  typeText(categoryEl, categoryText, 40);

  // 展示知识库卖点 + AI 视觉特征
  const kbTags = kb ? kb.sellingPoints.slice(0, 5) : [];
  const visualTags = analysis.visualFeatures || [];
  const allTags = [...kbTags, ...visualTags];
  setTimeout(() => {
    tagsEl.innerHTML = allTags.map((f, i) => {
      const isKb = i < kbTags.length;
      return `<span class="tag ${isKb ? 'tag-kb' : ''}">${isKb ? '🔥 ' : ''}${f}</span>`;
    }).join('');
  }, 500);

  setTimeout(() => {
    const desc = kb
      ? `已加载「${kb.name}」品类知识库，包含 ${kb.sellingPoints.length} 个热门卖点、${kb.scenes.length} 个推荐场景。`
      : '未匹配到知识库，建议在上一步手动选择品类。';
    typeText(copyEl, desc, 25);
  }, 800);
}

function displayDemoAnalysis() {
  const categoryEl = document.getElementById('analysisCategory');
  const tagsEl = document.getElementById('analysisTags');
  const copyEl = document.getElementById('analysisCopy');

  const demoFeatures = ['品质优良', '设计精美', '实用便捷', '耐用可靠', '性价比高'];
  setTimeout(() => typeText(categoryEl, '产品（演示模式 - 请设置 API Key 获取真实分析）', 30), 300);
  setTimeout(() => {
    tagsEl.innerHTML = demoFeatures.map((f) => `<span class="tag">${f}</span>`).join('');
  }, 800);
  setTimeout(() => typeText(copyEl, '请点击 ⚙️ 设置 API Key 后，AI 将自动识别您的产品并生成针对性文案', 25), 1200);
}

function typeText(el, text, speed) {
  el.textContent = '';
  let i = 0;
  const timer = setInterval(() => {
    el.textContent += text[i];
    i++;
    if (i >= text.length) clearInterval(timer);
  }, speed);
}

// ===== 白底图抠图 =====
/**
 * 将实物图抠成白底图 —— 调用 Seedream API
 * Jane: "先将实物图抠成白底图"
 */
async function generateWhiteBackground() {
  const config = getApiConfig();
  if (!config.apiKey || config.apiKey.length < 10) return null;
  if (appState.uploadedPreviews.length === 0) return null;

  // 如果已经生成过，直接返回
  if (appState.whiteBackgroundImage) return appState.whiteBackgroundImage;

  const imageRefs = appState.uploadedPreviews.filter(p => p.startsWith('data:'));
  const product = appState.productAnalysis?.productName || '产品';

  try {
    const prompt = `将这个${product}放在纯白色背景上，保持产品原始外观不变，移除所有背景元素，只保留产品本身，纯白色背景，专业产品摄影，均匀柔和的灯光`;
    const result = await callDoubaoImageAPI(prompt, imageRefs);
    appState.whiteBackgroundImage = result;
    return result;
  } catch (err) {
    console.warn('White background generation failed:', err.message);
    return null;
  }
}

// ===== 豆包 Seedream API: Image Generation =====

/**
 * Call the Doubao Seedream API to generate an image
 * Sends uploaded images as references via the `image` field
 */
async function callDoubaoImageAPI(prompt, imageDataUrls) {
  const config = getApiConfig();
  const apiUrl = `${API_BASE_URL}/images/generations`;

  const styleDesc = STYLE_MAP[config.style] || '';
  const fullPrompt = prompt + (styleDesc ? `，${styleDesc}` : '');

  const requestBody = {
    model: config.model,
    prompt: fullPrompt,
    response_format: 'b64_json',
    size: config.size,
  };

  // Send uploaded images as references
  if (imageDataUrls && imageDataUrls.length > 0) {
    requestBody.image = imageDataUrls;
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();

  if (data.data && data.data.length > 0) {
    const imageItem = data.data[0];
    if (imageItem.b64_json) return `data:image/png;base64,${imageItem.b64_json}`;
    if (imageItem.url) return imageItem.url;
  }

  throw new Error('API 没有返回图片数据');
}

// ===== Step 3: Generation =====
async function startGeneration() {
  if (appState.isGenerating && appState.fsCurrentStep !== 6) return;
  appState.isGenerating = true;

  const loading = document.getElementById('generationLoading');
  const results = document.getElementById('resultsSection');
  const progressBar = document.getElementById('progressBar');
  const loadingText = document.getElementById('loadingText');
  const loadingStatus = document.getElementById('loadingStatus');

  loading.style.display = 'block';
  results.style.display = 'none';

  const config = getApiConfig();
  const hasApiKey = config.apiKey && config.apiKey.length > 10;

  if (!hasApiKey) {
    showToast('⚠️ 未设置 API Key，使用演示模式。点击 ⚙️ 设置 API Key');
    runDemoGeneration(progressBar, loadingText, loadingStatus, loading);
    return;
  }

  // ===== Real API Generation =====
  try {
    // Step A: Ensure we have product analysis
    if (!appState.productAnalysis) {
      loadingText.textContent = '正在通过 AI 分析产品...';
      loadingStatus.textContent = '调用 Vision API 识别产品';
      progressBar.style.width = '3%';

      const analysis = await analyzeProductImage();
      if (analysis) {
        appState.productAnalysis = analysis;
      }
    }

    // Step A2: 生成白底图（如果还没有）
    if (!appState.whiteBackgroundImage) {
      loadingText.textContent = '正在生成白底图...';
      loadingStatus.textContent = '将实物图抠成白底图，作为生成基础';
      progressBar.style.width = '5%';
      await generateWhiteBackground();
    }

    // Step B: Build dynamic result types based on KB + user selections
    const resultTypes = appState.productAnalysis
      ? buildResultTypes(appState.productAnalysis)
      : DEFAULT_RESULT_TYPES;

    // Step C: Collect image refs — 优先用白底图，其次用原始上传图
    const imageRefs = [];
    if (appState.whiteBackgroundImage) {
      imageRefs.push(appState.whiteBackgroundImage);
    }
    const uploadRefs = appState.uploadedPreviews.filter((p) => p.startsWith('data:'));
    imageRefs.push(...uploadRefs);

    loadingText.textContent = '正在通过豆包 Seedream 并发生成图片...';
    loadingStatus.textContent = `模型: ${config.model} | 尺寸: ${config.size} | 并发 ${resultTypes.length} 张`;
    progressBar.style.width = '10%';

    const totalImages = resultTypes.length;
    let completedCount = 0;

    // Launch all generation tasks concurrently
    const generationPromises = resultTypes.map(async (resultType, i) => {
      try {
        const imageUrl = await callDoubaoImageAPI(resultType.prompt, imageRefs);
        completedCount++;
        const progress = Math.round((completedCount / totalImages) * 90) + 10;
        progressBar.style.width = progress + '%';
        loadingText.textContent = `已完成 ${completedCount}/${totalImages} 张`;
        loadingStatus.textContent = `✅ ${resultType.type} 生成成功`;
        return { ...resultType, image: imageUrl, isGenerated: true };
      } catch (err) {
        completedCount++;
        const progress = Math.round((completedCount / totalImages) * 90) + 10;
        progressBar.style.width = progress + '%';
        console.warn(`Failed: ${resultType.type}:`, err.message);
        loadingStatus.textContent = `⚠️ ${resultType.type}: ${err.message.substring(0, 50)}`;
        return { ...resultType, isGenerated: false };
      }
    });

    const generatedResults = await Promise.all(generationPromises);

    progressBar.style.width = '100%';
    loadingText.textContent = '生成完毕！';
    loadingStatus.textContent = '所有图片已就绪';

    setTimeout(() => {
      loading.style.display = 'none';
      showResults(generatedResults);
    }, 600);
  } catch (err) {
    console.error('Generation error:', err);
    showToast('❌ API 调用失败: ' + err.message + '，切换到演示模式');
    runDemoGeneration(progressBar, loadingText, loadingStatus, loading);
  }
}

function runDemoGeneration(progressBar, loadingText, loadingStatus, loading) {
  const stages = [
    { progress: 10, text: '正在分析产品图片...', status: '智能识别产品特征' },
    { progress: 25, text: '正在进行智能抠图...', status: 'AI 边缘检测与分割' },
    { progress: 40, text: '正在生成白底主图...', status: '白底处理 + 光影重塑' },
    { progress: 55, text: '正在合成场景图片...', status: '场景匹配 + 光照适配' },
    { progress: 70, text: '正在制作卖点图...', status: '卖点提取 + 文案排版' },
    { progress: 82, text: '正在渲染结构图...', status: '3D建模 + 爆炸视图' },
    { progress: 92, text: '优化图片质量...', status: '超分辨率 + 色彩校正' },
    { progress: 100, text: '生成完毕！（演示模式）', status: '所有图片已就绪' },
  ];

  let stageIdx = 0;
  const stageTimer = setInterval(() => {
    if (stageIdx >= stages.length) {
      clearInterval(stageTimer);
      setTimeout(() => { loading.style.display = 'none'; showResults(null); }, 600);
      return;
    }
    const stage = stages[stageIdx];
    progressBar.style.width = stage.progress + '%';
    loadingText.textContent = stage.text;
    loadingStatus.textContent = stage.status;
    stageIdx++;
  }, 500);
}

function showResults(generatedResults) {
  const results = document.getElementById('resultsSection');
  const grid = document.getElementById('resultsGrid');

  const displayData = generatedResults || DEFAULT_RESULT_TYPES.map((r) => ({ ...r, isGenerated: false }));
  appState.generatedImages = displayData;

  grid.innerHTML = displayData
    .map((r, i) => `
    <div class="result-card" style="animation: fadeInUp 0.5s ease ${i * 0.08}s both">
      <div class="result-image-container">
        <img src="${r.image}" alt="${r.type}" loading="lazy">
        <span class="result-type-badge ${r.badge}">${r.type}</span>
        ${r.isGenerated ? '<span class="result-type-badge badge-scene" style="top:auto;bottom:8px;left:8px">✨ AI 生成</span>' : ''}
        <div class="result-overlay">
          <div class="result-overlay-actions">
            <button class="overlay-btn" onclick="previewImage(${i})" title="预览">🔍</button>
            <button class="overlay-btn" onclick="downloadImage(${i})" title="下载">📥</button>
          </div>
        </div>
      </div>
      <div class="result-info">
        <h4>${r.type}</h4>
        <div class="result-edit">
          <input type="text" placeholder="${r.editPlaceholder}" id="edit-${i}">
          <button class="regen-btn" onclick="regenerateImage(${i})">🔄 重新生成</button>
        </div>
      </div>
    </div>`)
    .join('');

  results.style.display = 'block';
  document.getElementById('resultCount').textContent = displayData.length;
  appState.isGenerating = false;

  const aiCount = displayData.filter((r) => r.isGenerated).length;
  if (aiCount > 0) showToast(`✅ 通过豆包 Seedream 生成了 ${aiCount} 张图片，共 ${displayData.length} 张`);
  else showToast('✅ 已生成 ' + displayData.length + ' 张电商图片（演示模式）');
}

// ===== Single Image Regeneration =====
async function regenerateImage(index) {
  const input = document.getElementById(`edit-${index}`);
  const prompt = input.value.trim();
  if (!prompt) { showToast('💡 请先输入修改描述'); return; }

  const card = document.querySelectorAll('.result-card')[index];
  card.style.opacity = '0.5';
  card.style.pointerEvents = 'none';

  const config = getApiConfig();

  if (config.apiKey && config.apiKey.length > 10) {
    try {
      showToast('🎨 正在通过 API 重新生成...');
      const resultType = appState.generatedImages[index];
      const fullPrompt = `${resultType.prompt}，用户要求修改：${prompt}`;
      const imageRefs = appState.uploadedPreviews.filter((p) => p.startsWith('data:'));
      const newImageUrl = await callDoubaoImageAPI(fullPrompt, imageRefs);

      card.querySelector('.result-image-container img').src = newImageUrl;
      appState.generatedImages[index].image = newImageUrl;
      appState.generatedImages[index].isGenerated = true;
      showToast('✅ 图片已通过 AI 重新生成');
    } catch (err) {
      showToast('⚠️ API 调用失败: ' + err.message);
    }
  } else {
    await new Promise((r) => setTimeout(r, 2000));
    showToast('✅ 图片已重新生成（演示模式）');
  }

  card.style.opacity = '1';
  card.style.pointerEvents = '';
  input.value = '';
}

// ===== Global Edit =====
function setGlobalPrompt(text) {
  document.getElementById('globalEditInput').value = text;
}

async function applyGlobalEdit() {
  const input = document.getElementById('globalEditInput');
  const prompt = input.value.trim();
  if (!prompt) { showToast('💡 请先输入修改意见'); return; }

  const cards = document.querySelectorAll('.result-card');
  cards.forEach((c) => { c.style.opacity = '0.5'; c.style.pointerEvents = 'none'; });

  const config = getApiConfig();

  if (config.apiKey && config.apiKey.length > 10) {
    showToast('🎨 正在通过 API 应用全局修改...');
    const imageRefs = appState.uploadedPreviews.filter((p) => p.startsWith('data:'));
    let successCount = 0;

    for (let i = 0; i < cards.length; i++) {
      const resultType = appState.generatedImages[i];
      const fullPrompt = `${resultType.prompt}，整体风格修改要求：${prompt}`;
      try {
        const newImageUrl = await callDoubaoImageAPI(fullPrompt, imageRefs);
        cards[i].querySelector('.result-image-container img').src = newImageUrl;
        appState.generatedImages[i].image = newImageUrl;
        appState.generatedImages[i].isGenerated = true;
        successCount++;
      } catch (err) {
        console.warn(`Global edit failed for ${i}:`, err.message);
      }
      if (i < cards.length - 1) await new Promise((r) => setTimeout(r, 800));
    }

    cards.forEach((c) => { c.style.opacity = '1'; c.style.pointerEvents = ''; });
    input.value = '';
    showToast(`✅ 全局修改完成，${successCount}/${cards.length} 张图片已更新`);
  } else {
    showToast('🎨 正在应用修改...');
    setTimeout(() => {
      cards.forEach((c) => { c.style.opacity = '1'; c.style.pointerEvents = ''; });
      input.value = '';
      showToast('✅ 所有图片已重新渲染（演示模式）');
    }, 3000);
  }
}

// ===== Preview & Download =====
function previewImage(index) {
  const data = appState.generatedImages[index] || DEFAULT_RESULT_TYPES[index];
  document.getElementById('modalImage').src = data.image;
  document.getElementById('imageModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('imageModal').classList.remove('active');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeModal(); closeApiSettings(); closeFullscreenWizard(); }
});

function downloadImage(index) {
  const data = appState.generatedImages[index] || DEFAULT_RESULT_TYPES[index];
  const a = document.createElement('a');
  a.href = data.image;
  a.download = `SmartPhoto_${data.type}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('📥 已下载：' + data.type);
}

function downloadAll() {
  showToast('📦 正在打包下载所有图片...');
  const images = appState.generatedImages.length > 0 ? appState.generatedImages : DEFAULT_RESULT_TYPES;
  images.forEach((r, i) => {
    setTimeout(() => {
      const a = document.createElement('a');
      a.href = r.image;
      a.download = `SmartPhoto_${i + 1}_${r.type}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }, i * 300);
  });
  setTimeout(() => showToast('✅ 所有图片已下载完成'), images.length * 300 + 500);
}

// ===== API Settings Modal =====
function openApiSettings() {
  document.getElementById('settingsModal').classList.add('active');
  document.body.style.overflow = 'hidden';
  const config = getApiConfig();
  document.getElementById('apiKeyInput').value = config.apiKey;
  document.getElementById('modelSelect').value = config.model;
  document.getElementById('imageStyleSelect').value = config.style;
  document.getElementById('imageSizeSelect').value = config.size;
  setSettingsStatus('', '');
}

function closeApiSettings() {
  document.getElementById('settingsModal').classList.remove('active');
  document.body.style.overflow = '';
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('apiKeyInput');
  input.type = input.type === 'password' ? 'text' : 'password';
}

function setSettingsStatus(message, type) {
  const el = document.getElementById('settingsStatus');
  el.textContent = message;
  el.className = 'settings-status';
  if (message) el.classList.add('show', type);
}

function saveApiSettings() {
  const apiKey = document.getElementById('apiKeyInput').value.trim();
  const model = document.getElementById('modelSelect').value;
  const style = document.getElementById('imageStyleSelect').value;
  const size = document.getElementById('imageSizeSelect').value;

  localStorage.setItem('smartphoto_api_key', apiKey);
  localStorage.setItem('smartphoto_model', model);
  localStorage.setItem('smartphoto_style', style);
  localStorage.setItem('smartphoto_size', size);

  setSettingsStatus('✅ 设置已保存！', 'success');
  updateApiStatusDot();
  showToast('💾 API 设置已保存');
  // Reset cached analysis so it re-runs with new settings
  appState.productAnalysis = null;
  appState.confirmedCategory = null;
  appState.whiteBackgroundImage = null;
  setTimeout(() => closeApiSettings(), 1200);
}

async function testApiConnection() {
  const apiKey = document.getElementById('apiKeyInput').value.trim();
  const model = document.getElementById('modelSelect').value;
  if (!apiKey) { setSettingsStatus('❌ 请输入 API Key', 'error'); return; }

  setSettingsStatus('🔄 正在测试连接（生成测试图片）...', 'loading');

  try {
    const response = await fetch(`${API_BASE_URL}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        prompt: '一个红色的苹果，白色背景，产品摄影',
        response_format: 'url',
        size: document.getElementById('imageSizeSelect').value,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.data && data.data.length > 0) {
        setSettingsStatus('✅ 连接成功！API Key 有效，Seedream 模型可用。Vision 模型 (doubao-seed-2-0-mini) 将用于产品分析。', 'success');
      } else {
        setSettingsStatus('⚠️ 连接成功但未返回图片数据', 'error');
      }
    } else {
      const errData = await response.json().catch(() => ({}));
      setSettingsStatus('❌ 连接失败: ' + (errData.error?.message || `HTTP ${response.status}`), 'error');
    }
  } catch (err) {
    setSettingsStatus('❌ 网络错误: ' + err.message, 'error');
  }
}

function updateApiStatusDot() {
  const btn = document.querySelector('.nav-setting-btn');
  if (!btn) return;
  const existing = btn.querySelector('.api-connected-dot');
  if (existing) existing.remove();
  const config = getApiConfig();
  if (config.apiKey && config.apiKey.length > 10) {
    const dot = document.createElement('span');
    dot.className = 'api-connected-dot';
    btn.appendChild(dot);
  }
}

// ===== Toast =====
function showToast(message) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  updateApiStatusDot();
  const config = getApiConfig();
  if (config.apiKey) {
    console.log('SmartPhoto: API Key 已加载');
    console.log('SmartPhoto: 图生图模型 =', config.model);
    console.log('SmartPhoto: 图生文字模型 = doubao-seed-2-0-mini-260215');
  } else {
    console.log('SmartPhoto: 未设置 API Key，演示模式');
  }
});

// ===== Exports for testing =====
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildResultTypes, DEMO_IMAGES };
}
