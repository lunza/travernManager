import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

// 聊天消息接口
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

// 角色卡测试对话
interface CharacterTestChat {
  id: string;
  creativeId: string;
  characterCardId: string;
  characterCardName: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

// 角色卡生成对话
interface CharacterGenerationChat {
  id: string;
  creativeId: string;
  targetType: 'character' | 'worldbook';
  name: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

// 对话数据总接口
interface ChatData {
  characterTestChats: CharacterTestChat[];
  characterGenerationChats: CharacterGenerationChat[];
}

// 获取对话数据存储路径
function getChatDataPath(): string {
  const dataDir = path.join(app.getPath('userData'), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'character-chats.json');
}

// 加载对话数据
function loadChatData(): ChatData {
  const dataPath = getChatDataPath();
  try {
    if (fs.existsSync(dataPath)) {
      const data = fs.readFileSync(dataPath, 'utf8');
      const parsed = JSON.parse(data);
      return {
        characterTestChats: parsed.characterTestChats || [],
        characterGenerationChats: parsed.characterGenerationChats || []
      };
    }
  } catch (error) {
    console.error('[Chat] Failed to load chat data:', error);
  }
  return {
    characterTestChats: [],
    characterGenerationChats: []
  };
}

// 保存对话数据
function saveChatData(data: ChatData): boolean {
  const dataPath = getChatDataPath();
  try {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('[Chat] Failed to save chat data:', error);
    return false;
  }
}

// 获取角色卡测试对话
function getCharacterTestChat(creativeId: string, characterCardId: string): CharacterTestChat | null {
  const chatData = loadChatData();
  return chatData.characterTestChats.find(
    chat => chat.creativeId === creativeId && chat.characterCardId === characterCardId
  ) || null;
}

// 保存角色卡测试对话
function saveCharacterTestChat(
  creativeId: string, 
  characterCardId: string, 
  characterCardName: string, 
  messages: ChatMessage[]
): CharacterTestChat {
  const chatData = loadChatData();
  
  let existingChat = chatData.characterTestChats.find(
    chat => chat.creativeId === creativeId && chat.characterCardId === characterCardId
  );
  
  if (existingChat) {
    // 更新现有对话
    existingChat.messages = messages;
    existingChat.updatedAt = Date.now();
  } else {
    // 创建新对话
    existingChat = {
      id: `test-chat-${Date.now()}`,
      creativeId,
      characterCardId,
      characterCardName,
      messages,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    chatData.characterTestChats.push(existingChat);
  }
  
  saveChatData(chatData);
  return existingChat;
}

// 删除角色卡测试对话
function deleteCharacterTestChat(creativeId: string, characterCardId: string): boolean {
  const chatData = loadChatData();
  const initialLength = chatData.characterTestChats.length;
  chatData.characterTestChats = chatData.characterTestChats.filter(
    chat => !(chat.creativeId === creativeId && chat.characterCardId === characterCardId)
  );
  
  if (chatData.characterTestChats.length !== initialLength) {
    saveChatData(chatData);
    return true;
  }
  return false;
}

// 获取角色卡生成对话
function getCharacterGenerationChat(
  creativeId: string, 
  targetType: 'character' | 'worldbook', 
  name: string
): CharacterGenerationChat | null {
  const chatData = loadChatData();
  return chatData.characterGenerationChats.find(
    chat => chat.creativeId === creativeId && chat.targetType === targetType && chat.name === name
  ) || null;
}

// 保存角色卡生成对话
function saveCharacterGenerationChat(
  creativeId: string, 
  targetType: 'character' | 'worldbook', 
  name: string, 
  messages: ChatMessage[]
): CharacterGenerationChat {
  const chatData = loadChatData();
  
  let existingChat = chatData.characterGenerationChats.find(
    chat => chat.creativeId === creativeId && chat.targetType === targetType && chat.name === name
  );
  
  if (existingChat) {
    existingChat.messages = messages;
    existingChat.updatedAt = Date.now();
  } else {
    existingChat = {
      id: `gen-chat-${Date.now()}`,
      creativeId,
      targetType,
      name,
      messages,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    chatData.characterGenerationChats.push(existingChat);
  }
  
  saveChatData(chatData);
  return existingChat;
}

// 删除角色卡生成对话
function deleteCharacterGenerationChat(
  creativeId: string, 
  targetType: 'character' | 'worldbook', 
  name: string
): boolean {
  const chatData = loadChatData();
  const initialLength = chatData.characterGenerationChats.length;
  chatData.characterGenerationChats = chatData.characterGenerationChats.filter(
    chat => !(chat.creativeId === creativeId && chat.targetType === targetType && chat.name === name)
  );
  
  if (chatData.characterGenerationChats.length !== initialLength) {
    saveChatData(chatData);
    return true;
  }
  return false;
}

// 获取所有角色卡测试对话
function getAllCharacterTestChats(): CharacterTestChat[] {
  return loadChatData().characterTestChats;
}

// 获取所有角色卡生成对话
function getAllCharacterGenerationChats(): CharacterGenerationChat[] {
  return loadChatData().characterGenerationChats;
}

// 注册IPC处理函数
export function registerCharacterChatHandlers(): void {
  // 获取角色卡测试对话
  ipcMain.handle('characterChat:getTestChat', (_event, creativeId: string, characterCardId: string) => {
    console.log('[Chat] Getting test chat for:', creativeId, characterCardId);
    return getCharacterTestChat(creativeId, characterCardId);
  });
  
  // 保存角色卡测试对话
  ipcMain.handle('characterChat:saveTestChat', (
    _event, 
    creativeId: string, 
    characterCardId: string, 
    characterCardName: string, 
    messages: ChatMessage[]
  ) => {
    console.log('[Chat] Saving test chat for:', creativeId, characterCardId);
    return saveCharacterTestChat(creativeId, characterCardId, characterCardName, messages);
  });
  
  // 删除角色卡测试对话
  ipcMain.handle('characterChat:deleteTestChat', (_event, creativeId: string, characterCardId: string) => {
    console.log('[Chat] Deleting test chat for:', creativeId, characterCardId);
    return deleteCharacterTestChat(creativeId, characterCardId);
  });
  
  // 获取角色卡生成对话
  ipcMain.handle('characterChat:getGenerationChat', (
    _event, 
    creativeId: string, 
    targetType: 'character' | 'worldbook', 
    name: string
  ) => {
    console.log('[Chat] Getting generation chat for:', creativeId, targetType, name);
    return getCharacterGenerationChat(creativeId, targetType, name);
  });
  
  // 保存角色卡生成对话
  ipcMain.handle('characterChat:saveGenerationChat', (
    _event, 
    creativeId: string, 
    targetType: 'character' | 'worldbook', 
    name: string, 
    messages: ChatMessage[]
  ) => {
    console.log('[Chat] Saving generation chat for:', creativeId, targetType, name);
    return saveCharacterGenerationChat(creativeId, targetType, name, messages);
  });
  
  // 删除角色卡生成对话
  ipcMain.handle('characterChat:deleteGenerationChat', (
    _event, 
    creativeId: string, 
    targetType: 'character' | 'worldbook', 
    name: string
  ) => {
    console.log('[Chat] Deleting generation chat for:', creativeId, targetType, name);
    return deleteCharacterGenerationChat(creativeId, targetType, name);
  });
  
  // 获取所有角色卡测试对话
  ipcMain.handle('characterChat:getAllTestChats', () => {
    return getAllCharacterTestChats();
  });
  
  // 获取所有角色卡生成对话
  ipcMain.handle('characterChat:getAllGenerationChats', () => {
    return getAllCharacterGenerationChats();
  });
  
  console.log('[Chat] Character chat handlers registered');
}
