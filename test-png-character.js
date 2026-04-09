const fs = require('fs/promises');
const path = require('path');

// 模拟 characterService
class CharacterService {
  constructor() {
    this.characterDir = 'g:\\AI\\travenManager';
  }

  async writeCharacter(filePath, data) {
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
      } else {
        // 对于其他格式的文件，直接写入
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
      }
      return { success: true };
    } catch (error) {
      console.error('Failed to write character:', error);
      return { success: false, error };
    }
  }

  async readCharacter(filePath) {
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
      } else {
        // 从JSON文件中读取角色信息
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        console.log('JSON character data:', data);
        return data;
      }
    } catch (error) {
      console.error('Failed to read character:', error);
      return null;
    }
  }
}

// 导入必要的库
const extract = require('png-chunks-extract');
const PNGtext = require('png-chunk-text');
const { crc32 } = require('crc');
const { CharacterCard } = require('@lenml/char-card-reader');

// 编码函数
function encode(chunks) {
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

// 测试 PNG 角色卡编辑流程
async function testPNGCharacterEdit() {
  try {
    const characterService = new CharacterService();
    const testFilePath = 'g:\\AI\\travenManager\\main_homeless-dog-ponporio-990658749ba1_spec_v2.png';
    console.log('Testing PNG character card edit flow for:', testFilePath);
    
    // 1. 读取原始角色卡数据
    console.log('Step 1: Reading original character data');
    const originalData = await characterService.readCharacter(testFilePath);
    if (!originalData) {
      console.error('Failed to read original character data');
      return;
    }
    console.log('Original description:', originalData.data.description);
    
    // 2. 模拟翻译过程
    console.log('\nStep 2: Simulating translation');
    const translatedDescription = '这是翻译后的中文描述。';
    console.log('Translated description:', translatedDescription);
    
    // 3. 更新角色卡数据
    console.log('\nStep 3: Updating character data');
    const updatedData = {
      ...originalData,
      data: {
        ...originalData.data,
        description: translatedDescription
      }
    };
    
    // 4. 保存更新后的角色卡数据
    console.log('\nStep 4: Saving updated character data');
    const saveResult = await characterService.writeCharacter(testFilePath, updatedData);
    console.log('Save result:', saveResult);
    
    if (saveResult.success) {
      console.log('Character card saved successfully!');
      
      // 5. 重新读取角色卡数据
      console.log('\nStep 5: Re-reading character data');
      const reReadData = await characterService.readCharacter(testFilePath);
      if (!reReadData) {
        console.error('Failed to re-read character data');
        return;
      }
      console.log('Re-read description:', reReadData.data.description);
      
      // 6. 验证翻译结果是否被正确保存
      console.log('\nStep 6: Verifying translation result');
      if (reReadData.data.description === translatedDescription) {
        console.log('SUCCESS: Translation result was correctly saved!');
      } else {
        console.log('FAILURE: Translation result was not saved!');
        console.log('Expected:', translatedDescription);
        console.log('Actual:', reReadData.data.description);
      }
    } else {
      console.error('Failed to save character card:', saveResult.error);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testPNGCharacterEdit();