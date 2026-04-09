import { ipcMain } from 'electron';

/**
 * AI 请求处理器
 * 用于处理 AI 翻译、润色等请求，避免前端直接发送请求导致的 CORS 问题
 */

// 处理 AI 请求
ipcMain.handle('ai:request', async (event, requestConfig: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: any;
  timeout?: number;
}) => {
  try {
    const { url, method, headers, body, timeout = 30000 } = requestConfig;
    
    // 使用 Node.js 的 fetch (Electron 支持)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method,
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        details: errorText
      };
    }
    
    const data = await response.json();
    return {
      success: true,
      data
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      details: String(error)
    };
  }
});

export default {};
