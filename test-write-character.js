const fs = require('fs/promises');
const { characterService } = require('./dist/main/index');

async function testWriteCharacter() {
  try {
    const testFilePath = 'g:\\AI\\travenManager\\main_ceroba-ketsukane-deltarune-yellow-27191f94b087_spec_v2.png';
    console.log('Testing writeCharacter for:', testFilePath);
    
    // 首先读取角色卡数据
    const characterData = await characterService.readCharacter(testFilePath);
    console.log('Character data read successfully');
    console.log('Name:', characterData.data.name);
    console.log('Description:', characterData.data.description.substring(0, 100) + '...');
    
    // 修改角色卡数据
    characterData.data.description = 'This is a test description for writing character card data.';
    console.log('Character data modified');
    
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
      }
    } else {
      console.error('Failed to save character card:', result.error);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testWriteCharacter();