import { ipcMain } from 'electron';
import { configHandlers } from './handlers/configHandlers';
import { worldBookHandlers } from './handlers/worldBookHandlers';
import { characterHandlers } from './handlers/characterHandlers';
import { avatarHandlers } from './handlers/avatarHandlers';
import { fileHandlers } from './handlers/fileHandlers';
import { appHandlers } from './handlers/appHandlers';
import { pluginHandlers } from './handlers/pluginHandlers';
import './handlers/aiHandlers';

export function setupIpcHandlers() {
  configHandlers();
  worldBookHandlers();
  characterHandlers();
  avatarHandlers();
  fileHandlers();
  appHandlers();
  pluginHandlers();
  // SillyTavern handler is initialized in main/index.ts
  // AI handlers are imported above and auto-registered
}
