import { ipcMain } from 'electron';
import { pluginService } from '../../services/pluginService';

export function pluginHandlers() {
  ipcMain.handle('plugin:getAvailable', async (_event, forceRefresh?: boolean) => {
    return await pluginService.getAvailablePlugins(forceRefresh);
  });

  ipcMain.handle('plugin:getInstalled', async () => {
    return await pluginService.getInstalledPlugins();
  });

  ipcMain.handle('plugin:toggle', async (_event, pluginId: string, enabled: boolean) => {
    return await pluginService.togglePlugin(pluginId, enabled);
  });

  ipcMain.handle('plugin:uninstall', async (_event, pluginId: string) => {
    return await pluginService.uninstallPlugin(pluginId);
  });

  ipcMain.handle('plugin:getDirectory', async () => {
    return pluginService.getPluginDir();
  });

  ipcMain.handle('plugin:setDirectory', async (_event, dir: string) => {
    console.log('plugin:setDirectory called with dir:', dir);
    pluginService.setPluginDir(dir);
    const pluginDir = pluginService.getPluginDir();
    console.log('Plugin directory after setting:', pluginDir);
    return { success: true, pluginDir };
  });

  ipcMain.handle('plugin:checkUpdates', async () => {
    return await pluginService.checkAndUpdatePlugins();
  });

  ipcMain.handle('plugin:updateDescriptions', async (_event, translatedPlugins: any[]) => {
    return await pluginService.updatePluginDescriptions(translatedPlugins);
  });

  ipcMain.handle('plugin:install', async (_event, url: string, branch?: string) => {
    return await pluginService.installPlugin(url, branch);
  });

  ipcMain.handle('plugin:uninstallById', async (_event, pluginId: string) => {
    return await pluginService.uninstallPluginById(pluginId);
  });
}
