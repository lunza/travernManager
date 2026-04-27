/**
 * 数据迁移服务 - 从旧架构迁移到新架构
 * 支持从 sillytaven-manager 到 traven-manager 的数据迁移
 */

import Store from 'electron-store';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { StorageManager, getStorageManager } from './storageManager';
import { CURRENT_VERSION } from './storage.types';

interface MigrationResult {
  success: boolean;
  message: string;
  backupPath?: string;
  error?: string;
  migratedFiles?: string[];
}

export class DataMigrationService {
  private storageManager: StorageManager;
  private readonly OLD_APP_NAME = 'sillytaven-manager';
  private readonly NEW_APP_NAME = 'traven-manager';
  private readonly STORE_PREFIX = 'travenmanager';

  constructor() {
    this.storageManager = getStorageManager();
  }

  /**
   * 执行完整的数据迁移
   */
  async migrate(): Promise<MigrationResult> {
    console.log('开始数据迁移检查...');

    try {
      // 1. 检查是否需要从旧应用名迁移数据
      const appNameMigrationResult = await this.migrateAppNameIfNeeded();
      if (!appNameMigrationResult.success) {
        return appNameMigrationResult;
      }

      // 2. 检查是否需要从旧架构（单一存储）迁移数据
      if (this.needsMigration()) {
        const legacyResult = await this.migrateLegacyData();
        if (!legacyResult.success) {
          return legacyResult;
        }
        return legacyResult;
      }

      return {
        success: true,
        message: '无需迁移，已经是最新架构'
      };
    } catch (error) {
      console.error('迁移过程出错:', error);
      return {
        success: false,
        message: '迁移过程出错',
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 检查并执行应用名称迁移 (sillytaven-manager → traven-manager)
   */
  private async migrateAppNameIfNeeded(): Promise<MigrationResult> {
    try {
      const oldAppDataPath = path.join(app.getPath('appData'), this.OLD_APP_NAME);
      const newAppDataPath = path.join(app.getPath('appData'), this.NEW_APP_NAME);

      console.log(`旧数据路径: ${oldAppDataPath}`);
      console.log(`新数据路径: ${newAppDataPath}`);

      // 检查旧目录是否存在
      if (!fs.existsSync(oldAppDataPath)) {
        console.log('旧应用数据目录不存在，无需迁移');
        return { success: true, message: '无旧数据需要迁移' };
      }

      // 检查新目录是否已存在且有数据
      if (fs.existsSync(newAppDataPath)) {
        const newFiles = fs.readdirSync(newAppDataPath);
        if (newFiles.length > 0) {
          console.log('新目录已有数据，跳过应用名称迁移');
          return { success: true, message: '新目录已有数据' };
        }
      }

      console.log('发现旧应用数据，开始迁移...');

      // 创建新目录
      if (!fs.existsSync(newAppDataPath)) {
        fs.mkdirSync(newAppDataPath, { recursive: true });
      }

      // 获取所有旧的存储文件
      const oldFiles = fs.readdirSync(oldAppDataPath);
      const migratedFiles: string[] = [];

      for (const fileName of oldFiles) {
        if (fileName.startsWith(this.STORE_PREFIX) && fileName.endsWith('.json')) {
          const oldFilePath = path.join(oldAppDataPath, fileName);
          const newFilePath = path.join(newAppDataPath, fileName);

          console.log(`正在迁移文件: ${fileName}`);

          // 复制文件
          try {
            fs.copyFileSync(oldFilePath, newFilePath);
            migratedFiles.push(fileName);
            console.log(`✓ 已迁移: ${fileName}`);
          } catch (error) {
            console.warn(`✗ 迁移失败: ${fileName}`, error);
          }
        }
      }

      if (migratedFiles.length > 0) {
        console.log(`应用名称迁移完成，共迁移 ${migratedFiles.length} 个文件`);
        return {
          success: true,
          message: `成功从 ${this.OLD_APP_NAME} 迁移数据`,
          migratedFiles
        };
      }

      return {
        success: true,
        message: '未找到需要迁移的存储文件'
      };
    } catch (error) {
      console.error('应用名称迁移失败:', error);
      return {
        success: false,
        message: '应用名称迁移失败',
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 检查是否需要从旧架构迁移
   */
  private needsMigration(): boolean {
    return this.storageManager.isLegacyArchitecture();
  }

  /**
   * 读取旧数据
   */
  private readOldData(): Record<string, any> | null {
    try {
      const oldStore = new Store({
        name: 'travenmanager',
        clearInvalidConfig: false
      });
      
      return oldStore.store;
    } catch (error) {
      console.error('读取旧数据失败:', error);
      return null;
    }
  }

  /**
   * 迁移旧数据到新架构
   */
  private async migrateLegacyData(oldData?: Record<string, any>): Promise<MigrationResult> {
    try {
      const data = oldData || this.readOldData();
      if (!data) {
        return {
          success: false,
          message: '读取旧数据失败'
        };
      }

      console.log('开始迁移旧架构数据...');

      // 逐个迁移所有键
      for (const [key, value] of Object.entries(data)) {
        console.log(`迁移键: ${key}...`);
        const result = this.storageManager.set(key, value);
        if (!result.success) {
          console.warn(`迁移 ${key} 失败:`, result.error);
        }
      }

      console.log('所有数据迁移完成！');

      // 更新元数据
      this.storageManager.initializeMetadata();

      return {
        success: true,
        message: '数据迁移成功完成'
      };
    } catch (error) {
      console.error('迁移数据失败:', error);
      return {
        success: false,
        message: '数据迁移失败',
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 验证迁移结果
   */
  private async verifyMigration(oldData: Record<string, any>): Promise<MigrationResult> {
    try {
      console.log('开始验证迁移结果...');
      
      const newDataResult = this.storageManager.getAll();
      if (!newDataResult.success || !newDataResult.data) {
        return {
          success: false,
          message: '获取新数据失败',
          error: newDataResult.error
        };
      }

      const newData = newDataResult.data;
      
      // 验证所有键
      for (const key of Object.keys(oldData)) {
        if (oldData[key]) {
          // 检查新数据中是否有这个键
          if (!newData[key]) {
            return {
              success: false,
              message: `验证失败: ${key} 在新数据中缺失`
            };
          }
          
          // 深度比较数据
          const oldValue = JSON.stringify(oldData[key]);
          const newValue = JSON.stringify(newData[key]);
          
          if (oldValue !== newValue) {
            return {
              success: false,
              message: `验证失败: ${key} 数据不匹配`
            };
          }
          
          console.log(`✓ ${key} 验证通过`);
        }
      }

      return {
        success: true,
        message: '数据验证全部通过'
      };
    } catch (error) {
      return {
        success: false,
        message: '验证过程出错',
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 回滚（简化版，electron-store 架构不需要复杂回滚）
   */
  async rollback(backupPath?: string): Promise<MigrationResult> {
    console.log('回滚功能在 electron-store 架构中不常用');
    return {
      success: true,
      message: 'electron-store 架构不需要回滚功能'
    };
  }

  /**
   * 获取迁移状态
   */
  getMigrationStatus(): {
    needsMigration: boolean;
    hasOldAppData: boolean;
    hasBackup: boolean;
    latestBackup?: string;
  } {
    const needsMigration = this.needsMigration();
    const oldAppDataPath = path.join(app.getPath('appData'), this.OLD_APP_NAME);
    const hasOldAppData = fs.existsSync(oldAppDataPath);
    
    return {
      needsMigration,
      hasOldAppData,
      hasBackup: false,
      latestBackup: undefined
    };
  }
}

// 导出单例
let migrationServiceInstance: DataMigrationService | null = null;

export const getDataMigrationService = (): DataMigrationService => {
  if (!migrationServiceInstance) {
    migrationServiceInstance = new DataMigrationService();
  }
  return migrationServiceInstance;
};

export default getDataMigrationService();
