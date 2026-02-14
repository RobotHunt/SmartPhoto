// ============================================
// SmartPhoto - AI电商做图平台
// 豆包 Seedream + Seed Vision API
// ============================================

// ===== State Management =====
const appState = {
  currentStep: 1,
  uploadedFiles: [],
  uploadedPreviews: [],       // data URLs of uploaded images
  selectedPlatforms: [],
  generatedImages: [],
  isGenerating: false,
  productAnalysis: null,      // AI analysis result
};

// ===== API Configuration =====
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

// ===== Dynamic Result Type Builders =====
// These build prompt templates using the AI analysis of the actual product
function buildResultTypes(analysis) {
  const product = analysis.productName || '产品';
  const features = analysis.features || [];
  const featureStr = features.slice(0, 3).join('、') || '优质设计';
  const category = analysis.category || '产品';
  const sceneKeyword = analysis.sceneKeyword || '家居';

  return [
    {
      type: '白底主图',
      badge: 'badge-white',
      desc: `纯白背景${product}主图，突出产品整体`,
      image: DEMO_IMAGES.original,
      editPlaceholder: '修改描述：如"换成浅灰色背景"',
      prompt: `一张专业电商${category}产品主图，纯白色背景，完整展示${product}的整体外观，光线均匀柔和，高清晰度正面角度拍摄，商业摄影品质，突出${featureStr}等特点`,
    },
    {
      type: `场景主图 · ${analysis.scene1 || '生活场景'}`,
      badge: 'badge-scene',
      desc: `${analysis.scene1 || '生活场景'}中展示${product}`,
      image: DEMO_IMAGES.scene,
      editPlaceholder: '修改描述：如"换个使用环境"',
      prompt: `${product}放在${analysis.scene1Desc || '现代温馨明亮的居家环境中'}，自然光线照射，展示${product}在实际${sceneKeyword}场景中的使用效果，专业室内摄影效果，突出${featureStr}`,
    },
    {
      type: `场景主图 · ${analysis.scene2 || '使用场景'}`,
      badge: 'badge-scene',
      desc: `${analysis.scene2 || '使用场景'}中展示${product}`,
      image: DEMO_IMAGES.scene,
      editPlaceholder: '修改描述：如"换个使用场景"',
      prompt: `${product}放在${analysis.scene2Desc || '另一个适合的使用环境中'}，柔和的光线，展示${product}的另一种使用场景和氛围，专业摄影效果`,
    },
    {
      type: `卖点图 · ${features[0] || '核心卖点'}`,
      badge: 'badge-selling',
      desc: `突出展示${product}的${features[0] || '核心卖点'}`,
      image: DEMO_IMAGES.sellingPoint,
      editPlaceholder: '修改描述：如"突出其他卖点"',
      prompt: `${product}的${features[0] || '核心功能'}特写展示图，用视觉标注突出${features[0] || '核心卖点'}这个卖点，配合简洁的说明文字，专业产品卖点图风格，白色简洁背景`,
    },
    {
      type: `卖点图 · ${features[1] || '产品特性'}`,
      badge: 'badge-selling',
      desc: `突出展示${product}的${features[1] || '产品特性'}`,
      image: DEMO_IMAGES.sellingPoint,
      editPlaceholder: '修改描述：如"换个卖点展示"',
      prompt: `${product}的${features[1] || '重要特性'}展示图，通过视觉标注和图解展示${features[1] || '产品特性'}，专业技术图解风格，配清晰文字标注，白色背景`,
    },
    {
      type: '结构图 · 爆炸视图',
      badge: 'badge-structure',
      desc: `${product}内部结构爆炸图`,
      image: DEMO_IMAGES.structure,
      editPlaceholder: '修改描述：如"增加尺寸标注"',
      prompt: `${product}的爆炸视图结构图，将各个组件分解展示，标注每个部件名称和功能，白色背景，技术图纸风格，工程制图效果，展示${featureStr}等核心技术`,
    },
    {
      type: '白底主图 · 45°角',
      badge: 'badge-white',
      desc: `45度角度展示${product}的立体感和质感`,
      image: DEMO_IMAGES.original,
      editPlaceholder: '修改描述：如"换成黑色背景"',
      prompt: `${product}以45度角展示在纯白背景上，展现产品的立体感和精致质感，专业电商${category}产品摄影，光影层次分明，高级商业摄影品质`,
    },
  ];
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
  const el = document.getElementById('app-section');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

window.addEventListener('scroll', () => {
  const navbar = document.getElementById('navbar');
  if (window.scrollY > 50) navbar.classList.add('scrolled');
  else navbar.classList.remove('scrolled');

  const sections = ['hero', 'steps-flow', 'app-section', 'comparison'];
  let current = '';
  sections.forEach((id) => {
    const section = document.getElementById(id);
    if (section && section.getBoundingClientRect().top <= 200) current = id;
  });
  document.querySelectorAll('.nav-links a').forEach((a) => {
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

// ===== Wizard Steps =====
function goToStep(step) {
  if (step === 2 && appState.uploadedFiles.length === 0) {
    showToast('⚠️ 请先上传至少一张产品图片');
    return;
  }
  if (step === 3 && appState.selectedPlatforms.length === 0) {
    showToast('⚠️ 请先选择至少一个目标平台');
    return;
  }

  appState.currentStep = step;

  document.querySelectorAll('.wizard-step').forEach((ws) => {
    const s = parseInt(ws.dataset.step);
    ws.classList.remove('active', 'completed');
    if (s === step) ws.classList.add('active');
    else if (s < step) ws.classList.add('completed');
  });

  document.querySelectorAll('.wizard-connector').forEach((c, i) => {
    c.classList.toggle('active', i < step - 1);
  });

  document.querySelectorAll('.wizard-panel').forEach((p) => p.classList.remove('active'));
  const panel = document.getElementById(`panel-${step}`);
  if (panel) panel.classList.add('active');

  if (step === 2) runAIAnalysis();
  else if (step === 3) startGeneration();

  document.getElementById('app-section').scrollIntoView({ behavior: 'smooth' });
}

// ===== Step 1: Upload =====
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');

uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', (e) => { e.preventDefault(); uploadZone.classList.remove('drag-over'); handleFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

function handleFiles(files) {
  Array.from(files).forEach((file) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) { showToast('⚠️ 文件大小不能超过 10MB'); return; }
    appState.uploadedFiles.push(file);
    const reader = new FileReader();
    reader.onload = (e) => { appState.uploadedPreviews.push(e.target.result); renderPreviews(); };
    reader.readAsDataURL(file);
  });
}

function renderPreviews() {
  const container = document.getElementById('uploadPreviews');
  container.innerHTML = appState.uploadedPreviews
    .map((src, i) => `
    <div class="preview-item">
      <img src="${src}" alt="预览 ${i + 1}">
      <button class="remove-btn" data-action="remove" data-index="${i}">✕</button>
      <span class="preview-badge">✓ 已就绪</span>
    </div>`)
    .join('');
  document.getElementById('btnStep1Next').disabled = appState.uploadedFiles.length === 0;
  // Reset analysis and auto-trigger when images change
  appState.productAnalysis = null;
  if (appState.uploadedFiles.length > 0) {
    triggerAutoAnalysis();
  }
}

function removePreview(index) {
  appState.uploadedFiles.splice(index, 1);
  appState.uploadedPreviews.splice(index, 1);
  renderPreviews();
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
        // If analysis panel is visible, update it
        const panel = document.getElementById('aiAnalysisPanel');
        if (panel.style.display === 'block') {
          displayAnalysis(analysis);
        }
      }
    } catch (err) {
      console.warn('Auto-analysis failed:', err.message);
    }
    _isAnalyzing = false;
  }, 500);
}

