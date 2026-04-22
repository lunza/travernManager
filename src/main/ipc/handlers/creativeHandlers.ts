import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

interface CreativeItem {
  id: string;
  title: string;
  content: string;
  type: 'character' | 'worldbook';
  status: 'draft' | 'in_progress' | 'completed';
  createdAt: number;
  updatedAt: number;
  tags?: string[];
  versions?: {
    id: string;
    content: string;
    timestamp: number;
  }[];
}

interface CreativeData {
  creativeItems: CreativeItem[];
  currentCreativeId: string | null;
}

function getCreativeDataPath(): string {
  const dataDir = path.join(app.getPath('userData'), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'creative-data.json');
}

function loadCreativeData(): CreativeData {
  const dataPath = getCreativeDataPath();
  try {
    if (fs.existsSync(dataPath)) {
      const data = fs.readFileSync(dataPath, 'utf8');
      const parsed = JSON.parse(data);
      return {
        creativeItems: parsed.creativeItems || [],
        currentCreativeId: parsed.currentCreativeId || null
      };
    }
  } catch (error) {
    console.error('[Creative] Failed to load creative data:', error);
  }
  return {
    creativeItems: [],
    currentCreativeId: null
  };
}

function saveCreativeData(data: CreativeData): boolean {
  const dataPath = getCreativeDataPath();
  try {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('[Creative] Failed to save creative data:', error);
    return false;
  }
}

export function registerCreativeHandlers(): void {
  ipcMain.handle('creative:load', async () => {
    console.log('[Creative] Handler creative:load called');
    return loadCreativeData();
  });

  ipcMain.handle('creative:save', async (_event, data: CreativeData) => {
    console.log('[Creative] Handler creative:save called');
    return saveCreativeData(data);
  });

  ipcMain.handle('creative:export', async () => {
    console.log('[Creative] Handler creative:export called');
    const data = loadCreativeData();
    return JSON.stringify(
      {
        version: '1.0',
        exportTime: new Date().toISOString(),
        ...data
      },
      null,
      2
    );
  });

  ipcMain.handle('creative:import', async (_event, jsonData: string) => {
    console.log('[Creative] Handler creative:import called');
    try {
      const parsed = JSON.parse(jsonData);
      const creativeItems = parsed.creativeItems && Array.isArray(parsed.creativeItems) ? parsed.creativeItems : [];
      const currentCreativeId = parsed.currentCreativeId || (creativeItems.length > 0 ? creativeItems[0].id : null);
      const data: CreativeData = { creativeItems, currentCreativeId };
      saveCreativeData(data);
      return { success: true, data };
    } catch (error) {
      console.error('[Creative] Failed to import creative data:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  console.log('[Creative] Creative handlers registered');
}
