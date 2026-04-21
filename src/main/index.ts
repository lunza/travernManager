import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { setupIpcHandlers } from './ipc';
import { registerMemoryHandlers } from './ipc/handlers/memoryHandlers';
import https from 'https';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { unzip } from 'node:zlib';
import { createGunzip } from 'zlib';
import { createWriteStream } from 'fs';
import { mkdirp } from 'mkdirp';
import { rimraf } from 'rimraf';
import { AppConfig } from '../renderer/config';

// 显式设置开发模式
const isDev = process.env.NODE_ENV === 'development';
console.log('isDev:', isDev);
console.log('app.isPackaged:', app.isPackaged);
console.log('process.env.NODE_ENV:', process.env.NODE_ENV);

// SillyTavern 根目录路径
const sillyTavernRootPath = path.join(process.cwd(), AppConfig.sillyTavernRoot);

// 更新处理器类
class UpdateHandler {
  private currentVersion: string;
  private githubRepo = 'SillyTavern/SillyTavern';
  
  constructor() {
    // 从SillyTavern目录名读取当前版本
    try {
      const sillyTavernPath = path.dirname(sillyTavernRootPath);
      const directories = fs.readdirSync(sillyTavernPath);
      const sillyTavernDir = directories.find(dir => dir.startsWith('SillyTavern-'));
      
      if (sillyTavernDir) {
        this.currentVersion = sillyTavernDir.replace('SillyTavern-', '');
      } else {
        // 如果找不到SillyTavern目录，从package.json读取
        const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
        this.currentVersion = packageJson.version;
      }
    } catch (error) {
      console.error('Error reading SillyTavern version:', error);
      this.currentVersion = '1.0.0';
    }
  }
  
  // 获取最新版本
  async getLatestVersion(): Promise<string> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${this.githubRepo}/releases/latest`,
        method: 'GET',
        headers: {
          'User-Agent': 'SillyTavern-Manager',
          'Accept': 'application/vnd.github.v3+json'
        }
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const release = JSON.parse(data);
            resolve(release.tag_name.replace('v', ''));
          } catch (error) {
            reject(new Error('Failed to parse GitHub API response'));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.end();
    });
  }
  
  // 检查是否有更新
  async checkForUpdates(): Promise<{ hasUpdate: boolean; currentVersion: string; latestVersion: string }> {
    try {
      const latestVersion = await this.getLatestVersion();
      const hasUpdate = this.compareVersions(this.currentVersion, latestVersion) < 0;
      return {
        hasUpdate,
        currentVersion: this.currentVersion,
        latestVersion
      };
    } catch (error) {
      throw new Error(`Failed to check for updates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // 版本比较
  private compareVersions(version1: string, version2: string): number {
    const v1 = version1.split('.').map(Number);
    const v2 = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
      const num1 = v1[i] || 0;
      const num2 = v2[i] || 0;
      
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    
    return 0;
  }
  
  // 下载更新
  async downloadUpdate(latestVersion: string): Promise<string> {
    const downloadUrl = `https://github.com/${this.githubRepo}/archive/refs/tags/v${latestVersion}.zip`;
    const downloadPath = path.join(app.getPath('temp'), `sillytavern-${latestVersion}.zip`);
    
    // 确保临时目录存在
    await mkdirp(path.dirname(downloadPath));
    
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(downloadPath);
      const req = https.get(downloadUrl, (response) => {
        response.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            resolve(downloadPath);
          });
        });
      });
      
      req.on('error', (error) => {
        fs.unlinkSync(downloadPath);
        reject(error);
      });
    });
  }
  
  // 安装更新
  async installUpdate(downloadPath: string): Promise<void> {
    // 这里需要实现具体的更新安装逻辑
    // 1. 备份用户数据
    // 2. 解压更新包
    // 3. 替换应用文件
    // 4. 恢复用户数据
    console.log('Installing update from:', downloadPath);
    // 实际实现时需要添加完整的更新安装逻辑
  }
}

// SillyTavernHandler 类定义
class SillyTavernHandler {
  private process: ChildProcess | null = null;
  private logs: string[] = [];
  private initialized = false;
  private logBuffer: string[] = [];
  private logBufferTimer: NodeJS.Timeout | null = null;
  private isStopping: boolean = false;
  private webSocketServer: any = null;
  private webSocketClients: Set<any> = new Set();

  constructor() {
    console.log('SillyTavernHandler constructor called');
    this.setupHandlers();
    this.setupWebSocketServer();
  }

