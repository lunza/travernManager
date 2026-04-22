import React, { useState } from 'react';
import { Card, Form, Input, Button, Space, Typography, message, Alert, List, Avatar } from 'antd';
import { EditOutlined, LoadingOutlined, SendOutlined } from '@ant-design/icons';
import { useCreativeStore } from '../../stores/creativeStore';
import { useConfigStore } from '../../stores/configStore';
import { useLogStore } from '../../stores/logStore';

const { TextArea } = Input;
const { Text, Title } = Typography;

interface OptimizationRound {
  id: string;
  prompt: string;
  result: string;
  timestamp: number;
}

const CreativeOptimize: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [optimizationRounds, setOptimizationRounds] = useState<OptimizationRound[]>([]);
  const { currentCreativeId, getCurrentCreative, updateCreative, addVersion } = useCreativeStore();
  const { config, fetchConfig } = useConfigStore();
  const { addLog } = useLogStore();

  React.useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

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

  const handleOptimize = async (values: any) => {
    const { optimizationPrompt } = values;
    
    const currentCreative = getCurrentCreative();
    if (!currentCreative) {
      message.error('请先选择或创建一个创意');
      return;
    }

    if (!optimizationPrompt.trim()) {
      message.error('请输入优化要求');
      return;
    }

    const activeEngine = getActiveEngineConfig();
    if (!activeEngine) {
      message.error('请在设置中配置AI引擎');
      return;
    }

    setLoading(true);
    addLog(`[Creative] 开始优化创意内容`);

    try {
      // 构建优化提示词
      const prompt = buildOptimizePrompt(currentCreative.content, optimizationPrompt);
      
      // 构建AI请求
      const apiUrl = activeEngine.api_url;
      const apiKey = activeEngine.api_key;
      const modelName = activeEngine.model_name || 'gpt-3.5-turbo';
      const apiKeyTransmission = activeEngine.api_key_transmission || 'body';
      const apiMode = activeEngine.api_mode;
      
      if (!apiUrl) {
        message.error('API地址不能为空');
        setLoading(false);
        return;
      }

      // 构建请求URL
      let requestUrl;
      if (apiMode === 'chat_completion') {
        if (apiUrl.endsWith('/v1/chat/completions')) {
          requestUrl = apiUrl;
        } else {
          const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
          requestUrl = baseUrl + 'v1/chat/completions';
        }
      } else {
        if (apiUrl.endsWith('/v1/completions')) {
          requestUrl = apiUrl;
        } else {
          const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
          requestUrl = baseUrl + 'v1/completions';
        }
      }

      // 构建请求头
      let requestHeaders = {
        'Content-Type': 'application/json'
      };

      // 构建请求体
      let requestBody;
      if (apiMode === 'chat_completion') {
        requestBody = {
          model: modelName,
          messages: [
            {
              role: 'system',
              content: '你是一个专业的创意优化助手，正在为SillyTavern优化角色卡和世界书内容。请根据用户提供的优化要求，对内容进行改进。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: config?.aiSettings?.maxTokens || 2048,
          temperature: config?.aiSettings?.temperature || 0.7
        };
      } else {
        requestBody = {
          model: modelName,
          prompt: prompt,
          max_tokens: config?.aiSettings?.maxTokens || 2048,
          temperature: config?.aiSettings?.temperature || 0.7
        };
      }

      // 添加API密钥
      if (apiKey) {
        if (apiKeyTransmission === 'header') {
          // 检查 API 密钥是否已经包含 Bearer 前缀
          const trimmedApiKey = apiKey.trim();
          if (trimmedApiKey.startsWith('Bearer ')) {
            requestHeaders['Authorization'] = trimmedApiKey;
          } else {
            requestHeaders['Authorization'] = `Bearer ${trimmedApiKey}`;
          }
        } else {
          requestBody.api_key = apiKey;
        }
      }

      // 调用AI请求
      const result = await window.electronAPI.ai.request({
        url: requestUrl,
        method: 'POST',
        headers: requestHeaders,
        body: requestBody,
        timeout: 30000
      });

      if (result.success) {
        // 处理AI响应
        let optimized = '';
        if (apiMode === 'chat_completion' && result.data && result.data.choices && result.data.choices[0]) {
          optimized = result.data.choices[0].message?.content || '';
        } else if (apiMode === 'text_completion' && result.data && result.data.choices && result.data.choices[0]) {
          optimized = result.data.choices[0].text || '';
        } else {
          optimized = JSON.stringify(result.data);
        }
        
        updateCreative(currentCreativeId!, {
          content: optimized
        });
        addVersion(currentCreativeId!, optimized);
        
        // 添加到优化历史
        const newRound: OptimizationRound = {
          id: Date.now().toString(),
          prompt: optimizationPrompt,
          result: optimized,
          timestamp: Date.now()
        };
        setOptimizationRounds([newRound, ...optimizationRounds]);
        
        addLog(`[Creative] 优化创意内容成功`);
        message.success('优化成功！');
        form.resetFields();
      } else {
        throw new Error(result.error || '优化失败');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '优化失败';
      addLog(`[Creative] 优化创意内容失败: ${errorMessage}`, 'error');
      message.error(`优化失败: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const buildOptimizePrompt = (content: string, optimizationPrompt: string) => {
    return `请根据以下优化要求，对提供的内容进行优化：

原始内容：
${content}

优化要求：
${optimizationPrompt}

请提供优化后的内容，确保：
1. 保持原始内容的核心信息
2. 按照优化要求进行改进
3. 内容更加详细、生动、符合要求
4. 保持良好的结构和可读性`;
  };

  return (
    <Card title={<Title level={4}>多轮优化</Title>} className="creative-optimize-card">
      {!currentCreative ? (
        <Alert 
          message="提示" 
          description="请先在创意输入或智能生成中添加内容" 
          type="info" 
          showIcon 
        />
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <Text strong>当前内容：</Text>
            <div style={{ marginTop: 8, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 4, maxHeight: 200, overflowY: 'auto' }}>
              <Text>{currentCreative}</Text>
            </div>
          </div>

          <Form form={form} onFinish={handleOptimize} layout="vertical">
            <Form.Item 
              name="optimizationPrompt" 
              label="优化要求"
              rules={[{ required: true, message: '请输入优化要求' }]}
            >
              <TextArea 
                rows={4} 
                placeholder="请输入您的优化要求，例如：增加更多细节、改进角色性格描述、完善世界背景等..."
                showCount 
                maxLength={1000}
                style={{ resize: 'vertical' }}
              />
            </Form.Item>

            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                icon={loading ? <LoadingOutlined spin /> : <SendOutlined />}
                size="large"
                style={{ width: '100%' }}
                loading={loading}
              >
                {loading ? '优化中...' : '开始优化'}
              </Button>
            </Form.Item>
          </Form>

          {optimizationRounds.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <Title level={5}>优化历史</Title>
              <List
                className="optimization-history-list"
                itemLayout="vertical"
                dataSource={optimizationRounds}
                renderItem={(item) => (
                  <List.Item
                    key={item.id}
                    avatar={<Avatar>{item.prompt.substring(0, 1)}</Avatar>}
                    extra={<Text type="secondary">{new Date(item.timestamp).toLocaleString()}</Text>}
                  >
                    <List.Item.Meta
                      title={<Text strong>优化要求：{item.prompt}</Text>}
                      description={
                        <div style={{ marginTop: 8 }}>
                          <Text>优化结果：</Text>
                          <div style={{ marginTop: 4, padding: 8, backgroundColor: '#f9f9f9', borderRadius: 4 }}>
                            <Text>{item.result}</Text>
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 16 }}>
        <Text type="secondary">
          提示：
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
            <li>您可以通过多轮交互不断优化内容</li>
            <li>每轮优化都会保存到历史记录中</li>
            <li>优化结果会自动成为下一轮的基础内容</li>
            <li>请提供具体的优化要求，以获得更好的结果</li>
          </ul>
        </Text>
      </div>
    </Card>
  );
};

export default CreativeOptimize;