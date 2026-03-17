/**
 * AI服务适配器接口定义
 * 支持可插拔的AI服务提供商
 */

/**
 * 图片分析结果
 */
export interface AnalyzeImageResult {
  productType: string;        // 产品类型（空气净化器、服装等）
  productName: string;         // 产品名称
  imageType: string;           // 图片类型（实物图、白底图等）
  angles: string[];            // 拍摄角度列表
  suggestions: string[];       // AI建议
  features?: string[];         // 产品特征
}

/**
 * 文案生成结果
 */
export interface GenerateCopyResult {
  mainTitle: string;           // 主标题
  subTitle: string;            // 副标题
  sellingPoints: string[];     // 核心卖点列表
  description: string;         // 产品描述
  keywords: string[];          // 关键词
}

/**
 * 图片生成结果
 */
export interface GenerateImageResult {
  url: string;                 // 生成的图片URL
  width?: number;              // 图片宽度
  height?: number;             // 图片高度
}

/**
 * 抠图结果
 */
export interface RemoveBackgroundResult {
  url: string;                 // 抠图后的图片URL（透明背景或白底）
  originalUrl: string;         // 原图URL
}

/**
 * AI服务适配器接口
 * 所有AI服务提供商都需要实现这个接口
 */
export interface AIServiceAdapter {
  /**
   * 分析产品图片
   * @param imageUrl 图片URL
   * @returns 分析结果
   */
  analyzeImage(imageUrl: string): Promise<AnalyzeImageResult>;

  /**
   * 生成产品文案
   * @param params 文案生成参数
   * @returns 文案结果
   */
  generateCopy(params: {
    productType: string;
    productName: string;
    platform: string;          // 电商平台（淘宝、京东等）
    features?: string[];       // 产品特征
    targetAudience?: string;   // 目标受众
  }): Promise<GenerateCopyResult>;

  /**
   * 生成电商主图
   * @param params 图片生成参数
   * @returns 生成的图片URL
   */
  generateImage(params: {
    productImageUrl: string;   // 产品图片URL
    prompt: string;            // 生成提示词
    style?: string;            // 风格（简约、温馨、科技等）
    platform?: string;         // 电商平台
  }): Promise<GenerateImageResult>;

  /**
   * 抠图/去背景
   * @param imageUrl 原图URL
   * @param options 抠图选项
   * @returns 抠图结果
   */
  removeBackground(
    imageUrl: string,
    options?: {
      backgroundColor?: string; // 背景色（默认透明）
      format?: 'png' | 'jpg';  // 输出格式
    }
  ): Promise<RemoveBackgroundResult>;
}

/**
 * AI服务提供商类型
 */
export type AIProvider = 'manus' | 'openai' | 'custom';

/**
 * AI服务配置
 */
export interface AIServiceConfig {
  provider: AIProvider;
  apiKey?: string;
  baseUrl?: string;
  // 支持混合使用不同提供商
  imageAnalysis?: AIProvider;
  copyGeneration?: AIProvider;
  imageGeneration?: AIProvider;
  backgroundRemoval?: AIProvider;
}
