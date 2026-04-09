import { ipcMain } from 'electron';
import { characterService } from '../../services/characterService';

export function characterHandlers() {
  ipcMain.handle('character:list', async () => {
    return await characterService.listCharacters();
  });

  ipcMain.handle('character:read', async (_event, path: string) => {
    return await characterService.readCharacter(path);
  });

  ipcMain.handle('character:write', async (_event, path: string, data: any) => {
    return await characterService.writeCharacter(path, data);
  });

  ipcMain.handle('character:delete', async (_event, path: string) => {
    return await characterService.deleteCharacter(path);
  });

  ipcMain.handle('character:optimize', async (_event, path: string) => {
    return await characterService.optimizeCharacter(path);
  });

  ipcMain.handle('character:getDirectory', async () => {
    return characterService.getCharacterDir();
  });

  ipcMain.handle('character:testRead', async (_event, filePath: string) => {
    return await characterService.testReadCharacter(filePath);
  });

  ipcMain.handle('character:setDirectory', async (_event, dir: string) => {
    console.log('character:setDirectory called with dir:', dir);
    characterService.setCharacterDir(dir);
    const characterDir = characterService.getCharacterDir();
    console.log('Character directory after setting:', characterDir);
    return { success: true, characterDir };
  });
}
