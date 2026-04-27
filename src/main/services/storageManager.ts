/**
 * 存储管理器 - 使用 electron-store 实现
 */

import Store from 'electron-store';
import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import {
  StorageModule,
  StorageOperation,
  StoragePermission,
  MODULE_PATH_MAP,
  LEGACY_KEY_TO_MODULE,
  DEFAULT_PERMISSIONS,
  StorageResult,
  Metadata,
  CURRENT_VERSION
} from './storage.types';

export class StorageManager {
  private stores: Map<StorageModule, Store>;
  private permissions: Record<StorageModule, StoragePermission>;
  private logCallback?: (message: string, type: 'error' | 'warn' | 'info' | 'debug', context?: any) => void;

  constructor(logCallback?: (message: string, type: 'error' | 'warn' | 'info' | 'debug', context?: any) => void) {
    this.stores = new Map();
    this.permissions = { ...DEFAULT_PERMISSIONS };
    this.logCallback = logCallback;
    this.initializeStores();
  }

  /**
   * 记录日志
   */
  private log(message: string, type: 'error' | 'warn' | 'info' | 'debug' = 'info', context?: any) {
    if (this.logCallback) {
      this.logCallback(message, type, context);
    } else {
      // 如果没有回调，使用 console
      switch (type) {
        case 'error':
          if (context) {
            console.error(`[StorageManager] ${message}`, context);
          } else {
            console.error(`[StorageManager] ${message}`);
          }
          break;
        case 'warn':
          if (context) {
            console.warn(`[StorageManager] ${message}`, context);
          } else {
            console.warn(`[StorageManager] ${message}`);
          }
          break;
        case 'info':
          if (context) {
            console.info(`[StorageManager] ${message}`, context);
          } else {
            console.info(`[StorageManager] ${message}`);
          }
          break;
        case 'debug':
          if (context) {
            console.debug(`[StorageManager] ${message}`, context);
          } else {
            console.debug(`[StorageManager] ${message}`);
          }
          break;
      }
    }
  }

  /**
   * 初始化各个模块的 Store 实例
   */
  private initializeStores(): void {
    // 为每个模块创建独立的 Store 实例
    const modules = Object.values(StorageModule);
    const appDataPath = app.getPath('appData');
    // 确保使用正确的应用目录
    const appDirPath = path.join(appDataPath, 'traven-manager');
    
    // 创建应用目录（如果不存在）
    if (!fs.existsSync(appDirPath)) {
      fs.mkdirSync(appDirPath, { recursive: true });
    }
    
    this.log(`AppData 路径: ${appDataPath}`, 'info');
    this.log(`应用存储路径: ${appDirPath}`, 'info');
    
    modules.forEach(module => {
      const store = new Store({
        name: `travenmanager-${module}`,
        clearInvalidConfig: true,
        // 确保使用正确的 app name
        cwd: appDirPath
      });
      this.stores.set(module, store);
      this.log(`初始化 Store: ${module} - 路径: ${store.path}`, 'info');
      this.log(`Store 初始化成功: ${module}, 路径: ${store.path}`, 'info');
    });
  }

  /**
   * 验证权限
   */
  private hasPermission(module: StorageModule, operation: StorageOperation): boolean {
    const permission = this.permissions[module];
    if (!permission) return false;
    return permission.operations.includes(operation);
  }

  /**
   * 从键名推断模块
   */
  private inferFromKey(key: string): { module: StorageModule; storeKey: string } {
    // 首先检查是否是旧的存储键
    const legacyMapping = LEGACY_KEY_TO_MODULE[key];
    if (legacyMapping) {
      return {
        module: legacyMapping.module,
        storeKey: key
      };
    }

    // 检查是否是编辑器内容
    if (key.includes('markdown_content') || key.endsWith('_content')) {
      return {
        module: StorageModule.EDITOR,
        storeKey: key
      };
    }

    // 默认作为配置处理
    return {
      module: StorageModule.CONFIG,
      storeKey: key
    };
  }

