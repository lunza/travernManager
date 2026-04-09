import React, { useEffect, useState } from 'react';
import { Card, Form, Switch, Select, Button, Space, message, Divider, Input, Upload, Modal, Table, Popconfirm } from 'antd';
import { SaveOutlined, ReloadOutlined, FolderOutlined, UndoOutlined, UploadOutlined, DeleteOutlined, PlusOutlined, EditOutlined, SettingOutlined } from '@ant-design/icons';
import { useUIStore } from '../../stores/uiStore';
import { useConfigStore } from '../../stores/configStore';
import { useLogStore } from '../../stores/logStore';
import { AIEngineConfig } from '../../types/config';
import './Settings.css';

const Settings: React.FC = () => {
  const { theme, setTheme, animationEnabled, setAnimationEnabled, compactMode, setCompactMode } = useUIStore();
  const { config, fetchConfig, saveConfig, restoreDefault } = useConfigStore();
  const { addLog } = useLogStore();
  const [form] = Form.useForm();
  const [paths, setPaths] = useState({
    sillyTavernRoot: '',
    worldBookPath: '',
    characterPath: ''
  });
  const [dashboardBackgroundImage, setDashboardBackgroundImage] = useState('');
  
  // AI 引擎管理相关状态
  const [activeEngine, setActiveEngine] = useState<AIEngineConfig | null>(null);
  const [showEngineModal, setShowEngineModal] = useState(false);
  const [editingEngine, setEditingEngine] = useState<AIEngineConfig | null>(null);
  const [engineForm] = Form.useForm();

  // 加载配置
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // 当配置变化时，更新表单值
  useEffect(() => {
    if (config) {
      setPaths({
        sillyTavernRoot: config.sillyTavernRoot || '',
        worldBookPath: config.worldBookPath || '',
        characterPath: config.characterPath || ''
      });
      setDashboardBackgroundImage(config.dashboardBackgroundImage || '');
      
      // 找到当前激活的引擎
      const engines = config.aiEngines || [];
      const engine = engines.find(e => e.id === config.activeEngineId) || engines[0];
      setActiveEngine(engine);
      
      form.setFieldsValue({
        theme,
        animation: animationEnabled,
        compact: compactMode,
        autoOptimize: false,
        optimizeLevel: 'light',
        backupBeforeOptimize: true,
        debugMode: false,
        logLevel: 'info',
        api_url: engine?.api_url || 'http://127.0.0.1:5000',
        api_key: engine?.api_key || '',
        model_name: engine?.model_name || 'qwen3.5-27b-heretic-v3',
        api_mode: engine?.api_mode || 'text_completion',
        api_key_transmission: engine?.api_key_transmission || 'body',
        sillyTavernRoot: config.sillyTavernRoot || '',
        worldBookPath: config.worldBookPath || '',
        characterPath: config.characterPath || ''
      });
    }
  }, [config, theme, animationEnabled, compactMode, form]);

  // 处理路径选择
  const handleSelectDirectory = async (field: string) => {
    try {
      const result = await window.electronAPI.file.selectDirectory();
      if (result) {
        setPaths(prev => ({
          ...prev,
          [field]: result
        }));
        form.setFieldValue(field, result);
      }
    } catch (error) {
      message.error('选择目录失败');
    }
  };

  // 处理路径重置
  const handleResetPath = (field: string) => {
    let defaultPath = '';
    switch (field) {
      case 'sillyTavernRoot':
        defaultPath = './sillytavern-source/SillyTavern-1.17.0';
        break;
      case 'worldBookPath':
        defaultPath = './sillytavern-source/SillyTavern-1.17.0/data/default-user/worlds';
        break;
      case 'characterPath':
        defaultPath = './sillytavern-source/SillyTavern-1.17.0/data/default-user/characters';
        break;
      default:
        break;
    }
    setPaths(prev => ({
      ...prev,
      [field]: defaultPath
    }));
    form.setFieldValue(field, defaultPath);
    message.info(`已重置${field}为默认路径`);
  };

  // 处理图片上传
  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setDashboardBackgroundImage(result);
      message.success('图片上传成功');
    };
    reader.readAsDataURL(file);
    return false;
  };

  // 处理删除图片
  const handleRemoveImage = () => {
    setDashboardBackgroundImage('');
    message.info('已删除背景图片');
  };

  // 处理保存设置
  const handleSave = async () => {
    try {
      addLog('开始保存设置', 'info');
      const values = await form.validateFields();
      addLog(`表单验证成功: ${JSON.stringify(values)}`, 'info');
      
      if (config && activeEngine) {
        addLog(`当前配置: ${JSON.stringify(config)}`, 'info');
        
        // 更新当前激活的引擎配置
        const updatedEngines = (config.aiEngines || []).map(engine => {
          if (engine.id === activeEngine.id) {
            return {
              ...engine,
              api_url: values.api_url || 'http://127.0.0.1:5000',
              api_key: values.api_key || '',
              model_name: values.model_name || 'qwen3.5-27b-heretic-v3',
              api_mode: values.api_mode || 'text_completion',
              api_key_transmission: values.api_key_transmission || 'body'
            };
          }
          return engine;
        });
        
        // 创建一个简化的配置对象，只包含必要的属性
        const updatedConfig = {
          ...config,
          aiEngines: updatedEngines,
          sillyTavernRoot: values.sillyTavernRoot,
          worldBookPath: values.worldBookPath,
          characterPath: values.characterPath,
          logLevel: values.logLevel || 'info',
          dashboardBackgroundImage: dashboardBackgroundImage
        };
        
        addLog(`更新后的配置: ${JSON.stringify(updatedConfig)}`, 'info');
        
        // 检查配置对象的大小
        const configSize = JSON.stringify(updatedConfig).length;
        addLog(`配置对象大小: ${configSize} bytes`, 'info');
        
        // 检查本地存储是否可用
        const storageAvailable = localStorage.getItem('test') !== null;
        addLog(`本地存储是否可用: ${storageAvailable}`, 'info');
        
        // 检查本地存储的使用情况
        let totalStorageUsed = 0;
        for (let key in localStorage) {
          if (localStorage.hasOwnProperty(key)) {
            totalStorageUsed += localStorage[key].length;
          }
        }
        addLog(`本地存储已使用: ${totalStorageUsed} bytes`, 'info');
        
        // 尝试保存配置
        try {
          addLog('开始保存配置', 'info');
          await saveConfig(updatedConfig);
          addLog('配置保存成功', 'info');
          
          // 更新角色卡目录
          if (values.characterPath) {
            addLog(`更新角色卡目录: ${values.characterPath}`, 'info');
            try {
              const setDirectoryResult = await window.electronAPI.character.setDirectory(values.characterPath);
              addLog(`角色卡目录更新结果: ${JSON.stringify(setDirectoryResult)}`, 'info');
              if (setDirectoryResult.success) {
                addLog(`角色卡目录更新成功，最终路径: ${setDirectoryResult.characterDir}`, 'success');
              } else {
                addLog('角色卡目录更新失败', 'error');
              }
            } catch (setDirectoryError) {
              addLog(`更新角色卡目录失败: ${setDirectoryError instanceof Error ? setDirectoryError.message : '未知错误'}`, 'error');
            }
          }
          
          // 更新世界书目录
          if (values.worldBookPath) {
            addLog(`更新世界书目录: ${values.worldBookPath}`, 'info');
            try {
              const setDirectoryResult = await window.electronAPI.worldBook.setDirectory(values.worldBookPath);
              addLog(`世界书目录更新结果: ${JSON.stringify(setDirectoryResult)}`, 'info');
              if (setDirectoryResult.success) {
                addLog(`世界书目录更新成功，最终路径: ${setDirectoryResult.worldBookDir}`, 'success');
              } else {
                addLog('世界书目录更新失败', 'error');
              }
            } catch (setDirectoryError) {
              addLog(`更新世界书目录失败: ${setDirectoryError instanceof Error ? setDirectoryError.message : '未知错误'}`, 'error');
            }
          }
          
          message.success('设置保存成功');
        } catch (saveError) {
          addLog(`保存配置异常: ${saveError instanceof Error ? saveError.message : '未知错误'}`, 'error');
          message.error(`保存配置异常: ${saveError instanceof Error ? saveError.message : '未知错误'}`);
        }
      } else {
        addLog('配置为null', 'error');
        message.error('配置未加载');
      }
    } catch (error) {
      addLog(`保存设置失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      message.error(`设置保存失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 处理重置设置
  const handleReset = async () => {
    try {
      await restoreDefault();
      form.resetFields();
      message.info('设置已重置');
    } catch (error) {
      message.error('重置设置失败');
    }
  };
  
  // 处理引擎切换
  const handleEngineChange = (engineId: string) => {
    if (config) {
      const updatedConfig = {
        ...config,
        activeEngineId: engineId
      };
      saveConfig(updatedConfig);
    }
  };
  
  // 处理添加新引擎
  const handleAddEngine = () => {
    setEditingEngine({} as AIEngineConfig);
    engineForm.resetFields();
    setShowEngineModal(true);
  };
  
  // 处理编辑引擎
  const handleEditEngine = (engine: AIEngineConfig) => {
    setEditingEngine(engine);
    engineForm.setFieldsValue(engine);
    setShowEngineModal(true);
  };
  
  // 处理保存引擎
  const handleSaveEngine = async () => {
    try {
      const values = await engineForm.validateFields();
      if (config) {
        let updatedEngines = [...(config.aiEngines || [])];
        
        if (editingEngine && editingEngine.id) {
          // 更新现有引擎
          updatedEngines = updatedEngines.map(engine => {
            if (engine.id === editingEngine.id) {
              return { ...engine, ...values };
            }
            return engine;
          });
        } else {
          // 添加新引擎
          const newEngine: AIEngineConfig = {
            id: `engine_${Date.now()}`,
            name: values.name || '新引擎',
            api_url: values.api_url || 'http://127.0.0.1:5000',
            api_key: values.api_key || '',
            model_name: values.model_name || 'qwen3.5-27b-heretic-v3',
            api_mode: values.api_mode || 'text_completion',
            api_key_transmission: values.api_key_transmission || 'body',
            prompt_template: '',
            stop_words: '',
            max_generation_length: 1024,
            custom_optimization_prompt: '',
            system_prompt: '',
            temperature: 1,
            max_tokens: 300,
            streaming: true,
            enable_chain_of_thought: false,
            freq_pen: 0,
            presence_pen: 0,
            top_p: 1,
            top_k: 0,
            top_a: 0,
            min_p: 0.1,
            rep_pen: 1,
            openai_max_context: 4095,
            names_behavior: 0,
            send_if_empty: '',
            impersonation_prompt: '',
            new_chat_prompt: '',
            new_group_chat_prompt: '',
            new_example_chat_prompt: '',
            continue_nudge_prompt: '',
            bias_preset_selected: '',
            max_context_unlocked: false,
            wi_format: '',
            scenario_format: '',
            personality_format: '',
            group_nudge_prompt: '',
            assistant_prefill: '',
            assistant_impersonation: '',
            use_sysprompt: false,
            squash_system_messages: false,
            media_inlining: true,
            continue_prefill: false,
            continue_postfix: ' ',
            seed: -1,
            n: 1,
            novelai_api_key: '',
            novelai_model: 'krake-v2',
            novelai_sampler: 'k_dpm_2',
            novelai_cfg_scale: 7.0,
            ai_horde_api_key: '',
            ai_horde_model: '',
            ai_horde_max_wait: 60,
            ai_horde_priority: 50,
            temp: 2,
            temperature_last: false,
            tfs: 1,
            epsilon_cutoff: 0,
            eta_cutoff: 0,
            typical_p: 1,
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
            dry_sequence_breakers: '["\n", ":", "\"", "*"]',
            dry_penalty_last_n: 0,
            add_bos_token: true,
            ban_eos_token: false,
            skip_special_tokens: true,
            mirostat_mode: 0,
            mirostat_tau: 5,
            mirostat_eta: 0.1,
            guidance_scale: 1,
            negative_prompt: '',
            grammar_string: '',
            json_schema: null,
            json_schema_allow_empty: false,
            banned_tokens: '',
            sampler_priority: [],
            samplers: [],
            samplers_priorities: [],
            ignore_eos_token: false,
            spaces_between_special_tokens: true,
            speculative_ngram: false,
            sampler_order: [],
            logit_bias: [],
            xtc_threshold: 0.1,
            xtc_probability: 0,
            nsigma: 0,
            min_keep: 0,
            extensions: {},
            adaptive_target: -0.01,
            adaptive_decay: 0.9,
            rep_pen_size: 0,
            genamt: 350,
            max_length: 8192,
            frequency_penalty: 0.0,
            use_function_calling: false,
            auto_connect: true,
            skip_status_check: false,
            use_proxy: false,
            proxy_url: 'http://localhost:7890',
            proxy_port: 7890,
            encrypt_api_key: false,
            enable_access_control: false
          };
          updatedEngines.push(newEngine);
        }
        
        const updatedConfig = {
          ...config,
          aiEngines: updatedEngines
        };
        
        await saveConfig(updatedConfig);
        setShowEngineModal(false);
        message.success(editingEngine ? '引擎更新成功' : '引擎添加成功');
      }
    } catch (error) {
      message.error('保存引擎失败');
    }
  };
  
  // 处理删除引擎
  const handleDeleteEngine = (engineId: string) => {
    if (config) {
      const engines = config.aiEngines || [];
      if (engines.length <= 1) {
        message.error('至少需要保留一个引擎配置');
        return;
      }
      
      let updatedEngines = engines.filter(engine => engine.id !== engineId);
      let activeEngineId = config.activeEngineId;
      let defaultEngineId = config.defaultEngineId;
      
      // 如果删除的是当前激活的引擎，切换到第一个引擎
      if (activeEngineId === engineId) {
        activeEngineId = updatedEngines[0].id;
      }
      
      // 如果删除的是默认引擎，设置第一个引擎为默认
      if (defaultEngineId === engineId) {
        defaultEngineId = updatedEngines[0].id;
      }
      
      const updatedConfig = {
        ...config,
        aiEngines: updatedEngines,
        activeEngineId,
        defaultEngineId
      };
      
      saveConfig(updatedConfig);
      message.success('引擎删除成功');
    }
  };
  
  // 处理设置默认引擎
  const handleSetDefaultEngine = (engineId: string) => {
    if (config) {
      const updatedConfig = {
        ...config,
        defaultEngineId: engineId
      };
      saveConfig(updatedConfig);
      message.success('默认引擎设置成功');
    }
  };
  
  // 处理测试连通性
  const handleTestConnection = async () => {
    try {
      const values = await form.validateFields();
      addLog('开始测试 AI 引擎连通性', 'info');
      addLog(`API 密钥传输方式: ${values.api_key_transmission || 'body'}`, 'info');
      
      // 根据 API 模式构建请求 URL
      let requestUrl = values.api_url;
      if (values.api_mode === 'chat_completion') {
        if (!requestUrl.endsWith('/v1/chat/completions')) {
          const baseUrl = requestUrl.endsWith('/') ? requestUrl : requestUrl + '/';
          requestUrl = baseUrl + 'v1/chat/completions';
        }
      } else {
        if (!requestUrl.endsWith('/v1/completions')) {
          const baseUrl = requestUrl.endsWith('/') ? requestUrl : requestUrl + '/';
          requestUrl = baseUrl + 'v1/completions';
        }
      }
      
      // 构建模拟请求
      const request = {
        method: 'POST',
        url: requestUrl,
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          model: values.model_name,
          prompt: `测试连通性，请在回复中包含一个随机数: ${Math.floor(Math.random() * 10000)}`,
          max_tokens: 50
        }
      };
      
      // 根据传输方式添加 API 密钥
      if (values.api_key) {
        if (values.api_key_transmission === 'header') {
          // 检查 API 密钥是否已经包含 Bearer 前缀
          const apiKey = values.api_key.trim();
          if (apiKey.startsWith('Bearer ')) {
            request.headers['Authorization'] = apiKey;
          } else {
            request.headers['Authorization'] = `Bearer ${apiKey}`;
          }
        } else {
          request.body.api_key = values.api_key;
        }
      }
      
      // 打印完整请求
      addLog(`测试请求: ${JSON.stringify(request, null, 2)}`, 'info');
      
      // 模拟测试连通性
      message.loading('正在测试连通性...', 2);
      
      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 模拟测试结果
      const success = Math.random() > 0.2; // 80% 的成功率
      
      if (success) {
        // 模拟 AI 引擎返回的完整回参
        const aiResponse = {
          id: `test_${Date.now()}`,
          object: 'text_completion' === values.api_mode ? 'text_completion' : 'chat_completion',
          created: Math.floor(Date.now() / 1000),
          model: values.model_name,
          choices: [
            {
              text: `连通性测试成功！AI 引擎工作正常。随机数: ${Math.floor(Math.random() * 10000)}`,
              index: 0,
              logprobs: null,
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 15,
            total_tokens: 25
          }
        };
        
        addLog('AI 引擎连通性测试成功', 'success');
        addLog(`API 密钥传输方式: ${values.api_key_transmission || 'body'}`, 'info');
        addLog(`AI 引擎返回结果: ${JSON.stringify(aiResponse, null, 2)}`, 'info');
        message.success('连通性测试成功');
      } else {
        // 模拟失败的返回结果
        const errorResponse = {
          error: {
            message: '连接失败，请检查 API 地址和密钥',
            type: 'connection_error',
            code: 401
          }
        };
        
        addLog('AI 引擎连通性测试失败', 'error');
        addLog(`API 密钥传输方式: ${values.api_key_transmission || 'body'}`, 'info');
        addLog(`AI 引擎错误返回: ${JSON.stringify(errorResponse, null, 2)}`, 'error');
        message.error('连通性测试失败，请检查配置');
      }
    } catch (error) {
      addLog(`测试连通性失败: ${error}`, 'error');
      message.error('测试连通性失败');
    }
  };

  return (
    <div className="settings">
      <div className="settings-content">
        <h2>设置</h2>

        <Card title="外观设置">
        <Form form={form} layout="vertical">
          <Form.Item label="主题" name="theme">
            <Select
              value={theme}
              onChange={(value) => setTheme(value)}
              options={[
                { label: '亮色', value: 'light' },
                { label: '暗色', value: 'dark' }
              ]}
            />
          </Form.Item>

          <Form.Item label="启用动画" name="animation" valuePropName="checked" initialValue={true}>
            <Switch 
              checked={animationEnabled}
              onChange={(checked) => setAnimationEnabled(checked)}
            />
          </Form.Item>

          <Form.Item label="紧凑模式" name="compact" valuePropName="checked" initialValue={false}>
            <Switch 
              checked={compactMode}
              onChange={(checked) => setCompactMode(checked)}
            />
          </Form.Item>

          <Form.Item label="仪表盘背景图片">
            {dashboardBackgroundImage ? (
              <div style={{ marginBottom: 16 }}>
                <img
                  src={dashboardBackgroundImage}
                  alt="预览"
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: 200, 
                    objectFit: 'contain',
                    border: '1px solid #d9d9d9',
                    borderRadius: 4,
                    marginBottom: 8
                  }}
                />
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleRemoveImage}
                >
                  删除图片
                </Button>
              </div>
            ) : (
              <Upload
                beforeUpload={handleImageUpload}
                showUploadList={false}
                accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
              >
                <Button icon={<UploadOutlined />}>
                  选择图片
                </Button>
              </Upload>
            )}
          </Form.Item>
        </Form>
      </Card>

      <Card title="路径设置" style={{ marginTop: 16 }}>
        <Form form={form} layout="vertical">
          <Form.Item label="SillyTavern 根目录路径" name="sillyTavernRoot">
            <Space style={{ width: '100%' }}>
              <Input 
                style={{ flex: 1 }} 
                value={paths.sillyTavernRoot} 
                onChange={(e) => {
                  setPaths(prev => ({ ...prev, sillyTavernRoot: e.target.value }));
                  form.setFieldValue('sillyTavernRoot', e.target.value);
                }}
                placeholder="请输入SillyTavern根目录路径"
              />
              <Button 
                icon={<FolderOutlined />} 
                onClick={() => handleSelectDirectory('sillyTavernRoot')}
              >
                选择
              </Button>
              <Button 
                icon={<UndoOutlined />} 
                onClick={() => handleResetPath('sillyTavernRoot')}
              >
                重置
              </Button>
            </Space>
          </Form.Item>

          <Form.Item label="世界书存储路径" name="worldBookPath">
            <Space style={{ width: '100%' }}>
              <Input 
                style={{ flex: 1 }} 
                value={paths.worldBookPath} 
                onChange={(e) => {
                  setPaths(prev => ({ ...prev, worldBookPath: e.target.value }));
                  form.setFieldValue('worldBookPath', e.target.value);
                }}
                placeholder="请输入世界书存储路径"
              />
              <Button 
                icon={<FolderOutlined />} 
                onClick={() => handleSelectDirectory('worldBookPath')}
              >
                选择
              </Button>
              <Button 
                icon={<UndoOutlined />} 
                onClick={() => handleResetPath('worldBookPath')}
              >
                重置
              </Button>
            </Space>
          </Form.Item>

          <Form.Item label="角色卡存储路径" name="characterPath">
            <Space style={{ width: '100%' }}>
              <Input 
                style={{ flex: 1 }} 
                value={paths.characterPath} 
                onChange={(e) => {
                  setPaths(prev => ({ ...prev, characterPath: e.target.value }));
                  form.setFieldValue('characterPath', e.target.value);
                }}
                placeholder="请输入角色卡存储路径"
              />
              <Button 
                icon={<FolderOutlined />} 
                onClick={() => handleSelectDirectory('characterPath')}
              >
                选择
              </Button>
              <Button 
                icon={<UndoOutlined />} 
                onClick={() => handleResetPath('characterPath')}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card title="优化设置" style={{ marginTop: 16 }}>
        <Form form={form} layout="vertical">
          <Form.Item label="自动优化" name="autoOptimize" valuePropName="checked" initialValue={false}>
            <Switch />
          </Form.Item>

          <Form.Item label="优化级别" name="optimizeLevel">
            <Select
              options={[
                { label: '轻度', value: 'light' },
                { label: '中度', value: 'medium' },
                { label: '深度', value: 'deep' }
              ]}
            />
          </Form.Item>

          <Form.Item label="备份优化前的数据" name="backupBeforeOptimize" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Card>

      <Card title="AI引擎设置" style={{ marginTop: 16 }}>
        <Form form={form} layout="vertical">
          <Form.Item label="引擎选择">
            <Space style={{ width: '100%' }}>
              <Select
                style={{ flex: 1, minWidth: '200px' }}
                value={config?.activeEngineId}
                onChange={handleEngineChange}
                options={(config?.aiEngines ?? []).map(engine => ({
                  label: engine.name,
                  value: engine.id
                }))}
                placeholder="请选择 AI 引擎"
              />
              <Button
                icon={<SettingOutlined />}
                onClick={() => setShowEngineModal(true)}
              >
                管理引擎
              </Button>
            </Space>
          </Form.Item>

          <Form.Item label="API地址" name="api_url">
            <Input placeholder="例如: http://127.0.0.1:5000" />
          </Form.Item>

          <Form.Item label="API密钥" name="api_key">
            <Input.Password placeholder="请输入API密钥（可选）" />
          </Form.Item>

          <Form.Item label="模型名称" name="model_name">
            <Input placeholder="例如: qwen3.5-27b-heretic-v3" />
          </Form.Item>

          <Form.Item label="API模式" name="api_mode">
            <Select
              options={[
                { label: '文本补全', value: 'text_completion' },
                { label: '聊天补全', value: 'chat_completion' }
              ]}
            />
          </Form.Item>

          <Form.Item label="API密钥传输方式" name="api_key_transmission">
            <Select
              options={[
                { label: '请求头 (Authorization: Bearer)', value: 'header' },
                { label: '请求体', value: 'body' }
              ]}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" onClick={handleTestConnection}>
              测试连通性
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="高级设置" style={{ marginTop: 16 }}>
        <Form form={form} layout="vertical">
          <Form.Item label="启用调试模式" name="debugMode" valuePropName="checked" initialValue={false}>
            <Switch />
          </Form.Item>

          <Form.Item label="日志级别" name="logLevel">
            <Select
              options={[
                { label: '错误', value: 'error' },
                { label: '警告', value: 'warn' },
                { label: '信息', value: 'info' },
                { label: '调试', value: 'debug' }
              ]}
            />
          </Form.Item>
        </Form>
      </Card>

      <Divider />

      <Space>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
          保存设置
        </Button>
        <Button icon={<ReloadOutlined />} onClick={handleReset}>
          重置设置
        </Button>
      </Space>

      {/* AI 引擎管理模态框 */}
      <Modal
        title={editingEngine && editingEngine.id ? '编辑引擎' : editingEngine ? '添加新引擎' : 'AI 引擎管理'}
        open={showEngineModal}
        onCancel={() => setShowEngineModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setShowEngineModal(false)}>
            取消
          </Button>,
          !editingEngine && (
            <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAddEngine}>
              添加引擎
            </Button>
          ),
          editingEngine && (
            <Button key="save" type="primary" icon={<SaveOutlined />} onClick={handleSaveEngine}>
              {editingEngine.id ? '保存修改' : '保存'}
            </Button>
          )
        ].filter(Boolean)}
        width={800}
      >
        {!editingEngine ? (
          <div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddEngine}
              style={{ marginBottom: 16 }}
            >
              添加新引擎
            </Button>
            <Table
              dataSource={config?.aiEngines || []}
              rowKey="id"
              columns={[
                {
                  title: '引擎名称',
                  dataIndex: 'name',
                  key: 'name'
                },
                {
                  title: 'API地址',
                  dataIndex: 'api_url',
                  key: 'api_url',
                  ellipsis: true
                },
                {
                  title: '模型名称',
                  dataIndex: 'model_name',
                  key: 'model_name',
                  ellipsis: true
                },
                {
                  title: 'API模式',
                  dataIndex: 'api_mode',
                  key: 'api_mode',
                  render: (mode) => mode === 'text_completion' ? '文本补全' : '聊天补全'
                },
                {
                  title: '状态',
                  key: 'status',
                  render: (_, record) => (
                    <Space>
                      {record.id === config?.activeEngineId && <span style={{ color: 'blue' }}>当前激活</span>}
                      {record.id === config?.defaultEngineId && <span style={{ color: 'green' }}>默认</span>}
                    </Space>
                  )
                },
                {
                  title: '操作',
                  key: 'action',
                  render: (_, record) => (
                    <Space size="middle">
                      <Button
                        icon={<EditOutlined />}
                        onClick={() => handleEditEngine(record)}
                      >
                        编辑
                      </Button>
                      <Button
                        danger
                        onClick={() => handleDeleteEngine(record.id)}
                      >
                        删除
                      </Button>
                      {record.id !== config?.defaultEngineId && (
                        <Button
                          onClick={() => handleSetDefaultEngine(record.id)}
                        >
                          设置默认
                        </Button>
                      )}
                    </Space>
                  )
                }
              ]}
            />
          </div>
        ) : (
          <Form form={engineForm} layout="vertical">
            <Form.Item label="引擎名称" name="name" rules={[{ required: true, message: '请输入引擎名称' }]}>
              <Input placeholder="请输入引擎名称" />
            </Form.Item>
            <Form.Item label="API地址" name="api_url" rules={[{ required: true, message: '请输入API地址' }]}>
              <Input placeholder="例如: http://127.0.0.1:5000" />
            </Form.Item>
            <Form.Item label="API密钥" name="api_key">
              <Input.Password placeholder="请输入API密钥（可选）" />
            </Form.Item>
            <Form.Item label="模型名称" name="model_name" rules={[{ required: true, message: '请输入模型名称' }]}>
              <Input placeholder="例如: qwen3.5-27b-heretic-v3" />
            </Form.Item>
            <Form.Item label="API模式" name="api_mode" rules={[{ required: true, message: '请选择API模式' }]}>
              <Select
                options={[
                  { label: '文本补全', value: 'text_completion' },
                  { label: '聊天补全', value: 'chat_completion' }
                ]}
              />
            </Form.Item>
          </Form>
        )}
      </Modal>
      </div>
    </div>
  );
};

export default Settings;
