// AI 服务组件

import React, { useState, useCallback, useMemo } from 'react';
import { useChat, useCompletion } from '@ai-sdk/react';
import { openai } from '@ai-sdk/openai';
import { AIRequestOptions, AIResult, AIError, AIRequestStatus, AIServiceConfig, AIStreamOptions } from './AIService.types';
import { AIErrorHandler, AIUtils, AIConfigValidator } from './AIService.utils';

// AI 服务组件
export class AIService {
  private config: AIServiceConfig;

  constructor(config: AIServiceConfig) {
    const validation = AIConfigValidator.validateConfig(config);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    this.config = config;
  }

  // 发送聊天请求
  async sendChatRequest(options: AIRequestOptions): Promise<AIResult> {
    const startTime = Date.now();
    
    try {
      // 验证请求参数
      const validation = AIUtils.validateRequestOptions(options);
      if (!validation.valid) {
        return {
          error: validation.error,
          status: 'error',
          responseTime: AIUtils.calculateResponseTime(startTime)
        };
      }

      // 格式化请求参数
      const formattedOptions = AIUtils.formatRequestOptions(options, this.config);

      // 发送请求
      const result = await fetch(`${formattedOptions.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${formattedOptions.apiKey}`
        },
        body: JSON.stringify({
          model: formattedOptions.model,
          messages: formattedOptions.messages,
          temperature: formattedOptions.temperature,
          max_tokens: formattedOptions.max_tokens,
          ...formattedOptions
        })
      });

      if (!result.ok) {
        throw new Error(`HTTP ${result.status}: ${await result.text()}`);
      }

      const resultData = await result.json();

      // 处理响应
      const response = {
        content: resultData.choices[0].message.content || '',
        finishReason: resultData.choices[0].finish_reason || 'unknown',
        usage: resultData.usage,
        id: resultData.id
      };

      return {
        response,
        status: 'success',
        responseTime: AIUtils.calculateResponseTime(startTime)
      };
    } catch (error) {
      return {
        error: AIErrorHandler.fromError(error),
        status: 'error',
        responseTime: AIUtils.calculateResponseTime(startTime)
      };
    }
  }

  // 发送流式聊天请求
  async sendStreamChatRequest(options: AIRequestOptions, streamOptions: AIStreamOptions): Promise<void> {
    try {
      // 验证请求参数
      const validation = AIUtils.validateRequestOptions(options);
      if (!validation.valid) {
        if (streamOptions.onError) {
          streamOptions.onError(validation.error!);
        }
        return;
      }

      // 格式化请求参数
      const formattedOptions = AIUtils.formatRequestOptions(options, this.config);

      // 发送流式请求
      const response = await fetch(`${formattedOptions.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${formattedOptions.apiKey}`
        },
        body: JSON.stringify({
          model: formattedOptions.model,
          messages: formattedOptions.messages,
          temperature: formattedOptions.temperature,
          max_tokens: formattedOptions.max_tokens,
          stream: true,
          ...formattedOptions
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }

      let fullContent = '';
      let finishReason: string | undefined;
      let usage: any;
      let id: string | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder('utf-8').decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data === '[DONE]') {
              continue;
            }
            try {
              const chunkData = JSON.parse(data);
              if (chunkData.choices && chunkData.choices[0]) {
                const choice = chunkData.choices[0];
                const content = choice.delta?.content || '';
                fullContent += content;
                streamOptions.onStream(content, false);
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
            } catch (error) {
              console.error('解析流式响应失败:', error);
            }
          }
        }
      }

      // 完成回调
      if (streamOptions.onComplete) {
        const responseData = {
          content: fullContent,
          finishReason: finishReason || 'unknown',
          usage: usage,
          id: id || ''
        };
        streamOptions.onComplete(responseData);
      }

      // 发送结束标记
      streamOptions.onStream('', true);
    } catch (error) {
      const aiError = AIErrorHandler.fromError(error);
      if (streamOptions.onError) {
        streamOptions.onError(aiError);
      }
    }
  }

  // 发送补全请求
  async sendCompletionRequest(options: AIRequestOptions): Promise<AIResult> {
    const startTime = Date.now();
    
    try {
      // 验证请求参数
      const validation = AIUtils.validateRequestOptions(options);
      if (!validation.valid) {
        return {
          error: validation.error,
          status: 'error',
          responseTime: AIUtils.calculateResponseTime(startTime)
        };
      }

      // 格式化请求参数
      const formattedOptions = AIUtils.formatRequestOptions(options, this.config);

      // 发送请求
      const result = await fetch(`${formattedOptions.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${formattedOptions.apiKey}`
        },
        body: JSON.stringify({
          model: formattedOptions.model,
          messages: formattedOptions.messages,
          temperature: formattedOptions.temperature,
          max_tokens: formattedOptions.max_tokens,
          ...formattedOptions
        })
      });

      if (!result.ok) {
        throw new Error(`HTTP ${result.status}: ${await result.text()}`);
      }

      const resultData = await result.json();

      // 处理响应
      const response = {
        content: resultData.choices[0].message.content || '',
        finishReason: resultData.choices[0].finish_reason || 'unknown',
        usage: resultData.usage,
        id: resultData.id
      };

      return {
        response,
        status: 'success',
        responseTime: AIUtils.calculateResponseTime(startTime)
      };
    } catch (error) {
      return {
        error: AIErrorHandler.fromError(error),
        status: 'error',
        responseTime: AIUtils.calculateResponseTime(startTime)
      };
    }
  }

  // 发送流式补全请求
  async sendStreamCompletionRequest(options: AIRequestOptions, streamOptions: AIStreamOptions): Promise<void> {
    try {
      // 验证请求参数
      const validation = AIUtils.validateRequestOptions(options);
      if (!validation.valid) {
        if (streamOptions.onError) {
          streamOptions.onError(validation.error!);
        }
        return;
      }

      // 格式化请求参数
      const formattedOptions = AIUtils.formatRequestOptions(options, this.config);

      // 发送流式请求
      const response = await fetch(`${formattedOptions.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${formattedOptions.apiKey}`
        },
        body: JSON.stringify({
          model: formattedOptions.model,
          messages: formattedOptions.messages,
          temperature: formattedOptions.temperature,
          max_tokens: formattedOptions.max_tokens,
          stream: true,
          ...formattedOptions
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }

      let fullContent = '';
      let finishReason: string | undefined;
      let usage: any;
      let id: string | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder('utf-8').decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data === '[DONE]') {
              continue;
            }
            try {
              const chunkData = JSON.parse(data);
              if (chunkData.choices && chunkData.choices[0]) {
                const choice = chunkData.choices[0];
                const content = choice.delta?.content || '';
                fullContent += content;
                streamOptions.onStream(content, false);
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
            } catch (error) {
              console.error('解析流式响应失败:', error);
            }
          }
        }
      }

      // 完成回调
      if (streamOptions.onComplete) {
        const responseData = {
          content: fullContent,
          finishReason: finishReason || 'unknown',
          usage: usage,
          id: id || ''
        };
        streamOptions.onComplete(responseData);
      }

      // 发送结束标记
      streamOptions.onStream('', true);
    } catch (error) {
      const aiError = AIErrorHandler.fromError(error);
      if (streamOptions.onError) {
        streamOptions.onError(aiError);
      }
    }
  }

  // 获取配置
  getConfig(): AIServiceConfig {
    return { ...this.config };
  }

  // 更新配置
  updateConfig(config: Partial<AIServiceConfig>): void {
    const newConfig = { ...this.config, ...config };
    const validation = AIConfigValidator.validateConfig(newConfig);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    this.config = newConfig;
  }
}

