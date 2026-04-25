/**
 * 存储服务 - 新架构版本
 * 集成 StorageManager 和 DataMigrationService
 */

import { ipcMain } from 'electron';
import { getStorageManager, StorageManager } from './storageManager';
import { getDataMigrationService, DataMigrationService } from './dataMigrationService';
import { CURRENT_VERSION } from './storage.types';

// 存储键名（保持向后兼容）
const STORAGE_KEYS = {
  SETTINGS: 'settings',
  WORLDBOOKS: 'worldbooks',
  CHARACTERS: 'characters',
  CREATIVES: 'creatives',
  CHATS: 'chats',
  TEMPLATES: 'templates',
  VERSION: 'version',
  LAST_UPDATED: 'lastUpdated'
};

class StorageService {
  private storageManager: StorageManager;
  private migrationService: DataMigrationService;
  private initialized: boolean = false;

  constructor() {
    this.storageManager = getStorageManager();
    this.migrationService = getDataMigrationService();
    this.initialize();
  }

  /**
   * 初始化存储服务
   */
  private async initialize(): Promise<void> {
    console.log('开始初始化存储服务...');

    try {
      // 1. 检查并执行数据迁移
      const migrationStatus = this.migrationService.getMigrationStatus();
      if (migrationStatus.needsMigration) {
        console.log('检测到旧架构，开始自动迁移...');
        const result = await this.migrationService.migrate();
        
        if (result.success) {
          console.log('数据迁移成功:', result.message);
        } else {
          console.error('数据迁移失败:', result.message, result.error);
        }
      }

      // 2. 初始化默认数据结构
      await this.initializeDefaultData();

      // 3. 设置 IPC 处理
      this.setupIPC();

      this.initialized = true;
      console.log('存储服务初始化完成');
    } catch (error) {
      console.error('存储服务初始化失败:', error);
    }
  }

  /**
   * 初始化默认数据
   */
  private async initializeDefaultData(): Promise<void> {
    console.log('初始化默认数据结构...');

    try {
      // 检查并初始化 settings
      const settingsResult = this.storageManager.get('settings');
      if (!settingsResult.data) {
        console.log('SETTINGS 不存在，初始化默认设置');
        const { AppSetting } = require('../../renderer/settings');
        this.storageManager.set('settings', AppSetting.defaultSetting);
        console.log('SETTINGS 初始化成功');
      } else {
        console.log('SETTINGS 已存在');
      }

      // 检查并初始化其他模块的空对象
      const modules = [
        { key: 'worldbooks', defaultValue: {} },
        { key: 'characters', defaultValue: {} },
        { key: 'creatives', defaultValue: {} },
        { key: 'chats', defaultValue: {} },
        { key: 'templates', defaultValue: {} }
      ];

      for (const { key, defaultValue } of modules) {
        const result = this.storageManager.get(key);
        if (!result.data) {
          this.storageManager.set(key, defaultValue);
        }
      }

      // 初始化元数据
      this.storageManager.initializeMetadata();

      console.log('默认数据初始化完成');
    } catch (error) {
      console.error('初始化默认数据失败:', error);
    }
  }

  /**
   * 设置 IPC 处理
   */
  private setupIPC(): void {
    // 获取数据
    ipcMain.handle('storage:get', (event, key) => {
      try {
        const result = this.storageManager.get(key);
        return { success: result.success, data: result.data, error: result.error };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : '未知错误' };
      }
    });

