const fs = require('fs/promises');
const path = require('path');

// 模拟 CharacterCard 类
class CharacterCard {
  static async from_file(file) {
    // 这里只是模拟，实际的实现会从文件中读取角色卡数据
    return new CharacterCard({
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: {
        name: 'Test Character',
        description: 'This is a test character description.',
        personality: 'Test personality',
        scenario: 'Test scenario',
        first_mes: 'Hello!',
        mes_example: ['This is an example message.'],
        creator_notes: 'Test creator notes',
        nickname: 'Test',
        source: 'Test source',
        character_version: '1.0',
        creator: 'Test Creator',
        tags: ['test', 'example'],
        system_prompt: 'Test system prompt',
        post_history_instructions: 'Test post history instructions',
        alternate_greetings: ['Hi there!'],
        group_only_greetings: false
      }
    });
  }

  constructor(raw_data) {
    this.raw_data = raw_data;
  }

  get name() {
    return this.raw_data.data?.name || '';
  }

  get description() {
    return this.raw_data.data?.description || '';
  }

  get personality() {
    return this.raw_data.data?.personality || '';
  }

  get scenario() {
    return this.raw_data.data?.scenario || '';
  }

  get first_mes() {
    return this.raw_data.data?.first_mes || '';
  }

  get mes_example() {
    return this.raw_data.data?.mes_example || [];
  }

  get creator_notes() {
    return this.raw_data.data?.creator_notes || '';
  }

  get nickname() {
    return this.raw_data.data?.nickname || '';
  }

  get source() {
    return this.raw_data.data?.source || '';
  }

  get character_version() {
    return this.raw_data.data?.character_version || '';
  }

  get creator() {
    return this.raw_data.data?.creator || '';
  }

  get tags() {
    return this.raw_data.data?.tags || [];
  }

  get system_prompt() {
    return this.raw_data.data?.system_prompt || '';
  }

  get post_history_instructions() {
    return this.raw_data.data?.post_history_instructions || '';
  }

  get alternate_greetings() {
    return this.raw_data.data?.alternate_greetings || [];
  }

  get group_only_greetings() {
    return this.raw_data.data?.group_only_greetings || false;
  }
}

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
          const jsonContent = await fs.readFile(jsonFilePath, 'utf-8');
          const jsonData = JSON.parse(jsonContent);
          console.log(`Reading character from JSON file: ${jsonFilePath}`);
          return jsonData;
        } catch (error) {
          // 如果 JSON 文件不存在，尝试从图片文件中读取
          console.log(`Reading character from image file: ${filePath}`);
          const fileBuffer = await fs.readFile(filePath);
          const card = await CharacterCard.from_file(fileBuffer);
          return {
            spec: card.raw_data.spec,
            spec_version: card.raw_data.spec_version,
            data: card.raw_data.data
          };
        }
      } else {
        // 对于 JSON 文件，直接读取
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('Failed to read character:', error);
      throw error;
    }
  }
}

// 测试 writeCharacter 方法
async function testWriteCharacter() {
  try {
    const characterService = new CharacterService();
    const testFilePath = 'g:\\AI\\travenManager\\main_ceroba-ketsukane-deltarune-yellow-27191f94b087_spec_v2.png';
    console.log('Testing writeCharacter for:', testFilePath);
    
    // 模拟角色卡数据
    const characterData = {
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: {
        name: 'Ceroba Ketsukane',
        description: 'This is a test description for writing character card data.',
        personality: 'Test personality',
        scenario: 'Test scenario',
        first_mes: 'Hello!',
        mes_example: ['This is an example message.'],
        creator_notes: 'Test creator notes',
        nickname: 'Ceroba',
        source: 'Deltarune Yellow',
        character_version: '1.0',
        creator: 'Test Creator',
        tags: ['test', 'example'],
        system_prompt: 'Test system prompt',
        post_history_instructions: 'Test post history instructions',
        alternate_greetings: ['Hi there!'],
        group_only_greetings: false
      }
    };
    
    // 保存修改后的角色卡数据
    const result = await characterService.writeCharacter(testFilePath, characterData);
    console.log('writeCharacter result:', result);
    
    if (result.success) {
      console.log('Character card saved successfully!');
      
      // 检查是否创建了 JSON 文件
      const jsonFilePath = testFilePath.replace(/\.(png|jpg|jpeg|webp)$/i, '.json');
      const jsonFileExists = await fs.access(jsonFilePath).then(() => true).catch(() => false);
      console.log('JSON file created:', jsonFileExists);
      
      if (jsonFileExists) {
        // 读取 JSON 文件内容
        const jsonContent = await fs.readFile(jsonFilePath, 'utf-8');
        const jsonData = JSON.parse(jsonContent);
        console.log('JSON file content:', jsonData.data.description);
        
        // 测试读取功能
        const readResult = await characterService.readCharacter(testFilePath);
        console.log('readCharacter result:', readResult.data.description);
      }
    } else {
      console.error('Failed to save character card:', result.error);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testWriteCharacter();