  private setupHandlers() {
    if (this.initialized) {
      console.log('SillyTavernHandler already initialized');
      return;
    }
    
    console.log('Setting up SillyTavern handlers...');
    
    ipcMain.handle('sillyTavern:start', async () => {
      console.log('Handler sillyTavern:start called');
      return await this.startSillyTavern();
    });

    ipcMain.handle('sillyTavern:stop', async () => {
      console.log('Handler sillyTavern:stop called');
      return await this.stopSillyTavern();
    });

    ipcMain.handle('sillyTavern:status', async () => {
      console.log('Handler sillyTavern:status called');
      return this.getStatus();
    });

    ipcMain.handle('sillyTavern:stopAll', async () => {
      console.log('Handler sillyTavern:stopAll called');
      return await this.stopAllSillyTavern();
    });

    ipcMain.handle('sillyTavern:updateConfig', async (_event, config: any) => {
      console.log('Handler sillyTavern:updateConfig called');
      return await this.updateSillyTavernConfig(config);
    });

    // 更新相关的IPC处理器
    const updateHandler = new UpdateHandler();
    
    ipcMain.handle('update:check', async () => {
      console.log('Handler update:check called');
      try {
        const result = await updateHandler.checkForUpdates();
        return { success: true, data: result };
      } catch (error) {
        console.error('Error checking for updates:', error);
        return { success: false, message: error instanceof Error ? error.message : 'Failed to check for updates' };
      }
    });

    ipcMain.handle('update:download', async (_, latestVersion) => {
      console.log('Handler update:download called with version:', latestVersion);
      try {
        const downloadPath = await updateHandler.downloadUpdate(latestVersion);
        return { success: true, data: { downloadPath } };
      } catch (error) {
        console.error('Error downloading update:', error);
        return { success: false, message: error instanceof Error ? error.message : 'Failed to download update' };
      }
    });

    ipcMain.handle('update:install', async (_, downloadPath) => {
      console.log('Handler update:install called with path:', downloadPath);
      try {
        await updateHandler.installUpdate(downloadPath);
        return { success: true };
      } catch (error) {
        console.error('Error installing update:', error);
        return { success: false, message: error instanceof Error ? error.message : 'Failed to install update' };
      }
    });
    
    this.initialized = true;
    console.log('SillyTavern handlers setup complete');
  }

  private async startSillyTavern() {
    if (this.process) {
      return { success: false, message: 'SillyTavern already running' };
    }

    this.logs = [];
    
    try {
      // 使用全局配置中的SillyTavern根目录路径
      const sillyTavernPath = sillyTavernRootPath;
      
      // 启动SillyTavern
      this.process = spawn('node', ['server.js'], {
        cwd: sillyTavernPath,
        shell: true,
        stdio: 'pipe'
      });

      // 捕获 stdout
      this.process.stdout?.on('data', (data) => {
        const log = data.toString();
        this.logs.push(log);
        console.log('SillyTavern stdout:', log);
        // 将日志添加到缓冲区
        this.addToLogBuffer(log);
      });

      // 捕获 stderr
      this.process.stderr?.on('data', (data) => {
        const log = data.toString();
        this.logs.push(log);
        console.error('SillyTavern stderr:', log);
        // 将日志添加到缓冲区
        this.addToLogBuffer(log);
      });

      // 处理退出
      this.process.on('exit', (code) => {
        this.logs.push(`SillyTavern exited with code ${code}`);
        this.process = null;
      });

      // 处理错误
      this.process.on('error', (error) => {
        this.logs.push(`Error: ${error.message}`);
        this.process = null;
      });

      // 等待服务器启动，然后在默认浏览器中打开
      setTimeout(() => {
        this.logs.push('Opening SillyTavern in default browser...');
        shell.openExternal('http://127.0.0.1:8003/');
      }, 5000);

      return { success: true, message: 'SillyTavern starting' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to start SillyTavern'
      };
    }
  }

  private async stopSillyTavern() {
    if (!this.process) {
      return { success: false, message: 'SillyTavern not running' };
    }

    try {
      // 终止进程
      this.process.kill();
      
      // 等待进程退出，设置5秒超时
      const exitPromise = new Promise<boolean>((resolve) => {
        let timeout = setTimeout(() => {
          resolve(false);
        }, 5000);
        
        this.process?.on('exit', () => {
          clearTimeout(timeout);
          resolve(true);
        });
      });
      
      const exited = await exitPromise;
      
      if (!exited) {
        console.warn('SillyTavern process did not exit within timeout');
      }
      
      this.process = null;
      return { success: true, message: 'SillyTavern stopped' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to stop SillyTavern'
      };
    }
  }

  private getStatus() {
    return {
      running: this.process !== null,
      logs: this.logs
    };
  }

  // 设置WebSocket服务器
  private setupWebSocketServer() {
    try {
      const WebSocket = require('ws');
      this.webSocketServer = new WebSocket.Server({ port: 8080 });
      
      this.webSocketServer.on('connection', (ws: any) => {
        console.log('WebSocket client connected');
        this.webSocketClients.add(ws);
        
        // 发送历史日志
        if (this.logs.length > 0) {
          try {
            ws.send(JSON.stringify({ type: 'logs', data: this.logs }));
            console.log('Sent history logs to WebSocket client');
          } catch (error) {
            console.error('Error sending history logs:', error);
            this.webSocketClients.delete(ws);
          }
        }
        
        ws.on('close', (code: number, reason: string) => {
          console.log(`WebSocket client disconnected: code ${code}, reason ${reason}`);
          this.webSocketClients.delete(ws);
        });
        
        ws.on('error', (error: any) => {
          console.error('WebSocket error:', error);
          this.webSocketClients.delete(ws);
        });
      });
      
      this.webSocketServer.on('error', (error: any) => {
        console.error('WebSocket server error:', error);
      });
      
      this.webSocketServer.on('close', () => {
        console.log('WebSocket server closed');
      });
      
      console.log('WebSocket server started on port 8080');
    } catch (error) {
      console.error('Error setting up WebSocket server:', error);
    }
  }

