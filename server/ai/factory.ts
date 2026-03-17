/**
 * AI服务适配器工厂
 * 根据配置创建对应的AI服务适配器实例
 */

import type { AIServiceAdapter, AIServiceConfig, AIProvider } from './types';
import { ManusAdapter } from './adapters/manus';

/**
 * 获取AI服务配置
 * 从环境变量读取配置，支持混合使用不同提供商
 */
export function getAIServiceConfig(): AIServiceConfig {
  const provider = (process.env.AI_PROVIDER || 'manus') as AIProvider;
  
  return {
    provider,
    // 支持为不同功能指定不同的提供商
    imageAnalysis: (process.env.AI_IMAGE_ANALYSIS_PROVIDER || provider) as AIProvider,
    copyGeneration: (process.env.AI_COPY_GENERATION_PROVIDER || provider) as AIProvider,
    imageGeneration: (process.env.AI_IMAGE_GENERATION_PROVIDER || provider) as AIProvider,
    backgroundRemoval: (process.env.AI_BACKGROUND_REMOVAL_PROVIDER || provider) as AIProvider,
  };
}

/**
 * 创建AI服务适配器实例
 * @param provider 提供商类型
 * @returns AI服务适配器实例
 */
export function createAIAdapter(provider: AIProvider = 'manus'): AIServiceAdapter {
  switch (provider) {
    case 'manus':
      return new ManusAdapter();
    
    case 'openai':
      // TODO: 实现OpenAI适配器
      throw new Error('OpenAI adapter not implemented yet');
    
    case 'custom':
      // TODO: 支持自定义适配器
      throw new Error('Custom adapter not implemented yet');
    
    default:
      console.warn(`Unknown AI provider: ${provider}, falling back to Manus`);
      return new ManusAdapter();
  }
}

/**
 * 获取默认AI服务适配器
 * 使用环境变量配置的默认提供商
 */
export function getDefaultAIAdapter(): AIServiceAdapter {
  const config = getAIServiceConfig();
  return createAIAdapter(config.provider);
}

/**
 * 获取特定功能的AI适配器
 * 支持为不同功能使用不同的提供商
 */
export function getAIAdapterForFeature(feature: keyof Pick<
  AIServiceConfig,
  'imageAnalysis' | 'copyGeneration' | 'imageGeneration' | 'backgroundRemoval'
>): AIServiceAdapter {
  const config = getAIServiceConfig();
  const provider = config[feature] || config.provider;
  return createAIAdapter(provider);
}
