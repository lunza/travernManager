import fs from 'fs/promises';
import path from 'path';
import JSON5 from 'json5';
import { CharacterCard } from '@lenml/char-card-reader';
import { optimizerService } from './optimizerService';
import extract from 'png-chunks-extract';
import PNGtext from 'png-chunk-text';
import { crc32 } from 'crc';

/**
 * Encodes PNG chunks into a PNG file format buffer.
 * @param {Array<{ name: string; data: Uint8Array }>} chunks Array of PNG chunks
 * @returns {Uint8Array} Encoded PNG data
 * @copyright Based on https://github.com/hughsk/png-chunks-encode (MIT)
 */
function encode(chunks: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const uint8 = new Uint8Array(4);
  const int32 = new Int32Array(uint8.buffer);
  const uint32 = new Uint32Array(uint8.buffer);

  let totalSize = 8;
  let idx = totalSize;

  for (let i = 0; i < chunks.length; i++) {
    totalSize += chunks[i].data.length;
    totalSize += 12;
  }

  const output = new Uint8Array(totalSize);

  output[0] = 0x89;
  output[1] = 0x50;
  output[2] = 0x4E;
  output[3] = 0x47;
  output[4] = 0x0D;
  output[5] = 0x0A;
  output[6] = 0x1A;
  output[7] = 0x0A;

  for (let i = 0; i < chunks.length; i++) {
    const { name, data } = chunks[i];
    const size = data.length;
    const nameChars = [
      name.charCodeAt(0),
      name.charCodeAt(1),
      name.charCodeAt(2),
      name.charCodeAt(3),
    ];

    uint32[0] = size;
    output[idx++] = uint8[3];
    output[idx++] = uint8[2];
    output[idx++] = uint8[1];
    output[idx++] = uint8[0];

    output[idx++] = nameChars[0];
    output[idx++] = nameChars[1];
    output[idx++] = nameChars[2];
    output[idx++] = nameChars[3];

    for (let j = 0; j < size;) {
      output[idx++] = data[j++];
    }

    const crc = crc32(data, crc32(new Uint8Array(nameChars)));

    int32[0] = crc;
    output[idx++] = uint8[3];
    output[idx++] = uint8[2];
    output[idx++] = uint8[1];
    output[idx++] = uint8[0];
  }

  return output;
}

class CharacterService {
  private characterDir: string;

  constructor() {
    // 使用 process.cwd() 获取当前工作目录（项目根目录）
    const projectRoot = process.cwd();
    this.characterDir = path.join(projectRoot, 'sillytavern-source/SillyTavern-1.17.0/data/default-user/characters');
    console.log('Project root (process.cwd()):', projectRoot);
    console.log('Character directory:', this.characterDir);
  }

  async listCharacters() {
    try {
      const files = await fs.readdir(this.characterDir);
      const characters = await Promise.all(
        files
          .filter(f => f.endsWith('.json') || f.endsWith('.json5') || f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.webp'))
          .map(async file => {
            const filePath = path.join(this.characterDir, file);
            const stats = await fs.stat(filePath);
            
            // 读取角色卡信息
            let characterName = '';
            let version = '';
            let creator = '';
            let tags: string[] = [];
            
            try {
              const characterData = await this.readCharacter(filePath);
              if (characterData && characterData.data) {
                characterName = characterData.data.name || '';
                version = characterData.data.character_version || '';
                creator = characterData.data.creator || '';
                tags = characterData.data.tags || [];
              }
            } catch (error) {
              console.error('Failed to read character info for', file, error);
            }
            
            return {
              name: file,
              path: filePath,
              size: stats.size,
              modified: stats.mtime,
              characterName,
              version,
              creator,
              tags
            };
          })
      );
      return characters;
    } catch (error) {
      console.error('Failed to list characters:', error);
      return [];
    }
  }

  async readCharacter(filePath: string) {
    try {
      if (filePath.endsWith('.png')) {
        // 对于 PNG 格式的角色卡，使用 CharacterCard 库从图片文件中读取
        console.log(`Reading character from image file: ${filePath}`);
        const fileBuffer = await fs.readFile(filePath);
        const card = await CharacterCard.from_file(fileBuffer);
        console.log('CharacterCard object:', card);
        const specV3 = card.toSpecV3();
        console.log('SpecV3 object:', specV3);
        console.log('SpecV3 data:', specV3.data);
        // 输出所有字段
        console.log('All fields in data:', Object.keys(specV3.data));
        return specV3;
      } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') || filePath.endsWith('.webp')) {
        // 对于 JPEG 和 WebP 格式的角色卡，首先检查是否存在对应的 JSON 文件
        const jsonFilePath = filePath.replace(/\.(jpg|jpeg|webp)$/i, '.json');
        try {
          // 尝试读取 JSON 文件
          const content = await fs.readFile(jsonFilePath, 'utf-8');
          const data = JSON5.parse(content);
          console.log(`Reading character from JSON file: ${jsonFilePath}`);
          console.log('JSON character data:', data);
          return data;
        } catch (error) {
          // 如果 JSON 文件不存在，尝试从图片文件中读取
          console.log(`Reading character from image file: ${filePath}`);
          const fileBuffer = await fs.readFile(filePath);
          const card = await CharacterCard.from_file(fileBuffer);
          console.log('CharacterCard object:', card);
          const specV3 = card.toSpecV3();
          console.log('SpecV3 object:', specV3);
          console.log('SpecV3 data:', specV3.data);
          // 输出所有字段
          console.log('All fields in data:', Object.keys(specV3.data));
          return specV3;
        }
      } else {
        // 从JSON文件中读取角色信息
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON5.parse(content);
        console.log('JSON character data:', data);
        // 输出所有字段
        console.log('All fields in data:', Object.keys(data));
        return data;
      }
    } catch (error) {
      console.error('Failed to read character:', error);
      return null;
    }
  }

