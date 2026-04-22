import { AIEngineConfig } from '../types/config';

/**
 * 构建完整的API URL
 * @param apiUrl 基础API URL
 * @param apiMode API模式
 * @returns 完整的API URL
 */
export const buildApiUrl = (apiUrl: string, apiMode: string = 'chat_completion'): string => {
  let fullUrl;

  if (apiMode === 'chat_completion') {
    if (apiUrl.endsWith('/v1/chat/completions')) {
      fullUrl = apiUrl;
    } else {
      const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
      fullUrl = baseUrl + 'v1/chat/completions';
    }
  } else {
    if (apiUrl.endsWith('/v1/completions')) {
      fullUrl = apiUrl;
    } else {
      const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
      fullUrl = baseUrl + 'v1/completions';
    }
  }

  return fullUrl;
};

/**
 * 从AI引擎配置构建完整的API URL
 * @param engine AI引擎配置
 * @returns 完整的API URL
 */
export const buildEngineApiUrl = (engine: AIEngineConfig): string => {
  return buildApiUrl(engine.api_url, engine.api_mode);
};
