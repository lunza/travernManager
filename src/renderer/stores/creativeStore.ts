import { create } from 'zustand';
import { useLogStore } from './logStore';

// 直接从 logStore 获取 addLog 方法
const addLog = (message: string, type: 'error' | 'warn' | 'info' | 'debug' = 'info', options?: {
  details?: string;
  error?: Error;
  context?: any;
  category?: 'system' | 'ai' | 'setting' | 'network' | 'user' | 'other';
}) => {
  try {
    useLogStore.getState().addLog(message, type, options);
  } catch (e) {
    console.log(`[${type.toUpperCase()}] ${message}`);
    if (options?.context) {
      console.log('Context:', options.context);
    }
  }
};

interface Version {
  id: string;
  content: string;
  timestamp: number;
  description?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface CharacterCard {
  id: string;
  name: string;
  content: string;
  versions: Version[];
  chatHistory: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface WorldBook {
  id: string;
  name: string;
  content: string;
  versions: Version[];
  chatHistory: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface Creative {
  id: string;
  title: string;
  description: string;
  content: string;
  tags: string[];
  characterCards: CharacterCard[];
  worldBooks: WorldBook[];
  createdAt: number;
  updatedAt: number;
}

interface CreativeStore {
  creatives: Creative[];
  currentCreativeId: string | null;
  currentEditorTarget: { type: 'character' | 'worldbook'; id: string } | null;
  isLoading: boolean;
  
  // 创意操作
  addCreative: (title: string, description: string, tags?: string[]) => string;
  updateCreative: (id: string, updates: Partial<Creative>) => boolean;
  deleteCreative: (id: string) => boolean;
  setCurrentCreativeId: (id: string | null) => void;
  setCurrentEditorTarget: (target: { type: 'character' | 'worldbook'; id: string } | null) => void;
  
  // 角色卡操作
  addCharacterCard: (creativeId: string, name: string, content?: string) => string;
  updateCharacterCard: (creativeId: string, characterId: string, updates: Partial<CharacterCard>) => boolean;
  deleteCharacterCard: (creativeId: string, characterId: string) => boolean;
  addCharacterCardVersion: (creativeId: string, characterId: string, content: string, description?: string) => void;
  addCharacterCardChatMessage: (creativeId: string, characterId: string, message: ChatMessage) => void;
  clearCharacterCardChatHistory: (creativeId: string, characterId: string) => void;
  
  // 世界书操作
  addWorldBook: (creativeId: string, name: string, content?: string) => string;
  updateWorldBook: (creativeId: string, worldbookId: string, updates: Partial<WorldBook>) => boolean;
  deleteWorldBook: (creativeId: string, worldbookId: string) => boolean;
  addWorldBookVersion: (creativeId: string, worldbookId: string, content: string, description?: string) => void;
  addWorldBookChatMessage: (creativeId: string, worldbookId: string, message: ChatMessage) => void;
  clearWorldBookChatHistory: (creativeId: string, worldbookId: string) => void;
  
  // 数据操作
  loadCreatives: () => Promise<void>;
  saveCreatives: () => Promise<void>;
  clearCreatives: () => void;
  exportData: () => Promise<string | null>;
  importData: (data: string) => Promise<void>;
  migrateOldData: () => Promise<void>;
  
  // 获取函数
  getCurrentCreative: () => Creative | null;
  getCreativeById: (id: string) => Creative | null;
  getCharacterCardById: (creativeId: string, characterId: string) => CharacterCard | null;
  getWorldBookById: (creativeId: string, worldbookId: string) => WorldBook | null;
  getCurrentEditorContent: () => string;
}

const useCreativeStore = create<CreativeStore>((set, get) => ({
  creatives: [],
  currentCreativeId: null,
  currentEditorTarget: null,
  isLoading: true,

  // ========== 创意操作 ==========
  addCreative: (title, description, tags, content = '') => {
    const newCreative: Creative = {
      id: `creative_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      description,
      content,
      tags: tags || [],
      characterCards: [],
      worldBooks: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    const updatedCreatives = [newCreative, ...get().creatives];
    set({ creatives: updatedCreatives, currentCreativeId: newCreative.id });
    
    get().saveCreatives();
    return newCreative.id;
  },

  updateCreative: (id, updates) => {
    const { creatives } = get();
    const creativeIndex = creatives.findIndex(c => c.id === id);
    if (creativeIndex === -1) return false;
    
    const updatedCreative = {
      ...creatives[creativeIndex],
      ...updates,
      updatedAt: Date.now()
    };
    
    const updatedCreatives = [...creatives];
    updatedCreatives[creativeIndex] = updatedCreative;
    set({ creatives: updatedCreatives });
    
    get().saveCreatives();
    return true;
  },

  deleteCreative: (id) => {
    const { creatives, currentCreativeId, currentEditorTarget } = get();
    const updatedCreatives = creatives.filter(c => c.id !== id);
    
    let newCurrentId = currentCreativeId === id ? (updatedCreatives.length > 0 ? updatedCreatives[0].id : null) : currentCreativeId;
    let newEditorTarget = currentEditorTarget;
    
    if (currentEditorTarget) {
      const creative = creatives.find(c => c.id === id);
      if (creative) {
        const hasTarget = currentEditorTarget.type === 'character' 
          ? creative.characterCards.some(cc => cc.id === currentEditorTarget.id)
          : creative.worldBooks.some(wb => wb.id === currentEditorTarget.id);
        
        if (hasTarget) {
          newEditorTarget = null;
        }
      }
    }
    
    set({ creatives: updatedCreatives, currentCreativeId: newCurrentId, currentEditorTarget: newEditorTarget });
    get().saveCreatives();
    return true;
  },

  setCurrentCreativeId: (id) => {
    set({ currentCreativeId: id });
    get().saveCreatives();
  },

  setCurrentEditorTarget: (target) => {
    set({ currentEditorTarget: target });
  },

  // ========== 角色卡操作 ==========
  addCharacterCard: (creativeId, name, content) => {
    const { creatives } = get();
    const creativeIndex = creatives.findIndex(c => c.id === creativeId);
    if (creativeIndex === -1) return '';
    
    const newCharacterCard: CharacterCard = {
      id: `character_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      content: content || '',
      versions: content ? [{
        id: `version_${Date.now()}`,
        content,
        timestamp: Date.now(),
        description: '初始版本'
      }] : [],
      chatHistory: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    const updatedCreative = {
      ...creatives[creativeIndex],
      characterCards: [...creatives[creativeIndex].characterCards, newCharacterCard],
      updatedAt: Date.now()
    };
    
    const updatedCreatives = [...creatives];
    updatedCreatives[creativeIndex] = updatedCreative;
    set({ creatives: updatedCreatives, currentEditorTarget: { type: 'character', id: newCharacterCard.id } });
    
    get().saveCreatives();
    return newCharacterCard.id;
  },

  updateCharacterCard: (creativeId, characterId, updates) => {
    const { creatives } = get();
    const creativeIndex = creatives.findIndex(c => c.id === creativeId);
    if (creativeIndex === -1) return false;
    
    const creative = creatives[creativeIndex];
    const characterIndex = creative.characterCards.findIndex(cc => cc.id === characterId);
    if (characterIndex === -1) return false;
    
    const updatedCharacter = {
      ...creative.characterCards[characterIndex],
      ...updates,
      updatedAt: Date.now()
    };
    
    const updatedCharacters = [...creative.characterCards];
    updatedCharacters[characterIndex] = updatedCharacter;
    
    const updatedCreative = {
      ...creative,
      characterCards: updatedCharacters,
      updatedAt: Date.now()
    };
    
    const updatedCreatives = [...creatives];
    updatedCreatives[creativeIndex] = updatedCreative;
    set({ creatives: updatedCreatives });
    
    get().saveCreatives();
    return true;
  },

  deleteCharacterCard: (creativeId, characterId) => {
    const { creatives, currentEditorTarget } = get();
    const creativeIndex = creatives.findIndex(c => c.id === creativeId);
    if (creativeIndex === -1) return false;
    
    const creative = creatives[creativeIndex];
    const updatedCharacters = creative.characterCards.filter(cc => cc.id !== characterId);
    
    let newEditorTarget = currentEditorTarget;
    if (currentEditorTarget?.type === 'character' && currentEditorTarget?.id === characterId) {
      newEditorTarget = null;
    }
    
    const updatedCreative = {
      ...creative,
      characterCards: updatedCharacters,
      updatedAt: Date.now()
    };
    
    const updatedCreatives = [...creatives];
    updatedCreatives[creativeIndex] = updatedCreative;
    
    set({ creatives: updatedCreatives, currentEditorTarget: newEditorTarget });
    get().saveCreatives();
    return true;
  },

  addCharacterCardVersion: (creativeId, characterId, content, description) => {
    const { creatives } = get();
    const creativeIndex = creatives.findIndex(c => c.id === creativeId);
    if (creativeIndex === -1) return;
    
    const creative = creatives[creativeIndex];
    const characterIndex = creative.characterCards.findIndex(cc => cc.id === characterId);
    if (characterIndex === -1) return;
    
    const characterCard = creative.characterCards[characterIndex];
    const newVersion: Version = {
      id: `version_${Date.now()}`,
      content,
      timestamp: Date.now(),
      description
    };
    
    const updatedVersions = [newVersion, ...(characterCard.versions || []).slice(0, 19)];
    
    const updatedCharacter = {
      ...characterCard,
      content,
      versions: updatedVersions,
      updatedAt: Date.now()
    };
    
    const updatedCharacters = [...creative.characterCards];
    updatedCharacters[characterIndex] = updatedCharacter;
    
    const updatedCreative = {
      ...creative,
      characterCards: updatedCharacters,
      updatedAt: Date.now()
    };
    
    const updatedCreatives = [...creatives];
    updatedCreatives[creativeIndex] = updatedCreative;
    set({ creatives: updatedCreatives });
    
    get().saveCreatives();
  },

  addCharacterCardChatMessage: (creativeId, characterId, message) => {
    const { creatives } = get();
    const creativeIndex = creatives.findIndex(c => c.id === creativeId);
    if (creativeIndex === -1) return;
    
    const creative = creatives[creativeIndex];
    const characterIndex = creative.characterCards.findIndex(cc => cc.id === characterId);
    if (characterIndex === -1) return;
    
    const characterCard = creative.characterCards[characterIndex];
    const updatedChatHistory = [...characterCard.chatHistory, message];
    
    const updatedCharacter = {
      ...characterCard,
      chatHistory: updatedChatHistory,
      updatedAt: Date.now()
    };
    
    const updatedCharacters = [...creative.characterCards];
    updatedCharacters[characterIndex] = updatedCharacter;
    
    const updatedCreative = {
      ...creative,
      characterCards: updatedCharacters,
      updatedAt: Date.now()
    };
    
    const updatedCreatives = [...creatives];
    updatedCreatives[creativeIndex] = updatedCreative;
    set({ creatives: updatedCreatives });
    
    get().saveCreatives();
  },

  clearCharacterCardChatHistory: (creativeId, characterId) => {
    const { creatives } = get();
    const creativeIndex = creatives.findIndex(c => c.id === creativeId);
    if (creativeIndex === -1) return;
    
    const creative = creatives[creativeIndex];
    const characterIndex = creative.characterCards.findIndex(cc => cc.id === characterId);
    if (characterIndex === -1) return;
    
    const characterCard = creative.characterCards[characterIndex];
    const updatedCharacter = {
      ...characterCard,
      chatHistory: [],
      updatedAt: Date.now()
    };
    
    const updatedCharacters = [...creative.characterCards];
    updatedCharacters[characterIndex] = updatedCharacter;
    
    const updatedCreative = {
      ...creative,
      characterCards: updatedCharacters,
      updatedAt: Date.now()
    };
    
    const updatedCreatives = [...creatives];
    updatedCreatives[creativeIndex] = updatedCreative;
    set({ creatives: updatedCreatives });
    
    get().saveCreatives();
  },

  // ========== 世界书操作 ==========
  addWorldBook: (creativeId, name, content) => {
    const { creatives } = get();
    const creativeIndex = creatives.findIndex(c => c.id === creativeId);
    if (creativeIndex === -1) return '';
    
    const newWorldBook: WorldBook = {
      id: `worldbook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      content: content || '',
      versions: content ? [{
        id: `version_${Date.now()}`,
        content,
        timestamp: Date.now(),
        description: '初始版本'
      }] : [],
      chatHistory: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    const updatedCreative = {
      ...creatives[creativeIndex],
      worldBooks: [...creatives[creativeIndex].worldBooks, newWorldBook],
      updatedAt: Date.now()
    };
    
    const updatedCreatives = [...creatives];
    updatedCreatives[creativeIndex] = updatedCreative;
    set({ creatives: updatedCreatives, currentEditorTarget: { type: 'worldbook', id: newWorldBook.id } });
    
    get().saveCreatives();
    return newWorldBook.id;
  },

  updateWorldBook: (creativeId, worldbookId, updates) => {
    const { creatives } = get();
    const creativeIndex = creatives.findIndex(c => c.id === creativeId);
    if (creativeIndex === -1) return false;
    
    const creative = creatives[creativeIndex];
    const worldbookIndex = creative.worldBooks.findIndex(wb => wb.id === worldbookId);
    if (worldbookIndex === -1) return false;
    
    const updatedWorldBook = {
      ...creative.worldBooks[worldbookIndex],
      ...updates,
      updatedAt: Date.now()
    };
    
    const updatedWorldBooks = [...creative.worldBooks];
    updatedWorldBooks[worldbookIndex] = updatedWorldBook;
    
    const updatedCreative = {
      ...creative,
      worldBooks: updatedWorldBooks,
      updatedAt: Date.now()
    };
    
    const updatedCreatives = [...creatives];
    updatedCreatives[creativeIndex] = updatedCreative;
    set({ creatives: updatedCreatives });
    
    get().saveCreatives();
    return true;
  },

  deleteWorldBook: (creativeId, worldbookId) => {
    const { creatives, currentEditorTarget } = get();
    const creativeIndex = creatives.findIndex(c => c.id === creativeId);
    if (creativeIndex === -1) return false;
    
    const creative = creatives[creativeIndex];
    const updatedWorldBooks = creative.worldBooks.filter(wb => wb.id !== worldbookId);
    
    let newEditorTarget = currentEditorTarget;
    if (currentEditorTarget?.type === 'worldbook' && currentEditorTarget?.id === worldbookId) {
      newEditorTarget = null;
    }
    
    const updatedCreative = {
      ...creative,
      worldBooks: updatedWorldBooks,
      updatedAt: Date.now()
    };
    
    const updatedCreatives = [...creatives];
    updatedCreatives[creativeIndex] = updatedCreative;
    set({ creatives: updatedCreatives, currentEditorTarget: newEditorTarget });
    
    get().saveCreatives();
    return true;
  },

  addWorldBookVersion: (creativeId, worldbookId, content, description) => {
    const { creatives } = get();
    const creativeIndex = creatives.findIndex(c => c.id === creativeId);
    if (creativeIndex === -1) return;
    
    const creative = creatives[creativeIndex];
    const worldbookIndex = creative.worldBooks.findIndex(wb => wb.id === worldbookId);
    if (worldbookIndex === -1) return;
    
    const worldBook = creative.worldBooks[worldbookIndex];
    const newVersion: Version = {
      id: `version_${Date.now()}`,
      content,
      timestamp: Date.now(),
      description
    };
    
    const updatedVersions = [newVersion, ...(worldBook.versions || []).slice(0, 19)];
    
    const updatedWorldBook = {
      ...worldBook,
      content,
      versions: updatedVersions,
      updatedAt: Date.now()
    };
    
    const updatedWorldBooks = [...creative.worldBooks];
    updatedWorldBooks[worldbookIndex] = updatedWorldBook;
    
    const updatedCreative = {
      ...creative,
      worldBooks: updatedWorldBooks,
      updatedAt: Date.now()
    };
    
    const updatedCreatives = [...creatives];
    updatedCreatives[creativeIndex] = updatedCreative;
    set({ creatives: updatedCreatives });
    
    get().saveCreatives();
  },

  addWorldBookChatMessage: (creativeId, worldbookId, message) => {
    const { creatives } = get();
    const creativeIndex = creatives.findIndex(c => c.id === creativeId);
    if (creativeIndex === -1) return;
    
    const creative = creatives[creativeIndex];
    const worldbookIndex = creative.worldBooks.findIndex(wb => wb.id === worldbookId);
    if (worldbookIndex === -1) return;
    
    const worldBook = creative.worldBooks[worldbookIndex];
    const updatedChatHistory = [...worldBook.chatHistory, message];
    
    const updatedWorldBook = {
      ...worldBook,
      chatHistory: updatedChatHistory,
      updatedAt: Date.now()
    };
    
    const updatedWorldBooks = [...creative.worldBooks];
    updatedWorldBooks[worldbookIndex] = updatedWorldBook;
    
    const updatedCreative = {
      ...creative,
      worldBooks: updatedWorldBooks,
      updatedAt: Date.now()
    };
    
    const updatedCreatives = [...creatives];
    updatedCreatives[creativeIndex] = updatedCreative;
    set({ creatives: updatedCreatives });
    
    get().saveCreatives();
  },

  clearWorldBookChatHistory: (creativeId, worldbookId) => {
    const { creatives } = get();
    const creativeIndex = creatives.findIndex(c => c.id === creativeId);
    if (creativeIndex === -1) return;
    
    const creative = creatives[creativeIndex];
    const worldbookIndex = creative.worldBooks.findIndex(wb => wb.id === worldbookId);
    if (worldbookIndex === -1) return;
    
    const worldBook = creative.worldBooks[worldbookIndex];
    const updatedWorldBook = {
      ...worldBook,
      chatHistory: [],
      updatedAt: Date.now()
    };
    
    const updatedWorldBooks = [...creative.worldBooks];
    updatedWorldBooks[worldbookIndex] = updatedWorldBook;
    
    const updatedCreative = {
      ...creative,
      worldBooks: updatedWorldBooks,
      updatedAt: Date.now()
    };
    
    const updatedCreatives = [...creatives];
    updatedCreatives[creativeIndex] = updatedCreative;
    set({ creatives: updatedCreatives });
    
    get().saveCreatives();
  },

  // ========== 数据操作 ==========
  loadCreatives: async () => {
    set({ isLoading: true });
    try {
      if (window.electronAPI && window.electronAPI.creative) {
        const data = await window.electronAPI.creative.load();
        set({
          creatives: data?.creatives || [],
          currentCreativeId: data?.currentCreativeId || null,
          currentEditorTarget: data?.currentEditorTarget || null,
          isLoading: false
        });
      } else {
        console.log('Electron API not available, using mock data for testing');
        set({
          creatives: [],
          currentCreativeId: null,
          currentEditorTarget: null,
          isLoading: false
        });
      }
    } catch (error) {
      addLog('加载创意数据失败', 'error', {
        category: 'system',
        error: error instanceof Error ? error : undefined,
        context: {
          errorType: error instanceof Error ? error.name : 'UnknownError',
          errorLocation: 'creativeStore.ts:600:loadCreatives',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        },
        details: '加载创意数据时发生错误，请检查文件系统权限和数据文件是否存在。'
      });
      set({ creatives: [], currentCreativeId: null, currentEditorTarget: null, isLoading: false });
    }
  },

  saveCreatives: async () => {
    try {
      if (window.electronAPI && window.electronAPI.creative) {
        const { creatives, currentCreativeId, currentEditorTarget } = get();
        await window.electronAPI.creative.save({ creatives, currentCreativeId, currentEditorTarget });
      }
    } catch (error) {
      addLog('保存创意数据失败', 'error', {
        category: 'system',
        error: error instanceof Error ? error : undefined,
        context: {
          errorType: error instanceof Error ? error.name : 'UnknownError',
          errorLocation: 'creativeStore.ts:612:saveCreatives',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        },
        details: '保存创意数据时发生错误，请检查文件系统权限。'
      });
    }
  },

  clearCreatives: () => {
    set({ creatives: [], currentCreativeId: null, currentEditorTarget: null });
    get().saveCreatives();
  },

  exportData: async () => {
    try {
      if (window.electronAPI && window.electronAPI.creative) {
        return await window.electronAPI.creative.export();
      } else {
        console.error('Electron API not available');
        return null;
      }
    } catch (error) {
      addLog('导出创意数据失败', 'error', {
        category: 'system',
        error: error instanceof Error ? error : undefined,
        context: {
          errorType: error instanceof Error ? error.name : 'UnknownError',
          errorLocation: 'creativeStore.ts:630:exportData',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        },
        details: '导出创意数据时发生错误，请检查文件系统权限。'
      });
      return null;
    }
  },

  importData: async (data) => {
    try {
      if (window.electronAPI && window.electronAPI.creative) {
        const result = await window.electronAPI.creative.import(data);
        if (result.success) {
          await get().loadCreatives();
        }
      } else {
        console.error('Electron API not available');
      }
    } catch (error) {
      addLog('导入创意数据失败', 'error', {
        category: 'system',
        error: error instanceof Error ? error : undefined,
        context: {
          errorType: error instanceof Error ? error.name : 'UnknownError',
          errorLocation: 'creativeStore.ts:646:importData',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        },
        details: '导入创意数据时发生错误，请检查数据格式是否正确。'
      });
    }
  },

  migrateOldData: async () => {
    try {
      if (window.electronAPI && window.electronAPI.creative) {
        const result = await window.electronAPI.creative.migrate();
        if (result.success) {
          await get().loadCreatives();
        }
      }
    } catch (error) {
      addLog('迁移旧数据失败', 'error', {
        category: 'system',
        error: error instanceof Error ? error : undefined,
        context: {
          errorType: error instanceof Error ? error.name : 'UnknownError',
          errorLocation: 'creativeStore.ts:659:migrateOldData',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        },
        details: '迁移旧数据时发生错误，请检查旧数据格式是否正确。'
      });
    }
  },

  // ========== 获取函数 ==========
  getCurrentCreative: () => {
    const { creatives, currentCreativeId } = get();
    if (!currentCreativeId) return null;
    return creatives.find(c => c.id === currentCreativeId) || null;
  },

  getCreativeById: (id) => {
    const { creatives } = get();
    return creatives.find(c => c.id === id) || null;
  },

  getCharacterCardById: (creativeId, characterId) => {
    const { creatives } = get();
    const creative = creatives.find(c => c.id === creativeId);
    if (!creative) return null;
    return creative.characterCards.find(cc => cc.id === characterId) || null;
  },

  getWorldBookById: (creativeId, worldbookId) => {
    const { creatives } = get();
    const creative = creatives.find(c => c.id === creativeId);
    if (!creative) return null;
    return creative.worldBooks.find(wb => wb.id === worldbookId) || null;
  },

  getCurrentEditorContent: () => {
    const { creatives, currentCreativeId, currentEditorTarget } = get();
    if (!currentCreativeId || !currentEditorTarget) return '';
    
    const creative = creatives.find(c => c.id === currentCreativeId);
    if (!creative) return '';
    
    if (currentEditorTarget.type === 'character') {
      const characterCard = creative.characterCards.find(cc => cc.id === currentEditorTarget.id);
      return characterCard?.content || '';
    } else {
      const worldBook = creative.worldBooks.find(wb => wb.id === currentEditorTarget.id);
      return worldBook?.content || '';
    }
  }
}));

export { useCreativeStore };
export type { Creative, CharacterCard, WorldBook, Version, ChatMessage };
