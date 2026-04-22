declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

interface ElectronAPI {
  config: {
    load: () => Promise<{ success: boolean; config?: any; error?: string }>;
    save: (config: any) => Promise<{ success: boolean; error?: string }>;
    getPath: () => Promise<string>;
  };
  worldBook: {
    list: () => Promise<any[]>;
    read: (path: string) => Promise<any>;
    write: (path: string, data: any) => Promise<any>;
    delete: (path: string) => Promise<any>;
    optimize: (path: string) => Promise<any>;
    getDirectory: () => Promise<string>;
    setDirectory: (dir: string) => Promise<{ success: boolean; worldBookDir: string }>;
  };
  character: {
    list: () => Promise<any[]>;
    read: (path: string) => Promise<any>;
    write: (path: string, data: any) => Promise<any>;
    delete: (path: string) => Promise<any>;
    optimize: (path: string) => Promise<any>;
    getDirectory: () => Promise<string>;
    setDirectory: (dir: string) => Promise<{ success: boolean }>;
  };
  avatar: {
    list: () => Promise<any[]>;
    read: (path: string) => Promise<any>;
    write: (path: string, data: any) => Promise<any>;
    delete: (path: string) => Promise<any>;
    getDirectory: () => Promise<string>;
    setDirectory: (dir: string) => Promise<{ success: boolean; avatarDir: string }>;
  };
  plugin: {
    getAvailable: (forceRefresh?: boolean) => Promise<any[]>;
    getInstalled: () => Promise<any[]>;
    toggle: (pluginId: string, enabled: boolean) => Promise<{ success: boolean; error?: string }>;
    uninstall: (pluginId: string) => Promise<{ success: boolean; error?: string }>;
    getDirectory: () => Promise<string>;
    setDirectory: (dir: string) => Promise<{ success: boolean; pluginDir: string }>;
    checkUpdates: () => Promise<{ success: boolean; plugins?: any[]; error?: string }>;
    updateDescriptions: (translatedPlugins: any[]) => Promise<{ success: boolean; error?: string }>;
    install: (url: string, branch?: string) => Promise<{ 
      success: boolean; 
      plugin?: any; 
      error?: string;
      displayName?: string;
      version?: string;
      author?: string;
    }>;
    uninstallById: (pluginId: string) => Promise<{ success: boolean; error?: string }>;
  };
  file: {
    selectDirectory: () => Promise<string | null>;
    selectFile: (filters: any[]) => Promise<string | null>;
    exists: (path: string) => Promise<boolean>;
    read: (path: string) => Promise<string>;
    write: (path: string, content: string) => Promise<{ success: boolean; error?: string }>;
    writeBinary: (path: string, content: string, isBase64?: boolean) => Promise<{ success: boolean; error?: string }>;
    openFolder: (path: string) => Promise<{ success: boolean; error?: string }>;
    readJson: (fileName: string) => Promise<any>;
  };
  app: {
    getVersion: () => Promise<string>;
    getPlatform: () => Promise<string>;
    openPath: (path: string) => Promise<string>;
    getRootPath: () => Promise<string>;
  };
  sillyTavern: {
    start: () => Promise<{ success: boolean; message: string }>;
    stop: () => Promise<{ success: boolean; message: string }>;
    stopAll: () => Promise<{ success: boolean; message: string }>;
    status: () => Promise<{ running: boolean; logs: string[] }>;
    updateConfig: (config: any) => Promise<{ success: boolean; message: string }>;
  };
  update: {
    check: () => Promise<any>;
    download: (latestVersion: string) => Promise<any>;
    install: (downloadPath: string) => Promise<any>;
  };
  memory: {
    // 表格模板管理
    getAllTemplates: () => Promise<any[]>;
    getTemplate: (templateId: string) => Promise<any | null>;
    createTemplate: (template: any) => Promise<any>;
    updateTemplate: (templateId: string, updates: any) => Promise<any | null>;
    deleteTemplate: (templateId: string) => Promise<boolean>;
    createTableFile: (chatId: string, templateId: string) => Promise<string>;
    readTableFile: (chatId: string) => Promise<Record<string, any[]>>;
    updateTableFile: (chatId: string, sheetName: string, data: any[]) => Promise<string>;
    getVersionHistory: (templateId: string) => Promise<string[]>;
    restoreVersion: (templateId: string, version: string) => Promise<any | null>;
    getTemplateBindingStatus: () => Promise<Record<string, boolean>>;
    
    // 聊天记录管理
    getChatSessions: () => Promise<any[]>;
    getChatSession: (chatId: string) => Promise<any | null>;
    getChatMessages: (chatId: string, page: number, pageSize: number) => Promise<{ messages: any[]; total: number; totalPages: number }>;
    searchChatMessages: (keyword: string, chatId?: string) => Promise<any[]>;
    filterChatMessages: (chatId: string, filters: any) => Promise<any[]>;
    processChatWithAI: (chatId: string, templateId: string, config: { apiKey: string; apiUrl: string; modelName: string }) => Promise<any[]>;
    applyAIResults: (chatId: string, results: any[]) => Promise<string>;
    deleteChatSession: (chatId: string) => Promise<boolean>;
    associateTemplate: (chatId: string, templateId: string) => Promise<void>;
    processChat: (chatId: string, templateId: string, selectedMessageIds?: string[], config?: { apiKey: string; apiUrl: string; modelName: string; apiMode: string }) => Promise<void>;
    
    // 表格数据管理
    getTableData: (chatId: string) => Promise<any>;
    saveTableData: (chatId: string, sheetName: string, sheetData: any[]) => Promise<void>;
    
    // 日志
    onLog?: (message: string, type: string) => void;
  };
  // AI 请求 API
  ai: {
    request: (config: { 
      url: string; 
      method: string; 
      headers: Record<string, string>; 
      body: any; 
      timeout?: number;
      streaming?: boolean 
    }) => Promise<{ 
      success: boolean; 
      data?: any; 
      error?: string; 
      details?: string 
    }>;
  };
  // 创意数据 API
  creative: {
    load: () => Promise<{ creatives: any[]; currentCreativeId: string | null; currentEditorTarget: { type: 'character' | 'worldbook'; id: string } | null }>;
    save: (data: { creatives: any[]; currentCreativeId: string | null; currentEditorTarget: { type: 'character' | 'worldbook'; id: string } | null }) => Promise<boolean>;
    export: () => Promise<string>;
    import: (jsonData: string) => Promise<{ success: boolean; error?: string }>;
    migrate: () => Promise<{ success: boolean; data?: any; error?: string }>;
  };
}

export { ElectronAPI };
