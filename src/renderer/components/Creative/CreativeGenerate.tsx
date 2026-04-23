import React, { useState } from 'react';
import { Card, Button, Form, Radio, Space, Typography, message, Alert, Spin, Modal, Divider } from 'antd';
import { RocketOutlined, LoadingOutlined, ReloadOutlined, InfoCircleOutlined, NetworkOutlined, ClockCircleOutlined, AlertCircleOutlined } from '@ant-design/icons';
import { useCreativeStore } from '../../stores/creativeStore';
import { useSettingStore } from '../../stores/settingStore';
import { useLogStore } from '../../stores/logStore';

const { Text, Title } = Typography;

const CreativeGenerate: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{error: string; details: string; errorType: string}>({error: '', details: '', errorType: ''});
  const { currentCreativeId, getCurrentCreative, updateCreative, addCharacterCardVersion, addWorldBookVersion } = useCreativeStore();
  const { setting, fetchSetting } = useSettingStore();
  const { addLog } = useLogStore();

  React.useEffect(() => {
    fetchSetting();
  }, [fetchSetting]);

  // 获取当前激活的AI引擎设置
  const getActiveEngineConfig = () => {
    if (!setting) return null;
    
    if (setting.aiEngines && setting.activeEngineId) {
      const activeEngine = setting.aiEngines.find(engine => engine.id === setting.activeEngineId);
      if (activeEngine) {
        return activeEngine;
      }
    }
    
    // 如果没有激活的引擎，返回第一个引擎
    if (setting.aiEngines && setting.aiEngines.length > 0) {
      return setting.aiEngines[0];
    }
    
    return null;
  };

  // 错误处理函数
  const handleError = (error: any, type: 'character' | 'worldbook') => {
    let errorMessage = '生成失败';
    let errorDetails = '';
    let errorType = 'unknown';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = String(error);
    } else if (error.error) {
      errorMessage = error.error;
      errorDetails = error.details || String(error);
      errorType = error.errorType || 'unknown';
    }
    
    // 记录错误日志
    addLog(`[Creative] 生成${type === 'character' ? '角色卡' : '世界书'}内容失败`, 'error', {
      details: errorDetails,
      error: error instanceof Error ? error : undefined,
      context: {
        type: type,
        creativeId: currentCreativeId,
        errorType: errorType
      }
    });
    
    // 显示错误信息
    setErrorDetails({ error: errorMessage, details: errorDetails, errorType });
    setErrorModalVisible(true);
  };

  // 重试生成
  const handleRetry = async () => {
    setErrorModalVisible(false);
    const values = await form.validateFields();
    await handleGenerate(values);
  };

  const handleGenerate = async (values: any) => {
    const { type } = values;
    
    const currentCreative = getCurrentCreative();
    if (!currentCreative) {
      message.error('请先选择或创建一个创意');
      return;
    }

    const activeEngine = getActiveEngineConfig();
    if (!activeEngine) {
      message.error('请在设置中配置AI引擎');
      return;
    }

    setLoading(true);
    addLog(`[Creative] 开始生成${type === 'character' ? '角色卡' : '世界书'}内容`, 'info', {
      context: {
        type: type,
        creativeId: currentCreativeId,
        creativeContent: currentCreative.content.substring(0, 100) + '...' // 只记录前100个字符
      }
    });

    try {
      // 构建生成提示词
      const prompt = buildGeneratePrompt(currentCreative.content, type);
      
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
              content: '你是一个专业的创意生成助手，正在为SillyTavern生成角色卡和世界书内容。请根据用户提供的创意，生成详细、生动、符合要求的内容。'
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
          prompt: prompt,
          max_tokens: activeEngine.max_tokens || 10240,
          temperature: activeEngine.temperature || 0.7
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
        let generated = '';
        if (apiMode === 'chat_completion' && result.data && result.data.choices && result.data.choices[0]) {
          generated = result.data.choices[0].message?.content || '';
        } else if (apiMode === 'text_completion' && result.data && result.data.choices && result.data.choices[0]) {
          generated = result.data.choices[0].text || '';
        } else {
          generated = JSON.stringify(result.data);
        }
        
        setGeneratedContent(generated);
        updateCreative(currentCreativeId!, {
          content: generated
        });
        
        // 根据类型添加版本
        if (type === 'character') {
          addCharacterCardVersion(currentCreativeId!, 'generated', generated, 'AI生成版本');
        } else {
          addWorldBookVersion(currentCreativeId!, 'generated', generated, 'AI生成版本');
        }
        
        addLog(`[Creative] 生成${type === 'character' ? '角色卡' : '世界书'}内容成功`, 'info', {
          context: {
            type: type,
            creativeId: currentCreativeId,
            generatedLength: generated.length,
            apiMode: apiMode
          }
        });
        message.success('生成成功！');
      } else {
        handleError(result, type);
      }
    } catch (error) {
      handleError(error, type);
    } finally {
      setLoading(false);
    }
  };

  const buildGeneratePrompt = (creative: string, type: 'character' | 'worldbook') => {
    if (type === 'character') {
      // 检查是否为系统类型角色（如游戏大师、法官等）
      const isSystemRole = creative.toLowerCase().includes('gm') || 
                          creative.toLowerCase().includes('游戏大师') || 
                          creative.toLowerCase().includes('法官') || 
                          creative.toLowerCase().includes('狼人杀') || 
                          creative.toLowerCase().includes('游戏机制') || 
                          creative.toLowerCase().includes('系统角色');
      
      if (isSystemRole) {
        return `基于以下创意，生成一个详细的系统类型角色卡：

创意内容：${creative}

请生成一个完整的系统角色卡，包括：
1. 角色类型：明确标识为系统类型角色（如游戏大师、法官等）
2. 功能职责：详细描述该角色在游戏中的核心职责和功能
3. 游戏机制：说明该角色如何影响和管理游戏机制
4. 权限范围：明确该角色的权限边界和决策范围
5. 操作指南：提供具体的操作流程和决策依据
6. 交互模式：描述该角色与其他玩家的互动方式
7. 特殊规则：列出该角色特有的规则和处理方式

请确保生成的内容详细、清晰，符合系统类型角色的特性，关注功能和机制而非个人属性。`;
      } else {
        return `基于以下创意，生成一个详细的标准角色卡：

创意内容：${creative}

请生成一个完整的角色卡，包括：
1. 角色名称
2. 角色描述
3. 角色背景
4. 角色性格
5. 角色能力
6. 角色关系
7. 其他相关信息

请确保生成的内容详细、生动、符合创意要求。`;
      }
    } else {
      return `基于以下创意，生成一个详细的世界书：

创意内容：${creative}

请生成一个完整的世界书，包括：
1. 世界名称
2. 世界描述
3. 世界背景
4. 主要势力
5. 重要地点
6. 历史事件
7. 其他相关信息

请确保生成的内容详细、生动、符合创意要求。`;
    }
  };

  return (
    <Card title={<Title level={4}>智能生成</Title>} className="creative-generate-card">
      {!currentCreative ? (
        <Alert 
          message="提示" 
          description="请先在创意输入中添加创意内容" 
          type="info" 
          showIcon 
        />
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <Text strong>当前创意：</Text>
            <div style={{ marginTop: 8, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
              <Text>{currentCreative.content}</Text>
            </div>
          </div>

          <Form form={form} onFinish={handleGenerate} layout="vertical">
            <Form.Item 
              name="type" 
              label="生成类型"
              rules={[{ required: true, message: '请选择生成类型' }]}
            >
              <Radio.Group>
                <Radio value="character">角色卡</Radio>
                <Radio value="worldbook">世界书</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                icon={loading ? <LoadingOutlined spin /> : <RocketOutlined />}
                size="large"
                style={{ width: '100%' }}
                loading={loading}
              >
                {loading ? '生成中...' : '开始生成'}
              </Button>
            </Form.Item>
          </Form>

          {generatedContent && (
            <div style={{ marginTop: 24 }}>
              <Title level={5}>生成结果</Title>
              <Card size="small" className="generated-content-card">
                <Text>{generatedContent}</Text>
              </Card>
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 16 }}>
        <Text type="secondary">
          提示：
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
            <li>生成过程可能需要一些时间，请耐心等待</li>
            <li>生成结果会自动保存到历史记录中</li>
            <li>您可以在多轮优化中进一步完善生成的内容</li>
          </ul>
        </Text>
      </div>

      {/* 错误详情模态框 */}
      <Modal
        title="生成失败详情"
        open={errorModalVisible}
        onCancel={() => setErrorModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setErrorModalVisible(false)}>
            关闭
          </Button>,
          <Button key="retry" type="primary" icon={<ReloadOutlined />} onClick={handleRetry}>
            重试
          </Button>
        ]}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          {errorDetails.errorType === 'network' && (
            <Alert
              icon={<NetworkOutlined />}
              message="网络错误"
              description="无法连接到API服务器，请检查服务器是否运行或网络连接是否正常"
              type="error"
              showIcon
            />
          )}
          {errorDetails.errorType === 'timeout' && (
            <Alert
              icon={<ClockCircleOutlined />}
              message="请求超时"
              description="API请求超过了设定的超时时间，请检查服务器响应速度或增加超时设置"
              type="warning"
              showIcon
            />
          )}
          {errorDetails.errorType === 'response' && (
            <Alert
              icon={<AlertCircleOutlined />}
              message="响应错误"
              description="API服务器没有返回响应体，请检查服务器配置"
              type="error"
              showIcon
            />
          )}
          {errorDetails.errorType === 'unknown' && (
            <Alert
              icon={<InfoCircleOutlined />}
              message="未知错误"
              description="发生了未知错误，请检查日志获取详细信息"
              type="info"
              showIcon
            />
          )}
        </div>
        
        <Divider>
          <Text strong>错误信息</Text>
        </Divider>
        
        <div style={{ marginBottom: 16 }}>
          <Text strong>错误：</Text>
          <div style={{ marginTop: 8, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 4, whiteSpace: 'pre-wrap' }}>
            {errorDetails.error}
          </div>
        </div>
        
        <Divider>
          <Text strong>详细信息</Text>
        </Divider>
        
        <div>
          <Text strong>详情：</Text>
          <div style={{ marginTop: 8, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 4, whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
            {errorDetails.details}
          </div>
        </div>
        
        <Divider>
          <Text strong>解决建议</Text>
        </Divider>
        
        <div>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
            <li>检查API服务器是否正常运行</li>
            <li>验证API URL是否正确</li>
            <li>检查API密钥是否有效</li>
            <li>确保网络连接正常</li>
            <li>查看logs/ai-handler.log获取详细日志</li>
          </ul>
        </div>
      </Modal>
    </Card>
  );
};

export default CreativeGenerate;