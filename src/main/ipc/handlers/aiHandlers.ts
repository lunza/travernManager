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
  streaming?: boolean;
}) => {
  try {
    const { url, method, headers, body, timeout, streaming = false } = requestConfig;
    
    logToFile(`收到AI请求: ${method} ${url}`);
    logToFile(`请求头: ${JSON.stringify(headers)}`);
    logToFile(`请求体: ${JSON.stringify(body)}`);
    logToFile(`超时设置: ${timeout ? `${timeout}ms` : '无超时'}`);
    logToFile(`流式响应: ${streaming}`);
    
    // 如果启用流式响应
    if (streaming) {
      // 使用 Node.js 的 fetch (Electron 支持)
      let controller: AbortController | undefined;
      let timeoutId: NodeJS.Timeout | undefined;
      
      if (timeout) {
        controller = new AbortController();
        timeoutId = setTimeout(() => controller?.abort(), timeout);
      }
      
      logToFile(`正在发送流式请求到 ${url}...`);
      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({ ...body, stream: true }),
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
      
      // 处理流式响应
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }
      
      let accumulatedData = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        
        // 解码响应数据
        const chunk = new TextDecoder().decode(value);
        accumulatedData += chunk;
        
        // 发送流式数据到渲染进程
        event.sender.send('ai:stream', {
          chunk,
          accumulatedData
        });
      }
      
      logToFile(`流式响应完成，返回数据长度: ${accumulatedData.length} 字符`);
      
      // 解析最终数据
      let data;
      try {
        // 处理SSE格式
        if (accumulatedData.startsWith('data: ')) {
          const lines = accumulatedData.split('\n');
          const jsonLines = lines.filter(line => line.startsWith('data: ')).map(line => line.substring(6));
          const lastLine = jsonLines[jsonLines.length - 1];
          if (lastLine && lastLine !== '[DONE]') {
            data = JSON.parse(lastLine);
          }
        } else {
          // 处理普通JSON格式
          data = JSON.parse(accumulatedData);
        }
      } catch (e) {
        logToFile(`解析响应数据失败: ${e instanceof Error ? e.message : '未知错误'}`);
        data = null;
      }
      
      // 发送流式响应完成信号
      event.sender.send('ai:stream:complete', { data });
      
      return {
        success: true,
        data
      };
    } else {
      // 普通响应
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
    }
  } catch (error) {
    logToFile(`请求异常: ${error instanceof Error ? error.message : '未知错误'}`);
    logToFile(`异常详情: ${String(error)}`);
    
    // 检查是否为网络错误
    if (error instanceof Error) {
      if (error.message.includes('fetch failed')) {
        logToFile('网络错误: 无法连接到API服务器，请检查服务器是否运行或网络连接是否正常');
        return {
          success: false,
          error: '网络错误: 无法连接到API服务器',
          details: '请检查服务器是否运行或网络连接是否正常。如果使用本地服务器，请确保服务器已启动并监听在指定端口。'
        };
      }
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      details: String(error)
    };
  }
});

export default {};
