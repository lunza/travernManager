import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button, Dropdown, Space, Tooltip, message, Modal, Input, Spin, Progress } from 'antd';
import type { InputRef } from 'antd';
import { useSettingStore } from '../../../stores/settingStore';
import { useLogStore } from '../../../stores/logStore';
import { AIService, AIServiceConfig, AIConfigValidator } from '../AIService';
import {
  AIToolType,
  SUPPORTED_LANGUAGES,
  TranslationLanguage,
  AIToolState,
  ModalState
} from './MarkdownAITools.types';
import {
  generateSystemPrompt,
  getSelectedText,
  HistoryManager,
  createErrorMessage,
  validateSelectedText,
  cleanThoughtChain
} from './MarkdownAITools.utils';

interface MarkdownAIToolsProps {
  getEditorContent: () => string;
  setEditorContent: (content: string) => void;
  editorElement: HTMLElement | null;
}

const MarkdownAITools: React.FC<MarkdownAIToolsProps> = ({
  getEditorContent,
  setEditorContent
}) => {
  const { setting } = useSettingStore();
  const { addLog } = useLogStore();
  
  const [toolState, setToolState] = useState<AIToolState>({
    isProcessing: false,
    currentTool: null,
    error: null
  });
  
  const [targetLanguage, setTargetLanguage] = useState<TranslationLanguage>(
    SUPPORTED_LANGUAGES[0]
  );
  
  const [hasSelection, setHasSelection] = useState(false);
  const historyManagerRef = useRef(new HistoryManager<string>(50));
  
  // 流式响应状态
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  // 当前正在处理的文本
  const [processingText, setProcessingText] = useState('');
  
  // 模态框状态
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    toolType: null,
    selectedText: ''
  });
  const [customRequirements, setCustomRequirements] = useState('');
  const inputRef = useRef<InputRef>(null);

  // 初始化 AIService
  const getAIServiceConfig = useCallback((): AIServiceConfig => {
    addLog(`[MarkdownAI] 构建 AIService 配置...`);
    
    // 使用默认配置作为基础
    const defaultConfig = AIConfigValidator.createDefaultConfig();
    
    const activeEngine = setting?.aiEngines?.find(engine => engine.id === setting?.activeEngineId) 
      || setting?.aiEngines?.[0];
    
    if (!activeEngine) {
      addLog(`[MarkdownAI] ⚠️ 没有找到活跃引擎，使用默认配置`);
      return defaultConfig;
    }

    addLog(`[MarkdownAI] ✅ 构建 AIService 配置，使用引擎: ${activeEngine.name || activeEngine.id}`);
    
    // 基于默认配置，应用引擎配置
    return {
      ...defaultConfig,
      defaultModel: activeEngine.model_name || defaultConfig.defaultModel,
      defaultBaseUrl: activeEngine.api_url,
      defaultApiKey: activeEngine.api_key || '',
      defaultTemperature: activeEngine.temperature ?? defaultConfig.defaultTemperature,
      defaultMaxTokens: activeEngine.max_tokens || defaultConfig.defaultMaxTokens,
      systemPrompt: activeEngine.system_prompt
    };
  }, [setting, addLog]);

  useEffect(() => {
    const handleSelectionChange = () => {
      const selectedText = getSelectedText();
      setHasSelection(selectedText.length > 0);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!modalState.isOpen) return;
      
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        handleConfirm();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [modalState.isOpen]);

  // 自动聚焦输入框
  useEffect(() => {
    if (modalState.isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [modalState.isOpen]);

  const saveToHistory = useCallback(() => {
    const currentContent = getEditorContent();
    historyManagerRef.current.push(currentContent);
  }, [getEditorContent]);

  const undo = useCallback(() => {
    const previousContent = historyManagerRef.current.pop();
    if (previousContent !== undefined) {
      setEditorContent(previousContent);
      message.success('已撤销');
    } else {
      message.info('没有可撤销的操作');
    }
  }, [setEditorContent]);

  const getToolName = (toolType: AIToolType): string => {
    switch (toolType) {
      case AIToolType.Polish:
        return '润色';
      case AIToolType.Expand:
        return '扩写';
      case AIToolType.Translate:
        return '翻译';
      default:
        return '处理';
    }
  };

  const getPlaceholder = (toolType: AIToolType): string => {
    switch (toolType) {
      case AIToolType.Polish:
        return '请输入润色要求(选填)';
      case AIToolType.Expand:
        return '请输入扩写要求(选填)';
      default:
        return '请输入要求(选填)';
    }
  };

  // 处理润色/扩写按钮点击
  const handlePolishOrExpandClick = useCallback((toolType: AIToolType) => {
    const selectedText = getSelectedText();
    
    const validation = validateSelectedText(selectedText);
    if (!validation.valid) {
      if (validation.error?.includes('Please select')) {
        message.warning('请先选择需要处理的文本');
      } else {
        message.warning(validation.error);
      }
      return;
    }

    // 检查文本长度
    if (selectedText.length > 500) {
      message.warning(`文本较长(${selectedText.length}字)，处理可能需要一些时间`);
    }

    // 打开模态框
    setModalState({
      isOpen: true,
      toolType,
      selectedText
    });
    setCustomRequirements('');
  }, []);

  // 处理翻译按钮点击（直接执行）
  const handleTranslateClick = useCallback(async () => {
    const selectedText = getSelectedText();
    
    const validation = validateSelectedText(selectedText);
    if (!validation.valid) {
      if (validation.error?.includes('Please select')) {
        message.warning('请先选择需要处理的文本');
      } else {
        message.warning(validation.error);
      }
      return;
    }

    await executeAITool(AIToolType.Translate, selectedText, undefined);
  }, [targetLanguage]);

  // 取消按钮
  const handleCancel = useCallback(() => {
    setModalState({
      isOpen: false,
      toolType: null,
      selectedText: ''
    });
    setCustomRequirements('');
  }, []);

  // 使用默认设置
  const handleUseDefault = useCallback(async () => {
    if (!modalState.toolType) return;
    
    await executeAITool(modalState.toolType, modalState.selectedText, undefined);
    handleCancel();
  }, [modalState]);

  // 确认按钮
  const handleConfirm = useCallback(async () => {
    if (!modalState.toolType) return;
    
    await executeAITool(modalState.toolType, modalState.selectedText, customRequirements);
    handleCancel();
  }, [modalState, customRequirements]);

  // 执行AI工具 - 流式响应版本
  const executeAITool = useCallback(async (
    toolType: AIToolType, 
    selectedText: string,
    customRequirements?: string
  ) => {
    const startTime = Date.now();
    const toolName = getToolName(toolType);
    
    addLog(`[MarkdownAI] ======================================`);
    addLog(`[MarkdownAI] 🚀 开始执行 ${toolName} 工具 (流式响应)`);
    addLog(`[MarkdownAI] ======================================`);
    
    setToolState({
      isProcessing: true,
      currentTool: toolType,
      error: null
    });
    setIsStreaming(true);
    setStreamingContent('');
    setProcessingText(selectedText);

    saveToHistory();
    addLog(`[MarkdownAI] 已保存当前内容到历史记录`);

    try {
      addLog(`[MarkdownAI] 文本信息: 长度 ${selectedText.length} 字符${customRequirements ? `，自定义要求: ${customRequirements}` : '，使用默认设置'}`);
      addLog(`[MarkdownAI] 选中文本预览: ${selectedText.substring(0, 100)}${selectedText.length > 100 ? '...' : ''}`);
      
      addLog(`[MarkdownAI] 正在构建 AIService...`);
      const aiConfig = getAIServiceConfig();
      const aiService = new AIService(aiConfig);

      addLog(`[MarkdownAI] ✅ AIService 初始化完成`);

      // 以全局配置的 systemPrompt 为基础，然后拼接工具特定的提示词
      const generatedPrompt = generateSystemPrompt(
        toolType, 
        toolType === AIToolType.Translate ? targetLanguage.nativeName : undefined,
        customRequirements
      );
      
      let systemPrompt = generatedPrompt;
      
      // 如果配置中有全局 systemPrompt，把它放在最前面
      if (aiConfig.systemPrompt && aiConfig.systemPrompt.trim()) {
        systemPrompt = `${aiConfig.systemPrompt.trim()}\n\n${generatedPrompt}`;
      }

      addLog(`[MarkdownAI] 📝 系统提示词已生成 (长度: ${systemPrompt.length} 字符)`);

      const messages = [
        {
          role: 'system' as const,
          content: systemPrompt
        },
        {
          role: 'user' as const,
          content: selectedText
        }
      ];

      addLog(`[MarkdownAI] ⏳ 开始流式请求...`);
      
      let accumulatedContent = '';
      let responseComplete = false;

      await aiService.sendStreamChatRequest(
        { messages, model: aiConfig.defaultModel },
        {
          onStream: (chunk, done) => {
            if (chunk) {
              accumulatedContent += chunk;
              setStreamingContent(accumulatedContent);
              
              // 实时更新编辑器内容
              const currentContent = getEditorContent();
              const escapedOriginal = selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regex = new RegExp(escapedOriginal, 'g');
              const tempContent = currentContent.replace(regex, accumulatedContent);
              setEditorContent(tempContent);
            }
            
            if (done) {
              responseComplete = true;
              addLog(`[MarkdownAI] ✅ 流式响应完成`);
            }
          },
          onError: (error) => {
            const errorMsg = typeof error === 'string' ? error : error.message;
            addLog(`[MarkdownAI] ❌ 流式响应错误: ${errorMsg}`, 'error');
            throw new Error(errorMsg);
          },
          onComplete: (response) => {
            addLog(`[MarkdownAI] ✅ 响应完成回调触发`);
            if (response?.content) {
              accumulatedContent = response.content;
              setStreamingContent(accumulatedContent);
            }
          }
        }
      );

      // 确保最终清理
      if (!responseComplete && accumulatedContent.length > 0) {
        addLog(`[MarkdownAI] ⚠️ 流式响应提前结束，但有部分内容可用`);
      }

      const cleanedText = cleanThoughtChain(accumulatedContent, toolType);
      addLog(`[MarkdownAI] 清理后的文本长度: ${cleanedText.length} 字符`);
      addLog(`[MarkdownAI] 📄 最终完整内容: ${cleanedText}`);
      
      // 最终更新编辑器
      const currentContent = getEditorContent();
      const escapedOriginal = selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedOriginal, 'g');
      const newContent = currentContent.replace(regex, cleanedText);
      setEditorContent(newContent);
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      addLog(`[MarkdownAI] ======================================`);
      addLog(`[MarkdownAI] ✅ ${toolName}完成 (流式)!`);
      addLog(`[MarkdownAI] ======================================`);
      addLog(`[MarkdownAI] 总耗时: ${duration.toFixed(2)}秒`);
      addLog(`[MarkdownAI] 输入长度: ${selectedText.length} 字符`);
      addLog(`[MarkdownAI] 输出长度: ${cleanedText.length} 字符`);
      addLog(`[MarkdownAI] 内容变化: ${cleanedText.length - selectedText.length > 0 ? '+' : ''}${cleanedText.length - selectedText.length} 字符`);
      
      setToolState({
        isProcessing: false,
        currentTool: null,
        error: null
      });
      setIsStreaming(false);
      setStreamingContent('');
      setProcessingText('');
      
      message.success(`${toolName}成功 (流式)`);
      
    } catch (error) {
      addLog(`[MarkdownAI] ======================================`, 'error');
      addLog(`[MarkdownAI] ❌ ${getToolName(toolType)}失败`, 'error');
      addLog(`[MarkdownAI] ======================================`, 'error');
      addLog(`[MarkdownAI] 错误类型: ${error instanceof Error ? error.name : 'Unknown Error'}`, 'error');
      addLog(`[MarkdownAI] 错误信息: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      
      if (error instanceof Error && error.stack) {
        addLog(`[MarkdownAI] 堆栈跟踪: ${error.stack}`, 'error');
      }
      
      message.error(`${getToolName(toolType)}失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setToolState({
        isProcessing: false,
        currentTool: null,
        error: createErrorMessage(error)
      });
      setIsStreaming(false);
      setStreamingContent('');
      setProcessingText('');
    }
  }, [getEditorContent, setEditorContent, saveToHistory, targetLanguage, getAIServiceConfig, addLog]);

  const getLanguageMenuItems = () => {
    return SUPPORTED_LANGUAGES.map((lang) => ({
      key: lang.code,
      label: `${lang.nativeName} (${lang.name})`,
      onClick: () => setTargetLanguage(lang)
    }));
  };

  return (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        borderRadius: '8px',
        marginBottom: '12px',
        flexWrap: 'wrap'
      }}>
        <Space size="small">
          <Tooltip title="优化文本的表达流畅度、语法准确性和可读性（流式响应）">
            <Button
              type="text"
              size="small"
              disabled={!hasSelection || toolState.isProcessing}
              loading={toolState.isProcessing && toolState.currentTool === AIToolType.Polish}
              onClick={() => handlePolishOrExpandClick(AIToolType.Polish)}
              style={{
                fontWeight: 500,
                color: hasSelection ? '#1890ff' : '#ccc'
              }}
            >
              ✨ AI润色
            </Button>
          </Tooltip>

          <Tooltip title="在保留核心意思的基础上，对文本进行内容扩展和细节补充（流式响应）">
            <Button
              type="text"
              size="small"
              disabled={!hasSelection || toolState.isProcessing}
              loading={toolState.isProcessing && toolState.currentTool === AIToolType.Expand}
              onClick={() => handlePolishOrExpandClick(AIToolType.Expand)}
              style={{
                fontWeight: 500,
                color: hasSelection ? '#722ed1' : '#ccc'
              }}
            >
              📝 AI扩写
            </Button>
          </Tooltip>

          <Dropdown menu={{ items: getLanguageMenuItems() }} trigger={['click']}>
            <Button
              type="text"
              size="small"
              disabled={!hasSelection || toolState.isProcessing}
              loading={toolState.isProcessing && toolState.currentTool === AIToolType.Translate}
              onClick={handleTranslateClick}
              style={{
                fontWeight: 500,
                color: hasSelection ? '#13c2c2' : '#ccc'
              }}
            >
              🌐 AI翻译 {targetLanguage.nativeName}
            </Button>
          </Dropdown>
        </Space>

        <div style={{ flex: 1 }} />

        <Button
          type="text"
          size="small"
          onClick={undo}
          disabled={historyManagerRef.current.size === 0 || isStreaming}
          style={{ color: '#666' }}
        >
          ↩️ 撤销
        </Button>

        {toolState.isProcessing && (
          <span style={{ 
            fontSize: '12px', 
            color: '#999',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Spin size="small" />
            AI正在处理中 (流式)...
            {isStreaming && streamingContent.length > 0 && processingText.length > 0 && (
              <Progress
                percent={Math.min((streamingContent.length / (processingText.length * 2)) * 100, 95)}
                size="small"
                style={{ width: 80 }}
                strokeColor="#1890ff"
              />
            )}
          </span>
        )}
      </div>

      {/* 润色/扩写模态框 */}
      <Modal
        title={
          <span>
            {modalState.toolType === AIToolType.Polish ? '✨ AI润色 (流式)' : '📝 AI扩写 (流式)'}
            {modalState.selectedText.length > 500 && (
              <span style={{ 
                marginLeft: '8px', 
                fontSize: '12px', 
                color: '#faad14' 
              }}>
                ⚠️ 文本较长({modalState.selectedText.length}字)
              </span>
            )}
          </span>
        }
        open={modalState.isOpen}
        onCancel={handleCancel}
        maskClosable={false}
        footer={[
          <Button key="default" onClick={handleUseDefault} style={{ marginRight: 'auto' }}>
            使用默认设置
          </Button>,
          <Button key="cancel" onClick={handleCancel}>
            取消
          </Button>,
          <Button key="confirm" type="primary" onClick={handleConfirm} loading={toolState.isProcessing}>
            确认
          </Button>
        ]}
        centered
        destroyOnClose
      >
        <div style={{ marginBottom: '16px' }}>
          <p style={{ color: '#666', marginBottom: '8px' }}>
            已选择文本: <strong>{modalState.selectedText.length}</strong> 字
          </p>
          <div style={{
            maxHeight: '120px',
            overflow: 'auto',
            padding: '12px',
            backgroundColor: '#f5f5f5',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#333',
            border: '1px solid #e8e8e8'
          }}>
            {modalState.selectedText}
          </div>
        </div>
        
        <Input
          ref={inputRef}
          placeholder={modalState.toolType ? getPlaceholder(modalState.toolType) : ''}
          value={customRequirements}
          onChange={(e) => setCustomRequirements(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              handleConfirm();
            }
          }}
          style={{ width: '100%' }}
          maxLength={200}
          showCount
        />
        
        <p style={{ marginTop: '12px', fontSize: '12px', color: '#999' }}>
          💡 未输入要求时将使用默认处理逻辑
        </p>
        <p style={{ marginTop: '8px', fontSize: '12px', color: '#1890ff' }}>
          ✨ 流式响应将实时更新编辑器内容
        </p>
      </Modal>
    </>
  );
};

export default MarkdownAITools;
