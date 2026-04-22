import { create } from 'zustand';

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
  creativeItems: CreativeItem[];
  currentCreativeId: string | null;
  isLoading: boolean;
  
  addCreative: (title: string, content: string, type: 'character' | 'worldbook', tags?: string[]) => string;
  updateCreative: (id: string, updates: Partial<CreativeItem>) => boolean;
  deleteCreative: (id: string) => boolean;
  setCurrentCreativeId: (id: string | null) => void;
  addVersion: (id: string, content: string) => void;
  loadCreatives: () => Promise<void>;
  clearCreatives: () => void;
  exportData: () => Promise<string | null>;
  importData: (data: string) => Promise<void>;
  getCurrentCreative: () => CreativeItem | null;
  getCreativeById: (id: string) => CreativeItem | null;
}

declare global {
  interface Window {
    electronAPI: {
      creative: {
        load: () => Promise<{ creativeItems: CreativeItem[]; currentCreativeId: string | null }>;
        save: (data: { creativeItems: CreativeItem[]; currentCreativeId: string | null }) => Promise<boolean>;
        export: () => Promise<string>;
        import: (jsonData: string) => Promise<{ success: boolean; error?: string }>;
      };
    };
  }
}

const useCreativeStore = create<CreativeStore>((set, get) => ({
  creativeItems: [],
  currentCreativeId: null,
  isLoading: true,

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
    
    const updatedItems = [newItem, ...get().creativeItems];
    set({ creativeItems: updatedItems, currentCreativeId: newItem.id });
    
    window.electronAPI.creative.save({ creativeItems: updatedItems, currentCreativeId: newItem.id });
    
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
    
    const updatedItems = [...creativeItems];
    updatedItems[itemIndex] = updatedItem;
    set({ creativeItems: updatedItems });
    
    window.electronAPI.creative.save({ creativeItems: updatedItems, currentCreativeId: get().currentCreativeId });
    
    return true;
  },

  deleteCreative: (id) => {
    const { creativeItems, currentCreativeId } = get();
    const updatedItems = creativeItems.filter(item => item.id !== id);
    const newCurrentId = currentCreativeId === id ? (updatedItems.length > 0 ? updatedItems[0].id : null) : currentCreativeId;
    
    set({ creativeItems: updatedItems, currentCreativeId: newCurrentId });
    window.electronAPI.creative.save({ creativeItems: updatedItems, currentCreativeId: newCurrentId });
    
    return true;
  },

  setCurrentCreativeId: (id) => {
    set({ currentCreativeId: id });
    window.electronAPI.creative.save({ creativeItems: get().creativeItems, currentCreativeId: id });
  },

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
        ...(creativeItems[itemIndex].versions || []).slice(0, 9)
      ]
    };
    
    const updatedItems = [...creativeItems];
    updatedItems[itemIndex] = updatedItem;
    set({ creativeItems: updatedItems });
    
    window.electronAPI.creative.save({ creativeItems: updatedItems, currentCreativeId: get().currentCreativeId });
  },

  loadCreatives: async () => {
    set({ isLoading: true });
    try {
      const data = await window.electronAPI.creative.load();
      set({
        creativeItems: data.creativeItems,
        currentCreativeId: data.currentCreativeId,
        isLoading: false
      });
    } catch (error) {
      console.error('Failed to load creative data:', error);
      set({ isLoading: false });
    }
  },

  clearCreatives: () => {
    set({ creativeItems: [], currentCreativeId: null });
    window.electronAPI.creative.save({ creativeItems: [], currentCreativeId: null });
  },

  exportData: async () => {
    try {
      return await window.electronAPI.creative.export();
    } catch (error) {
      console.error('Failed to export creative data:', error);
      return null;
    }
  },

  importData: async (data) => {
    try {
      const result = await window.electronAPI.creative.import(data);
      if (result.success) {
        await get().loadCreatives();
      }
    } catch (error) {
      console.error('Failed to import creative data:', error);
    }
  },

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
