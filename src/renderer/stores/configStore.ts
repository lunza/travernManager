import { create } from 'zustand';
import { AppConfig } from '../config';
import { Persistence } from '../utils/persistence';
import { AppConfig as AppConfigType } from '../types/config';
import { useLogStore } from './logStore';

// 直接从 logStore 获取 addLog 方法
const addLog = (message: string, type: 'error' | 'warn' | 'info' | 'debug' = 'info') => {
  try {
    useLogStore.getState().addLog(message, type);
  } catch (e) {
    // 如果无法获取 logStore，回退到 console
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
      // 先尝试从本地存储读取配置
      const savedConfig = Persistence.loadConfig();
      if (savedConfig) {
        set({ config: savedConfig, loading: false });
        return;
      }
      
      // 如果没有保存的配置，使用默认配置
      const config = AppConfig.defaultConfig as AppConfigType;
      // 保存默认配置到本地存储
      Persistence.saveConfig(config);
      // 保存版本信息
      Persistence.saveVersion(AppConfig.version);
      set({ config, loading: false });
    } catch (error) {
      set({ error: 'Failed to fetch config', loading: false });
    }
  },
  saveConfig: async (config) => {
    return new Promise<void>((resolve, reject) => {
      set({ loading: true, error: null });
      try {
        addLog('开始保存配置', 'info');
        addLog(`配置对象: ${JSON.stringify(config)}`, 'debug');
        
        // 保存配置到本地存储
        const success = Persistence.saveConfig(config);
        addLog(`保存配置结果: ${success}`, 'debug');
        
        if (success) {
          addLog('配置保存成功', 'info');
          set({ config, loading: false });
          resolve();
        } else {
          addLog('保存配置到本地存储失败', 'error');
          const error = new Error('保存配置到本地存储失败');
          set({ error: 'Failed to save config', loading: false });
          reject(error);
        }
      } catch (error) {
        addLog(`保存配置失败: ${error}`, 'error');
        set({ error: 'Failed to save config', loading: false });
        reject(error);
      }
    });
  },
  testConnection: async (config) => {
    set({ loading: true, error: null });
    try {
      // 模拟连接测试
      await new Promise(resolve => setTimeout(resolve, 2000));
      set({ loading: false });
      return true;
    } catch (error) {
      set({ error: 'Connection test failed', loading: false });
      return false;
    }
  },
  applyConfig: async (config) => {
    set({ loading: true, error: null });
    try {
      // 保存配置到本地存储
      const success = Persistence.saveConfig(config);
      if (success) {
        // 模拟应用配置
        await new Promise(resolve => setTimeout(resolve, 1000));
        set({ config, loading: false });
      } else {
        throw new Error('保存配置到本地存储失败');
      }
    } catch (error) {
      set({ error: 'Failed to apply config', loading: false });
    }
  },
  restoreDefault: async () => {
    set({ loading: true, error: null });
    try {
      // 恢复默认配置
      const defaultConfig = AppConfig.defaultConfig as AppConfigType;
      // 保存默认配置到本地存储
      const success = Persistence.saveConfig(defaultConfig);
      if (success) {
        set({ config: defaultConfig, loading: false });
      } else {
        throw new Error('保存默认配置到本地存储失败');
      }
    } catch (error) {
      set({ error: 'Failed to restore default config', loading: false });
    }
  },
  exportConfig: async () => {
    set({ loading: true, error: null });
    try {
      // 模拟导出配置
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
      // 模拟导入配置
      const config = JSON.parse(configString);
      set({ config, loading: false });
    } catch (error) {
      set({ error: 'Failed to import config', loading: false });
    }
  },
  getConfigHistory: async () => {
    set({ loading: true, error: null });
    try {
      // 模拟获取配置历史
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

