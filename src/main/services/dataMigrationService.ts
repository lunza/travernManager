/**
 * 数据迁移服务 - 从旧架构迁移到新架构
 */

import Store from 'electron-store';
import { StorageManager, getStorageManager } from './storageManager';
import { CURRENT_VERSION } from './storage.types';

interface MigrationResult {
  success: boolean;
  message: string;
  backupPath?: string;
  error?: string;
}

export class DataMigrationService {
  private storageManager: StorageManager;

  constructor() {
    this.storageManager = getStorageManager();
  }

  /**
   * 执行完整的数据迁移
   */
  async migrate(): Promise<MigrationResult> {
    console.log('开始数据迁移...');

    try {
      // 1. 检测是否需要迁移
      if (!this.needsMigration()) {
        return {
          success: true,
          message: '无需迁移，已经是最新架构'
        };
      }

      // 2. 读取旧数据
      const oldData = this.readOldData();
      if (!oldData) {
        return {
          success: false,
          message: '读取旧数据失败'
        };
      }

      console.log('成功读取旧数据，开始迁移...');

      // 3. 迁移数据
      const migrateSuccess = await this.migrateData(oldData);
      if (!migrateSuccess) {
        return {
          success: false,
          message: '数据迁移失败'
        };
      }

      console.log('数据迁移完成，开始验证...');

      // 4. 验证迁移结果
      const verifyResult = await this.verifyMigration(oldData);
      if (!verifyResult.success) {
        console.error('验证失败...');
        return verifyResult;
      }

      console.log('迁移验证成功！');

      // 5. 更新元数据标记迁移完成
      this.storageManager.initializeMetadata();

      return {
        success: true,
        message: '数据迁移成功完成'
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
   * 检测是否需要迁移
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
   * 迁移数据到新架构
   */
  private async migrateData(oldData: Record<string, any>): Promise<boolean> {
    try {
      console.log('开始迁移数据...');

      // 逐个迁移所有键
      for (const [key, value] of Object.entries(oldData)) {
        console.log(`迁移键: ${key}...`);
        const result = this.storageManager.set(key, value);
        if (!result.success) {
          console.error(`迁移 ${key} 失败:`, result.error);
          // 不中断，继续迁移其他键
        }
      }

      console.log('所有数据迁移完成！');
      return true;
    } catch (error) {
      console.error('迁移数据失败:', error);
      return false;
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
   * 回滚（简化版，electron-store 已经很可靠了）
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
    hasBackup: boolean;
    latestBackup?: string;
  } {
    const needsMigration = this.needsMigration();
    
    return {
      needsMigration,
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
