import { ipcMain } from 'electron';
import { settingHandlers } from './handlers/settingHandlers';
import { worldBookHandlers } from './handlers/worldBookHandlers';
import { characterHandlers } from './handlers/characterHandlers';
import { avatarHandlers } from './handlers/avatarHandlers';
import { fileHandlers } from './handlers/fileHandlers';
import { appHandlers } from './handlers/appHandlers';
import { pluginHandlers } from './handlers/pluginHandlers';
import './handlers/aiHandlers';
import { getStorageService } from '../services/storageService';

export function setupIpcHandlers() {
  // 初始化存储服务（会设置 storage:xxx 处理器）
  getStorageService();
  
  settingHandlers();
  worldBookHandlers();
  characterHandlers();
  avatarHandlers();
  fileHandlers();
  appHandlers();
  pluginHandlers();
  // SillyTavern handler is initialized in main/index.ts
  // AI handlers are imported above and auto-registered
}
