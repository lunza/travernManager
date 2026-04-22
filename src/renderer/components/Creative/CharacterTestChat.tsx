import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, Space, Typography, Avatar, Spin, message } from 'antd';
import { SendOutlined, ReloadOutlined, UserOutlined } from '@ant-design/icons';
import { useCreativeStore } from '../../stores/creativeStore';
import { useConfigStore } from '../../stores/configStore';
import { useLogStore } from '../../stores/logStore';
import { buildEngineApiUrl } from '../../utils/apiUtils';

const { TextArea } = Input;
const { Title, Text } = Typography;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isGenerating?: boolean;
}

interface CharacterTestChatProps {
  creativeId: string;
  characterId: string;
}

const CharacterTestChat: React.FC<CharacterTestChatProps> = ({ creativeId, characterId }) => {
  const { getCharacterCardById } = useCreativeStore();
  const { config, fetchConfig } = useConfigStore();
  const { addLog } = useLogStore();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [characterCard, setCharacterCard] = useState<any>(null);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (creativeId && characterId) {
      const card = getCharacterCardById(creativeId, characterId);
      setCharacterCard(card);
    }
  }, [creativeId, characterId, getCharacterCardById]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getActiveEngineConfig = () => {
    if (!config) return null;

    if (config.aiEngines && config.activeEngineId) {
      const activeEngine = config.aiEngines.find(engine => engine.id === config.activeEngineId);
      if (activeEngine) {
        return activeEngine;
      }
    }

    if (config.aiEngines && config.aiEngines.length > 0) {
      return config.aiEngines[0];
    }

    return null;
  };

  const buildSystemPrompt = () => {
    if (!characterCard) {
      return '你是一个友好的助手。';
    }

    return `你现在扮演以下角色，请完全根据角色设定来回复：

${characterCard.content || characterCard.description || ''}

请严格按照这个角色的设定、性格、说话方式来回复，保持角色的一致性。
记住：你就是这个角色，不是在扮演，你就是他/她/它本人！`;
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) {
      return;
    }

    const activeEngine = getActiveEngineConfig();
    if (!activeEngine) {
      message.error('请在设置中配置AI引擎');
      return;
    }

    if (!activeEngine.api_url) {
      message.error('API地址不能为空');
      return;
    }

    // 添加用户消息
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: inputValue,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsGenerating(true);

    // 添加等待中的AI消息
    const aiMessageId = `msg-${Date.now()}-ai`;
    const aiMessagePlaceholder: ChatMessage = {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isGenerating: true,
    };
    setMessages(prev => [...prev, aiMessagePlaceholder]);

    let removeStreamListener: (() => void) | null = null;
    let removeStreamCompleteListener: (() => void) | null = null;

    let tempContent = '';

    const handleStream = (data: any) => {
      if (data.chunk) {
        const lines = data.chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const content = line.substring(6);
            if (content === '[DONE]') {
              continue;
            }
            try {
              const json = JSON.parse(content);
              if (json.choices && json.choices[0]) {
                const delta = json.choices[0].delta;
                if (delta && delta.content) {
                  tempContent += delta.content;
                  setMessages(prev => prev.map(msg => 
                    msg.id === aiMessageId 
                      ? { ...msg, content: tempContent, isGenerating: false } 
                      : msg
                  ));
                }
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    };

    const handleStreamComplete = (data: any) => {
      let finalContent = tempContent;
      
      if (!finalContent && data.data) {
        if (activeEngine.api_mode === 'chat_completion' && data.data.choices && data.data.choices[0]) {
          finalContent = data.data.choices[0].message?.content || '';
        } else if (activeEngine.api_mode === 'text_completion' && data.data.choices && data.data.choices[0]) {
          finalContent = data.data.choices[0].text || '';
        }
      }

      if (finalContent) {
        setMessages(prev => prev.map(msg => 
          msg.id === aiMessageId 
            ? { ...msg, content: finalContent, isGenerating: false } 
            : msg
        ));
      }

      setIsGenerating(false);
      addLog('[Character Test] 对话生成成功');
    };

    try {
      // 构建提示词
      const systemPrompt = buildSystemPrompt();
      
      // 构建对话历史
      const chatHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // 构建请求
      const apiUrl = buildEngineApiUrl(activeEngine);
      const apiKey = activeEngine.api_key;
      const modelName = activeEngine.model_name || 'gpt-3.5-turbo';
      const apiKeyTransmission = activeEngine.api_key_transmission || 'body';
      const apiMode = activeEngine.api_mode || 'chat_completion';

      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      let requestBody: any;
      if (apiMode === 'chat_completion') {
        requestBody = {
          model: modelName,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            ...chatHistory,
            {
              role: 'user',
              content: inputValue,
            },
          ],
          max_tokens: activeEngine.max_tokens || 4096,
          temperature: activeEngine.temperature || 0.8,
        };
      } else {
        let prompt = systemPrompt + '\n\n';
        chatHistory.forEach(msg => {
          prompt += `${msg.role === 'user' ? '用户' : '助手'}：${msg.content}\n`;
        });
        prompt += `用户：${inputValue}\n助手：`;
        
        requestBody = {
          model: modelName,
          prompt,
          max_tokens: activeEngine.max_tokens || 4096,
          temperature: activeEngine.temperature || 0.8,
        };
      }

      if (apiKey) {
        const trimmedApiKey = apiKey.trim();
        if (apiKeyTransmission === 'header') {
          requestHeaders['Authorization'] = `Bearer ${trimmedApiKey}`;
        } else {
          requestBody.api_key = apiKey;
        }
      }

      removeStreamListener = window.electronAPI.on('ai:stream', handleStream);
      removeStreamCompleteListener = window.electronAPI.on('ai:stream:complete', handleStreamComplete);

      const result = await window.electronAPI.ai.request({
        url: apiUrl,
        method: 'POST',
        headers: requestHeaders,
        body: requestBody,
        timeout: 60000,
        streaming: true,
      });

      if (!result.success) {
        throw new Error(result.error || '生成失败');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '生成失败';
      addLog(`[Character Test] 对话生成失败: ${errorMessage}`, 'error');
      message.error(`生成失败: ${errorMessage}`);
      message.info('请检查AI引擎配置，确保API地址正确且服务器已运行。');
      setIsGenerating(false);
    } finally {
      if (removeStreamListener) removeStreamListener();
      if (removeStreamCompleteListener) removeStreamCompleteListener();
    }
  };

  const handleRetry = async (index: number) => {
    // 找到需要重试的消息
    const retryMessage = messages[index];
    if (!retryMessage) return;

    // 截断到用户消息之前
    const truncatedMessages = messages.slice(0, index);
    setMessages(truncatedMessages);

    // 重新发送之前的用户消息
    // 找到上一条用户消息
    let userMessageToRetry = null;
    for (let i = index - 1; i >= 0; i--) {
      if (truncatedMessages[i]?.role === 'user') {
        userMessageToRetry = truncatedMessages[i];
        break;
      }
    }

    if (userMessageToRetry) {
      setInputValue(userMessageToRetry.content);
      await handleSendMessage();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getCharacterAvatar = () => {
    return (
      <Avatar
        style={{ backgroundColor: '#1890ff' }}
        icon={<UserOutlined />}
      />
    );
  };

  const getUserAvatar = () => {
    return (
      <Avatar
        style={{ backgroundColor: '#52c41a' }}
        icon={<UserOutlined />}
      />
    );
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f7f8fa',
        borderLeft: '1px solid #e8e8e8',
      }}
    >
      {/* 头部 */}
      <div
        style={{
          padding: '16px 20px',
          backgroundColor: '#fff',
          borderBottom: '1px solid #e8e8e8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {getCharacterAvatar()}
          <div>
            <Title level={5} style={{ margin: 0 }}>
              {characterCard?.name || '角色对话'}
            </Title>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              与角色进行交互式对话测试
            </Text>
          </div>
        </div>
      </div>

      {/* 对话区域 */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999',
            }}
          >
            <Avatar
              size={64}
              style={{ backgroundColor: '#1890ff', marginBottom: '16px' }}
              icon={<UserOutlined />}
            />
            <Title level={5} style={{ color: '#666', marginBottom: '8px' }}>
              开始与角色对话
            </Title>
            <Text type="secondary">在下方输入框中发送消息，开始测试角色</Text>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                alignItems: 'flex-start',
              }}
            >
              {msg.role === 'assistant' && getCharacterAvatar()}

              <div
                style={{
                  maxWidth: '70%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    backgroundColor: msg.role === 'user' ? '#1890ff' : '#fff',
                    color: msg.role === 'user' ? '#fff' : '#333',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.isGenerating ? (
                    <Spin size="small" />
                  ) : (
                    <Text style={{ fontSize: '14px', lineHeight: '1.6' }}>
                      {msg.content}
                    </Text>
                  )}
                </div>

                {/* 操作按钮 */}
                {msg.role === 'assistant' && !msg.isGenerating && (
                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                    <Button
                      type="text"
                      size="small"
                      icon={<ReloadOutlined />}
                      onClick={() => handleRetry(index)}
                      style={{
                        fontSize: '12px',
                        color: '#999',
                        height: 'auto',
                        padding: '4px 8px',
                      }}
                    >
                      重新回复
                    </Button>
                  </div>
                )}
              </div>

              {msg.role === 'user' && getUserAvatar()}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 发送区域 */}
      <div
        style={{
          padding: '16px 20px',
          backgroundColor: '#fff',
          borderTop: '1px solid #e8e8e8',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-end',
          }}
        >
          <TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息开始对话... (Enter发送，Shift+Enter换行)"
            rows={3}
            style={{ flex: 1 }}
            disabled={isGenerating}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSendMessage}
            loading={isGenerating}
            disabled={!inputValue.trim()}
            size="large"
            style={{
              height: 'auto',
              padding: '12px 24px',
            }}
          >
            发送
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CharacterTestChat;
