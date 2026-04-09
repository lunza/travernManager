const fs = require('fs/promises');
const path = require('path');

// 模拟 characterService
class CharacterService {
  constructor() {
    this.characterDir = 'g:\\AI\\travenManager';
  }

  async writeCharacter(filePath, data) {
    try {
      if (filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') || filePath.endsWith('.webp')) {
        // 对于图片格式的角色卡，由于 CharacterCard 库没有提供写入功能，
        // 我们将创建一个对应的 JSON 文件来保存更新后的角色卡数据
        const jsonFilePath = filePath.replace(/\.(png|jpg|jpeg|webp)$/i, '.json');
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

  async readCharacter(filePath) {
    try {
      if (filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') || filePath.endsWith('.webp')) {
        // 首先检查是否存在对应的 JSON 文件
        const jsonFilePath = filePath.replace(/\.(png|jpg|jpeg|webp)$/i, '.json');
        try {
          // 尝试读取 JSON 文件
          const content = await fs.readFile(jsonFilePath, 'utf-8');
          const data = JSON.parse(content);
          console.log(`Reading character from JSON file: ${jsonFilePath}`);
          return data;
        } catch (error) {
          // 如果 JSON 文件不存在，返回模拟数据
          console.log(`Reading character from image file: ${filePath}`);
          return {
            spec: 'chara_card_v3',
            spec_version: '3.0',
            data: {
              name: 'Ceroba Ketsukane',
              description: 'This is the original English description.',
              personality: 'Original personality',
              scenario: 'Original scenario',
              first_mes: 'Hello!',
              mes_example: ['Original example message.'],
              creator_notes: 'Original creator notes',
              nickname: 'Ceroba',
              source: 'Deltarune Yellow',
              character_version: '1.0',
              creator: 'Test Creator',
              tags: ['test', 'example'],
              system_prompt: 'Original system prompt',
              post_history_instructions: 'Original post history instructions',
              alternate_greetings: ['Hi there!'],
              group_only_greetings: false
            }
          };
        }
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

// 测试角色卡编辑流程
async function testCharacterEdit() {
  try {
    const characterService = new CharacterService();
    const testFilePath = 'g:\\AI\\travenManager\\main_ceroba-ketsukane-deltarune-yellow-27191f94b087_spec_v2.png';
    console.log('Testing character card edit flow for:', testFilePath);
    
    // 1. 读取原始角色卡数据
    console.log('Step 1: Reading original character data');
    const originalData = await characterService.readCharacter(testFilePath);
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

testCharacterEdit();