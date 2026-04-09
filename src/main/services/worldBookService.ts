import fs from 'fs/promises';
import path from 'path';
import JSON5 from 'json5';
import { optimizerService } from './optimizerService';

class WorldBookService {
  private worldBookDir: string;
  private tagsDir: string;

  constructor() {
    // 使用 process.cwd() 获取当前工作目录（项目根目录）
    const projectRoot = process.cwd();
    this.worldBookDir = path.join(projectRoot, 'sillytavern-source/SillyTavern-1.17.0/data/default-user/worlds');
    this.tagsDir = path.join(projectRoot, 'data', 'worlds');
    console.log('Project root (process.cwd()):', projectRoot);
    console.log('World book directory:', this.worldBookDir);
    console.log('Tags directory:', this.tagsDir);
  }

  async listWorldBooks() {
    console.log('listWorldBooks called');
    try {
      console.log('Reading directory:', this.worldBookDir);
      const files = await fs.readdir(this.worldBookDir);
      console.log('Files found:', files);
      const worldBooks = await Promise.all(
        files
          .filter(f => f.endsWith('.json') || f.endsWith('.json5'))
          .map(async file => {
            const filePath = path.join(this.worldBookDir, file);
            const stats = await fs.stat(filePath);
            return {
              name: file,
              path: filePath,
              size: stats.size,
              modified: stats.mtime
            };
          })
      );
      console.log('World books found:', worldBooks);
      return worldBooks;
    } catch (error) {
      console.error('Failed to list world books:', error);
      return [];
    }
  }

  async readWorldBook(filePath: string) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON5.parse(content);
    } catch (error) {
      console.error('Failed to read world book:', error);
      return null;
    }
  }

  async writeWorldBook(filePath: string, data: any) {
    try {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
      return { success: true };
    } catch (error) {
      console.error('Failed to write world book:', error);
      return { success: false, error };
    }
  }

  async deleteWorldBook(filePath: string) {
    try {
      await fs.unlink(filePath);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete world book:', error);
      return { success: false, error };
    }
  }

  async optimizeWorldBook(filePath: string) {
    try {
      const data = await this.readWorldBook(filePath);
      if (!data) return { success: false, error: 'Failed to read world book' };

      const optimized = await optimizerService.optimizeWorldBook(data);
      await this.writeWorldBook(filePath, optimized);

      return { success: true, optimized };
    } catch (error) {
      console.error('Failed to optimize world book:', error);
      return { success: false, error };
    }
  }

  setWorldBookDir(dir: string) {
    // 解析路径，处理相对路径和绝对路径
    let resolvedPath = dir;
    if (!path.isAbsolute(dir)) {
      // 如果是相对路径，相对于应用程序的根目录解析
      // 应用程序的根目录是 process.cwd()
      const appRootDir = process.cwd();
      console.log('TravenManager 安装目录:', appRootDir);
      console.log('相对路径:', dir);
      resolvedPath = path.resolve(appRootDir, dir);
      console.log('拼接后的完整路径:', resolvedPath);
    } else {
      console.log('绝对路径:', dir);
    }
    // 规范化路径，处理路径分隔符等
    this.worldBookDir = path.normalize(resolvedPath);
    console.log('World book directory set to:', this.worldBookDir);
  }

  getWorldBookDir() {
    return this.worldBookDir;
  }

  getTagsDir() {
    return this.tagsDir;
  }

  private getTagFilePath(worldBookPath: string): string {
    // 从世界书路径中提取文件名（不含扩展名）
    const fileName = path.basename(worldBookPath, path.extname(worldBookPath));
    // 构建标签文件路径：data/worlds/{世界书文件名}.tags.json
    return path.join(this.tagsDir, `${fileName}.tags.json`);
  }

  private async ensureTagsDirExists() {
    try {
      await fs.access(this.tagsDir);
    } catch {
      // 目录不存在，创建它
      await fs.mkdir(this.tagsDir, { recursive: true });
    }
  }

  async readTags(worldBookPath: string) {
    try {
      await this.ensureTagsDirExists();
      const tagFilePath = this.getTagFilePath(worldBookPath);
      console.log('Reading tags from:', tagFilePath);
      const content = await fs.readFile(tagFilePath, 'utf-8');
      return JSON5.parse(content);
    } catch (error) {
      // 如果文件不存在，返回默认的标签数据结构
      if ((error as any).code === 'ENOENT') {
        console.log('Tags file not found, returning default structure');
        return { tags: [], associations: [] };
      }
      console.error('Failed to read tags:', error);
      return null;
    }
  }

  async writeTags(worldBookPath: string, data: any) {
    try {
      await this.ensureTagsDirExists();
      const tagFilePath = this.getTagFilePath(worldBookPath);
      console.log('Writing tags to:', tagFilePath);
      await fs.writeFile(tagFilePath, JSON.stringify(data, null, 2), 'utf-8');
      return { success: true };
    } catch (error) {
      console.error('Failed to write tags:', error);
      return { success: false, error };
    }
  }

  async deleteTags(worldBookPath: string) {
    try {
      const tagFilePath = this.getTagFilePath(worldBookPath);
      console.log('Deleting tags file:', tagFilePath);
      await fs.unlink(tagFilePath);
      return { success: true };
    } catch (error) {
      // 如果文件不存在，也返回成功
      if ((error as any).code === 'ENOENT') {
        console.log('Tags file does not exist, nothing to delete');
        return { success: true };
      }
      console.error('Failed to delete tags:', error);
      return { success: false, error };
    }
  }
}

export const worldBookService = new WorldBookService();
