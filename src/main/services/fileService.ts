import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

class FileService {
  private getDataDir(): string {
    const projectRoot = process.cwd();
    return path.join(projectRoot, 'data');
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8');
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    await fs.writeFile(filePath, content, 'utf-8');
  }

  async deleteFile(filePath: string): Promise<void> {
    await fs.unlink(filePath);
  }

  async createDirectory(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  async listDirectory(dirPath: string): Promise<string[]> {
    return await fs.readdir(dirPath);
  }

  async readJsonFile(fileName: string): Promise<any> {
    try {
      const dataDir = this.getDataDir();
      const filePath = path.join(dataDir, `${fileName}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Failed to read JSON file ${fileName}:`, error);
      throw error;
    }
  }

  async writeBinaryFile(filePath: string, content: string, isBase64: boolean = true): Promise<void> {
    if (isBase64) {
      const buffer = Buffer.from(content, 'base64');
      await fs.writeFile(filePath, buffer);
    } else {
      await fs.writeFile(filePath, content);
    }
  }
}

export const fileService = new FileService();
