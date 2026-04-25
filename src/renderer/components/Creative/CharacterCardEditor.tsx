import React, { useState, useEffect } from 'react';
import { Tabs, Button, Space, Typography, Form, Select, Alert, message } from 'antd';
import { RocketOutlined, HistoryOutlined, SaveOutlined, LoadingOutlined } from '@ant-design/icons';
import MarkdownEditor from '../Common/MarkdownEditor';
import { useCreativeStore } from '../../stores/creativeStore';
import { useSettingStore } from '../../stores/settingStore';
import { useLogStore } from '../../stores/logStore';
import { useUIStore } from '../../stores/uiStore';
import CreativeOptimize from './CreativeOptimize';
import { buildEngineApiUrl } from '../../utils/apiUtils';
import { getCharacterTemplates, PromptTemplate } from '../../utils/promptTemplates';

const { Text, Title } = Typography;
const { Option } = Select;

interface CharacterCardEditorProps {
  characterId: string;
}

const CharacterCardEditor: React.FC<CharacterCardEditorProps> = ({ characterId }) => {
  const {
    creatives,
    currentCreativeId,
    updateCharacterCard,
    addCharacterCardVersion,
    addCharacterCardChatMessage
  } = useCreativeStore();
  const { setting, fetchSetting } = useSettingStore();
  const { addLog } = useLogStore();
  const { theme } = useUIStore();

  const [activeTab, setActiveTab] = useState('edit');
  const [editingContent, setEditingContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [markdownContent, setMarkdownContent] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('character_card');
  const [form] = Form.useForm();

  // 获取模板列表
  const templates = getCharacterTemplates();

  // 获取当前角色卡
  const currentCreative = creatives.find(c => c.id === currentCreativeId);
  const characterCard = currentCreative?.characterCards.find(cc => cc.id === characterId);

  // 初始化内容
  useEffect(() => {
    if (characterCard) {
      setEditingContent(characterCard.content || '');
    }
  }, [characterCard]);

  useEffect(() => {
    fetchSetting();
  }, [fetchSetting]);

  // 获取当前激活的AI引擎配置
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

  // 保存角色卡内容
  const handleSave = () => {
    if (currentCreativeId && characterId) {
      updateCharacterCard(currentCreativeId, characterId, { content: editingContent });
      addCharacterCardVersion(currentCreativeId, characterId, editingContent, '手动保存');
      message.success('内容已保存');
    }
  };

  // 保存AI生成的内容到编辑中
  const handleSaveGeneratedContent = () => {
    const contentToSave = markdownContent || streamingContent;
    if (contentToSave && currentCreativeId) {
      setEditingContent(contentToSave);
      updateCharacterCard(currentCreativeId, characterId, { content: contentToSave });
      addCharacterCardVersion(currentCreativeId, characterId, contentToSave, 'AI生成');
      message.success('生成内容已保存');
      addLog('[Creative] 生成内容已保存');
    }
  };

  // 智能生成内容
  const handleGenerate = async () => {
    if (!currentCreativeId) {
      message.error('请先选择一个创意');
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

    // 获取选中的模板
    const template = templates.find(t => t.id === selectedTemplate);
    if (!template) {
      message.error('请选择生成模板');
      return;
    }

    // 重置流式内容
    setStreamingContent('');
    setMarkdownContent('');

    // 监听流式响应事件
    let removeStreamListener: (() => void) | null = null;
    let removeStreamCompleteListener: (() => void) | null = null;

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
                  setStreamingContent(prev => prev + delta.content);
                  setMarkdownContent(prev => prev + delta.content);
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
      if (data.data) {
        let generated = '';
        if (activeEngine.api_mode === 'chat_completion' && data.data.choices && data.data.choices[0]) {
          generated = data.data.choices[0].message?.content || '';
        } else if (activeEngine.api_mode === 'text_completion' && data.data.choices && data.data.choices[0]) {
          generated = data.data.choices[0].text || '';
        } else {
          generated = JSON.stringify(data.data);
        }

        // 如果流式数据为空，使用最终结果
        if (!generated && streamingContent) {
          generated = streamingContent;
        }

        // 同步更新所有内容状态，确保数据一致性
        setMarkdownContent(generated);
        setEditingContent(generated);

        updateCharacterCard(currentCreativeId, characterId, { content: generated });
        addCharacterCardVersion(currentCreativeId, characterId, generated, 'AI生成');

        addLog('角色卡内容生成成功', 'info', {
          category: 'creative',
          context: {
            creativeId: currentCreativeId,
            characterId: characterId,
            templateId: selectedTemplate,
            engineId: activeEngine.id
          },
          details: '角色卡内容生成成功，已保存到版本历史。'
        });
        message.success('生成成功！');
      }
    };

    setLoading(true);

    try {
      // 构建提示词 - 优先使用 content，如果为空尝试使用 description
      let creativeContent = currentCreative?.content || '';
      if (!creativeContent.trim()) {
        creativeContent = currentCreative?.description || '';
        addLog('创意内容为空，使用描述作为替代', 'warn', {
          category: 'creative',
          context: {
            creativeId: currentCreativeId,
            characterId: characterId
          }
        });
      }
      
      // 如果还是空，给用户提示
      if (!creativeContent.trim()) {
        message.warning('创意内容为空，请先在创意详情中编辑您的创意！');
        setLoading(false);
        return;
      }
      
      const prompt = template.buildPrompt(creativeContent);

      const apiUrl = buildEngineApiUrl(activeEngine);
      
      // 验证API URL格式
      if (!apiUrl || !apiUrl.startsWith('http')) {
        throw new Error('API URL格式不正确，请确保输入完整的URL（包含http://或https://）');
      }
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
              content: template.systemPrompt
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: Number(activeEngine.max_tokens) || 10240,
          temperature: Number(activeEngine.temperature) || 0.7
        };
      } else {
        requestBody = {
          model: modelName,
          prompt,
          max_tokens: Number(activeEngine.max_tokens) || 10240,
          temperature: Number(activeEngine.temperature) || 0.7
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

      // 记录请求参数
      const requestLogHeaders = { ...requestHeaders };
      if (requestLogHeaders['Authorization']) {
        requestLogHeaders['Authorization'] = 'Bearer [REDACTED]';
      }
      
      addLog('角色卡内容生成请求', 'info', {
        category: 'creative',
        context: {
          creativeId: currentCreativeId,
          characterId: characterId,
          characterName: characterCard?.name,
          templateId: selectedTemplate,
          templateName: template.name,
          engineId: activeEngine.id,
          engineName: activeEngine.name,
          apiUrl: apiUrl,
          apiMode: apiMode,
          modelName: modelName
        },
        details: {
          request: {
            url: apiUrl,
            method: 'POST',
            headers: requestLogHeaders,
            body: {
              ...requestBody,
              api_key: requestBody.api_key ? '[REDACTED]' : undefined,
              messages: requestBody.messages ? requestBody.messages.map((msg: any) => ({
                ...msg,
                content: msg.content.length > 500 ? msg.content.substring(0, 500) + '...' : msg.content
              })) : undefined,
              prompt: requestBody.prompt ? (requestBody.prompt.length > 500 ? requestBody.prompt.substring(0, 500) + '...' : requestBody.prompt) : undefined
            }
          }
        }
      });

      // 添加事件监听器
      removeStreamListener = window.electronAPI.on('ai:stream', handleStream);
      removeStreamCompleteListener = window.electronAPI.on('ai:stream:complete', handleStreamComplete);

      const startTime = Date.now();
      const result = await window.electronAPI.ai.request({
        url: apiUrl,
        method: 'POST',
        headers: requestHeaders,
        body: requestBody,
        timeout: 30000,
        streaming: true
      });
      const endTime = Date.now();

      // 记录响应参数
      addLog('角色卡内容生成响应', 'info', {
        category: 'creative',
        context: {
          creativeId: currentCreativeId,
          characterId: characterId,
          engineId: activeEngine.id,
          responseTime: endTime - startTime,
          success: result.success
        },
        details: {
          response: {
            success: result.success,
            error: result.error,
            data: result.data ? (typeof result.data === 'string' ? result.data.substring(0, 500) + '...' : JSON.stringify(result.data).substring(0, 500) + '...') : undefined
          }
        }
      });

      if (!result.success) {
        // 构建详细的错误信息，包括服务器返回的错误详情
        const errorDetails = result.details ? `\n服务器错误详情: ${result.details}` : '';
        throw new Error(`${result.error || '生成失败'}${errorDetails}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '生成失败';
      addLog('角色卡内容生成失败', 'error', {
        category: 'creative',
        error: error instanceof Error ? error : undefined,
        context: {
          errorType: error instanceof Error ? error.name : 'UnknownError',
          errorLocation: 'CharacterCardEditor.tsx:269:handleGenerate',
          errorMessage: errorMessage,
          creativeId: currentCreativeId,
          characterId: characterId,
          templateId: selectedTemplate,
          engineId: activeEngine.id
        },
        details: {
          request: {
            url: buildEngineApiUrl(activeEngine),
            template: template.name,
            characterName: characterCard?.name
          },
          errorDetails: error instanceof Error ? {
            message: error.message,
            stack: error.stack
          } : {
            message: errorMessage
          }
        }
      });
      message.error(`生成失败: ${errorMessage}`);
      message.info('请检查AI引擎配置，确保API地址正确且服务器已运行。');
    } finally {
      setLoading(false);
      if (removeStreamListener) removeStreamListener();
      if (removeStreamCompleteListener) removeStreamCompleteListener();
    }
  };

  if (!characterCard) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <Text type="secondary">请先选择一个角色卡进行编辑</Text>
      </div>
    );
  }

  const items = [
    {
      key: 'edit',
      label: '编辑',
      children: (
        <div style={{ padding: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
            >
              保存内容
            </Button>
          </div>
          <MarkdownEditor
            value={editingContent}
            onChange={setEditingContent}
            minHeight={600}
            theme={theme}
            enableAITools={true}
          />
        </div>
      ),
    },
    {
      key: 'generate',
      label: <><RocketOutlined /> 智能生成</>,
      children: (
        <div style={{ padding: 16 }}>
          {!currentCreative ? (
            <Alert
              message="提示"
              description="请先选择一个创意"
              type="info"
              showIcon
            />
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <Text strong>当前角色卡：</Text> {characterCard.name}
              </div>

              <div style={{ marginBottom: 16 }}>
                <Title level={5}>选择生成模板</Title>
                <Select
                  value={selectedTemplate}
                  onChange={setSelectedTemplate}
                  style={{ width: '100%' }}
                  size="large"
                  placeholder="请选择生成模板"
                >
                  {templates.map(template => (
                    <Option key={template.id} value={template.id}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 'bold' }}>{template.name}</span>
                        <span style={{ fontSize: '12px', color: '#999' }}>{template.description}</span>
                      </div>
                    </Option>
                  ))}
                </Select>
              </div>

              {selectedTemplate && (
                <Alert
                  message={`当前模板：${templates.find(t => t.id === selectedTemplate)?.name}`}
                  description={templates.find(t => t.id === selectedTemplate)?.description}
                  type="info"
                  style={{ marginBottom: 16 }}
                />
              )}

              <Form form={form} layout="vertical">
                <Form.Item>
                  <Button
                    type="primary"
                    onClick={handleGenerate}
                    icon={loading ? <LoadingOutlined spin /> : <RocketOutlined />}
                    size="large"
                    style={{ width: '100%' }}
                    loading={loading}
                  >
                    {loading ? '生成中...' : '开始生成角色卡'}
                  </Button>
                </Form.Item>
              </Form>

              <div style={{ marginTop: 24 }}>
                <Title level={5}>生成结果</Title>
                <div style={{ marginBottom: 16 }}>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSaveGeneratedContent}
                    disabled={!markdownContent && !streamingContent}
                  >
                    保存生成内容
                  </Button>
                </div>
                <div style={{ marginTop: 16 }}>
                  <MarkdownEditor
                    value={markdownContent || streamingContent || editingContent}
                    onChange={setMarkdownContent}
                    minHeight={400}
                    theme={theme}
                    enableAITools={false}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      ),
    },
    {
      key: 'optimize',
      label: <><HistoryOutlined /> 多轮优化</>,
      children: currentCreativeId ? (
        <CreativeOptimize
          creativeContent={editingContent}
          onContentChange={(content) => {
            setEditingContent(content);
            if (currentCreativeId) {
              updateCharacterCard(currentCreativeId, characterId, { content });
            }
          }}
          creativeId={currentCreativeId}
          targetType="character"
          targetId={characterId}
        />
      ) : (
        <Alert
          message="请先选择一个创意"
          type="info"
          showIcon
          style={{ margin: 16 }}
        />
      ),
    },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={items}
        style={{ flex: 1 }}
      />
    </div>
  );
};

export default CharacterCardEditor;
