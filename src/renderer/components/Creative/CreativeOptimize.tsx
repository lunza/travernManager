import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Input, Space, Typography, List, Avatar, message, Select, Spin } from 'antd';
import {
  SendOutlined,
  UndoOutlined,
  RedoOutlined,
  HistoryOutlined,
  UserOutlined,
  RobotOutlined
} from '@ant-design/icons';
import MDEditor from '@uiw/react-md-editor';
import RichTextRenderer from '../Common/RichTextRenderer';
import { useSettingStore } from '../../stores/settingStore';
import { useLogStore } from '../../stores/logStore';
import { useCreativeStore } from '../../stores/creativeStore';
import { useUIStore } from '../../stores/uiStore';
import { buildEngineApiUrl } from '../../utils/apiUtils';

const { TextArea } = Input;
const { Title, Text } = Typography;
const { Option } = Select;

interface CreativeOptimizeProps {
  creativeContent: string;
  onContentChange: (content: string) => void;
  creativeId: string;
  targetType: 'character' | 'worldbook';
  targetId: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isGenerating?: boolean;
}

const CreativeOptimize: React.FC<CreativeOptimizeProps> = ({
  creativeContent,
  onContentChange,
  creativeId,
  targetType,
  targetId
}) => {
  const { addLog } = useLogStore();
  const { theme } = useUIStore();
  const { setting, fetchSetting } = useSettingStore();
  const {
    getCharacterCardById,
    getWorldBookById,
    addCharacterCardChatMessage,
    addWorldBookChatMessage,
    clearCharacterCardChatHistory,
    clearWorldBookChatHistory
  } = useCreativeStore();

  // ===== 核心状态管理 =====
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentContent, setCurrentContent] = useState(creativeContent);
  const [isGenerating, setIsGenerating] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // 优化建议模板
  const optimizationSuggestions = [
    { label: '优化角色性格描述', value: '请优化角色的性格描述，使其更加生动立体' },
    { label: '增强背景故事', value: '请增强角色的背景故事，使其更加丰富' },
    { label: '提升能力设定', value: '请提升角色的能力设定，使其更加合理' },
    { label: '优化对话风格', value: '请优化角色的对话风格，使其更加符合角色特点' },
    { label: '增强世界背景', value: '请增强世界的背景设定，使其更加丰富' },
    { label: '优化势力关系', value: '请优化世界中的势力关系，使其更加合理' }
  ];

  // ===== 初始化设置 =====
  useEffect(() => {
    fetchSetting();
  }, [fetchSetting]);

  // ===== 从父组件同步内容 =====
  useEffect(() => {
    setCurrentContent(creativeContent);
  }, [creativeContent]);

  // ===== 初始化聊天历史 =====
  useEffect(() => {
    const loadHistory = () => {
      let chatHistory: Array<any> = [];
      if (targetType === 'character') {
        const card = getCharacterCardById(creativeId, targetId);
        chatHistory = card?.chatHistory || [];
      } else {
        const world = getWorldBookById(creativeId, targetId);
        chatHistory = world?.chatHistory || [];
      }

      const formatted = chatHistory.map((msg: any) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: msg.timestamp
      }));

      setMessages(formatted);
    };

    loadHistory();
  }, [creativeId, targetType, targetId, getCharacterCardById, getWorldBookById]);

  // ===== 自动滚动到底部 =====
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // ===== 获取激活引擎 =====
  const getActiveEngineConfig = () => {
    if (!setting) return null;

    if (setting.aiEngines && setting.activeEngineId) {
      const activeEngine = setting.aiEngines.find(engine => engine.id === setting.activeEngineId);
      if (activeEngine) {
        return activeEngine;
      }
    }

    if (setting.aiEngines && setting.aiEngines.length > 0) {
      return setting.aiEngines[0];
    }

    return null;
  };

  // ===== 发送消息 =====
  const handleSend = async () => {
    if (!inputValue.trim() || isGenerating) return;

    const activeEngine = getActiveEngineConfig();
    if (!activeEngine) {
      message.error('请在设置中配置AI引擎');
      return;
    }
    if (!activeEngine.api_url) {
      message.error('API地址不能为空');
      return;
    }

    addLog('[CreativeOptimize] 用户发送优化请求', 'debug', {
      category: 'creative',
      context: { targetType, targetId, contentLength: inputValue.length }
    });

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: String(inputValue.trim()),
      timestamp: Date.now()
    };
    const initialMessages = [...messages, userMessage];
    setMessages(initialMessages);
    setInputValue('');
    setIsGenerating(true);

    const aiMessagePlaceholder: ChatMessage = {
      id: `ai_${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isGenerating: true
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
                    msg.id === aiMessagePlaceholder.id
                      ? { ...msg, content: tempContent, isGenerating: true }
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
        const finalAiMessage: ChatMessage = {
          id: aiMessagePlaceholder.id,
          role: 'assistant',
          content: String(finalContent),
          timestamp: Date.now(),
          isGenerating: false
        };
        const finalMessages = [...initialMessages, finalAiMessage];

        setMessages(finalMessages);
        setCurrentContent(finalContent);
        onContentChange(finalContent);

        setTimeout(async () => {
          if (targetType === 'character') {
            clearCharacterCardChatHistory(creativeId, targetId);
            finalMessages.forEach(msg => {
              addCharacterCardChatMessage(creativeId, targetId, {
                id: msg.id,
                role: msg.role as 'user' | 'assistant' | 'system',
                content: msg.content,
                timestamp: msg.timestamp
              });
            });
          } else {
            clearWorldBookChatHistory(creativeId, targetId);
            finalMessages.forEach(msg => {
              addWorldBookChatMessage(creativeId, targetId, {
                id: msg.id,
                role: msg.role as 'user' | 'assistant' | 'system',
                content: msg.content,
                timestamp: msg.timestamp
              });
            });
          }
          addLog('[CreativeOptimize] 优化内容保存成功', 'info');
        }, 0);
      }

      setIsGenerating(false);
    };

    try {
      const apiUrl = buildEngineApiUrl(activeEngine);
      const apiKey = activeEngine.api_key;
      const modelName = activeEngine.model_name || 'gpt-3.5-turbo';
      const apiKeyTransmission = activeEngine.api_key_transmission || 'body';
      const apiMode = activeEngine.api_mode || 'chat_completion';

      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      let requestBody: any;
      if (apiMode === 'chat_completion') {
        requestBody = {
          model: modelName,
          messages: [
            {
              role: 'system',
              content: `你是一个创意内容优化助手。请根据用户的要求，对以下内容进行优化：\n${currentContent}`
            },
            ...initialMessages.map(msg => ({ role: msg.role, content: msg.content }))
          ],
          max_tokens: activeEngine.max_tokens || 8192,
          temperature: activeEngine.temperature || 0.7
        };
      } else {
        let prompt = `你是一个创意内容优化助手。请根据用户的要求，对以下内容进行优化：\n${currentContent}\n\n`;
        initialMessages.forEach(msg => {
          prompt += `${msg.role === 'user' ? '用户' : '助手'}：${msg.content}\n`;
        });
        requestBody = {
          model: modelName,
          prompt,
          max_tokens: activeEngine.max_tokens || 8192,
          temperature: activeEngine.temperature || 0.7
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
        streaming: true
      });

      if (!result.success) {
        throw new Error(result.error || '优化失败');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '优化失败';
      addLog('[CreativeOptimize] 优化失败', 'error', {
        category: 'creative',
        error: error instanceof Error ? error : undefined,
        details: errorMessage
      });
      message.error(`优化失败: ${errorMessage}`);
      message.info('请检查AI引擎配置，确保API地址正确且服务器已运行。');
      setIsGenerating(false);
    } finally {
      if (removeStreamListener) removeStreamListener();
      if (removeStreamCompleteListener) removeStreamCompleteListener();
    }
  };

  // ===== 回滚功能 =====
  const handleRollback = (index: number) => {
    addLog('[CreativeOptimize] 回滚到历史版本', 'info');

    let targetAiMsgIndex = -1;
    for (let i = index; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        targetAiMsgIndex = i;
        break;
      }
    }

    if (targetAiMsgIndex === -1) {
      message.error('找不到有效的AI回复来回滚');
      return;
    }

    const safeContent = String(messages[targetAiMsgIndex].content);
    const newMessages = messages.slice(0, targetAiMsgIndex + 1);

    setMessages(newMessages);
    setCurrentContent(safeContent);
    onContentChange(safeContent);

    setTimeout(async () => {
      if (targetType === 'character') {
        clearCharacterCardChatHistory(creativeId, targetId);
        newMessages.forEach(msg => {
          addCharacterCardChatMessage(creativeId, targetId, {
            id: msg.id,
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
            timestamp: msg.timestamp
          });
        });
      } else {
        clearWorldBookChatHistory(creativeId, targetId);
        newMessages.forEach(msg => {
          addWorldBookChatMessage(creativeId, targetId, {
            id: msg.id,
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
            timestamp: msg.timestamp
          });
        });
      }
      message.success('已回滚到该版本');
    }, 0);
  };

  return (
    <Card size="small" className="creative-optimize-card">
      <div className="optimize-header" style={{ marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>内容优化</Title>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>当前内容</Text>
        <MDEditor
          value={currentContent}
          onChange={(val) => {
            const safeVal = String(val || '');
            setCurrentContent(safeVal);
            onContentChange(safeVal);
          }}
          height={200}
          preview="edit"
          dark={theme === 'dark'}
          placeholder="在此处编辑或查看优化后的内容..."
        />
      </div>

      <div
        ref={chatContainerRef}
        className="chat-messages-container"
        style={{
          height: 200,
          overflowY: 'auto',
          border: '1px solid #d9d9d9',
          borderRadius: 4,
          padding: 12,
          marginBottom: 12
        }}
      >
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>
            选择一个优化建议或输入您的需求！
          </div>
        ) : (
          <List
            dataSource={messages}
            renderItem={(msg, index) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  marginBottom: 12,
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div style={{
                  maxWidth: '80%',
                  display: 'flex',
                  gap: 8,
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                }}>
                  <Avatar icon={msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />} />
                  <div style={{
                    background: msg.role === 'user' ? '#e6f7ff' : '#fff',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #d9d9d9'
                  }}>
                    {msg.isGenerating ? (
                      <Spin size="small" />
                    ) : (
                      <RichTextRenderer content={msg.content} />
                    )}
                    {msg.role === 'assistant' && !msg.isGenerating && (
                      <div style={{ marginTop: 8 }}>
                        <Button
                          type="link"
                          size="small"
                          onClick={() => handleRollback(index)}
                        >
                          回滚到此版本
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          />
        )}
      </div>

      <div className="chat-input-area">
        <div style={{ marginBottom: 8 }}>
          <Select
            style={{ width: '100%' }}
            placeholder="选择优化建议..."
            onChange={(value) => setInputValue(value)}
            disabled={isGenerating}
            options={optimizationSuggestions}
          />
        </div>
        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入您的优化需求... (Shift+Enter换行)"
            disabled={isGenerating}
            autoSize={{ minRows: 1, maxRows: 3 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={isGenerating}
            disabled={!inputValue.trim()}
          >
            发送
          </Button>
        </Space.Compact>
      </div>
    </Card>
  );
};

export default CreativeOptimize;
