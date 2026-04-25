import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useState,
  useMemo,
  createContext,
  useContext,
} from 'react';
import { Button, Tooltip, message } from 'antd';
import { SaveOutlined, CheckOutlined, LoadingOutlined } from '@ant-design/icons';
import { MilkdownProvider } from '@milkdown/react';
import { Crepe } from '@milkdown/crepe';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/nord.css';
import '@milkdown/crepe/theme/nord-dark.css';
import { useSettingStore } from '../../../stores/settingStore';
import { useLogStore } from '../../../stores/logStore';
import { dataPersistence } from '../DataPersistence';
import {
  MarkdownEditorProps,
  MarkdownEditorHandle,
  MarkdownEditorContextType,
} from './MarkdownEditor.types';
import {
  DEFAULT_EDITOR_CONFIG,
  DEFAULT_EDITOR_CONTENT,
  DEFAULT_CONTAINER_STYLE,
} from './MarkdownEditor.defaults';
import {
  applyThemeStyles,
  createEditorInstance,
  destroyEditorInstance,
  getMilkdownElement,
  generateContainerClassName,
  safeParseContent,
} from './MarkdownEditor.utils';
import MarkdownAITools from './MarkdownAITools';

const MarkdownEditorContext = createContext<MarkdownEditorContextType | null>(null);

function useMarkdownEditorContext(): MarkdownEditorContextType {
  const context = useContext(MarkdownEditorContext);
  if (!context) {
    throw new Error('useMarkdownEditorContext must be used within MarkdownEditorProvider');
  }
  return context;
}