    // 设置数据
    ipcMain.handle('storage:set', (event, { key, value }) => {
      try {
        const result = this.storageManager.set(key, value);
        return { success: result.success, error: result.error };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : '未知错误' };
      }
    });

    // 删除数据
    ipcMain.handle('storage:delete', (event, key) => {
      try {
        const result = this.storageManager.delete(key);
        return { success: result.success, error: result.error };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : '未知错误' };
      }
    });

    // 清空数据
    ipcMain.handle('storage:clear', async (event) => {
      try {
        const result = this.storageManager.clear();
        if (result.success) {
          // 重新初始化默认数据
          await this.initializeDefaultData();
        }
        return { success: result.success, error: result.error };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : '未知错误' };
      }
    });

    // 检查数据是否存在
    ipcMain.handle('storage:has', (event, key) => {
      try {
        const result = this.storageManager.has(key);
        return { success: result.success, exists: result.exists, error: result.error };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : '未知错误' };
      }
    });

    // 获取所有数据
    ipcMain.handle('storage:getAll', (event) => {
      try {
        const result = this.storageManager.getAll();
        return { success: result.success, data: result.data, error: result.error };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : '未知错误' };
      }
    });

    // 导入数据
    ipcMain.handle('storage:import', (event, data) => {
      try {
        const parsedData = JSON.parse(data);
        
        // 先清空数据
        this.storageManager.clear();
        
        // 逐个导入数据
        for (const key in parsedData) {
          if (parsedData.hasOwnProperty(key)) {
            this.storageManager.set(key, parsedData[key]);
          }
        }
        
        // 重新初始化元数据
        this.storageManager.initializeMetadata();
        
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : '未知错误' };
      }
    });

    // 手动触发数据迁移
    ipcMain.handle('storage:migrate', async (event) => {
      try {
        const result = await this.migrationService.migrate();
        return { 
          success: result.success, 
          message: result.message,
          error: result.error 
        };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : '未知错误' 
        };
      }
    });

    // 获取迁移状态
    ipcMain.handle('storage:getMigrationStatus', (event) => {
      try {
        const status = this.migrationService.getMigrationStatus();
        return { success: true, data: status };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : '未知错误' };
      }
    });

    // 回滚数据
    ipcMain.handle('storage:rollback', async (event, backupPath) => {
      try {
        const result = await this.migrationService.rollback(backupPath);
        return { 
          success: result.success, 
          message: result.message,
          error: result.error 
        };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : '未知错误' 
        };
      }
    });
  }

  // ========== 通用方法（保持向后兼容） ==========

  get<T>(key: string): T | undefined {
    try {
      const result = this.storageManager.get(key);
      return result.data as T;
    } catch (error) {
      console.error('获取数据失败:', error);
      return undefined;
    }
  }

  set<T>(key: string, value: T): void {
    try {
      const result = this.storageManager.set(key, value);
      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('设置数据失败:', error);
      throw error;
    }
  }

  delete(key: string): void {
    try {
      const result = this.storageManager.delete(key);
      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('删除数据失败:', error);
      throw error;
    }
  }

  clear(): void {
    try {
      const result = this.storageManager.clear();
      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('清空数据失败:', error);
      throw error;
    }
  }

  has(key: string): boolean {
    try {
      const result = this.storageManager.has(key);
      return result.exists || false;
    } catch (error) {
      console.error('检查数据失败:', error);
      return false;
    }
  }

  getAll(): Record<string, any> {
    try {
      const result = this.storageManager.getAll();
      return result.data || {};
    } catch (error) {
      console.error('获取所有数据失败:', error);
      return {};
    }
  }

  // ========== 分类方法（保持向后兼容） ==========

  getSettings(): any {
    return this.get(STORAGE_KEYS.SETTINGS);
  }

  setSettings(settings: any): void {
    this.set(STORAGE_KEYS.SETTINGS, settings);
  }

  getWorldBook(id: string): any {
    const worldbooks = this.get<Record<string, any>>(STORAGE_KEYS.WORLDBOOKS) || {};
    return worldbooks[id];
  }

  setWorldBook(id: string, data: any): void {
    const worldbooks = this.get<Record<string, any>>(STORAGE_KEYS.WORLDBOOKS) || {};
    worldbooks[id] = data;
    this.set(STORAGE_KEYS.WORLDBOOKS, worldbooks);
  }

  getCharacter(id: string): any {
    const characters = this.get<Record<string, any>>(STORAGE_KEYS.CHARACTERS) || {};
    return characters[id];
  }

  setCharacter(id: string, data: any): void {
    const characters = this.get<Record<string, any>>(STORAGE_KEYS.CHARACTERS) || {};
    characters[id] = data;
    this.set(STORAGE_KEYS.CHARACTERS, characters);
  }

  getCreative(id: string): any {
    const creatives = this.get<Record<string, any>>(STORAGE_KEYS.CREATIVES) || {};
    return creatives[id];
  }

  setCreative(id: string, data: any): void {
    const creatives = this.get<Record<string, any>>(STORAGE_KEYS.CREATIVES) || {};
    creatives[id] = data;
    this.set(STORAGE_KEYS.CREATIVES, creatives);
  }

  getChat(id: string): any {
    const chats = this.get<Record<string, any>>(STORAGE_KEYS.CHATS) || {};
    return chats[id];
  }

  setChat(id: string, data: any): void {
    const chats = this.get<Record<string, any>>(STORAGE_KEYS.CHATS) || {};
    chats[id] = data;
    this.set(STORAGE_KEYS.CHATS, chats);
  }

  getTemplate(id: string): any {
    const templates = this.get<Record<string, any>>(STORAGE_KEYS.TEMPLATES) || {};
    return templates[id];
  }

  setTemplate(id: string, data: any): void {
    const templates = this.get<Record<string, any>>(STORAGE_KEYS.TEMPLATES) || {};
    templates[id] = data;
    this.set(STORAGE_KEYS.TEMPLATES, templates);
  }

  // ========== 批量操作（保持向后兼容） ==========

  getWorldBooks(): Record<string, any> {
    return this.get<Record<string, any>>(STORAGE_KEYS.WORLDBOOKS) || {};
  }

  getCharacters(): Record<string, any> {
    return this.get<Record<string, any>>(STORAGE_KEYS.CHARACTERS) || {};
  }

  getCreatives(): Record<string, any> {
    return this.get<Record<string, any>>(STORAGE_KEYS.CREATIVES) || {};
  }

  getChats(): Record<string, any> {
    return this.get<Record<string, any>>(STORAGE_KEYS.CHATS) || {};
  }

  getTemplates(): Record<string, any> {
    return this.get<Record<string, any>>(STORAGE_KEYS.TEMPLATES) || {};
  }

  // ========== 版本控制（保持向后兼容） ==========

  getVersion(): string {
    const version = this.get<string>(STORAGE_KEYS.VERSION);
    return version || CURRENT_VERSION;
  }

  setVersion(version: string): void {
    this.set(STORAGE_KEYS.VERSION, version);
  }

  // ========== 数据迁移（保持向后兼容） ==========

  migrateData(): void {
    // 新架构中这个方法通过 migrationService 处理
    console.log('migrateData 已弃用，请使用新的迁移 API');
  }

  // ========== 新架构的额外方法 ==========

  /**
   * 获取存储管理器
   */
  getStorageManager(): StorageManager {
    return this.storageManager;
  }

  /**
   * 获取迁移服务
   */
  getMigrationService(): DataMigrationService {
    return this.migrationService;
  }
}

// 导出单例
let storageServiceInstance: StorageService | null = null;

export const getStorageService = (): StorageService => {
  if (!storageServiceInstance) {
    storageServiceInstance = new StorageService();
  }
  return storageServiceInstance;
};

export default getStorageService();
