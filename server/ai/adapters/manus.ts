/**
 * Manus AI服务适配器
 * 使用Manus内置的AI API（免费）
 */

import { invokeLLM } from "../../_core/llm";
import { generateImage } from "../../_core/imageGeneration";
import type {
  AIServiceAdapter,
  AnalyzeImageResult,
  GenerateCopyResult,
  GenerateImageResult,
  RemoveBackgroundResult,
} from "../types";

export class ManusAdapter implements AIServiceAdapter {
  /**
   * 分析产品图片
   * 使用LLM vision功能识别产品类型、角度等信息
   */
  async analyzeImage(imageUrl: string): Promise<AnalyzeImageResult> {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "你是一个专业的电商产品图片分析专家。分析图片中的产品，识别产品类型、拍摄角度，并给出优化建议。",
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "high",
              },
            },
            {
              type: "text",
              text: "请分析这张产品图片，识别产品类型、拍摄角度，并给出电商主图优化建议。",
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "product_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              productType: {
                type: "string",
                description: "产品类型，如：空气净化器、服装、电子产品等",
              },
              productName: {
                type: "string",
                description: "产品名称",
              },
              imageType: {
                type: "string",
                description: "图片类型，如：实物图、白底图、场景图等",
              },
              angles: {
                type: "array",
                items: { type: "string" },
                description: "拍摄角度列表，如：正面、侧面、45度、顶部等",
              },
              suggestions: {
                type: "array",
                items: { type: "string" },
                description: "优化建议列表",
              },
              features: {
                type: "array",
                items: { type: "string" },
                description: "产品特征列表",
              },
            },
            required: ["productType", "productName", "imageType", "angles", "suggestions"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    if (!content || typeof content !== 'string') {
      throw new Error("AI分析返回空结果");
    }

    return JSON.parse(content) as AnalyzeImageResult;
  }

  /**
   * 生成产品文案
   * 使用LLM生成电商主图文案和卖点
   */
  async generateCopy(params: {
    productType: string;
    productName: string;
    platform: string;
    features?: string[];
    targetAudience?: string;
  }): Promise<GenerateCopyResult> {
    const { productType, productName, platform, features, targetAudience } = params;

    const featuresText = features && features.length > 0 
      ? `产品特征：${features.join("、")}` 
      : "";
    
    const audienceText = targetAudience 
      ? `目标受众：${targetAudience}` 
      : "";

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `你是一个专业的电商文案撰写专家，擅长为${platform}平台撰写吸引人的产品主图文案。`,
        },
        {
          role: "user",
          content: `请为以下产品生成电商主图文案：
产品类型：${productType}
产品名称：${productName}
平台：${platform}
${featuresText}
${audienceText}

要求：
1. 主标题简洁有力，突出核心卖点
2. 提炼3-5个核心卖点，每个卖点简短精炼
3. 产品描述要吸引人，突出产品优势
4. 提供相关关键词用于SEO`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "product_copy",
          strict: true,
          schema: {
            type: "object",
            properties: {
              mainTitle: {
                type: "string",
                description: "主标题，10-20字",
              },
        
              sellingPoints: {
                type: "array",
                items: { type: "string" },
                description: "核心卖点列表，3-5个",
              },
              description: {
                type: "string",
                description: "产品描述，50-100字",
              },
              keywords: {
                type: "array",
                items: { type: "string" },
                description: "关键词列表，5-10个",
              },
            },
            required: ["mainTitle", "subTitle", "sellingPoints", "description", "keywords"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    if (!content || typeof content !== 'string') {
      throw new Error("文案生成返回空结果");
    }

    return JSON.parse(content) as GenerateCopyResult;
  }

  /**
   * 生成电商主图
   * 使用Manus图片生成API
   */
  async generateImage(params: {
    productImageUrl: string;
    prompt: string;
    style?: string;
    platform?: string;
  }): Promise<GenerateImageResult> {
    const { productImageUrl, prompt, style, platform } = params;

    // 构建完整的prompt
    let fullPrompt = prompt;
    if (style) {
      fullPrompt += `，风格：${style}`;
    }
    if (platform) {
      fullPrompt += `，适用于${platform}平台`;
    }
    fullPrompt += "，高质量电商主图，专业摄影，明亮清晰";

    const result = await generateImage({
      prompt: fullPrompt,
      originalImages: [
        {
          url: productImageUrl,
          mimeType: "image/jpeg",
        },
      ],
    });

    if (!result.url) {
      throw new Error("图片生成失败：未返回URL");
    }

    return {
      url: result.url,
    };
  }

  /**
   * 抠图/去背景
   * 使用图片生成API的编辑功能实现
   */
  async removeBackground(
    imageUrl: string,
    options?: {
      backgroundColor?: string;
      format?: "png" | "jpg";
    }
  ): Promise<RemoveBackgroundResult> {
    const backgroundColor = options?.backgroundColor || "white";
    
    // 使用图片编辑功能去除背景
    const result = await generateImage({
      prompt: `将产品从背景中分离出来，放置在纯${backgroundColor === "white" ? "白色" : backgroundColor}背景上，保持产品细节清晰`,
      originalImages: [
        {
          url: imageUrl,
          mimeType: "image/jpeg",
        },
      ],
    });

    if (!result.url) {
      throw new Error("抠图失败：未返回URL");
    }

    return {
      url: result.url,
      originalUrl: imageUrl,
    };
  }
}
