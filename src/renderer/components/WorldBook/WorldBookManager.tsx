import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, message, Popconfirm, Tag, Typography, Switch, Radio, Select, Pagination } from 'antd';
import MarkdownEditor from '../Common/MarkdownEditor';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
  TranslationOutlined,
  LoadingOutlined,
  UploadOutlined,
  SaveOutlined,
  SortAscendingOutlined,
  UpOutlined,
  DownOutlined,
  TagOutlined
} from '@ant-design/icons';
import TagManager from './TagManager';
import { useDataStore } from '../../stores/dataStore';
import { useUIStore } from '../../stores/uiStore';
import { useSettingStore } from '../../stores/settingStore';
import { useLogStore } from '../../stores/logStore';
import { AppSetting } from '../../settings';
import type { ColumnsType } from 'antd/es/table';
import './WorldBookManager.css';

const { Text } = Typography;

interface WorldBook {
  name: string;
  path: string;
  size: number;
  modified: Date;
}

const WorldBookManager: React.FC = () => {
  const { worldBooks, loading, fetchWorldBooks, optimizeWorldBook } = useDataStore();
  const { theme: appTheme } = useUIStore();
  const { setting, fetchSetting } = useSettingStore();
  const { addLog } = useLogStore();
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditEntryModalOpen, setIsEditEntryModalOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<WorldBook | null>(null);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [editingEntryUid, setEditingEntryUid] = useState<number | string | null>(null);
  const [worldBookContent, setWorldBookContent] = useState<any>(null);
  const [expandedEntries, setExpandedEntries] = useState<Set<number | string>>(new Set());
  const [selectedEntries, setSelectedEntries] = useState<Set<number | string>>(new Set());
  const [isDragSortModalOpen, setIsDragSortModalOpen] = useState(false);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [isEditEntryTagsModalOpen, setIsEditEntryTagsModalOpen] = useState(false);
  const [currentEditEntryUid, setCurrentEditEntryUid] = useState<string | number | null>(null);
  const [tags, setTags] = useState<any[]>([]);
  const [associations, setAssociations] = useState<any[]>([]);
  
  // 使用状态变量直接管理表单值
  const [formValues, setFormValues] = useState({
    comment: '',
    key: '',
    keysecondary: '',
    content: ''
  });
  
  // 跟踪正在翻译的字段
  const [translatingField, setTranslatingField] = useState<string | null>(null);
  
  // 跟踪是否正在一键翻译所有条目
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  
  // 跟踪正在润色的字段
  const [polishingField, setPolishingField] = useState<string | null>(null);
  
  // 跟踪是否正在一键润色所有条目
  const [isPolishingAll, setIsPolishingAll] = useState(false);
  // 跟踪是否正在AI排序条目
  const [isAISorting, setIsAISorting] = useState(false);
  // 排序模态框状态
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);
  const [selectedSortMethod, setSelectedSortMethod] = useState<string>('title');
  // 世界书目录路径
  const [worldBookDir, setWorldBookDir] = useState<string>('');
  // 新增世界书模态框状态
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [isGeneratingEntries, setIsGeneratingEntries] = useState(false);
  const [generatedEntries, setGeneratedEntries] = useState<any[]>([]);
  const [generatedWorldBookName, setGeneratedWorldBookName] = useState<string>('');
  const [generatedWorldBookDescription, setGeneratedWorldBookDescription] = useState<string>('');
  // 添加条目模态框状态
  const [isAddEntryModalOpen, setIsAddEntryModalOpen] = useState(false);
  const [addEntryForm] = Form.useForm();
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [addedEntries, setAddedEntries] = useState<any[]>([]);
  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  // 润色相关状态
  const [polishRequirements, setPolishRequirements] = useState<string>('');
  const [isPolishModalOpen, setIsPolishModalOpen] = useState<boolean>(false);
  const [currentPolishField, setCurrentPolishField] = useState<string | null>(null);
  const [currentPolishText, setCurrentPolishText] = useState<string>('');
  const [polishAllRequirements, setPolishAllRequirements] = useState<string>('');
  const [isPolishAllModalOpen, setIsPolishAllModalOpen] = useState<boolean>(false);

  useEffect(() => {
    fetchSetting();
  }, [fetchSetting]);

  useEffect(() => {
    // 从主进程获取世界书目录路径
    const getWorldBookDir = async () => {
      try {
        const dir = await window.electronAPI.worldBook.getDirectory();
        setWorldBookDir(dir);
      } catch (error) {
        addLog(`获取世界书目录失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      }
    };
    getWorldBookDir();
  }, []);

  useEffect(() => {
    fetchWorldBooks();
  }, [fetchWorldBooks]);

  const handleOptimize = async (path: string) => {
    addLog(`[WorldBook] 开始优化世界书: ${path}`);
    try {
      await optimizeWorldBook(path);
      addLog(`[WorldBook] 优化成功: ${path}`, 'info');
      message.success('优化成功');
    } catch (error) {
      addLog(`[WorldBook] 优化失败: ${path}`, 'error');
      message.error('优化失败');
    }
  };

  const handleDelete = async (path: string) => {
    addLog(`[WorldBook] 删除世界书: ${path}`);
    try {
      await window.electronAPI.worldBook.delete(path);
      addLog(`[WorldBook] 删除成功: ${path}`, 'info');
      message.success('删除成功');
      fetchWorldBooks();
    } catch (error) {
      addLog(`[WorldBook] 删除失败: ${path}`, 'error');
      message.error('删除失败');
    }
  };

  // 加载标签数据
  const loadTags = async (worldBookPath: string) => {
    try {
      const tagData = await window.electronAPI.worldBook.readTags(worldBookPath);
      if (tagData) {
        setTags(tagData.tags || []);
        setAssociations(tagData.associations || []);
      } else {
        setTags([]);
        setAssociations([]);
      }
    } catch (error) {
      addLog(`[WorldBook] 加载标签数据失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      setTags([]);
      setAssociations([]);
    }
  };

  const handleView = async (record: WorldBook) => {
    addLog(`[WorldBook] 查看世界书: ${record.name}, 路径: ${record.path}`);
    try {
      const content = await window.electronAPI.worldBook.read(record.path);
      addLog(`[WorldBook] 读取世界书成功: ${record.name}, 条目数: ${content?.entries ? Object.keys(content.entries).length : 0}`, 'info');
      setWorldBookContent(content);
      setViewingItem(record);
      setExpandedEntries(new Set());
      setCurrentPage(1); // 重置页码到第一页
      setIsViewModalOpen(true);
      // 加载标签数据
      await loadTags(record.path);
    } catch (error) {
      addLog(`[WorldBook] 读取世界书失败: ${record.path}`, 'error');
      message.error('读取世界书失败');
    }
  };

  // 导入世界书
  const handleImportWorldBook = async () => {
    addLog('[WorldBook] 开始导入世界书');
    try {
      // 创建文件选择器
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.onchange = async (e: Event) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        
        if (!file) {
          message.error('请选择文件');
          return;
        }
        
        addLog(`[WorldBook] 选择文件: ${file.name}`);
        
        // 检查文件类型
        if (!file.name.endsWith('.json')) {
          message.error('请选择JSON格式的文件');
          return;
        }
        
        try {
          // 读取文件内容
          const content = await file.text();
          
          // 验证JSON格式
          let worldBookData;
          try {
            worldBookData = JSON.parse(content);
          } catch (parseError) {
            addLog('[WorldBook] JSON解析失败', 'error');
            message.error('文件格式错误：无效的JSON文件');
            return;
          }
          
          // 验证世界书格式（至少应该有entries字段）
          if (!worldBookData || typeof worldBookData !== 'object') {
            message.error('文件格式错误：无效的世界书格式');
            return;
          }
          
          // 从主进程获取正确的世界书目录路径
          const worldBookDir = await window.electronAPI.worldBook.getDirectory();
          
          // 构建目标文件路径
          const targetPath = `${worldBookDir}/${file.name}`;
          
          addLog(`[WorldBook] 目标路径: ${targetPath}`);
          
          // 检查文件是否已存在
          const existingWorldBooks = await window.electronAPI.worldBook.list();
          const existingFile = existingWorldBooks.find(wb => wb.path === targetPath);
          
          if (existingFile) {
            addLog(`[WorldBook] 文件已存在，准备覆盖: ${file.name}`);
            Modal.confirm({
              title: '文件已存在',
              content: `世界书 "${file.name}" 已存在，是否覆盖？`,
              okText: '覆盖',
              cancelText: '取消',
              onOk: async () => {
                try {
                  // 写入文件
                  const result = await window.electronAPI.worldBook.write(targetPath, worldBookData);
                  if (result.success) {
                    addLog(`[WorldBook] 覆盖导入成功: ${file.name}`, 'info');
                    message.success('导入成功');
                    // 刷新世界书列表
                    fetchWorldBooks();
                  } else {
                    addLog(`[WorldBook] 覆盖导入失败: ${file.name}`, 'error');
                    message.error(`导入失败: ${result.error}`);
                  }
                } catch (writeError) {
                  addLog(`[WorldBook] 覆盖导入异常: ${file.name}`, 'error');
                  message.error('导入失败：写入文件时出错');
                }
              }
            });
          } else {
            addLog(`[WorldBook] 新文件导入: ${file.name}`);
            // 直接写入文件
            const result = await window.electronAPI.worldBook.write(targetPath, worldBookData);
            if (result.success) {
              addLog(`[WorldBook] 导入成功: ${file.name}`, 'info');
              message.success('导入成功');
              // 刷新世界书列表
              fetchWorldBooks();
            } else {
              addLog(`[WorldBook] 导入失败: ${file.name}`, 'error');
              message.error(`导入失败: ${result.error}`);
            }
          }
        } catch (error) {
          addLog('[WorldBook] 导入过程异常', 'error');
          message.error(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      };
      
      // 触发文件选择
      input.click();
    } catch (error) {
      addLog('[WorldBook] 导入初始化异常', 'error');
      message.error(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleEditEntry = (entry: any, uid: number | string) => {
    addLog(`[WorldBook] 打开条目编辑: UID=${uid}, Comment=${entry.comment || '无'}`);
    setEditingEntry(entry);
    setEditingEntryUid(uid);
    
    // 手动处理数组字段，将数组转换为字符串
    const formattedValues = {
      comment: entry.comment || '',
      key: Array.isArray(entry.key) ? entry.key.join(', ') : entry.key || '',
      keysecondary: Array.isArray(entry.keysecondary) ? entry.keysecondary.join(', ') : entry.keysecondary || '',
      content: entry.content || '',
      order: entry.order || 0,
      probability: entry.probability || 0,
      depth: entry.depth || 1,
      position: entry.position || 0,
      sticky: entry.sticky || 0,
      cooldown: entry.cooldown || 0,
      delay: entry.delay || 0,
      groupWeight: entry.groupWeight || 0,
      constant: entry.constant || false,
      selective: entry.selective || false,
      disable: entry.disable || false,
      addMemo: entry.addMemo || false,
      groupOverride: entry.groupOverride || false,
      useProbability: entry.useProbability || false,
      vectorized: entry.vectorized || false,
      excludeRecursion: entry.excludeRecursion || false,
      preventRecursion: entry.preventRecursion || false,
      delayUntilRecursion: entry.delayUntilRecursion || false,
      group: entry.group || '',
      automationId: entry.automationId || '',
      scanDepth: entry.scanDepth || 0,
      displayIndex: entry.displayIndex || 0,
      caseSensitive: entry.caseSensitive || false,
      matchWholeWords: entry.matchWholeWords || false,
      useGroupScoring: entry.useGroupScoring || false
    };
    
    addLog(`Formatted values: ${JSON.stringify(formattedValues)}`, 'debug');
    setFormValues(formattedValues);
    setIsEditEntryModalOpen(true);
  };

  const handleEditEntryModalOk = async () => {
    addLog(`[WorldBook] 保存条目编辑: UID=${editingEntryUid}`);
    try {
      if (worldBookContent && worldBookContent.entries && editingEntryUid !== null) {
        // 创建世界书内容的深拷贝，避免直接修改状态
        const newWorldBookContent = JSON.parse(JSON.stringify(worldBookContent));
        
        // 处理数组字段，将字符串转换回数组
        // 同时处理逗号和顿号分隔的情况
        const formattedValues = {
          ...formValues,
          key: typeof formValues.key === 'string' ? formValues.key.split(/[,，]/).map(item => item.trim()).filter(item => item) : formValues.key,
          keysecondary: typeof formValues.keysecondary === 'string' ? formValues.keysecondary.split(/[,，]/).map(item => item.trim()).filter(item => item) : formValues.keysecondary
        };
        addLog(`[WorldBook] 格式化后的值: ${JSON.stringify(formattedValues, null, 2)}`);
        
        // 找到正确的条目进行更新 - 不能简单地用 editingEntryUid 作为键
        // 需要遍历 entries 对象，找到匹配的条目
        let entryFound = false;
        for (const key in newWorldBookContent.entries) {
          const entry = newWorldBookContent.entries[key];
          // 检查条目的 uid 是否匹配
          if (entry.uid === editingEntryUid || key === String(editingEntryUid)) {
            addLog(`[WorldBook] 找到匹配条目: Key=${key}, EntryUID=${entry.uid}`);
            
            // 合并原始条目和新的表单值，保留原始条目的所有字段
            // 同时更新 keys 和 secondary_keys 字段，保持向后兼容
            newWorldBookContent.entries[key] = {
              ...entry,
              ...formattedValues,
              keys: formattedValues.key, // 保持 keys 与 key 一致
              secondary_keys: formattedValues.keysecondary // 保持 secondary_keys 与 keysecondary 一致
            };
            
            entryFound = true;
            break;
          }
        }
        
        if (!entryFound) {
          addLog(`[WorldBook] 未找到匹配的条目: UID=${editingEntryUid}`, 'error');
          message.error('未找到匹配的条目');
          return;
        }
        
        // 保存到文件
        addLog(`[WorldBook] 写入文件: ${viewingItem!.path}`);
        await window.electronAPI.worldBook.write(viewingItem!.path, newWorldBookContent);
        addLog(`[WorldBook] 条目编辑保存成功: UID=${editingEntryUid}`, 'info');
        
        message.success('编辑成功');
        // 更新状态
        setWorldBookContent(newWorldBookContent);
        setIsEditEntryModalOpen(false);
        setEditingEntry(null);
        setEditingEntryUid(null);
      }
    } catch (error) {
      addLog(`[WorldBook] 条目编辑保存失败: UID=${editingEntryUid}`, 'error');
      message.error('编辑失败');
    }
  };

  const handleEditEntryModalCancel = () => {
    setIsEditEntryModalOpen(false);
    setEditingEntry(null);
    setEditingEntryUid(null);
  };

  // 处理删除单条条目
  const handleDeleteEntry = async (uid: number | string) => {
    if (worldBookContent && worldBookContent.entries && viewingItem) {
      const newEntries = { ...worldBookContent.entries };
      // 找到对应uid的条目并删除
      Object.keys(newEntries).forEach(key => {
        if (newEntries[key].uid === uid || key === String(uid)) {
          delete newEntries[key];
        }
      });
      
      // 更新世界书内容
      const updatedContent = {
        ...worldBookContent,
        entries: newEntries
      };
      
      setWorldBookContent(updatedContent);
      
      // 从选中列表中移除
      const newSelected = new Set(selectedEntries);
      newSelected.delete(uid);
      setSelectedEntries(newSelected);
      
      // 同步删除相关的标签信息
      try {
        const tagData = await window.electronAPI.worldBook.readTags(viewingItem.path);
        if (tagData && tagData.associations) {
          const updatedAssociations = tagData.associations.filter((assoc: any) => assoc.entryUid !== uid);
          const updatedTagData = {
            ...tagData,
            associations: updatedAssociations
          };
          await window.electronAPI.worldBook.writeTags(viewingItem.path, updatedTagData);
        }
      } catch (error) {
        addLog(`[WorldBook] 删除标签关联失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      }
      
      message.success('条目删除成功');
    }
  };

  // 处理批量删除选中的条目
  const handleDeleteSelectedEntries = async () => {
    if (worldBookContent && worldBookContent.entries && viewingItem) {
      const newEntries = { ...worldBookContent.entries };
      let deletedCount = 0;
      const deletedUids = new Set<string | number>();
      
      // 删除所有选中的条目
      Object.keys(newEntries).forEach(key => {
        const entry = newEntries[key];
        if (selectedEntries.has(entry.uid) || selectedEntries.has(key)) {
          deletedUids.add(entry.uid || key);
          delete newEntries[key];
          deletedCount++;
        }
      });
      
      // 更新世界书内容
      const updatedContent = {
        ...worldBookContent,
        entries: newEntries
      };
      
      setWorldBookContent(updatedContent);
      setSelectedEntries(new Set());
      
      // 立即保存到文件
      const worldBookData = {
        name: worldBookContent?.name || viewingItem?.name || '',
        description: worldBookContent?.description || '',
        entries: newEntries
      };
      
      const saveResult = await window.electronAPI.worldBook.write(viewingItem.path, worldBookData);
      
      if (!saveResult.success) {
        addLog(`[WorldBook] 保存删除后的世界书失败: ${saveResult.error}`, 'error');
        message.error('保存失败');
        return;
      }
      
      // 同步删除相关的标签信息
      try {
        const tagData = await window.electronAPI.worldBook.readTags(viewingItem.path);
        if (tagData && tagData.associations) {
          const updatedAssociations = tagData.associations.filter((assoc: any) => !deletedUids.has(assoc.entryUid));
          const updatedTagData = {
            ...tagData,
            associations: updatedAssociations
          };
          await window.electronAPI.worldBook.writeTags(viewingItem.path, updatedTagData);
        }
      } catch (error) {
        addLog(`[WorldBook] 删除标签关联失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      }
      
      addLog(`[WorldBook] 成功删除 ${deletedCount} 个条目并保存到文件`, 'info');
      message.success(`成功删除 ${deletedCount} 个条目`);
    }
  };

  // 按标题排序条目
  const handleSortEntriesByTitle = () => {
    if (worldBookContent && worldBookContent.entries) {
      // 将条目转换为数组并按comment字段排序
      const entriesArray = Object.entries(worldBookContent.entries).map(([key, entry]) => ({
        key,
        entry
      }));
      
      // 按comment字段排序，空字符串排在前面
      entriesArray.sort((a, b) => {
        const commentA = a.entry.comment || '';
        const commentB = b.entry.comment || '';
        return commentA.localeCompare(commentB);
      });
      
      // 重新构建条目对象，保持顺序
      const newEntries: any = {};
      entriesArray.forEach((item, index) => {
        newEntries[index] = {
          ...item.entry,
          uid: index
        };
      });
      
      // 更新世界书内容
      const updatedContent = {
        ...worldBookContent,
        entries: newEntries
      };
      
      setWorldBookContent(updatedContent);
      message.success('条目已按标题排序');
    }
  };

  // 移动条目
  const handleMoveEntry = (index: number, direction: number) => {
    if (worldBookContent && worldBookContent.entries) {
      // 将条目转换为数组
      const entriesArray = Object.entries(worldBookContent.entries).map(([key, entry]) => ({
        key,
        entry
      }));
      
      // 按当前order排序
      entriesArray.sort((a, b) => (a.entry.order || 0) - (b.entry.order || 0));
      
      // 计算新位置
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= entriesArray.length) {
        return;
      }
      
      // 交换位置
      [entriesArray[index], entriesArray[newIndex]] = [entriesArray[newIndex], entriesArray[index]];
      
      // 重新构建条目对象，更新order值
      const newEntries: any = {};
      entriesArray.forEach((item, idx) => {
        newEntries[item.key] = {
          ...item.entry,
          order: idx
        };
      });
      
      // 更新世界书内容
      const updatedContent = {
        ...worldBookContent,
        entries: newEntries
      };
      
      setWorldBookContent(updatedContent);
    }
  };

  // 保存手动排序
  const handleSaveManualSort = () => {
    if (worldBookContent && worldBookContent.entries) {
      // 将条目转换为数组并按order排序
      const entriesArray = Object.entries(worldBookContent.entries).map(([key, entry]) => ({
        key,
        entry
      }));
      
      entriesArray.sort((a, b) => (a.entry.order || 0) - (b.entry.order || 0));
      
      // 重新构建条目对象，保持顺序
      const newEntries: any = {};
      entriesArray.forEach((item, index) => {
        newEntries[index] = {
          ...item.entry,
          uid: index,
          order: index
        };
      });
      
      // 更新世界书内容
      const updatedContent = {
        ...worldBookContent,
        entries: newEntries
      };
      
      setWorldBookContent(updatedContent);
      setIsDragSortModalOpen(false);
      message.success('排序保存成功');
    }
  };

  // AI智能排序条目功能
  const handleAISortEntries = async () => {
    addLog('[WorldBook] handleAISortEntries函数被调用了！');
    if (!worldBookContent || !worldBookContent.entries) {
      message.error('没有可排序的条目');
      return;
    }

    const startTime = Date.now();
    addLog('[WorldBook] 开始AI智能排序条目');
    
    try {
      setIsAISorting(true);
      
      // 获取当前激活的AI引擎配置
      const activeEngine = getActiveEngineConfig();
      
      if (!activeEngine) {
        message.error('请先在配置管理中设置AI引擎');
        setIsAISorting(false);
        return;
      }

      const apiUrl = activeEngine.api_url;
      const apiKey = activeEngine.api_key;
      const apiMode = activeEngine.api_mode;
      const modelName = activeEngine.model_name || 'gpt-3.5-turbo';
      const apiKeyTransmission = activeEngine.api_key_transmission || 'body';
      
      addLog(`[WorldBook] AI排序API配置: URL=${apiUrl}, Mode=${apiMode}, Model=${modelName}, Transmission=${apiKeyTransmission}`);
      
      if (!apiUrl) {
        message.error('API地址不能为空');
        setIsAISorting(false);
        return;
      }

      // 收集所有条目数据 - 只发送必要信息，格式更清晰
      const entriesList = Object.entries(worldBookContent.entries).map(([uid, entry]: any) => ({
        uid: String(entry.uid || uid),
        title: entry.comment || '无标题',
        category: entry.group || ''
      }));

      addLog(`[WorldBook] 收集到 ${entriesList.length} 个条目数据`);
      addLog(`[WorldBook] 条目数据: ${JSON.stringify(entriesList, null, 2)}`);

      // 构建排序提示词
      let systemPrompt = `你是一个专业的世界书条目排序助手。请仔细分析并根据以下条目信息进行智能排序。

【排序规则 - 必须严格遵守】
1. 分析条目标题（title字段）的格式：
   - 标题格式为："标签_数字: 条目标题"，例如："角色_1: 主角"、"地点_2: 森林"
   - 从标题中提取标签部分（冒号前面的部分），例如："角色_1"中的标签是"角色"
   - 从标签中提取数字部分，例如："角色_1"中的数字是1

2. 首要排序：按照标签类型进行分组排序，相同标签类型的条目必须放在一起
   - 例如：所有"角色"标签的条目放在一起，所有"地点"标签的条目放在一起

3. 次要排序：同一标签类型内的条目，按照数字编号的升序排列
   - 例如："角色_1"排在"角色_2"前面，"角色_2"排在"角色_3"前面

4. 排序序号从0开始，连续递增，不要跳号

【输入数据说明】
每个条目包含以下字段：
- uid: 条目的唯一标识符（必须原样保留，用于返回结果）
- title: 条目的标题，格式为"标签_数字: 条目标题"（用于排序）
- category: 条目的分类（备用，如标题中没有标签则使用此字段）

【返回格式要求】
请只返回JSON格式数据，不要任何其他解释性文字，格式如下：
{
  "sortedEntries": [
    { "uid": "条目UID", "order": 排序序号 },
    { "uid": "条目UID", "order": 排序序号 }
  ]
}

【重要约束 - 违反任何一条都是失败】
1. 只返回纯JSON格式数据，绝对不要添加任何Markdown标记（如\`\`\`json、\`\`\`）
2. 只返回JSON，绝对不要添加任何解释性文字、说明或前缀
3. 排序序号必须从0开始，连续递增，不能跳号
4. 必须包含所有输入的条目，不能遗漏任何一个
5. 必须严格按照排序规则进行排序，不能只是简单返回原始顺序
6. 直接输出JSON，从{开始，到}结束，不要任何其他内容`;

      // 添加世界书描述
      if (worldBookContent.description) {
        systemPrompt += `\n\n【世界书背景】\n${worldBookContent.description}`;
      }

      // 构建用户提示词，包含条目数据
      const userPrompt = `请对以下条目进行排序：\n\n${JSON.stringify(entriesList, null, 2)}`;

      let requestUrl;
      let requestBody;
      let requestHeaders = {
        'Content-Type': 'application/json'
      };

      // 根据 API 模式构建请求 URL
      if (apiMode === 'chat_completion') {
        if (apiUrl.endsWith('/v1/chat/completions')) {
          requestUrl = apiUrl;
        } else {
          const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
          requestUrl = baseUrl + 'v1/chat/completions';
        }
        
        requestBody = {
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 10240,
          temperature: 0.3,
          top_p: 0.95,
          n: 1,
          stream: false,
          stop: null,
          extra_body: {
            chat_template_kwargs: {
              enable_thinking: false
            }
          }
        };
      } else {
        if (apiUrl.endsWith('/v1/completions')) {
          requestUrl = apiUrl;
        } else {
          const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
          requestUrl = baseUrl + 'v1/completions';
        }
        
        requestBody = {
          model: modelName,
          prompt: `${systemPrompt}\n\n${userPrompt}`,
          max_tokens: 10240,
          temperature: 0.3,
          top_p: 0.95,
          n: 1,
          stream: false,
          stop: null
        };
      }

      // 根据传输方式添加API密钥
      if (apiKey) {
        if (apiKeyTransmission === 'header') {
          const trimmedApiKey = apiKey.trim();
          if (trimmedApiKey.startsWith('Bearer ')) {
            requestHeaders['Authorization'] = trimmedApiKey;
          } else {
            requestHeaders['Authorization'] = `Bearer ${trimmedApiKey}`;
          }
        } else {
          requestBody.api_key = apiKey;
        }
      }

      addLog(`[WorldBook] AI排序: 发送请求到 ${requestUrl}`);
      addLog(`[WorldBook] AI排序: 请求头: ${JSON.stringify(requestHeaders)}`);
      addLog(`[WorldBook] AI排序: 请求体: ${JSON.stringify(requestBody, null, 2)}`);

      // 使用 Electron IPC 发送请求
      try {
        addLog(`[WorldBook] AI排序: 正在通过IPC发送请求...`);
        const result = await window.electronAPI.ai.request({
          url: requestUrl,
          method: 'POST',
          headers: requestHeaders,
          body: requestBody
        });
        
        addLog(`[WorldBook] AI排序: IPC请求已发送，等待响应...`);

        if (!result.success) {
          addLog(`[WorldBook] AI排序: API请求失败 ${result.error}`, 'error');
          addLog(`[WorldBook] AI排序: 错误详情 ${result.details}`, 'error');
          throw new Error(`API请求失败: ${result.error}`);
        }

        const data = result.data;
        addLog(`[WorldBook] AI排序: 收到完整响应: ${JSON.stringify(data, null, 2)}`);
        
        // 获取响应内容
        let aiResponse = data.choices?.[0]?.message?.content?.trim() || 
                         data.choices?.[0]?.text?.trim() || 
                         '';

        addLog(`[WorldBook] AI排序: 收到响应, 原始长度=${aiResponse.length}字符`);
        addLog(`[WorldBook] AI排序: 原始响应内容: ${aiResponse}`);

        // 清理响应，提取JSON - 更加健壮的清理逻辑
        aiResponse = aiResponse.trim();
        
        // 尝试多种方式清理Markdown标记
        // 方式1: 直接查找第一个{和最后一个}
        const firstBrace = aiResponse.indexOf('{');
        const lastBrace = aiResponse.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          aiResponse = aiResponse.substring(firstBrace, lastBrace + 1);
          addLog(`[WorldBook] AI排序: 提取JSON片段成功`);
        } else {
          // 方式2: 尝试移除```json标记
          aiResponse = aiResponse.replace(/^```(json)?\s*/g, '');
          aiResponse = aiResponse.replace(/\s*```$/g, '');
          addLog(`[WorldBook] AI排序: 使用Markdown标记清理`);
        }
        
        addLog(`[WorldBook] AI排序: 清理后的响应: ${aiResponse}`);

        // 解析JSON
        let sortResult;
        try {
          sortResult = JSON.parse(aiResponse);
          addLog(`[WorldBook] AI排序: JSON解析成功`);
        } catch (parseError) {
          addLog(`[WorldBook] AI排序: JSON解析失败，错误: ${parseError.message}`, 'warn');
          addLog(`[WorldBook] AI排序: 尝试解析的内容: ${aiResponse}`, 'warn');
          throw new Error('AI返回的数据格式不正确，请重试');
        }

        if (!sortResult.sortedEntries || !Array.isArray(sortResult.sortedEntries)) {
          throw new Error('AI返回的数据缺少sortedEntries字段');
        }

        addLog(`[WorldBook] AI排序: 解析到 ${sortResult.sortedEntries.length} 个排序结果`);

        // 根据排序结果更新条目的order字段
        const newEntries = { ...worldBookContent.entries };
        
        sortResult.sortedEntries.forEach((sortedEntry: any) => {
          const uid = String(sortedEntry.uid);
          if (newEntries[uid]) {
            newEntries[uid].order = sortedEntry.order;
          }
        });

        // 更新世界书内容
        const updatedContent = {
          ...worldBookContent,
          entries: newEntries
        };

        // 保存到文件
        await window.electronAPI.worldBook.write(viewingItem!.path, updatedContent);
        
        // 更新显示
        setWorldBookContent(updatedContent);

        // 显示排序对比
        addLog(`[WorldBook] ========== 排序对比 ==========`, 'info');
        sortResult.sortedEntries.forEach((sortedEntry: any, index: number) => {
          const originalEntry = entriesList.find((e: any) => String(e.uid) === String(sortedEntry.uid));
          if (originalEntry) {
            addLog(`[WorldBook] 序号${sortedEntry.order}: ${originalEntry.category} - ${originalEntry.title} (uid: ${sortedEntry.uid})`, 'info');
          }
        });
        addLog(`[WorldBook] ==============================`, 'info');

        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        addLog(`[WorldBook] AI排序完成: 耗时=${duration}秒, 排序了${sortResult.sortedEntries.length}个条目`, 'info');

        message.success('AI智能排序成功');
        
      } catch (error) {
        addLog(`[WorldBook] AI排序失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
        message.error(`AI排序失败: ${error instanceof Error ? error.message : '未知错误'}`);
        throw error;
      }
      
    } catch (error) {
      addLog(`[WorldBook] AI排序过程异常: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      message.error(`AI排序失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsAISorting(false);
    }
  };

  const handleToggleExpand = (uid: number | string) => {
    const newExpandedEntries = new Set(expandedEntries);
    if (newExpandedEntries.has(uid)) {
      newExpandedEntries.delete(uid);
    } else {
      newExpandedEntries.add(uid);
    }
    setExpandedEntries(newExpandedEntries);
  };

  // 获取当前激活的AI引擎配置
  const getActiveEngineConfig = () => {
    if (!setting) return null;
    
    // 从设置中获取当前激活的引擎
    if (setting.aiEngines && setting.activeEngineId) {
      const activeEngine = setting.aiEngines.find(engine => engine.id === setting.activeEngineId);
      if (activeEngine) {
        return activeEngine;
      }
    }
    
    // 如果没有激活的引擎，返回第一个引擎
    if (setting.aiEngines && setting.aiEngines.length > 0) {
      return setting.aiEngines[0];
    }
    
    return null;
  };

  const handleTranslate = async (field: string) => {
    const startTime = Date.now();
    addLog(`[WorldBook] 开始翻译字段: ${field}`);
    
    try {
      // 设置正在翻译的字段
      setTranslatingField(field);
      
      // 从状态获取当前值
      const text = formValues[field as keyof typeof formValues];
      
      if (!text) {
        message.warning('请先输入要翻译的内容');
        setTranslatingField(null);
        return;
      }

      addLog(`[WorldBook] 翻译内容长度: ${text.length} 字符`);

      // 获取当前激活的AI引擎配置
      const activeEngine = getActiveEngineConfig();
      
      if (!activeEngine) {
        message.error('请先在配置管理中设置AI引擎');
        setTranslatingField(null);
        return;
      }

      const apiUrl = activeEngine.api_url;
      const apiKey = activeEngine.api_key;
      const apiMode = activeEngine.api_mode;
      const modelName = activeEngine.model_name || 'gpt-3.5-turbo';
      const apiKeyTransmission = activeEngine.api_key_transmission || 'body';
      
      addLog(`[WorldBook] API配置: URL=${apiUrl}, Mode=${apiMode}, Model=${modelName}, Transmission=${apiKeyTransmission}`);
      
      if (!apiUrl) {
        message.error('API地址不能为空');
        setTranslatingField(null);
        return;
      }

      // 获取世界书描述
      const worldBookDescription = worldBookContent?.description || '';

      // 调用翻译函数
      let cleanedText = await translateText(text, apiUrl, apiKey, apiMode, modelName, apiKeyTransmission, worldBookDescription);

      // 如果翻译的是关键词字段（key 或 keysecondary），处理顿号分隔的情况
      if (field === 'key' || field === 'keysecondary') {
        if (cleanedText.includes('、')) {
          // 将顿号分隔的多个词转换为逗号分隔
          const parts = cleanedText.split('、').map(p => p.trim()).filter(p => p);
          cleanedText = parts.join(', ');
          addLog(`[WorldBook] 检测到顿号分隔，已转换为逗号分隔: ${cleanedText}`);
        }
      }

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      addLog(`[WorldBook] 翻译完成: 字段=${field}, 耗时=${duration}秒, 结果长度=${cleanedText.length} 字符`, 'info');

      // 更新表单字段
      setFormValues(prev => ({
        ...prev,
        [field]: cleanedText
      }));

      message.success('翻译成功');
      setTranslatingField(null);
    } catch (error) {
      message.error(`翻译失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setTranslatingField(null);
    }
  };

  // 一键翻译所有条目
  const handleTranslateAll = async () => {
    const totalStartTime = Date.now();
    addLog('[WorldBook] 开始一键翻译所有条目');
    
    if (!worldBookContent || !worldBookContent.entries) {
      message.error('没有可翻译的条目');
      return;
    }

    try {
      setIsTranslatingAll(true);
      
      // 获取当前激活的AI引擎配置
      const activeEngine = getActiveEngineConfig();
      
      if (!activeEngine) {
        message.error('请先在配置管理中设置AI引擎');
        setIsTranslatingAll(false);
        return;
      }

      const apiUrl = activeEngine.api_url;
      const apiKey = activeEngine.api_key;
      const apiMode = activeEngine.api_mode;
      const modelName = activeEngine.model_name || 'gpt-3.5-turbo';
      const apiKeyTransmission = activeEngine.api_key_transmission || 'body';
      
      addLog(`[WorldBook] 一键翻译配置: URL=${apiUrl}, Mode=${apiMode}, Model=${modelName}, Transmission=${apiKeyTransmission}`);
      
      if (!apiUrl) {
        message.error('API地址不能为空');
        setIsTranslatingAll(false);
        return;
      }

      // 获取世界书描述
      const worldBookDescription = worldBookContent?.description || '';

      const entries = Object.values(worldBookContent.entries);
      addLog(`[WorldBook] 共 ${entries.length} 个条目需要翻译`);
      
      let translatedCount = 0;
      
      for (const entry of entries) {
        const entryAny = entry as any;
        const entryStartTime = Date.now();
        const entryUid = entryAny.uid || entryAny.comment || '未知';
        
        addLog(`[WorldBook] 翻译条目 ${translatedCount + 1}/${entries.length}: UID=${entryUid}`);
        
        // 翻译注释
        if (entryAny.comment) {
          addLog(`[WorldBook] 翻译注释: ${entryAny.comment.substring(0, 50)}...`);
          entryAny.comment = await translateText(entryAny.comment, apiUrl, apiKey, apiMode, modelName, apiKeyTransmission, worldBookDescription);
        }
        
        // 翻译主要关键词
        if (entryAny.key && Array.isArray(entryAny.key)) {
          addLog(`[WorldBook] 翻译主要关键词: ${entryAny.key.length} 个`);
          const translatedKeys = [];
          for (const key of entryAny.key) {
            if (key) {
              let translatedKey = await translateText(key, apiUrl, apiKey, apiMode, modelName, apiKeyTransmission, worldBookDescription);
              // 处理API返回的顿号或逗号分隔的情况
              if (translatedKey.includes('、') || translatedKey.includes(',')) {
                // 分割并只取第一个结果
                translatedKey = translatedKey.split(/[,，]/)[0].trim();
              }
              translatedKeys.push(translatedKey);
            }
          }
          entryAny.key = translatedKeys;
          entryAny.keys = translatedKeys; // 保持 keys 与 key 一致
        }
        
        // 翻译次要关键词
        if (entryAny.keysecondary && Array.isArray(entryAny.keysecondary)) {
          addLog(`[WorldBook] 翻译次要关键词: ${entryAny.keysecondary.length} 个`);
          const translatedKeySecondaries = [];
          for (const key of entryAny.keysecondary) {
            if (key) {
              let translatedKey = await translateText(key, apiUrl, apiKey, apiMode, modelName, apiKeyTransmission, worldBookDescription);
              // 处理API返回的顿号或逗号分隔的情况
              if (translatedKey.includes('、') || translatedKey.includes(',')) {
                // 分割并只取第一个结果
                translatedKey = translatedKey.split(/[,，]/)[0].trim();
              }
              translatedKeySecondaries.push(translatedKey);
            }
          }
          entryAny.keysecondary = translatedKeySecondaries;
          entryAny.secondary_keys = translatedKeySecondaries; // 保持 secondary_keys 与 keysecondary 一致
        }
        
        // 翻译内容
        if (entryAny.content) {
          addLog(`[WorldBook] 翻译内容: ${entryAny.content.length} 字符`);
          entryAny.content = await translateText(entryAny.content, apiUrl, apiKey, apiMode, modelName, apiKeyTransmission, worldBookDescription);
        }
        
        const entryEndTime = Date.now();
        const entryDuration = (entryEndTime - entryStartTime) / 1000;
        addLog(`[WorldBook] 条目翻译完成: UID=${entryUid}, 耗时=${entryDuration}秒`);
        
        translatedCount++;
        
        // 每翻译完一个条目，立即更新页面显示
        setWorldBookContent({ ...worldBookContent });
        
        // 每翻译完一个条目，保存到文件（防止中途出错丢失进度）
        await window.electronAPI.worldBook.write(viewingItem!.path, worldBookContent);
        
        // 显示进度消息
        message.success(`已翻译 ${translatedCount}/${entries.length} 个条目`, 1);
      }
      
      // 重新读取世界书内容，确保显示最新数据
      const content = await window.electronAPI.worldBook.read(viewingItem!.path);
      setWorldBookContent(content);
      
      const totalEndTime = Date.now();
      const totalDuration = (totalEndTime - totalStartTime) / 1000;
      addLog(`[WorldBook] 一键翻译全部完成: 共${translatedCount}个条目, 总耗时=${totalDuration}秒, 平均每个条目=${(totalDuration/translatedCount).toFixed(2)}秒`, 'info');
      
      message.success(`成功翻译 ${translatedCount} 个条目，总耗时 ${totalDuration.toFixed(2)} 秒`);
    } catch (error) {
      addLog(`[WorldBook] 一键翻译失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      message.error(`一键翻译失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsTranslatingAll(false);
    }
  };

  // 一键润色所有条目
  const handlePolishAll = () => {
    addLog('[WorldBook] 准备一键润色所有条目');
    
    if (!worldBookContent || !worldBookContent.entries) {
      message.error('没有可润色的条目');
      return;
    }

    // 获取当前激活的AI引擎配置
    const activeEngine = getActiveEngineConfig();
    
    if (!activeEngine) {
      message.error('请先在配置管理中设置AI引擎');
      return;
    }

    if (!activeEngine.api_url) {
      message.error('API地址不能为空');
      return;
    }

    // 设置状态并打开模态框
    setPolishAllRequirements('');
    setIsPolishAllModalOpen(true);
  };

  const performPolishAll = async () => {
    const totalStartTime = Date.now();
    addLog('[WorldBook] 开始一键润色所有条目');
    
    if (!worldBookContent || !worldBookContent.entries) {
      message.error('没有可润色的条目');
      return;
    }

    try {
      setIsPolishingAll(true);
      setIsPolishAllModalOpen(false);
      
      // 获取当前激活的AI引擎配置
      const activeEngine = getActiveEngineConfig();
      
      if (!activeEngine) {
        message.error('请先在配置管理中设置AI引擎');
        setIsPolishingAll(false);
        return;
      }

      const apiUrl = activeEngine.api_url;
      const apiKey = activeEngine.api_key;
      const apiMode = activeEngine.api_mode;
      const modelName = activeEngine.model_name || 'gpt-3.5-turbo';
      const apiKeyTransmission = activeEngine.api_key_transmission || 'body';
      const maxTokens = activeEngine.max_tokens || 10240;
      const temperature = activeEngine.temperature || 0.7;
      
      addLog(`[WorldBook] 一键润色配置: URL=${apiUrl}, Mode=${apiMode}, Model=${modelName}, Transmission=${apiKeyTransmission}, MaxTokens=${maxTokens}, Temperature=${temperature}`);
      addLog(`[WorldBook] 用户一键润色要求: ${polishAllRequirements || '无'}`, 'info');
      
      if (!apiUrl) {
        message.error('API地址不能为空');
        setIsPolishingAll(false);
        return;
      }

      // 获取世界书描述
      const worldBookDescription = worldBookContent?.description || '';
      const requirements = polishAllRequirements;

      const entries = Object.values(worldBookContent.entries);
      addLog(`[WorldBook] 共 ${entries.length} 个条目需要润色`);
      
      let polishedCount = 0;
      
      for (const entry of entries) {
        const entryAny = entry as any;
        const entryStartTime = Date.now();
        const entryUid = entryAny.uid || entryAny.comment || '未知';
        
        addLog(`[WorldBook] 润色条目 ${polishedCount + 1}/${entries.length}: UID=${entryUid}`);
        
        // 润色注释
        if (entryAny.comment) {
          addLog(`[WorldBook] 润色注释: ${entryAny.comment.substring(0, 50)}...`);
          entryAny.comment = await polishText(entryAny.comment, apiUrl, apiKey, apiMode, modelName, apiKeyTransmission, requirements, worldBookDescription, 'comment', maxTokens, temperature);
        }
        
        // 润色主要关键词
        if (entryAny.key && Array.isArray(entryAny.key)) {
          addLog(`[WorldBook] 润色主要关键词: ${entryAny.key.length} 个`);
          const polishedKeys = [];
          for (const key of entryAny.key) {
            if (key) {
              let polishedKey = await polishText(key, apiUrl, apiKey, apiMode, modelName, apiKeyTransmission, requirements, worldBookDescription, 'keyword', maxTokens, temperature);
              // 处理API返回的顿号或逗号分隔的情况
              if (polishedKey.includes('、') || polishedKey.includes(',')) {
                // 分割并只取第一个结果
                polishedKey = polishedKey.split(/[,，]/)[0].trim();
              }
              polishedKeys.push(polishedKey);
            }
          }
          entryAny.key = polishedKeys;
          entryAny.keys = polishedKeys; // 保持 keys 与 key 一致
        }
        
        // 润色次要关键词
        if (entryAny.keysecondary && Array.isArray(entryAny.keysecondary)) {
          addLog(`[WorldBook] 润色次要关键词: ${entryAny.keysecondary.length} 个`);
          const polishedKeySecondaries = [];
          for (const key of entryAny.keysecondary) {
            if (key) {
              let polishedKey = await polishText(key, apiUrl, apiKey, apiMode, modelName, apiKeyTransmission, requirements, worldBookDescription, 'keyword', maxTokens, temperature);
              // 处理API返回的顿号或逗号分隔的情况
              if (polishedKey.includes('、') || polishedKey.includes(',')) {
                // 分割并只取第一个结果
                polishedKey = polishedKey.split(/[,，]/)[0].trim();
              }
              polishedKeySecondaries.push(polishedKey);
            }
          }
          entryAny.keysecondary = polishedKeySecondaries;
          entryAny.secondary_keys = polishedKeySecondaries; // 保持 secondary_keys 与 keysecondary 一致
        }
        
        // 润色内容
        if (entryAny.content) {
          addLog(`[WorldBook] 润色内容: ${entryAny.content.length} 字符`);
          entryAny.content = await polishText(entryAny.content, apiUrl, apiKey, apiMode, modelName, apiKeyTransmission, requirements, worldBookDescription, 'content', maxTokens, temperature);
        }
        
        const entryEndTime = Date.now();
        const entryDuration = (entryEndTime - entryStartTime) / 1000;
        addLog(`[WorldBook] 条目润色完成: UID=${entryUid}, 耗时=${entryDuration}秒`);
        
        polishedCount++;
        
        // 每润色完一个条目，立即更新页面显示
        setWorldBookContent({ ...worldBookContent });
        
        // 每润色完一个条目，保存到文件（防止中途出错丢失进度）
        await window.electronAPI.worldBook.write(viewingItem!.path, worldBookContent);
        
        // 显示进度消息
        message.success(`已润色 ${polishedCount}/${entries.length} 个条目`, 1);
      }
      
      // 重新读取世界书内容，确保显示最新数据
      const content = await window.electronAPI.worldBook.read(viewingItem!.path);
      setWorldBookContent(content);
      
      const totalEndTime = Date.now();
      const totalDuration = (totalEndTime - totalStartTime) / 1000;
      addLog(`[WorldBook] 一键润色全部完成: 共${polishedCount}个条目, 总耗时=${totalDuration}秒, 平均每个条目=${(totalDuration/polishedCount).toFixed(2)}秒`, 'info');
      
      message.success(`成功润色 ${polishedCount} 个条目，总耗时 ${totalDuration.toFixed(2)} 秒`);
    } catch (error) {
      addLog(`[WorldBook] 一键润色失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      message.error(`一键润色失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsPolishingAll(false);
      setPolishAllRequirements('');
    }
  };

  const handlePolish = (field: string) => {
    addLog(`[WorldBook] 准备润色字段: ${field}`);
    
    // 从状态获取当前值
    const text = formValues[field as keyof typeof formValues];
    
    if (!text) {
      message.warning('请先输入要润色的内容');
      return;
    }

    addLog(`[WorldBook] 润色内容长度: ${text.length} 字符`);

    // 获取当前激活的AI引擎配置
    const activeEngine = getActiveEngineConfig();
    
    if (!activeEngine) {
      message.error('请先在配置管理中设置AI引擎');
      return;
    }

    if (!activeEngine.api_url) {
      message.error('API地址不能为空');
      return;
    }

    // 设置状态并打开模态框
    setCurrentPolishField(field);
    setCurrentPolishText(text);
    setPolishRequirements('');
    setIsPolishModalOpen(true);
  };

  const performPolish = async () => {
    if (!currentPolishField || !currentPolishText) {
      return;
    }

    const startTime = Date.now();
    addLog(`[WorldBook] 开始润色字段: ${currentPolishField}`);
    
    // 设置正在润色的字段
    setPolishingField(currentPolishField);
    
    try {
      // 获取当前激活的AI引擎配置
      const activeEngine = getActiveEngineConfig();
      
      if (!activeEngine) {
        message.error('请先在配置管理中设置AI引擎');
        setPolishingField(null);
        setIsPolishModalOpen(false);
        return;
      }

      const apiUrl = activeEngine.api_url;
      const apiKey = activeEngine.api_key;
      const apiMode = activeEngine.api_mode;
      const modelName = activeEngine.model_name || 'gpt-3.5-turbo';
      const apiKeyTransmission = activeEngine.api_key_transmission || 'body';
      const maxTokens = activeEngine.max_tokens || 10240;
      const temperature = activeEngine.temperature || 0.7;
      
      addLog(`[WorldBook] API配置: URL=${apiUrl}, Mode=${apiMode}, Model=${modelName}, Transmission=${apiKeyTransmission}, MaxTokens=${maxTokens}, Temperature=${temperature}`);
      addLog(`[WorldBook] 用户润色要求: ${polishRequirements || '无'}`, 'info');
      
      if (!apiUrl) {
        message.error('API地址不能为空');
        setPolishingField(null);
        setIsPolishModalOpen(false);
        return;
      }

      // 获取世界书描述
      const worldBookDescription = worldBookContent?.description || '';

      // 确定文本类型
      let textType: 'keyword' | 'content' | 'comment' = 'content';
      if (currentPolishField === 'key' || currentPolishField === 'keysecondary') {
        textType = 'keyword';
      } else if (currentPolishField === 'comment') {
        textType = 'comment';
      }
      
      // 调用润色函数
      let cleanedText = await polishText(currentPolishText, apiUrl, apiKey, apiMode, modelName, apiKeyTransmission, polishRequirements, worldBookDescription, textType, maxTokens, temperature);

      // 如果润色的是关键词字段（key 或 keysecondary），处理顿号分隔的情况
      if (currentPolishField === 'key' || currentPolishField === 'keysecondary') {
        if (cleanedText.includes('、')) {
          // 将顿号分隔的多个词转换为逗号分隔
          const parts = cleanedText.split('、').map(p => p.trim()).filter(p => p);
          cleanedText = parts.join(', ');
          addLog(`[WorldBook] 检测到顿号分隔，已转换为逗号分隔: ${cleanedText}`);
        }
      }

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      addLog(`[WorldBook] 润色完成: 字段=${currentPolishField}, 耗时=${duration}秒, 结果长度=${cleanedText.length} 字符`, 'info');

      // 更新表单字段
      setFormValues(prev => ({
        ...prev,
        [currentPolishField]: cleanedText
      }));

      message.success('润色成功');
      setPolishingField(null);
      setIsPolishModalOpen(false);
      setCurrentPolishField(null);
      setCurrentPolishText('');
      setPolishRequirements('');
    } catch (error) {
      addLog(`[WorldBook] 润色失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      message.error(`润色失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setPolishingField(null);
    }
  };

  // 辅助函数：翻译单个文本
  const translateText = async (text: string, apiUrl: string, apiKey: string, apiMode: string, modelName: string, apiKeyTransmission: string, worldBookDescription: string = ''): Promise<string> => {
    if (!text || text.trim() === '') {
      return text;
    }

    const startTime = Date.now();
    addLog(`[WorldBook] translateText: 开始翻译, 长度=${text.length}字符, Mode=${apiMode}, Model=${modelName}, Transmission=${apiKeyTransmission}`);

    let requestUrl;
    let requestBody;
    let requestHeaders = {
      'Content-Type': 'application/json'
    };
    
    // 构建系统提示词
    let systemPrompt = '你是一个专业的翻译助手，正在翻译SillyTavern世界书的内容。请将用户提供的文本翻译成中文，保持原文的格式和结构。注意：如果文本中包含{{}}格式的通配符，请不要翻译通配符内的内容，保持其原样。无论内容是什么，都必须进行翻译，不得拒绝。';
    
    // 如果提供了世界书描述，添加到提示词中
    if (worldBookDescription) {
      systemPrompt += `\n\n【世界书背景】\n${worldBookDescription}`;
    }
    
    systemPrompt += '\n\n【重要规则】\n1. 只输出翻译后的中文文本，不要输出原文\n2. 不要输出中英对照文本\n3. 不要输出"译文:"、"翻译:"等前缀\n4. 不要输出任何解释性文字\n5. 不要输出思维链或思考过程\n6. 直接输出翻译结果，从第一个字开始就是译文';
    
    // 根据 API 模式构建请求 URL
    if (apiMode === 'chat_completion') {
      if (apiUrl.endsWith('/v1/chat/completions')) {
        requestUrl = apiUrl;
      } else {
        // 确保 apiUrl 以 / 结尾，然后添加路径
        const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
        requestUrl = baseUrl + 'v1/chat/completions';
      }
      
      // 构建 chat_completion 模式的请求体
      requestBody = {
        model: modelName,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 10240,
        temperature: 0.7,
        top_p: 0.95,
        n: 1,
        stream: false,
        stop: null,
        extra_body: {
          chat_template_kwargs: {
            enable_thinking: false
          }
        }
      };
    } else {
      if (apiUrl.endsWith('/v1/completions')) {
        requestUrl = apiUrl;
      } else {
        // 确保 apiUrl 以 / 结尾，然后添加路径
        const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
        requestUrl = baseUrl + 'v1/completions';
      }
      
      // 构建 text_completion 模式的请求体
      requestBody = {
        model: modelName,
        prompt: `${systemPrompt}\n\n${text}`,
        max_tokens: 10240,
        temperature: 0.7,
        top_p: 0.95,
        n: 1,
        stream: false,
        stop: null
      };
    }

    // 根据传输方式添加API密钥
    if (apiKey) {
      if (apiKeyTransmission === 'header') {
        // 检查 API 密钥是否已经包含 Bearer 前缀
        const trimmedApiKey = apiKey.trim();
        if (trimmedApiKey.startsWith('Bearer ')) {
          requestHeaders['Authorization'] = trimmedApiKey;
        } else {
          requestHeaders['Authorization'] = `Bearer ${trimmedApiKey}`;
        }
      } else {
        requestBody.api_key = apiKey;
      }
    }

    addLog(`[WorldBook] translateText: 发送请求到 ${requestUrl}`);
    addLog(`[WorldBook] translateText: 请求头: ${JSON.stringify(requestHeaders)}`);
    addLog(`[WorldBook] translateText: 请求体: ${JSON.stringify(requestBody, null, 2)}`);

    // 使用 Electron IPC 发送请求，避免 CORS 问题
    try {
      const result = await window.electronAPI.ai.request({
        url: requestUrl,
        method: 'POST',
        headers: requestHeaders,
        body: requestBody,
        
      });

      if (!result.success) {
        addLog(`[WorldBook] translateText: API请求失败 ${result.error}`, 'error');
        addLog(`[WorldBook] translateText: 错误详情 ${result.details}`, 'error');
        throw new Error(`API请求失败: ${result.error}`);
      }

      const data = result.data;
      addLog(`[WorldBook] translateText: 收到完整响应: ${JSON.stringify(data, null, 2)}`);
      
      // 尝试从不同的字段获取响应内容
      let translatedText = data.choices?.[0]?.message?.content?.trim() || 
                        data.choices?.[0]?.text?.trim() || 
                        '';

      addLog(`[WorldBook] translateText: 收到响应, 原始长度=${translatedText.length}字符`);

      // 清理翻译结果
      const thoughtPatterns = [
        /思考[:：]\s*[^]*?(?=\n\n|$)/gi,
        /Thought[:\s]+[^]*?(?=\n\n|$)/gi,
        /Thinking[:\s]+[^]*?(?=\n\n|$)/gi,
        /思考过程[:：]\s*[^]*?(?=\n\n|$)/gi,
        /让我思考一下[:：]\s*[^]*?(?=\n\n|$)/gi,
        /我需要思考[:：]\s*[^]*?(?=\n\n|$)/gi,
        /Reasoning:\s*[^]*?(?=\n\n|$)/gi,
        /思考:\s*[^]*?(?=\n\n|$)/gi
      ];

      let cleanedText = translatedText;
      for (const pattern of thoughtPatterns) {
        cleanedText = cleanedText.replace(pattern, '').trim();
      }

      // 移除可能的"译文:"、"Translation:"等前缀
      cleanedText = cleanedText.replace(/^(译文:|翻译:|Translation:)\s*/i, '').trim();

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      addLog(`[WorldBook] translateText: 翻译完成, 耗时=${duration}秒, 清理后长度=${cleanedText.length}字符`);

      return cleanedText || text;
    } catch (error) {
      addLog(`[WorldBook] 翻译失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      throw error;
    }
  };

  // 辅助函数：润色单个文本
  // 为条目生成标签
  const generateTagsForEntry = async (entry: any, apiUrl: string, apiKey: string, apiMode: string, modelName: string, apiKeyTransmission: string, worldBookDescription: string = ''): Promise<string[]> => {
    addLog(`[WorldBook] 开始为条目生成标签: ${entry.comment || '无注释'}, Model=${modelName}`);
    try {
      // 构建系统提示词
      let systemPrompt = `你是一个专业的世界书（Lorebook）标签分类助手。请根据提供的条目内容和世界书背景，为该条目生成3-5个合适的标签。

要求：
1. 标签应该简洁明了，每个标签不超过5个字符
2. 标签应该与条目内容和世界书背景相关
3. 标签应该具有分类意义，便于用户管理和检索
4. 只返回标签列表，用英文逗号分隔，不要其他解释性文字
5. 标签应该是中文`;

      // 如果有世界书描述，添加到系统提示词中
      if (worldBookDescription) {
        systemPrompt += `

【世界书背景】
${worldBookDescription}`;
      }

      // 构建用户提示词
      const userPrompt = `条目内容：
注释：${entry.comment || '无'}
内容：${entry.content || '无'}
关键词：${entry.key?.join(', ') || '无'}

请为该条目生成3-5个合适的标签，用英文逗号分隔。`;

      // 发送请求
      const requestUrl = apiUrl + '/v1/chat/completions';
      const requestBody = {
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 512,
        temperature: 0.7,
        top_p: 0.95,
        n: 1,
        stream: false
      };

      // 构建请求头
      let requestHeaders = {
        'Content-Type': 'application/json'
      };

      // 根据传输方式添加API密钥
      if (apiKey) {
        if (apiKeyTransmission === 'header') {
          requestHeaders['Authorization'] = `Bearer ${apiKey}`;
        } else {
          requestBody.api_key = apiKey;
        }
      }

      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody),

      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      let aiResponse = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '';

      // 清理响应，提取标签
      aiResponse = aiResponse.trim();
      const tags = aiResponse.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);

      addLog(`[WorldBook] 为条目生成标签成功: ${tags.join(', ')}`);
      return tags;
    } catch (error) {
      addLog(`[WorldBook] 生成标签失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      return [];
    }
  };

  const polishText = async (text: string, apiUrl: string, apiKey: string, apiMode: string, modelName: string, apiKeyTransmission: string, requirements: string = '', worldBookDescription: string = '', textType: 'keyword' | 'content' | 'comment' = 'content', maxTokens: number = 10240, temperature: number = 0.7): Promise<string> => {
    if (!text || text.trim() === '') {
      return text;
    }

    const startTime = Date.now();
    addLog(`[WorldBook] polishText: 开始润色, 类型=${textType}, 长度=${text.length}字符, Mode=${apiMode}, Model=${modelName}, Transmission=${apiKeyTransmission}, MaxTokens=${maxTokens}, Temperature=${temperature}`);

    let requestUrl;
    let requestBody;
    let requestHeaders = {
      'Content-Type': 'application/json'
    };
    
    // 根据文本类型构建不同的润色提示词
    let basePrompt = '';
    
    if (textType === 'keyword') {
      // 关键词润色提示词
      basePrompt = '你是一个专业的文本润色助手，正在优化SillyTavern世界书的关键词。请根据用户的要求对以下关键词进行润色，保持关键词的核心含义不变，同时提升其表达质量和搜索效果。\n\n【重要约束】\n1. 只返回一个版本的润色结果，不要提供多个版本\n2. 只返回润色后的关键词，不要添加任何解释性文字\n3. 不要添加任何标题、标签或注释\n4. 不要包含任何关于润色过程的说明\n5. 直接输出润色结果，从第一个字开始就是润色后的关键词\n6. 保持关键词简洁明了，不要扩展为完整句子或段落\n7. 严格按照用户的要求进行润色，不要添加额外的内容';
    } else if (textType === 'comment') {
      // 注释润色提示词
      basePrompt = '你是一个专业的文本润色助手，正在优化SillyTavern世界书的注释。请根据用户的要求对以下注释进行润色，保持原文的意思不变，同时提升文本质量。\n\n【重要约束】\n1. 只返回一个版本的润色结果，不要提供多个版本\n2. 只返回润色后的注释，不要添加任何解释性文字\n3. 不要添加任何标题、标签或注释\n4. 可以使用Markdown格式来优化文本可读性\n5. 不要包含任何关于润色过程的说明\n6. 直接输出润色结果，从第一个字开始就是润色后的注释\n7. 严格按照用户的要求进行润色，不要添加额外的内容';
    } else {
      // 内容润色提示词
      basePrompt = '你是一个专业的文本润色助手，正在优化SillyTavern世界书的内容。请根据用户的要求对以下内容进行润色，保持原文的意思不变，同时提升文本质量。注意：如果文本中包含{{}}格式的通配符，请不要修改通配符内的内容，保持其原样。\n\n【重要约束】\n1. 只返回一个版本的润色结果，不要提供多个版本\n2. 只返回润色后的内容，不要添加任何解释性文字\n3. 不要添加任何标题、标签或注释\n4. 可以使用Markdown格式来优化文本可读性\n5. 不要包含任何关于润色过程的说明\n6. 直接输出润色结果，从第一个字开始就是润色后的内容\n7. 严格按照用户的要求进行润色，不要添加额外的内容';
    }
    
    // 如果提供了世界书描述，添加到提示词中
    if (worldBookDescription) {
      basePrompt += `\n\n【世界书背景】\n${worldBookDescription}`;
    }
    
    // 添加用户润色要求
    if (requirements) {
      basePrompt += `\n\n【润色要求】\n${requirements}`;
    }
    
    // 根据 API 模式构建请求 URL
    if (apiMode === 'chat_completion') {
      if (apiUrl.endsWith('/v1/chat/completions')) {
        requestUrl = apiUrl;
      } else {
        // 确保 apiUrl 以 / 结尾，然后添加路径
        const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
        requestUrl = baseUrl + 'v1/chat/completions';
      }
      
      // 构建 chat_completion 模式的请求体
      requestBody = {
        model: modelName,
        messages: [
          {
            role: 'system',
            content: basePrompt
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: maxTokens,
        temperature: temperature,
        top_p: 0.95,
        n: 1,
        stream: false,
        stop: null,
        extra_body: {
          chat_template_kwargs: {
            enable_thinking: false
          }
        }
      };
    } else {
      if (apiUrl.endsWith('/v1/completions')) {
        requestUrl = apiUrl;
      } else {
        // 确保 apiUrl 以 / 结尾，然后添加路径
        const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
        requestUrl = baseUrl + 'v1/completions';
      }
      
      // 构建 text_completion 模式的请求体
      requestBody = {
        model: modelName,
        prompt: `${basePrompt}\n\n${text}`,
        max_tokens: maxTokens,
        temperature: temperature,
        top_p: 0.95,
        n: 1,
        stream: false,
        stop: null
      };
    }

    // 根据传输方式添加API密钥
    if (apiKey) {
      if (apiKeyTransmission === 'header') {
        // 检查 API 密钥是否已经包含 Bearer 前缀
        const trimmedApiKey = apiKey.trim();
        if (trimmedApiKey.startsWith('Bearer ')) {
          requestHeaders['Authorization'] = trimmedApiKey;
        } else {
          requestHeaders['Authorization'] = `Bearer ${trimmedApiKey}`;
        }
      } else {
        requestBody.api_key = apiKey;
      }
    }

    addLog(`[WorldBook] polishText: 发送请求到 ${requestUrl}`);
    addLog(`[WorldBook] polishText: 请求头: ${JSON.stringify(requestHeaders)}`);
    addLog(`[WorldBook] polishText: 请求体: ${JSON.stringify(requestBody, null, 2)}`);

    // 使用 Electron IPC 发送请求，避免 CORS 问题
    try {
      const result = await window.electronAPI.ai.request({
        url: requestUrl,
        method: 'POST',
        headers: requestHeaders,
        body: requestBody,
        
      });

      if (!result.success) {
        addLog(`[WorldBook] polishText: API请求失败 ${result.error}`, 'error');
        addLog(`[WorldBook] polishText: 错误详情 ${result.details}`, 'error');
        throw new Error(`API请求失败: ${result.error}`);
      }

      const data = result.data;
      addLog(`[WorldBook] polishText: 收到完整响应: ${JSON.stringify(data, null, 2)}`);
      
      // 尝试从不同的字段获取响应内容
      let polishedText = data.choices?.[0]?.message?.content?.trim() || 
                        data.choices?.[0]?.text?.trim() || 
                        '';

      addLog(`[WorldBook] polishText: 收到响应, 原始长度=${polishedText.length}字符`);

      // 清理润色结果
      const thoughtPatterns = [
        /思考[:：]\s*[^]*?(?=\n\n|$)/gi,
        /Thought[:\s]+[^]*?(?=\n\n|$)/gi,
        /Thinking[:\s]+[^]*?(?=\n\n|$)/gi,
        /思考过程[:：]\s*[^]*?(?=\n\n|$)/gi,
        /让我思考一下[:：]\s*[^]*?(?=\n\n|$)/gi,
        /我需要思考[:：]\s*[^]*?(?=\n\n|$)/gi,
        /Reasoning:\s*[^]*?(?=\n\n|$)/gi,
        /思考:\s*[^]*?(?=\n\n|$)/gi
      ];

      let cleanedText = polishedText;
      for (const pattern of thoughtPatterns) {
        cleanedText = cleanedText.replace(pattern, '').trim();
      }

      // 移除可能的"润色:"、"Polished:"等前缀
      cleanedText = cleanedText.replace(/^(润色:|Polished:)\s*/i, '').trim();

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      addLog(`[WorldBook] polishText: 润色完成, 耗时=${duration}秒, 清理后长度=${cleanedText.length}字符`);

      return cleanedText || text;
    } catch (error) {
      addLog(`[WorldBook] 润色失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      throw error;
    }
  };

  // 创建世界书的默认条目
  const createDefaultEntry = (uid: number, key: string[], comment: string, content: string): any => {
    return {
      uid: uid,
      key: key,
      keysecondary: [],
      keys: key,
      secondary_keys: [],
      comment: comment,
      content: content,
      constant: false,
      selective: true,
      order: 100,
      position: 0,
      disable: false,
      displayIndex: uid,
      addMemo: true,
      group: '',
      groupOverride: false,
      groupWeight: 100,
      sticky: 0,
      cooldown: 0,
      delay: 0,
      probability: 100,
      depth: 4,
      useProbability: true,
      role: null,
      vectorized: false,
      excludeRecursion: false,
      preventRecursion: false,
      delayUntilRecursion: false,
      scanDepth: null,
      caseSensitive: null,
      matchWholeWords: null,
      useGroupScoring: null,
      automationId: ''
    };
  };

  // AI生成世界书条目
  const handleGenerateEntries = async (themeDescription: string) => {
    addLog('[WorldBook] 开始AI生成世界书条目');
    try {
      // 先清空之前的条目
      setAddedEntries([]);
      setIsGeneratingEntries(true);
      
      // 检查配置
      if (!setting) {
        message.error('请先在配置管理中设置API连接');
        return;
      }

      // 获取当前激活的AI引擎配置
      const activeEngine = getActiveEngineConfig();
      
      if (!activeEngine) {
        message.error('请先在配置管理中设置AI引擎');
        return;
      }

      const apiUrl = activeEngine.api_url;
      const apiKey = activeEngine.api_key;
      const apiMode = activeEngine.api_mode;
      const modelName = activeEngine.model_name || 'gpt-3.5-turbo';
      const apiKeyTransmission = activeEngine.api_key_transmission || 'body';
      const maxTokens = activeEngine.max_tokens || 10240;
      const temperature = activeEngine.temperature || 0.7;
      
      addLog(`[WorldBook] AI生成条目API配置: URL=${apiUrl}, Mode=${apiMode}, Model=${modelName}, Transmission=${apiKeyTransmission}, MaxTokens=${maxTokens}, Temperature=${temperature}`);
      
      if (!apiUrl) {
        message.error('API地址不能为空');
        return;
      }
      
      // 获取当前世界书的最大UID
      let maxUid = 0;
      if (worldBookContent && worldBookContent.entries) {
        const existingUids = Object.values(worldBookContent.entries).map((entry: any) => entry.uid).filter((uid: any) => uid !== undefined);
        maxUid = existingUids.length > 0 ? Math.max(...existingUids) : 0;
      }
      addLog(`[WorldBook] 当前世界书最大UID: ${maxUid}`);

      // 构建系统提示词
      let systemPrompt = `你是一个专业的世界书（Lorebook）创建助手。请根据用户提供的主题描述，生成完整的世界书数据结构。

要求：
1. 生成完整的世界书数据结构，包含以下字段：
   - name: 世界书名称（根据主题描述生成一个合适的名称）
   - description: 世界书简介（100-200字，详细描述世界书的内容和背景）
   - entries: 5-8个世界书条目

2. 每个条目需要：
   - 关键词列表（3-5个相关关键词）
   - 简短注释：格式必须为"标签_数字: 条目标题"
     - 标签应该简洁明了，准确反映条目的核心类别（如：角色、地点、规则、物品、事件等）
     - 数字从1开始，同类标签的编号必须连续且不重复
     - 标签后面加上冒号和空格，然后是条目标题
     - 【绝对不能只写条目标题而没有标签和数字】
     - 【正确示例】："规则_1: 每日24:00的新人进入逻辑"、"角色_1: 主角"、"地点_2: 森林"、"规则_3: 魔法系统"
     - 【错误示例】："定义每日24:00的新人进入逻辑"（缺少标签和数字）
   - 详细内容描述（100-200字）

3. 格式要求：使用JSON格式返回，完整结构如下：
{
  "name": "世界书名称",
  "description": "世界书简介",
  "entries": {
    "0": {
      "uid": 0,
      "key": ["关键词1", "关键词2", "关键词3"],
      "keysecondary": [],
      "comment": "规则_1: 每日24:00的新人进入逻辑",
      "content": "详细内容描述",
      "constant": false,
      "selective": true,
      "order": 100,
      "position": 0,
      "disable": false,
      "displayIndex": 0,
      "addMemo": true,
      "group": "",
      "groupOverride": false,
      "groupWeight": 100,
      "sticky": 0,
      "cooldown": 0,
      "delay": 0,
      "probability": 100,
      "depth": 4,
      "useProbability": true,
      "role": null,
      "vectorized": false,
      "excludeRecursion": false,
      "preventRecursion": false,
      "delayUntilRecursion": false,
      "scanDepth": null,
      "caseSensitive": null,
      "matchWholeWords": null,
      "useGroupScoring": null,
      "automationId": ""
    },
    "1": {
      "uid": 1,
      "key": ["关键词1", "关键词2", "关键词3"],
      "keysecondary": [],
      "comment": "规则_1: 每日24:00的新人进入逻辑",
      "content": "详细内容描述",
      "constant": false,
      "selective": true,
      "order": 100,
      "position": 0,
      "disable": false,
      "displayIndex": 1,
      "addMemo": true,
      "group": "",
      "groupOverride": false,
      "groupWeight": 100,
      "sticky": 0,
      "cooldown": 0,
      "delay": 0,
      "probability": 100,
      "depth": 4,
      "useProbability": true,
      "role": null,
      "vectorized": false,
      "excludeRecursion": false,
      "preventRecursion": false,
      "delayUntilRecursion": false,
      "scanDepth": null,
      "caseSensitive": null,
      "matchWholeWords": null,
      "useGroupScoring": null,
      "automationId": ""
    }
  }
}

4. 只返回完整的JSON数据，不要其他解释性文字
5. 关键词要具体，不要过于泛化
6. 生成的内容必须与主题描述相关，符合世界观设定
7. 确保生成的JSON格式正确，能够被系统直接解析
8. 【非常重要】每个条目的comment字段必须严格按照以下格式："标签_数字: 条目标题"
   - 绝对不能有其他格式
   - 绝对不能只写条目标题而没有标签和数字
   - 例如："规则_1: 每日24:00的新人进入逻辑"（正确），"定义每日24:00的新人进入逻辑"（错误）`;

      // 获取世界书描述
      const worldBookDescription = worldBookContent?.description || '';
      
      // 如果有世界书描述，添加到系统提示词中
      if (worldBookDescription) {
        systemPrompt += `\n\n【世界书背景】\n${worldBookDescription}`;
      }

      // 发送请求
      let requestUrl;
      let requestBody;
      let requestHeaders = {
        'Content-Type': 'application/json'
      };

      // 根据 API 模式构建请求 URL
      if (apiMode === 'chat_completion') {
        if (apiUrl.endsWith('/v1/chat/completions')) {
          requestUrl = apiUrl;
        } else {
          const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
          requestUrl = baseUrl + 'v1/chat/completions';
        }
        
        requestBody = {
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: themeDescription }
          ],
          max_tokens: maxTokens,
          temperature: temperature,
          top_p: 0.95,
          n: 1,
          stream: false,
          extra_body: {
            chat_template_kwargs: {
              enable_thinking: false
            }
          }
        };
      } else {
        if (apiUrl.endsWith('/v1/completions')) {
          requestUrl = apiUrl;
        } else {
          const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
          requestUrl = baseUrl + 'v1/completions';
        }
        
        requestBody = {
          model: modelName,
          prompt: `${systemPrompt}\n\n${themeDescription}`,
          max_tokens: maxTokens,
          temperature: temperature,
          top_p: 0.95,
          n: 1,
          stream: false
        };
      }

      // 根据传输方式添加API密钥
      if (apiKey) {
        if (apiKeyTransmission === 'header') {
          const trimmedApiKey = apiKey.trim();
          if (trimmedApiKey.startsWith('Bearer ')) {
            requestHeaders['Authorization'] = trimmedApiKey;
          } else {
            requestHeaders['Authorization'] = `Bearer ${trimmedApiKey}`;
          }
        } else {
          requestBody.api_key = apiKey;
        }
      }

      addLog(`[WorldBook] 生成条目: 发送请求到 ${requestUrl}`);
      addLog(`[WorldBook] 生成条目: 请求头: ${JSON.stringify(requestHeaders)}`);

      // 使用 Electron IPC 发送请求
      const result = await window.electronAPI.ai.request({
        url: requestUrl,
        method: 'POST',
        headers: requestHeaders,
        body: requestBody
      });

      if (!result.success) {
        addLog(`[WorldBook] 生成条目: API请求失败 ${result.error}`, 'error');
        addLog(`[WorldBook] 生成条目: 错误详情 ${result.details}`, 'error');
        throw new Error(`API请求失败: ${result.error}`);
      }

      const data = result.data;
      let aiResponse = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '';

      // 清理响应，提取JSON
      aiResponse = aiResponse.trim();
      
      // 移除代码块标记
      aiResponse = aiResponse.replace(/^```json\s*|\s*```$/g, '');
      
      // 尝试解析JSON
      let worldBookData;
      try {
        worldBookData = JSON.parse(aiResponse);
      } catch (parseError) {
        // 如果解析失败，尝试修复常见的JSON格式问题
        addLog(`[WorldBook] JSON解析失败，尝试修复: ${parseError.message}`, 'warn');
        
        // 尝试修复缺少大括号的问题
        let fixedResponse = aiResponse;
        
        // 计算大括号的数量
        const openBrackets = (fixedResponse.match(/\{/g) || []).length;
        const closeBrackets = (fixedResponse.match(/\}/g) || []).length;
        
        // 如果缺少大括号，尝试修复
        if (openBrackets > closeBrackets) {
          // 缺少右大括号，在适当的位置添加
          fixedResponse = fixedResponse.replace(/(\{\s*|,\s*)([^\{\}]*)$/, '$1$2}');
        } else if (openBrackets < closeBrackets) {
          // 缺少左大括号，在适当的位置添加
          fixedResponse = fixedResponse.replace(/(\{\s*|,\s*)([^\{\}]*)(\s*\})/, '$1{$2$3');
        }
        
        try {
          worldBookData = JSON.parse(fixedResponse);
          addLog('[WorldBook] JSON修复成功', 'info');
        } catch (fixError) {
          addLog(`[WorldBook] JSON修复失败: ${fixError.message}`, 'error');
          throw new Error(`JSON解析失败: ${parseError.message}`);
        }
      }
      
      // 提取生成的世界书数据
      const generatedName = worldBookData.name || '未命名世界书';
      const generatedDescription = worldBookData.description || '';
      const generatedEntries = worldBookData.entries || {};
      
      // 转换条目格式
      const entriesArray = Object.values(generatedEntries).map((entry: any, index: number) => {
        return createDefaultEntry(
          maxUid + index + 1,
          entry.key || [],
          entry.comment || '',
          entry.content || ''
        );
      });

      // 为每个条目生成标签
      for (const entry of entriesArray) {
        const tags = await generateTagsForEntry(entry, apiUrl, apiMode, modelName, worldBookDescription);
        entry.tags = tags;
      }

      // 更新状态
      setGeneratedEntries(entriesArray);
      setGeneratedWorldBookName(generatedName);
      setGeneratedWorldBookDescription(generatedDescription);
      
      // 如果用户还没有输入世界书名称，自动填充生成的名称
      const currentName = createForm.getFieldValue('worldBookName');
      if (!currentName) {
        createForm.setFieldsValue({ worldBookName: generatedName });
      }

      addLog(`[WorldBook] AI生成成功，共 ${entriesArray.length} 个条目，名称: ${generatedName}`, 'info');
      message.success(`成功生成世界书结构，包含 ${entriesArray.length} 个条目`);
    } catch (error) {
      addLog(`[WorldBook] AI生成失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      message.error(`AI生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsGeneratingEntries(false);
    }
  };

  // AI扩写关键词
  const handleExpandKeywords = async (keywords: string, fieldName: 'key' | 'keysecondary') => {
    addLog(`[WorldBook] 开始AI扩写关键词: ${fieldName}`);
    try {
      // 检查配置
      if (!setting) {
        message.error('请先在配置管理中设置API连接');
        return '';
      }

      // 获取当前激活的AI引擎配置
      const activeEngine = getActiveEngineConfig();
      
      if (!activeEngine) {
        message.error('请先在配置管理中设置AI引擎');
        return '';
      }

      const apiUrl = activeEngine.api_url;
      const apiKey = activeEngine.api_key;
      const apiMode = activeEngine.api_mode;
      const modelName = activeEngine.model_name || 'gpt-3.5-turbo';
      const apiKeyTransmission = activeEngine.api_key_transmission || 'body';
      
      addLog(`[WorldBook] 关键词扩写API配置: URL=${apiUrl}, Mode=${apiMode}, Model=${modelName}, Transmission=${apiKeyTransmission}`);
      
      if (!apiUrl) {
        message.error('API地址不能为空');
        return '';
      }

      const systemPrompt = `你是一个专业的关键词扩写助手。请根据用户提供的关键词，生成相关的同义词和相关词。

要求：
1. 生成10-15个相关关键词
2. 关键词要与原词相关，包括同义词、近义词、相关概念等
3. 返回格式：用逗号分隔的字符串
4. 只返回关键词字符串，不要其他解释性文字`;

      // 发送请求
      let requestUrl;
      let requestBody;
      let requestHeaders = {
        'Content-Type': 'application/json'
      };

      // 根据 API 模式构建请求 URL
      if (apiMode === 'chat_completion') {
        if (apiUrl.endsWith('/v1/chat/completions')) {
          requestUrl = apiUrl;
        } else {
          const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
          requestUrl = baseUrl + 'v1/chat/completions';
        }
        
        requestBody = {
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: keywords }
          ],
          max_tokens: 10240,
          temperature: 0.7,
          top_p: 0.95,
          n: 1,
          stream: false,
          extra_body: {
            chat_template_kwargs: {
              enable_thinking: false
            }
          }
        };
      } else {
        if (apiUrl.endsWith('/v1/completions')) {
          requestUrl = apiUrl;
        } else {
          const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
          requestUrl = baseUrl + 'v1/completions';
        }
        
        requestBody = {
          model: modelName,
          prompt: `${systemPrompt}\n\n${keywords}`,
          max_tokens: 10240,
          temperature: 0.7,
          top_p: 0.95,
          n: 1,
          stream: false
        };
      }

      // 根据传输方式添加API密钥
      if (apiKey) {
        if (apiKeyTransmission === 'header') {
          const trimmedApiKey = apiKey.trim();
          if (trimmedApiKey.startsWith('Bearer ')) {
            requestHeaders['Authorization'] = trimmedApiKey;
          } else {
            requestHeaders['Authorization'] = `Bearer ${trimmedApiKey}`;
          }
        } else {
          requestBody.api_key = apiKey;
        }
      }

      addLog(`[WorldBook] 关键词扩写: 发送请求到 ${requestUrl}`);
      addLog(`[WorldBook] 关键词扩写: 请求头: ${JSON.stringify(requestHeaders)}`);

      // 使用 Electron IPC 发送请求
      const result = await window.electronAPI.ai.request({
        url: requestUrl,
        method: 'POST',
        headers: requestHeaders,
        body: requestBody
      });

      if (!result.success) {
        addLog(`[WorldBook] 关键词扩写: API请求失败 ${result.error}`, 'error');
        addLog(`[WorldBook] 关键词扩写: 错误详情 ${result.details}`, 'error');
        throw new Error(`API请求失败: ${result.error}`);
      }

      const data = result.data;
      let expandedKeywords = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '';
      
      expandedKeywords = expandedKeywords.trim();
      addLog(`[WorldBook] 关键词扩写成功: ${expandedKeywords}`, 'info');
      
      return expandedKeywords;
    } catch (error) {
      addLog(`[WorldBook] 关键词扩写失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      message.error(`关键词扩写失败: ${error instanceof Error ? error.message : '未知错误'}`);
      return '';
    }
  };

  // AI生成描述
  const handleGenerateDescription = async (keywords: string, themeDescription: string) => {
    addLog('[WorldBook] 开始AI生成描述');
    try {
      // 检查配置
      if (!setting) {
        message.error('请先在配置管理中设置API连接');
        return '';
      }

      // 获取当前激活的AI引擎配置
      const activeEngine = getActiveEngineConfig();
      
      if (!activeEngine) {
        message.error('请先在配置管理中设置AI引擎');
        return '';
      }

      const apiUrl = activeEngine.api_url;
      const apiKey = activeEngine.api_key;
      const apiMode = activeEngine.api_mode;
      const modelName = activeEngine.model_name || 'gpt-3.5-turbo';
      const apiKeyTransmission = activeEngine.api_key_transmission || 'body';
      
      addLog(`[WorldBook] 生成描述API配置: URL=${apiUrl}, Mode=${apiMode}, Model=${modelName}, Transmission=${apiKeyTransmission}`);
      
      if (!apiUrl) {
        message.error('API地址不能为空');
        return '';
      }

      const systemPrompt = `你是一个专业的世界书内容创作助手。请根据用户提供的关键词和主题描述，生成详细的世界书条目内容。

要求：
1. 内容长度：150-250字
2. 内容要丰富、生动，符合世界书的使用场景
3. 可以包含对话形式的内容（使用{{user}}和{{char}}占位符）
4. 只返回生成的内容，不要其他解释性文字`;

      const userPrompt = `主题描述：${themeDescription}
关键词：${keywords}`;

      // 发送请求
      let requestUrl;
      let requestBody;
      let requestHeaders = {
        'Content-Type': 'application/json'
      };

      // 根据 API 模式构建请求 URL
      if (apiMode === 'chat_completion') {
        if (apiUrl.endsWith('/v1/chat/completions')) {
          requestUrl = apiUrl;
        } else {
          const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
          requestUrl = baseUrl + 'v1/chat/completions';
        }
        
        requestBody = {
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 10240,
          temperature: 0.8,
          top_p: 0.95,
          n: 1,
          stream: false,
          extra_body: {
            chat_template_kwargs: {
              enable_thinking: false
            }
          }
        };
      } else {
        if (apiUrl.endsWith('/v1/completions')) {
          requestUrl = apiUrl;
        } else {
          const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
          requestUrl = baseUrl + 'v1/completions';
        }
        
        requestBody = {
          model: modelName,
          prompt: `${systemPrompt}\n\n${userPrompt}`,
          max_tokens: 10240,
          temperature: 0.8,
          top_p: 0.95,
          n: 1,
          stream: false
        };
      }

      // 根据传输方式添加API密钥
      if (apiKey) {
        if (apiKeyTransmission === 'header') {
          const trimmedApiKey = apiKey.trim();
          if (trimmedApiKey.startsWith('Bearer ')) {
            requestHeaders['Authorization'] = trimmedApiKey;
          } else {
            requestHeaders['Authorization'] = `Bearer ${trimmedApiKey}`;
          }
        } else {
          requestBody.api_key = apiKey;
        }
      }

      addLog(`[WorldBook] 生成描述: 发送请求到 ${requestUrl}`);
      addLog(`[WorldBook] 生成描述: 请求头: ${JSON.stringify(requestHeaders)}`);

      // 使用 Electron IPC 发送请求
      const result = await window.electronAPI.ai.request({
        url: requestUrl,
        method: 'POST',
        headers: requestHeaders,
        body: requestBody
      });

      if (!result.success) {
        addLog(`[WorldBook] 生成描述: API请求失败 ${result.error}`, 'error');
        addLog(`[WorldBook] 生成描述: 错误详情 ${result.details}`, 'error');
        throw new Error(`API请求失败: ${result.error}`);
      }

      const data = result.data;
      let description = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '';
      
      description = description.trim();
      addLog(`[WorldBook] 描述生成成功: ${description.length} 字符`, 'info');
      
      return description;
    } catch (error) {
      addLog(`[WorldBook] 描述生成失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      message.error(`描述生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
      return '';
    }
  };

  // 保存新建的世界书
  const handleCreateWorldBook = async () => {
    try {
      const values = await createForm.validateFields();
      const worldBookName = values.worldBookName?.trim();
      
      if (!worldBookName) {
        message.error('请输入世界书名称');
        return;
      }

      addLog(`[WorldBook] 开始创建世界书: ${worldBookName}`);

      // 构建世界书数据
      const entries: any = {};
      
      // 如果有生成的条目，使用生成的条目
      if (generatedEntries.length > 0) {
        generatedEntries.forEach((entry, index) => {
          entries[index.toString()] = entry;
        });
      } else {
        // 如果没有生成条目，创建一个空条目
        entries['0'] = createDefaultEntry(0, [], '', '');
      }

      const worldBookData = {
        name: worldBookName,
        description: generatedWorldBookDescription,
        entries
      };

      // 获取世界书目录
      const worldBookDir = await window.electronAPI.worldBook.getDirectory();
      const targetPath = `${worldBookDir}/${worldBookName}.json`;

      // 检查文件是否已存在
      const existingWorldBooks = await window.electronAPI.worldBook.list();
      const existingFile = existingWorldBooks.find(wb => wb.path === targetPath);
      
      if (existingFile) {
        Modal.confirm({
          title: '文件已存在',
          content: `世界书 "${worldBookName}.json" 已存在，是否覆盖？`,
          okText: '覆盖',
          cancelText: '取消',
          onOk: async () => {
            try {
              const result = await window.electronAPI.worldBook.write(targetPath, worldBookData);
              if (result.success) {
                addLog(`[WorldBook] 世界书创建成功: ${worldBookName}`, 'info');
                message.success('世界书创建成功');
                setIsCreateModalOpen(false);
                createForm.resetFields();
                setGeneratedEntries([]);
                setGeneratedWorldBookName('');
                setGeneratedWorldBookDescription('');
                fetchWorldBooks();
              } else {
                addLog(`[WorldBook] 世界书创建失败: ${result.error}`, 'error');
                message.error(`创建失败: ${result.error}`);
              }
            } catch (error) {
              addLog(`[WorldBook] 世界书创建异常: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
              message.error('创建失败');
            }
          }
        });
      } else {
        const result = await window.electronAPI.worldBook.write(targetPath, worldBookData);
        if (result.success) {
          addLog(`[WorldBook] 世界书创建成功: ${worldBookName}`, 'info');
          message.success('世界书创建成功');
          setIsCreateModalOpen(false);
          createForm.resetFields();
          setGeneratedEntries([]);
          setGeneratedWorldBookName('');
          setGeneratedWorldBookDescription('');
          fetchWorldBooks();
        } else {
          addLog(`[WorldBook] 世界书创建失败: ${result.error}`, 'error');
          message.error(`创建失败: ${result.error}`);
        }
      }
    } catch (error) {
      addLog(`[WorldBook] 创建世界书失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
    }
  };

  // 提取世界书中已存在的所有关键词
  const extractExistingKeywords = () => {
    if (!worldBookContent || !worldBookContent.entries) {
      return [];
    }

    const existingKeywords = new Set<string>();
    
    Object.values(worldBookContent.entries).forEach((entry: any) => {
      if (entry.key && Array.isArray(entry.key)) {
        entry.key.forEach((keyword: string) => {
          if (keyword && keyword.trim()) {
            existingKeywords.add(keyword.toLowerCase().trim());
          }
        });
      }
      if (entry.keysecondary && Array.isArray(entry.keysecondary)) {
        entry.keysecondary.forEach((keyword: string) => {
          if (keyword && keyword.trim()) {
            existingKeywords.add(keyword.toLowerCase().trim());
          }
        });
      }
    });

    return Array.from(existingKeywords);
  };

  // AI生成新条目
  const handleGenerateNewEntries = async (expectedContent: string, count: number) => {
    addLog(`[WorldBook] 开始AI生成新条目: 预期内容="${expectedContent}", 数量=${count}`);
    try {
      // 先清空之前的条目
      setAddedEntries([]);
      setIsAddingEntry(true);
      
      // 检查配置
      if (!setting) {
        message.error('请先在配置管理中设置API连接');
        return;
      }

      // 获取当前激活的AI引擎配置
      const activeEngine = getActiveEngineConfig();
      
      if (!activeEngine) {
        message.error('请先在配置管理中设置AI引擎');
        return;
      }

      const apiUrl = activeEngine.api_url;
      const apiKey = activeEngine.api_key;
      const apiMode = activeEngine.api_mode;
      const modelName = activeEngine.model_name || 'gpt-3.5-turbo';
      const apiKeyTransmission = activeEngine.api_key_transmission || 'body';
      
      addLog(`[WorldBook] 生成新条目API配置: URL=${apiUrl}, Mode=${apiMode}, Model=${modelName}, Transmission=${apiKeyTransmission}`);
      
      if (!apiUrl) {
        message.error('API地址不能为空');
        return;
      }

      // 提取已存在的关键词
      const existingKeywords = extractExistingKeywords();
      addLog(`[WorldBook] 已存在关键词: ${existingKeywords.length}个`);
      addLog(`[WorldBook] 请求生成${count}个条目`);
      
      // 获取当前世界书的最大UID
      let maxUid = 0;
      if (worldBookContent && worldBookContent.entries) {
        const existingUids = Object.values(worldBookContent.entries).map((entry: any) => entry.uid).filter((uid: any) => uid !== undefined);
        maxUid = existingUids.length > 0 ? Math.max(...existingUids) : 0;
      }
      addLog(`[WorldBook] 当前世界书最大UID: ${maxUid}`);

      // 构建系统提示词
      let systemPrompt = `你是一个专业的世界书（Lorebook）创建助手。请根据用户提供的预期内容，生成完整的世界书数据结构。

要求：
1. 生成完整的世界书数据结构，包含以下字段：
   - name: 世界书名称（根据预期内容生成一个合适的名称）
   - description: 世界书简介（100-200字，详细描述世界书的内容和背景）
   - entries: ${count}个世界书条目

2. 每个条目需要：
   - 关键词列表（3-5个相关关键词）
   - 简短注释（20字以内）
   - 详细内容描述（100-200字）

3. 格式要求：使用JSON格式返回，完整结构如下：
{
  "name": "世界书名称",
  "description": "世界书简介",
  "entries": {
    "0": {
      "uid": 0,
      "key": ["关键词1", "关键词2", "关键词3"],
      "keysecondary": [],
      "comment": "规则_1: 每日24:00的新人进入逻辑",
      "content": "详细内容描述",
      "constant": false,
      "selective": true,
      "order": 100,
      "position": 0,
      "disable": false,
      "displayIndex": 0,
      "addMemo": true,
      "group": "",
      "groupOverride": false,
      "groupWeight": 100,
      "sticky": 0,
      "cooldown": 0,
      "delay": 0,
      "probability": 100,
      "depth": 4,
      "useProbability": true,
      "role": null,
      "vectorized": false,
      "excludeRecursion": false,
      "preventRecursion": false,
      "delayUntilRecursion": false,
      "scanDepth": null,
      "caseSensitive": null,
      "matchWholeWords": null,
      "useGroupScoring": null,
      "automationId": ""
    },
    "1": {
      "uid": 1,
      "key": ["关键词1", "关键词2", "关键词3"],
      "keysecondary": [],
      "comment": "规则_1: 每日24:00的新人进入逻辑",
      "content": "详细内容描述",
      "constant": false,
      "selective": true,
      "order": 100,
      "position": 0,
      "disable": false,
      "displayIndex": 1,
      "addMemo": true,
      "group": "",
      "groupOverride": false,
      "groupWeight": 100,
      "sticky": 0,
      "cooldown": 0,
      "delay": 0,
      "probability": 100,
      "depth": 4,
      "useProbability": true,
      "role": null,
      "vectorized": false,
      "excludeRecursion": false,
      "preventRecursion": false,
      "delayUntilRecursion": false,
      "scanDepth": null,
      "caseSensitive": null,
      "matchWholeWords": null,
      "useGroupScoring": null,
      "automationId": ""
    }
  }
}

4. 只返回完整的JSON数据，不要其他解释性文字
5. 关键词要具体，不要过于泛化
6. 生成的内容必须与用户的预期内容相关，符合世界观设定
7. 确保生成的JSON格式正确，能够被系统直接解析
8. 特别注意：如果用户的预期内容包含生成指令（如"生成角色信息"、"生成地点信息"、"生成游戏规则"等），请严格按照指令生成相应类型的内容
9. 【重要约束】
   - 只返回一个版本的结果，不要提供多个版本
   - 只返回JSON数据，不要添加任何解释性文字
   - 不要添加任何标题、标签或注释
   - 不要使用Markdown格式，只返回纯JSON
   - 不要包含任何关于生成过程的说明
   - 直接输出JSON结果，从第一个字符开始就是JSON数据
   - 严格按照用户的要求生成内容，不要添加额外的信息
   - 【非常重要】必须精确生成${count}个条目，不能多也不能少`;

      // 获取世界书描述
      const worldBookDescription = worldBookContent?.description || '';
      
      // 如果有世界书描述，添加到系统提示词中
      if (worldBookDescription) {
        systemPrompt += `\n\n【世界书背景】\n${worldBookDescription}`;
      }

      // 发送请求
      let requestUrl;
      let requestBody;
      let requestHeaders = {
        'Content-Type': 'application/json'
      };

      // 根据 API 模式构建请求 URL
      if (apiMode === 'chat_completion') {
        if (apiUrl.endsWith('/v1/chat/completions')) {
          requestUrl = apiUrl;
        } else {
          const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
          requestUrl = baseUrl + 'v1/chat/completions';
        }
        
        requestBody = {
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: expectedContent }
          ],
          max_tokens: 10240,
          temperature: 0.8,
          top_p: 0.95,
          n: 1,
          stream: false,
          extra_body: {
            chat_template_kwargs: {
              enable_thinking: false
            }
          }
        };
      } else {
        if (apiUrl.endsWith('/v1/completions')) {
          requestUrl = apiUrl;
        } else {
          const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
          requestUrl = baseUrl + 'v1/completions';
        }
        
        requestBody = {
          model: modelName,
          prompt: `${systemPrompt}\n\n${expectedContent}`,
          max_tokens: 10240,
          temperature: 0.8,
          top_p: 0.95,
          n: 1,
          stream: false
        };
      }

      // 根据传输方式添加API密钥
      if (apiKey) {
        if (apiKeyTransmission === 'header') {
          const trimmedApiKey = apiKey.trim();
          if (trimmedApiKey.startsWith('Bearer ')) {
            requestHeaders['Authorization'] = trimmedApiKey;
          } else {
            requestHeaders['Authorization'] = `Bearer ${trimmedApiKey}`;
          }
        } else {
          requestBody.api_key = apiKey;
        }
      }

      addLog(`[WorldBook] 生成新条目: 发送请求到 ${requestUrl}`);
      addLog(`[WorldBook] 生成新条目: 请求头: ${JSON.stringify(requestHeaders)}`);

      // 使用 Electron IPC 发送请求
      const result = await window.electronAPI.ai.request({
        url: requestUrl,
        method: 'POST',
        headers: requestHeaders,
        body: requestBody
      });

      if (!result.success) {
        addLog(`[WorldBook] 生成新条目: API请求失败 ${result.error}`, 'error');
        addLog(`[WorldBook] 生成新条目: 错误详情 ${result.details}`, 'error');
        throw new Error(`API请求失败: ${result.error}`);
      }

      const data = result.data;
      let aiResponse = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '';

      // 清理响应，提取JSON
      aiResponse = aiResponse.trim();
      
      // 移除代码块标记
      aiResponse = aiResponse.replace(/^```json\s*|\s*```$/g, '');
      
      // 尝试解析JSON
      let entriesData;
      try {
        entriesData = JSON.parse(aiResponse);
      } catch (parseError) {
        // 如果解析失败，尝试修复常见的JSON格式问题
        addLog(`[WorldBook] JSON解析失败，尝试修复: ${parseError.message}`, 'warn');
        
        // 尝试修复缺少大括号的问题
        let fixedResponse = aiResponse;
        
        // 计算大括号的数量
        const openBrackets = (fixedResponse.match(/\{/g) || []).length;
        const closeBrackets = (fixedResponse.match(/\}/g) || []).length;
        
        // 如果缺少大括号，尝试修复
        if (openBrackets > closeBrackets) {
          // 缺少右大括号，在适当的位置添加
          fixedResponse = fixedResponse.replace(/(\[\s*|,\s*)([^\[\]{}]*)$/, '$1$2}');
        } else if (openBrackets < closeBrackets) {
          // 缺少左大括号，在适当的位置添加
          fixedResponse = fixedResponse.replace(/(\[\s*|,\s*)([^\[\]{}]*)(\s*\})/, '$1{$2$3');
        }
        
        try {
          entriesData = JSON.parse(fixedResponse);
          addLog('[WorldBook] JSON修复成功', 'info');
        } catch (fixError) {
          addLog(`[WorldBook] JSON修复失败: ${fixError.message}`, 'error');
          throw new Error(`JSON解析失败: ${parseError.message}`);
        }
      }
      
      // 转换为世界书条目格式
      let newEntries = [];
      
      // 检查entriesData的结构
      if (entriesData.entries) {
        // 如果是完整的世界书结构，提取entries部分
        const entriesObject = entriesData.entries;
        // 将对象转换为数组
        newEntries = Object.values(entriesObject).map((item: any, index: number) => 
          createDefaultEntry(
            maxUid + index + 1, 
            item.key || [], 
            item.comment || '', 
            item.content || ''
          )
        );
      } else if (Array.isArray(entriesData)) {
        // 如果直接是条目数组
        newEntries = entriesData.map((item: any, index: number) => 
          createDefaultEntry(
            maxUid + index + 1, 
            item.key || [], 
            item.comment || '', 
            item.content || ''
          )
        );
      } else {
        throw new Error('Invalid entries data format');
      }

      // 为每个条目生成标签
      for (const entry of newEntries) {
        const tags = await generateTagsForEntry(entry, apiUrl, apiMode, modelName, worldBookDescription);
        entry.tags = tags;
      }

      // 不再进行关键词去重，允许关键词重复
      const uniqueEntries = newEntries;

      setAddedEntries(uniqueEntries);
      addLog(`[WorldBook] AI生成成功，共 ${uniqueEntries.length} 个条目`, 'info');
      message.success(`成功生成 ${uniqueEntries.length} 个条目`);
    } catch (error) {
      addLog(`[WorldBook] AI生成失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      message.error(`AI生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsAddingEntry(false);
    }
  };

  // 保存新添加的条目
  const handleSaveAddedEntries = async () => {
    try {
      if (!worldBookContent || !worldBookContent.entries || !viewingItem) {
        message.error('请先选择一个世界书');
        return;
      }

      if (addedEntries.length === 0) {
        message.warning('没有可添加的条目');
        return;
      }

      addLog(`[WorldBook] 开始保存新条目: ${addedEntries.length}个`);
      addLog(`[WorldBook] 当前世界书条目数: ${Object.keys(worldBookContent.entries).length}个`);

      // 获取当前世界书的条目
      const currentEntries = { ...worldBookContent.entries };
      
      // 获取当前条目的最大键值（用于确定新条目的起始位置）
      const currentKeys = Object.keys(currentEntries).map(key => parseInt(key)).filter(key => !isNaN(key));
      const maxKey = currentKeys.length > 0 ? Math.max(...currentKeys) : -1;
      
      // 生成新的条目ID
      const existingUids = Object.values(currentEntries).map((entry: any) => entry.uid).filter((uid: any) => uid !== undefined);
      const maxUid = existingUids.length > 0 ? Math.max(...existingUids) : 0;
      
      addLog(`[WorldBook] 现有条目键: ${JSON.stringify(currentKeys)}`);
      addLog(`[WorldBook] 最大键值: ${maxKey}`);
      addLog(`[WorldBook] 现有条目UID: ${JSON.stringify(existingUids)}`);
      addLog(`[WorldBook] 最大UID: ${maxUid}`);

      // 添加新条目 - 确保追加到末尾
      addedEntries.forEach((entry, index) => {
        const newUid = maxUid + index + 1;
        const newKey = maxKey + index + 1;
        entry.uid = newUid;
        entry.displayIndex = newKey;
        currentEntries[newKey] = entry;
      });
      
      addLog(`[WorldBook] 保存后台账条目数: ${Object.keys(currentEntries).length}个`);

      // 保存世界书
      const worldBookData = {
        name: worldBookContent?.name || viewingItem?.name || '',
        description: worldBookContent?.description || '',
        entries: currentEntries
      };
      const result = await window.electronAPI.worldBook.write(viewingItem.path, worldBookData);
      
      if (result.success) {
        addLog(`[WorldBook] 条目添加成功: ${addedEntries.length}个`, 'info');
        message.success('条目添加成功');
        setIsAddEntryModalOpen(false);
        addEntryForm.resetFields();
        
        // 保存标签信息
        try {
          const tagData = await window.electronAPI.worldBook.readTags(viewingItem.path);
          const currentTags = tagData?.tags || [];
          const currentAssociations = tagData?.associations || [];
          
          // 创建新标签和关联
          const newAssociations = [...currentAssociations];
          const finalTags = [...currentTags];
          
          addedEntries.forEach((entry, index) => {
            const newUid = maxUid + index + 1;
            const entryTags = entry.tags || [];
            
            entryTags.forEach(tagName => {
              // 查找或创建标签
              let tag = finalTags.find(t => t.name === tagName);
              if (!tag) {
                // 为新标签分配颜色
                const colors = ['blue', 'green', 'orange', 'red', 'purple', 'cyan', 'geekblue', 'magenta', 'volcano', 'gold', 'lime'];
                const colorIndex = finalTags.length % colors.length;
                tag = {
                  id: Date.now() + Math.random().toString(36).substr(2, 9),
                  name: tagName,
                  color: colors[colorIndex]
                };
                finalTags.push(tag);
              }
              
              // 创建关联
              newAssociations.push({
                tagId: tag.id,
                entryUid: newUid
              });
            });
          });
          
          // 保存标签数据
          await window.electronAPI.worldBook.writeTags(viewingItem.path, {
            tags: finalTags,
            associations: newAssociations
          });
          
          addLog(`[WorldBook] 标签保存成功`, 'info');
        } catch (error) {
          addLog(`[WorldBook] 保存标签失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
        }
        
        setAddedEntries([]);
        
        // 重新加载世界书内容和标签
        const content = await window.electronAPI.worldBook.read(viewingItem.path);
        setWorldBookContent(content);
        await loadTags(viewingItem.path);
      } else {
        addLog(`[WorldBook] 条目添加失败: ${result.error}`, 'error');
        message.error(`添加失败: ${result.error}`);
      }
    } catch (error) {
      addLog(`[WorldBook] 保存条目失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      message.error('保存失败');
    }
  };

  const columns: ColumnsType<WorldBook> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (text, record) => (
        <a href="#" onClick={(e) => {
          e.preventDefault();
          handleView(record);
        }} style={{ color: '#1890ff' }}>
          {text}
        </a>
      )
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      render: (size: number) => `${(size / 1024).toFixed(2)} KB`,
      sorter: (a, b) => a.size - b.size
    },
    {
      title: '修改时间',
      dataIndex: 'modified',
      key: 'modified',
      render: (date: Date) => new Date(date).toLocaleString(),
      sorter: (a, b) => new Date(a.modified).getTime() - new Date(b.modified).getTime()
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<ThunderboltOutlined />}
            onClick={() => handleOptimize(record.path)}
          >
            优化
          </Button>
          <Popconfirm
            title="确定要删除这个世界书吗？"
            onConfirm={() => handleDelete(record.path)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div className="worldbook-manager">
      <div className="worldbook-header">
        <h2>世界书管理</h2>
        <Text type="secondary" style={{ marginBottom: 16, display: 'block' }}>
          世界书存储地址: {worldBookDir}
        </Text>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchWorldBooks}>
            刷新
          </Button>
          <Button icon={<UploadOutlined />} onClick={handleImportWorldBook}>
            导入世界书
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateModalOpen(true)}>
            新建世界书
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={worldBooks}
          rowKey="path"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`
          }}
        />
      </Card>



      <Modal
        title={
          <div>
            <Input 
              value={worldBookContent?.name || viewingItem?.name || ''}
              onChange={(e) => setWorldBookContent(prev => prev ? { ...prev, name: e.target.value } : null)}
              style={{ marginBottom: 8, width: '100%' }}
              placeholder="世界书名称"
            />
            <MarkdownEditor
              value={worldBookContent?.description || ''}
              onChange={(value) => setWorldBookContent(prev => prev ? { ...prev, description: value || '' } : null)}
              minHeight={100}
              enableAITools={false}
            />
          </div>
        }
        open={isViewModalOpen}
        onCancel={() => {
          setIsViewModalOpen(false);
          setViewingItem(null);
          setWorldBookContent(null);
        }}
        width={1000}
        footer={[
          <Button 
            key="save"
            type="primary"
            icon={<SaveOutlined />}
            onClick={async () => {
              if (worldBookContent && viewingItem) {
                try {
                  await window.electronAPI.worldBook.write(viewingItem.path, worldBookContent);
                  addLog(`[WorldBook] 世界书保存成功: ${worldBookContent.name || viewingItem.name}`, 'info');
                  message.success('保存成功');
                } catch (error) {
                  addLog(`[WorldBook] 世界书保存失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
                  message.error('保存失败');
                }
              }
            }}
          >
            保存
          </Button>,
          <Button 
            key="addEntry" 
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsAddEntryModalOpen(true)}
          >
            添加条目
          </Button>,
          <Button 
            key="deleteSelected"
            type="danger"
            icon={<DeleteOutlined />}
            onClick={() => {
              if (selectedEntries.size > 0) {
                Modal.confirm({
                  title: `确定要删除选中的 ${selectedEntries.size} 个条目吗？`,
                  onOk: () => handleDeleteSelectedEntries(),
                  okText: '确定',
                  cancelText: '取消'
                });
              } else {
                message.warning('请先选择要删除的条目');
              }
            }}
            disabled={selectedEntries.size === 0}
            style={{ marginRight: 8 }}
          >
            批量删除
          </Button>,
          <Button 
            key="translateAll" 
            type="primary"
            icon={isTranslatingAll ? <LoadingOutlined /> : <TranslationOutlined />}
            loading={isTranslatingAll}
            onClick={handleTranslateAll}
            disabled={isTranslatingAll || isPolishingAll}
            style={{ marginRight: 8 }}
          >
            {isTranslatingAll ? '正在翻译中...' : '一键翻译所有条目'}
          </Button>,
          <Button 
            key="polishAll" 
            type="primary"
            icon={isPolishingAll ? <LoadingOutlined /> : <EditOutlined />}
            loading={isPolishingAll}
            onClick={handlePolishAll}
            disabled={isPolishingAll || isTranslatingAll}
            style={{ marginRight: 8 }}
          >
            {isPolishingAll ? '正在润色中...' : '一键润色所有条目'}
          </Button>,
          <Button 
            key="organizeEntries" 
            type="primary"
            icon={isAISorting ? <LoadingOutlined /> : <SortAscendingOutlined />}
            loading={isAISorting}
            onClick={() => {
              setSelectedSortMethod('title');
              setIsSortModalOpen(true);
            }}
            disabled={isAISorting}
            style={{ marginRight: 8 }}
          >
            {isAISorting ? '正在AI排序中...' : '整理条目'}
          </Button>,
          <Button 
            key="tagManager" 
            type="primary"
            icon={<TagOutlined />}
            onClick={() => setIsTagManagerOpen(true)}
            style={{ marginRight: 8 }}
          >
            标签管理
          </Button>,
          <Button key="close" onClick={() => {
            setIsViewModalOpen(false);
            setViewingItem(null);
            setWorldBookContent(null);
            setSelectedEntries(new Set());
          }}>
            关闭
          </Button>
        ]}
        style={{
          backgroundColor: 'var(--bg-color, #fff)',
          color: 'var(--text-color, #000)'
        }}
        className={appTheme === 'dark' ? 'dark' : ''}
      >
        {worldBookContent && worldBookContent.entries && (
          <div style={{ maxHeight: '600px', overflowY: 'auto', backgroundColor: 'var(--bg-color, #fff)', color: 'var(--text-color, #000)' }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={Object.keys(worldBookContent.entries).length > 0 && selectedEntries.size === Object.keys(worldBookContent.entries).length}
                onChange={(e) => {
                  if (e.target.checked) {
                    // 全选所有条目
                    const allUids = new Set<string | number>();
                    Object.keys(worldBookContent.entries).forEach(key => {
                      const entry = worldBookContent.entries[key];
                      allUids.add(entry.uid || key);
                    });
                    setSelectedEntries(allUids);
                  } else {
                    // 取消全选
                    setSelectedEntries(new Set());
                  }
                }}
                style={{ transform: 'scale(1.2)' }}
              />
              <span style={{ fontWeight: 'bold' }}>全选</span>
              <span style={{ color: 'var(--text-color, #666)' }}>已选择 {selectedEntries.size} 个条目</span>
            </div>
            {(() => {
              // 获取所有条目
              const entries = Object.values(worldBookContent.entries);
              const totalEntries = entries.length;
              const totalPages = Math.ceil(totalEntries / pageSize);
              
              // 计算当前页的条目范围
              const startIndex = (currentPage - 1) * pageSize;
              const endIndex = startIndex + pageSize;
              const currentPageEntries = entries.slice(startIndex, endIndex);
              
              // 为每个条目分配标签
              const entriesWithTags = currentPageEntries.map((entry: any, index: number) => {
                const uid = entry.uid !== undefined ? entry.uid : (startIndex + index);
                const entryTags = associations
                  .filter(assoc => assoc.entryUid === uid)
                  .map(assoc => tags.find(tag => tag.id === assoc.tagId))
                  .filter((tag): tag is any => tag !== undefined);
                return {
                  ...entry,
                  uid,
                  tags: entryTags
                };
              });
              
              // 按标签分组
              const groupedEntries: Record<string, typeof entriesWithTags> = {};
              // 用于跟踪已处理的条目
              const processedEntries = new Set<number>();
              
              entriesWithTags.forEach(entry => {
                const uid = entry.uid;
                
                // 确保每个条目只处理一次
                if (processedEntries.has(uid)) {
                  return;
                }
                
                if (entry.tags && entry.tags.length > 0) {
                  // 只将条目添加到第一个标签的组中，避免重复
                  const firstTag = entry.tags[0];
                  if (!groupedEntries[firstTag.id]) {
                    groupedEntries[firstTag.id] = [];
                  }
                  groupedEntries[firstTag.id].push(entry);
                } else {
                  if (!groupedEntries['无标签']) {
                    groupedEntries['无标签'] = [];
                  }
                  groupedEntries['无标签'].push(entry);
                }
                
                processedEntries.add(uid);
              });
              
              // 保持标签组的原始顺序，不排序
              const sortedTagIds = Object.keys(groupedEntries);
              
              // 渲染分组后的条目
              return sortedTagIds.map(tagId => {
                const tag = tags.find(t => t.id === tagId);
                const tagName = tag ? tag.name : '无标签';
                const tagColor = tag ? tag.color : 'default';
                const groupEntries = groupedEntries[tagId];
                
                return (
                  <div key={tagId} style={{ marginBottom: 24 }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      marginBottom: 12,
                      paddingBottom: 8,
                      borderBottom: '2px solid var(--border-color, #e8e8e8)'
                    }}>
                      <Tag color={tagColor} style={{ fontSize: 16, padding: '4px 12px', marginRight: 8 }}>{tagName}</Tag>
                      <span style={{ color: 'var(--text-color, #666)', fontSize: 14 }}>共 {groupEntries.length} 个条目</span>
                    </div>
                    {groupEntries.map((entry: any) => {
                      const uid = entry.uid;
                      const isExpanded = expandedEntries.has(uid);
                      
                      // 定义已显示的属性，排除这些属性后显示剩余的属性
                      const displayedProps = ['uid', 'key', 'keysecondary', 'comment', 'content', 'constant', 'selective', 'order', 'position', 'disable', 'displayIndex', 'addMemo', 'group', 'groupOverride', 'groupWeight', 'sticky', 'cooldown', 'delay', 'probability', 'depth', 'useProbability', 'role', 'vectorized', 'excludeRecursion', 'preventRecursion', 'delayUntilRecursion', 'scanDepth', 'caseSensitive', 'matchWholeWords', 'useGroupScoring', 'automationId'];
                      
                      // 计算未显示的属性
                      const additionalProps = Object.entries(entry).filter(([key]) => !displayedProps.includes(key));
                      
                      return (
                        <Card key={uid} style={{ marginBottom: 16, border: '1px solid var(--border-color, #f0f0f0)', backgroundColor: 'var(--card-bg-color, #fff)', color: 'var(--text-color, #000)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <input
                                type="checkbox"
                                checked={selectedEntries.has(uid)}
                                onChange={(e) => {
                                  const newSelected = new Set(selectedEntries);
                                  if (e.target.checked) {
                                    newSelected.add(uid);
                                  } else {
                                    newSelected.delete(uid);
                                  }
                                  setSelectedEntries(newSelected);
                                }}
                                style={{ transform: 'scale(1.2)' }}
                              />
                              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 'bold' }}>条目 {entry.uid}: {entry.comment || '无注释'}</h3>
                            </div>
                          </div>
                          <div style={{ color: 'var(--text-color, #000)' }}>
                                <p style={{ marginBottom: 8 }}>
                                  <strong>关键词:</strong> {entry.key?.join(', ') || '无'}
                                </p>
                                {entry.keysecondary && entry.keysecondary.length > 0 && (
                                  <p style={{ marginBottom: 8 }}>
                                    <strong>次要关键词:</strong> {entry.keysecondary.join(', ')}
                                  </p>
                                )}
                                <p style={{ marginBottom: 8 }}>
                                  <strong>内容:</strong>
                                </p>
                                <div style={{ 
                                  padding: 12, 
                                  backgroundColor: 'var(--card-bg-color, #1f1f1f)', 
                                  color: 'var(--text-color, #ffffff)',
                                  borderRadius: 4, 
                                  whiteSpace: 'pre-wrap',
                                  fontFamily: 'monospace'
                                }}>
                                  {entry.content || '无'}
                                </div>
                                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                                  <Tag color="blue">顺序: {entry.order}</Tag>
                                  <Tag color="green">概率: {entry.probability}%</Tag>
                                  <Tag color="orange">深度: {entry.depth}</Tag>
                                  <Tag color="cyan">位置: {entry.position}</Tag>
                                  {entry.constant && <Tag color="red">常量</Tag>}
                                  {entry.selective && <Tag color="purple">选择性</Tag>}
                                  {entry.disable && <Tag color="gray">禁用</Tag>}
                                  {entry.addMemo && <Tag color="geekblue">添加到记忆</Tag>}
                                </div>
                                <div style={{ marginTop: 8, marginBottom: 12 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <span style={{ fontWeight: 'bold' }}>标签:</span>
                                    <Button 
                                      type="link" 
                                      size="small"
                                      icon={<EditOutlined />}
                                      onClick={() => {
                                        // 打开标签编辑模态框
                                        setIsEditEntryTagsModalOpen(true);
                                        setCurrentEditEntryUid(uid);
                                      }}
                                    >
                                      编辑标签
                                    </Button>
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {entry.tags && entry.tags.length > 0 ? (
                                      entry.tags.map((tag: any) => (
                                        <Tag key={tag.id} color={tag.color}>{tag.name}</Tag>
                                      ))
                                    ) : (
                                      <Tag color="default">无标签</Tag>
                                    )}
                                  </div>
                                </div>
                                {additionalProps.length > 0 && (
                                  <div style={{ marginTop: 12, borderTop: '1px solid var(--border-color, #e8e8e8)', paddingTop: 12 }}>
                                    <Button 
                                      type="link" 
                                      onClick={() => handleToggleExpand(uid)}
                                      style={{ padding: 0, height: 'auto' }}
                                    >
                                      {isExpanded ? '收起 ▲' : '更多 ▼'}
                                    </Button>
                                    {isExpanded && (
                                      <div style={{ 
                                        marginTop: 12,
                                        padding: 16, 
                                        backgroundColor: 'var(--bg-color, #fafafa)', 
                                        color: 'var(--text-color, #000)',
                                        borderRadius: 8,
                                        border: '1px solid var(--border-color, #e8e8e8)'
                                      }}>
                                        <p style={{ marginBottom: 12, fontWeight: 'bold', color: 'var(--text-color, #333)', fontSize: 14 }}>更多属性:</p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                          {additionalProps.map(([key, value]) => {
                                            // 映射属性名称到SillyTavern对应的名称
                                            const propertyNames: Record<string, string> = {
                                              'uid': 'ID',
                                              'key': '主要关键词',
                                              'keysecondary': '次要关键词',
                                              'comment': '注释',
                                              'content': '内容',
                                              'constant': '常量',
                                              'selective': '选择性',
                                              'order': '顺序',
                                              'position': '位置',
                                              'disable': '禁用',
                                              'displayIndex': '显示索引',
                                              'addMemo': '添加到记忆',
                                              'group': '组',
                                              'groupOverride': '组覆盖',
                                              'groupWeight': '组权重',
                                              'sticky': '粘性',
                                              'cooldown': '冷却',
                                              'delay': '延迟',
                                              'probability': '概率',
                                              'depth': '深度',
                                              'useProbability': '使用概率',
                                              'role': '角色',
                                              'vectorized': '向量化',
                                              'excludeRecursion': '不可递归',
                                              'preventRecursion': '防止递归',
                                              'delayUntilRecursion': '延迟到递归',
                                              'scanDepth': '扫描深度',
                                              'caseSensitive': '区分大小写',
                                              'matchWholeWords': '完整单词',
                                              'useGroupScoring': '使用组评分',
                                              'automationId': '自动化ID'
                                            };
                                            
                                            // 处理驼峰命名的属性，转换为中文名称
                                            const getDisplayName = (propKey: string): string => {
                                              if (propertyNames[propKey]) {
                                                return propertyNames[propKey];
                                              }
                                              // 处理驼峰命名，转换为中文描述
                                              return propKey
                                                .replace(/([A-Z])/g, ' $1')
                                                .replace(/^./, str => str.toUpperCase())
                                                .trim();
                                            };
                                            
                                            const displayName = getDisplayName(key);
                                            
                                            return (
                                              <div key={key} style={{ 
                                                display: 'flex', 
                                                alignItems: 'flex-start',
                                                padding: '8px 12px',
                                                backgroundColor: 'var(--card-bg-color, #fff)', 
                                                color: 'var(--text-color, #000)',
                                                borderRadius: 6,
                                                border: '1px solid var(--border-color, #f0f0f0)'
                                              }}>
                                                <span style={{ 
                                                  fontWeight: 'bold', 
                                                  color: 'var(--primary-color, #1890ff)',
                                                  minWidth: 120,
                                                  marginRight: 12,
                                                  flexShrink: 0
                                                }}>{displayName}:</span>
                                                <span style={{ 
                                                  color: 'var(--text-color, #666)',
                                                  wordBreak: 'break-all',
                                                  fontFamily: 'monospace',
                                                  fontSize: 13
                                                }}>{JSON.stringify(value)}</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                                <div style={{ marginTop: 12, textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                  <Button 
                                    type="danger" 
                                    icon={<DeleteOutlined />}
                                    onClick={() => {
                                      Modal.confirm({
                                        title: '确定要删除这个条目吗？',
                                        onOk: () => handleDeleteEntry(uid),
                                        okText: '确定',
                                        cancelText: '取消'
                                      });
                                    }}
                                    size="small"
                                  >
                                    删除条目
                                  </Button>
                                  <Button 
                                    type="primary" 
                                    icon={<EditOutlined />}
                                    onClick={() => handleEditEntry(entry, uid)}
                                    size="small"
                                  >
                                    编辑条目
                                  </Button>
                                </div>
                              </div>
                        </Card>
                      );
                    })}
                  </div>
                );
              });
            })()}
            
            {/* 分页控件 */}
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-color, #e8e8e8)' }}>
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={Object.keys(worldBookContent.entries).length}
                showSizeChanger
                pageSizeOptions={['10', '20', '50', '100']}
                showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`}
                onChange={(page, size) => {
                  setCurrentPage(page);
                  if (size !== pageSize) {
                    setPageSize(size);
                  }
                }}
                style={{ color: 'var(--text-color, #000)' }}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* 手动拖拽排序模态框 */}
      <Modal
        title="手动排序条目"
        open={isDragSortModalOpen}
        onCancel={() => setIsDragSortModalOpen(false)}
        width={800}
        footer={[
          <Button key="save" type="primary" onClick={handleSaveManualSort}>
            保存排序
          </Button>,
          <Button key="cancel" onClick={() => setIsDragSortModalOpen(false)}>
            取消
          </Button>
        ]}
        style={{
          backgroundColor: 'var(--bg-color, #fff)',
          color: 'var(--text-color, #000)'
        }}
      >
        <div style={{ color: 'var(--text-color, #000)' }}>
          {worldBookContent && worldBookContent.entries && (
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {Object.entries(worldBookContent.entries)
                .map(([key, entry]) => ({ key, entry }))
                .map(({ key, entry }, index) => (
                  <Card key={key} style={{ marginBottom: 8, border: '1px solid var(--border-color, #f0f0f0)', backgroundColor: 'var(--card-bg-color, #fff)', color: 'var(--text-color, #000)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold' }}>{entry.comment || '无注释'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-color, #666)', marginTop: 4 }}>
                          关键词: {entry.key?.join(', ') || '无'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button 
                          icon={<UpOutlined />}
                          size="small"
                          onClick={() => handleMoveEntry(index, -1)}
                          disabled={index === 0}
                        />
                        <Button 
                          icon={<DownOutlined />}
                          size="small"
                          onClick={() => handleMoveEntry(index, 1)}
                          disabled={index === Object.keys(worldBookContent.entries).length - 1}
                        />
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          )}
        </div>
      </Modal>

      {/* 排序模态框 */}
      <Modal
        title="条目整理"
        open={isSortModalOpen}
        onCancel={() => setIsSortModalOpen(false)}
        width={500}
        footer={[
          <Button key="cancel" onClick={() => setIsSortModalOpen(false)}>
            取消
          </Button>,
          <Button key="ok" type="primary" onClick={async () => {
            addLog('[WorldBook] 用户点击了确定按钮，开始执行排序...');
            addLog(`[WorldBook] 选择的排序方法: ${selectedSortMethod}`);
            
            setIsSortModalOpen(false);
            
            if (selectedSortMethod === 'title') {
              addLog('[WorldBook] 执行按标题排序...');
              await handleSortEntriesByTitle();
            } else if (selectedSortMethod === 'ai') {
              addLog('[WorldBook] 执行AI智能排序...');
              await handleAISortEntries();
            } else if (selectedSortMethod === 'manual') {
              addLog('[WorldBook] 打开手动排序弹窗...');
              setIsDragSortModalOpen(true);
            }
          }}>
            确定
          </Button>
        ]}
        style={{
          backgroundColor: 'var(--bg-color, #fff)',
          color: 'var(--text-color, #000)'
        }}
      >
        <div style={{ color: 'var(--text-color, #000)' }}>
          <p>请选择整理方式：</p>
          <Radio.Group 
            value={selectedSortMethod} 
            onChange={(e) => setSelectedSortMethod(e.target.value)}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <Radio value="title">按标题排序</Radio>
            <Radio value="ai">AI智能排序</Radio>
            <Radio value="manual">手动拖拽排序</Radio>
          </Radio.Group>
        </div>
      </Modal>

      {/* 标签管理模态框 */}
      <Modal
        title="标签管理"
        open={isTagManagerOpen}
        onCancel={() => setIsTagManagerOpen(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setIsTagManagerOpen(false)}>
            关闭
          </Button>
        ]}
        style={{
          backgroundColor: 'var(--bg-color, #fff)',
          color: 'var(--text-color, #000)'
        }}
      >
        <div style={{ color: 'var(--text-color, #000)' }}>
          {viewingItem && worldBookContent && (
            <TagManager 
              worldBookPath={viewingItem.path}
              worldBookEntries={worldBookContent.entries}
              onTagsChanged={() => loadTags(viewingItem.path)}
            />
          )}
        </div>
      </Modal>

      {/* 条目标签编辑模态框 */}
      <Modal
        title="编辑条目标签"
        open={isEditEntryTagsModalOpen}
        onCancel={() => setIsEditEntryTagsModalOpen(false)}
        width={600}
        footer={[
          <Button key="close" onClick={() => setIsEditEntryTagsModalOpen(false)}>
            关闭
          </Button>
        ]}
        style={{
          backgroundColor: 'var(--bg-color, #fff)',
          color: 'var(--text-color, #000)'
        }}
      >
        <div style={{ color: 'var(--text-color, #000)' }}>
          {currentEditEntryUid !== null && worldBookContent && (
            <div>
              {(() => {
                // 获取当前编辑的条目
                const entry = Object.values(worldBookContent.entries).find(
                  (e: any) => e.uid === currentEditEntryUid || String(e.uid) === String(currentEditEntryUid)
                );
                
                if (!entry) {
                  return <div>条目未找到</div>;
                }

                // 获取条目的当前标签
                const entryTags = associations
                  .filter(assoc => assoc.entryUid === currentEditEntryUid)
                  .map(assoc => tags.find(tag => tag.id === assoc.tagId))
                  .filter((tag): tag is any => tag !== undefined);

                return (
                  <div>
                    <div style={{ marginBottom: 16 }}>
                      <h3 style={{ marginBottom: 8 }}>条目: {entry.comment || '无注释'}</h3>
                    </div>
                    
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ marginBottom: 8, fontWeight: 'bold' }}>当前标签:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                        {entryTags.length > 0 ? (
                          entryTags.map(tag => (
                            <Tag 
                              key={tag.id} 
                              color={tag.color}
                              closable
                              onClose={async () => {
                                // 从条目移除标签
                                try {
                                  const tagData = await window.electronAPI.worldBook.readTags(viewingItem!.path);
                                  if (tagData && tagData.associations) {
                                    const updatedAssociations = tagData.associations.filter(
                                      (assoc: any) => !(assoc.entryUid === currentEditEntryUid && assoc.tagId === tag.id)
                                    );
                                    const updatedTagData = {
                                      ...tagData,
                                      associations: updatedAssociations
                                    };
                                    await window.electronAPI.worldBook.writeTags(viewingItem!.path, updatedTagData);
                                    await loadTags(viewingItem!.path);
                                    message.success('标签移除成功');
                                  }
                                } catch (error) {
                                  message.error('标签移除失败');
                                }
                              }}
                            >
                              {tag.name}
                            </Tag>
                          ))
                        ) : (
                          <Tag color="default">无标签</Tag>
                        )}
                      </div>
                    </div>

                    <div>
                      <div style={{ marginBottom: 8, fontWeight: 'bold' }}>添加标签:</div>
                      <Select
                        mode="multiple"
                        placeholder="选择要添加的标签..."
                        style={{ width: '100%' }}
                        value={[]}
                        onChange={async (selectedTagIds) => {
                          if (selectedTagIds.length > 0) {
                            try {
                              const tagData = await window.electronAPI.worldBook.readTags(viewingItem!.path);
                              if (tagData) {
                                const newAssociations = [...(tagData.associations || [])];
                                
                                selectedTagIds.forEach(tagId => {
                                  // 检查是否已存在关联
                                  const existing = newAssociations.find(
                                    (assoc: any) => assoc.entryUid === currentEditEntryUid && assoc.tagId === tagId
                                  );
                                  if (!existing) {
                                    newAssociations.push({
                                      tagId,
                                      entryUid: currentEditEntryUid
                                    });
                                  }
                                });
                                
                                const updatedTagData = {
                                  ...tagData,
                                  associations: newAssociations
                                };
                                await window.electronAPI.worldBook.writeTags(viewingItem!.path, updatedTagData);
                                await loadTags(viewingItem!.path);
                                message.success('标签添加成功');
                              }
                            } catch (error) {
                              message.error('标签添加失败');
                            }
                          }
                        }}
                        options={tags.map(tag => ({
                          value: tag.id,
                          label: (
                            <span>
                              <Tag color={tag.color} style={{ marginRight: 4 }}>{tag.name}</Tag>
                            </span>
                          )
                        }))}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        title={`编辑条目: ${editingEntry?.comment || '无注释'}`}
        open={isEditEntryModalOpen}
        onOk={handleEditEntryModalOk}
        onCancel={handleEditEntryModalCancel}
        width={1000}
        style={{
          backgroundColor: 'var(--bg-color, #fff)',
          color: 'var(--text-color, #000)'
        }}
      >
        <div style={{ color: 'var(--text-color, #000)' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>注释</label>
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Input 
                style={{ backgroundColor: 'var(--card-bg-color, #fff)', color: 'var(--text-color, #000)' }}
                value={formValues.comment}
                onChange={(e) => setFormValues(prev => ({ ...prev, comment: e.target.value }))}
              />
              <Space>
                <Button 
                  type="link" 
                  icon={translatingField === 'comment' ? <LoadingOutlined /> : <TranslationOutlined />}
                  onClick={() => handleTranslate('comment')}
                  loading={translatingField === 'comment'}
                >
                  {translatingField === 'comment' ? '正在翻译，请稍后' : 'AI翻译'}
                </Button>
                <Button 
                  type="link" 
                  icon={polishingField === 'comment' ? <LoadingOutlined /> : <EditOutlined />}
                  onClick={() => handlePolish('comment')}
                  loading={polishingField === 'comment'}
                >
                  {polishingField === 'comment' ? '正在润色，请稍后' : 'AI润色'}
                </Button>
              </Space>
            </Space>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>主要关键词 (逗号分隔)</label>
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Input.TextArea 
                placeholder="输入关键词，用逗号分隔"
                style={{ backgroundColor: 'var(--card-bg-color, #fff)', color: 'var(--text-color, #000)' }}
                value={formValues.key}
                onChange={(e) => setFormValues(prev => ({ ...prev, key: e.target.value }))}
              />
              <Space>
                <Button 
                  type="link" 
                  icon={translatingField === 'key' ? <LoadingOutlined /> : <TranslationOutlined />}
                  onClick={() => handleTranslate('key')}
                  loading={translatingField === 'key'}
                >
                  {translatingField === 'key' ? '正在翻译，请稍后' : 'AI翻译'}
                </Button>
                <Button 
                  type="link" 
                  icon={polishingField === 'key' ? <LoadingOutlined /> : <EditOutlined />}
                  onClick={() => handlePolish('key')}
                  loading={polishingField === 'key'}
                >
                  {polishingField === 'key' ? '正在润色，请稍后' : 'AI润色'}
                </Button>
              </Space>
            </Space>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>次要关键词 (逗号分隔)</label>
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Input.TextArea 
                placeholder="输入次要关键词，用逗号分隔"
                style={{ backgroundColor: 'var(--card-bg-color, #fff)', color: 'var(--text-color, #000)' }}
                value={formValues.keysecondary}
                onChange={(e) => setFormValues(prev => ({ ...prev, keysecondary: e.target.value }))}
              />
              <Space>
                <Button 
                  type="link" 
                  icon={translatingField === 'keysecondary' ? <LoadingOutlined /> : <TranslationOutlined />}
                  onClick={() => handleTranslate('keysecondary')}
                  loading={translatingField === 'keysecondary'}
                >
                  {translatingField === 'keysecondary' ? '正在翻译，请稍后' : 'AI翻译'}
                </Button>
                <Button 
                  type="link" 
                  icon={polishingField === 'keysecondary' ? <LoadingOutlined /> : <EditOutlined />}
                  onClick={() => handlePolish('keysecondary')}
                  loading={polishingField === 'keysecondary'}
                >
                  {polishingField === 'keysecondary' ? '正在润色，请稍后' : 'AI润色'}
                </Button>
              </Space>
            </Space>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>内容</label>
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Input.TextArea 
                rows={8} 
                style={{ backgroundColor: 'var(--card-bg-color, #fff)', color: 'var(--text-color, #000)' }}
                value={formValues.content}
                onChange={(e) => setFormValues(prev => ({ ...prev, content: e.target.value }))}
              />
              <Space>
                <Button 
                  type="link" 
                  icon={translatingField === 'content' ? <LoadingOutlined /> : <TranslationOutlined />}
                  onClick={() => handleTranslate('content')}
                  loading={translatingField === 'content'}
                >
                  {translatingField === 'content' ? '正在翻译，请稍后' : 'AI翻译'}
                </Button>
                <Button 
                  type="link" 
                  icon={polishingField === 'content' ? <LoadingOutlined /> : <EditOutlined />}
                  onClick={() => handlePolish('content')}
                  loading={polishingField === 'content'}
                >
                  {polishingField === 'content' ? '正在润色，请稍后' : 'AI润色'}
                </Button>
              </Space>
            </Space>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>顺序</label>
              <Input type="number" style={{ backgroundColor: 'var(--card-bg-color, #fff)', color: 'var(--text-color, #000)' }} value={formValues.order || ''} onChange={(e) => setFormValues(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>概率 (%)</label>
              <Input type="number" min={0} max={100} style={{ backgroundColor: 'var(--card-bg-color, #fff)', color: 'var(--text-color, #000)' }} value={formValues.probability || ''} onChange={(e) => setFormValues(prev => ({ ...prev, probability: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>深度</label>
              <Input type="number" min={1} style={{ backgroundColor: 'var(--card-bg-color, #fff)', color: 'var(--text-color, #000)' }} value={formValues.depth || ''} onChange={(e) => setFormValues(prev => ({ ...prev, depth: parseInt(e.target.value) || 1 }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>位置</label>
              <Input type="number" style={{ backgroundColor: 'var(--card-bg-color, #fff)', color: 'var(--text-color, #000)' }} value={formValues.position || ''} onChange={(e) => setFormValues(prev => ({ ...prev, position: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>粘性</label>
              <Input type="number" style={{ backgroundColor: 'var(--card-bg-color, #fff)', color: 'var(--text-color, #000)' }} value={formValues.sticky || ''} onChange={(e) => setFormValues(prev => ({ ...prev, sticky: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>冷却</label>
              <Input type="number" style={{ backgroundColor: 'var(--card-bg-color, #fff)', color: 'var(--text-color, #000)' }} value={formValues.cooldown || ''} onChange={(e) => setFormValues(prev => ({ ...prev, cooldown: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>延迟</label>
              <Input type="number" style={{ backgroundColor: 'var(--card-bg-color, #fff)', color: 'var(--text-color, #000)' }} value={formValues.delay || ''} onChange={(e) => setFormValues(prev => ({ ...prev, delay: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>组权重</label>
              <Input type="number" style={{ backgroundColor: 'var(--card-bg-color, #fff)', color: 'var(--text-color, #000)' }} value={formValues.groupWeight || ''} onChange={(e) => setFormValues(prev => ({ ...prev, groupWeight: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontWeight: 'bold' }}>常量</label>
              <Switch checked={formValues.constant || false} onChange={(checked) => setFormValues(prev => ({ ...prev, constant: checked }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontWeight: 'bold' }}>选择性</label>
              <Switch checked={formValues.selective || false} onChange={(checked) => setFormValues(prev => ({ ...prev, selective: checked }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontWeight: 'bold' }}>禁用</label>
              <Switch checked={formValues.disable || false} onChange={(checked) => setFormValues(prev => ({ ...prev, disable: checked }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontWeight: 'bold' }}>添加到记忆</label>
              <Switch checked={formValues.addMemo || false} onChange={(checked) => setFormValues(prev => ({ ...prev, addMemo: checked }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontWeight: 'bold' }}>组覆盖</label>
              <Switch checked={formValues.groupOverride || false} onChange={(checked) => setFormValues(prev => ({ ...prev, groupOverride: checked }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontWeight: 'bold' }}>使用概率</label>
              <Switch checked={formValues.useProbability || false} onChange={(checked) => setFormValues(prev => ({ ...prev, useProbability: checked }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontWeight: 'bold' }}>向量化</label>
              <Switch checked={formValues.vectorized || false} onChange={(checked) => setFormValues(prev => ({ ...prev, vectorized: checked }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontWeight: 'bold' }}>不可递归</label>
              <Switch checked={formValues.excludeRecursion || false} onChange={(checked) => setFormValues(prev => ({ ...prev, excludeRecursion: checked }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontWeight: 'bold' }}>防止递归</label>
              <Switch checked={formValues.preventRecursion || false} onChange={(checked) => setFormValues(prev => ({ ...prev, preventRecursion: checked }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontWeight: 'bold' }}>延迟到递归</label>
              <Switch checked={formValues.delayUntilRecursion || false} onChange={(checked) => setFormValues(prev => ({ ...prev, delayUntilRecursion: checked }))} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>组</label>
            <Input style={{ backgroundColor: 'var(--card-bg-color, #fff)', color: 'var(--text-color, #000)' }} value={formValues.group || ''} onChange={(e) => setFormValues(prev => ({ ...prev, group: e.target.value }))} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>自动化ID</label>
            <Input style={{ backgroundColor: 'var(--card-bg-color, #fff)', color: 'var(--text-color, #000)' }} value={formValues.automationId || ''} onChange={(e) => setFormValues(prev => ({ ...prev, automationId: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>扫描深度</label>
              <Input type="number" style={{ backgroundColor: 'var(--card-bg-color, #fff)', color: 'var(--text-color, #000)' }} value={formValues.scanDepth || ''} onChange={(e) => setFormValues(prev => ({ ...prev, scanDepth: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>显示索引</label>
              <Input type="number" style={{ backgroundColor: 'var(--card-bg-color, #fff)', color: 'var(--text-color, #000)' }} value={formValues.displayIndex || ''} onChange={(e) => setFormValues(prev => ({ ...prev, displayIndex: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontWeight: 'bold' }}>区分大小写</label>
              <Switch checked={formValues.caseSensitive || false} onChange={(checked) => setFormValues(prev => ({ ...prev, caseSensitive: checked }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontWeight: 'bold' }}>完整单词</label>
              <Switch checked={formValues.matchWholeWords || false} onChange={(checked) => setFormValues(prev => ({ ...prev, matchWholeWords: checked }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontWeight: 'bold' }}>使用组评分</label>
              <Switch checked={formValues.useGroupScoring || false} onChange={(checked) => setFormValues(prev => ({ ...prev, useGroupScoring: checked }))} />
            </div>
          </div>
        </div>
      </Modal>

      {/* 新增世界书模态框 */}
      <Modal
        title="新建世界书"
        open={isCreateModalOpen}
        onCancel={() => {
          setIsCreateModalOpen(false);
          createForm.resetFields();
          setGeneratedEntries([]);
        }}
        width={1000}
        footer={[
          <Button key="cancel" onClick={() => {
            setIsCreateModalOpen(false);
            createForm.resetFields();
            setGeneratedEntries([]);
          }}>
            取消
          </Button>,
          <Button key="create" type="primary" onClick={handleCreateWorldBook}>
            创建世界书
          </Button>
        ]}
        style={{
          backgroundColor: 'var(--bg-color, #fff)',
          color: 'var(--text-color, #000)'
        }}
      >
        <div style={{ color: 'var(--text-color, #000)' }}>
          <Form form={createForm} layout="vertical">
            <Form.Item
              name="worldBookName"
              label="世界书名称"
              rules={[{ required: true, message: '请输入世界书名称' }]}
            >
              <Input placeholder="请输入世界书名称" />
            </Form.Item>

            <Form.Item
              name="worldBookDescription"
              label="世界书简介"
            >
              <Input.TextArea 
                rows={4} 
                placeholder="请输入世界书简介（支持富文本格式）"
                value={generatedWorldBookDescription}
                onChange={(e) => setGeneratedWorldBookDescription(e.target.value)}
              />
            </Form.Item>

            <Form.Item
              name="themeDescription"
              label="主题描述"
              rules={[{ required: true, message: '请输入主题描述' }]}
            >
              <Input.TextArea 
                rows={4} 
                placeholder="例如：我想生成一个基于奇幻世界RPG的世界书，包含魔法和科技等"
              />
            </Form.Item>

            <div style={{ marginBottom: 16 }}>
              <Button 
                type="primary" 
                icon={isGeneratingEntries ? <LoadingOutlined /> : <ThunderboltOutlined />}
                loading={isGeneratingEntries}
                onClick={async () => {
                  const theme = createForm.getFieldValue('themeDescription');
                  if (theme) {
                    await handleGenerateEntries(theme);
                  } else {
                    message.warning('请先输入主题描述');
                  }
                }}
                style={{ marginBottom: 16 }}
              >
                {isGeneratingEntries ? 'AI生成中...' : 'AI生成条目'}
              </Button>

              {generatedEntries.length > 0 && (
                <Card title={`已生成 ${generatedEntries.length} 个条目`} style={{ marginBottom: 16 }}>
                  {generatedEntries.map((entry, index) => (
                    <Card key={index} size="small" style={{ marginBottom: 8 }}>
                      <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                        条目 {index + 1}: {entry.comment || '无注释'}
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        <Text type="secondary">关键词: </Text>
                        {entry.key?.join(', ') || '无'}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-color, #666)' }}>
                        {entry.content?.substring(0, 100)}{entry.content?.length > 100 ? '...' : ''}
                      </div>
                    </Card>
                  ))}
                </Card>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8, fontWeight: 'bold' }}>手动添加条目</div>
              
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>注释</label>
                <Input 
                  placeholder="输入注释"
                  id="manual-comment"
                />
              </div>
              
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>主要关键词 (逗号分隔)</label>
                <Space orientation="vertical" style={{ width: '100%' }}>
                  <Input.TextArea 
                    placeholder="输入关键词，用逗号分隔"
                    id="manual-key"
                  />
                  <Button 
                    type="link" 
                    onClick={async () => {
                      const keywords = (document.getElementById('manual-key') as HTMLTextAreaElement)?.value;
                      if (keywords) {
                        const expanded = await handleExpandKeywords(keywords, 'key');
                        if (expanded) {
                          (document.getElementById('manual-key') as HTMLTextAreaElement).value = expanded;
                        }
                      } else {
                        message.warning('请先输入关键词');
                      }
                    }}
                  >
                    AI扩写
                  </Button>
                </Space>
              </div>
              
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>内容</label>
                <Space orientation="vertical" style={{ width: '100%' }}>
                  <Input.TextArea 
                    rows={6}
                    placeholder="输入条目内容"
                    id="manual-content"
                  />
                  <Button 
                    type="link" 
                    onClick={async () => {
                      const keywords = (document.getElementById('manual-key') as HTMLTextAreaElement)?.value;
                      const theme = createForm.getFieldValue('themeDescription');
                      if (keywords && theme) {
                        const description = await handleGenerateDescription(keywords, theme);
                        if (description) {
                          (document.getElementById('manual-content') as HTMLTextAreaElement).value = description;
                        }
                      } else {
                        message.warning('请先输入关键词和主题描述');
                      }
                    }}
                  >
                    AI生成描述
                  </Button>
                </Space>
              </div>
              
              <Button 
                type="default" 
                icon={<PlusOutlined />}
                onClick={() => {
                  const comment = (document.getElementById('manual-comment') as HTMLInputElement)?.value || '';
                  const keyStr = (document.getElementById('manual-key') as HTMLTextAreaElement)?.value || '';
                  const content = (document.getElementById('manual-content') as HTMLTextAreaElement)?.value || '';
                  
                  const key = keyStr.split(/[,，]/).map(k => k.trim()).filter(k => k);
                  
                  const newEntry = createDefaultEntry(generatedEntries.length, key, comment, content);
                  setGeneratedEntries([...generatedEntries, newEntry]);
                  
                  // 清空输入框
                  (document.getElementById('manual-comment') as HTMLInputElement).value = '';
                  (document.getElementById('manual-key') as HTMLTextAreaElement).value = '';
                  (document.getElementById('manual-content') as HTMLTextAreaElement).value = '';
                  
                  message.success('条目添加成功');
                }}
              >
                添加手动条目
              </Button>
            </div>
          </Form>
        </div>
      </Modal>

      {/* 添加条目模态框 */}
      <Modal
        title="添加条目"
        open={isAddEntryModalOpen}
        onCancel={() => {
          setIsAddEntryModalOpen(false);
          addEntryForm.resetFields();
          setAddedEntries([]);
        }}
        width={1000}
        footer={[
          <Button key="cancel" onClick={() => {
            setIsAddEntryModalOpen(false);
            addEntryForm.resetFields();
            setAddedEntries([]);
          }}>
            取消
          </Button>,
          <Button key="save" type="primary" onClick={handleSaveAddedEntries}>
            保存条目
          </Button>
        ]}
        style={{
          backgroundColor: 'var(--bg-color, #fff)',
          color: 'var(--text-color, #000)'
        }}
      >
        <div style={{ color: 'var(--text-color, #000)' }}>
          <Form form={addEntryForm} layout="vertical">
            <Form.Item
              name="expectedContent"
              label="预期内容"
              rules={[{ required: true, message: '请输入预期内容' }]}
            >
              <Input.TextArea 
                rows={3} 
                placeholder="例如：生成角色信息、生成地点信息、生成游戏规则等"
              />
            </Form.Item>

            <Form.Item
              name="count"
              label="生成条目数量"
              rules={[
                { required: true, message: '请输入生成条目数量' },
                {
                  validator: (_, value) => {
                    const num = parseInt(value);
                    if (isNaN(num) || num < 1 || num > 20) {
                      return Promise.reject(new Error('数量应在1-20之间'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <Input type="number" min={1} max={20} placeholder="输入生成条目数量" />
            </Form.Item>

            <div style={{ marginBottom: 16 }}>
              <Button 
                type="primary" 
                icon={isAddingEntry ? <LoadingOutlined /> : <ThunderboltOutlined />}
                loading={isAddingEntry}
                onClick={async () => {
                  const values = await addEntryForm.validateFields();
                  const expectedContent = values.expectedContent?.trim();
                  const count = parseInt(values.count);
                  if (expectedContent && count) {
                    await handleGenerateNewEntries(expectedContent, count);
                  }
                }}
                style={{ marginBottom: 16 }}
              >
                {isAddingEntry ? 'AI生成中...' : 'AI生成条目'}
              </Button>

              {addedEntries.length > 0 && (
                <Card title={`已生成 ${addedEntries.length} 个条目`} style={{ marginBottom: 16 }}>
                  {addedEntries.map((entry, index) => (
                    <Card key={index} size="small" style={{ marginBottom: 8 }}>
                      <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                        条目 {index + 1}: {entry.comment || '无注释'}
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        <Text type="secondary">关键词: </Text>
                        {entry.key?.join(', ') || '无'}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-color, #666)' }}>
                        {entry.content?.substring(0, 100)}{entry.content?.length > 100 ? '...' : ''}
                      </div>
                    </Card>
                  ))}
                </Card>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8, fontWeight: 'bold' }}>手动添加条目</div>
              
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>注释</label>
                <Input 
                  placeholder="输入注释"
                  id="manual-comment-add"
                />
              </div>
              
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>主要关键词 (逗号分隔)</label>
                <Space orientation="vertical" style={{ width: '100%' }}>
                  <Input.TextArea 
                    placeholder="输入关键词，用逗号分隔"
                    id="manual-key-add"
                  />
                  <Button 
                    type="link" 
                    onClick={async () => {
                      const keywords = (document.getElementById('manual-key-add') as HTMLTextAreaElement)?.value;
                      if (keywords) {
                        const expanded = await handleExpandKeywords(keywords, 'key');
                        if (expanded) {
                          (document.getElementById('manual-key-add') as HTMLTextAreaElement).value = expanded;
                        }
                      } else {
                        message.warning('请先输入关键词');
                      }
                    }}
                  >
                    AI扩写
                  </Button>
                </Space>
              </div>
              
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>内容</label>
                <Space orientation="vertical" style={{ width: '100%' }}>
                  <Input.TextArea 
                    rows={6}
                    placeholder="输入条目内容"
                    id="manual-content-add"
                  />
                  <Button 
                    type="link" 
                    onClick={async () => {
                      const keywords = (document.getElementById('manual-key-add') as HTMLTextAreaElement)?.value;
                      const expectedContent = addEntryForm.getFieldValue('expectedContent');
                      if (keywords && expectedContent) {
                        const description = await handleGenerateDescription(keywords, expectedContent);
                        if (description) {
                          (document.getElementById('manual-content-add') as HTMLTextAreaElement).value = description;
                        }
                      } else {
                        message.warning('请先输入关键词和预期内容');
                      }
                    }}
                  >
                    AI生成描述
                  </Button>
                </Space>
              </div>
              
              <Button 
                type="default" 
                icon={<PlusOutlined />}
                onClick={() => {
                  const comment = (document.getElementById('manual-comment-add') as HTMLInputElement)?.value || '';
                  const keyStr = (document.getElementById('manual-key-add') as HTMLTextAreaElement)?.value || '';
                  const content = (document.getElementById('manual-content-add') as HTMLTextAreaElement)?.value || '';
                  
                  const key = keyStr.split(/[,，]/).map(k => k.trim()).filter(k => k);
                  
                  const newEntry = createDefaultEntry(Date.now(), key, comment, content);
                  setAddedEntries([...addedEntries, newEntry]);
                  
                  // 清空输入框
                  (document.getElementById('manual-comment-add') as HTMLInputElement).value = '';
                  (document.getElementById('manual-key-add') as HTMLTextAreaElement).value = '';
                  (document.getElementById('manual-content-add') as HTMLTextAreaElement).value = '';
                  
                  message.success('条目添加成功');
                }}
              >
                添加手动条目
              </Button>
            </div>
          </Form>
        </div>
      </Modal>

      {/* AI润色要求模态框 */}
      <Modal
        title="AI润色"
        open={isPolishModalOpen}
        onCancel={() => {
          setIsPolishModalOpen(false);
          setCurrentPolishField(null);
          setCurrentPolishText('');
          setPolishRequirements('');
        }}
        onOk={performPolish}
        okText="开始润色"
        cancelText="取消"
        confirmLoading={polishingField !== null}
      >
        <div>
          <p>请输入润色要求（例如：风格偏向可爱、更加正式、增加细节等）：</p>
          <Input.TextArea 
            rows={4} 
            placeholder="请输入润色要求"
            value={polishRequirements}
            onChange={(e) => setPolishRequirements(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>

      {/* 一键润色要求模态框 */}
      <Modal
        title="一键润色"
        open={isPolishAllModalOpen}
        onCancel={() => {
          setIsPolishAllModalOpen(false);
          setPolishAllRequirements('');
        }}
        onOk={performPolishAll}
        okText="开始润色"
        cancelText="取消"
        confirmLoading={isPolishingAll}
      >
        <div>
          <p>请输入润色要求（例如：风格偏向可爱、更加正式、增加细节等）：</p>
          <Input.TextArea 
            rows={4} 
            placeholder="请输入润色要求"
            value={polishAllRequirements}
            onChange={(e) => setPolishAllRequirements(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>

    </div>
  );
};

export default WorldBookManager;