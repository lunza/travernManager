import { ipcMain } from 'electron';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

/**
 * AI 请求处理器
 * 用于处理 AI 翻译、润色等请求，避免前端直接发送请求导致的 CORS 问题
 */

// 日志配置
const LOG_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_FILES: 5,
  LOG_DIR: 'logs',
  LOG_FILE: 'ai-handler.log'
};

// 日志级别
const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

// 获取日志目录路径
const getLogDir = (): string => {
  return path.join(process.cwd(), LOG_CONFIG.LOG_DIR);
};

// 获取日志文件路径
const getLogPath = (): string => {
  return path.join(getLogDir(), LOG_CONFIG.LOG_FILE);
};

// 检查并执行日志文件轮转
const rotateLogFile = () => {
  try {
    const logPath = getLogPath();
    if (!fs.existsSync(logPath)) {
      return;
    }

    const stats = fs.statSync(logPath);
    if (stats.size >= LOG_CONFIG.MAX_FILE_SIZE) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedPath = path.join(getLogDir(), `ai-handler-${timestamp}.log`);

      fs.renameSync(logPath, rotatedPath);

      const existingLogs = fs.readdirSync(getLogDir())
        .filter(file => file.startsWith('ai-handler-') && file.endsWith('.log'))
        .sort()
        .reverse();

      while (existingLogs.length >= LOG_CONFIG.MAX_FILES) {
        const oldestLog = existingLogs.pop();
        if (oldestLog) {
          fs.unlinkSync(path.join(getLogDir(), oldestLog));
        }
      }
    }
  } catch (e) {
    console.error('Failed to rotate log file:', e);
  }
};

// 简单日志函数
const logToFile = (level: string, message: string, details?: string) => {
  try {
    const logDir = getLogDir();
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    rotateLogFile();

    const logPath = getLogPath();
    const timestamp = new Date().toISOString();
    const displayTime = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const levelPrefix = `[${level.padEnd(5)}]`;
    const timePrefix = `[${displayTime}]`;
    let logMessage = `${timePrefix} ${levelPrefix} ${message}`;

    if (details) {
      logMessage += `\n${' '.repeat(20)}${details.split('\n').join('\n' + ' '.repeat(20))}`;
    }

    fs.appendFileSync(logPath, logMessage + '\n\n');
  } catch (e) {
    console.error('Failed to write to log file:', e);
  }
};

// 详细日志函数
const logDetailed = (level: string, title: string, data: any) => {
  try {
    const details = JSON.stringify(data, null, 2);
    logToFile(level, `${title}`, details);
  } catch (e) {
    logToFile(level, `${title}: ${String(data)}`);
  }
};

// 错误日志
const logError = (message: string, error?: Error, context?: any) => {
  const errorDetails = error ? `Error: ${error.message}\nStack: ${error.stack || 'No stack'}` : '';
  const contextDetails = context ? `Context: ${JSON.stringify(context, null, 2)}` : '';
  const details = [errorDetails, contextDetails].filter(Boolean).join('\n');
  logToFile(LOG_LEVELS.ERROR, message, details);
  console.error(`[AI Handler] ${message}`, error, context);
};

// 警告日志
const logWarn = (message: string, context?: any) => {
  const contextDetails = context ? `Context: ${JSON.stringify(context, null, 2)}` : '';
  logToFile(LOG_LEVELS.WARN, message, contextDetails);
  console.warn(`[AI Handler] ${message}`, context);
};

// 信息日志
const logInfo = (message: string, context?: any) => {
  const contextDetails = context ? `Context: ${JSON.stringify(context, null, 2)}` : '';
  logToFile(LOG_LEVELS.INFO, message, contextDetails);
  console.info(`[AI Handler] ${message}`, context);
};

