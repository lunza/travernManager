import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

interface AppConfig {
  preset_name: string;
  aiEngines: any[];
  activeEngineId: string;
  defaultEngineId: string;
  sillyTavernRoot: string;
  worldBookPath: string;
  characterPath: string;
  pluginPath: string;
  dashboardBackgroundImage: string;
  animationEnabled: boolean;
  compactMode: boolean;
  autoOptimize: boolean;
  optimizeLevel: string;
  backupBeforeOptimize: boolean;
  logLevel: string;
}

function getConfigDataPath(): string {
  const dataDir = app.getPath('userData');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'config.json');
}

function loadConfig(): AppConfig | null {
  const configPath = getConfigDataPath();
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(data);
      console.log('[Config] Loaded config from:', configPath);
      return parsed;
    }
  } catch (error) {
    console.error('[Config] Failed to load config:', error);
  }
  return null;
}

function saveConfig(config: AppConfig): boolean {
  const configPath = getConfigDataPath();
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log('[Config] Saved config to:', configPath);
    return true;
  } catch (error) {
    console.error('[Config] Failed to save config:', error);
    return false;
  }
}

export function configHandlers(): void {
  ipcMain.handle('config:load', async () => {
    console.log('[Config] Handler config:load called');
    const config = loadConfig();
    if (config) {
      return { success: true, config };
    } else {
      return { success: false, error: 'Failed to load config' };
    }
  });

  ipcMain.handle('config:save', async (_event, config: AppConfig) => {
    console.log('[Config] Handler config:save called');
    const success = saveConfig(config);
    return { success };
  });

  ipcMain.handle('config:getPath', async () => {
    console.log('[Config] Handler config:getPath called');
    return getConfigDataPath();
  });

  console.log('[Config] Config handlers registered');
}
