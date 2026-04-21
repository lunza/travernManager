import { ipcMain } from 'electron';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

/**
 * AI 请求处理器
 * 用于处理 AI 翻译、润色等请求，避免前端直接发送请求导致的 CORS 问题
 */

// 简单日志函数
const logToFile = (message: string) => {
  try {
    const logDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logPath = path.join(logDir, 'ai-handler.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
  } catch (e) {
    // 忽略日志错误
  }
};

// 处理 AI 请求
ipcMain.handle('ai:request', async (event, requestConfig: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: any;
  timeout?: number;
}) => {
  try {
    const { url, method, headers, body, timeout } = requestConfig;
    
    logToFile(`收到AI请求: ${method} ${url}`);
    logToFile(`请求头: ${JSON.stringify(headers)}`);
    logToFile(`请求体: ${JSON.stringify(body)}`);
    logToFile(`超时设置: ${timeout ? `${timeout}ms` : '无超时'}`);
    
    // 使用 Node.js 的 fetch (Electron 支持)
    let controller: AbortController | undefined;
    let timeoutId: NodeJS.Timeout | undefined;
    
    if (timeout) {
      controller = new AbortController();
      timeoutId = setTimeout(() => controller?.abort(), timeout);
    }
    
    logToFile(`正在发送请求到 ${url}...`);
    const response = await fetch(url, {
      method,
      headers,
      body: JSON.stringify(body),
      signal: controller?.signal
    });
    
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    logToFile(`收到响应，状态码: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      logToFile(`响应失败: ${response.status} ${response.statusText}`);
      logToFile(`错误内容: ${errorText}`);
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        details: errorText
      };
    }
    
    const data = await response.json();
    logToFile(`响应成功，返回数据长度: ${JSON.stringify(data).length} 字符`);
    return {
      success: true,
      data
    };
  } catch (error) {
    logToFile(`请求异常: ${error instanceof Error ? error.message : '未知错误'}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      details: String(error)
    };
  }
});

export default {};
