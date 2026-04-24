import Store from 'electron-store';
import { ipcMain } from 'electron';

// 版本号
const CURRENT_VERSION = '1.0.0';

// 存储键名
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

// 初始化存储
const store = new Store({
  name: 'travenmanager',
  clearInvalidConfig: true
});

// 初始化存储结构
const initStore = (): void => {
  console.log('开始初始化存储结构');
  try {
    // 确保存储结构完整
    if (!store.has(STORAGE_KEYS.SETTINGS)) {
      console.log('SETTINGS 键不存在，初始化默认设置');
      // 导入默认设置
      const { AppSetting } = require('../../renderer/settings');
      console.log('默认设置:', JSON.stringify(AppSetting.defaultSetting, null, 2));
      store.set(STORAGE_KEYS.SETTINGS, AppSetting.defaultSetting);
      console.log('SETTINGS 键初始化成功');
    } else {
      console.log('SETTINGS 键已存在');
      const settings = store.get(STORAGE_KEYS.SETTINGS);
      console.log('当前设置:', JSON.stringify(settings, null, 2));
    }
    if (!store.has(STORAGE_KEYS.WORLDBOOKS)) {
      store.set(STORAGE_KEYS.WORLDBOOKS, {});
    }
    if (!store.has(STORAGE_KEYS.CHARACTERS)) {
      store.set(STORAGE_KEYS.CHARACTERS, {});
    }
    if (!store.has(STORAGE_KEYS.CREATIVES)) {
      store.set(STORAGE_KEYS.CREATIVES, {});
    }
    if (!store.has(STORAGE_KEYS.CHATS)) {
      store.set(STORAGE_KEYS.CHATS, {});
    }
    if (!store.has(STORAGE_KEYS.TEMPLATES)) {
      store.set(STORAGE_KEYS.TEMPLATES, {});
    }
    if (!store.has(STORAGE_KEYS.VERSION)) {
      store.set(STORAGE_KEYS.VERSION, CURRENT_VERSION);
    }
    if (!store.has(STORAGE_KEYS.LAST_UPDATED)) {
      store.set(STORAGE_KEYS.LAST_UPDATED, new Date().toISOString());
    }

    // 执行数据迁移
    migrateData();
    console.log('存储结构初始化完成');
  } catch (error) {
    console.error('初始化存储结构失败:', error);
  }
};

// 数据迁移
const migrateData = (): void => {
  const currentVersion = store.get(STORAGE_KEYS.VERSION) || '0.0.0';
  
  // 这里可以添加数据迁移逻辑
  // 例如，当版本从1.0.0升级到2.0.0时，需要对数据结构进行调整
  
  if (currentVersion !== CURRENT_VERSION) {
    store.set(STORAGE_KEYS.VERSION, CURRENT_VERSION);
    store.set(STORAGE_KEYS.LAST_UPDATED, new Date().toISOString());
  }
};

// 存储服务类
class StorageService {
  constructor() {
    initStore();
    this.setupIPC();
  }

  // 设置IPC处理
  private setupIPC(): void {
    // 获取数据
    ipcMain.handle('storage:get', (event, key) => {
      try {
        const data = store.get(key);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // 设置数据
    ipcMain.handle('storage:set', (event, { key, value }) => {
      try {
        store.set(key, value);
        store.set(STORAGE_KEYS.LAST_UPDATED, new Date().toISOString());
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // 删除数据
    ipcMain.handle('storage:delete', (event, key) => {
      try {
        store.delete(key);
        store.set(STORAGE_KEYS.LAST_UPDATED, new Date().toISOString());
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // 清空数据
    ipcMain.handle('storage:clear', (event) => {
      try {
        store.clear();
        initStore();
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // 检查数据是否存在
    ipcMain.handle('storage:has', (event, key) => {
      try {
        const exists = store.has(key);
        return { success: true, exists };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // 获取所有数据
    ipcMain.handle('storage:getAll', (event) => {
      try {
        const data = store.store;
        return { success: true, data };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // 导入数据
    ipcMain.handle('storage:import', (event, data) => {
      try {
        const parsedData = JSON.parse(data);
        store.clear();
        
        // 导入数据
        for (const key in parsedData) {
          if (parsedData.hasOwnProperty(key)) {
            store.set(key, parsedData[key]);
          }
        }
        
        // 执行数据迁移
        migrateData();
        store.set(STORAGE_KEYS.LAST_UPDATED, new Date().toISOString());
        
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // 数据迁移
    ipcMain.handle('storage:migrate', (event) => {
      try {
        migrateData();
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
  }

  // 通用方法
  get<T>(key: string): T | undefined {
    try {
      return store.get(key) as T;
    } catch (error) {
      console.error('获取数据失败:', error);
      return undefined;
    }
  }

  set<T>(key: string, value: T): void {
    try {
      store.set(key, value);
      store.set(STORAGE_KEYS.LAST_UPDATED, new Date().toISOString());
    } catch (error) {
      console.error('设置数据失败:', error);
      throw error;
    }
  }

  delete(key: string): void {
    try {
      store.delete(key);
      store.set(STORAGE_KEYS.LAST_UPDATED, new Date().toISOString());
    } catch (error) {
      console.error('删除数据失败:', error);
      throw error;
    }
  }

  clear(): void {
    try {
      store.clear();
      initStore();
    } catch (error) {
      console.error('清空数据失败:', error);
      throw error;
    }
  }

  has(key: string): boolean {
    try {
      return store.has(key);
    } catch (error) {
      console.error('检查数据失败:', error);
      return false;
    }
  }

  getAll(): Record<string, any> {
    try {
      return store.store as Record<string, any>;
    } catch (error) {
      console.error('获取所有数据失败:', error);
      return {};
    }
  }

  // 分类方法
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

  // 批量操作
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

  // 版本控制
  getVersion(): string {
    return this.get<string>(STORAGE_KEYS.VERSION) || CURRENT_VERSION;
  }

  setVersion(version: string): void {
    this.set(STORAGE_KEYS.VERSION, version);
  }

  // 数据迁移
  migrateData(): void {
    migrateData();
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