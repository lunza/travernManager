import { ipcMain, dialog, shell } from 'electron';
import { fileService } from '../../services/fileService';

export function fileHandlers() {
  ipcMain.handle('file:selectDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('file:selectFile', async (_event, filters: any[]) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('file:exists', async (_event, path: string) => {
    return await fileService.exists(path);
  });

  ipcMain.handle('file:read', async (_event, path: string) => {
    return await fileService.readFile(path);
  });

  ipcMain.handle('file:write', async (_event, path: string, content: string) => {
    return await fileService.writeFile(path, content);
  });

  ipcMain.handle('file:openFolder', async (_event, path: string) => {
    try {
      let folderPath: string;
      
      // 处理特殊路径标识符
      if (path === 'worldbook') {
        // 构建世界书存储路径
        const { app } = require('electron');
        const path = require('path');
        const fs = require('fs');
        
        // 获取应用程序路径
        const appPath = app.isPackaged ? app.getAppPath() : path.resolve(__dirname, '../../..');
        console.log('App path:', appPath);
        
        // 构建世界书存储路径
        folderPath = path.join(appPath, 'sillytavern-source', 'SillyTavern-1.17.0', 'data', 'default-user', 'worlds');
        console.log('World book folder path:', folderPath);
        
        // 检查路径是否存在
        if (!fs.existsSync(folderPath)) {
          console.log('Folder does not exist:', folderPath);
          // 尝试使用当前工作目录作为基础路径
          const cwd = process.cwd();
          folderPath = path.join(cwd, 'sillytavern-source', 'SillyTavern-1.17.0', 'data', 'default-user', 'worlds');
          console.log('Using cwd-based path:', folderPath);
          
          // 尝试创建目录结构
          if (!fs.existsSync(folderPath)) {
            try {
              fs.mkdirSync(folderPath, { recursive: true });
              console.log('Created directory:', folderPath);
            } catch (error) {
              console.error('Error creating directory:', error);
            }
          }
        }
      } else if (path === 'character') {
        // 构建角色卡存储路径
        const { app } = require('electron');
        const path = require('path');
        const fs = require('fs');
        
        // 获取应用程序路径
        const appPath = app.isPackaged ? app.getAppPath() : path.resolve(__dirname, '../../..');
        console.log('App path:', appPath);
        
        // 构建角色卡存储路径
        folderPath = path.join(appPath, 'sillytavern-source', 'SillyTavern-1.17.0', 'data', 'default-user', 'characters');
        console.log('Character folder path:', folderPath);
        
        // 检查路径是否存在
        if (!fs.existsSync(folderPath)) {
          console.log('Folder does not exist:', folderPath);
          // 尝试使用当前工作目录作为基础路径
          const cwd = process.cwd();
          folderPath = path.join(cwd, 'sillytavern-source', 'SillyTavern-1.17.0', 'data', 'default-user', 'characters');
          console.log('Using cwd-based path:', folderPath);
          
          // 尝试创建目录结构
          if (!fs.existsSync(folderPath)) {
            try {
              fs.mkdirSync(folderPath, { recursive: true });
              console.log('Created directory:', folderPath);
            } catch (error) {
              console.error('Error creating directory:', error);
            }
          }
        }
      } else if (path === 'avatar') {
        // 构建用户设定存储路径
        const { app } = require('electron');
        const path = require('path');
        const fs = require('fs');
        
        // 获取应用程序路径
        const appPath = app.isPackaged ? app.getAppPath() : path.resolve(__dirname, '../../..');
        console.log('App path:', appPath);
        
        // 构建用户设定存储路径
        folderPath = path.join(appPath, 'sillytavern-source', 'SillyTavern-1.17.0', 'data', 'default-user', 'User Avatars');
        console.log('Avatar folder path:', folderPath);
        
        // 检查路径是否存在
        if (!fs.existsSync(folderPath)) {
          console.log('Folder does not exist:', folderPath);
          // 尝试使用当前工作目录作为基础路径
          const cwd = process.cwd();
          folderPath = path.join(cwd, 'sillytavern-source', 'SillyTavern-1.17.0', 'data', 'default-user', 'User Avatars');
          console.log('Using cwd-based path:', folderPath);
          
          // 尝试创建目录结构
          if (!fs.existsSync(folderPath)) {
            try {
              fs.mkdirSync(folderPath, { recursive: true });
              console.log('Created directory:', folderPath);
            } catch (error) {
              console.error('Error creating directory:', error);
            }
          }
        }
      } else {
        folderPath = path;
      }
      
      console.log('Opening folder:', folderPath);
      const result = await shell.openPath(folderPath);
      console.log('Shell openPath result:', result);
      
      return { success: true };
    } catch (error) {
      console.error('Error opening folder:', error);
      return { success: false, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle('file:readJson', async (_event, fileName: string) => {
    return await fileService.readJsonFile(fileName);
  });

  ipcMain.handle('file:writeBinary', async (_event, filePath: string, content: string, isBase64: boolean = true) => {
    try {
      await fileService.writeBinaryFile(filePath, content, isBase64);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });
}
