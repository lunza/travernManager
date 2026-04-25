/**
 * 存储系统类型定义
 */

// 存储模块枚举
export enum StorageModule {
  CONFIG = 'config',
  CREATIVE = 'creative',
  CHARACTER = 'character',
  WORLD_BOOK = 'worldbook',
  MEMORY = 'memory',
  EDITOR = 'editor'
}

// 操作类型
export type StorageOperation = 'read' | 'write' | 'delete';

// 权限接口
export interface StoragePermission {
  module: StorageModule;
  operations: StorageOperation[];
}

// 模块路径映射
export const MODULE_PATH_MAP: Record<StorageModule, string> = {
  [StorageModule.CONFIG]: 'config',
  [StorageModule.CREATIVE]: 'creative',
  [StorageModule.CHARACTER]: 'character',
  [StorageModule.WORLD_BOOK]: 'worldbook',
  [StorageModule.MEMORY]: 'memory',
  [StorageModule.EDITOR]: 'editor'
};

// 旧存储键到新模块的映射
export const LEGACY_KEY_TO_MODULE: Record<string, { module: StorageModule; file?: string }> = {
  'settings': { module: StorageModule.CONFIG, file: 'settings.json' },
  'version': { module: StorageModule.CONFIG, file: 'version.json' },
  'lastUpdated': { module: StorageModule.CONFIG, file: 'metadata.json' },
  'worldbooks': { module: StorageModule.WORLD_BOOK, file: 'worldbooks.json' },
  'characters': { module: StorageModule.CHARACTER, file: 'characters.json' },
  'creatives': { module: StorageModule.CREATIVE, file: 'creatives.json' },
  'chats': { module: StorageModule.MEMORY, file: 'chats.json' },
  'templates': { module: StorageModule.MEMORY, file: 'templates.json' }
};

// 默认的模块权限（每个模块对自己有完整权限）
export const DEFAULT_PERMISSIONS: Record<StorageModule, StoragePermission> = {
  [StorageModule.CONFIG]: { module: StorageModule.CONFIG, operations: ['read', 'write', 'delete'] },
  [StorageModule.CREATIVE]: { module: StorageModule.CREATIVE, operations: ['read', 'write', 'delete'] },
  [StorageModule.CHARACTER]: { module: StorageModule.CHARACTER, operations: ['read', 'write', 'delete'] },
  [StorageModule.WORLD_BOOK]: { module: StorageModule.WORLD_BOOK, operations: ['read', 'write', 'delete'] },
  [StorageModule.MEMORY]: { module: StorageModule.MEMORY, operations: ['read', 'write', 'delete'] },
  [StorageModule.EDITOR]: { module: StorageModule.EDITOR, operations: ['read', 'write', 'delete'] }
};

// 存储操作结果
export interface StorageResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  exists?: boolean;
}

// 元数据结构
export interface Metadata {
  version: string;
  lastUpdated: string;
  migrationStatus?: 'none' | 'in_progress' | 'completed' | 'failed';
  migrationTimestamp?: string;
}

// 版本号
export const CURRENT_VERSION = '2.0.0';
