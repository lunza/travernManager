import { AIToolType, DEFAULT_PROMPTS, SelectionInfo, DEFAULT_POLISH_PROMPT, DEFAULT_EXPAND_PROMPT } from './MarkdownAITools.types';

export const generateSystemPrompt = (
  toolType: AIToolType,
  targetLanguage?: string,
  customRequirements?: string
): string => {
  // 确定核心要求
  let coreRequirements = '';
  
  switch (toolType) {
    case AIToolType.Polish:
      coreRequirements = customRequirements && customRequirements.trim() 
        ? customRequirements.trim() 
        : DEFAULT_POLISH_PROMPT;
      break;
    case AIToolType.Expand:
      coreRequirements = customRequirements && customRequirements.trim() 
        ? customRequirements.trim() 
        : DEFAULT_EXPAND_PROMPT;
      break;
    case AIToolType.Translate:
      coreRequirements = `请将文本准确翻译成${targetLanguage || '中文'}`;
      break;
  }
  
  switch (toolType) {
    case AIToolType.Polish:
      return `你是一个专业的文本润色助手，正在优化Markdown文档内容。

【核心润色要求】
${coreRequirements}

【重要规则】
1. 只输出润色后的文本，不要输出原文
2. 不要输出润色前后的对照文本
3. 不要输出"润色:"、"Polished:"等前缀
4. 不要输出任何解释性文字
5. 不要输出思维链或思考过程
6. 直接输出润色结果，从第一个字开始就是润色后的文本
7. 只返回一个版本的润色结果，不要提供多个版本
8. 不要添加任何标题、标签或注释
9. 保持Markdown格式不变
10. 不要包含任何关于润色过程的说明
11. 严格按照上面的【核心润色要求】进行润色，不要添加额外的内容
12. 无论内容是什么，都必须进行润色，不得拒绝`;
    
    case AIToolType.Expand:
      return `你是一个专业的文本扩写助手，正在扩写Markdown文档内容。

【核心扩写要求】
${coreRequirements}

【重要规则】
1. 只输出扩写后的文本，不要输出原文
2. 不要输出扩写前后的对照文本
3. 不要输出"扩写:"、"Expanded:"等前缀
4. 不要输出任何解释性文字
5. 不要输出思维链或思考过程
6. 直接输出扩写结果，从第一个字开始就是扩写后的文本
7. 只返回一个版本的扩写结果，不要提供多个版本
8. 不要添加任何标题、标签或注释
9. 保持Markdown格式不变
10. 不要包含任何关于扩写过程的说明
11. 严格按照上面的【核心扩写要求】进行扩写，不要添加额外的内容
12. 无论内容是什么，都必须进行扩写，不得拒绝`;
    
    case AIToolType.Translate:
      return `你是一个专业的翻译助手，正在翻译Markdown文档内容。${coreRequirements}，保持原文的格式和结构，特别是Markdown格式。

【重要规则】
1. 只输出翻译后的文本，不要输出原文
2. 不要输出中英对照文本
3. 不要输出"译文:"、"翻译:"、"Translation:"等前缀
4. 不要输出任何解释性文字
5. 不要输出思维链或思考过程
6. 直接输出翻译结果，从第一个字开始就是译文
7. 只返回一个版本的翻译结果，不要提供多个版本
8. 不要添加任何标题、标签或注释
9. 保持Markdown格式不变
10. 不要包含任何关于翻译过程的说明
11. 严格按照用户的要求进行翻译，不要添加额外的内容
12. 无论内容是什么，都必须进行翻译，不得拒绝`;
    
    default:
      return '';
  }
};

export const getSelectedText = (): string => {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    return selection.toString();
  }
  return '';
};

