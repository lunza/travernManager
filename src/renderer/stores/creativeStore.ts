import { create } from 'zustand';
import fs from 'fs';
import path from 'path';

interface CreativeItem {
  id: string;
  title: string;
  content: string;
  type: 'character' | 'worldbook';
  status: 'draft' | 'in_progress' | 'completed';
  createdAt: number;
  updatedAt: number;
  tags?: string[];
  versions?: {
    id: string;
    content: string;
    timestamp: number;
  }[];
}

interface CreativeStore {
  // 状态
  creativeItems: CreativeItem[];
  currentCreativeId: string | null;
  
  // 动作
  // 创意管理
  addCreative: (title: string, content: string, type: 'character' | 'worldbook', tags?: string[]) => string;
  updateCreative: (id: string, updates: Partial<CreativeItem>) => boolean;
  deleteCreative: (id: string) => boolean;
  setCurrentCreativeId: (id: string | null) => void;
  
  // 版本管理
  addVersion: (id: string, content: string) => void;
  
  // 数据管理
  loadCreatives: () => void;
  clearCreatives: () => void;
  exportData: () => string | null;
  importData: (data: string) => void;
  
  // 辅助方法
  getCurrentCreative: () => CreativeItem | null;
  getCreativeById: (id: string) => CreativeItem | null;
}

// 获取创意数据文件路径
const getCreativeDataPath = (): string => {
  const dataDir = path.join(process.cwd(), 'data');
  // 确保 data 目录存在
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (error) {
      console.error('创建 data 目录失败:', error);
      return path.join(process.cwd(), 'creative-data.json');
    }
  }
  return path.join(dataDir, 'creative-data.json');
};

// 从文件加载创意数据
const loadCreativeData = (): { creativeItems: CreativeItem[]; currentCreativeId: string | null } => {
  const dataPath = getCreativeDataPath();
  try {
    if (fs.existsSync(dataPath)) {
      const data = fs.readFileSync(dataPath, 'utf8');
      const parsed = JSON.parse(data);
      return {
        creativeItems: parsed.creativeItems || [],
        currentCreativeId: parsed.currentCreativeId || null
      };
    }
  } catch (error) {
    console.error('加载创意数据失败:', error);
  }
  return {
    creativeItems: [],
    currentCreativeId: null
  };
};

// 保存创意数据到文件
const saveCreativeData = (data: { creativeItems: CreativeItem[]; currentCreativeId: string | null }) => {
  const dataPath = getCreativeDataPath();
  try {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('保存创意数据失败:', error);
    return false;
  }
};

// 初始加载数据
const initialData = loadCreativeData();

const useCreativeStore = create<CreativeStore>((set, get) => ({
  // 初始状态
  creativeItems: initialData.creativeItems,
  currentCreativeId: initialData.currentCreativeId,
  
  // 创意管理
  addCreative: (title, content, type, tags) => {
    const newItem: CreativeItem = {
      id: `creative_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      content,
      type,
      status: 'draft',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags,
      versions: [{
        id: `version_${Date.now()}`,
        content,
        timestamp: Date.now()
      }]
    };
    set((state) => {
      const updatedItems = [newItem, ...state.creativeItems];
      // 保存到文件
      saveCreativeData({ creativeItems: updatedItems, currentCreativeId: newItem.id });
      return { creativeItems: updatedItems, currentCreativeId: newItem.id };
    });
    return newItem.id;
  },
  
  updateCreative: (id, updates) => {
    const { creativeItems } = get();
    const itemIndex = creativeItems.findIndex(item => item.id === id);
    if (itemIndex === -1) return false;
    
    const updatedItem = {
      ...creativeItems[itemIndex],
      ...updates,
      updatedAt: Date.now()
    };
    
    set((state) => {
      const updatedItems = [...state.creativeItems];
      updatedItems[itemIndex] = updatedItem;
      // 保存到文件
      saveCreativeData({ creativeItems: updatedItems, currentCreativeId: state.currentCreativeId });
      return { creativeItems: updatedItems };
    });
    return true;
  },
  
  deleteCreative: (id) => {
    const { creativeItems, currentCreativeId } = get();
    const updatedItems = creativeItems.filter(item => item.id !== id);
    const newCurrentId = currentCreativeId === id ? (updatedItems.length > 0 ? updatedItems[0].id : null) : currentCreativeId;
    
    set({ creativeItems: updatedItems, currentCreativeId: newCurrentId });
    // 保存到文件
    saveCreativeData({ creativeItems: updatedItems, currentCreativeId: newCurrentId });
    return true;
  },
  
  setCurrentCreativeId: (id) => {
    set({ currentCreativeId: id });
    // 保存到文件
    const { creativeItems } = get();
    saveCreativeData({ creativeItems, currentCreativeId: id });
  },
  
  // 版本管理
  addVersion: (id, content) => {
    const { creativeItems } = get();
    const itemIndex = creativeItems.findIndex(item => item.id === id);
    if (itemIndex === -1) return;
    
    const updatedItem = {
      ...creativeItems[itemIndex],
      content,
      updatedAt: Date.now(),
      versions: [
        {
          id: `version_${Date.now()}`,
          content,
          timestamp: Date.now()
        },
        ...(creativeItems[itemIndex].versions || []).slice(0, 9) // 只保留最近10个版本
      ]
    };
    
    set((state) => {
      const updatedItems = [...state.creativeItems];
      updatedItems[itemIndex] = updatedItem;
      // 保存到文件
      saveCreativeData({ creativeItems: updatedItems, currentCreativeId: state.currentCreativeId });
      return { creativeItems: updatedItems };
    });
  },
  
  // 数据管理
  loadCreatives: () => {
    const data = loadCreativeData();
    set(data);
  },
  
  clearCreatives: () => {
    set({ creativeItems: [], currentCreativeId: null });
    // 保存到文件
    saveCreativeData({ creativeItems: [], currentCreativeId: null });
  },
  
  exportData: () => {
    const { creativeItems, currentCreativeId } = get();
    try {
      return JSON.stringify(
        { 
          version: '1.0',
          exportTime: new Date().toISOString(),
          currentCreativeId,
          creativeItems 
        },
        null,
        2
      );
    } catch (error) {
      console.error('导出创意数据失败:', error);
      return null;
    }
  },
  
  importData: (data) => {
    try {
      const parsed = JSON.parse(data);
      const creativeItems = parsed.creativeItems && Array.isArray(parsed.creativeItems) ? parsed.creativeItems : [];
      const currentCreativeId = parsed.currentCreativeId || (creativeItems.length > 0 ? creativeItems[0].id : null);
      set({ creativeItems, currentCreativeId });
      // 保存到文件
      saveCreativeData({ creativeItems, currentCreativeId });
    } catch (error) {
      console.error('导入创意数据失败:', error);
    }
  },
  
  // 辅助方法
  getCurrentCreative: () => {
    const { creativeItems, currentCreativeId } = get();
    if (!currentCreativeId) return null;
    return creativeItems.find(item => item.id === currentCreativeId) || null;
  },
  
  getCreativeById: (id) => {
    const { creativeItems } = get();
    return creativeItems.find(item => item.id === id) || null;
  }
}));

export { useCreativeStore };