  async writeCharacter(filePath: string, data: any) {
    try {
      if (filePath.endsWith('.png')) {
        // 对于 PNG 格式的角色卡，使用与 SillyTavern 相同的方法保存
        const image = await fs.readFile(filePath);
        const chunks = extract(new Uint8Array(image));
        const tEXtChunks = chunks.filter(chunk => chunk.name === 'tEXt');

        // Remove existing tEXt chunks
        for (const tEXtChunk of tEXtChunks) {
          const chunkData = PNGtext.decode(tEXtChunk.data);
          if (chunkData.keyword.toLowerCase() === 'chara' || chunkData.keyword.toLowerCase() === 'ccv3') {
            chunks.splice(chunks.indexOf(tEXtChunk), 1);
          }
        }

        // Add new v2 chunk before the IEND chunk
        const v2Data = JSON.stringify(data.data);
        const base64EncodedData = Buffer.from(v2Data, 'utf8').toString('base64');
        chunks.splice(-1, 0, PNGtext.encode('chara', base64EncodedData));

        // Try adding v3 chunk before the IEND chunk
        try {
          // Change v2 format to v3
          const v3Data = {
            spec: 'chara_card_v3',
            spec_version: '3.0',
            data: data.data
          };

          const base64EncodedData = Buffer.from(JSON.stringify(v3Data), 'utf8').toString('base64');
          chunks.splice(-1, 0, PNGtext.encode('ccv3', base64EncodedData));
        } catch (error) {
          // Ignore errors when adding v3 chunk
          console.error('Error adding v3 chunk:', error);
        }

        // Encode and save the updated image
        const newBuffer = Buffer.from(encode(chunks));
        await fs.writeFile(filePath, newBuffer);
        console.log(`Character card saved as PNG: ${filePath}`);
      } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') || filePath.endsWith('.webp')) {
        // 对于 JPEG 和 WebP 格式的角色卡，创建一个对应的 JSON 文件来保存更新后的角色卡数据
        const jsonFilePath = filePath.replace(/\.(jpg|jpeg|webp)$/i, '.json');
        // 保存为 JSON 文件
        await fs.writeFile(jsonFilePath, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`Character card saved as JSON: ${jsonFilePath}`);
      } else {
        // 对于 JSON 文件，直接写入
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
      }
      return { success: true };
    } catch (error) {
      console.error('Failed to write character:', error);
      return { success: false, error };
    }
  }

  async deleteCharacter(filePath: string) {
    try {
      await fs.unlink(filePath);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete character:', error);
      return { success: false, error };
    }
  }

  async optimizeCharacter(filePath: string) {
    try {
      const data = await this.readCharacter(filePath);
      if (!data) return { success: false, error: 'Failed to read character' };

      const optimized = await optimizerService.optimizeCharacter(data);
      await this.writeCharacter(filePath, optimized);

      return { success: true, optimized };
    } catch (error) {
      console.error('Failed to optimize character:', error);
      return { success: false, error };
    }
  }

  setCharacterDir(dir: string) {
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
    this.characterDir = path.normalize(resolvedPath);
    console.log('Character directory set to:', this.characterDir);
  }

  getCharacterDir() {
    return this.characterDir;
  }

  // 测试方法：读取指定的角色卡文件并输出其完整结构
  async testReadCharacter(filePath: string) {
    try {
      console.log('Testing character file:', filePath);
      const fileBuffer = await fs.readFile(filePath);
      const card = await CharacterCard.from_file(fileBuffer);
      console.log('CharacterCard object:', card);
      const specV3 = card.toSpecV3();
      console.log('SpecV3 object:', specV3);
      console.log('SpecV3 data:', specV3.data);
      // 输出所有字段
      console.log('All fields in data:', Object.keys(specV3.data));
      // 递归输出所有嵌套字段
      this.logNestedFields(specV3.data, '');
      return specV3;
    } catch (error) {
      console.error('Failed to test read character:', error);
      return null;
    }
  }

  // 递归输出所有嵌套字段
  private logNestedFields(obj: any, prefix: string) {
    if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        const fullPath = prefix ? `${prefix}.${key}` : key;
        console.log(`Field: ${fullPath}`);
        if (typeof value === 'object' && value !== null) {
          this.logNestedFields(value, fullPath);
        }
      }
    }
  }
}

export const characterService = new CharacterService();

// 测试角色卡
(async () => {
  try {
    // 测试 v2 角色卡
    console.log('Testing v2 character card...');
    await characterService.testReadCharacter('G:\\AI\\travenManager\\main_homeless-dog-ponporio-990658749ba1_spec_v2.png');
    // 测试 v3 角色卡
    console.log('Testing v3 character card...');
    await characterService.testReadCharacter('G:\\AI\\travenManager\\main_lomadi-your-assigned-kitsunegirl-2bfcdfa3a2e9_spec_v2.png');
  } catch (error) {
    console.error('Failed to test character cards:', error);
  }
})();
