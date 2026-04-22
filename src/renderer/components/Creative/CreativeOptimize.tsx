import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Typography, Input, message, Form, Select, List, Badge, Divider, Avatar, Modal } from 'antd';
import { 
  EditOutlined, 
  MessageOutlined, 
  HistoryOutlined, 
  SaveOutlined, 
  UndoOutlined, 
  RedoOutlined, 
  DownloadOutlined, 
  CheckOutlined, 
  CloseOutlined
} from '@ant-design/icons';
import MDEditor from '@uiw/react-md-editor';
import { useCreativeStore } from '../../stores/creativeStore';
import { useConfigStore } from '../../stores/configStore';
import { useLogStore } from '../../stores/logStore';
import { useUIStore } from '../../stores/uiStore';
import { buildEngineApiUrl } from '../../utils/apiUtils';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

interface CreativeOptimizeProps {
  creativeContent: string;
  onContentChange: (content: string) => void;
  creativeId: string;
  targetType: 'character' | 'worldbook';
  targetId: string;
}

const CreativeOptimize: React.FC<CreativeOptimizeProps> = ({ 
  creativeContent, 
  onContentChange, 
  creativeId, 
  targetType, 
  targetId 
}) => {
  const { theme } = useUIStore();
  const { config, fetchConfig } = useConfigStore();
  const { addLog } = useLogStore();
  const { 
    getCharacterCardById, 
    getWorldBookById, 
    addCharacterCardChatMessage, 
    addWorldBookChatMessage 
  } = useCreativeStore();
  
  // 状态管理
  const [messages, setMessages] = useState<Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentContent, setCurrentContent] = useState(creativeContent);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [history, setHistory] = useState<Array<{
    id: string;
    content: string;
    timestamp: number;
  }>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  // 优化建议模板
  const optimizationSuggestions = [
    { label: '优化角色性格描述', value: '请优化角色的性格描述，使其更加生动立体' },
    { label: '增强背景故事', value: '请增强角色的背景故事，使其更加丰富' },
    { label: '提升能力设定', value: '请提升角色的能力设定，使其更加合理' },
    { label: '优化对话风格', value: '请优化角色的对话风格，使其更加符合角色特点' },
    { label: '增强世界背景', value: '请增强世界的背景设定，使其更加丰富' },
    { label: '优化势力关系', value: '请优化世界中的势力关系，使其更加合理' },
  ];
  
  // 初始化配置
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);
  
  // 初始化时从 store 加载聊天记录
  useEffect(() => {
    if (creativeId && targetId) {
      let chatHistory: Array<{
        id: string;
        role: 'user' | 'assistant' | 'system';
        content: string;
        timestamp: number;
      }> = [];
      
      if (targetType === 'character') {
        const characterCard = getCharacterCardById(creativeId, targetId);
        chatHistory = characterCard?.chatHistory || [];
      } else {
        const worldBook = getWorldBookById(creativeId, targetId);
        chatHistory = worldBook?.chatHistory || [];
      }
      
      // 转换格式为组件使用的格式
      const formattedMessages = chatHistory.map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: msg.timestamp
      }));
      
      setMessages(formattedMessages);
    }
  }, [creativeId, targetId, targetType, getCharacterCardById, getWorldBookById]);
  
  // 当创意内容变化时，更新当前内容
  useEffect(() => {
    setCurrentContent(creativeContent);
  }, [creativeContent]);
  
  // 获取当前激活的AI引擎配置
  const getActiveEngineConfig = () => {
    if (!config) return null;
    
    // 从配置中获取当前激活的引擎
    if (config.aiEngines && config.activeEngineId) {
      const activeEngine = config.aiEngines.find(engine => engine.id === config.activeEngineId);
      if (activeEngine) {
        return activeEngine;
      }
    }
    
    // 如果没有激活的引擎，返回第一个引擎
    if (config.aiEngines && config.aiEngines.length > 0) {
      return config.aiEngines[0];
    }
    
    return null;
  };
  
  // 添加历史记录
  const addHistory = (content: string) => {
    const newHistory = [
      ...history.slice(0, historyIndex + 1),
      {
        id: `history_${Date.now()}`,
        content,
        timestamp: Date.now()
      }
    ];
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };
  
  // 撤销操作
  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCurrentContent(history[newIndex].content);
      onContentChange(history[newIndex].content);
    }
  };
  
  // 重做操作
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCurrentContent(history[newIndex].content);
      onContentChange(history[newIndex].content);
    }
  };
  
  // 应用优化建议
  const applySuggestion = (suggestion: string) => {
    setInputValue(suggestion);
  };
  
  // 发送消息
  const handleSendMessage = async () => {
    if (!inputValue.trim()) {
      message.error('请输入优化指令');
      return;
    }
    
    const activeEngine = getActiveEngineConfig();
    if (!activeEngine) {
      message.error('请在设置中配置AI引擎');
      return;
    }
    
    // 检查API地址是否有效
    if (!activeEngine.api_url) {
      message.error('API地址不能为空');
      return;
    }
    
    // 重置流式内容
    setStreamingContent('');
    setIsStreaming(true);
    
    // 添加用户消息
    const userMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user' as const,
      content: inputValue,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // 立即保存用户消息到 store
    if (creativeId && targetId) {
      const msgToSave = {
        ...userMessage,
        role: 'user' as const
      };
      if (targetType === 'character') {
        addCharacterCardChatMessage(creativeId, targetId, msgToSave);
      } else {
        addWorldBookChatMessage(creativeId, targetId, msgToSave);
      }
    }
    
    setInputValue('');
    setLoading(true);
    
    // 监听流式响应事件
    let removeStreamListener: (() => void) | null = null;
    let removeStreamCompleteListener: (() => void) | null = null;
    
    let tempGeneratedContent = '';
    
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
                  tempGeneratedContent += delta.content;
                  setStreamingContent(tempGeneratedContent);
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
      let generated = '';
      if (activeEngine.api_mode === 'chat_completion' && data.data && data.data.choices && data.data.choices[0]) {
        generated = data.data.choices[0].message?.content || '';
      } else if (activeEngine.api_mode === 'text_completion' && data.data && data.data.choices && data.data.choices[0]) {
        generated = data.data.choices[0].text || '';
      } else {
        generated = JSON.stringify(data.data);
      }
      
      // 如果流式数据为空，使用最终结果
      if (!generated && tempGeneratedContent) {
        generated = tempGeneratedContent;
      }
      
      // 添加AI消息
      const assistantMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant' as const,
        content: generated,
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // 保存 AI 消息到 store
      if (creativeId && targetId) {
        const msgToSave = {
          ...assistantMessage,
          role: 'assistant' as const
        };
        if (targetType === 'character') {
          addCharacterCardChatMessage(creativeId, targetId, msgToSave);
        } else {
          addWorldBookChatMessage(creativeId, targetId, msgToSave);
        }
      }
      
      // 更新当前内容
      setCurrentContent(generated);
      onContentChange(generated);
      
      // 添加历史记录
      addHistory(generated);
      
      addLog('[Creative] 优化内容成功');
      message.success('优化成功！');
      
      setIsStreaming(false);
    };
    
    try {
      // 构建优化提示词
      const prompt = buildOptimizePrompt(currentContent, userMessage.content, messages);
      
      // 构建AI请求
      const apiUrl = buildEngineApiUrl(activeEngine);
      const apiKey = activeEngine.api_key;
      const modelName = activeEngine.model_name || 'gpt-3.5-turbo';
      const apiKeyTransmission = activeEngine.api_key_transmission || 'body';
      const apiMode = activeEngine.api_mode || 'chat_completion';
      
      // 构建请求头
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      // 构建请求体
      let requestBody: any;
      if (apiMode === 'chat_completion') {
        requestBody = {
          model: modelName,
          messages: [
            {
              role: 'system',
              content: '你是一个专业的内容优化助手，负责根据用户的指令优化角色卡或世界书内容。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: activeEngine.max_tokens || 10240,
          temperature: activeEngine.temperature || 0.7
        };
      } else {
        requestBody = {
          model: modelName,
          prompt,
          max_tokens: activeEngine.max_tokens || 10240,
          temperature: activeEngine.temperature || 0.7
        };
      }
      
      // 处理API密钥
      if (apiKey) {
        const trimmedApiKey = apiKey.trim();
        if (apiKeyTransmission === 'header') {
          requestHeaders['Authorization'] = `Bearer ${trimmedApiKey}`;
        } else {
          requestBody.api_key = apiKey;
        }
      }
      
      // 添加事件监听器
      removeStreamListener = window.electronAPI.on('ai:stream', handleStream);
      removeStreamCompleteListener = window.electronAPI.on('ai:stream:complete', handleStreamComplete);
      
      // 调用AI请求
      const result = await window.electronAPI.ai.request({
        url: apiUrl,
        method: 'POST',
        headers: requestHeaders,
        body: requestBody,
        timeout: 30000,
        streaming: true
      });
      
      if (!result.success) {
        throw new Error(result.error || '优化失败');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '优化失败';
      addLog(`[Creative] 优化内容失败: ${errorMessage}`, 'error');
      message.error(`优化失败: ${errorMessage}`);
      message.info('请检查AI引擎配置，确保API地址正确且服务器已运行。');
    } finally {
      setLoading(false);
      setIsStreaming(false);
      if (removeStreamListener) removeStreamListener();
      if (removeStreamCompleteListener) removeStreamCompleteListener();
    }
  };
  
  // 构建优化提示词 - 无限制版
  const buildOptimizePrompt = (content: string, instruction: string, history: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>) => {
    let prompt = `你是一个专业的内容优化助手，负责根据用户的指令优化角色卡或世界书内容。
    
请根据以下指令优化内容：

指令：${instruction}

原始内容：
${content}

`;
    
    // 添加完整的历史对话 - 无限制
    if (history.length > 0) {
      prompt += `历史对话：
`;
      
      history.forEach(msg => {
        prompt += `${msg.role === 'user' ? '用户' : '助手'}：${msg.content}\n`;
      });
      prompt += `\n`;
    }
    
    prompt += `请返回优化后的完整内容，保持原始格式和结构。
注意：只返回优化后的内容本身，不要包含额外的解释或说明。`;
    
    return prompt;
  };
  
  // 导出内容
  const handleExport = () => {
    const blob = new Blob([currentContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `optimized-content-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // 恢复历史版本
  const handleRestoreVersion = (version: string) => {
    const historyItem = history.find(item => item.id === version);
    if (historyItem) {
      setCurrentContent(historyItem.content);
      onContentChange(historyItem.content);
      setShowHistoryModal(false);
    }
  };
  
  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <Title level={5}>多轮优化</Title>
        <Text type="secondary">基于对话的内容优化，支持多轮交互和版本管理</Text>
      </div>
      
      <Card size="small" className="optimize-card" style={{ marginBottom: 16 }}>
        <div className="optimize-header" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong>当前内容</Text>
          <Space size="small">
            <Button 
              type="link" 
              icon={<UndoOutlined />} 
              onClick={handleUndo}
              disabled={historyIndex <= 0}
            >
              撤销
            </Button>
            <Button 
              type="link" 
              icon={<RedoOutlined />} 
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
            >
              重做
            </Button>
            <Button 
              type="link" 
              icon={<HistoryOutlined />} 
              onClick={() => setShowHistoryModal(true)}
              disabled={history.length === 0}
            >
              历史版本
            </Button>
            <Button 
              type="link" 
              icon={<DownloadOutlined />} 
              onClick={handleExport}
            >
              导出
            </Button>
          </Space>
        </div>
        
        <MDEditor
          value={isStreaming ? streamingContent : currentContent}
          onChange={(value) => {
            setCurrentContent(value || '');
            onContentChange(value || '');
            if (!isStreaming) addHistory(value || '');
          }}
          height={400}
          preview="edit"
          dark={theme === 'dark'}
        />
      </Card>
      
      <Card size="small" className="optimize-suggestions" style={{ marginBottom: 16 }}>
        <Title level={5} style={{ marginBottom: 16 }}>优化建议</Title>
        <Space wrap size="small">
          {optimizationSuggestions.map((suggestion, index) => (
            <Button 
              key={index} 
              type="default" 
              size="small" 
              onClick={() => applySuggestion(suggestion.value)}
            >
              {suggestion.label}
            </Button>
          ))}
        </Space>
      </Card>
      
      <Card size="small" className="optimize-chat">
        <Title level={5} style={{ marginBottom: 16 }}>优化对话</Title>
        
        <List
          className="chat-list"
          style={{ maxHeight: 300, overflow: 'auto', marginBottom: 16 }}
          dataSource={messages}
          renderItem={(message) => (
            <List.Item>
              <List.Item.Meta
                avatar={
                  <Avatar icon={message.role === 'user' ? <MessageOutlined /> : <EditOutlined />} />
                }
                title={
                  <Space size="small">
                    <Text strong>{message.role === 'user' ? '用户' : 'AI助手'}</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {new Date(message.timestamp).toLocaleString()}
                    </Text>
                  </Space>
                }
                description={
                  <Paragraph ellipsis={{ rows: 3 }}>
                    {message.content}
                  </Paragraph>
                }
              />
            </List.Item>
          )}
        />
        
        <Form onFinish={handleSendMessage} layout="vertical">
          <Form.Item 
            name="instruction" 
            rules={[{ required: true, message: '请输入优化指令' }]}
          >
            <TextArea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="请输入优化指令，例如：'请优化角色的性格描述，使其更加生动立体'"
              rows={4}
              maxLength={1000}
            />
          </Form.Item>
          
          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              icon={<SendOutlined />}
              loading={loading}
              style={{ width: '100%' }}
            >
              {loading ? '优化中...' : '发送优化指令'}
            </Button>
          </Form.Item>
        </Form>
      </Card>
      
      {/* 历史版本模态框 */}
      <Modal
        title="历史版本"
        open={showHistoryModal}
        onCancel={() => setShowHistoryModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setShowHistoryModal(false)}>
            取消
          </Button>
        ]}
      >
        <List
          dataSource={history}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button 
                  key="restore" 
                  type="link" 
                  icon={<CheckOutlined />}
                  onClick={() => handleRestoreVersion(item.id)}
                >
                  恢复
                </Button>
              ]}
            >
              <List.Item.Meta
                title={
                  <Space size="small">
                    <Text>版本 {history.indexOf(item) + 1}</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {new Date(item.timestamp).toLocaleString()}
                    </Text>
                  </Space>
                }
                description={
                  <Paragraph ellipsis={{ rows: 2 }}>
                    {item.content}
                  </Paragraph>
                }
              />
            </List.Item>
          )}
        />
      </Modal>
    </div>
  );
};

// 缺少的图标组件
const SendOutlined: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 1024 1024"
    fill="currentColor"
  >
    <path d="M1024 512c0 282.78-229.22 512-512 512S0 794.78 0 512 229.22 0 512 0s512 229.22 512 512zm-614.63 192.06L204.8 512l192.57-192.06 64 64-128.57 128.06 128.57 128.06-64 64z" />
  </svg>
);

export default CreativeOptimize;
