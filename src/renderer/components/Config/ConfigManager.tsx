import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Switch, Space, message, Spin, Alert, Tabs, Radio, Divider, Progress, Select, Tooltip, List } from 'antd';

const { Option } = Select;
import { SaveOutlined, ReloadOutlined, CheckCircleOutlined, ExportOutlined, ImportOutlined, SettingOutlined, QuestionCircleOutlined, PlusOutlined, MinusOutlined, EditOutlined } from '@ant-design/icons';

// 简单的转义函数，用于处理{{}}格式的通配符
const escapeBraces = (text: string): string => {
  return text
    .replace(/\{\{/g, "{'{{'}")
    .replace(/\}\}/g, "{'}}'");
};
import { useConfigStore } from '../../stores/configStore';
import { useLogStore } from '../../stores/logStore';
import './ConfigManager.css';

const { TabPane } = Tabs;
const { Password } = Input;

const ConfigManager: React.FC = () => {
  const { config, loading, error, fetchConfig, saveConfig } = useConfigStore();
  const { addLog } = useLogStore();
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('api');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testProgress, setTestProgress] = useState(0);
  const [apiType, setApiType] = useState('openai');
  const [apiMode, setApiMode] = useState('text_completion');
  const [optimizing, setOptimizing] = useState(false);
  const [customOptimizationEnabled, setCustomOptimizationEnabled] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (config) {
      form.setFieldsValue(config);
      // 更新apiMode状态为配置中的实际值
      if (config.api_mode) {
        setApiMode(config.api_mode);
      }
    }
  }, [config, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      // 数据验证
      // 1. 确保配置名称不为空
      if (!values.preset_name) {
        throw new Error('配置名称不能为空');
      }
      
      // 2. 验证prompts数组
      if (values.prompts && Array.isArray(values.prompts)) {
        const validatedPrompts = values.prompts.map((prompt: any) => {
          return {
            identifier: prompt.identifier || '',
            system_prompt: prompt.system_prompt || false,
            role: prompt.role || '',
            name: prompt.name || '',
            content: prompt.content || ''
          };
        });
        values.prompts = validatedPrompts;
      }
      
      // 3. 对数字类型参数进行验证
      const numericFields = [
        'temperature', 'frequency_penalty', 'presence_penalty', 'top_p', 'top_k', 'top_a', 'min_p',
        'repetition_penalty', 'openai_max_context', 'openai_max_tokens', 'names_behavior',
        'seed', 'n'
      ];
      
      numericFields.forEach(field => {
        if (field in values && typeof values[field] === 'string') {
          const numValue = parseFloat(values[field]);
          if (!isNaN(numValue)) {
            values[field] = numValue;
          }
        }
      });
      
      // 4. 对布尔类型参数进行验证
      const booleanFields = [
        'use_sysprompt', 'squash_system_messages', 'media_inlining',
        'continue_prefill', 'names_in_completion', 'streaming'
      ];
      
      booleanFields.forEach(field => {
        if (field in values && typeof values[field] === 'string') {
          values[field] = values[field].toLowerCase() === 'true';
        }
      });
      
      // 输出保存的配置信息
      addLog(`Saving config: ${JSON.stringify(values)}`, 'debug');
      addLog(`API mode: ${values.api_mode}`, 'debug');
      addLog(`开始保存配置，API模式: ${values.api_mode}`, 'info');
      await saveConfig(values);
      addLog('配置保存成功', 'info');
      message.success('配置保存成功');
      
      // 同时应用配置到SillyTavern
      addLog(`开始应用配置到SillyTavern，API模式: ${values.api_mode}`, 'info');
      const result = await window.electronAPI.sillyTavern.updateConfig(values);
      if (result.success) {
        addLog('配置已应用到SillyTavern', 'info');
        message.success('配置已应用到SillyTavern');
      } else {
        addLog(`配置应用失败: ${result.message}`, 'error');
        message.error(`配置应用失败: ${result.message}`);
      }
    } catch (error) {
      addLog(`配置保存失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      message.error(`配置保存失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleReload = () => {
    addLog('重新加载配置...', 'info');
    fetchConfig();
    message.info('配置已重新加载');
    addLog('配置已重新加载', 'info');
  };

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    setTestProgress(0);
    addLog('开始测试连接...', 'info');

    // 模拟连接测试进度
    const interval = setInterval(() => {
      setTestProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    try {
      // 获取API地址和模式
      const values = await form.validateFields();
      const apiUrl = values.api_url;
      const apiMode = values.api_mode;
      const modelName = values.model_name || 'gpt-3.5-turbo';
      
      // 输出API模式，用于调试
      addLog(`当前API模式: ${apiMode}`, 'info');
      addLog(`表单值: ${JSON.stringify(values)}`, 'info');
      
      if (!apiUrl) {
        throw new Error('API地址不能为空');
      }

      // 尝试连接到API服务器
      addLog(`尝试连接到API服务器: ${apiUrl}`, 'info');
      
      // 根据API模式发送测试消息
      let testResponse;
      let requestUrl;
      let requestBody;
      let curlCommand;
      
      if (apiMode === 'text_completion') {
        // 文本补全模式
        requestUrl = apiUrl + '/v1/completions';
        requestBody = {
          model: modelName,
          prompt: '你好',
          max_tokens: 50,
          temperature: 0.7,
          top_p: 0.95,
          n: 1,
          stream: false,
          logprobs: null,
          stop: null
        };
        
        // 构建curl命令
        curlCommand = `curl -X POST "${requestUrl}" \\n  -H "Content-Type: application/json" \\n  -d '${JSON.stringify(requestBody)}'`;
        
        addLog(`发送请求 (文本补全模式):`, 'info');
        addLog(`请求地址: ${requestUrl}`, 'info');
        addLog(`请求参数: ${JSON.stringify(requestBody, null, 2)}`, 'info');
        addLog(`curl命令: ${curlCommand}`, 'info');
        
        testResponse = await fetch(requestUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
          timeout: 10000 // 10秒超时
        });
      } else if (apiMode === 'chat_completion') {
        // 聊天补全模式
        requestUrl = apiUrl + '/v1/chat/completions';
        requestBody = {
          model: modelName,
          messages: [
            {
              role: 'user',
              content: '你好'
            }
          ],
          max_tokens: 50,
          temperature: 0.7,
          top_p: 0.95,
          n: 1,
          stream: false,
          stop: null
        };
        
        // 构建curl命令
        curlCommand = `curl -X POST "${requestUrl}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(requestBody)}'`;
        
        addLog(`发送请求 (聊天补全模式):`, 'info');
        addLog(`请求地址: ${requestUrl}`, 'info');
        addLog(`请求参数: ${JSON.stringify(requestBody, null, 2)}`, 'info');
        addLog(`curl命令: ${curlCommand}`, 'info');
        
        testResponse = await fetch(requestUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
          timeout: 10000 // 10秒超时
        });
      } else {
        // 其他模式，先测试连接
        requestUrl = apiUrl;
        
        // 构建curl命令
        curlCommand = `curl -X GET "${requestUrl}"`;
        
        addLog(`发送请求 (连接测试):`, 'info');
        addLog(`请求地址: ${requestUrl}`, 'info');
        addLog(`curl命令: ${curlCommand}`, 'info');
        
        const connectResponse = await fetch(requestUrl, {
          method: 'GET',
          timeout: 5000 // 5秒超时
        });
        
        if (!connectResponse.ok) {
          throw new Error(`连接失败: ${connectResponse.status} ${connectResponse.statusText}`);
        }
        
        clearInterval(interval);
        setConnectionStatus('success');
        addLog('连接测试成功', 'info');
        message.success('连接测试成功');
        return;
      }

      // 记录响应状态
      addLog(`响应状态: ${testResponse.status} ${testResponse.statusText}`, 'info');
      
      if (testResponse.ok) {
        const data = await testResponse.json();
        addLog(`响应内容: ${JSON.stringify(data, null, 2)}`, 'info');
        
        let responseText;
        if (apiMode === 'text_completion') {
          responseText = data.choices?.[0]?.text || '无响应内容';
        } else if (apiMode === 'chat_completion') {
          responseText = data.choices?.[0]?.message?.content || '无响应内容';
        }
        
        clearInterval(interval);
        setConnectionStatus('success');
        addLog('连接测试成功', 'info');
        addLog(`大模型响应: ${responseText}`, 'info');
        message.success(`连接测试成功\n大模型响应: ${responseText}`);
      } else {
        clearInterval(interval);
        setConnectionStatus('error');
        addLog(`连接测试失败: ${testResponse.status} ${testResponse.statusText}`, 'error');
        message.error(`连接测试失败: ${testResponse.status} ${testResponse.statusText}`);
      }
    } catch (error) {
      clearInterval(interval);
      setConnectionStatus('error');
      addLog(`连接测试失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      message.error(`连接测试失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleApplyConfig = async () => {
    try {
      const values = await form.validateFields();
      addLog('开始应用配置到SillyTavern...', 'info');
      // 调用IPC方法更新SillyTavern配置
      const result = await window.electronAPI.sillyTavern.updateConfig(values);
      if (result.success) {
        addLog('配置已应用到SillyTavern', 'info');
        message.success('配置已应用到SillyTavern');
      } else {
        addLog(`配置应用失败: ${result.message}`, 'error');
        message.error(`配置应用失败: ${result.message}`);
      }
    } catch (error) {
      addLog(`配置应用失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      message.error('配置应用失败');
    }
  };

  const handleApiTypeChange = (e: any) => {
    const type = e.target.value;
    setApiType(type);
    addLog(`切换API类型: ${type}`, 'info');
    
    // 根据API类型设置默认值
    let defaultConfig: any = {
      api_url: '',
      model_name: '',
      api_key: ''
    };

    switch (type) {
      case 'openai':
        defaultConfig = {
          api_url: 'https://api.openai.com/v1',
          model_name: 'gpt-4',
          api_key: ''
        };
        break;
      case 'anthropic':
        defaultConfig = {
          api_url: 'https://api.anthropic.com/v1',
          model_name: 'claude-3-opus-20240229',
          api_key: ''
        };
        break;
      case 'mistral':
        defaultConfig = {
          api_url: 'https://api.mistral.ai/v1',
          model_name: 'mistral-large-latest',
          api_key: ''
        };
        break;
      case 'textgen':
        defaultConfig = {
          api_url: 'http://localhost:5000',
          model_name: 'text-generation-webui',
          api_key: ''
        };
        break;
      case 'ollama':
        defaultConfig = {
          api_url: 'http://localhost:11434',
          model_name: 'llama3',
          api_key: ''
        };
        break;
      case 'lmstudio':
        defaultConfig = {
          api_url: 'http://127.0.0.1:5000',
          model_name: 'qwen3.5-27b-heretic-v3',
          api_key: ''
        };
        break;
      default:
        break;
    }

    form.setFieldsValue(defaultConfig);
    addLog(`已加载 ${type} 默认配置`, 'info');
  };

  const handleExportConfig = () => {
    try {
      addLog('开始导出配置...', 'info');
      
      // 获取当前表单的所有值
      const values = form.getFieldsValue();
      
      // 确保配置包含一些必要的元数据
      const exportData = {
        ...values,
        exportTime: new Date().toISOString(),
        exportVersion: '1.0',
        appName: 'TravenManager'
      };
      
      // 转换为 JSON 字符串
      const jsonString = JSON.stringify(exportData, null, 2);
      
      // 创建 Blob 和下载链接
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      // 生成文件名（使用配置名称或时间戳）
      const configName = values.preset_name || 'travenmanager-config';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `${configName}-${timestamp}.json`;
      
      // 设置下载链接属性
      link.href = url;
      link.download = fileName;
      
      // 触发下载
      document.body.appendChild(link);
      link.click();
      
      // 清理
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      addLog(`配置导出成功: ${fileName}`, 'info');
      message.success('配置导出成功');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      addLog(`配置导出失败: ${errorMessage}`, 'error');
      message.error(`配置导出失败: ${errorMessage}`);
    }
  };

  const handleImportConfig = () => {
    // 创建文件输入元素
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      
      if (!file) {
        message.warning('请选择文件');
        return;
      }
      
      try {
        addLog(`开始导入配置: ${file.name}`, 'info');
        
        // 读取文件内容
        const fileContent = await file.text();
        const importedConfig = JSON.parse(fileContent);
        
        // 确保配置名称存在，如果没有则使用文件名
        if (!importedConfig.preset_name) {
          importedConfig.preset_name = file.name.replace('.json', '');
        }
        
        // 根据当前API模式处理导入的配置文件
        if (apiMode === 'chat_completion') {
          // 当前是聊天补全模式
          addLog('当前为聊天补全模式，处理聊天补全配置', 'info');
          
          // 检查是否是SillyTavern导出的格式
          const isSillyTavernExport = importedConfig.prompts && importedConfig.prompts.length > 0;
          
          if (isSillyTavernExport) {
            addLog('检测到SillyTavern导出格式的配置文件', 'info');
            
            // 从prompts数组中提取提示词
            if (importedConfig.prompts) {
              importedConfig.prompts.forEach((prompt: any) => {
                if (prompt.identifier === 'main' && prompt.content) {
                  importedConfig.main_prompt = prompt.content;
                }
                if (prompt.identifier === 'jailbreak' && prompt.content) {
                  importedConfig.jailbreak_prompt = prompt.content;
                }
              });
            }
          } else {
            addLog('检测到标准格式的聊天补全配置文件', 'info');
            
            // 映射聊天补全模式字段到表单字段
            if ('temperature' in importedConfig) {
              importedConfig.temperature = importedConfig.temperature;
              importedConfig.temp = importedConfig.temperature; // 同时设置temp字段
            }
            if ('frequency_penalty' in importedConfig) {
              importedConfig.freq_pen = importedConfig.frequency_penalty;
            }
            if ('presence_penalty' in importedConfig) {
              importedConfig.presence_pen = importedConfig.presence_penalty;
            }
            if ('repetition_penalty' in importedConfig) {
              importedConfig.rep_pen = importedConfig.repetition_penalty;
            }
            if ('top_p' in importedConfig) {
              importedConfig.top_p = importedConfig.top_p;
            }
            if ('top_k' in importedConfig) {
              importedConfig.top_k = importedConfig.top_k;
            }
            if ('top_a' in importedConfig) {
              importedConfig.top_a = importedConfig.top_a;
            }
            if ('min_p' in importedConfig) {
              importedConfig.min_p = importedConfig.min_p;
            }
            
            // 处理提示词字段
            if ('main_prompt' in importedConfig) {
              importedConfig.main_prompt = importedConfig.main_prompt;
            }
            
            if ('jailbreak_prompt' in importedConfig) {
              importedConfig.jailbreak_prompt = importedConfig.jailbreak_prompt;
            }
            
            // 转换为SillyTavern兼容的prompts格式
            if ('main_prompt' in importedConfig || 'jailbreak_prompt' in importedConfig) {
              addLog('转换提示词格式为SillyTavern兼容格式', 'info');
              
              // 创建prompts数组
              importedConfig.prompts = [
                {
                  "name": "Main Prompt",
                  "system_prompt": true,
                  "role": "system",
                  "content": importedConfig.main_prompt || "",
                  "identifier": "main"
                },
                {
                  "name": "Auxiliary Prompt",
                  "system_prompt": true,
                  "role": "system",
                  "content": "",
                  "identifier": "nsfw"
                },
                {
                  "identifier": "dialogueExamples",
                  "name": "Chat Examples",
                  "system_prompt": true,
                  "marker": true
                },
                {
                  "name": "Post-History Instructions",
                  "system_prompt": true,
                  "role": "system",
                  "content": importedConfig.jailbreak_prompt || "",
                  "identifier": "jailbreak"
                },
                {
                  "identifier": "chatHistory",
                  "name": "Chat History",
                  "system_prompt": true,
                  "marker": true
                },
                {
                  "identifier": "worldInfoAfter",
                  "name": "World Info (after)",
                  "system_prompt": true,
                  "marker": true
                },
                {
                  "identifier": "worldInfoBefore",
                  "name": "World Info (before)",
                  "system_prompt": true,
                  "marker": true
                },
                {
                  "identifier": "enhanceDefinitions",
                  "role": "system",
                  "name": "Enhance Definitions",
                  "content": "If you have more knowledge of {{char}}, add to the character's lore and personality to enhance them but keep the Character Sheet's definitions absolute.",
                  "system_prompt": true,
                  "marker": false
                },
                {
                  "identifier": "charDescription",
                  "name": "Char Description",
                  "system_prompt": true,
                  "marker": true
                },
                {
                  "identifier": "charPersonality",
                  "name": "Char Personality",
                  "system_prompt": true,
                  "marker": true
                },
                {
                  "identifier": "scenario",
                  "name": "Scenario",
                  "system_prompt": true,
                  "marker": true
                },
                {
                  "identifier": "personaDescription",
                  "name": "Persona Description",
                  "system_prompt": true,
                  "marker": true
                }
              ];
            }
          }
          
          // 处理其他通用字段
          if ('impersonation_prompt' in importedConfig) {
            importedConfig.impersonation_prompt = importedConfig.impersonation_prompt;
          }
          
          if ('assistant_prefill' in importedConfig) {
            importedConfig.assistant_prefill = importedConfig.assistant_prefill;
          }
          
          if ('names_in_completion' in importedConfig) {
            importedConfig.names_in_completion = importedConfig.names_in_completion;
          }
          
          if ('names_behavior' in importedConfig) {
            importedConfig.names_behavior = importedConfig.names_behavior;
          }
          
          // 打印调试信息
          addLog(`导入的配置字段: ${Object.keys(importedConfig).join(', ')}`, 'info');
        } else if (apiMode === 'text_completion') {
          // 当前是文本补全模式
          addLog('当前为文本补全模式，处理文本补全配置', 'info');
          
          // 映射文本补全模式字段到表单字段
          if ('temp' in importedConfig) importedConfig.temp = importedConfig.temp;
          if ('freq_pen' in importedConfig) importedConfig.freq_pen = importedConfig.freq_pen;
          if ('presence_pen' in importedConfig) importedConfig.presence_pen = importedConfig.presence_pen;
          if ('rep_pen' in importedConfig) importedConfig.rep_pen = importedConfig.rep_pen;
        }
        
        // 类型转换：将字符串类型的数字转换为数字类型
        const numericFields = [
          'temp', 'temperature', 'top_p', 'top_k', 'top_a', 'tfs', 'epsilon_cutoff', 'eta_cutoff',
          'typical_p', 'min_p', 'rep_pen', 'repetition_penalty', 'rep_pen_range', 'rep_pen_decay',
          'rep_pen_slope', 'no_repeat_ngram_size', 'penalty_alpha', 'num_beams',
          'length_penalty', 'min_length', 'encoder_rep_pen', 'freq_pen', 'frequency_penalty',
          'presence_pen', 'presence_penalty', 'skew', 'min_temp', 'max_temp', 'dynatemp_exponent',
          'smoothing_factor', 'smoothing_curve', 'dry_allowed_length',
          'dry_multiplier', 'dry_base', 'dry_penalty_last_n', 'mirostat_mode',
          'mirostat_tau', 'mirostat_eta', 'guidance_scale', 'xtc_threshold',
          'xtc_probability', 'nsigma', 'min_keep', 'adaptive_target',
          'adaptive_decay', 'rep_pen_size', 'genamt', 'max_length'
        ];
        
        numericFields.forEach(field => {
          if (field in importedConfig && typeof importedConfig[field] === 'string') {
            const numValue = parseFloat(importedConfig[field]);
            if (!isNaN(numValue)) {
              importedConfig[field] = numValue;
            }
          }
        });
        
        // 布尔字段转换
        const booleanFields = [
          'temperature_last', 'do_sample', 'early_stopping', 'dynatemp',
          'add_bos_token', 'ban_eos_token', 'skip_special_tokens',
          'ignore_eos_token', 'spaces_between_special_tokens',
          'speculative_ngram', 'json_schema_allow_empty', 'names_in_completion'
        ];
        
        booleanFields.forEach(field => {
          if (field in importedConfig && typeof importedConfig[field] === 'string') {
            importedConfig[field] = importedConfig[field].toLowerCase() === 'true';
          }
        });
        
        // 将导入的配置回写到表单，只传递表单中已经定义的字段
        const formValues: any = {};
        
        // 配置名称
        if ('preset_name' in importedConfig) formValues.preset_name = importedConfig.preset_name;
        
        // 基础参数
        if ('temperature' in importedConfig) formValues.temperature = importedConfig.temperature;
        if ('frequency_penalty' in importedConfig) formValues.frequency_penalty = importedConfig.frequency_penalty;
        if ('presence_penalty' in importedConfig) formValues.presence_penalty = importedConfig.presence_penalty;
        if ('top_p' in importedConfig) formValues.top_p = importedConfig.top_p;
        if ('top_k' in importedConfig) formValues.top_k = importedConfig.top_k;
        if ('top_a' in importedConfig) formValues.top_a = importedConfig.top_a;
        if ('min_p' in importedConfig) formValues.min_p = importedConfig.min_p;
        if ('repetition_penalty' in importedConfig) formValues.repetition_penalty = importedConfig.repetition_penalty;
        if ('openai_max_context' in importedConfig) formValues.openai_max_context = importedConfig.openai_max_context;
        if ('openai_max_tokens' in importedConfig) formValues.openai_max_tokens = importedConfig.openai_max_tokens;
        if ('names_behavior' in importedConfig) formValues.names_behavior = importedConfig.names_behavior;
        if ('send_if_empty' in importedConfig) formValues.send_if_empty = importedConfig.send_if_empty;
        
        // 聊天相关参数
        if ('assistant_prefill' in importedConfig) formValues.assistant_prefill = importedConfig.assistant_prefill;
        if ('assistant_impersonation' in importedConfig) formValues.assistant_impersonation = importedConfig.assistant_impersonation;
        if ('use_sysprompt' in importedConfig) formValues.use_sysprompt = importedConfig.use_sysprompt;
        if ('squash_system_messages' in importedConfig) formValues.squash_system_messages = importedConfig.squash_system_messages;
        if ('media_inlining' in importedConfig) formValues.media_inlining = importedConfig.media_inlining;
        if ('continue_prefill' in importedConfig) formValues.continue_prefill = importedConfig.continue_prefill;
        if ('continue_postfix' in importedConfig) formValues.continue_postfix = importedConfig.continue_postfix;
        if ('seed' in importedConfig) formValues.seed = importedConfig.seed;
        if ('n' in importedConfig) formValues.n = importedConfig.n;
        
        // 提示词配置
        if ('names_in_completion' in importedConfig) formValues.names_in_completion = importedConfig.names_in_completion;
        if ('main_prompt' in importedConfig) formValues.main_prompt = importedConfig.main_prompt;
        if ('impersonation_prompt' in importedConfig) formValues.impersonation_prompt = importedConfig.impersonation_prompt;
        if ('jailbreak_prompt' in importedConfig) formValues.jailbreak_prompt = importedConfig.jailbreak_prompt;
        
        // 只在聊天补全模式下设置prompts，并且确保prompts是有效的数组
        if (apiMode === 'chat_completion' && 'prompts' in importedConfig && Array.isArray(importedConfig.prompts)) {
          // 检查prompts数组的长度，避免数组过大导致渲染问题
          if (importedConfig.prompts.length > 50) {
            addLog('警告: prompts数组过大，可能会导致渲染问题，已限制为前50项', 'warn');
            formValues.prompts = importedConfig.prompts.slice(0, 50);
          } else {
            // 确保每个prompts项都包含必要的属性
            formValues.prompts = importedConfig.prompts.map((prompt: any) => ({
              identifier: prompt.identifier || `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              system_prompt: prompt.system_prompt || false,
              role: prompt.role || 'system',
              name: prompt.name || 'Unnamed Prompt',
              content: prompt.content || ''
            }));
          }
          addLog(`处理后的prompts数组长度: ${formValues.prompts.length}`, 'info');
        }
        
        // 打印调试信息
        addLog(`回写表单的字段: ${Object.keys(formValues).join(', ')}`, 'info');
        
        form.setFieldsValue(formValues);
        
        addLog('配置导入成功', 'info');
        message.success('配置导入成功，请点击"保存参数"按钮保存配置');
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        addLog(`配置导入失败: ${errorMessage}`, 'error');
        message.error(`配置导入失败: ${errorMessage}`);
      }
    };
    
    input.click();
  };

  const handleOptimizePrompt = async () => {
    try {
      const promptTemplate = form.getFieldValue('prompt_template');
      if (!promptTemplate) {
        message.warning('请先输入提示模板');
        return;
      }

      setOptimizing(true);
      addLog('开始优化提示模板...', 'info');

      // 获取API地址和模型名称
      const values = await form.validateFields();
      const apiUrl = values.api_url;
      const modelName = values.model_name || 'gpt-3.5-turbo';
      
      if (!apiUrl) {
        throw new Error('API地址不能为空');
      }

      // 构建优化提示词
      let optimizationPrompt;
      const customOptimizationPrompt = form.getFieldValue('custom_optimization_prompt');
      
      if (customOptimizationEnabled && customOptimizationPrompt) {
        // 使用自定义优化说明
        optimizationPrompt = customOptimizationPrompt.replace('{{prompt}}', promptTemplate);
        addLog('使用自定义优化说明', 'info');
      } else {
        // 使用默认优化说明
        optimizationPrompt = `# 请按照要求优化以下提示词模板：
${promptTemplate}

# 优化说明
- 增强了任务描述的清晰度，使其更符合SillyTavern的使用场景
- 添加了更明确的格式要求，确保与SillyTavern的用户交互模式匹配
- 优化了指令的逻辑结构，提高了在SillyTavern平台上的性能
- 调整了提示模板的表达方式，使其更符合SillyTavern的最佳实践
- 确保了提示模板与SillyTavern平台的预期用例保持一致`;
        addLog('使用默认优化说明', 'info');
      }

      // 构建请求参数
      const requestUrl = apiUrl + '/v1/completions';
      const requestBody = {
        model: modelName,
        prompt: optimizationPrompt,
        max_tokens: 1000,
        temperature: 0.7,
        top_p: 0.95,
        n: 1,
        stream: false,
        logprobs: null,
        stop: null
      };

      // 构建curl命令
      const curlCommand = `curl -X POST "${requestUrl}" \\n  -H "Content-Type: application/json" \\n  -d '${JSON.stringify(requestBody)}'`;

      // 记录请求信息
      addLog(`发送请求 (提示模板优化):`, 'info');
      addLog(`请求地址: ${requestUrl}`, 'info');
      addLog(`请求参数: ${JSON.stringify(requestBody, null, 2)}`, 'info');
      addLog(`curl命令: ${curlCommand}`, 'info');

      // 发送请求到大模型
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        timeout: 30000 // 30秒超时
      });

      // 记录响应状态
      addLog(`响应状态: ${response.status} ${response.statusText}`, 'info');

      if (response.ok) {
        const data = await response.json();
        addLog(`响应内容: ${JSON.stringify(data, null, 2)}`, 'info');
        
        // 提取优化后的提示词
        let optimizedPrompt = data.choices?.[0]?.text || '无响应内容';
        
        // 检查是否启用思维链模式
        const enableChainOfThought = form.getFieldValue('enable_chain_of_thought') || false;
        
        // 如果未启用思维链模式，去掉思考部分
        if (!enableChainOfThought && optimizedPrompt.toLowerCase().includes('think')) {
          // 找到第一个"think"出现的位置
          const thinkIndex = optimizedPrompt.toLowerCase().indexOf('think');
          // 找到其后的第一个换行或句号
          const endOfThinkIndex = optimizedPrompt.indexOf('\n', thinkIndex);
          if (endOfThinkIndex !== -1) {
            // 去掉思考部分，只保留后面的内容
            optimizedPrompt = optimizedPrompt.substring(endOfThinkIndex).trim();
            addLog('已去掉思考模式的思维链', 'info');
          }
        } else if (enableChainOfThought) {
          addLog('已启用思维链模式，保留思考过程', 'info');
        }
        
        // 更新提示模板输入框
        form.setFieldsValue({ prompt_template: optimizedPrompt });
        addLog('提示模板优化成功', 'info');
        message.success('提示模板优化成功');
      } else {
        throw new Error(`请求失败: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      addLog(`提示模板优化失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      message.error(`提示模板优化失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setOptimizing(false);
    }
  };

  if (loading) {
    return (
      <div className="config-manager loading">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="config-manager">
      <div className="config-header">
        <h2>配置管理</h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleReload}>
            重新加载
          </Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
            保存配置
          </Button>
        </Space>
      </div>

      {error && (
        <Alert
          message="加载失败"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab} 
        className="config-tabs"
        items={[
          {
            key: 'api',
            label: 'API连接配置',
            children: (
              <>
                <Card title="API模式选择" className="api-mode-card">
                  <Form form={form} layout="vertical">
                    <Form.Item 
                      label={
                        <Space>
                          API模式
                          <Tooltip 
                            title={
                              <div>
                                <p><strong>文本补全</strong>：适用于需要续写文本、生成内容的场景，如故事创作、文章写作等。模型会根据输入的提示词生成连续的文本。</p>
                                <p><strong>聊天补全</strong>：适用于对话式交互场景，如客服、问答等。模型会根据对话历史生成符合上下文的回复。</p>
                                <p><strong>NovelAI</strong>：专门用于小说和创意写作的API，提供独特的文本生成能力。</p>
                                <p><strong>AI Horde</strong>：利用分布式AI计算资源的API，支持公共和私有模型，适合需要高并发处理的场景。</p>
                              </div>
                            }
                            placement="top"
                            arrow
                          >
                            <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                          </Tooltip>
                        </Space>
                      } 
                      name="api_mode"
                      rules={[{ required: true, message: '请选择API模式' }]}
                    >
                      <Select
                        value={apiMode}
                        onChange={(value) => {
                          setApiMode(value);
                          form.setFieldsValue({ api_mode: value });
                          // 验证api_mode是否正确更新
                          setTimeout(() => {
                            const currentApiMode = form.getFieldValue('api_mode');
                            addLog(`Current api_mode in form: ${currentApiMode}`, 'debug');
                            addLog(`切换API模式: ${value}, 表单值: ${currentApiMode}`, 'info');
                          }, 100);
                          
                          // 当切换到聊天补全模式时，自动更新模型参数
                          if (value === 'chat_completion') {
                            addLog('切换到聊天补全模式，自动更新模型参数...', 'info');
                            
                            // 聊天补全模式的标准参数
                            const chatCompletionParams = {
                              temperature: 1,
                              freq_pen: 0,
                              presence_pen: 0,
                              top_p: 1,
                              top_k: 0,
                              top_a: 0,
                              min_p: 0,
                              rep_pen: 1,
                              max_tokens: 300,
                              streaming: true,
                              // 其他相关参数
                              rep_pen_range: 0,
                              rep_pen_decay: 0,
                              rep_pen_slope: 1,
                              no_repeat_ngram_size: 0,
                              penalty_alpha: 0,
                              num_beams: 1,
                              length_penalty: 1,
                              min_length: 0,
                              encoder_rep_pen: 1,
                              skew: 0,
                              do_sample: true,
                              early_stopping: false,
                              dynatemp: false,
                              min_temp: 0,
                              max_temp: 2,
                              dynatemp_exponent: 1,
                              smoothing_factor: 0,
                              smoothing_curve: 1,
                              dry_allowed_length: 2,
                              dry_multiplier: 0,
                              dry_base: 1.75,
                              add_bos_token: true,
                              ban_eos_token: false,
                              skip_special_tokens: true,
                              mirostat_mode: 0,
                              mirostat_tau: 5,
                              mirostat_eta: 0.1,
                              guidance_scale: 1,
                              xtc_threshold: 0.1,
                              xtc_probability: 0,
                              nsigma: 0,
                              min_keep: 0,
                              adaptive_target: -0.01,
                              adaptive_decay: 0.9,
                              rep_pen_size: 0,
                              genamt: 350,
                              max_length: 8192
                            };
                            
                            // 获取当前配置名称，保留不变
                            const currentPresetName = form.getFieldValue('preset_name');
                            
                            // 更新模型参数（保留配置名称）
                            form.setFieldsValue({
                              ...chatCompletionParams,
                              preset_name: currentPresetName
                            });
                            
                            addLog('聊天补全模式参数已应用', 'info');
                            message.success('已自动应用聊天补全模式的推荐参数');
                          }
                        }}
                        style={{ width: '100%' }}
                      >
                        <Option value="text_completion">文本补全</Option>
                        <Option value="chat_completion">聊天补全</Option>
                        <Option value="novelai">NovelAI</Option>
                        <Option value="ai_horde">AI Horde</Option>
                      </Select>
                    </Form.Item>
                  </Form>
                </Card>

                <Card title="快速配置模板" className="api-template-card">
                  <Radio.Group onChange={handleApiTypeChange} value={apiType} className="api-type-group">
                    <Space orientation="horizontal" size="middle">
                      <Radio.Button value="openai">OpenAI</Radio.Button>
                      <Radio.Button value="anthropic">Anthropic</Radio.Button>
                      <Radio.Button value="mistral">Mistral</Radio.Button>
                      <Radio.Button value="textgen">TextGen</Radio.Button>
                      <Radio.Button value="ollama">Ollama</Radio.Button>
                      <Radio.Button value="lmstudio">LM Studio</Radio.Button>
                    </Space>
                  </Radio.Group>
                </Card>

                <Card title="连接信息" className="connection-info-card">
                  <Form form={form} layout="vertical">
                    <Form.Item
                      label="API地址"
                      name="api_url"
                      rules={[{ required: true, message: '请输入 API 地址' }]}
                    >
                      <Input placeholder="例如: https://api.openai.com/v1" />
                    </Form.Item>

                    <Form.Item
                      label="API密钥"
                      name="api_key"
                    >
                      <Password placeholder="请输入 API 密钥（可选）" />
                    </Form.Item>

                    <Form.Item
                      label="模型名称"
                      name="model_name"
                      rules={[{ required: true, message: '请输入模型名称' }]}
                    >
                      <Input placeholder="例如: gpt-4" />
                    </Form.Item>
                  </Form>
                </Card>

                <Card title="连接状态" className="connection-status-card">
                  <Space style={{ marginBottom: 16 }}>
                    <Button icon={<CheckCircleOutlined />} onClick={handleTestConnection}>
                      测试连接
                    </Button>
                    <Button type="primary" onClick={handleApplyConfig}>
                      应用配置
                    </Button>
                  </Space>

                  {connectionStatus === 'testing' && (
                    <div style={{ marginBottom: 16 }}>
                      <Progress percent={testProgress} status="active" />
                    </div>
                  )}

                  <div className="status-indicator">
                    <span className={`status-dot ${connectionStatus === 'success' ? 'success' : connectionStatus === 'error' ? 'error' : 'idle'}`}></span>
                    <span className="status-text">
                      {connectionStatus === 'idle' && '未连接'}
                      {connectionStatus === 'testing' && '测试中...'}
                      {connectionStatus === 'success' && '连接成功'}
                      {connectionStatus === 'error' && '连接失败'}
                    </span>
                    <span className="last-test">上次测试: {new Date().toLocaleString()}</span>
                  </div>
                </Card>
              </>
            )
          },
          {
            key: 'model',
            label: '模型参数',
            children: (
              <>
                {/* 文本补全模式显示所有参数 */}
                {apiMode === 'text_completion' && (
                  <>
                    <Card title="预设配置">
                      <Form form={form} layout="vertical">
                        <Form.Item 
                          label="配置名称" 
                          name="preset_name"
                          rules={[{ required: true, message: '请输入配置名称' }]}
                        >
                          <Input placeholder="输入配置名称，将作为预设文件名" />
                        </Form.Item>
                      </Form>
                    </Card>
                    
                    <Card title="基础参数">
                      <Form form={form} layout="vertical">
                        <Form.Item 
                          label={
                            <Space>
                              温度 (temperature)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>作用</strong>：控制token选择的随机性</p>
                                    <p><strong>影响</strong>：值越高，输出越随机、创意性越强；值越低，输出越可预测、保守</p>
                                    <p><strong>建议范围</strong>：0.1-1.0，默认0.7</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="temperature"
                        >
                          <Input type="number" step="0.1" min="0" max="2" placeholder="例如: 0.7" />
                        </Form.Item>

                        <Form.Item 
                          label={
                            <Space>
                              频率惩罚 (freq_pen)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>作用</strong>：惩罚频繁出现的token</p>
                                    <p><strong>影响</strong>：值越高，越抑制重复词汇的使用</p>
                                    <p><strong>建议范围</strong>：-2.0到2.0，默认0</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="freq_pen"
                        >
                          <Input type="number" step="0.1" min="-2.0" max="2.0" placeholder="例如: 0" />
                        </Form.Item>

                        <Form.Item 
                          label={
                            <Space>
                              存在惩罚 (presence_pen)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>作用</strong>：惩罚新token的使用</p>
                                    <p><strong>影响</strong>：值越高，越倾向于使用已存在的token</p>
                                    <p><strong>建议范围</strong>：-2.0到2.0，默认0</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="presence_pen"
                        >
                          <Input type="number" step="0.1" min="-2.0" max="2.0" placeholder="例如: 0" />
                        </Form.Item>

                        <Form.Item 
                          label={
                            <Space>
                              顶级P (top_p)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>作用</strong>：控制token选择的多样性（核采样）</p>
                                    <p><strong>影响</strong>：值越高，考虑的token越多，输出越多样；值越低，只考虑高概率token，输出越集中</p>
                                    <p><strong>建议范围</strong>：0.7-1.0，默认1.0</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="top_p"
                        >
                          <Input type="number" step="0.1" min="0" max="1.0" placeholder="例如: 1.0" />
                        </Form.Item>

                        <Form.Item 
                          label={
                            <Space>
                              顶级K (top_k)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>作用</strong>：限制每次选择的token数量</p>
                                    <p><strong>影响</strong>：值越高，考虑的token越多，输出越多样；值越低，只考虑最可能的token，输出越集中</p>
                                    <p><strong>建议范围</strong>：0-100，默认0（禁用）</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="top_k"
                        >
                          <Input type="number" min="0" placeholder="例如: 0" />
                        </Form.Item>

                        <Form.Item 
                          label={
                            <Space>
                              顶级A (top_a)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>作用</strong>：通过绝对值切断低概率token</p>
                                    <p><strong>影响</strong>：值越高，过滤掉的低概率token越多</p>
                                    <p><strong>建议范围</strong>：0-1.0，默认0（禁用）</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="top_a"
                        >
                          <Input type="number" step="0.1" min="0" max="1.0" placeholder="例如: 0" />
                        </Form.Item>

                        <Form.Item 
                          label={
                            <Space>
                              最小P (min_p)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>作用</strong>：通过相对于最高token切断低概率token来限制token池</p>
                                    <p><strong>影响</strong>：值越高，过滤掉的低概率token越多，输出越连贯但可能更重复</p>
                                    <p><strong>建议范围</strong>：0.01-0.2，默认0.1</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="min_p"
                        >
                          <Input type="number" step="0.01" min="0" max="1.0" placeholder="例如: 0.1" />
                        </Form.Item>

                        <Form.Item 
                          label={
                            <Space>
                              重复惩罚 (rep_pen)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>作用</strong>：惩罚上下文中已出现的token</p>
                                    <p><strong>影响</strong>：值越高，越抑制重复；值越低，允许更多重复</p>
                                    <p><strong>建议范围</strong>：1.0-1.2，默认1.0</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="rep_pen"
                        >
                          <Input type="number" step="0.1" min="0" max="2.0" placeholder="例如: 1.0" />
                        </Form.Item>

                        <Form.Item 
                          label={
                            <Space>
                              重复惩罚范围
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>作用</strong>：从最后生成的token开始，考虑多少个token进行重复惩罚</p>
                                    <p><strong>影响</strong>：值越高，考虑的token越多，但可能破坏回应</p>
                                    <p><strong>建议范围</strong>：0-1024，默认0（禁用）</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="rep_pen_range"
                        >
                          <Input type="number" min="0" placeholder="例如: 0" />
                        </Form.Item>

                        <Form.Item 
                          label={
                            <Space>
                              重复惩罚斜率
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>作用</strong>：控制重复惩罚的强度随距离变化</p>
                                    <p><strong>影响</strong>：值越高，近期token的惩罚越强</p>
                                    <p><strong>建议范围</strong>：0-2.0，默认1.0</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="rep_pen_slope"
                        >
                          <Input type="number" step="0.1" min="0" max="2.0" placeholder="例如: 1.0" />
                        </Form.Item>
                      </Form>
                    </Card>

                    <Card title="高级参数">
                      <Form form={form} layout="vertical">
                        <Form.Item 
                          label={
                            <Space>
                              是否采样
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>作用</strong>：控制是否使用采样策略</p>
                                    <p><strong>影响</strong>：开启时使用随机采样；关闭时使用贪婪解码（总是选择概率最高的token）</p>
                                    <p><strong>建议</strong>：开启以获得更多样化的输出</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="do_sample" 
                          valuePropName="checked"
                        >
                          <Switch />
                        </Form.Item>

                        <Form.Item 
                          label={
                            <Space>
                              早停
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>作用</strong>：控制束搜索的早停策略</p>
                                    <p><strong>影响</strong>：开启时，当遇到EOS token时停止生成</p>
                                    <p><strong>建议</strong>：根据需要开启</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="early_stopping" 
                          valuePropName="checked"
                        >
                          <Switch />
                        </Form.Item>

                        <Form.Item 
                          label={
                            <Space>
                              束搜索宽度
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>作用</strong>：控制束搜索的宽度</p>
                                    <p><strong>影响</strong>：值越高，生成质量可能越好，但计算成本也越高</p>
                                    <p><strong>建议范围</strong>：1-5，默认1（禁用束搜索）</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="num_beams"
                        >
                          <Input type="number" min="1" placeholder="例如: 1" />
                        </Form.Item>

                        <Form.Item 
                          label={
                            <Space>
                              长度惩罚
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>作用</strong>：控制生成长度的惩罚</p>
                                    <p><strong>影响</strong>：值大于1时鼓励更长的输出；值小于1时鼓励更短的输出</p>
                                    <p><strong>建议范围</strong>：0.5-2.0，默认1.0</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="length_penalty"
                        >
                          <Input type="number" step="0.1" min="0" max="2.0" placeholder="例如: 1.0" />
                        </Form.Item>
                      </Form>
                    </Card>
                  </>
                )}
                
                {/* 聊天补全模式显示详细参数 */}
                {apiMode === 'chat_completion' && (
                  <>
                    <Card title="预设配置">
                      <Form form={form} layout="vertical">
                        <Form.Item 
                          label="配置名称" 
                          name="preset_name"
                          rules={[{ required: true, message: '请输入配置名称' }]}
                        >
                          <Input placeholder="输入配置名称，将作为预设文件名" />
                        </Form.Item>
                      </Form>
                    </Card>
                    
                    <Card title="基础参数">
                      <Form form={form} layout="vertical">
                        <Form.Item 
                          label={
                            <Space>
                              温度 (temperature)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>功能</strong>：控制token选择的随机性</p>
                                    <p><strong>影响</strong>：值越高，输出越随机、创意性越强；值越低，输出越可预测、保守</p>
                                    <p><strong>建议范围</strong>：0.1-1.0，默认1.0</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="temperature"
                        >
                          <Input type="number" step="0.1" min="0" max="2" placeholder="例如: 1" />
                        </Form.Item>
                        <Form.Item 
                          label={
                            <Space>
                              频率惩罚 (frequency_penalty)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>功能</strong>：惩罚频繁出现的token</p>
                                    <p><strong>影响</strong>：值越高，越抑制重复词汇的使用</p>
                                    <p><strong>建议范围</strong>：-2.0到2.0，默认0</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="frequency_penalty"
                        >
                          <Input type="number" step="0.1" min="-2.0" max="2.0" placeholder="例如: 0" />
                        </Form.Item>
                        <Form.Item 
                          label={
                            <Space>
                              存在惩罚 (presence_penalty)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>功能</strong>：惩罚新token的使用</p>
                                    <p><strong>影响</strong>：值越高，越倾向于使用已存在的token</p>
                                    <p><strong>建议范围</strong>：-2.0到2.0，默认0</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="presence_penalty"
                        >
                          <Input type="number" step="0.1" min="-2.0" max="2.0" placeholder="例如: 0" />
                        </Form.Item>
                        <Form.Item 
                          label={
                            <Space>
                              顶级P (top_p)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>功能</strong>：控制token选择的多样性（核采样）</p>
                                    <p><strong>影响</strong>：值越高，考虑的token越多，输出越多样；值越低，只考虑高概率token，输出越集中</p>
                                    <p><strong>建议范围</strong>：0.7-1.0，默认1.0</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="top_p"
                        >
                          <Input type="number" step="0.1" min="0" max="1.0" placeholder="例如: 1" />
                        </Form.Item>
                        <Form.Item 
                          label={
                            <Space>
                              顶级K (top_k)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>功能</strong>：限制每次选择的token数量</p>
                                    <p><strong>影响</strong>：值越高，考虑的token越多，输出越多样；值越低，只考虑最可能的token，输出越集中</p>
                                    <p><strong>建议范围</strong>：0-100，默认0（禁用）</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="top_k"
                        >
                          <Input type="number" min="0" placeholder="例如: 0" />
                        </Form.Item>
                        <Form.Item 
                          label={
                            <Space>
                              顶级A (top_a)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>功能</strong>：通过绝对值切断低概率token</p>
                                    <p><strong>影响</strong>：值越高，过滤掉的低概率token越多</p>
                                    <p><strong>建议范围</strong>：0-1.0，默认0（禁用）</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="top_a"
                        >
                          <Input type="number" step="0.1" min="0" max="1.0" placeholder="例如: 0" />
                        </Form.Item>
                        <Form.Item 
                          label={
                            <Space>
                              最小P (min_p)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>功能</strong>：通过相对于最高token切断低概率token来限制token池</p>
                                    <p><strong>影响</strong>：值越高，过滤掉的低概率token越多，输出越连贯但可能更重复</p>
                                    <p><strong>建议范围</strong>：0.01-0.2，默认0</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="min_p"
                        >
                          <Input type="number" step="0.01" min="0" max="1.0" placeholder="例如: 0" />
                        </Form.Item>
                        <Form.Item 
                          label={
                            <Space>
                              重复惩罚 (repetition_penalty)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>功能</strong>：惩罚上下文中已出现的token</p>
                                    <p><strong>影响</strong>：值越高，越抑制重复；值越低，允许更多重复</p>
                                    <p><strong>建议范围</strong>：1.0-1.2，默认1.0</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="repetition_penalty"
                        >
                          <Input type="number" step="0.1" min="0" max="2.0" placeholder="例如: 1" />
                        </Form.Item>
                        <Form.Item 
                          label={
                            <Space>
                              OpenAI最大上下文 (openai_max_context)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>功能</strong>：设置OpenAI模型的最大上下文长度</p>
                                    <p><strong>影响</strong>：值越大，模型可以处理的上下文越长，但可能会增加API调用成本</p>
                                    <p><strong>建议值</strong>：根据模型类型设置，默认4095</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="openai_max_context"
                        >
                          <Input type="number" placeholder="例如: 4095" />
                        </Form.Item>
                        <Form.Item 
                          label={
                            <Space>
                              OpenAI最大Token数 (openai_max_tokens)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>功能</strong>：设置OpenAI模型的最大生成Token数</p>
                                    <p><strong>影响</strong>：值越大，生成的内容越长，但可能会增加API调用成本</p>
                                    <p><strong>建议值</strong>：根据需要设置，默认300</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="openai_max_tokens"
                        >
                          <Input type="number" placeholder="例如: 300" />
                        </Form.Item>
                        <Form.Item 
                          label={
                            <Space>
                              名称行为 (names_behavior)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>功能</strong>：控制名称在生成内容中的行为</p>
                                    <p><strong>影响</strong>：不同的值会影响名称的处理方式</p>
                                    <p><strong>建议值</strong>：0-1，默认0</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="names_behavior"
                        >
                          <Input type="number" placeholder="例如: 0" />
                        </Form.Item>
                        <Form.Item 
                          label={
                            <Space>
                              空发送内容 (send_if_empty)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>功能</strong>：当用户输入为空时发送的内容</p>
                                    <p><strong>影响</strong>：设置用户空输入时的默认行为</p>
                                    <p><strong>建议值</strong>：根据需要设置，默认空字符串</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="send_if_empty"
                        >
                          <Input placeholder="例如: " />
                        </Form.Item>
                      </Form>
                    </Card>
                    
                    <Card title="聊天相关参数">
                      <Form form={form} layout="vertical">
                        <Form.Item 
                          label={
                            <Space>
                              助手预填充 (assistant_prefill)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>功能</strong>：助手回复的预填充内容</p>
                                    <p><strong>影响</strong>：设置助手回复的初始内容</p>
                                    <p><strong>建议值</strong>：根据需要设置，默认空字符串</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="assistant_prefill"
                        >
                          <Input placeholder="例如: " />
                        </Form.Item>
                        <Form.Item 
                          label={
                            <Space>
                              助手模拟 (assistant_impersonation)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>功能</strong>：助手模拟用户的内容</p>
                                    <p><strong>影响</strong>：设置助手如何模拟用户的风格和语气</p>
                                    <p><strong>建议值</strong>：根据需要设置，默认空字符串</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="assistant_impersonation"
                        >
                          <Input placeholder="例如: " />
                        </Form.Item>
                        <Form.Item 
                          label={
                            <Space>
                              使用系统提示 (use_sysprompt)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>功能</strong>：控制是否使用系统提示</p>
                                    <p><strong>影响</strong>：开启时使用系统提示，关闭时不使用</p>
                                    <p><strong>建议值</strong>：根据需要设置，默认false</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="use_sysprompt" 
                          valuePropName="checked"
                        >
                          <Switch />
                        </Form.Item>
                        <Form.Item 
                          label={
                            <Space>
                              压缩系统消息 (squash_system_messages)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>功能</strong>：控制是否压缩系统消息</p>
                                    <p><strong>影响</strong>：开启时压缩系统消息，减少上下文长度</p>
                                    <p><strong>建议值</strong>：根据需要设置，默认false</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="squash_system_messages" 
                          valuePropName="checked"
                        >
                          <Switch />
                        </Form.Item>
                        <Form.Item 
                          label={
                            <Space>
                              媒体内联 (media_inlining)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>功能</strong>：控制是否启用媒体内联</p>
                                    <p><strong>影响</strong>：开启时支持媒体内容内联显示</p>
                                    <p><strong>建议值</strong>：根据需要设置，默认true</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="media_inlining" 
                          valuePropName="checked"
                        >
                          <Switch />
                        </Form.Item>
                        <Form.Item 
                          label={
                            <Space>
                              继续预填充 (continue_prefill)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>功能</strong>：控制是否启用继续预填充</p>
                                    <p><strong>影响</strong>：开启时在继续生成时使用预填充内容</p>
                                    <p><strong>建议值</strong>：根据需要设置，默认false</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="continue_prefill" 
                          valuePropName="checked"
                        >
                          <Switch />
                        </Form.Item>
                        <Form.Item 
                          label={
                            <Space>
                              继续后缀 (continue_postfix)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>功能</strong>：继续生成时添加的后缀</p>
                                    <p><strong>影响</strong>：设置继续生成时的后缀内容</p>
                                    <p><strong>建议值</strong>：根据需要设置，默认" "</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="continue_postfix"
                        >
                          <Input placeholder="例如:  " />
                        </Form.Item>
                        <Form.Item 
                          label={
                            <Space>
                              种子 (seed)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>功能</strong>：设置随机种子</p>
                                    <p><strong>影响</strong>：相同的种子会产生相同的输出，-1表示随机种子</p>
                                    <p><strong>建议值</strong>：-1或特定数字，默认-1</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="seed"
                        >
                          <Input type="number" placeholder="例如: -1" />
                        </Form.Item>
                        <Form.Item 
                          label={
                            <Space>
                              生成数量 (n)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>功能</strong>：设置生成的回复数量</p>
                                    <p><strong>影响</strong>：值越大，生成的回复越多，但可能会增加API调用成本</p>
                                    <p><strong>建议值</strong>：1-5，默认1</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="n"
                        >
                          <Input type="number" placeholder="例如: 1" />
                        </Form.Item>
                      </Form>
                    </Card>
                    
                    <Card title="提示词配置">
                      <Form form={form} layout="vertical">
                        <Form.Item 
                          label={
                            <Space>
                              名称在补全中 (names_in_completion)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>功能</strong>：控制是否在补全中包含名称</p>
                                    <p><strong>影响</strong>：开启时在生成内容中包含角色名称</p>
                                    <p><strong>建议值</strong>：根据需要设置，默认true</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="names_in_completion" 
                          valuePropName="checked"
                        >
                          <Switch />
                        </Form.Item>
                        <Form.Item 
                          label={
                            <Space>
                              主提示 (main_prompt)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>功能</strong>：设置主提示内容</p>
                                    <p><strong>影响</strong>：控制模型的整体行为和角色定位</p>
                                    <p><strong>建议值</strong>：根据需要设置，默认空字符串</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="main_prompt"
                        >
                          <Input.TextArea rows={3} placeholder="输入主提示" />
                        </Form.Item>
                        <Form.Item 
                          label={
                            <Space>
                              模拟提示 (impersonation_prompt)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>功能</strong>：设置模拟提示内容</p>
                                    <p><strong>影响</strong>：控制模型如何模拟用户的风格和语气</p>
                                    <p><strong>建议值</strong>：根据需要设置，默认空字符串</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="impersonation_prompt"
                        >
                          <Input.TextArea rows={3} placeholder="输入模拟提示" />
                        </Form.Item>
                        <Form.Item 
                          label={
                            <Space>
                              越狱提示 (jailbreak_prompt)
                              <Tooltip 
                                title={
                                  <div>
                                    <p><strong>功能</strong>：设置越狱提示内容</p>
                                    <p><strong>影响</strong>：控制模型突破限制的能力</p>
                                    <p><strong>建议值</strong>：根据需要设置，默认空字符串</p>
                                  </div>
                                }
                                placement="top"
                                arrow
                              >
                                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          } 
                          name="jailbreak_prompt"
                        >
                          <Input.TextArea rows={3} placeholder="输入越狱提示" />
                        </Form.Item>

                        {/* Prompts数组管理 */}
                        <Form.Item label="Prompts" name="prompts">
                          <div>
                            <Button 
                              type="primary" 
                              icon={<PlusOutlined />} 
                              onClick={() => {
                                const prompts = form.getFieldValue('prompts') || [];
                                const newPrompt = {
                                  identifier: `prompt_${Date.now()}`,
                                  system_prompt: false,
                                  role: 'system',
                                  name: 'New Prompt',
                                  content: ''
                                };
                                form.setFieldsValue({ prompts: [...prompts, newPrompt] });
                              }}
                              style={{ marginBottom: 16 }}
                            >
                              添加Prompt
                            </Button>
                            <List
                              bordered
                              dataSource={form.getFieldValue('prompts') || []}
                              renderItem={(item: any, index: number) => {
                                // 确保item是一个对象，并且包含必要的属性
                                if (!item || typeof item !== 'object') {
                                  return null;
                                }
                                
                                const identifier = item.identifier || 'unknown';
                                const systemPrompt = item.system_prompt || false;
                                const role = item.role || 'system';
                                const name = item.name || 'Unnamed Prompt';
                                const content = item.content || '';
                                
                                return (
                                  <List.Item
                                    actions={[
                                      <Button 
                                        key="edit" 
                                        icon={<EditOutlined />} 
                                        onClick={() => {
                                          // 这里可以添加编辑逻辑
                                          message.info('编辑功能开发中');
                                        }}
                                      >
                                        编辑
                                      </Button>,
                                      <Button 
                                        key="delete" 
                                        danger 
                                        icon={<MinusOutlined />} 
                                        onClick={() => {
                                          const prompts = form.getFieldValue('prompts') || [];
                                          prompts.splice(index, 1);
                                          form.setFieldsValue({ prompts });
                                        }}
                                      >
                                        删除
                                      </Button>
                                    ]}
                                  >
                                    <List.Item.Meta
                                      title={name}
                                      description={
                                        <div>
                                          <p>Identifier: {identifier}</p>
                                          <p>System Prompt: {systemPrompt ? 'Yes' : 'No'}</p>
                                          <p>Role: {role}</p>
                                          <p>Content: {escapeBraces(content.substring(0, 100))}{content.length > 100 ? '...' : ''}</p>
                                        </div>
                                      }
                                    />
                                  </List.Item>
                                );
                              }}
                            />
                          </div>
                        </Form.Item>
                      </Form>
                    </Card>
                  </>
                )}

                <Space style={{ marginTop: 16 }}>
                  <Button type="primary" onClick={handleSave}>
                    保存参数
                  </Button>
                  <Button onClick={handleApplyConfig}>
                    应用参数
                  </Button>
                </Space>
              </>
            )
          },
          {
            key: 'advanced',
            label: '高级设置',
            children: (
              <>
                <Card title="连接设置">
                  <Form form={form} layout="vertical">
                    <Form.Item label="自动连接到上次的服务器" name="auto_connect" valuePropName="checked">
                      <Switch />
                    </Form.Item>

                    <Form.Item label="跳过状态检查" name="skip_status_check" valuePropName="checked">
                      <Switch />
                    </Form.Item>

                    <Form.Item label="启用代理" name="use_proxy" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                  </Form>
                </Card>

                <Card title="代理设置 (可选)">
                  <Form form={form} layout="vertical">
                    <Form.Item label="代理地址" name="proxy_url">
                      <Input placeholder="例如: http://localhost:7890" />
                    </Form.Item>

                    <Form.Item label="代理端口" name="proxy_port">
                      <Input type="number" placeholder="例如: 7890" />
                    </Form.Item>
                  </Form>
                </Card>

                <Card title="安全设置">
                  <Form form={form} layout="vertical">
                    <Form.Item label="加密存储API密钥" name="encrypt_api_key" valuePropName="checked">
                      <Switch />
                    </Form.Item>

                    <Form.Item label="启用访问控制" name="enable_access_control" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                  </Form>
                </Card>

                <Space style={{ marginTop: 16 }}>
                  <Button type="primary" onClick={handleSave}>
                    保存设置
                  </Button>
                  <Button onClick={handleApplyConfig}>
                    应用设置
                  </Button>
                </Space>
              </>
            )
          },
          {
            key: 'templates',
            label: '模板管理',
            children: (
              <>
                <Card title="预设模板">
                  <div className="template-list">
                    <div className="template-item">OpenAI GPT-4</div>
                    <div className="template-item">Anthropic Claude 3</div>
                    <div className="template-item">Mistral Mistral Large</div>
                    <div className="template-item">TextGen WebUI</div>
                    <div className="template-item">Ollama Local Model</div>
                    <div className="template-item">LM Studio Local Model</div>
                  </div>
                </Card>

                <Card title="自定义模板">
                  <div className="custom-template-list">
                    <div className="custom-template-item">
                      <span>My OpenAI Config</span>
                      <Space>
                        <Button size="small">使用</Button>
                        <Button size="small">编辑</Button>
                        <Button size="small" danger>删除</Button>
                      </Space>
                    </div>
                    <div className="custom-template-item">
                      <span>My Claude Config</span>
                      <Space>
                        <Button size="small">使用</Button>
                        <Button size="small">编辑</Button>
                        <Button size="small" danger>删除</Button>
                      </Space>
                    </div>
                  </div>

                  <Space style={{ marginTop: 16 }}>
                    <Button type="primary">新建模板</Button>
                    <Button>导入模板</Button>
                    <Button>导出模板</Button>
                  </Space>
                </Card>
              </>
            )
          }
        ]}
      />

      <Divider />

      <Space className="bottom-actions">
        <Button icon={<ExportOutlined />} onClick={handleExportConfig} type="primary">
          导出配置
        </Button>
        <Button icon={<ImportOutlined />} onClick={handleImportConfig}>
          导入配置
        </Button>
      </Space>
    </div>
  );
};

export default ConfigManager;
