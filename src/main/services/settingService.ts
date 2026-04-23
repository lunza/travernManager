import fs from 'fs/promises';
import path from 'path';
import JSON5 from 'json5';
// import { settingSchema } from '@shared/schemas/settingSchema';

class SettingService {
  private settingPath: string;

  constructor() {
    this.settingPath = path.join(process.env.HOME || process.env.USERPROFILE || '', 'sillytaven', 'settings.json');
  }

  async readSetting() {
    try {
      const content = await fs.readFile(this.settingPath, 'utf-8');
      return JSON5.parse(content);
    } catch (error) {
      console.error('Failed to read setting:', error);
      return null;
    }
  }

  async writeSetting(setting: any) {
    try {
      // 暂时跳过验证
      await fs.writeFile(this.settingPath, JSON5.stringify(setting, null, 2), 'utf-8');
      return { success: true };
    } catch (error) {
      console.error('Failed to write setting:', error);
      return { success: false, error };
    }
  }

  async validateSetting(setting: any) {
    try {
      // 暂时跳过验证
      return { valid: true };
    } catch (error) {
      return { valid: false, error };
    }
  }

  setSettingPath(path: string) {
    this.settingPath = path;
  }
}

export const settingService = new SettingService();