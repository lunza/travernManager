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
  const contentRef = useRef<string>(''); // 使用 ref 跟踪内容，减少状态更新
  const editorInstanceRef = useRef<any>(null); // 跟踪编辑器实例
  const cursorStateRef = useRef<any>(null); // 跟踪光标状态
  
  // 内容状态
  const [contentKey, setContentKey] = useState(0);
  const [internalContent, setInternalContent] = useState(() => {
    const initialContent = value !== undefined ? value : '';
    return safeParseContent(initialContent);
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // 保存状态
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ==================== 核心函数（提前定义）====================

  // 获取编辑器当前内容
  const getMarkdown = useCallback((): string => {
    // 优先使用 contentRef.current 获取最新内容
    // 这样可以确保获取到最新的编辑器内容，避免使用可能过时的 internalContent
    const currentContent = contentRef.current || internalContent || '';
    
    addLog('MarkdownEditor: 获取编辑器内容', 'debug', {
      category: 'system',
      context: { 
        contentLength: currentContent.length,
        content: currentContent.substring(0, 20) + '...',
        source: contentRef.current ? 'contentRef' : 'internalContent'
      }
    });
    
    console.log('MarkdownEditor getMarkdown:', {
      contentLength: currentContent.length,
      content: currentContent.substring(0, 50) + '...',
      source: contentRef.current ? 'contentRef' : 'internalContent'
    });
    
    return currentContent;
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
  // 保存到本地存储
  const saveToStorage = useCallback(async (content: string, showNotification: boolean = true) => {
    if (!enableSave) return;

    addLog('MarkdownEditor: 开始保存内容到本地存储', 'info', {
      category: 'system',
      context: { storageKey, contentLength: content.length, showNotification }
    });
    
    // 设置保存状态
    setIsSaving(true);
    
    // 完全异步执行保存操作，不阻塞主线程
    return new Promise<void>((resolve, reject) => {
      // 使用 setTimeout 确保在新的事件循环中执行
      setTimeout(async () => {
        try {
          // 执行存储操作
          await dataPersistence.set<string>(storageKey, content);
          
          // 保存成功后更新状态
          setHasUnsavedChanges(false);
          
          addLog('MarkdownEditor: 保存内容到本地存储成功', 'info', {
            category: 'system',
            context: { storageKey, contentLength: content.length }
          });
          
          // 触发保存成功回调
          onSave?.(content);
          
          // 只有在需要显示通知时才显示
          if (showNotification) {
            const msg = message.success('保存成功', {
              duration: 1.5, // 缩短通知显示时间
              className: 'markdown-editor-save-notification'
            });
            
            // 确保提示框在 2 秒后自动消失
            setTimeout(() => {
              message.destroy();
            }, 2000);
          }
          
          resolve();
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
          message.error(`保存失败: ${err.message || '未知错误'}`, {
            duration: 3
          });
          
          reject(error);
        } finally {
          // 无论成功还是失败，都设置保存状态为 false
          setIsSaving(false);
        }
      }, 0);
    });
  }, [enableSave, storageKey, onSave, addLog]);

  // 手动保存按钮点击
  // 手动保存
  const handleSave = useCallback((): void => {
    // 使用 getMarkdown() 获取最新内容，确保保存的是最新的编辑器内容
    const currentContent = getMarkdown();
    
    addLog('MarkdownEditor: 手动保存触发', 'info', {
      category: 'system',
      context: { storageKey, contentLength: currentContent.length, content: currentContent.substring(0, 50) + '...' }
    });
    
    console.log('MarkdownEditor handleSave:', {
      contentLength: currentContent.length,
      content: currentContent.substring(0, 50) + '...'
    });
    
    // 不使用 await，让保存操作在后台执行，不阻塞用户交互
    saveToStorage(currentContent).catch(error => {
      addLog('MarkdownEditor: 手动保存失败', 'error', {
        category: 'system',
        error: error as Error,
        context: { storageKey, errorMessage: (error as Error).message }
      });
    });
  }, [getMarkdown, saveToStorage, storageKey, addLog]);

  // ==================== 定时器相关函数 ====================

  // 设置自动保存
  const setupAutoSave = useCallback(() => {
    if (autoSaveInterval > 0 && enableSave) {
      addLog('MarkdownEditor: 设置自动保存定时器', 'debug', {
        category: 'system',
        context: { autoSaveInterval: 10000 } // 强制设置为10秒
      });
      autoSaveTimerRef.current = setInterval(() => {
        if (hasUnsavedChanges) {
          const currentContent = getMarkdown();
          addLog('MarkdownEditor: 自动保存触发', 'debug', {
            category: 'system',
            context: { storageKey, contentLength: currentContent.length }
          });
          // 自动保存不显示通知，完全后台运行
          // 使用 Promise 确保异步执行，不影响编辑器
          saveToStorage(currentContent, false).catch(error => {
            addLog('MarkdownEditor: 自动保存失败', 'error', {
              category: 'system',
              error: error as Error,
              context: { storageKey, errorMessage: (error as Error).message }
            });
          });
        }
      }, 10000); // 10秒自动保存间隔
    }
  }, [enableSave, hasUnsavedChanges, getMarkdown, saveToStorage, storageKey, addLog]);

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
    return () => {
      cleanupAutoSave();
    };
  }, [setupAutoSave, cleanupAutoSave]);

  // 组件卸载时保存未保存的内容
  useEffect(() => {
    return () => {
      if (hasUnsavedChanges && enableSave) {
        const currentContent = getMarkdown();
        addLog('MarkdownEditor: 组件卸载，尝试保存未保存内容', 'info', {
          category: 'system',
          context: { contentLength: currentContent.length }
        });
        saveToStorage(currentContent, false); // 组件卸载时保存不显示通知
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

      // 监听 markdown 更新事件，实时同步内容
      crepe.on((listener) => {
        listener.markdownUpdated((_ctx, markdown) => {
          // 先更新 ref，避免状态更新的延迟
          contentRef.current = markdown;
          
          // 只有当内容真正改变时才执行操作
          if (internalContent !== markdown) {
            // 1. 触发 onChange 回调
            onChange?.(markdown);
            
            // 2. 延迟更新 hasUnsavedChanges 状态
            setTimeout(() => {
              setHasUnsavedChanges(true);
            }, 0);
            
            // 3. 延迟记录日志，避免影响输入性能
            setTimeout(() => {
              addLog('MarkdownEditor: 检测到编辑器内容变更（markdownUpdated 事件）', 'debug', {
                category: 'system',
                context: { contentLength: markdown.length, content: markdown.substring(0, 50) + '...' }
              });
            }, 0);
          }
        });
      });

      // 当编辑器失去焦点时更新 internalContent 状态，确保状态一致性
      if (editorElement) {
        editorElement.addEventListener('blur', () => {
          const currentContent = contentRef.current;
          if (currentContent && currentContent !== internalContent) {
            addLog('MarkdownEditor: 编辑器失去焦点，同步内容到内部状态', 'debug', {
              category: 'system',
              context: { contentLength: currentContent.length }
            });
            // 更新 internalContent 状态，但不触发 contentKey 变化，避免编辑器重新渲染
            setInternalContent(currentContent);
          }
          addLog('MarkdownEditor: 编辑器失去焦点', 'debug', {
            category: 'system'
          });
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
  }, [theme, contentKey, editorConfig, onChange, addLog]);

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
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Tooltip title={isSaving ? '保存中...' : hasUnsavedChanges ? '有未保存的更改，点击保存' : '内容已同步'}>
                <Button
                  type="primary"
                  icon={isSaving ? <LoadingOutlined spin /> : <SaveOutlined />}
                  onClick={handleSave}
                  loading={isSaving}
                  disabled={isSaving}
                >
                  {isSaving ? '保存中...' : '保存'}
                </Button>
              </Tooltip>
            </div>
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
