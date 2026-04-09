import { ipcMain } from 'electron';
import { worldBookService } from '../../services/worldBookService';

export function worldBookHandlers() {
  ipcMain.handle('worldBook:list', async () => {
    return await worldBookService.listWorldBooks();
  });

  ipcMain.handle('worldBook:read', async (_event, path: string) => {
    return await worldBookService.readWorldBook(path);
  });

  ipcMain.handle('worldBook:write', async (_event, path: string, data: any) => {
    return await worldBookService.writeWorldBook(path, data);
  });

  ipcMain.handle('worldBook:delete', async (_event, path: string) => {
    return await worldBookService.deleteWorldBook(path);
  });

  ipcMain.handle('worldBook:optimize', async (_event, path: string) => {
    return await worldBookService.optimizeWorldBook(path);
  });

  ipcMain.handle('worldBook:getDirectory', async () => {
    return worldBookService.getWorldBookDir();
  });

  ipcMain.handle('worldBook:setDirectory', async (_event, dir: string) => {
    console.log('worldBook:setDirectory called with dir:', dir);
    worldBookService.setWorldBookDir(dir);
    const worldBookDir = worldBookService.getWorldBookDir();
    console.log('World book directory after setting:', worldBookDir);
    return { success: true, worldBookDir };
  });

  ipcMain.handle('worldBook:readTags', async (_event, path: string) => {
    return await worldBookService.readTags(path);
  });

  ipcMain.handle('worldBook:writeTags', async (_event, path: string, data: any) => {
    return await worldBookService.writeTags(path, data);
  });

  ipcMain.handle('worldBook:deleteTags', async (_event, path: string) => {
    return await worldBookService.deleteTags(path);
  });
}