// 调试日志
const logDebug = (message: string, context?: any) => {
  const contextDetails = context ? `Context: ${JSON.stringify(context, null, 2)}` : '';
  logToFile(LOG_LEVELS.DEBUG, message, contextDetails);
  console.debug(`[AI Handler] ${message}`, context);
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
  // 记录开始时间
  const startTime = new Date();
  const startTimeStr = startTime.toISOString();
  
  try {
    const { url, method, headers, body, timeout, streaming = false } = requestConfig;
    
    // 脱敏处理请求头
    const sanitizedHeaders = { ...headers };
    if (sanitizedHeaders['Authorization']) {
      sanitizedHeaders['Authorization'] = 'Bearer [REDACTED]';
    }
    
    // 脱敏处理请求体
    const sanitizedBody = { ...body };
    if (sanitizedBody.api_key) {
      sanitizedBody.api_key = '[REDACTED]';
    }
    
    logInfo(`收到AI请求: ${method} ${url}`, {
      timestamp: startTimeStr,
      method: method,
      url: url,
      timeout: timeout,
      streaming: streaming
    });
    logDebug('请求头', sanitizedHeaders);
    logDebug('请求体', sanitizedBody);
    
    // 输入验证
    if (!url || typeof url !== 'string') {
      const errorMsg = '无效的API URL';
      logError(errorMsg, undefined, {
        errorType: 'ValidationError',
        errorLocation: 'aiHandlers.ts:186:handleRequest',
        timestamp: startTimeStr,
        url: url,
        method: method
      });
      return {
        success: false,
        error: errorMsg,
        details: 'API URL不能为空且必须是字符串格式'
      };
    }
    
    if (!method || !['GET', 'POST', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
      const errorMsg = '无效的HTTP方法';
      logError(errorMsg, undefined, {
        errorType: 'ValidationError',
        errorLocation: 'aiHandlers.ts:200:handleRequest',
        timestamp: startTimeStr,
        method: method,
        url: url
      });
      return {
        success: false,
        error: errorMsg,
        details: 'HTTP方法必须是GET、POST、PUT或DELETE'
      };
    }
    
    // 如果启用流式响应
    if (streaming) {
      // 使用 Node.js 的 fetch (Electron 支持)
      let controller: AbortController | undefined;
      let timeoutId: NodeJS.Timeout | undefined;
      
      if (timeout) {
        controller = new AbortController();
        timeoutId = setTimeout(() => controller?.abort(), timeout);
      }
      
      logInfo(`正在发送流式请求到 ${url}...`, {
        timestamp: startTimeStr,
        url: url,
        method: method
      });
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: JSON.stringify({ ...body, stream: true }),
          signal: controller?.signal
        });
        
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        // 记录响应时间
        const endTime = new Date();
        const endTimeStr = endTime.toISOString();
        const responseTime = endTime.getTime() - startTime.getTime();
        
        logInfo(`收到响应，状态码: ${response.status}`, {
          timestamp: endTimeStr,
          status: response.status,
          statusText: response.statusText,
          url: url,
          response_time_ms: responseTime
        });
        
        if (!response.ok) {
          try {
            const errorText = await response.text();
            logError(`响应失败: ${response.status} ${response.statusText}`, undefined, {
              errorType: 'NetworkError',
              errorLocation: 'aiHandlers.ts:256:handleRequest',
              timestamp: endTimeStr,
              status: response.status,
              statusText: response.statusText,
              url: url,
              method: method,
              response_time_ms: responseTime,
              errorText: errorText
            });
            
            // 尝试解析错误响应
            let errorDetails = errorText;
            try {
              const errorJson = JSON.parse(errorText);
              errorDetails = JSON.stringify(errorJson, null, 2);
            } catch (e) {
              // 非JSON错误响应，使用原始文本
            }
            
            return {
              success: false,
              error: `HTTP ${response.status}: ${response.statusText}`,
              details: errorDetails,
              statusCode: response.status,
              statusText: response.statusText
            };
          } catch (textError) {
            logError(`读取错误响应失败: ${textError instanceof Error ? textError.message : '未知错误'}`, textError, {
              timestamp: new Date().toISOString(),
              status: response.status,
              url: url,
              response_time_ms: responseTime
            });
            return {
              success: false,
              error: `HTTP ${response.status}: ${response.statusText}`,
              details: '无法读取错误响应内容',
              statusCode: response.status,
              statusText: response.statusText
            };
          }
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
        
        // 记录响应完成时间
        const completeTime = new Date();
        const completeTimeStr = completeTime.toISOString();
        const totalTime = completeTime.getTime() - startTime.getTime();
        
        logInfo(`流式响应完成，返回数据长度: ${accumulatedData.length} 字符`, {
          timestamp: completeTimeStr,
          length: accumulatedData.length,
          total_time_ms: totalTime
        });
        
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
          logError(`解析响应数据失败: ${e instanceof Error ? e.message : '未知错误'}`, e as Error, {
            timestamp: completeTimeStr,
            rawData: accumulatedData.substring(0, 500) + '...' // 只记录前500个字符
          });
          data = null;
        }
        
        // 发送流式响应完成信号
        event.sender.send('ai:stream:complete', { data });
        
        return {
          success: true,
          data
        };
      } catch (fetchError) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        throw fetchError;
      }
    } else {
      // 普通响应
      // 使用 Node.js 的 fetch (Electron 支持)
      let controller: AbortController | undefined;
      let timeoutId: NodeJS.Timeout | undefined;
      
      if (timeout) {
        controller = new AbortController();
        timeoutId = setTimeout(() => controller?.abort(), timeout);
      }
      
      logInfo(`正在发送请求到 ${url}...`, {
        timestamp: startTimeStr,
        url: url,
        method: method
      });
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: JSON.stringify(body),
          signal: controller?.signal
        });
        
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        // 记录响应时间
        const endTime = new Date();
        const endTimeStr = endTime.toISOString();
        const responseTime = endTime.getTime() - startTime.getTime();
        
        logInfo(`收到响应，状态码: ${response.status}`, {
          timestamp: endTimeStr,
          status: response.status,
          statusText: response.statusText,
          url: url,
          response_time_ms: responseTime
        });
        
        if (!response.ok) {
          try {
            const errorText = await response.text();
            logError(`响应失败: ${response.status} ${response.statusText}`, undefined, {
              errorType: 'NetworkError',
              errorLocation: 'aiHandlers.ts:414:handleRequest',
              timestamp: endTimeStr,
              status: response.status,
              statusText: response.statusText,
              url: url,
              method: method,
              response_time_ms: responseTime,
              errorText: errorText
            });
            
            // 尝试解析错误响应
            let errorDetails = errorText;
            try {
              const errorJson = JSON.parse(errorText);
              errorDetails = JSON.stringify(errorJson, null, 2);
            } catch (e) {
              // 非JSON错误响应，使用原始文本
            }
            
            return {
              success: false,
              error: `HTTP ${response.status}: ${response.statusText}`,
              details: errorDetails,
              statusCode: response.status,
              statusText: response.statusText
            };
          } catch (textError) {
            logError(`读取错误响应失败: ${textError instanceof Error ? textError.message : '未知错误'}`, textError, {
              timestamp: new Date().toISOString(),
              status: response.status,
              url: url,
              response_time_ms: responseTime
            });
            return {
              success: false,
              error: `HTTP ${response.status}: ${response.statusText}`,
              details: '无法读取错误响应内容',
              statusCode: response.status,
              statusText: response.statusText
            };
          }
        }
        
        try {
          const data = await response.json();
          logInfo(`响应成功，返回数据长度: ${JSON.stringify(data).length} 字符`, {
            timestamp: new Date().toISOString(),
            length: JSON.stringify(data).length,
            response_time_ms: responseTime
          });
          return {
            success: true,
            data
          };
        } catch (jsonError) {
          logError(`解析JSON响应失败: ${jsonError instanceof Error ? jsonError.message : '未知错误'}`, jsonError, {
            errorType: 'SyntaxError',
            errorLocation: 'aiHandlers.ts:468:handleRequest',
            timestamp: new Date().toISOString(),
            url: url,
            method: method,
            response_time_ms: responseTime
          });
          return {
            success: false,
            error: '解析响应失败',
            details: `无法解析API响应为JSON: ${jsonError instanceof Error ? jsonError.message : '未知错误'}`
          };
        }
      } catch (fetchError) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        throw fetchError;
      }
    }
  } catch (error) {
    // 记录异常时间
    const endTime = new Date();
    const endTimeStr = endTime.toISOString();
    const responseTime = endTime.getTime() - startTime.getTime();
    
    logError(`请求异常: ${error instanceof Error ? error.message : '未知错误'}`, error instanceof Error ? error : undefined, {
      errorType: error instanceof Error ? error.name : 'UnknownError',
      errorLocation: 'aiHandlers.ts:492:handleRequest',
      timestamp: endTimeStr,
      response_time_ms: responseTime,
      requestConfig: {
        url: requestConfig.url,
        method: requestConfig.method,
        timeout: requestConfig.timeout,
        streaming: requestConfig.streaming
      }
    });
    
    // 检查是否为网络错误
    if (error instanceof Error) {
      if (error.message.includes('fetch failed')) {
        logError('网络错误: 无法连接到API服务器', error, {
          errorType: 'NetworkError',
          errorLocation: 'aiHandlers.ts:506:handleRequest',
          timestamp: endTimeStr,
          url: requestConfig.url,
          method: requestConfig.method,
          response_time_ms: responseTime
        });
        return {
          success: false,
          error: '网络错误: 无法连接到API服务器',
          details: '请检查服务器是否运行或网络连接是否正常。如果使用本地服务器，请确保服务器已启动并监听在指定端口。',
          errorType: 'network'
        };
      } else if (error.message.includes('abort')) {
        logError('请求超时: API请求超过了设定的超时时间', error, {
          errorType: 'TimeoutError',
          errorLocation: 'aiHandlers.ts:519:handleRequest',
          timestamp: endTimeStr,
          url: requestConfig.url,
          method: requestConfig.method,
          timeout: requestConfig.timeout,
          response_time_ms: responseTime
        });
        return {
          success: false,
          error: '请求超时',
          details: 'API请求超过了设定的超时时间，请检查服务器响应速度或增加超时设置。',
          errorType: 'timeout'
        };
      } else if (error.message.includes('No response body')) {
        logError('响应错误: API服务器没有返回响应体', error, {
          errorType: 'ResponseError',
          errorLocation: 'aiHandlers.ts:532:handleRequest',
          timestamp: endTimeStr,
          url: requestConfig.url,
          method: requestConfig.method,
          response_time_ms: responseTime
        });
        return {
          success: false,
          error: '响应错误',
          details: 'API服务器没有返回响应体，请检查服务器配置。',
          errorType: 'response'
        };
      }
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      details: String(error),
      errorType: 'unknown'
    };
  }
});

export default {};
