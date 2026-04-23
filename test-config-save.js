
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

console.log('=== Testing config save ===');

// 测试app.getPath('userData')
console.log('Home directory:', process.env.HOME);

// 模拟electron的app.getPath
function getAppDataPath() {
  const home = process.env.HOME || process.env.USERPROFILE;
  return path.join(home, 'Library', 'Application Support', 'sillytaven-manager');
}

const testPath = getAppDataPath();
console.log('User data path:', testPath);

// 检查目录是否存在
if (!fs.existsSync(testPath)) {
  console.log('Creating directory...');
  fs.mkdirSync(testPath, { recursive: true });
  console.log('Directory created');
} else {
  console.log('Directory already exists');
}

// 测试配置文件
const configFile = path.join(testPath, 'config.json');
console.log('Config file:', configFile);

const testConfig = {
  "aiEngines": [
    {
      "id": "engine_123",
      "name": "Test Engine",
      "api_url": "http://127.0.0.1:5000",
      "api_key": "",
      "model_name": "test-model",
      "api_mode": "text_completion",
      "api_key_transmission": "body"
    }
  ],
  "preset_name": "Default",
  "activeEngineId": "engine_123",
  "defaultEngineId": "engine_123"
};

console.log('Test config:', JSON.stringify(testConfig, null, 2));

// 尝试写入文件
try {
  fs.writeFileSync(configFile, JSON.stringify(testConfig, null, 2), 'utf-8');
  console.log('✅ Config file written successfully');
  
  // 尝试读取回来
  const readConfig = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
  console.log('✅ Config file read successfully');
  console.log('Read config:', JSON.stringify(readConfig, null, 2));
  
  console.log('✅ All tests passed!');
} catch (error) {
  console.error('❌ Error:', error);
}
