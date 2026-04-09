const fs = require('fs/promises');
const { CharacterCard } = require('@lenml/char-card-reader');

async function testCharacterCard() {
  try {
    const filePath = 'g:\\AI\\travenManager\\main_ceroba-ketsukane-deltarune-yellow-27191f94b087_spec_v2.png';
    console.log('Testing character card:', filePath);
    
    // 读取文件
    const fileBuffer = await fs.readFile(filePath);
    console.log('File read successfully, size:', fileBuffer.length);
    
    // 尝试解析角色卡
    const card = await CharacterCard.from_file(fileBuffer);
    console.log('CharacterCard created successfully');
    
    // 输出角色信息
    console.log('Name:', card.name);
    console.log('Description:', card.description);
    console.log('Personality:', card.personality);
    console.log('Scenario:', card.scenario);
    
    console.log('Test passed!');
  } catch (error) {
    console.error('Error:', error);
  }
}

testCharacterCard();