// ===== Step 2: Platform Selection =====
function togglePlatform(el) {
  const platform = el.dataset.platform;
  const idx = appState.selectedPlatforms.indexOf(platform);
  if (idx === -1) { appState.selectedPlatforms.push(platform); el.classList.add('selected'); }
  else { appState.selectedPlatforms.splice(idx, 1); el.classList.remove('selected'); }

  document.getElementById('btnStep2Next').disabled = appState.selectedPlatforms.length === 0;
  if (appState.selectedPlatforms.length > 0) runAIAnalysis();
}

// ===== 豆包 Vision API: Image Understanding =====

/**
 * Call doubao-seed-2-0-mini-260215 to analyze the uploaded product image
 * Uses /api/v3/responses endpoint with input_image
 */
async function callVisionAPI(imageDataUrl, textPrompt) {
  const config = getApiConfig();
  const apiUrl = 'https://ark.cn-beijing.volces.com/api/v3/responses';

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
 * Analyze the product image and extract structured info
 */
async function analyzeProductImage() {
  const config = getApiConfig();
  if (!config.apiKey || config.apiKey.length < 10) return null;
  if (appState.uploadedPreviews.length === 0) return null;

  const imageDataUrl = appState.uploadedPreviews[0];

  const analysisPrompt = `你是一个电商产品图片分析专家。请仔细观察这张产品图片，分析并返回以下JSON格式信息（请严格只返回JSON，不要其他文字）：

{
  "productName": "产品名称，如：智能空气净化器",
  "category": "产品大类，如：家用电器",
  "features": ["卖点1", "卖点2", "卖点3", "卖点4", "卖点5"],
  "scene1": "场景名称1，如：客厅",
  "scene1Desc": "场景1详细描述，如：现代温馨明亮的客厅中，靠近沙发旁",
  "scene2": "场景名称2，如：办公室",
  "scene2Desc": "场景2详细描述",
  "sceneKeyword": "使用场景关键词，如：家居",
  "keywords": ["搜索关键词1", "关键词2", "关键词3"],
  "copyTaobao": "淘宝风格营销文案（带emoji和卖点标签）",
  "copyAmazon": "Amazon英文营销标题",
  "copy1688": "1688批发风格文案",
  "copyGeneral": "通用电商营销文案"
}`;

  try {
    const responseText = await callVisionAPI(imageDataUrl, analysisPrompt);

    // Try to parse JSON from the response (may be wrapped in markdown code block)
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    // Also try to find raw JSON
    const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (braceMatch) jsonStr = braceMatch[0];

    const analysis = JSON.parse(jsonStr);
    return analysis;
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

  typeText(categoryEl, `${analysis.productName} · ${analysis.category}`, 40);

  const allTags = [...(analysis.features || []), ...(analysis.keywords || [])];
  setTimeout(() => {
    tagsEl.innerHTML = allTags.map((f) => `<span class="tag">${f}</span>`).join('');
  }, 500);

  setTimeout(() => {
    const platform = appState.selectedPlatforms[0];
    let copy = analysis.copyGeneral || '';
    if (platform === 'taobao' || platform === 'jd' || platform === 'pdd' || platform === 'douyin' || platform === 'xiaohongshu') {
      copy = analysis.copyTaobao || copy;
    } else if (platform === 'amazon' || platform === 'tiktok' || platform === 'temu') {
      copy = analysis.copyAmazon || copy;
    } else if (platform === '1688' || platform === 'alibaba') {
      copy = analysis.copy1688 || copy;
    }
    typeText(copyEl, copy, 25);
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

// ===== 豆包 Seedream API: Image Generation =====

/**
 * Call the Doubao Seedream API to generate an image
 * Sends uploaded images as references via the `image` field
 */
async function callDoubaoImageAPI(prompt, imageDataUrls) {
  const config = getApiConfig();
  const apiUrl = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';

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
  if (appState.isGenerating) return;
  appState.isGenerating = true;

  const loading = document.getElementById('generationLoading');
  const results = document.getElementById('resultsSection');
  const actions = document.getElementById('step3Actions');
  const progressBar = document.getElementById('progressBar');
  const loadingText = document.getElementById('loadingText');
  const loadingStatus = document.getElementById('loadingStatus');

  loading.classList.add('active');
  results.style.display = 'none';
  actions.style.display = 'none';

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

    // Step B: Build dynamic result types based on analysis
    const resultTypes = appState.productAnalysis
      ? buildResultTypes(appState.productAnalysis)
      : DEFAULT_RESULT_TYPES;

    // Step C: Collect uploaded image data URLs to send as references
    const imageRefs = appState.uploadedPreviews.filter((p) => p.startsWith('data:'));

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
      loading.classList.remove('active');
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
      setTimeout(() => { loading.classList.remove('active'); showResults(null); }, 600);
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
  const actions = document.getElementById('step3Actions');
  const grid = document.getElementById('resultsGrid');

  const displayData = generatedResults || DEFAULT_RESULT_TYPES.map((r) => ({ ...r, isGenerated: false }));
  appState.generatedImages = displayData;

  grid.innerHTML = displayData
    .map((r, i) => {
      const isGeneratedBadge = r.isGenerated ? '<span class="result-type-badge badge-scene" style="top:auto;bottom:8px;left:8px">✨ AI 生成</span>' : '';

      return `
    <div class="result-card" style="animation: fadeInUp 0.5s ease ${i * 0.08}s both">
      <div class="result-image-container">
        <img src="${r.image}" alt="${r.type}" loading="lazy">
        <span class="result-type-badge ${r.badge}">${r.type}</span>
        ${isGeneratedBadge}
        <div class="result-overlay">
          <div class="result-overlay-actions">
            <button class="overlay-btn" data-action="preview" data-index="${i}" title="预览">🔍</button>
            <button class="overlay-btn" data-action="download" data-index="${i}" title="下载">📥</button>
          </div>
        </div>
      </div>
      <div class="result-info">
        <h4>${r.type}</h4>
        <div class="result-edit">
          <input type="text" placeholder="${r.editPlaceholder}" id="edit-${i}">
          <button class="regen-btn" data-action="regenerate" data-index="${i}">🔄 重新生成</button>
        </div>
      </div>
    </div>`;
    })
    .join('');

  results.style.display = 'block';
  actions.style.display = 'flex';
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
  if (e.key === 'Escape') { closeModal(); closeApiSettings(); }
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
  setTimeout(() => closeApiSettings(), 1200);
}

async function testApiConnection() {
  const apiKey = document.getElementById('apiKeyInput').value.trim();
  const model = document.getElementById('modelSelect').value;
  if (!apiKey) { setSettingsStatus('❌ 请输入 API Key', 'error'); return; }

  setSettingsStatus('🔄 正在测试连接（生成测试图片）...', 'loading');

  try {
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
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

// ===== Event Listeners Initialization =====
function initEventListeners() {
  // Navigation
  document.getElementById('navSettingBtn')?.addEventListener('click', openApiSettings);
  document.getElementById('navCtaBtn')?.addEventListener('click', scrollToApp);
  document.getElementById('mobileToggle')?.addEventListener('click', toggleMobileNav);

  // Hero
  document.getElementById('heroBtnPrimary')?.addEventListener('click', scrollToApp);
  document.getElementById('heroBtnSecondary')?.addEventListener('click', (e) => {
    scrollToSection(e.currentTarget.dataset.section);
  });

  // Wizard Navigation
  document.getElementById('btnStep1Next')?.addEventListener('click', (e) => {
    goToStep(parseInt(e.currentTarget.dataset.step));
  });
  document.getElementById('btnStep2Back')?.addEventListener('click', (e) => {
    goToStep(parseInt(e.currentTarget.dataset.step));
  });
  document.getElementById('btnStep2Next')?.addEventListener('click', (e) => {
    goToStep(parseInt(e.currentTarget.dataset.step));
  });
  document.getElementById('btnStep3Back')?.addEventListener('click', (e) => {
    goToStep(parseInt(e.currentTarget.dataset.step));
  });
  document.getElementById('btnStep3Done')?.addEventListener('click', (e) => {
    scrollToSection(e.currentTarget.dataset.section);
  });

  // Platform Selection (Delegation)
  document.querySelectorAll('.platform-grid').forEach(grid => {
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.platform-card');
      if (card) togglePlatform(card);
    });
  });

  // Global Edit
  document.getElementById('applyGlobalEditBtn')?.addEventListener('click', applyGlobalEdit);
  document.querySelectorAll('.example-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      setGlobalPrompt(e.currentTarget.dataset.prompt);
    });
  });

  // Results Actions
  document.getElementById('downloadAllBtn')?.addEventListener('click', downloadAll);
  document.getElementById('detailPageBtn')?.addEventListener('click', (e) => {
    showToast(e.currentTarget.dataset.toast);
  });

  // Dynamic Content Delegation (Upload Previews)
  document.getElementById('uploadPreviews')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action="remove"]');
    if (btn) {
      removePreview(parseInt(btn.dataset.index));
    }
  });

  // Dynamic Content Delegation (Results Grid)
  document.getElementById('resultsGrid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const index = parseInt(btn.dataset.index);

    if (action === 'preview') previewImage(index);
    else if (action === 'download') downloadImage(index);
    else if (action === 'regenerate') regenerateImage(index);
  });

  // Modals
  document.getElementById('imageModal')?.addEventListener('click', closeModal);
  document.querySelector('.modal-content')?.addEventListener('click', (e) => e.stopPropagation());
  document.getElementById('modalCloseBtn')?.addEventListener('click', closeModal);

  document.getElementById('settingsModal')?.addEventListener('click', closeApiSettings);
  document.querySelector('.settings-panel')?.addEventListener('click', (e) => e.stopPropagation());
  document.getElementById('settingsCloseBtn')?.addEventListener('click', closeApiSettings);

  // Settings
  document.getElementById('toggleApiKeyBtn')?.addEventListener('click', toggleApiKeyVisibility);
  document.getElementById('testApiBtn')?.addEventListener('click', testApiConnection);
  document.getElementById('saveApiBtn')?.addEventListener('click', saveApiSettings);
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  const step1Next = document.getElementById('btnStep1Next');
  if (step1Next) step1Next.disabled = true;
  const step2Next = document.getElementById('btnStep2Next');
  if (step2Next) step2Next.disabled = true;
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
