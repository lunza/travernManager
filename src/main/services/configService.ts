import fs from 'fs/promises';
import path from 'path';
import JSON5 from 'json5';
// import { configSchema } from '@shared/schemas/configSchema';

class ConfigService {
  private configPath: string;

  constructor() {
    this.configPath = path.join(process.env.HOME || process.env.USERPROFILE || '', 'sillytaven', 'config.json');
  }

  async readConfig() {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      return JSON5.parse(content);
    } catch (error) {
      console.error('Failed to read config:', error);
      return null;
    }
  }

  async writeConfig(config: any) {
    try {
      // 暂时跳过验证
      await fs.writeFile(this.configPath, JSON5.stringify(config, null, 2), 'utf-8');
      return { success: true };
    } catch (error) {
      console.error('Failed to write config:', error);
      return { success: false, error };
    }
  }

  async validateConfig(config: any) {
    try {
      // 暂时跳过验证
      return { valid: true };
    } catch (error) {
      return { valid: false, error };
    }
  }

  setConfigPath(path: string) {
    this.configPath = path;
  }
}

export const configService = new ConfigService();