  /**
   * 获取数据
   */
  get<T>(key: string): StorageResult<T> {
    try {
      const { module, storeKey } = this.inferFromKey(key);
      
      if (!this.hasPermission(module, 'read')) {
        return { success: false, error: `没有模块 ${module} 的读取权限` };
      }

      const store = this.stores.get(module);
      if (!store) {
        return { success: false, error: `模块 ${module} 的 Store 未初始化` };
      }

      this.log(`获取数据 - 键: ${key} -> 模块: ${module} -> 文件路径: ${store.path}`, 'debug');
      const data = store.get(storeKey) as T;
      this.log(`获取数据结果 - 键: ${key} -> 值: ${typeof data === 'string' ? data.substring(0, 50) + '...' : JSON.stringify(data)?.substring(0, 50)}`, 'debug');
      return { success: true, data };
    } catch (error) {
      this.log(`获取数据错误 - 键: ${key} -> 错误: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      return { success: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  }

  /**
   * 设置数据
   */
  set<T>(key: string, value: T): StorageResult {
    try {
      const { module, storeKey } = this.inferFromKey(key);
      
      if (!this.hasPermission(module, 'write')) {
        return { success: false, error: `没有模块 ${module} 的写入权限` };
      }

      const store = this.stores.get(module);
      if (!store) {
        return { success: false, error: `模块 ${module} 的 Store 未初始化` };
      }

      this.log(`设置数据 - 键: ${key} -> 模块: ${module} -> 文件路径: ${store.path}`, 'debug');
      this.log(`设置数据值 - 键: ${key} -> 值: ${typeof value === 'string' ? value.substring(0, 50) + '...' : JSON.stringify(value)?.substring(0, 50)}`, 'debug');
      store.set(storeKey, value);
      this.updateMetadata();

      return { success: true };
    } catch (error) {
      this.log(`设置数据错误 - 键: ${key} -> 错误: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      return { success: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  }

  /**
   * 删除数据
   */
  delete(key: string): StorageResult {
    try {
      const { module, storeKey } = this.inferFromKey(key);
      
      if (!this.hasPermission(module, 'delete')) {
        return { success: false, error: `没有模块 ${module} 的删除权限` };
      }

      const store = this.stores.get(module);
      if (!store) {
        return { success: false, error: `模块 ${module} 的 Store 未初始化` };
      }

      store.delete(storeKey);
      this.updateMetadata();

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  }

  /**
   * 检查数据是否存在
   */
  has(key: string): StorageResult<boolean> {
    try {
      const { module, storeKey } = this.inferFromKey(key);
      
      if (!this.hasPermission(module, 'read')) {
        return { success: false, error: `没有模块 ${module} 的读取权限` };
      }

      const store = this.stores.get(module);
      if (!store) {
        return { success: false, error: `模块 ${module} 的 Store 未初始化` };
      }

      const exists = store.has(storeKey);
      return { success: true, exists };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  }

  /**
   * 获取所有数据（用于导出）
   */
  getAll(): StorageResult<Record<string, any>> {
    try {
      const allData: Record<string, any> = {};

      // 读取所有模块的数据
      const modules = Object.values(StorageModule);
      modules.forEach(module => {
        const store = this.stores.get(module);
        if (store) {
          const storeData = store.store;
          Object.assign(allData, storeData);
        }
      });

      return { success: true, data: allData };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  }

  /**
   * 清空所有数据
   */
  clear(): StorageResult {
    try {
      const modules = Object.values(StorageModule);
      modules.forEach(module => {
        if (this.hasPermission(module, 'delete')) {
          const store = this.stores.get(module);
          if (store) {
            store.clear();
          }
        }
      });

      // 重新初始化元数据
      this.initializeMetadata();

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  }

  /**
   * 初始化元数据
   */
  initializeMetadata(): void {
    const configStore = this.stores.get(StorageModule.CONFIG);
    if (configStore) {
      const metadata: Metadata = {
        version: CURRENT_VERSION,
        lastUpdated: new Date().toISOString(),
        migrationStatus: 'completed'
      };
      configStore.set('_metadata', metadata);
    }
  }

  /**
   * 更新元数据
   */
  private updateMetadata(): void {
    const configStore = this.stores.get(StorageModule.CONFIG);
    if (configStore) {
      const metadata = configStore.get('_metadata') as Metadata || {
        version: CURRENT_VERSION,
        lastUpdated: new Date().toISOString()
      };
      
      metadata.lastUpdated = new Date().toISOString();
      configStore.set('_metadata', metadata);
    }
  }

  /**
   * 检查是否为旧架构
   */
  isLegacyArchitecture(): boolean {
    // 检查是否存在旧的单一 Store
    try {
      const oldStore = new Store({ name: 'travenmanager', clearInvalidConfig: false });
      // 如果旧 Store 有数据，说明需要迁移
      const hasOldData = Object.keys(oldStore.store).length > 0;
      return hasOldData;
    } catch {
      return false;
    }
  }

  /**
   * 获取备份路径（保留接口兼容性）
   */
  getBackupPath(timestamp: string): string {
    // 实际不需要这个了，但保留接口
    return `travenmanager.backup.${timestamp}.json`;
  }

  /**
   * 获取基础路径（保留接口兼容性）
   */
  getBasePath(): string {
    // 实际不需要这个了，但保留接口
    return '';
  }

  /**
   * 获取指定模块的 Store（内部使用）
   */
  getStore(module: StorageModule): Store | undefined {
    return this.stores.get(module);
  }
}

// 导出单例
let storageManagerInstance: StorageManager | null = null;

export const getStorageManager = (logCallback?: (message: string, type: 'error' | 'warn' | 'info' | 'debug', context?: any) => void): StorageManager => {
  if (!storageManagerInstance) {
    storageManagerInstance = new StorageManager(logCallback);
  }
  return storageManagerInstance;
};

export default getStorageManager();
