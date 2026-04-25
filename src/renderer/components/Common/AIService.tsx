// AI 服务组件

import React, { useState, useCallback, useMemo } from 'react';
import { openai as createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { AIRequestOptions, AIResult, AIError, AIRequestStatus, AIServiceConfig, AIStreamOptions } from './AIService.types';
import { AIErrorHandler, AIUtils, AIConfigValidator } from './AIService.utils';

// AI 服务组件
export class AIService {
  private config: AIServiceConfig;
  private abortControllers: Map<string, AbortController> = new Map();

  constructor(config: AIServiceConfig) {
    // 确保配置安全，如果无效则使用默认值修复
    const safeConfig = this.ensureSafeConfig(config);
    this.config = safeConfig;
  }

  // 确保配置是安全的，添加缺失的默认值
  private ensureSafeConfig(config: AIServiceConfig): AIServiceConfig {
    const defaultConfig = AIConfigValidator.createDefaultConfig();
    return {
      defaultModel: config.defaultModel || defaultConfig.defaultModel,
      defaultBaseUrl: config.defaultBaseUrl,
      defaultApiKey: config.defaultApiKey,
      defaultTemperature: config.defaultTemperature ?? defaultConfig.defaultTemperature,
      defaultMaxTokens: config.defaultMaxTokens ?? defaultConfig.defaultMaxTokens,
      retryAttempts: config.retryAttempts ?? defaultConfig.retryAttempts,
      retryDelay: config.retryDelay ?? defaultConfig.retryDelay,
      timeout: config.timeout ?? defaultConfig.timeout,
      systemPrompt: config.systemPrompt,
    };
  }

  // ==========================================
  // 公共方法 - 配置管理
  // ==========================================

  getConfig(): AIServiceConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<AIServiceConfig>): void {
    const newConfig = { ...this.config, ...config };
    const validation = AIConfigValidator.validateConfig(newConfig);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    this.config = newConfig;
  }

  cancelRequest(requestId: string): void {
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(requestId);
    }
  }

  cancelAllRequests(): void {
    for (const [, controller] of this.abortControllers) {
      controller.abort();
    }
    this.abortControllers.clear();
  }

  // ==========================================
  // 私有辅助方法
  // ==========================================

  private createRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private buildRequestBody(options: AIRequestOptions, stream: boolean = false): Record<string, any> {
    const body: Record<string, any> = {
      model: options.model,
      messages: options.messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens
    };

    if (stream) {
      body.stream = true;
    }

    return body;
  }

  private buildHeaders(options: AIRequestOptions): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (options.apiKey) {
      headers['Authorization'] = `Bearer ${options.apiKey}`;
    }

    return headers;
  }

  private async sendRequestWithRetry<T>(
    requestFn: () => Promise<T>,
    retryAttempts: number = 3,
    retryDelay: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt < retryAttempts; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        
        // 只对网络错误和5xx错误进行重试
        const isRetryable = error.name === 'TypeError' || 
                            (error.status && error.status >= 500);
        
        if (!isRetryable || attempt === retryAttempts - 1) {
          throw error;
        }
        
        await AIUtils.delay(retryDelay * (attempt + 1));
      }
    }

    throw lastError;
  }

  private async processStreamResponse(
    response: Response,
    streamOptions: AIStreamOptions
  ): Promise<void> {
    if (!response.body) {
      throw new Error('无法获取响应流');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullContent = '';
    let finishReason: string | undefined;
    let usage: any;
    let id: string | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          
          const data = line.substring(6);
          if (data === '[DONE]') continue;

          try {
            const chunkData = JSON.parse(data);
            
            if (chunkData.choices?.[0]) {
              const choice = chunkData.choices[0];
              const content = choice.delta?.content || '';
              
              if (content) {
                fullContent += content;
                streamOptions.onStream(content, false);
              }
              
              if (choice.finish_reason) {
                finishReason = choice.finish_reason;
              }
              
              if (chunkData.id) {
                id = chunkData.id;
              }
            }
            
            if (chunkData.usage) {
              usage = chunkData.usage;
            }
          } catch (parseError) {
            console.debug('流式响应片段解析失败:', parseError);
            // 继续处理下一行，不中断整个请求
          }
        }
      }

      if (streamOptions.onComplete) {
        const responseData = {
          content: fullContent,
          finishReason: finishReason || 'unknown',
          usage,
          id: id || ''
        };
        streamOptions.onComplete(responseData);
      }

      streamOptions.onStream('', true);
    } finally {
      reader.releaseLock();
    }
  }

  // ==========================================
  // 原生实现方法（当前使用）
  // ==========================================

  async sendChatRequest(options: AIRequestOptions): Promise<AIResult> {
    const startTime = Date.now();
    
    try {
      const validation = AIUtils.validateRequestOptions(options);
      if (!validation.valid) {
        return {
          error: validation.error,
          status: 'error',
          responseTime: AIUtils.calculateResponseTime(startTime)
        };
      }

      const formattedOptions = AIUtils.formatRequestOptions(options, this.config);
      const requestId = this.createRequestId();
      const abortController = new AbortController();
      this.abortControllers.set(requestId, abortController);

      const timeout = (this.config as any).timeout || 60000;
      const timeoutId = setTimeout(() => abortController.abort(), timeout);

      try {
        const result = await this.sendRequestWithRetry(async () => {
          const response = await fetch(`${formattedOptions.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: this.buildHeaders(formattedOptions),
            body: JSON.stringify(this.buildRequestBody(formattedOptions, false)),
            signal: abortController.signal
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          return response.json();
        }, this.config.retryAttempts || 3, this.config.retryDelay || 1000);

        const responseData = {
          content: result.choices?.[0]?.message?.content || '',
          finishReason: result.choices?.[0]?.finish_reason || 'unknown',
          usage: result.usage,
          id: result.id
        };

        return {
          response: responseData,
          status: 'success',
          responseTime: AIUtils.calculateResponseTime(startTime)
        };
      } finally {
        clearTimeout(timeoutId);
        this.abortControllers.delete(requestId);
      }
    } catch (error) {
      return {
        error: AIErrorHandler.fromError(error),
        status: 'error',
        responseTime: AIUtils.calculateResponseTime(startTime)
      };
    }
  }

  async sendStreamChatRequest(options: AIRequestOptions, streamOptions: AIStreamOptions): Promise<void> {
    try {
      const validation = AIUtils.validateRequestOptions(options);
      if (!validation.valid) {
        if (streamOptions.onError) {
          streamOptions.onError(validation.error!);
        }
        return;
      }

      const formattedOptions = AIUtils.formatRequestOptions(options, this.config);
      const requestId = this.createRequestId();
      const abortController = new AbortController();
      this.abortControllers.set(requestId, abortController);

      const timeout = (this.config as any).timeout || 60000;
      const timeoutId = setTimeout(() => abortController.abort(), timeout);

      const requestBody = this.buildRequestBody(formattedOptions, true);
      const requestHeaders = this.buildHeaders(formattedOptions);
      
      try {
        const url = `${formattedOptions.baseUrl}/v1/chat/completions`;
        const response = await fetch(url, {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify(requestBody),
          signal: abortController.signal
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        await this.processStreamResponse(response, streamOptions);
      } finally {
        clearTimeout(timeoutId);
        this.abortControllers.delete(requestId);
      }
    } catch (error) {
      const aiError = AIErrorHandler.fromError(error);
      if (streamOptions.onError) {
        streamOptions.onError(aiError);
      }
    }
  }

  async sendCompletionRequest(options: AIRequestOptions): Promise<AIResult> {
    return this.sendChatRequest(options);
  }

  async sendStreamCompletionRequest(options: AIRequestOptions, streamOptions: AIStreamOptions): Promise<void> {
    return this.sendStreamChatRequest(options, streamOptions);
  }

  // ==========================================
  // Vercel AI SDK 方法（完整实现）
  // ==========================================

  async sendChatRequestVercel(options: AIRequestOptions): Promise<AIResult> {
    const startTime = Date.now();
    
    try {
      const validation = AIUtils.validateRequestOptions(options);
      if (!validation.valid) {
        return {
          error: validation.error,
          status: 'error',
          responseTime: AIUtils.calculateResponseTime(startTime)
        };
      }

      const formattedOptions = AIUtils.formatRequestOptions(options, this.config);
      const requestId = this.createRequestId();
      const abortController = new AbortController();
      this.abortControllers.set(requestId, abortController);

      try {
        const openaiClient = createOpenAI({
          baseURL: formattedOptions.baseUrl,
          apiKey: formattedOptions.apiKey
        });

        const result = await this.sendRequestWithRetry(async () => {
          return await streamText({
            model: openaiClient(formattedOptions.model),
            messages: formattedOptions.messages,
            temperature: formattedOptions.temperature,
            maxTokens: formattedOptions.max_tokens,
            abortSignal: abortController.signal
          });
        }, this.config.retryAttempts || 3, this.config.retryDelay || 1000);

        const text = await result.text;
        const usage = await result.usage;

        const responseData = {
          content: text,
          finishReason: 'stop',
          usage: usage ? {
            promptTokens: usage.promptTokens || 0,
            completionTokens: usage.completionTokens || 0,
            totalTokens: usage.totalTokens || 0
          } : undefined,
          id: ''
        };

        return {
          response: responseData,
          status: 'success',
          responseTime: AIUtils.calculateResponseTime(startTime)
        };
      } finally {
        this.abortControllers.delete(requestId);
      }
    } catch (error) {
      return {
        error: AIErrorHandler.fromError(error),
        status: 'error',
        responseTime: AIUtils.calculateResponseTime(startTime)
      };
    }
  }

  async sendStreamChatRequestVercel(options: AIRequestOptions, streamOptions: AIStreamOptions): Promise<void> {
    try {
      const validation = AIUtils.validateRequestOptions(options);
      if (!validation.valid) {
        if (streamOptions.onError) {
          streamOptions.onError(validation.error!);
        }
        return;
      }

      const formattedOptions = AIUtils.formatRequestOptions(options, this.config);
      const requestId = this.createRequestId();
      const abortController = new AbortController();
      this.abortControllers.set(requestId, abortController);

      try {
        const openaiClient = createOpenAI({
          baseURL: formattedOptions.baseUrl,
          apiKey: formattedOptions.apiKey
        });

        const result = await streamText({
          model: openaiClient(formattedOptions.model),
          messages: formattedOptions.messages,
          temperature: formattedOptions.temperature,
          maxTokens: formattedOptions.max_tokens,
          abortSignal: abortController.signal
        });

        let fullContent = '';
        for await (const part of result.fullStream) {
          if (part.type === 'text-delta') {
            fullContent += part.textDelta;
            streamOptions.onStream(part.textDelta, false);
          }
        }

        const usage = await result.usage;

        if (streamOptions.onComplete) {
          const responseData = {
            content: fullContent,
            finishReason: 'stop',
            usage: usage ? {
              promptTokens: usage.promptTokens || 0,
              completionTokens: usage.completionTokens || 0,
              totalTokens: usage.totalTokens || 0
            } : undefined,
            id: ''
          };
          streamOptions.onComplete(responseData);
        }

        streamOptions.onStream('', true);
      } finally {
        this.abortControllers.delete(requestId);
      }
    } catch (error) {
      const aiError = AIErrorHandler.fromError(error);
      if (streamOptions.onError) {
        streamOptions.onError(aiError);
      }
    }
  }
}

// 自定义 Hook：使用 AI 服务
export function useAIService(config: AIServiceConfig) {
  const [status, setStatus] = useState<AIRequestStatus>('idle');
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<AIError | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);

  const aiService = useMemo(() => {
    return new AIService(config);
  }, [config]);

  const createRequestHandler = useCallback((
    requestFn: (options: AIRequestOptions) => Promise<AIResult>
  ) => {
    return async (options: AIRequestOptions) => {
      setStatus('loading');
      setError(null);
      setResponse(null);
      setResponseTime(null);

      const result = await requestFn(options);
      setStatus(result.status);
      setResponse(result.response);
      setError(result.error || null);
      setResponseTime(result.responseTime || null);

      return result;
    };
  }, []);

  const createStreamHandler = useCallback((
    streamFn: (options: AIRequestOptions, streamOptions: AIStreamOptions) => Promise<void>
  ) => {
    return async (options: AIRequestOptions, streamOptions: AIStreamOptions) => {
      setStatus('loading');
      setError(null);

      await streamFn(options, {
        ...streamOptions,
        onError: (err) => {
          setStatus('error');
          setError(err);
          if (streamOptions.onError) {
            streamOptions.onError(err);
          }
        },
        onComplete: (res) => {
          setStatus('success');
          setResponse(res);
          if (streamOptions.onComplete) {
            streamOptions.onComplete(res);
          }
        }
      });
    };
  }, []);

  const sendChatRequest = useMemo(() => 
    createRequestHandler(aiService.sendChatRequest.bind(aiService)),
    [createRequestHandler, aiService]
  );

  const sendStreamChatRequest = useMemo(() => 
    createStreamHandler(aiService.sendStreamChatRequest.bind(aiService)),
    [createStreamHandler, aiService]
  );

  const sendCompletionRequest = useMemo(() => 
    createRequestHandler(aiService.sendCompletionRequest.bind(aiService)),
    [createRequestHandler, aiService]
  );

  const sendStreamCompletionRequest = useMemo(() => 
    createStreamHandler(aiService.sendStreamCompletionRequest.bind(aiService)),
    [createStreamHandler, aiService]
  );

  const sendChatRequestVercel = useMemo(() => 
    createRequestHandler(aiService.sendChatRequestVercel.bind(aiService)),
    [createRequestHandler, aiService]
  );

  const sendStreamChatRequestVercel = useMemo(() => 
    createStreamHandler(aiService.sendStreamChatRequestVercel.bind(aiService)),
    [createStreamHandler, aiService]
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setResponse(null);
    setError(null);
    setResponseTime(null);
  }, []);

  return {
    aiService,
    status,
    response,
    error,
    responseTime,
    sendChatRequest,
    sendStreamChatRequest,
    sendCompletionRequest,
    sendStreamCompletionRequest,
    sendChatRequestVercel,
    sendStreamChatRequestVercel,
    reset
  };
}

export const defaultAIServiceConfig = AIConfigValidator.createDefaultConfig();
export const defaultAIService = new AIService(defaultAIServiceConfig);
export { AIConfigValidator, AIErrorHandler, AIUtils } from './AIService.utils';
