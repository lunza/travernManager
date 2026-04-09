import { ipcMain, app, shell } from 'electron';
import path from 'path';

export function appHandlers() {
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:getPlatform', () => {
    return process.platform;
  });

  ipcMain.handle('app:openPath', async (_event, path: string) => {
    await shell.openPath(path);
  });

  ipcMain.handle('app:getRootPath', () => {
    // 返回应用根目录（main进程所在目录的父目录）
    return path.join(__dirname, '../..');
  });
}
