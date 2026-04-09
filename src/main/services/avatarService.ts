import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import JSON5 from 'json5';

class AvatarService {
  private avatarDir: string;
  private settingsPath: string;

  constructor() {
    const projectRoot = process.cwd();
    this.avatarDir = path.join(projectRoot, 'sillytavern-source/SillyTavern-1.17.0/data/default-user/User Avatars');
    this.settingsPath = path.join(projectRoot, 'sillytavern-source/SillyTavern-1.17.0/data/default-user/settings.json');
    console.log('Avatar directory:', this.avatarDir);
    console.log('Settings file:', this.settingsPath);
    this.ensureDirectoryExists();
  }

  private async ensureDirectoryExists() {
    if (!fsSync.existsSync(this.avatarDir)) {
      await fs.mkdir(this.avatarDir, { recursive: true });
      console.log('Created avatar directory:', this.avatarDir);
    }
  }

  private async readSettings() {
    try {
      if (!fsSync.existsSync(this.settingsPath)) {
        console.warn('Settings file not found');
        return { power_user: { personas: {}, persona_descriptions: {} } };
      }
      const content = await fs.readFile(this.settingsPath, 'utf8');
      return JSON5.parse(content);
    } catch (error) {
      console.error('Failed to read settings:', error);
      return { power_user: { personas: {}, persona_descriptions: {} } };
    }
  }

  private async writeSettings(settings: any) {
    try {
      await fs.writeFile(this.settingsPath, JSON.stringify(settings, null, 2), 'utf8');
      return { success: true };
    } catch (error) {
      console.error('Failed to write settings:', error);
      return { success: false, error };
    }
  }

  async listAvatars() {
    try {
      await this.ensureDirectoryExists();
      const settings = await this.readSettings();
      const personas = settings.power_user?.personas || {};
      const personaDescriptions = settings.power_user?.persona_descriptions || {};
      
      const files = await fs.readdir(this.avatarDir);
      const avatars = await Promise.all(
        files
          .filter(f => f.endsWith('.png'))
          .map(async file => {
            const filePath = path.join(this.avatarDir, file);
            const stats = await fs.stat(filePath);
            
            const personaName = personas[file] || '';
            const personaDesc = personaDescriptions[file] || {};
            
            return {
              name: file,
              path: filePath,
              size: stats.size,
              modified: stats.mtime,
              avatarName: personaName,
              description: personaDesc.description || '',
              position: personaDesc.position || 0,
              depth: personaDesc.depth || 2,
              role: personaDesc.role || 0,
              lorebook: personaDesc.lorebook || '',
              title: personaDesc.title || ''
            };
          })
      );
      return avatars;
    } catch (error) {
      console.error('Failed to list avatars:', error);
      return [];
    }
  }

  async readAvatar(filePath: string) {
    try {
      const fileName = path.basename(filePath);
      const settings = await this.readSettings();
      const personaDescriptions = settings.power_user?.persona_descriptions || {};
      const personas = settings.power_user?.personas || {};
      
      const personaName = personas[fileName] || '';
      const personaDesc = personaDescriptions[fileName] || {};
      
      const result = {
        name: personaName,
        description: personaDesc.description || '',
        data: {
          name: personaName,
          description: personaDesc.description || '',
          creator_notes: '',
          persona: personaDesc,
          creator: '',
          character_version: ''
        }
      };
      
      return result;
    } catch (error) {
      console.error('Failed to read avatar:', error);
      return null;
    }
  }

  async writeAvatar(filePath: string, data: any) {
    try {
      const fileName = path.basename(filePath);
      const settings = await this.readSettings();
      
      if (!settings.power_user) {
        settings.power_user = {};
      }
      if (!settings.power_user.personas) {
        settings.power_user.personas = {};
      }
      if (!settings.power_user.persona_descriptions) {
        settings.power_user.persona_descriptions = {};
      }
      
      settings.power_user.personas[fileName] = data.name || data.data?.name || '';
      
      const currentDesc = settings.power_user.persona_descriptions[fileName] || {
        description: '',
        position: 0,
        depth: 2,
        role: 0,
        lorebook: '',
        title: ''
      };
      
      settings.power_user.persona_descriptions[fileName] = {
        ...currentDesc,
        description: data.description || data.data?.description || currentDesc.description
      };
      
      return await this.writeSettings(settings);
    } catch (error) {
      console.error('Failed to write avatar:', error);
      return { success: false, error };
    }
  }

  async deleteAvatar(filePath: string) {
    try {
      const fileName = path.basename(filePath);
      const settings = await this.readSettings();
      
      if (settings.power_user?.personas) {
        delete settings.power_user.personas[fileName];
      }
      if (settings.power_user?.persona_descriptions) {
        delete settings.power_user.persona_descriptions[fileName];
      }
      
      await this.writeSettings(settings);
      await fs.unlink(filePath);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete avatar:', error);
      return { success: false, error };
    }
  }

  setAvatarDir(dir: string) {
    let resolvedPath = dir;
    if (!path.isAbsolute(dir)) {
      const appRootDir = process.cwd();
      console.log('TravenManager 安装目录:', appRootDir);
      console.log('相对路径:', dir);
      resolvedPath = path.resolve(appRootDir, dir);
      console.log('拼接后的完整路径:', resolvedPath);
    } else {
      console.log('绝对路径:', dir);
    }
    this.avatarDir = path.normalize(resolvedPath);
    console.log('Avatar directory set to:', this.avatarDir);
    this.ensureDirectoryExists();
  }

  getAvatarDir() {
    return this.avatarDir;
  }
}

export const avatarService = new AvatarService();