  // 添加日志到缓冲区
  private addToLogBuffer(log: string) {
    // 不限制日志长度，确保所有日志都能完整显示
    this.logBuffer.push(log);

    // 立即发送日志，不等待定时器，确保日志及时显示
    this.flushLogBuffer();
  }

  // 批量发送日志到渲染进程
  private flushLogBuffer() {
    if (this.logBuffer.length > 0) {
      // 合并所有日志
      const combinedLog = this.logBuffer.join('');
      
      // 通过WebSocket发送日志到渲染进程
      this.sendLogViaWebSocket(combinedLog);
      
      // 同时通过IPC发送日志作为备用，确保mainWindow存在
      if (mainWindow && mainWindow.webContents) {
        try {
          mainWindow.webContents.send('sillyTavern:log', combinedLog);
        } catch (error) {
          console.error('Error sending log via IPC:', error);
        }
      }
      
      // 清空缓冲区
      this.logBuffer = [];
    }
    // 清除定时器
    if (this.logBufferTimer) {
      clearTimeout(this.logBufferTimer);
      this.logBufferTimer = null;
    }
  }

  // 通过WebSocket发送日志
  private sendLogViaWebSocket(log: string) {
    if (this.webSocketClients.size > 0) {
      const message = JSON.stringify({ type: 'log', data: log });
      this.webSocketClients.forEach((client) => {
        try {
          if (client.readyState === 1) { // OPEN状态
            client.send(message);
          }
        } catch (error) {
          console.error('Error sending log via WebSocket:', error);
          this.webSocketClients.delete(client);
        }
      });
    }
  }

  // 公共方法，用于停止SillyTavern进程
  public stop() {
    try {
      if (this.process && !this.isStopping) {
        this.isStopping = true;
        
        // 终止进程
        this.process.kill();
        
        // 等待进程退出，设置5秒超时
        setTimeout(() => {
          if (this.process) {
            console.warn('SillyTavern process did not exit within timeout, force killing...');
            // 强制终止进程
            try {
              process.kill(this.process.pid, 'SIGKILL');
            } catch (error) {
              console.error('Error force killing SillyTavern process:', error);
            }
          }
          this.process = null;
          this.isStopping = false;
          console.log('Stopped SillyTavern process');
          
          // 额外保险：扫描并终止占用8003端口的进程
          this.killProcessByPort(8003);
        }, 5000);
        
        // 监听进程退出事件
        this.process.on('exit', () => {
          this.process = null;
          this.isStopping = false;
          console.log('SillyTavern process exited');
          
          // 额外保险：扫描并终止占用8003端口的进程
          this.killProcessByPort(8003);
        });
      } else {
        // 即使没有当前进程，也扫描并终止占用8003端口的进程
        this.killProcessByPort(8003);
      }
    } catch (error) {
      console.error('Error stopping SillyTavern process:', error);
      this.isStopping = false;
      
      // 即使出错，也扫描并终止占用8003端口的进程
      this.killProcessByPort(8003);
    }
  }
  
  // 最高级别清理：强制终止所有与SillyTavern相关的进程
  public forceCleanup() {
    // 使用英文日志避免乱码
    console.log('=== Executing highest level cleanup ===');
    
    try {
      // 1. 停止当前管理的进程
      this.stop();
      
      // 2. 强制终止所有与SillyTavern相关的进程
      this.forceKillAllSillyTavernProcesses();
      
      // 3. 终止占用8003端口的进程
      this.killProcessByPort(8003);
      
      // 4. 验证清理结果
      setTimeout(() => {
        this.verifyCleanup();
      }, 2000);
      
    } catch (error) {
      console.error('Error during force cleanup:', error);
    }
  }
  
  // 强制终止所有与SillyTavern相关的进程
  private forceKillAllSillyTavernProcesses() {
    try {
      const { exec } = require('child_process');
      
      // 首先，直接查找并终止占用8003端口的进程
      if (process.platform === 'win32') {
        // Windows系统
        exec('netstat -ano | findstr :8003', (error, stdout) => {
          if (error) {
            console.error('Error finding processes using port 8003:', error);
          } else {
            const lines = stdout.trim().split('\n');
            for (const line of lines) {
              if (line.trim()) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 5) {
                  const pid = parts[4];
                  if (pid) {
                    console.log(`Force killing process ${pid} using port 8003`);
                    exec(`taskkill /PID ${pid} /F`, (error) => {
                      if (error) {
                        console.error(`Error force killing process ${pid}:`, error);
                      } else {
                        console.log(`Successfully force killed process ${pid} using port 8003`);
                      }
                    });
                  }
                }
              }
            }
          }
        });
      } else {
        // Unix-like系统
        exec('lsof -i :8003 -t', (error, stdout) => {
          if (error) {
            console.error('Error finding processes using port 8003:', error);
          } else {
            const pids = stdout.trim().split('\n');
            for (const pid of pids) {
              if (pid) {
                console.log(`Force killing process ${pid} using port 8003`);
                try {
                  process.kill(parseInt(pid), 'SIGKILL');
                  console.log(`Successfully force killed process ${pid} using port 8003`);
                } catch (error) {
                  console.error(`Error force killing process ${pid}:`, error);
                }
              }
            }
          }
        });
      }
      