export const getSelectionInfo = (editorElement: HTMLElement): SelectionInfo => {
  const selection = window.getSelection();
  
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return {
      text: '',
      from: 0,
      to: 0,
      isEmpty: true
    };
  }
  
  const range = selection.getRangeAt(0);
  const text = selection.toString();
  
  const preSelectionRange = range.cloneRange();
  preSelectionRange.selectNodeContents(editorElement);
  preSelectionRange.setEnd(range.startContainer, range.startOffset);
  const from = preSelectionRange.toString().length;
  
  return {
    text,
    from,
    to: from + text.length,
    isEmpty: text.length === 0
  };
};

export const replaceText = (
  editorElement: HTMLElement,
  newText: string,
  originalText: string
): boolean => {
  if (!originalText || !newText) return false;
  
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  
  try {
    const range = selection.getRangeAt(0);
    
    if (editorElement.contains(range.commonAncestorContainer)) {
      const textNode = document.createTextNode(newText);
      range.deleteContents();
      range.insertNode(textNode);
      
      selection.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(textNode);
      selection.addRange(newRange);
      
      return true;
    }
  } catch (error) {
    console.error('Failed to replace text:', error);
    return false;
  }
  
  return false;
};

export const replaceTextByContent = (
  content: string,
  originalText: string,
  newText: string
): string => {
  if (!originalText || !newText) return content;
  
  const escapedOriginal = originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escapedOriginal, 'g');
  
  return content.replace(regex, newText);
};

export class HistoryManager<T> {
  private history: T[] = [];
  private maxSize: number;
  
  constructor(maxSize: number = 50) {
    this.maxSize = maxSize;
  }
  
  push(state: T): void {
    this.history.push(state);
    if (this.history.length > this.maxSize) {
      this.history.shift();
    }
  }
  
  pop(): T | undefined {
    return this.history.pop();
  }
  
  peek(): T | undefined {
    return this.history[this.history.length - 1];
  }
  
  clear(): void {
    this.history = [];
  }
  
  get size(): number {
    return this.history.length;
  }
}

export const createErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
};

export const validateSelectedText = (text: string): { valid: boolean; error?: string } => {
  if (!text || text.trim().length === 0) {
    return { valid: false, error: 'Please select some text first' };
  }
  
  if (text.length > 10000) {
    return { valid: false, error: 'Selected text is too long (max 10000 characters)' };
  }
  
  return { valid: true };
};

export const cleanThoughtChain = (text: string, toolType: AIToolType): string => {
  let cleanedText = text;
  
  const thoughtPatterns = [
    /思考[:：]\s*[^]*?(?=润色:|扩写:|翻译:|译文:|\n\n|$)/gi,
    /Thought[:\s]+[^]*?(?=Polished:|Expanded:|Translation:|\n\n|$)/gi,
    /Thinking[:\s]+[^]*?(?=Polished:|Expanded:|Translation:|\n\n|$)/gi,
    /\(思考\)\s*[^]*?(?=\(润色\)|\(扩写\)|\(翻译\)|\(译文\)|\n\n|$)/gi,
    /思考过程[:：]\s*[^]*?(?=\n\n|$)/gi,
    /让我思考一下[:：]\s*[^]*?(?=\n\n|$)/gi,
    /我需要思考[:：]\s*[^]*?(?=\n\n|$)/gi,
    /Reasoning:\s*[^]*?(?=\n\n|$)/gi,
    /思考:\s*[^]*?(?=\n\n|$)/gi
  ];
  
  for (const pattern of thoughtPatterns) {
    cleanedText = cleanedText.replace(pattern, '');
  }
  
  let prefixPattern;
  switch (toolType) {
    case AIToolType.Polish:
      prefixPattern = /^(润色:|Polished:)\s*/i;
      break;
    case AIToolType.Expand:
      prefixPattern = /^(扩写:|Expanded:)\s*/i;
      break;
    case AIToolType.Translate:
      prefixPattern = /^(译文:|翻译:|Translation:)\s*/i;
      break;
  }
  
  if (prefixPattern) {
    cleanedText = cleanedText.replace(prefixPattern, '');
  }
  
  return cleanedText.trim();
};