// 自定义 Hook：使用 AI 服务
export function useAIService(config: AIServiceConfig) {
  const [status, setStatus] = useState<AIRequestStatus>('idle');
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<AIError | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);

  // 创建 AI 服务实例
  const aiService = useMemo(() => {
    return new AIService(config);
  }, [config]);

  // 发送聊天请求
  const sendChatRequest = useCallback(async (options: AIRequestOptions) => {
    setStatus('loading');
    setError(null);
    setResponse(null);
    setResponseTime(null);

    const result = await aiService.sendChatRequest(options);
    setStatus(result.status);
    setResponse(result.response);
    setError(result.error || null);
    setResponseTime(result.responseTime || null);

    return result;
  }, [aiService]);

  // 发送流式聊天请求
  const sendStreamChatRequest = useCallback(async (options: AIRequestOptions, streamOptions: AIStreamOptions) => {
    setStatus('loading');
    setError(null);

    await aiService.sendStreamChatRequest(options, {
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
  }, [aiService]);

  // 发送补全请求
  const sendCompletionRequest = useCallback(async (options: AIRequestOptions) => {
    setStatus('loading');
    setError(null);
    setResponse(null);
    setResponseTime(null);

    const result = await aiService.sendCompletionRequest(options);
    setStatus(result.status);
    setResponse(result.response);
    setError(result.error || null);
    setResponseTime(result.responseTime || null);

    return result;
  }, [aiService]);

  // 发送流式补全请求
  const sendStreamCompletionRequest = useCallback(async (options: AIRequestOptions, streamOptions: AIStreamOptions) => {
    setStatus('loading');
    setError(null);

    await aiService.sendStreamCompletionRequest(options, {
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
  }, [aiService]);

  // 重置状态
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
    reset
  };
}

// 导出默认配置
export const defaultAIServiceConfig = AIConfigValidator.createDefaultConfig();

// 导出默认 AI 服务实例
export const defaultAIService = new AIService(defaultAIServiceConfig);
