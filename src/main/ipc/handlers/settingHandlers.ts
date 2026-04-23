import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

// 日志配置
const LOG_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_FILES: 5,
  LOG_DIR: 'logs',
  LOG_FILE: 'setting-handler.log'
};

// 日志级别
const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

// 获取日志目录路径
const getLogDir = (): string => {
  return path.join(process.cwd(), LOG_CONFIG.LOG_DIR);
};

// 获取日志文件路径
const getLogPath = (): string => {
  return path.join(getLogDir(), LOG_CONFIG.LOG_FILE);
};

// 检查并执行日志文件轮转
const rotateLogFile = () => {
  try {
    const logPath = getLogPath();
    if (!fs.existsSync(logPath)) {
      return;
    }

    const stats = fs.statSync(logPath);
    if (stats.size >= LOG_CONFIG.MAX_FILE_SIZE) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedPath = path.join(getLogDir(), `setting-handler-${timestamp}.log`);

      fs.renameSync(logPath, rotatedPath);

      const existingLogs = fs.readdirSync(getLogDir())
        .filter(file => file.startsWith('setting-handler-') && file.endsWith('.log'))
        .sort()
        .reverse();

      while (existingLogs.length >= LOG_CONFIG.MAX_FILES) {
        const oldestLog = existingLogs.pop();
        if (oldestLog) {
          fs.unlinkSync(path.join(getLogDir(), oldestLog));
        }
      }
    }
  } catch (e) {
    console.error('Failed to rotate log file:', e);
  }
};

// 简单日志函数
const logToFile = (level: string, message: string, details?: string) => {
  try {
    const logDir = getLogDir();
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    rotateLogFile();

    const logPath = getLogPath();
    const timestamp = new Date().toISOString();
    const displayTime = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const levelPrefix = `[${level.padEnd(5)}]`;
    const timePrefix = `[${displayTime}]`;
    let logMessage = `${timePrefix} ${levelPrefix} ${message}`;

    if (details) {
      logMessage += `\n${' '.repeat(20)}${details.split('\n').join('\n' + ' '.repeat(20))}`;
    }

    fs.appendFileSync(logPath, logMessage + '\n\n');
  } catch (e) {
    console.error('Failed to write to log file:', e);
  }
};

// 详细日志函数
const logDetailed = (level: string, title: string, data: any) => {
  try {
    const details = JSON.stringify(data, null, 2);
    logToFile(level, `${title}`, details);
  } catch (e) {
    logToFile(level, `${title}: ${String(data)}`);
  }
};

// 错误日志
const logError = (message: string, error?: Error, context?: any) => {
  const errorDetails = error ? `Error: ${error.message}\nStack: ${error.stack || 'No stack'}` : '';
  const contextDetails = context ? `Context: ${JSON.stringify(context, null, 2)}` : '';
  const details = [errorDetails, contextDetails].filter(Boolean).join('\n');
  logToFile(LOG_LEVELS.ERROR, message, details);
  console.error(`[Setting Handler] ${message}`, error, context);
};

// 信息日志
const logInfo = (message: string, context?: any) => {
  const contextDetails = context ? `Context: ${JSON.stringify(context, null, 2)}` : '';
  logToFile(LOG_LEVELS.INFO, message, contextDetails);
  console.info(`[Setting Handler] ${message}`, context);
};

interface AppSetting {
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

function getSettingDataPath(): string {
  // 使用项目本地目录保存设置，避免权限问题
  const dataDir = path.join(process.cwd(), 'settings');
  if (!fs.existsSync(dataDir)) {
    console.log('[Setting] Creating setting directory:', dataDir);
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const settingPath = path.join(dataDir, 'settings.json');
  console.log('[Setting] Using setting path:', settingPath);
  return settingPath;
}

function loadSetting(): AppSetting | null {
  const settingPath = getSettingDataPath();
  try {
    if (fs.existsSync(settingPath)) {
      const data = fs.readFileSync(settingPath, 'utf8');
      const parsed = JSON.parse(data);
      logInfo('Loaded setting', {
        path: settingPath
      });
      return parsed;
    }
  } catch (error) {
    logError('Failed to load setting', error, {
      errorType: error instanceof Error ? error.name : 'UnknownError',
      errorLocation: 'settingHandlers.ts:36:loadSetting',
      path: settingPath
    });
  }
  return null;
}

function saveSetting(setting: AppSetting): boolean {
  const settingPath = getSettingDataPath();
  try {
    logInfo('Attempting to save setting', {
      path: settingPath,
      dataSize: JSON.stringify(setting).length
    });
    
    // 确保目录存在
    const dir = path.dirname(settingPath);
    if (!fs.existsSync(dir)) {
      logInfo('Creating directory', {
        dir: dir
      });
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(settingPath, JSON.stringify(setting, null, 2), 'utf8');
    logInfo('Saved setting', {
      path: settingPath
    });
    return true;
  } catch (error) {
    logError('Failed to save setting', error, {
      errorType: error instanceof Error ? error.name : 'UnknownError',
      errorLocation: 'settingHandlers.ts:51:saveSetting',
      path: settingPath,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return false;
  }
}

export function settingHandlers(): void {
  ipcMain.handle('setting:load', async () => {
    logInfo('Handler setting:load called');
    const setting = loadSetting();
    if (setting) {
      return { success: true, setting };
    } else {
      logError('Failed to load setting in handler');
      return { success: false, error: 'Failed to load setting' };
    }
  });

  ipcMain.handle('setting:save', async (_event, setting: AppSetting) => {
    logInfo('Handler setting:save called', {
      presetName: setting.preset_name,
      engineCount: setting.aiEngines.length
    });
    try {
      const success = saveSetting(setting);
      if (success) {
        return { success: true };
      } else {
        return { success: false, error: '保存设置失败，请检查控制台日志获取详细信息' };
      }
    } catch (error) {
      logError('Exception in setting:save handler', error, {
        errorType: error instanceof Error ? error.name : 'UnknownError',
        errorLocation: 'settingHandlers.ts:98:setting:save',
        presetName: setting.preset_name
      });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '保存设置时发生未知错误' 
      };
    }
  });

  ipcMain.handle('setting:getPath', async () => {
    logInfo('Handler setting:getPath called');
    return getSettingDataPath();
  });

  logInfo('Setting handlers registered');
}