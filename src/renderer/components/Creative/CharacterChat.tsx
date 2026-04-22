import React, { useState, useEffect, useRef } from 'react';
import { Layout, Button, Input, Avatar, List, Typography, Space, Spin, message } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined, ReloadOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { useConfigStore } from '../../stores/configStore';
import { useLogStore } from '../../stores/logStore';
import { useCharacterChatStore, ChatMessage } from '../../stores/characterChatStore';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

interface CharacterChatProps {
  creativeId: string;
  characterCardId: string;
  characterCardName: string;
  characterCardContent: string;
  chatType: 'test' | 'generation';
}

const CharacterChat: React.FC<CharacterChatProps> = ({ 
  creativeId, 
  characterCardId, 
  characterCardName, 
  characterCardContent,
  chatType 
}) => {
  const { config } = useConfigStore();
  const { addLog } = useLogStore();
  const { 
    loadTestChat, 
    loadGenerationChat, 
    saveTestChat, 
    saveGenerationChat, 
    currentTestChat, 
    currentGenerationChat,
    isLoading 
  } = useCharacterChatStore();
  
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  const currentMessages = chatType === 'test' 
    ? (currentTestChat?.messages || []) 
    : (currentGenerationChat?.messages || []);
  
  const chatTitle = chatType === 'test' 
    ? `测试: ${characterCardName}` 
    : `生成: ${characterCardName}`;

  // 自动滚动到底部
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [currentMessages]);

  // 加载对话历史
  useEffect(() => {
    if (chatType === 'test') {
      loadTestChat(creativeId, characterCardId);
    } else {
      loadGenerationChat(creativeId, 'character', characterCardName);
    }
  }, [creativeId, characterCardId, characterCardName, chatType]);

  // 发送消息
  const handleSend = async () => {
    if (!inputValue.trim()) return;
    if (!config || !config.apiUrl || !config.modelName) {
      message.error('请先在设置中配置AI引擎');
      return;
    }

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now()
    };

    // 添加用户消息
    const newMessages = [...currentMessages, userMessage];
    
    // 临时更新UI
    if (chatType === 'test') {
      if (currentTestChat) {
        saveTestChat(creativeId, characterCardId, characterCardName, newMessages);
      }
    } else {
      if (currentGenerationChat) {
        saveGenerationChat(creativeId, 'character', characterCardName, newMessages);
      }
    }

    setInputValue('');
    setIsGenerating(true);
    setStreamingContent('');

    try {
      addLog(`开始${chatType === 'test' ? '测试' : '生成'}对话`);

      // 构建系统提示词
      let systemPrompt = '';
      if (chatType === 'test') {
        systemPrompt = `你需要扮演下面这个角色卡中描述的角色进行对话：\n\n${characterCardContent}\n\n请完全沉浸在角色中，根据角色设定进行回应。`;
      } else {
        systemPrompt = `请根据下面的创意和提示生成/优化角色卡内容，输出Markdown格式：\n\n${characterCardContent}`;
      }

      // 构建消息历史
      const messages = [
        { role: 'system', content: systemPrompt },
        ...newMessages.map(m => ({ role: m.role, content: m.content }))
      ];

      // 构建请求参数
      const requestBody = {
        model: config.modelName,
        messages: messages,
        stream: true,
        max_tokens: config.maxTokens || 2048,
        temperature: config.temperature || 0.7
      };

      // 发送请求
      const result = await window.electronAPI.ai.request({
        url: config.apiUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': config.apiKey ? `Bearer ${config.apiKey}` : ''
        },
        body: requestBody,
        timeout: 300000,
        streaming: true
      });

      if (result && result.success) {
        addLog('对话生成成功');
      } else {
        const errorMsg = result?.error || result?.details || '未知错误';
        addLog(`对话生成失败: ${errorMsg}`);
        message.error(`对话生成失败: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      addLog(`对话生成异常: ${error}`);
      message.error('对话生成异常，请检查网络连接');
    } finally {
      setIsGenerating(false);
      setStreamingContent('');
    }
  };

  // 重新回复 - 删除最后一条AI消息然后重新生成
  const handleRegenerate = async (messageIndex: number) => {
    if (messageIndex < 1) return;
    
    // 找到最后一条用户消息
    let userMessageIndex = -1;
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (currentMessages[i].role === 'user') {
        userMessageIndex = i;
        break;
      }
    }
    
    if (userMessageIndex === -1) {
      message.warning('没有找到可以重新回复的对话');
      return;
    }
    
    // 删除从用户消息之后的所有消息
    const newMessages = currentMessages.slice(0, userMessageIndex + 1);
    
    // 保存新的消息列表
    if (chatType === 'test') {
      await saveTestChat(creativeId, characterCardId, characterCardName, newMessages);
    } else {
      await saveGenerationChat(creativeId, 'character', characterCardName, newMessages);
    }
    
    // 重新发送最后一条用户消息
    setInputValue(newMessages[userMessageIndex].content);
    await handleSend();
  };

  // 监听流式响应
  useEffect(() => {
    let removeStreamListener: (() => void) | null = null;
    let removeCompleteListener: (() => void) | null = null;

    if (window.electronAPI) {
      removeStreamListener = window.electronAPI.on('ai:stream', (chunk: string) => {
        setStreamingContent(prev => prev + chunk);
      });

      removeCompleteListener = window.electronAPI.on('ai:stream:complete', (fullContent: string) => {
        const assistantMessage: ChatMessage = {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant',
          content: fullContent,
          timestamp: Date.now()
        };

        // 更新完整的消息列表
        const newMessages = [...currentMessages, assistantMessage];
        if (chatType === 'test') {
          saveTestChat(creativeId, characterCardId, characterCardName, newMessages);
        } else {
          saveGenerationChat(creativeId, 'character', characterCardName, newMessages);
        }
        
        setStreamingContent('');
      });
    }

    return () => {
      if (removeStreamListener) removeStreamListener();
      if (removeCompleteListener) removeCompleteListener();
    };
  }, [chatType, creativeId, characterCardId, characterCardName, currentMessages]);

  // 处理回车发送
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f5f7fa' }}>
      {/* 头部 */}
      <div style={{ 
        padding: '12px 16px', 
        background: 'white', 
        borderBottom: '1px solid #e8e8e8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Space>
          <Avatar icon={<RobotOutlined />} style={{ background: '#1890ff' }} />
          <div>
            <Text strong>{chatTitle}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              角色卡已绑定 · 对话自动保存
            </Text>
          </div>
        </Space>
        <Button 
          type="text" 
          size="small"
          onClick={() => {
            if (confirm('确定要清空对话历史吗？')) {
              if (chatType === 'test') {
                saveTestChat(creativeId, characterCardId, characterCardName, []);
              } else {
                saveGenerationChat(creativeId, 'character', characterCardName, []);
              }
              message.success('对话历史已清空');
            }
          }}
        >
          清空历史
        </Button>
      </div>

      {/* 对话区域 */}
      <div 
        ref={chatContainerRef}
        style={{ 
          flex: 1, 
          overflow: 'auto', 
          padding: '16px',
          background: '#f5f7fa'
        }}
      >
        <Spin spinning={isLoading} tip="加载对话历史中...">
          {currentMessages.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: '100px', color: '#999' }}>
              <RobotOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
              <Paragraph>开始与角色对话吧</Paragraph>
              <Paragraph type="secondary" style={{ fontSize: '12px' }}>
                {chatType === 'test' 
                  ? '角色卡设定已加载，AI将扮演角色卡中的角色' 
                  : '基于创意，引导AI生成角色卡内容'}
              </Paragraph>
            </div>
          )}

          <List
            itemLayout="horizontal"
            dataSource={currentMessages}
            renderItem={(item, index) => (
              <List.Item
                style={{
                  justifyContent: item.role === 'user' ? 'flex-end' : 'flex-start',
                  padding: '8px 0'
                }}
                actions={item.role === 'assistant' ? [
                  <Button 
                    key="regenerate"
                    type="text" 
                    size="small" 
                    icon={<ReloadOutlined />}
                    onClick={() => handleRegenerate(index)}
                  >
                    重新回复
                  </Button>
                ] : []}
              >
                <div 
                  style={{ 
                    maxWidth: '70%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: item.role === 'user' ? 'flex-end' : 'flex-start'
                  }}
                >
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <div style={{
                      background: item.role === 'user' ? '#1890ff' : 'white',
                      color: item.role === 'user' ? 'white' : 'rgba(0, 0, 0, 0.85)',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      wordBreak: 'break-word'
                    }}>
                      {item.role === 'assistant' ? (
                        <ReactMarkdown>{item.content}</ReactMarkdown>
                      ) : (
                        item.content
                      )}
                    </div>
                    <Text type="secondary" style={{ fontSize: '11px', textAlign: 'center' }}>
                      {new Date(item.timestamp).toLocaleString()}
                    </Text>
                  </Space>
                </div>
              </List.Item>
            )}
          />

          {/* 流式显示正在生成的内容 */}
          {isGenerating && streamingContent && (
            <List.Item
              style={{
                justifyContent: 'flex-start',
                padding: '8px 0'
              }}
            >
              <div style={{ maxWidth: '70%' }}>
                <div style={{
                  background: 'white',
                  color: 'rgba(0, 0, 0, 0.85)',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  wordBreak: 'break-word'
                }}>
                  <ReactMarkdown>{streamingContent}</ReactMarkdown>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
                  <Spin size="small" style={{ marginRight: '8px' }} />
                  <Text type="secondary" style={{ fontSize: '11px' }}>正在生成...</Text>
                </div>
              </div>
            </List.Item>
          )}
        </Spin>
      </div>

      {/* 输入区域 */}
      <div style={{ 
        padding: '12px 16px', 
        background: 'white', 
        borderTop: '1px solid #e8e8e8'
      }}>
        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="输入消息..."
            autoSize={{ minRows: 1, maxRows: 6 }}
            onKeyDown={handleKeyDown}
            disabled={isGenerating}
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
        <div style={{ marginTop: '8px', textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            按 Enter 发送，Shift+Enter 换行
          </Text>
        </div>
      </div>
    </div>
  );
};

export default CharacterChat;