const MarkdownEditorComponent = (
  props: MarkdownEditorProps,
  ref: React.Ref<MarkdownEditorHandle>
) => {
  const {
    theme = DEFAULT_EDITOR_CONFIG.theme,
    value,
    defaultValue = DEFAULT_EDITOR_CONTENT,
    onChange,
    placeholder = DEFAULT_EDITOR_CONFIG.placeholder,
    enableAITools = DEFAULT_EDITOR_CONFIG.enableAITools,
    enableSave = DEFAULT_EDITOR_CONFIG.enableSave,
    storageKey = DEFAULT_EDITOR_CONFIG.storageKey,
    autoSaveInterval = DEFAULT_EDITOR_CONFIG.autoSaveInterval,
    onSave,
    onLoad,
    className,
    style,
    minHeight = DEFAULT_EDITOR_CONFIG.minHeight,
    containerStyle,
  } = props;

  const { fetchSetting } = useSettingStore();
  const { addLog } = useLogStore();

  const rootRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const contentPollTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 内容状态
  const [contentKey, setContentKey] = useState(0);
  const [internalContent, setInternalContent] = useState(() => {
    const initialContent = value !== undefined ? value : '';
    return safeParseContent(initialContent);
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // 保存状态
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // ==================== 核心函数（提前定义）====================

  // 获取编辑器当前内容
  const getMarkdown = useCallback((): string => {
    if (crepeRef.current) {
      try {
        const editorContent = crepeRef.current.markdown;
        addLog('MarkdownEditor: 从编辑器获取内容', 'debug', {
          category: 'system',
          context: { contentLength: editorContent?.length || 0 }
        });
        return editorContent || internalContent;
      } catch (error) {
        console.warn('MarkdownEditor: 获取编辑器内容失败，返回内部状态', error);
        return internalContent;
      }
    }
    return internalContent;
  }, [internalContent, addLog]);

  // 设置编辑器内容
  const setMarkdown = useCallback((newContent: string): void => {
    const safeContent = safeParseContent(newContent);
    addLog('MarkdownEditor: 设置编辑器内容', 'debug', {
      category: 'system',
      context: { contentLength: safeContent.length }
    });
    
    setInternalContent(safeContent);
    setContentKey(prev => prev + 1);
    setHasUnsavedChanges(true);
    onChange?.(safeContent);
  }, [onChange, addLog]);

  const getEditorElement = useCallback((): HTMLElement | null => {
    return getMilkdownElement(rootRef.current);
  }, []);

  // ==================== 存储相关函数 ====================

  // 从本地存储加载内容
  const loadFromStorage = useCallback(async () => {
    if (!enableSave) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setLoadError(null);
      addLog('MarkdownEditor: 开始从本地存储加载内容', 'info', {
        category: 'system',
        context: { storageKey }
      });
      const savedContent = await dataPersistence.get<string>(storageKey);
      if (savedContent && savedContent.trim()) {
        addLog('MarkdownEditor: 从本地存储加载内容成功', 'info', {
          category: 'system',
          context: { storageKey, contentLength: savedContent.length }
        });
        setInternalContent(savedContent);
        setContentKey(prev => prev + 1);
        setHasUnsavedChanges(false);
        onLoad?.(savedContent);
      } else {
        addLog('MarkdownEditor: 本地存储中没有找到内容，初始化为空', 'debug', {
          category: 'system',
          context: { storageKey }
        });
        // 如果 defaultValue 有值，使用 defaultValue（作为可选的初始占位）
        if (defaultValue && defaultValue.trim()) {
          setInternalContent(defaultValue);
          setContentKey(prev => prev + 1);
        }
      }
    } catch (error) {
      const err = error as Error;
      addLog('MarkdownEditor: 从本地存储加载内容失败', 'error', {
        category: 'system',
        error: err,
        context: { storageKey }
      });
      console.error('MarkdownEditor: 从本地存储加载内容失败:', error);
      setLoadError(err.message || '加载内容失败');
    } finally {
      setIsLoading(false);
    }
  }, [enableSave, storageKey, defaultValue, onLoad, addLog]);

  // 保存到本地存储
  const saveToStorage = useCallback(async (content: string) => {
    if (!enableSave) return;

    addLog('MarkdownEditor: 开始保存内容到本地存储', 'info', {
      category: 'system',
      context: { storageKey, contentLength: content.length }
    });
    setSaveStatus('saving');
    try {
      await dataPersistence.set<string>(storageKey, content);
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
      addLog('MarkdownEditor: 保存内容到本地存储成功', 'info', {
        category: 'system',
        context: { storageKey, contentLength: content.length }
      });
      onSave?.(content);
      message.success('保存成功');
      
      // 2秒后重置状态
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch (error) {
      const err = error as Error;
      addLog('MarkdownEditor: 保存内容到本地存储失败', 'error', {
        category: 'system',
        error: err,
        context: { 
          storageKey,
          errorMessage: err.message,
          errorStack: err.stack,
          errorType: typeof error
        }
      });
      console.error('MarkdownEditor: 保存内容到本地存储失败:', error);
      // 显示更详细的错误信息给用户
      message.error(`保存失败: ${err.message || '未知错误'}`);
      setSaveStatus('idle');
    }
  }, [enableSave, storageKey, onSave, addLog]);

  // 手动保存按钮点击
  const handleSave = useCallback(async (): Promise<void> => {
    const currentContent = getMarkdown();
    addLog('MarkdownEditor: 手动保存触发', 'info', {
      category: 'system',
      context: { storageKey, contentLength: currentContent.length }
    });
    await saveToStorage(currentContent);
  }, [getMarkdown, saveToStorage, storageKey, addLog]);

  // ==================== 定时器相关函数 ====================

  // 设置自动保存
  const setupAutoSave = useCallback(() => {
    if (autoSaveInterval > 0 && enableSave) {
      addLog('MarkdownEditor: 设置自动保存定时器', 'debug', {
        category: 'system',
        context: { autoSaveInterval }
      });
      autoSaveTimerRef.current = setInterval(() => {
        if (hasUnsavedChanges) {
          const currentContent = getMarkdown();
          addLog('MarkdownEditor: 自动保存触发', 'debug', {
            category: 'system',
            context: { storageKey }
          });
          saveToStorage(currentContent);
        }
      }, autoSaveInterval);
    }
  }, [autoSaveInterval, enableSave, hasUnsavedChanges, getMarkdown, saveToStorage, storageKey, addLog]);

  // 清理定时器
  const cleanupAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      addLog('MarkdownEditor: 清理自动保存定时器', 'debug', {
        category: 'system'
      });
      clearInterval(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, [addLog]);

  // 设置内容轮询
  const setupContentPolling = useCallback(() => {
    if (contentPollTimerRef.current) {
      clearInterval(contentPollTimerRef.current);
    }
    
    contentPollTimerRef.current = setInterval(() => {
      if (crepeRef.current) {
        try {
          const editorContent = crepeRef.current.markdown;
          if (editorContent && editorContent !== internalContent) {
            addLog('MarkdownEditor: 检测到编辑器内容变更（轮询）', 'debug', {
              category: 'system',
              context: { contentLength: editorContent.length }
            });
            setInternalContent(editorContent);
            setHasUnsavedChanges(true);
            onChange?.(editorContent);
          }
        } catch (error) {
          // 静默处理
        }
      }
    }, 500); // 500ms 轮询一次
  }, [internalContent, onChange, addLog]);

  // 清理内容轮询
  const cleanupContentPolling = useCallback(() => {
    if (contentPollTimerRef.current) {
      addLog('MarkdownEditor: 清理内容轮询定时器', 'debug', {
        category: 'system'
      });
      clearInterval(contentPollTimerRef.current);
      contentPollTimerRef.current = null;
    }
  }, [addLog]);

  // ==================== 配置对象 ====================

  const editorConfig = useMemo(() => {
    return {
      defaultValue: internalContent,
      placeholder,
      features: {
        blockEdit: DEFAULT_EDITOR_CONFIG.features.blockEdit,
        placeholder: { text: placeholder },
      },
    };
  }, [internalContent, placeholder]);

  // ==================== 暴露给外部的接口 ====================

  useImperativeHandle(ref, () => ({
    getMarkdown,
    setMarkdown,
    getEditorElement,
    save: handleSave,
  }), [getMarkdown, setMarkdown, getEditorElement, handleSave]);

  // ==================== 上下文值 ====================

  const contextValue = useMemo<MarkdownEditorContextType>(
    () => ({
      getEditorContent: getMarkdown,
      setEditorContent: setMarkdown,
      getEditorElement,
    }),
    [getMarkdown, setMarkdown, getEditorElement]
  );

  // ==================== 样式 ====================

  const combinedContainerStyle = useMemo(() => {
    return {
      ...DEFAULT_CONTAINER_STYLE,
      ...containerStyle,
    };
  }, [containerStyle]);

  const wrapperStyle = useMemo(() => {
    return {
      minHeight,
      background: theme === 'dark' ? '#1b1c1d' : '#fdfcff',
      borderRadius: '8px',
      padding: '20px',
      color: theme === 'dark' ? '#f8f9ff' : '#1b1c1d',
      ...style,
    };
  }, [theme, minHeight, style]);

  // ==================== 副作用处理 ====================

  // 监听外部 value 变化
  useEffect(() => {
    if (value !== undefined && value !== internalContent) {
      addLog('MarkdownEditor: 外部 value 变化，同步到内部状态', 'debug', {
        category: 'system'
      });
      setInternalContent(safeParseContent(value));
      setContentKey(prev => prev + 1);
    }
  }, [value, internalContent, addLog]);

  // 初始化时加载设置和存储的内容
  useEffect(() => {
    fetchSetting();
    if (enableSave && value === undefined) {
      loadFromStorage();
    } else {
      setIsLoading(false);
    }
  }, [fetchSetting, enableSave, loadFromStorage, value]);

  // 监听页面可见性变化，在页面激活时重新加载内容
  useEffect(() => {
    if (!enableSave) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !hasUnsavedChanges) {
        addLog('MarkdownEditor: 页面可见，重新加载内容', 'info', {
          category: 'system'
        });
        loadFromStorage();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enableSave, loadFromStorage, hasUnsavedChanges, addLog]);

  // 设置定时器
  useEffect(() => {
    setupAutoSave();
    setupContentPolling();
    return () => {
      cleanupAutoSave();
      cleanupContentPolling();
    };
  }, [setupAutoSave, cleanupAutoSave, setupContentPolling, cleanupContentPolling]);

  // 组件卸载时保存未保存的内容
  useEffect(() => {
    return () => {
      if (hasUnsavedChanges && enableSave) {
        const currentContent = getMarkdown();
        addLog('MarkdownEditor: 组件卸载，尝试保存未保存内容', 'info', {
          category: 'system'
        });
        saveToStorage(currentContent);
      }
    };
  }, [hasUnsavedChanges, enableSave, getMarkdown, saveToStorage, addLog]);

  // 编辑器初始化和更新
  useEffect(() => {
    if (!rootRef.current) return;

    addLog('MarkdownEditor: 初始化/更新编辑器', 'debug', {
      category: 'system',
      context: { theme, contentKey }
    });

    // 销毁旧实例
    destroyEditorInstance(crepeRef.current);
    rootRef.current.innerHTML = '';
    applyThemeStyles(rootRef.current, theme);

    // 创建新实例
    createEditorInstance(rootRef.current, editorConfig).then((crepe) => {
      crepeRef.current = crepe;

      const editorElement = getMilkdownElement(rootRef.current);
      if (editorElement) {
        applyThemeStyles(editorElement, theme);
      }

      // 当编辑器失去焦点时检查内容是否变更
      if (editorElement) {
        editorElement.addEventListener('blur', () => {
          const editorContent = crepe.markdown;
          if (editorContent !== internalContent) {
            addLog('MarkdownEditor: 编辑器失去焦点，内容已变更', 'debug', {
              category: 'system',
              context: { contentLength: editorContent.length }
            });
            setInternalContent(editorContent);
            setHasUnsavedChanges(true);
            onChange?.(editorContent);
          }
        });
      }
    }).catch((error) => {
      console.error('MarkdownEditor: 创建编辑器实例失败', error);
      addLog('MarkdownEditor: 创建编辑器实例失败', 'error', {
        category: 'system',
        error: error as Error
      });
    });

    return () => {
      destroyEditorInstance(crepeRef.current);
    };
  }, [theme, contentKey, editorConfig, internalContent, onChange, addLog]);

  // ==================== 渲染 ====================

  return (
    <MarkdownEditorContext.Provider value={contextValue}>
      <div style={wrapperStyle}>
        {/* 加载状态 */}
        {isLoading && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
            color: theme === 'dark' ? '#a0aec0' : '#718096',
            fontSize: '14px'
          }}>
            <LoadingOutlined style={{ fontSize: '20px', marginRight: '8px', animation: 'spin 1s linear infinite' }} />
            加载内容中...
          </div>
        )}

        {/* 错误提示 */}
        {loadError && !isLoading && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            backgroundColor: theme === 'dark' ? '#4a1f1f' : '#fff5f5',
            color: theme === 'dark' ? '#fc8181' : '#e53e3e',
            borderRadius: '8px',
            marginBottom: '12px',
            fontSize: '14px'
          }}>
            <span style={{ marginRight: '8px' }}>⚠️</span>
            加载失败: {loadError}
            <Button
              type="link"
              size="small"
              onClick={loadFromStorage}
              style={{ color: theme === 'dark' ? '#90cdf4' : '#3182ce', marginLeft: '8px' }}
            >
              重试
            </Button>
          </div>
        )}

        {/* 工具栏 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px', gap: '8px' }}>
          {enableSave && (
            <Tooltip title={hasUnsavedChanges ? '有未保存的更改，点击保存' : '内容已同步'}>
              <Button
                type={saveStatus === 'saved' ? 'default' : 'primary'}
                icon={
                  saveStatus === 'saving' ? <LoadingOutlined spin /> :
                  saveStatus === 'saved' ? <CheckOutlined /> :
                  <SaveOutlined />
                }
                onClick={handleSave}
                loading={saveStatus === 'saving'}
                disabled={isLoading}
              >
                {saveStatus === 'saving' ? '保存中...' :
                 saveStatus === 'saved' ? '已保存' :
                 hasUnsavedChanges ? '保存' : '保存'}
              </Button>
            </Tooltip>
          )}
        </div>

        {/* AI 工具 */}
        {enableAITools && !isLoading && (
          <MarkdownAITools
            getEditorContent={getMarkdown}
            setEditorContent={setMarkdown}
            editorElement={getEditorElement()}
          />
        )}

        {/* 编辑器容器 - 仅在未加载时隐藏 */}
        {!isLoading && (
          <div
            ref={rootRef}
            className={generateContainerClassName(theme, className)}
            style={combinedContainerStyle}
          />
        )}
      </div>
    </MarkdownEditorContext.Provider>
  );
};

const MarkdownEditorInternal = forwardRef(MarkdownEditorComponent);
MarkdownEditorInternal.displayName = 'MarkdownEditorInternal';

const MarkdownEditor = forwardRef((props: MarkdownEditorProps, ref: React.Ref<MarkdownEditorHandle>) => {
  return (
    <MilkdownProvider>
      <MarkdownEditorInternal ref={ref} {...props} />
    </MilkdownProvider>
  );
});

MarkdownEditor.displayName = 'MarkdownEditor';

export default MarkdownEditor;
export { MarkdownEditorContext, useMarkdownEditorContext };
