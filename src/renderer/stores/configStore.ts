import { create } from 'zustand';
import { AppConfig } from '../config';
import { AppConfig as AppConfigType } from '../types/config';
import { useLogStore } from './logStore';

// 直接从 logStore 获取 addLog 方法
const addLog = (message: string, type: 'error' | 'warn' | 'info' | 'debug' = 'info') => {
  try {
    useLogStore.getState().addLog(message, type);
  } catch (e) {
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
};

interface ConfigState {
  config: AppConfigType | null;
  loading: boolean;
  error: string | null;
  setConfig: (config: AppConfigType) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  fetchConfig: () => Promise<void>;
  saveConfig: (config: AppConfigType) => Promise<void>;
  testConnection: (config: AppConfigType) => Promise<boolean>;
  applyConfig: (config: AppConfigType) => Promise<void>;
  restoreDefault: () => Promise<void>;
  exportConfig: () => Promise<string>;
  importConfig: (config: string) => Promise<void>;
  getConfigHistory: () => Promise<any[]>;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: null,
  loading: false,
  error: null,
  setConfig: (config) => set({ config }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  fetchConfig: async () => {
    set({ loading: true, error: null });
    try {
      addLog('开始从主进程加载配置', 'info');

      // 使用 IPC 从主进程加载配置
      const result = await window.electronAPI.config.load();
      addLog(`配置加载结果: ${JSON.stringify(result)}`, 'debug');

      if (result.success && result.config) {
        addLog('配置加载成功', 'info');
        set({ config: result.config, loading: false });
        return;
      }

      // 如果没有保存的配置，使用默认配置
      addLog('没有找到保存的配置，使用默认配置', 'info');
      const defaultConfig = AppConfig.defaultConfig as AppConfigType;

      // 保存默认配置到主进程
      const saveResult = await window.electronAPI.config.save(defaultConfig);
      addLog(`保存默认配置结果: ${saveResult.success}`, 'debug');

      set({ config: defaultConfig, loading: false });
    } catch (error) {
      addLog(`加载配置失败: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      set({ error: 'Failed to fetch config', loading: false });
    }
  },
  saveConfig: async (config) => {
    set({ loading: true, error: null });
    try {
      addLog('开始保存配置到主进程', 'info');
      addLog(`配置对象: ${JSON.stringify(config)}`, 'debug');

      // 使用 IPC 保存配置到主进程
      const result = await window.electronAPI.config.save(config);
      addLog(`保存配置结果: ${result.success}`, 'debug');

      if (result.success) {
        addLog('配置保存成功', 'info');
        set({ config, loading: false });
      } else {
        addLog('保存配置失败', 'error');
        set({ error: 'Failed to save config', loading: false });
        throw new Error('保存配置失败');
      }
    } catch (error) {
      addLog(`保存配置失败: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      set({ error: 'Failed to save config', loading: false });
      throw error;
    }
  },
  testConnection: async (config) => {
    set({ loading: true, error: null });
    try {
      // 获取当前激活的AI引擎
      let activeEngine = null;
      if (config.aiEngines && config.activeEngineId) {
        activeEngine = config.aiEngines.find(engine => engine.id === config.activeEngineId);
      } else if (config.aiEngines && config.aiEngines.length > 0) {
        activeEngine = config.aiEngines[0];
      }

      if (!activeEngine || !activeEngine.api_url) {
        set({ error: '请先配置AI引擎API地址', loading: false });
        return false;
      }

      // 构建测试请求URL
      let testUrl;
      const apiUrl = activeEngine.api_url;
      const apiMode = activeEngine.api_mode || 'chat_completion';

      if (apiMode === 'chat_completion') {
        if (apiUrl.endsWith('/v1/chat/completions')) {
          testUrl = apiUrl;
        } else {
          const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
          testUrl = baseUrl + 'v1/chat/completions';
        }
      } else {
        if (apiUrl.endsWith('/v1/completions')) {
          testUrl = apiUrl;
        } else {
          const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
          testUrl = baseUrl + 'v1/completions';
        }
      }

      // 构建测试请求
      const testRequest = {
        url: testUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: apiMode === 'chat_completion' ? {
          model: activeEngine.model_name || 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: '你是一个测试助手'
            },
            {
              role: 'user',
              content: '测试连接'
            }
          ],
          max_tokens: 1,
          temperature: 0.7
        } : {
          model: activeEngine.model_name || 'gpt-3.5-turbo',
          prompt: '测试连接',
          max_tokens: 1,
          temperature: 0.7
        },
        timeout: 5000
      };

      // 添加API密钥
      if (activeEngine.api_key) {
        const apiKeyTransmission = activeEngine.api_key_transmission || 'body';
        if (apiKeyTransmission === 'header') {
          // 检查 API 密钥是否已经包含 Bearer 前缀
          const trimmedApiKey = activeEngine.api_key.trim();
          if (trimmedApiKey.startsWith('Bearer ')) {
            testRequest.headers['Authorization'] = trimmedApiKey;
          } else {
            testRequest.headers['Authorization'] = `Bearer ${trimmedApiKey}`;
          }
        } else {
          testRequest.body.api_key = activeEngine.api_key;
        }
      }

      // 发送测试请求
      const result = await window.electronAPI.ai.request(testRequest);
      
      set({ loading: false });
      return result.success;
    } catch (error) {
      set({ error: 'Connection test failed', loading: false });
      return false;
    }
  },
  applyConfig: async (config) => {
    set({ loading: true, error: null });
    try {
      const result = await window.electronAPI.config.save(config);
      if (result.success) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        set({ config, loading: false });
      } else {
        throw new Error('保存配置失败');
      }
    } catch (error) {
      set({ error: 'Failed to apply config', loading: false });
    }
  },
  restoreDefault: async () => {
    set({ loading: true, error: null });
    try {
      const defaultConfig = AppConfig.defaultConfig as AppConfigType;
      const result = await window.electronAPI.config.save(defaultConfig);
      if (result.success) {
        set({ config: defaultConfig, loading: false });
      } else {
        throw new Error('保存默认配置失败');
      }
    } catch (error) {
      set({ error: 'Failed to restore default config', loading: false });
    }
  },
  exportConfig: async () => {
    set({ loading: true, error: null });
    try {
      const config = get().config;
      set({ loading: false });
      return JSON.stringify(config, null, 2);
    } catch (error) {
      set({ error: 'Failed to export config', loading: false });
      return '';
    }
  },
  importConfig: async (configString) => {
    set({ loading: true, error: null });
    try {
      const config = JSON.parse(configString);
      set({ config, loading: false });
    } catch (error) {
      set({ error: 'Failed to import config', loading: false });
    }
  },
  getConfigHistory: async () => {
    set({ loading: true, error: null });
    try {
      const history = [
        {
          id: 1,
          timestamp: new Date().toISOString(),
          config: get().config,
          description: 'Current config'
        }
      ];
      set({ loading: false });
      return history;
    } catch (error) {
      set({ error: 'Failed to get config history', loading: false });
      return [];
    }
  }
}));