      // 然后，查找并终止与SillyTavern相关的其他进程
      if (process.platform === 'win32') {
        // Windows系统
        // 查找包含SillyTavern的进程
        exec('tasklist /v | findstr /i "SillyTavern"', (error, stdout) => {
          if (error) {
            console.error('Error finding SillyTavern processes:', error);
          } else {
            const lines = stdout.trim().split('\n');
            for (const line of lines) {
              if (line.trim()) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 2) {
                  const pid = parts[1];
                  if (pid) {
                    console.log(`Force killing SillyTavern process ${pid}`);
                    exec(`taskkill /PID ${pid} /F`, (error) => {
                      if (error) {
                        console.error(`Error force killing process ${pid}:`, error);
                      } else {
                        console.log(`Successfully force killed process ${pid}`);
                      }
                    });
                  }
                }
              }
            }
          }
        });
        
        // 查找包含node.exe的进程，可能是运行SillyTavern的Node进程
        exec('tasklist /v | findstr /i "node.exe"', (error, stdout) => {
          if (error) {
            console.error('Error finding Node processes:', error);
          } else {
            const lines = stdout.trim().split('\n');
            for (const line of lines) {
              if (line.trim() && (line.includes('server.js') || line.includes('SillyTavern'))) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 2) {
                  const pid = parts[1];
                  if (pid) {
                    console.log(`Force killing Node process ${pid} running server.js`);
                    exec(`taskkill /PID ${pid} /F`, (error) => {
                      if (error) {
                        console.error(`Error force killing Node process ${pid}:`, error);
                      } else {
                        console.log(`Successfully force killed Node process ${pid}`);
                      }
                    });
                  }
                }
              }
            }
          }
        });
      } else {
        // Unix-like系统
        // 查找包含SillyTavern或server.js的进程
        exec('ps aux | grep -i "SillyTavern\|server.js" | grep -v grep', (error, stdout) => {
          if (error) {
            console.error('Error finding SillyTavern processes:', error);
          } else {
            const lines = stdout.trim().split('\n');
            for (const line of lines) {
              if (line.trim()) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 2) {
                  const pid = parts[1];
                  if (pid) {
                    console.log(`Force killing SillyTavern process ${pid}`);
                    try {
                      process.kill(parseInt(pid), 'SIGKILL');
                      console.log(`Successfully force killed process ${pid}`);
                    } catch (error) {
                      console.error(`Error force killing process ${pid}:`, error);
                    }
                  }
                }
              }
            }
          }
        });
      }
    } catch (error) {
      console.error('Error force killing SillyTavern processes:', error);
    }
  }
  
  // 验证清理结果
  private verifyCleanup() {
    console.log('=== 验证清理结果 ===');
    
    try {
      const { exec } = require('child_process');
      
      // 检查是否还有占用8003端口的进程
      if (process.platform === 'win32') {
        exec(`netstat -ano | findstr :8003`, (error, stdout) => {
          if (error) {
            console.log('No processes using port 8003 (good)');
          } else {
            const lines = stdout.trim().split('\n');
            if (lines.length > 0) {
              console.warn('Warning: There are still processes using port 8003:');
              console.warn(stdout);
              // 再次尝试终止这些进程
              this.killProcessByPort(8003);
            } else {
              console.log('No processes using port 8003 (good)');
            }
          }
        });
      } else {
        exec(`lsof -i :8003`, (error, stdout) => {
          if (error) {
            console.log('No processes using port 8003 (good)');
          } else {
            console.warn('Warning: There are still processes using port 8003:');
            console.warn(stdout);
            // 再次尝试终止这些进程
            this.killProcessByPort(8003);
          }
        });
      }
      
      // 检查是否还有与SillyTavern相关的进程
      if (process.platform === 'win32') {
        exec('tasklist /v | findstr /i "SillyTavern"', (error, stdout) => {
          if (error) {
            console.log('No SillyTavern processes found (good)');
          } else {
            console.warn('Warning: There are still SillyTavern processes running:');
            console.warn(stdout);
            // 再次尝试终止这些进程
            this.forceKillAllSillyTavernProcesses();
          }
        });
      } else {
        exec('ps aux | grep -i "SillyTavern\|server.js" | grep -v grep', (error, stdout) => {
          if (error) {
            console.log('No SillyTavern processes found (good)');
          } else {
            console.warn('Warning: There are still SillyTavern processes running:');
            console.warn(stdout);
            // 再次尝试终止这些进程
            this.forceKillAllSillyTavernProcesses();
          }
        });
      }
    } catch (error) {
      console.error('Error verifying cleanup:', error);
    }
  }
  
  // 根据端口号终止进程
  private killProcessByPort(port: number) {
    try {
      const { exec } = require('child_process');
      
      // 在Windows上，使用netstat和taskkill命令
      if (process.platform === 'win32') {
        exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
          if (error) {
            console.error('Error finding process by port:', error);
            return;
          }
          
          // 解析输出，找到占用端口的进程ID
          const lines = stdout.trim().split('\n');
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 5) {
              const pid = parts[4];
              if (pid) {
                console.log(`Killing process ${pid} that is using port ${port}`);
                exec(`taskkill /PID ${pid} /F`, (error) => {
                  if (error) {
                    console.error(`Error killing process ${pid}:`, error);
                  } else {
                    console.log(`Successfully killed process ${pid}`);
                  }
                });
              }
            }
          }
        });
      } else {
        // 在其他平台上，使用lsof和kill命令
        exec(`lsof -i :${port} -t`, (error, stdout) => {
          if (error) {
            console.error('Error finding process by port:', error);
            return;
          }
          
          const pids = stdout.trim().split('\n');
          for (const pid of pids) {
            if (pid) {
              console.log(`Killing process ${pid} that is using port ${port}`);
              try {
                process.kill(parseInt(pid), 'SIGKILL');
                console.log(`Successfully killed process ${pid}`);
              } catch (error) {
                console.error(`Error killing process ${pid}:`, error);
              }
            }
          }
        });
      }
    } catch (error) {
      console.error('Error killing process by port:', error);
    }
  }

  private async stopAllSillyTavern() {
    try {
      // 停止当前管理的进程
      this.stop();

      return { success: true, message: 'Stopped SillyTavern process' };
    } catch (error) {
      console.error('Error stopping SillyTavern process:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to stop SillyTavern process'
      };
    }
  }

  private async updateSillyTavernConfig(config: any) {
    try {
      console.log('Received config:', JSON.stringify(config, null, 2));
      console.log('API mode:', config.api_mode);
      
      // 使用全局配置中的SillyTavern根目录路径
      const sillyTavernPath = sillyTavernRootPath;
      const settingsPath = path.join(sillyTavernPath, 'data', 'default-user', 'settings.json');
      
      // 读取现有配置
      const existingConfig = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      
      // 根据API模式更新配置
      if (config.api_mode === 'text_completion') {
        // 更新文本补全模式配置
        existingConfig.main_api = 'textgenerationwebui';
        existingConfig.textgenerationwebui_settings = {
          ...existingConfig.textgenerationwebui_settings,
          server_urls: {
            ooba: config.api_url
          },
          custom_model: config.model_name,
          bypass_status_check: config.skip_status_check || false
        };
      } else if (config.api_mode === 'chat_completion') {
        // 更新聊天补全模式配置
        existingConfig.main_api = 'openai';
        existingConfig.oai_settings = {
          ...existingConfig.oai_settings,
          openai_model: config.model_name,
          reverse_proxy: config.api_url,
          bypass_status_check: config.skip_status_check || false
        };
      } else if (config.api_mode === 'novelai') {
        // 更新NovelAI模式配置
        existingConfig.main_api = 'novelai';
        existingConfig.nai_settings = {
          ...existingConfig.nai_settings,
          model_novel: config.novelai_model || 'clio-v1'
        };
      } else if (config.api_mode === 'ai_horde') {
        // 更新AI Horde模式配置
        existingConfig.main_api = 'horde';
        existingConfig.horde_settings = {
          ...existingConfig.horde_settings,
          models: config.ai_horde_model ? [config.ai_horde_model] : []
        };
      }
      
      // 更新模型参数
      if (config.temperature !== undefined) {
        const presetName = config.preset_name || 'Default';
        
        if (config.api_mode === 'text_completion') {
          // 更新文本补全模式参数
          existingConfig.textgenerationwebui_settings = {
            ...existingConfig.textgenerationwebui_settings,
            temp: config.temperature,
            top_p: config.top_p,
            top_k: config.top_k,
            min_p: config.min_p,
            rep_pen: config.rep_pen,
            rep_pen_range: config.rep_pen_range,
            rep_pen_slope: config.rep_pen_slope,
            freq_pen: config.freq_pen,
            presence_pen: config.presence_pen,
            do_sample: config.do_sample,
            early_stopping: config.early_stopping,
            num_beams: config.num_beams,
            length_penalty: config.length_penalty,
            min_length: config.min_length,
            add_bos_token: config.add_bos_token,
            ban_eos_token: config.ban_eos_token,
            skip_special_tokens: config.skip_special_tokens,
            mirostat_mode: config.mirostat_mode,
            mirostat_tau: config.mirostat_tau,
            mirostat_eta: config.mirostat_eta,
            max_length: config.max_length,
            genamt: config.genamt,
            preset: presetName
          };
          
          // 更新文本补全预设文件
          const textGenSettingsPath = path.join(sillyTavernPath, 'data', 'default-user', 'TextGen Settings', `${presetName}.json`);
          
          // 确保目录存在
          const textGenSettingsDir = path.dirname(textGenSettingsPath);
          if (!fs.existsSync(textGenSettingsDir)) {
            fs.mkdirSync(textGenSettingsDir, { recursive: true });
          }
          
          const textGenPreset = {
            temp: config.temperature,
            temperature_last: false,
            top_p: config.top_p,
            top_k: config.top_k,
            top_a: 0,
            tfs: 1,
            epsilon_cutoff: 0,
            eta_cutoff: 0,
            typical_p: 1,
            min_p: config.min_p,
            rep_pen: config.rep_pen,
            rep_pen_range: config.rep_pen_range,
            rep_pen_decay: 0,
            rep_pen_slope: config.rep_pen_slope,
            no_repeat_ngram_size: 0,
            penalty_alpha: 0,
            num_beams: config.num_beams,
            length_penalty: config.length_penalty,
            min_length: config.min_length,
            encoder_rep_pen: 1,
            freq_pen: config.freq_pen,
            presence_pen: config.presence_pen,
            skew: 0,
            do_sample: config.do_sample,
            early_stopping: config.early_stopping,
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
            add_bos_token: config.add_bos_token,
            ban_eos_token: config.ban_eos_token,
            skip_special_tokens: config.skip_special_tokens,
            mirostat_mode: config.mirostat_mode,
            mirostat_tau: config.mirostat_tau,
            mirostat_eta: config.mirostat_eta,
            guidance_scale: 1,
            negative_prompt: '',
            grammar_string: '',
            json_schema: null,
            json_schema_allow_empty: false,
            banned_tokens: '',
            sampler_priority: [
              "repetition_penalty",
              "presence_penalty",
              "frequency_penalty",
              "dry",
              "temperature",
              "dynamic_temperature",
              "quadratic_sampling",
              "top_n_sigma",
              "top_k",
              "top_p",
              "typical_p",
              "epsilon_cutoff",
              "eta_cutoff",
              "tfs",
              "top_a",
              "min_p",
              "mirostat",
              "xtc",
              "encoder_repetition_penalty",
              "no_repeat_ngram"
            ],
            samplers: [
              "penalties",
              "dry",
              "top_n_sigma",
              "top_k",
              "typ_p",
              "tfs_z",
              "typical_p",
              "xtc",
              "top_p",
              "adaptive_p",
              "min_p",
              "temperature"
            ],
            samplers_priorities: [
              "dry",
              "penalties",
              "no_repeat_ngram",
              "temperature",
              "top_nsigma",
              "top_p_top_k",
              "top_a",
              "min_p",
              "tfs",
              "eta_cutoff",
              "epsilon_cutoff",
              "typical_p",
              "quadratic",
              "xtc"
            ],
            ignore_eos_token: false,
            spaces_between_special_tokens: true,
            speculative_ngram: false,
            sampler_order: [
              5,
              6,
              0,
              1,
              2,
              3,
              4
            ],
            logit_bias: [],
            xtc_threshold: 0.1,
            xtc_probability: 0,
            nsigma: 0,
            min_keep: 0,
            extensions: {},
            adaptive_target: -0.01,
            adaptive_decay: 0.9,
            rep_pen_size: 0,
            genamt: config.genamt,
            max_length: config.max_length
          };
          
          fs.writeFileSync(textGenSettingsPath, JSON.stringify(textGenPreset, null, 2), 'utf-8');
          console.log(`TextGen preset ${presetName} updated successfully`);
        } else if (config.api_mode === 'chat_completion') {
          // 更新聊天补全模式参数
          existingConfig.oai_settings = {
            ...existingConfig.oai_settings,
            temperature: config.temperature,
            top_p: config.top_p,
            frequency_penalty: config.freq_pen,
            presence_penalty: config.presence_pen,
            max_tokens: config.max_tokens || 300,
            stream: config.streaming || true
          };
          
          // 更新聊天补全预设文件
          const openAISettingsPath = path.join(sillyTavernPath, 'data', 'default-user', 'OpenAI Settings', `${presetName}.json`);
          
          // 确保目录存在
          const openAISettingsDir = path.dirname(openAISettingsPath);
          if (!fs.existsSync(openAISettingsDir)) {
            fs.mkdirSync(openAISettingsDir, { recursive: true });
          }
          
          // 构建模型参数配置对象（参考Default.json格式）
          const openAIPreset = {
            // 基本参数
            temperature: config.temperature ?? 1,
            frequency_penalty: config.freq_pen ?? 0,
            presence_penalty: config.presence_pen ?? 0,
            top_p: config.top_p ?? 1,
            top_k: config.top_k ?? 0,
            top_a: config.top_a ?? 0,
            min_p: config.min_p ?? 0,
            repetition_penalty: config.rep_pen ?? 1,
            openai_max_context: 4095,
            openai_max_tokens: config.max_tokens ?? 300,
            names_behavior: 0,
            send_if_empty: "",
            impersonation_prompt: "[Write your next reply from the point of view of {{user}}, using the chat history so far as a guideline for the writing style of {{user}}. Don't write as {{char}} or system. Don't describe actions of {{char}}.]",
            new_chat_prompt: "[Start a new Chat]",
            new_group_chat_prompt: "[Start a new group chat. Group members: {{group}}]",
            new_example_chat_prompt: "[Example Chat]",
            continue_nudge_prompt: "[Continue your last message without repeating its original content.]",
            bias_preset_selected: "Default (none)",
            max_context_unlocked: false,
            wi_format: "{0}",
            scenario_format: "{{scenario}}",
            personality_format: "{{personality}}",
            group_nudge_prompt: "[Write the next reply only as {{char}}.]",
            stream_openai: config.streaming ?? true,
            
            // 提示词配置
            prompts: [
              {
                "name": "Main Prompt",
                "system_prompt": true,
                "role": "system",
                "content": "Write {{char}}'s next reply in a fictional chat between {{char}} and {{user}}.",
                "identifier": "main"
              },
              {
                "name": "Auxiliary Prompt",
                "system_prompt": true,
                "role": "system",
                "content": "",
                "identifier": "nsfw"
              },
              {
                "identifier": "dialogueExamples",
                "name": "Chat Examples",
                "system_prompt": true,
                "marker": true
              },
              {
                "name": "Post-History Instructions",
                "system_prompt": true,
                "role": "system",
                "content": "",
                "identifier": "jailbreak"
              },
              {
                "identifier": "chatHistory",
                "name": "Chat History",
                "system_prompt": true,
                "marker": true
              },
              {
                "identifier": "worldInfoAfter",
                "name": "World Info (after)",
                "system_prompt": true,
                "marker": true
              },
              {
                "identifier": "worldInfoBefore",
                "name": "World Info (before)",
                "system_prompt": true,
                "marker": true
              },
              {
                "identifier": "enhanceDefinitions",
                "role": "system",
                "name": "Enhance Definitions",
                "content": "If you have more knowledge of {{char}}, add to the character's lore and personality to enhance them but keep the Character Sheet's definitions absolute.",
                "system_prompt": true,
                "marker": false
              },
              {
                "identifier": "charDescription",
                "name": "Char Description",
                "system_prompt": true,
                "marker": true
              },
              {
                "identifier": "charPersonality",
                "name": "Char Personality",
                "system_prompt": true,
                "marker": true
              },
              {
                "identifier": "scenario",
                "name": "Scenario",
                "system_prompt": true,
                "marker": true
              },
              {
                "identifier": "personaDescription",
                "name": "Persona Description",
                "system_prompt": true,
                "marker": true
              }
            ],
            
            // 提示词顺序
            prompt_order: [
              {
                "character_id": 100000,
                "order": [
                  {
                    "identifier": "main",
                    "enabled": true
                  },
                  {
                    "identifier": "worldInfoBefore",
                    "enabled": true
                  },
                  {
                    "identifier": "charDescription",
                    "enabled": true
                  },
                  {
                    "identifier": "charPersonality",
                    "enabled": true
                  },
                  {
                    "identifier": "scenario",
                    "enabled": true
                  },
                  {
                    "identifier": "enhanceDefinitions",
                    "enabled": false
                  },
                  {
                    "identifier": "nsfw",
                    "enabled": true
                  },
                  {
                    "identifier": "worldInfoAfter",
                    "enabled": true
                  },
                  {
                    "identifier": "dialogueExamples",
                    "enabled": true
                  },
                  {
                    "identifier": "chatHistory",
                    "enabled": true
                  },
                  {
                    "identifier": "jailbreak",
                    "enabled": true
                  }
                ]
              },
              {
                "character_id": 100001,
                "order": [
                  {
                    "identifier": "main",
                    "enabled": true
                  },
                  {
                    "identifier": "worldInfoBefore",
                    "enabled": true
                  },
                  {
                    "identifier": "personaDescription",
                    "enabled": true
                  },
                  {
                    "identifier": "charDescription",
                    "enabled": true
                  },
                  {
                    "identifier": "charPersonality",
                    "enabled": true
                  },
                  {
                    "identifier": "scenario",
                    "enabled": true
                  },
                  {
                    "identifier": "enhanceDefinitions",
                    "enabled": false
                  },
                  {
                    "identifier": "nsfw",
                    "enabled": true
                  },
                  {
                    "identifier": "worldInfoAfter",
                    "enabled": true
                  },
                  {
                    "identifier": "dialogueExamples",
                    "enabled": true
                  },
                  {
                    "identifier": "chatHistory",
                    "enabled": true
                  },
                  {
                    "identifier": "jailbreak",
                    "enabled": true
                  }
                ]
              }
            ],
            
            // 其他参数
            assistant_prefill: "",
            assistant_impersonation: "",
            use_sysprompt: false,
            squash_system_messages: false,
            media_inlining: true,
            continue_prefill: false,
            continue_postfix: " ",
            seed: -1,
            n: 1,
            
            // 高级参数
            rep_pen_range: config.rep_pen_range ?? 0,
            rep_pen_decay: config.rep_pen_decay ?? 0,
            rep_pen_slope: config.rep_pen_slope ?? 1,
            no_repeat_ngram_size: config.no_repeat_ngram_size ?? 0,
            penalty_alpha: config.penalty_alpha ?? 0,
            num_beams: config.num_beams ?? 1,
            length_penalty: config.length_penalty ?? 1,
            min_length: config.min_length ?? 0,
            encoder_rep_pen: config.encoder_rep_pen ?? 1,
            skew: config.skew ?? 0,
            do_sample: config.do_sample ?? true,
            early_stopping: config.early_stopping ?? false,
            dynatemp: config.dynatemp ?? false,
            min_temp: config.min_temp ?? 0,
            max_temp: config.max_temp ?? 2,
            dynatemp_exponent: config.dynatemp_exponent ?? 1,
            smoothing_factor: config.smoothing_factor ?? 0,
            smoothing_curve: config.smoothing_curve ?? 1,
            dry_allowed_length: config.dry_allowed_length ?? 2,
            dry_multiplier: config.dry_multiplier ?? 0,
            dry_base: config.dry_base ?? 1.75,
            add_bos_token: config.add_bos_token ?? true,
            ban_eos_token: config.ban_eos_token ?? false,
            skip_special_tokens: config.skip_special_tokens ?? true,
            mirostat_mode: config.mirostat_mode ?? 0,
            mirostat_tau: config.mirostat_tau ?? 5,
            mirostat_eta: config.mirostat_eta ?? 0.1,
            guidance_scale: config.guidance_scale ?? 1,
            xtc_threshold: config.xtc_threshold ?? 0.1,
            xtc_probability: config.xtc_probability ?? 0,
            nsigma: config.nsigma ?? 0,
            min_keep: config.min_keep ?? 0,
            adaptive_target: config.adaptive_target ?? -0.01,
            adaptive_decay: config.adaptive_decay ?? 0.9,
            rep_pen_size: config.rep_pen_size ?? 0,
            genamt: config.genamt ?? 350,
            max_length: config.max_length ?? 8192
          };
          
          fs.writeFileSync(openAISettingsPath, JSON.stringify(openAIPreset, null, 2), 'utf-8');
          console.log(`OpenAI preset ${presetName} updated successfully`);
          
          // 更新settings.json中的当前预设
          existingConfig.openai_preset = presetName;
        }
      }
      
      // 保存更新后的配置
      fs.writeFileSync(settingsPath, JSON.stringify(existingConfig, null, 2), 'utf-8');
      
      return { success: true, message: 'SillyTavern config updated successfully' };
    } catch (error) {
      console.error('Error updating SillyTavern config:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update SillyTavern config'
      };
    }
  }
}

