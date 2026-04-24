const { dataPersistence } = require('./dist/renderer/components/Common/DataPersistence');

// 测试数据持久化组件
async function testDataPersistence() {
  console.log('开始测试数据持久化组件...');

  try {
    // 测试1: 基本CRUD操作
    console.log('\n=== 测试1: 基本CRUD操作 ===');
    
    // 设置测试数据
    dataPersistence.set('testKey', 'testValue');
    console.log('设置数据: testKey = testValue');
    
    // 获取测试数据
    const value = dataPersistence.get('testKey');
    console.log('获取数据: testKey =', value);
    
    // 更新测试数据
    dataPersistence.update('testKey', (value) => value + ' updated');
    console.log('更新数据: testKey = updated value');
    
    // 获取更新后的数据
    const updatedValue = dataPersistence.get('testKey');
    console.log('获取更新后的数据: testKey =', updatedValue);
    
    // 检查数据是否存在
    const exists = dataPersistence.has('testKey');
    console.log('检查数据是否存在: testKey', exists ? '存在' : '不存在');
    
    // 删除测试数据
    dataPersistence.delete('testKey');
    console.log('删除数据: testKey');
    
    // 检查数据是否已删除
    const deleted = !dataPersistence.has('testKey');
    console.log('检查数据是否已删除: testKey', deleted ? '已删除' : '未删除');

    // 测试2: 分类数据操作
    console.log('\n=== 测试2: 分类数据操作 ===');
    
    // 测试设置和获取设置
    const testSettings = { theme: 'dark', language: 'zh-CN' };
    dataPersistence.setSettings(testSettings);
    console.log('设置设置数据:', testSettings);
    
    const retrievedSettings = dataPersistence.getSettings();
    console.log('获取设置数据:', retrievedSettings);
    
    // 测试设置和获取角色卡
    const testCharacter = {
      id: 'character_1',
      name: '测试角色',
      description: '这是一个测试角色'
    };
    dataPersistence.setCharacter(testCharacter.id, testCharacter);
    console.log('设置角色卡数据:', testCharacter);
    
    const retrievedCharacter = dataPersistence.getCharacter(testCharacter.id);
    console.log('获取角色卡数据:', retrievedCharacter);
    
    // 测试获取所有角色卡
    const allCharacters = dataPersistence.getCharacters();
    console.log('获取所有角色卡:', allCharacters);

    // 测试3: 数据导出和导入
    console.log('\n=== 测试3: 数据导出和导入 ===');
    
    // 导出数据
    const exportedData = dataPersistence.export();
    console.log('导出数据:', exportedData.substring(0, 100) + '...');
    
    // 导入数据
    dataPersistence.import(exportedData);
    console.log('导入数据: 成功');

    // 测试4: 版本控制
    console.log('\n=== 测试4: 版本控制 ===');
    
    const version = dataPersistence.getVersion();
    console.log('当前版本:', version);

    // 测试5: 数据迁移
    console.log('\n=== 测试5: 数据迁移 ===');
    
    dataPersistence.migrateData();
    console.log('数据迁移: 成功');

    // 测试6: 清空数据
    console.log('\n=== 测试6: 清空数据 ===');
    
    dataPersistence.clear();
    console.log('清空数据: 成功');
    
    // 验证数据是否已清空
    const allData = dataPersistence.getAll();
    console.log('清空后的数据:', allData);

    console.log('\n所有测试通过！');
  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 运行测试
testDataPersistence();
