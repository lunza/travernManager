import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // 通用方法，用于监听 IPC 事件
  on: (channel: string, callback: (...args: any[]) => void) => {
    const subscription = (_event: any, ...args: any[]) => callback(...args);
    ipcRenderer.on(channel, subscription);
    
    // 返回移除监听器的函数
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
  setting: {
    load: () => ipcRenderer.invoke('setting:load'),
    save: (setting: any) => ipcRenderer.invoke('setting:save', setting),
    getPath: () => ipcRenderer.invoke('setting:getPath')
  },
  worldBook: {
    list: () => ipcRenderer.invoke('worldBook:list'),
    read: (path: string) => ipcRenderer.invoke('worldBook:read', path),
    write: (path: string, data: any) => ipcRenderer.invoke('worldBook:write', path, data),
    delete: (path: string) => ipcRenderer.invoke('worldBook:delete', path),
    optimize: (path: string) => ipcRenderer.invoke('worldBook:optimize', path),
    getDirectory: () => ipcRenderer.invoke('worldBook:getDirectory'),
    setDirectory: (dir: string) => ipcRenderer.invoke('worldBook:setDirectory', dir),
    readTags: (path: string) => ipcRenderer.invoke('worldBook:readTags', path),
    writeTags: (path: string, data: any) => ipcRenderer.invoke('worldBook:writeTags', path, data),
    deleteTags: (path: string) => ipcRenderer.invoke('worldBook:deleteTags', path)
  },
  character: {
    list: () => ipcRenderer.invoke('character:list'),
    read: (path: string) => ipcRenderer.invoke('character:read', path),
    write: (path: string, data: any) => ipcRenderer.invoke('character:write', path, data),
    delete: (path: string) => ipcRenderer.invoke('character:delete', path),
    optimize: (path: string) => ipcRenderer.invoke('character:optimize', path),
    getDirectory: () => ipcRenderer.invoke('character:getDirectory'),
    setDirectory: (dir: string) => ipcRenderer.invoke('character:setDirectory', dir)
  },
  avatar: {
    list: () => ipcRenderer.invoke('avatar:list'),
    read: (path: string) => ipcRenderer.invoke('avatar:read', path),
    write: (path: string, data: any) => ipcRenderer.invoke('avatar:write', path, data),
    delete: (path: string) => ipcRenderer.invoke('avatar:delete', path),
    getDirectory: () => ipcRenderer.invoke('avatar:getDirectory'),
    setDirectory: (dir: string) => ipcRenderer.invoke('avatar:setDirectory', dir)
  },
  plugin: {
    getAvailable: (forceRefresh?: boolean) => ipcRenderer.invoke('plugin:getAvailable', forceRefresh),
    getInstalled: () => ipcRenderer.invoke('plugin:getInstalled'),
    toggle: (pluginId: string, enabled: boolean) => ipcRenderer.invoke('plugin:toggle', pluginId, enabled),
    uninstall: (pluginId: string) => ipcRenderer.invoke('plugin:uninstall', pluginId),
    getDirectory: () => ipcRenderer.invoke('plugin:getDirectory'),
    setDirectory: (dir: string) => ipcRenderer.invoke('plugin:setDirectory', dir),
    checkUpdates: () => ipcRenderer.invoke('plugin:checkUpdates'),
    updateDescriptions: (translatedPlugins: any[]) => ipcRenderer.invoke('plugin:updateDescriptions', translatedPlugins),
    install: (url: string, branch?: string) => ipcRenderer.invoke('plugin:install', url, branch),
    uninstallById: (pluginId: string) => ipcRenderer.invoke('plugin:uninstallById', pluginId)
  },
  file: {
    selectDirectory: () => ipcRenderer.invoke('file:selectDirectory'),
    selectFile: (filters: any[]) => ipcRenderer.invoke('file:selectFile', filters),
    exists: (path: string) => ipcRenderer.invoke('file:exists', path),
    read: (path: string) => ipcRenderer.invoke('file:read', path),
    write: (path: string, content: string) => ipcRenderer.invoke('file:write', path, content),
    writeBinary: (path: string, content: string, isBase64?: boolean) => ipcRenderer.invoke('file:writeBinary', path, content, isBase64),
    openFolder: (path: string) => ipcRenderer.invoke('file:openFolder', path),
    readJson: (fileName: string) => ipcRenderer.invoke('file:readJson', fileName)
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
    openPath: (path: string) => ipcRenderer.invoke('app:openPath', path),
    getRootPath: () => ipcRenderer.invoke('app:getRootPath')
  },
  sillyTavern: {
    start: () => ipcRenderer.invoke('sillyTavern:start'),
    stop: () => ipcRenderer.invoke('sillyTavern:stop'),
    stopAll: () => ipcRenderer.invoke('sillyTavern:stopAll'),
    status: () => ipcRenderer.invoke('sillyTavern:status'),
    updateConfig: (config: any) => ipcRenderer.invoke('sillyTavern:updateConfig', config)
  },
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    download: (latestVersion: string) => ipcRenderer.invoke('update:download', latestVersion),
    install: (downloadPath: string) => ipcRenderer.invoke('update:install', downloadPath)
  },
  // 日志事件监听
  onSillyTavernLog: (callback: (event: any, log: string) => void) => {
    ipcRenderer.on('sillyTavern:log', callback);
  },
  offSillyTavernLog: (callback: (event: any, log: string) => void) => {
    ipcRenderer.off('sillyTavern:log', callback);
  },
  // 记忆插件 API
  memory: {
    // 表格模板管理
    getAllTemplates: () => ipcRenderer.invoke('memory:getAllTemplates'),
    getTemplate: (templateId: string) => ipcRenderer.invoke('memory:getTemplate', templateId),
    createTemplate: (template: any) => ipcRenderer.invoke('memory:createTemplate', template),
    updateTemplate: (templateId: string, updates: any) => ipcRenderer.invoke('memory:updateTemplate', templateId, updates),
    deleteTemplate: (templateId: string) => ipcRenderer.invoke('memory:deleteTemplate', templateId),
    createTableFile: (chatId: string, templateId: string) => ipcRenderer.invoke('memory:createTableFile', chatId, templateId),
    readTableFile: (chatId: string) => ipcRenderer.invoke('memory:readTableFile', chatId),
    updateTableFile: (chatId: string, sheetName: string, data: any[]) => ipcRenderer.invoke('memory:updateTableFile', chatId, sheetName, data),
    getVersionHistory: (templateId: string) => ipcRenderer.invoke('memory:getVersionHistory', templateId),
    restoreVersion: (templateId: string, version: string) => ipcRenderer.invoke('memory:restoreVersion', templateId, version),
    getTemplateBindingStatus: () => ipcRenderer.invoke('memory:getTemplateBindingStatus'),
    
    // 聊天记录管理
    getChatSessions: () => ipcRenderer.invoke('memory:getChatSessions'),
    getChatSession: (chatId: string) => ipcRenderer.invoke('memory:getChatSession', chatId),
    getChatMessages: (chatId: string, page: number, pageSize: number) => ipcRenderer.invoke('memory:getChatMessages', chatId, page, pageSize),
    searchChatMessages: (keyword: string, chatId?: string) => ipcRenderer.invoke('memory:searchChatMessages', keyword, chatId),
    filterChatMessages: (chatId: string, filters: any) => ipcRenderer.invoke('memory:filterChatMessages', chatId, filters),
    processChatWithAI: (chatId: string, templateId: string, config: any) => ipcRenderer.invoke('memory:processChatWithAI', chatId, templateId, config),
    applyAIResults: (chatId: string, results: any[]) => ipcRenderer.invoke('memory:applyAIResults', chatId, results),
    deleteChatSession: (chatId: string) => ipcRenderer.invoke('memory:deleteChatSession', chatId),
    associateTemplate: (chatId: string, templateId: string) => ipcRenderer.invoke('memory:associateTemplate', chatId, templateId),
    processChat: (chatId: string, templateId: string, selectedMessageIds: string[], config: { apiKey: string; apiUrl: string; modelName: string; apiMode: string }) => ipcRenderer.invoke('memory:processChat', chatId, templateId, selectedMessageIds, config),
    getTableData: (chatId: string) => ipcRenderer.invoke('memory:getTableData', chatId),
    saveTableData: (chatId: string, sheetName: string, sheetData: any[]) => ipcRenderer.invoke('memory:saveTableData', chatId, sheetName, sheetData),
    onLog: (callback: (message: string, type: string) => void) => {
      ipcRenderer.on('memory:addLog', (event, message, type) => {
        callback(message, type);
      });
    },
    
    // 外部系统调用 API（供其他系统调用）
    external: {
      processSingleChat: (request: any) => ipcRenderer.invoke('memory:external:processSingleChat', request),
      processBatchChat: (request: any) => ipcRenderer.invoke('memory:external:processBatchChat', request)
    }
  },
  // AI 请求 API
  ai: {
    request: (config: { url: string; method: string; headers: Record<string, string>; body: any; timeout?: number; streaming?: boolean }) => 
      ipcRenderer.invoke('ai:request', config)
  },
  // 创意数据 API
  creative: {
    load: () => ipcRenderer.invoke('creative:load'),
    save: (data: any) => ipcRenderer.invoke('creative:save', data),
    export: () => ipcRenderer.invoke('creative:export'),
    import: (jsonData: string) => ipcRenderer.invoke('creative:import', jsonData),
    migrate: () => ipcRenderer.invoke('creative:migrate')
  },
  // 角色卡对话数据 API
  characterChat: {
    getTestChat: (creativeId: string, characterCardId: string) => ipcRenderer.invoke('characterChat:getTestChat', creativeId, characterCardId),
    saveTestChat: (creativeId: string, characterCardId: string, characterCardName: string, messages: any[]) => ipcRenderer.invoke('characterChat:saveTestChat', creativeId, characterCardId, characterCardName, messages),
    deleteTestChat: (creativeId: string, characterCardId: string) => ipcRenderer.invoke('characterChat:deleteTestChat', creativeId, characterCardId),
    getGenerationChat: (creativeId: string, targetType: 'character' | 'worldbook', name: string) => ipcRenderer.invoke('characterChat:getGenerationChat', creativeId, targetType, name),
    saveGenerationChat: (creativeId: string, targetType: 'character' | 'worldbook', name: string, messages: any[]) => ipcRenderer.invoke('characterChat:saveGenerationChat', creativeId, targetType, name, messages),
    deleteGenerationChat: (creativeId: string, targetType: 'character' | 'worldbook', name: string) => ipcRenderer.invoke('characterChat:deleteGenerationChat', creativeId, targetType, name),
    getAllTestChats: () => ipcRenderer.invoke('characterChat:getAllTestChats'),
    getAllGenerationChats: () => ipcRenderer.invoke('characterChat:getAllGenerationChats')
  },
  // 通用存储 API
  storage: {
    get: (key: string) => ipcRenderer.invoke('storage:get', key),
    set: (data: { key: string; value: any }) => ipcRenderer.invoke('storage:set', data),
    delete: (key: string) => ipcRenderer.invoke('storage:delete', key),
    clear: () => ipcRenderer.invoke('storage:clear'),
    has: (key: string) => ipcRenderer.invoke('storage:has', key),
    getAll: () => ipcRenderer.invoke('storage:getAll'),
    import: (data: string) => ipcRenderer.invoke('storage:import', data),
    migrate: () => ipcRenderer.invoke('storage:migrate'),
    getMigrationStatus: () => ipcRenderer.invoke('storage:getMigrationStatus'),
    rollback: (backupPath: string) => ipcRenderer.invoke('storage:rollback', backupPath)
  }
});