let mainWindow: BrowserWindow | null = null;
let sillyTavernHandler: SillyTavernHandler | null = null;

// 全局日志发送函数，用于从其他模块发送日志到渲染进程
export function sendLogToRenderer(message: string, type: 'error' | 'warn' | 'info' | 'debug' = 'info') {
  if (mainWindow && mainWindow.webContents) {
    try {
      mainWindow.webContents.send('memory:log', message, type);
    } catch (error) {
      console.error('Error sending log to renderer:', error);
    }
  }
  // 同时打印到控制台
  console.log(`[${type.toUpperCase()}] ${message}`);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false
    },
    frame: true,
    titleBarStyle: 'default',
    backgroundColor: '#ffffff'
  });

  if (isDev) {
    // 动态加载Vite开发服务器，使用实际的端口
    // Vite开发服务器运行在5173端口
    const devUrl = 'http://localhost:5173';
    console.log(`Loading development URL: ${devUrl}`);
    mainWindow.loadURL(devUrl);
  } else {
    console.log('Loading production file');
    mainWindow.loadFile(path.join(__dirname, '../index.html'));
  }

  mainWindow.on('close', () => {
    // 执行最高级别清理，强制终止所有SillyTavern进程
    if (sillyTavernHandler) {
      sillyTavernHandler.forceCleanup();
      // 使用英文日志避免乱码
      console.log('Stopping SillyTavern process...');
      // 添加0.5秒延时，确保所有SillyTavern进程被清理
      setTimeout(() => {
        console.log('SillyTavern process stopped');
      }, 500);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  createWindow();
  // 在 mainWindow 创建后实例化 SillyTavernHandler
  sillyTavernHandler = new SillyTavernHandler();
  console.log('sillyTavernHandler initialized:', sillyTavernHandler);
  setupIpcHandlers();
  registerMemoryHandlers();

  // 测试角色卡
  try {
    // 导入 characterService
    const path = require('path');
    const characterServicePath = path.join(__dirname, 'services', 'characterService');
    console.log('Character service path:', characterServicePath);
    const { characterService } = require(characterServicePath);
    // 测试 v2 角色卡
    console.log('Testing v2 character card...');
    await characterService.testReadCharacter('G:\\AI\\travenManager\\main_homeless-dog-ponporio-990658749ba1_spec_v2.png');
    // 测试 v3 角色卡
    console.log('Testing v3 character card...');
    await characterService.testReadCharacter('G:\\AI\\travenManager\\main_lomadi-your-assigned-kitsunegirl-2bfcdfa3a2e9_spec_v2.png');
  } catch (error) {
    console.error('Failed to test character cards:', error);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      // 重新实例化SillyTavernHandler
      sillyTavernHandler = new SillyTavernHandler();
    }
  });
});

app.on('window-all-closed', () => {
  // 执行最高级别清理，强制终止所有SillyTavern进程
  if (sillyTavernHandler) {
    sillyTavernHandler.forceCleanup();
    console.log('Stopped SillyTavern process on app close');
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
