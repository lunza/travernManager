import { ipcMain } from 'electron';
import { configService } from '../../services/configService';

export function configHandlers() {
  ipcMain.handle('config:read', async () => {
    return await configService.readConfig();
  });

  ipcMain.handle('config:write', async (_event, config: any) => {
    return await configService.writeConfig(config);
  });

  ipcMain.handle('config:validate', async (_event, config: any) => {
    return await configService.validateConfig(config);
  });
}
