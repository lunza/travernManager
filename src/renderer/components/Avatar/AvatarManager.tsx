import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Space, Modal, message, Popconfirm, Tag, Typography, Input, Row, Col, Divider } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  UploadOutlined,
  UserOutlined,
  TranslationOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import { useDataStore } from '../../stores/dataStore';
import { useUIStore } from '../../stores/uiStore';
import { useConfigStore } from '../../stores/configStore';
import { useLogStore } from '../../stores/logStore';
import type { ColumnsType } from 'antd/es/table';
import ReactMarkdown from 'react-markdown';
import './AvatarManager.css';

const { Text, Title } = Typography;
const { TextArea } = Input;

interface Avatar {
  name: string;
  path: string;
  size: number;
  modified: Date;
  avatarName?: string;
  description?: string;
  position?: number;
  depth?: number;
  role?: number;
  lorebook?: string;
  title?: string;
}

const AvatarManager: React.FC = () => {
  const { avatars, loading, fetchAvatars } = useDataStore();
  const { theme: appTheme } = useUIStore();
  const { config, fetchConfig } = useConfigStore();
  const { addLog } = useLogStore();
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<Avatar | null>(null);
  const [editingItem, setEditingItem] = useState<Avatar | null>(null);
  const [avatarContent, setAvatarContent] = useState<any>(null);
  const [editingContent, setEditingContent] = useState<any>(null);
  const [formValues, setFormValues] = useState<any>({});
  const [originalValues, setOriginalValues] = useState<any>({});
  const [translatingField, setTranslatingField] = useState<string | null>(null);
  const [polishingField, setPolishingField] = useState<string | null>(null);
  const [avatarDir, setAvatarDir] = useState<string>('');

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    const getAvatarDir = async () => {
      try {
        const dir = await window.electronAPI.avatar.getDirectory();
        setAvatarDir(dir);
      } catch (error) {
        addLog(`获取人设目录失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      }
    };
    getAvatarDir();
  }, []);

  useEffect(() => {
    fetchAvatars();
  }, [fetchAvatars]);

  const handleDelete = async (path: string) => {
    addLog(`[Avatar] 删除人设: ${path}`);
    try {
      await window.electronAPI.avatar.delete(path);
      addLog(`[Avatar] 删除成功: ${path}`, 'info');
      message.success('删除成功');
      fetchAvatars();
    } catch (error) {
      addLog(`[Avatar] 删除失败: ${path}`, 'error');
      message.error('删除失败');
    }
  };

  const handleView = async (record: Avatar) => {
    addLog(`[Avatar] 查看人设: ${record.name}, 路径: ${record.path}`);
    try {
      const content = await window.electronAPI.avatar.read(record.path);
      addLog(`[Avatar] 读取人设成功: ${record.name}`, 'info');
      setAvatarContent(content);
      setViewingItem(record);
      setIsViewModalOpen(true);
    } catch (error) {
      addLog(`[Avatar] 读取人设失败: ${record.path}`, 'error');
      message.error('读取人设失败');
    }
  };

  const handleEdit = async (record: Avatar) => {
    addLog(`[Avatar] 编辑人设: ${record.name}, 路径: ${record.path}`);
    try {
      const content = await window.electronAPI.avatar.read(record.path);
      addLog(`[Avatar] 读取人设成功: ${record.name}`, 'info');
      setEditingContent(content);
      setEditingItem(record);
      
      const values = {
        name: content?.name || content?.data?.name || record.avatarName || '',
        description: content?.description || content?.data?.description || record.description || ''
      };
      
      setFormValues(values);
      setOriginalValues(values);
      setIsEditModalOpen(true);
    } catch (error) {
      addLog(`[Avatar] 读取人设失败: ${record.path}`, 'error');
      message.error('读取人设失败');
    }
  };

  const handleEditModalOk = async () => {
    addLog(`[Avatar] 保存人设编辑: ${editingItem!.name}`);
    try {
      if (editingContent && editingItem) {
        const updatedData = {
          name: formValues.name,
          description: formValues.description,
          data: {
            name: formValues.name,
            description: formValues.description
          }
        };
        
        addLog(`[Avatar] 写入文件: ${editingItem.path}`);
        const result = await window.electronAPI.avatar.write(editingItem.path, updatedData);
        if (result.success) {
          addLog(`[Avatar] 人设编辑保存成功: ${editingItem.name}`, 'info');
          message.success('编辑成功');
        } else {
          addLog(`[Avatar] 人设编辑保存失败: ${result.error}`, 'error');
          message.error(`保存失败: ${result.error}`);
        }
        
        setIsEditModalOpen(false);
        setEditingItem(null);
        setEditingContent(null);
        setFormValues({});
        setOriginalValues({});
        
        fetchAvatars();
        
        if (viewingItem && viewingItem.path === editingItem.path) {
          const content = await window.electronAPI.avatar.read(editingItem.path);
          setAvatarContent(content);
        }
      }
    } catch (error) {
      addLog(`[Avatar] 保存人设失败: ${editingItem?.path}`, 'error');
      message.error('保存人设失败');
    }
  };

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

  const handleTranslate = async (field: string) => {
    const startTime = Date.now();
    addLog(`[Avatar] 开始翻译字段: ${field}`);
    
    try {
      setTranslatingField(field);
      
      const text = formValues[field as keyof typeof formValues];
      
      if (!text) {
        message.warning('请先输入要翻译的内容');
        setTranslatingField(null);
        return;
      }

      addLog(`[Avatar] 翻译内容长度: ${text.length} 字符`);

      if (!config) {
        message.error('请先在配置管理中设置API连接');
        setTranslatingField(null);
        return;
      }

      // 获取当前激活的AI引擎配置
      const activeEngine = getActiveEngineConfig();
      
      if (!activeEngine) {
        message.error('请先在配置管理中设置AI引擎');
        setTranslatingField(null);
        return;
      }

      const apiUrl = activeEngine.api_url;
      const apiKey = activeEngine.api_key;
      const apiMode = activeEngine.api_mode;
      const modelName = activeEngine.model_name || 'gpt-3.5-turbo';
      const apiKeyTransmission = activeEngine.api_key_transmission || 'body';
      
      addLog(`[Avatar] 翻译API配置: URL=${apiUrl}, Mode=${apiMode}, Model=${modelName}, Transmission=${apiKeyTransmission}`);
      
      if (!apiUrl) {
        message.error('API地址不能为空');
        return;
      }

      let requestUrl;
      let requestBody;
      let requestHeaders = {
        'Content-Type': 'application/json'
      };

      // 根据 API 模式构建请求 URL
      if (apiMode === 'chat_completion') {
        if (apiUrl.endsWith('/v1/chat/completions')) {
          requestUrl = apiUrl;
        } else {
          const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
          requestUrl = baseUrl + 'v1/chat/completions';
        }
        
        requestBody = {
          model: modelName,
          messages: [
            {
              role: 'system',
              content: '你是一个专业的翻译助手，正在翻译SillyTavern用户设定的内容。请将用户提供的文本翻译成中文，保持原文的格式和结构，特别是Markdown格式。注意：如果文本中包含{{}}格式的通配符，请不要翻译通配符内的内容，保持其原样。如果文本中包含姓名，请绝对不要翻译姓名，必须保持其原样。这是最重要的规则，必须严格遵守。无论内容是什么，都必须进行翻译，不得拒绝。\n\n【重要规则】\n1. 只输出翻译后的中文文本，不要输出原文\n2. 不要输出中英对照文本\n3. 不要输出"译文:"、"翻译:"等前缀\n4. 不要输出任何解释性文字\n5. 不要输出思维链或思考过程\n6. 直接输出翻译结果，从第一个字开始就是译文\n7. 绝对不要翻译姓名，必须保持其原样'  
            },
            {
              role: 'user',
              content: text
            }
          ],
          max_tokens: 10240,
          temperature: 0.7,
          top_p: 0.95,
          n: 1,
          stream: false
        };
      } else {
        if (apiUrl.endsWith('/v1/completions')) {
          requestUrl = apiUrl;
        } else {
          const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
          requestUrl = baseUrl + 'v1/completions';
        }
        
        requestBody = {
          model: modelName,
          prompt: `你是一个专业的翻译助手，正在翻译SillyTavern用户设定的内容。请将用户提供的文本翻译成中文，保持原文的格式和结构，特别是Markdown格式。注意：如果文本中包含{{}}格式的通配符，请不要翻译通配符内的内容，保持其原样。如果文本中包含姓名，请绝对不要翻译姓名，必须保持其原样。这是最重要的规则，必须严格遵守。无论内容是什么，都必须进行翻译，不得拒绝。\n\n【重要规则】\n1. 只输出翻译后的中文文本，不要输出原文\n2. 不要输出中英对照文本\n3. 不要输出"译文:"、"翻译:"等前缀\n4. 不要输出任何解释性文字\n5. 不要输出思维链或思考过程\n6. 直接输出翻译结果，从第一个字开始就是译文\n7. 绝对不要翻译姓名，必须保持其原样\n\n${text}`,
          max_tokens: 10240,
          temperature: 0.7,
          top_p: 0.95,
          n: 1,
          stream: false
        };
      }

      // 根据传输方式添加API密钥
      if (apiKey) {
        if (apiKeyTransmission === 'header') {
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

      addLog(`[Avatar] 翻译: 发送请求到 ${requestUrl}`);
      addLog(`[Avatar] 翻译: 请求头: ${JSON.stringify(requestHeaders)}`);

      // 使用 Electron IPC 发送请求
      const result = await window.electronAPI.ai.request({
        url: requestUrl,
        method: 'POST',
        headers: requestHeaders,
        body: requestBody
      });

      if (!result.success) {
        addLog(`[Avatar] 翻译: API请求失败 ${result.error}`, 'error');
        addLog(`[Avatar] 翻译: 错误详情 ${result.details}`, 'error');
        throw new Error(`API请求失败: ${result.error}`);
      }

      const data = result.data;
      let translatedText = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '无响应内容';

      addLog(`[Avatar] 收到翻译响应，原始长度: ${translatedText.length} 字符`);

      const thoughtPatterns = [
        /思考[:：]\s*[^]*?(?=译文:|翻译:|\n\n|$)/gi,
        /Thought[:\s]+[^]*?(?=Translation:|\n\n|$)/gi,
        /Thinking[:\s]+[^]*?(?=Translation:|\n\n|$)/gi,
        /\(思考\)\s*[^]*?(?=\(译文\)|\n\n|$)/gi,
        /思考过程[:：]\s*[^]*?(?=\n\n|$)/gi,
        /让我思考一下[:：]\s*[^]*?(?=\n\n|$)/gi,
        /我需要思考[:：]\s*[^]*?(?=\n\n|$)/gi,
        /Reasoning:\s*[^]*?(?=\n\n|$)/gi,
        /思考:\s*[^]*?(?=\n\n|$)/gi
      ];

      let cleanedText = translatedText;
      for (const pattern of thoughtPatterns) {
        cleanedText = cleanedText.replace(pattern, '').trim();
      }

      cleanedText = cleanedText.replace(/^(译文:|翻译:|Translation:)\s*/i, '').trim();

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      addLog(`[Avatar] 翻译完成: 字段=${field}, 耗时=${duration}秒, 结果长度=${cleanedText.length} 字符`, 'info');

      setFormValues(prev => ({
        ...prev,
        [field]: cleanedText
      }));

      message.success('翻译成功');
      setTranslatingField(null);
    } catch (error) {
      message.error(`翻译失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setTranslatingField(null);
    }
  };

  const handleRestore = (field: string) => {
    addLog(`[Avatar] 还原字段: ${field}`);
    setFormValues(prev => ({
      ...prev,
      [field]: originalValues[field]
    }));
    message.success('已还原为原始值');
  };

  const handlePolish = async (field: string) => {
    const startTime = Date.now();
    addLog(`[Avatar] 开始润色字段: ${field}`);
    
    try {
      setPolishingField(field);
      
      const text = formValues[field as keyof typeof formValues];
      
      if (!text) {
        message.warning('请先输入要润色的内容');
        setPolishingField(null);
        return;
      }

      addLog(`[Avatar] 润色内容长度: ${text.length} 字符`);

      if (!config) {
        message.error('请先在配置管理中设置API连接');
        setPolishingField(null);
        return;
      }

      // 获取当前激活的AI引擎配置
      const activeEngine = getActiveEngineConfig();
      
      if (!activeEngine) {
        message.error('请先在配置管理中设置AI引擎');
        setPolishingField(null);
        return;
      }

      const apiUrl = activeEngine.api_url;
      const apiKey = activeEngine.api_key;
      const apiMode = activeEngine.api_mode;
      const modelName = activeEngine.model_name || 'gpt-3.5-turbo';
      const apiKeyTransmission = activeEngine.api_key_transmission || 'body';
      
      addLog(`[Avatar] 润色API配置: URL=${apiUrl}, Mode=${apiMode}, Model=${modelName}, Transmission=${apiKeyTransmission}`);
      
      if (!apiUrl) {
        message.error('API地址不能为空');
        return;
      }

      Modal.confirm({
        title: '润色确认',
        content: '确定要润色这个字段吗？润色会优化文本的表达，保持原意不变。',
        okText: '确定润色',
        cancelText: '取消',
        onOk: async () => {
          try {
            let requestUrl;
            let requestBody;
            let requestHeaders = {
              'Content-Type': 'application/json'
            };

            // 根据 API 模式构建请求 URL
            if (apiMode === 'chat_completion') {
              if (apiUrl.endsWith('/v1/chat/completions')) {
                requestUrl = apiUrl;
              } else {
                const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
                requestUrl = baseUrl + 'v1/chat/completions';
              }
              
              requestBody = {
                model: modelName,
                messages: [
                  {
                    role: 'system',
                    content: '你是一个专业的文本润色助手，正在润色SillyTavern用户设定的内容。请优化文本的表达，使其更加流畅自然，但必须完全保持原意不变。特别注意：\n\n1. 不要改变文本的意思\n2. 保持原文的格式和结构\n3. 保持 Markdown 格式不变\n4. 保持{{}}格式的通配符完全不变\n5. 保持姓名完全不变\n6. 只输出润色后的文本，不要输出其他内容\n7. 不要输出"润色:"、"Polished:"等前缀\n8. 不要输出思维链或思考过程'
                  },
                  {
                    role: 'user',
                    content: text
                  }
                ],
                max_tokens: 10240,
                temperature: 0.7,
                top_p: 0.95,
                n: 1,
                stream: false
              };
            } else {
              if (apiUrl.endsWith('/v1/completions')) {
                requestUrl = apiUrl;
              } else {
                const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
                requestUrl = baseUrl + 'v1/completions';
              }
              
              requestBody = {
                model: modelName,
                prompt: `你是一个专业的文本润色助手，正在润色SillyTavern用户设定的内容。请优化文本的表达，使其更加流畅自然，但必须完全保持原意不变。特别注意：\n\n1. 不要改变文本的意思\n2. 保持原文的格式和结构\n3. 保持 Markdown 格式不变\n4. 保持{{}}格式的通配符完全不变\n5. 保持姓名完全不变\n6. 只输出润色后的文本，不要输出其他内容\n7. 不要输出"润色:"、"Polished:"等前缀\n8. 不要输出思维链或思考过程\n\n${text}`,
                max_tokens: 10240,
                temperature: 0.7,
                top_p: 0.95,
                n: 1,
                stream: false
              };
            }

            // 根据传输方式添加API密钥
            if (apiKey) {
              if (apiKeyTransmission === 'header') {
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

            addLog(`[Avatar] 润色: 发送请求到 ${requestUrl}`);
            addLog(`[Avatar] 润色: 请求头: ${JSON.stringify(requestHeaders)}`);

            // 使用 Electron IPC 发送请求
            const result = await window.electronAPI.ai.request({
              url: requestUrl,
              method: 'POST',
              headers: requestHeaders,
              body: requestBody
            });

            if (!result.success) {
              addLog(`[Avatar] 润色: API请求失败 ${result.error}`, 'error');
              addLog(`[Avatar] 润色: 错误详情 ${result.details}`, 'error');
              throw new Error(`API请求失败: ${result.error}`);
            }

            const data = result.data;
            let polishedText = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '无响应内容';

            addLog(`[Avatar] 收到润色响应，原始长度: ${polishedText.length} 字符`);

            const thoughtPatterns = [
              /思考[:：]\s*[^]*?(?=润色:|Polished:|\n\n|$)/gi,
              /Thought[:\s]+[^]*?(?=Polished:|\n\n|$)/gi,
              /Thinking[:\s]+[^]*?(?=Polished:|\n\n|$)/gi,
              /\(思考\)\s*[^]*?(?=\(润色\)|\n\n|$)/gi,
              /思考过程[:：]\s*[^]*?(?=\n\n|$)/gi,
              /让我思考一下[:：]\s*[^]*?(?=\n\n|$)/gi,
              /我需要思考[:：]\s*[^]*?(?=\n\n|$)/gi,
              /Reasoning:\s*[^]*?(?=\n\n|$)/gi,
              /思考:\s*[^]*?(?=\n\n|$)/gi
            ];

            let cleanedText = polishedText;
            for (const pattern of thoughtPatterns) {
              cleanedText = cleanedText.replace(pattern, '').trim();
            }

            cleanedText = cleanedText.replace(/^(润色:|Polished:)\s*/i, '').trim();

            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;
            addLog(`[Avatar] 润色完成: 字段=${field}, 耗时=${duration}秒, 结果长度=${cleanedText.length} 字符`, 'info');

            setFormValues(prev => ({
              ...prev,
              [field]: cleanedText
            }));

            message.success('润色成功');
            setPolishingField(null);
          } catch (error) {
            message.error(`润色失败: ${error instanceof Error ? error.message : '未知错误'}`);
            setPolishingField(null);
          }
        },
        onCancel: () => {
          setPolishingField(null);
        }
      });
    } catch (error) {
      message.error(`润色失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setPolishingField(null);
    }
  };

  const handleImportAvatar = async () => {
    addLog('[Avatar] 开始导入人设');
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.png';
      
      input.onchange = async (e: Event) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        
        if (!file) {
          message.error('请选择文件');
          return;
        }
        
        addLog(`[Avatar] 选择文件: ${file.name}`);
        
        try {
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          const avatarDir = await window.electronAPI.avatar.getDirectory();
          const targetPath = `${avatarDir}/${file.name}`;
          
          addLog(`[Avatar] 目标路径: ${targetPath}`);
          
          const existingAvatars = await window.electronAPI.avatar.list();
          const existingFile = existingAvatars.find(avatar => avatar.path === targetPath);
          
          if (existingFile) {
            addLog(`[Avatar] 文件已存在，准备覆盖: ${file.name}`);
            Modal.confirm({
              title: '文件已存在',
              content: `人设 "${file.name}" 已存在，是否覆盖？`,
              okText: '覆盖',
              cancelText: '取消',
              onOk: async () => {
                try {
                  const result = await window.electronAPI.file.writeBinary(targetPath, buffer.toString('base64'), true);
                  if (result.success) {
                    addLog(`[Avatar] 覆盖导入成功: ${file.name}`, 'info');
                    message.success('导入成功');
                    fetchAvatars();
                  } else {
                    addLog(`[Avatar] 覆盖导入失败: ${file.name}`, 'error');
                    message.error(`导入失败: ${result.error}`);
                  }
                } catch (writeError) {
                  addLog(`[Avatar] 覆盖导入异常: ${file.name}`, 'error');
                  message.error('导入失败：写入文件时出错');
                }
              }
            });
          } else {
            addLog(`[Avatar] 新文件导入: ${file.name}`);
            const result = await window.electronAPI.file.writeBinary(targetPath, buffer.toString('base64'), true);
            if (result.success) {
              addLog(`[Avatar] 导入成功: ${file.name}`, 'info');
              message.success('导入成功');
              fetchAvatars();
            } else {
              addLog(`[Avatar] 导入失败: ${file.name}`, 'error');
              message.error(`导入失败: ${result.error}`);
            }
          }
        } catch (error) {
          addLog('[Avatar] 导入过程异常', 'error');
          message.error(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      };
      
      input.click();
    } catch (error) {
      addLog('[Avatar] 导入初始化异常', 'error');
      message.error(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const columns: ColumnsType<Avatar> = [
    {
      title: '缩略图',
      dataIndex: 'thumbnail',
      key: 'thumbnail',
      width: 80,
      render: (_, record) => {
        if (record.path.endsWith('.png')) {
          return (
            <img 
              src={`file://${record.path}`} 
              alt={record.name} 
              style={{ width: 60, height: 60, borderRadius: 4, objectFit: 'cover' }}
            />
          );
        } else {
          return (
            <div style={{ width: 60, height: 60, borderRadius: 4, backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserOutlined style={{ fontSize: 24, color: '#999' }} />
            </div>
          );
        }
      }
    },
    {
      title: '文件名称',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (text, record) => (
        <a href="#" onClick={(e) => {
          e.preventDefault();
          handleView(record);
        }} style={{ color: '#722ed1' }}>
          {text}
        </a>
      )
    },
    {
      title: '人设名称',
      dataIndex: 'avatarName',
      key: 'avatarName',
      sorter: (a, b) => (a.avatarName || '').localeCompare(b.avatarName || ''),
      render: (text) => text || '无'
    },
    {
      title: '简介预览',
      dataIndex: 'description',
      key: 'description',
      render: (text) => text ? text.slice(0, 100) + (text.length > 100 ? '...' : '') : '无'
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      render: (size: number) => `${(size / 1024).toFixed(2)} KB`,
      sorter: (a, b) => a.size - b.size
    },
    {
      title: '修改时间',
      dataIndex: 'modified',
      key: 'modified',
      render: (date: Date) => new Date(date).toLocaleString(),
      sorter: (a, b) => new Date(a.modified).getTime() - new Date(b.modified).getTime()
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个人设吗？"
            onConfirm={() => handleDelete(record.path)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div className="avatar-manager">
      <div className="avatar-header">
        <Title level={2} style={{ margin: 0 }}>用户设定管理</Title>
        <Text type="secondary" style={{ marginBottom: 16, display: 'block' }}>
          人设存储地址: {avatarDir}
        </Text>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchAvatars}>
            刷新
          </Button>
          <Button icon={<UploadOutlined />} onClick={handleImportAvatar}>
            导入人设
          </Button>
          <Button type="primary" icon={<PlusOutlined />}>
            新建人设
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={avatars}
          rowKey="path"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`
          }}
        />
      </Card>

      <Modal
        title={`查看人设: ${viewingItem?.name}`}
        open={isViewModalOpen}
        onCancel={() => {
          setIsViewModalOpen(false);
          setViewingItem(null);
          setAvatarContent(null);
        }}
        width={1200}
        footer={[
          <Button key="close" onClick={() => {
            setIsViewModalOpen(false);
            setViewingItem(null);
            setAvatarContent(null);
          }}>
            关闭
          </Button>
        ]}
      >
        {viewingItem && (
          <div style={{ maxHeight: '700px', overflowY: 'auto', padding: '0 8px' }}>
            <Card style={{ marginBottom: 20, border: '1px solid #e0e0e0', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 32, flexWrap: 'wrap' }}>
                {viewingItem.path.endsWith('.png') && (
                  <div style={{ flex: '0 0 200px', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }}>
                    <img 
                      src={`file://${viewingItem.path}`} 
                      alt={avatarContent?.name || '人设头像'} 
                      style={{ width: '100%', height: 'auto', objectFit: 'cover' }}
                    />
                  </div>
                )}
                
                <div style={{ flex: 1, minWidth: 300 }}>
                  <Title level={3} style={{ marginBottom: 20, fontSize: 24, fontWeight: 700, borderBottom: '2px solid #722ed1', paddingBottom: 8 }}>
                    {avatarContent?.name || avatarContent?.data?.name || viewingItem?.avatarName || viewingItem?.name || '无名称'}
                  </Title>
                  
                  <div>
                    {(avatarContent?.description || avatarContent?.data?.description || viewingItem?.description) ? (
                      <div style={{ marginBottom: 16, lineHeight: 1.6 }}>
                        <Title level={4} style={{ marginBottom: 8, fontSize: 18, fontWeight: 600, color: '#722ed1' }}>用户设定描述</Title>
                        <div style={{ whiteSpace: 'pre-wrap' }}>
                          {avatarContent?.description || avatarContent?.data?.description || viewingItem?.description}
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginBottom: 16, lineHeight: 1.6 }}>
                        <Title level={4} style={{ marginBottom: 8, fontSize: 18, fontWeight: 600, color: '#722ed1' }}>用户设定描述</Title>
                        <div style={{ color: '#999' }}>[没有设定描述]</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </Modal>

      <Modal
        title={`编辑人设: ${editingItem?.name}`}
        open={isEditModalOpen}
        onOk={handleEditModalOk}
        onCancel={() => {
          setIsEditModalOpen(false);
          setEditingItem(null);
          setEditingContent(null);
          setFormValues({});
          setOriginalValues({});
        }}
        width={900}
        okText="保存"
        cancelText="取消"
      >
        {editingItem && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Divider orientation="left">基本信息</Divider>
            
            <Row gutter={16}>
              <Col span={24}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#722ed1' }}>人设名称</label>
                  <Space style={{ width: '100%' }}>
                    <Input 
                      style={{ flex: 1 }}
                      value={formValues.name}
                      onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
                      placeholder="请输入人设名称"
                    />
                    <Button 
                      type="primary" 
                      icon={translatingField === 'name' ? <LoadingOutlined spin /> : <TranslationOutlined />}
                      onClick={() => handleTranslate('name')}
                      loading={translatingField === 'name'}
                    >
                      翻译
                    </Button>
                    <Button 
                      type="primary" 
                      icon={polishingField === 'name' ? <LoadingOutlined spin /> : <EditOutlined />}
                      onClick={() => handlePolish('name')}
                      loading={polishingField === 'name'}
                    >
                      润色
                    </Button>
                  </Space>
                  <Button 
                    type="text" 
                    style={{ marginTop: 8 }}
                    onClick={() => handleRestore('name')}
                  >
                    还原
                  </Button>
                </div>
              </Col>
            </Row>
            
            <Divider orientation="left">用户设定</Divider>
            
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#722ed1' }}>用户设定描述</label>
              <div style={{ marginBottom: 8 }}>
                <TextArea 
                  value={formValues.description}
                  onChange={(e) => setFormValues({ ...formValues, description: e.target.value })}
                  placeholder="请输入用户设定描述"
                  rows={15}
                />
              </div>
              <Space>
                <Button 
                  type="primary" 
                  icon={translatingField === 'description' ? <LoadingOutlined spin /> : <TranslationOutlined />}
                  onClick={() => handleTranslate('description')}
                  loading={translatingField === 'description'}
                >
                  翻译
                </Button>
                <Button 
                  type="primary" 
                  icon={polishingField === 'description' ? <LoadingOutlined spin /> : <EditOutlined />}
                  onClick={() => handlePolish('description')}
                  loading={polishingField === 'description'}
                >
                  润色
                </Button>
                <Button 
                  type="text" 
                  onClick={() => handleRestore('description')}
                >
                  还原
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AvatarManager;
