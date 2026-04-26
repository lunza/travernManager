# TravenManager 技术文档

**版本**：1.0.0
**更新日期**：2026-04-25
**项目名称**：TravenManager（傻呆框架配置管理器）

---

## 目录

1. [技术架构概述](#1-技术架构概述)
2. [技术栈详情](#2-技术栈详情)
3. [功能模块说明](#3-功能模块说明)
4. [项目结构解析](#4-项目结构解析)
5. [UI 设计规范](#5-ui-设计规范)
6. [环境配置指南](#6-环境配置指南)
7. [开发规范](#7-开发规范)
8. [部署流程](#8-部署流程)
9. [常见问题解决方案](#9-常见问题解决方案)

---

## 1. 技术架构概述

### 1.1 系统整体架构

TravenManager 基于 Electron 框架构建，采用主进程-渲染进程架构模式。

```
┌─────────────────────────────────────────────────────────────┐
│                        Electron App                          │
├─────────────────────────────────────────────────────────────┤
│  Main Process (Node.js)                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ IPC Handlers (src/main/ipc/)                        │  │
│  │  ├── aiHandlers.ts          - AI 服务处理            │  │
│  │  ├── appHandlers.ts         - 应用级处理              │  │
│  │  ├── avatarHandlers.ts      - 头像处理                │  │
│  │  ├── characterChatHandlers  - 角色聊天处理            │  │
│  │  ├── characterHandlers.ts   - 角色卡处理              │  │
│  │  ├── creativeHandlers.ts    - 创意功能处理            │  │
│  │  ├── fileHandlers.ts        - 文件操作处理            │  │
│  │  ├── memoryHandlers.ts      - 记忆功能处理            │  │
│  │  ├── pluginHandlers.ts      - 插件处理                │  │
│  │  ├── settingHandlers.ts     - 设置处理                │  │
│  │  └── worldBookHandlers.ts   - 世界书处理              │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Services Layer (src/main/services/)                  │  │
│  │  ├── storageService.ts       - 存储服务               │  │
│  │  ├── storageManager.ts       - 存储管理器              │  │
│  │  ├── dataMigrationService.ts - 数据迁移服务           │  │
│  │  ├── characterService.ts     - 角色服务                │  │
│  │  ├── worldBookService.ts    - 世界书服务              │  │
│  │  ├── avatarService.ts       - 头像服务                │  │
│  │  ├── settingService.ts      - 设置服务                │  │
│  │  ├── optimizerService.ts    - 优化器服务              │  │
│  │  └── pluginService.ts       - 插件服务                │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Storage Layer (electron-store)                       │  │
│  │  ├── travenmanager-config.json    - 系统配置         │  │
│  │  ├── travenmanager-creative.json  - 创意数据         │  │
│  │  ├── travenmanager-character.json  - 角色卡数据       │  │
│  │  ├── travenmanager-worldbook.json - 世界书数据       │  │
│  │  ├── travenmanager-memory.json    - 记忆数据         │  │
│  │  └── travenmanager-editor.json    - 编辑器数据       │  │
│  └──────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Preload Script (contextBridge)                             │
│  └── preload.ts - 安全暴露 IPC API 到渲染进程               │
├─────────────────────────────────────────────────────────────┤
│  Renderer Process (React)                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Components (src/renderer/components/)               │  │
│  │  ├── Common/          - 公共组件                      │  │
│  │  ├── Character/       - 角色管理                      │  │
│  │  ├── Creative/        - 创意功能                      │  │
│  │  ├── WorldBook/       - 世界书管理                    │  │
│  │  ├── MemoryChat/      - 记忆聊天                      │  │
│  │  ├── Layout/          - 布局组件                      │  │
│  │  ├── Settings/        - 设置页面                      │  │
│  │  └── Dashboard/       - 仪表盘                        │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Stores (Zustand)                                     │  │
│  │  ├── creativeStore.ts     - 创意状态管理             │  │
│  │  ├── characterChatStore.ts - 角色聊天状态            │  │
│  │  ├── settingStore.ts       - 设置状态管理             │  │
│  │  ├── dataStore.ts          - 数据状态管理             │  │
│  │  └── logStore.ts           - 日志状态管理             │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ State Management (Zustand)                           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 核心组件交互流程

#### IPC 通信流程

```
Renderer (React)                    Main (Node.js)
      │                                    │
      │  window.electronAPI.storage.get()  │
      ├──────────────────────────────────►│
      │                                    │  StorageManager.get()
      │                                    │         │
      │                                    │         ▼
      │                                    │  electron-store
      │                                    │         │
      │◄───────────────────────────────────┤         │
      │        Promise<data>               │         │
```

#### 数据流向

```
用户操作 → React 组件 → IPC 调用 → Main Process Handler
                                              │
                                              ▼
                                    Service Layer (业务逻辑)
                                              │
                                              ▼
                                    Storage Layer (electron-store)
                                              │
                                              ▼
                                    本地 JSON 文件持久化
```

### 1.3 关键技术决策

| 决策项 | 选择方案 | 替代方案 | 选择原因 |
|--------|---------|---------|---------|
| 桌面框架 | Electron | Tauri | 生态成熟，API 丰富 |
| 前端框架 | React 18 | Vue | 社区活跃，组件丰富 |
| 状态管理 | Zustand | Redux | 轻量级，TypeScript 支持好 |
| Markdown 编辑器 | Milkdown | TipTap | 所见即所得，功能完整 |
| 存储方案 | electron-store | SQLite | 简单易用，JSON 友好 |
| 构建工具 | Vite | Webpack | 快速启动，热更新 |
| AI 集成 | @ai-sdk/react | openai SDK | React 生态友好 |

---

## 2. 技术栈详情

### 2.1 前端技术栈

#### 核心框架

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.2.0 | UI 框架 |
| React DOM | 18.2.0 | DOM 渲染 |
| TypeScript | 5.3.3 | 类型系统 |

#### UI 组件库

| 技术 | 版本 | 用途 |
|------|------|------|
| Ant Design | 6.3.5 | React UI 组件库 |
| Tailwind CSS | - | CSS 框架（如使用）|

#### Markdown 编辑器

| 技术 | 版本 | 用途 |
|------|------|------|
| @milkdown/core | 7.20.0 | Milkdown 核心 |
| @milkdown/react | 7.20.0 | React 集成 |
| @milkdown/preset-commonmark | 7.20.0 | CommonMark 预设 |
| @milkdown/preset-gfm | 7.20.0 | GitHub Flavored Markdown |
| @milkdown/crepe | 7.20.0 | 富文本编辑 |
| @milkdown/plugin-slash | 7.20.0 | 斜杠命令插件 |
| react-markdown | 10.1.0 | React Markdown 渲染 |

#### 状态管理

| 技术 | 版本 | 用途 |
|------|------|------|
| Zustand | 5.0.12 | 轻量级状态管理 |

#### AI 集成

| 技术 | 版本 | 用途 |
|------|------|------|
| @ai-sdk/openai | 3.0.53 | OpenAI SDK |
| @ai-sdk/react | 3.0.170 | React AI 集成 |
| ai | 6.0.168 | AI 基础设施 |

#### 工具库

| 技术 | 版本 | 用途 |
|------|------|------|
| zod | 4.3.6 | Schema 验证 |
| react-markdown | 10.1.0 | Markdown 渲染 |
| remark-gfm | 4.0.1 | GFM 支持 |
| rehype-raw | 7.0.0 | HTML 原始支持 |

### 2.2 后端/桌面技术栈

#### Electron

| 技术 | 版本 | 用途 |
|------|------|------|
| Electron | 28.0.0 | 桌面应用框架 |
| electron-store | 11.0.2 | 数据持久化 |

#### Node.js 模块

| 技术 | 版本 | 用途 |
|------|------|------|
| mkdirp | 3.0.1 | 目录创建 |
| rimraf | 6.1.3 | 文件删除 |
| json5 | 2.2.3 | JSON 解析 |
| simple-git | 3.33.0 | Git 操作 |
| xlsx | 0.18.5 | Excel 处理 |
| crc | 4.3.2 | CRC 校验 |
| sanitize-filename | 1.6.4 | 文件名安全化 |

### 2.3 构建工具

#### 前端构建

| 技术 | 版本 | 用途 |
|------|------|------|
| Vite | 5.0.8 | 构建工具 |
| @vitejs/plugin-react | 4.2.1 | React 插件 |

#### Electron 构建

| 技术 | 版本 | 用途 |
|------|------|------|
| electron-builder | 24.9.1 | Electron 打包 |
| vite-plugin-electron | 0.28.0 | Vite Electron 集成 |

### 2.4 开发工具

#### 测试

| 技术 | 版本 | 用途 |
|------|------|------|
| Vitest | 4.1.5 | 单元测试框架 |
| @testing-library/react | 16.3.2 | React 测试库 |
| @testing-library/jest-dom | 6.9.1 | Jest DOM 匹配 |
| jsdom | 29.0.2 | DOM 模拟 |

#### 代码质量

| 技术 | 版本 | 用途 |
|------|------|------|
| ESLint | 8.56.0 | 代码检查 |
| Prettier | 3.1.1 | 代码格式化 |
| @typescript-eslint/eslint-plugin | 6.15.0 | TS ESLint 插件 |
| @typescript-eslint/parser | 6.15.0 | TS 解析器 |

### 2.5 第三方服务

| 服务 | 用途 |
|------|------|
| OpenAI API | AI 能力提供 |

---

## 3. 功能模块说明

### 3.1 模块架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                    TravenManager App                        │
├─────────────────────────────────────────────────────────────┤
│  CreativeModule  │  CharacterModule  │  WorldBookModule      │
│  ─────────────   │  ─────────────   │  ─────────────        │
│  · 创意生成      │  · 角色卡管理     │  · 世界书管理         │
│  · 创意优化      │  · 角色聊天       │  · 标签系统           │
│  · 创意历史      │  · 角色格式       │  · 内容预览           │
├─────────────────────────────────────────────────────────────┤
│  MemoryModule    │  EditorModule     │  SettingsModule       │
│  ─────────────   │  ─────────────   │  ─────────────        │
│  · 长期记忆      │  · Markdown编辑   │  · 系统设置           │
│  · 聊天记录      │  · AI 工具       │  · 插件管理           │
│  · 模板管理      │  · 实时预览       │  · Avatar管理        │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 CreativeModule（创意功能模块）

#### 职责
提供创意内容的生成、优化和管理功能。

#### 核心功能
- **CreativeGenerate**：创意内容生成
- **CreativeOptimize**：创意内容优化
- **CreativeDetail**：创意详情查看
- **CreativeList**：创意列表管理
- **CreativeHistory**：创意历史记录

#### 存储结构
```typescript
interface CreativeData {
  creatives: Creative[];
  categories: string[];
  tags: string[];
  history: HistoryItem[];
}
```

#### API 接口
```typescript
interface CreativeAPI {
  generate(params: GenerateParams): Promise<Creative>;
  optimize(params: OptimizeParams): Promise<Creative>;
  save(creative: Creative): Promise<void>;
  delete(id: string): Promise<void>;
  list(filter?: FilterParams): Promise<Creative[]>;
}
```

### 3.3 CharacterModule（角色卡模块）

#### 职责
管理角色卡的创建、编辑、导入导出和聊天功能。

#### 核心功能
- **CharacterManager**：角色卡列表管理
- **CharacterCardEditor**：角色卡编辑器
- **CharacterChat**：角色扮演聊天

#### 存储结构
```typescript
interface CharacterData {
  characterCards: CharacterCard[];
  recentChats: ChatRecord[];
  favorites: string[];
}
```

#### API 接口
```typescript
interface CharacterAPI {
  create(card: CharacterCard): Promise<CharacterCard>;
  update(id: string, card: CharacterCard): Promise<CharacterCard>;
  delete(id: string): Promise<void>;
  importFromFile(file: File): Promise<CharacterCard>;
  exportToFile(id: string): Promise<File>;
  chat(params: ChatParams): Promise<ChatMessage>;
}
```

### 3.4 WorldBookModule（世界书模块）

#### 职责
管理世界书内容的创建、编辑和标签分类。

#### 核心功能
- **WorldBookManager**：世界书列表管理
- **WorldBookEditor**：世界书编辑器
- **TagManager**：标签管理系统

#### 存储结构
```typescript
interface WorldBookData {
  worldBooks: WorldBook[];
  tags: Tag[];
  categories: Category[];
}
```

#### API 接口
```typescript
interface WorldBookAPI {
  create(book: WorldBook): Promise<WorldBook>;
  update(id: string, book: WorldBook): Promise<WorldBook>;
  delete(id: string): Promise<void>;
  search(keyword: string): Promise<WorldBook[]>;
  getByTag(tagId: string): Promise<WorldBook[]>;
}
```

### 3.5 MemoryModule（记忆功能模块）

#### 职责
提供长期记忆管理和聊天记录功能。

#### 核心功能
- **MemoryChatManager**：记忆聊天管理
- **ChatManager**：聊天记录管理
- **TemplateManager**：模板管理

#### 存储结构
```typescript
interface MemoryData {
  longTermMemories: Memory[];
  chatLogs: ChatLog[];
  templates: Template[];
  settings: MemorySettings;
}
```

#### API 接口
```typescript
interface MemoryAPI {
  addMemory(content: string, metadata?: MemoryMetadata): Promise<Memory>;
  getMemories(query?: MemoryQuery): Promise<Memory[]>;
  deleteMemory(id: string): Promise<void>;
  searchMemories(keyword: string): Promise<Memory[]>;
}
```

### 3.6 EditorModule（编辑器模块）

#### 职责
提供 Markdown 编辑功能，支持 AI 辅助写作。

#### 核心功能
- **MarkdownEditor**：Markdown 编辑器
- **MarkdownAITools**：AI 辅助工具
- **RichTextRenderer**：富文本渲染

#### 存储结构
```typescript
interface EditorData {
  documents: Document[];
  autoSaves: AutoSave[];
  preferences: EditorPreferences;
}
```

#### API 接口
```typescript
interface EditorAPI {
  createDocument(title: string, content?: string): Promise<Document>;
  saveDocument(id: string, content: string): Promise<void>;
  getDocument(id: string): Promise<Document>;
  deleteDocument(id: string): Promise<void>;
  exportDocument(id: string, format: ExportFormat): Promise<File>;
}
```

### 3.7 SettingsModule（设置模块）

#### 职责
管理系统设置、插件配置和用户偏好。

#### 核心功能
- **Settings**：设置页面
- **PluginManager**：插件管理
- **AvatarManager**：头像管理

#### 存储结构
```typescript
interface SettingsData {
  general: GeneralSettings;
  appearance: AppearanceSettings;
  plugins: PluginSettings[];
  avatar: AvatarSettings;
}
```

---

## 4. 项目结构解析

### 4.1 完整目录树

```
travenManager/
├── .eslintrc.cjs              # ESLint 配置
├── .gitignore                 # Git 忽略文件
├── .prettierrc                # Prettier 配置
├── tsconfig.json              # TypeScript 配置
├── vite.config.ts             # Vite 配置
├── vitest.config.ts           # Vitest 测试配置
├── package.json               # 项目依赖
├── electron-builder.json5     # Electron Builder 配置
├── index.html                 # HTML 入口
├── TECHNICAL_DOCUMENTATION.md # 本文档
├── PROJECT_DOCUMENTATION.md   # 项目文档
├── CHANGELOG.md               # 变更日志
├── README.md                  # 项目说明
├── ERROR_HANDLING.md          # 错误处理文档
├── SYSTEM_COMPATIBILITY.md    # 系统兼容性文档
├── settings/                  # 应用设置目录
│   └── settings.json
└── src/
    ├── main/                  # Electron 主进程
    │   ├── index.ts           # 主进程入口
    │   ├── preload.ts         # Preload 脚本
    │   ├── ipc/               # IPC 处理器
    │   │   ├── index.ts       # IPC 初始化
    │   │   └── handlers/      # 具体处理器
    │   │       ├── aiHandlers.ts
    │   │       ├── appHandlers.ts
    │   │       ├── avatarHandlers.ts
    │   │       ├── characterChatHandlers.ts
    │   │       ├── characterHandlers.ts
    │   │       ├── creativeHandlers.ts
    │   │       ├── fileHandlers.ts
    │   │       ├── memoryHandlers.ts
    │   │       ├── pluginHandlers.ts
    │   │       ├── settingHandlers.ts
    │   │       └── worldBookHandlers.ts
    │   ├── services/          # 业务服务层
    │   │   ├── storageService.ts     # 存储服务
    │   │   ├── storageManager.ts      # 存储管理器
    │   │   ├── storage.types.ts      # 存储类型定义
    │   │   ├── dataMigrationService.ts # 数据迁移
    │   │   ├── characterService.ts   # 角色服务
    │   │   ├── worldBookService.ts   # 世界书服务
    │   │   ├── avatarService.ts      # 头像服务
    │   │   ├── settingService.ts     # 设置服务
    │   │   ├── optimizerService.ts    # 优化器服务
    │   │   ├── pluginService.ts      # 插件服务
    │   │   ├── fileService.ts        # 文件服务
    │   │   └── server.ts             # 服务器配置
    │   ├── shared/            # 共享代码
    │   │   └── schemas/       # 数据模式
    │   │       └── settingSchema.ts
    │   └── memory/            # 记忆模块（嵌入式）
    │       ├── chatLogService.ts
    │       └── tableTemplateService.ts
    ├── renderer/              # Electron 渲染进程（React）
    │   ├── main.tsx           # React 入口
    │   ├── App.tsx            # 根组件
    │   ├── components/        # React 组件
    │   │   ├── Common/        # 公共组件
    │   │   │   ├── DataPersistence.tsx    # 数据持久化
    │   │   │   ├── AIService.tsx          # AI 服务
    │   │   │   ├── AIService.types.ts    # AI 类型
    │   │   │   ├── AIService.utils.ts    # AI 工具
    │   │   │   ├── RichTextRenderer.tsx  # 富文本渲染
    │   │   │   ├── index.ts
    │   │   │   └── MarkdownEditor/      # Markdown 编辑器
    │   │   │       ├── MarkdownEditor.tsx
    │   │   │       ├── MarkdownEditor.types.ts
    │   │   │       ├── MarkdownEditor.utils.ts
    │   │   │       ├── MarkdownEditor.defaults.ts
    │   │   │       ├── MarkdownAITools.tsx
    │   │   │       ├── MarkdownAITools.types.ts
    │   │   │       ├── MarkdownAITools.utils.ts
    │   │   │       └── index.ts
    │   │   ├── Character/     # 角色管理组件
    │   │   ├── Creative/       # 创意功能组件
    │   │   ├── WorldBook/     # 世界书组件
    │   │   ├── MemoryChat/     # 记忆聊天组件
    │   │   ├── Layout/        # 布局组件
    │   │   ├── Settings/       # 设置组件
    │   │   ├── Dashboard/      # 仪表盘组件
    │   │   ├── Plugin/        # 插件组件
    │   │   ├── PromptOptimizer/ # 提示词优化器
    │   │   └── Test/          # 测试组件
    │   ├── stores/            # Zustand 状态库
    │   │   ├── creativeStore.ts
    │   │   ├── characterChatStore.ts
    │   │   ├── settingStore.ts
    │   │   ├── dataStore.ts
    │   │   ├── logStore.ts
    │   │   ├── uiStore.ts
    │   │   └── promptOptimizerStore.ts
    │   ├── services/         # 渲染进程服务
    │   ├── styles/           # 全局样式
    │   ├── types/            # 类型定义
    │   │   ├── electron.d.ts # Electron 类型
    │   │   └── index.ts
    │   └── utils/            # 工具函数
    ├── shared/               # 跨进程共享代码
    │   └── schemas/          # 数据模式
    └── test/                 # 测试文件
        ├── setup.ts
        └── integration/      # 集成测试
```

### 4.2 关键文件说明

#### 主进程关键文件

| 文件路径 | 作用 | 重要性 |
|---------|------|--------|
| src/main/index.ts | Electron 主进程入口 | ⭐⭐⭐ |
| src/main/preload.ts | Preload 脚本，暴露 API | ⭐⭐⭐ |
| src/main/ipc/index.ts | IPC 初始化和路由 | ⭐⭐⭐ |
| src/main/services/storageService.ts | 存储服务 | ⭐⭐⭐ |
| src/main/services/storageManager.ts | 存储管理器 | ⭐⭐⭐ |

#### 渲染进程关键文件

| 文件路径 | 作用 | 重要性 |
|---------|------|--------|
| src/renderer/main.tsx | React 应用入口 | ⭐⭐⭐ |
| src/renderer/App.tsx | 根组件，路由配置 | ⭐⭐⭐ |
| src/renderer/components/Common/DataPersistence.tsx | 数据持久化组件 | ⭐⭐⭐ |
| src/renderer/stores/*.ts | Zustand 状态管理 | ⭐⭐⭐ |
| src/renderer/types/electron.d.ts | Electron API 类型 | ⭐⭐⭐ |

### 4.3 目录职责说明

#### src/main/
**Electron 主进程目录**，包含所有在 Node.js 环境中运行的代码。

- `ipc/`：处理渲染进程请求的 IPC 处理器
- `services/`：业务逻辑层，处理具体功能
- `shared/`：跨进程共享的数据模式

#### src/renderer/
**React 渲染进程目录**，包含所有 UI 相关代码。

- `components/`：React 组件，按功能模块分组
- `stores/`：Zustand 状态管理
- `services/`：渲染进程专用服务
- `styles/`：全局样式和主题
- `types/`：TypeScript 类型定义
- `utils/`：工具函数

#### src/shared/
**跨进程共享代码目录**，包含主进程和渲染进程都可能用到的代码。

#### src/test/
**测试代码目录**，包含单元测试和集成测试。

---

## 5. UI 设计规范

### 5.1 色彩方案

#### 主题色

```css
:root {
  /* 主色调 */
  --color-primary: #1890ff;        /* 主色 - 蓝色 */
  --color-primary-hover: #40a9ff;   /* 主色悬停 */
  --color-primary-active: #096dd9; /* 主色激活 */

  /* 功能色 */
  --color-success: #52c41a;        /* 成功 - 绿色 */
  --color-warning: #faad14;        /* 警告 - 橙色 */
  --color-error: #ff4d4f;          /* 错误 - 红色 */
  --color-info: #1890ff;           /* 信息 - 蓝色 */

  /* 中性色 */
  --color-bg-base: #ffffff;        /* 背景色 */
  --color-bg-layout: #f0f2f5;     /* 布局背景 */
  --color-bg-container: #ffffff;  /* 容器背景 */
  --color-text: #262626;          /* 主文本 */
  --color-text-secondary: #8c8c8c; /* 次要文本 */
  --color-text-tertiary: #bfbfbf; /* 弱化文本 */
  --color-border: #d9d9d9;        /* 边框色 */
  --color-border-secondary: #f0f0f0; /* 次要边框 */
}
```

#### 深色主题（如支持）

```css
[data-theme="dark"] {
  --color-bg-base: #141414;
  --color-bg-layout: #000000;
  --color-bg-container: #1f1f1f;
  --color-text: #e8e8e8;
  --color-text-secondary: #a6a6a6;
  --color-border: #434343;
}
```

### 5.2 字体规范

#### 字体家族

```css
/* 中文优先 */
--font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
               "Helvetica Neue", Arial, "Noto Sans", sans-serif,
               "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji";

/* 代码字体 */
--font-family-code: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono",
                    Consolas, "Courier New", monospace;
```

#### 字号系统

```css
/* 标题字号 */
--font-size-h1: 38px;    /* 一级标题 */
--font-size-h2: 30px;    /* 二级标题 */
--font-size-h3: 24px;    /* 三级标题 */
--font-size-h4: 20px;    /* 四级标题 */
--font-size-h5: 16px;    /* 五级标题 */
--font-size-h6: 14px;    /* 六级标题 */

/* 正文字号 */
--font-size-body: 14px;      /* 正文 */
--font-size-body-small: 12px; /* 小正文 */
--font-size-caption: 12px;    /* 标题 */

/* 代码字号 */
--font-size-code: 13px;      /* 行内代码 */
--font-size-code-block: 13px; /* 代码块 */
```

### 5.3 组件设计标准

#### 按钮规范

```css
/* 主按钮 */
.btn-primary {
  height: 32px;
  padding: 0 16px;
  font-size: 14px;
  border-radius: 6px;
  background-color: var(--color-primary);
  color: #ffffff;
}

/* 次按钮 */
.btn-secondary {
  height: 32px;
  padding: 0 16px;
  font-size: 14px;
  border-radius: 6px;
  background-color: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

/* 危险按钮 */
.btn-danger {
  height: 32px;
  padding: 0 16px;
  font-size: 14px;
  border-radius: 6px;
  background-color: var(--color-error);
  color: #ffffff;
}
```

#### 卡片规范

```css
.card {
  background-color: var(--color-bg-container);
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.card-header {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border-secondary);
}
```

#### 输入框规范

```css
.input {
  height: 32px;
  padding: 0 12px;
  font-size: 14px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  transition: border-color 0.3s;
}

.input:focus {
  border-color: var(--color-primary);
  outline: none;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}
```

### 5.4 响应式布局规则

#### 断点定义

```css
/* 超小屏幕 */
@media (max-width: 575px) {
  /* 手机竖屏 */
}

/* 小屏幕 */
@media (min-width: 576px) and (max-width: 767px) {
  /* 手机横屏 */
}

/* 中等屏幕 */
@media (min-width: 768px) and (max-width: 991px) {
  /* 平板 */
}

/* 大屏幕 */
@media (min-width: 992px) and (max-width: 1199px) {
  /* 小笔记本 */
}

/* 超大屏幕 */
@media (min-width: 1200px) {
  /* 桌面端 */
}
```

#### 栅格系统

- **12 列栅格**
- ** gutters**：24px（列间距）
- **容器最大宽度**：1200px

---

## 6. 环境配置指南

### 6.1 系统要求

#### 最低配置

| 项目 | 要求 |
|------|------|
| 操作系统 | Windows 10+, macOS 10.15+, Ubuntu 18.04+ |
| 处理器 | 1.5 GHz 双核 |
| 内存 | 4 GB RAM |
| 存储 | 500 MB 可用空间 |
| Node.js | 18.0.0+ |

#### 推荐配置

| 项目 | 要求 |
|------|------|
| 操作系统 | Windows 11, macOS 13+ |
| 处理器 | 2.5 GHz 四核 |
| 内存 | 8 GB RAM |
| 存储 | 2 GB 可用空间 |
| Node.js | 20.0.0+ |

### 6.2 开发环境搭建

#### 1. 安装 Node.js

访问 https://nodejs.org/ 下载并安装 LTS 版本。

验证安装：
```bash
node --version  # 应显示 v18.x.x 或更高
npm --version   # 应显示 9.x.x 或更高
```

#### 2. 克隆项目

```bash
git clone https://github.com/lunza/travernManager.git
cd travenManager
```

#### 3. 安装依赖

```bash
npm install
```

#### 4. 配置环境变量（如需要）

创建 `.env` 文件：
```bash
# OpenAI API 配置
OPENAI_API_KEY=your_api_key_here
```

### 6.3 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run electron:dev` | 启动 Electron 开发模式 |
| `npm run build` | 构建生产版本 |
| `npm run electron:build` | 构建 Electron 应用 |
| `npm run lint` | 运行 ESLint 检查 |
| `npm run typecheck` | 运行 TypeScript 类型检查 |
| `npm run test` | 运行测试（开发模式）|
| `npm run test:run` | 运行测试（单次执行）|
| `npm run test:coverage` | 运行测试并生成覆盖率 |

### 6.4 开发工作流

#### 启动开发服务器

```bash
# 方式一：Vite 开发服务器
npm run dev

# 方式二：Electron 开发模式
npm run electron:dev
```

#### 代码检查和格式化

```bash
# 检查代码格式
npm run lint

# 自动修复格式问题
npm run lint -- --fix

# TypeScript 类型检查
npm run typecheck
```

#### 运行测试

```bash
# 运行所有测试
npm run test

# 运行单元测试
npm run test:run

# 运行集成测试
npm run test:integration

# 生成测试覆盖率报告
npm run test:coverage
```

---

## 7. 开发规范

### 7.1 Git 操作规范

#### 分支命名

| 分支类型 | 命名格式 | 示例 |
|---------|---------|------|
| 功能分支 | feature/<功能名> | feature/markdown-editor |
| 修复分支 | fix/<问题描述> | fix/storage-bug |
| 重构分支 | refactor/<模块名> | refactor/storage-layer |
| 发布分支 | release/<版本号> | release/v1.0.0 |

#### 提交信息规范

格式：`<类型>(<范围>): <描述>`

```
feat(storage): add electron-store module isolation
fix(editor): resolve markdown render issue
docs(readme): update installation guide
style(ui): adjust button padding
refactor(api): simplify error handling
test(ai): add unit tests for AIService
chore(deps): upgrade react to 18.3.0
```

#### 常用 Git 命令

```bash
# 创建功能分支
git checkout -b feature/new-feature

# 暂存更改
git add .

# 提交
git commit -m "feat(module): add new functionality"

# 推送到远程
git push origin feature/new-feature

# 创建 Pull Request
gh pr create --title "feat: add new feature" --body "Description"

# 获取最新代码
git pull origin main

# 合并主分支
git merge main
```

### 7.2 代码规范

#### TypeScript 规范

- 使用 `interface` 定义对象类型
- 使用 `type` 定义联合类型、交叉类型
- 避免使用 `any`，使用 `unknown` 代替
- 启用严格模式
- 所有函数参数和返回值必须有类型

#### 命名规范

```typescript
// 变量和函数：camelCase
const userName = 'John';
function getUserInfo() {}

// 类和接口：PascalCase
class UserService {}
interface UserData {}

// 常量：UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3;

// 私有属性：_前缀
private _cacheData = null;

// 组件文件：PascalCase
// UserProfile.tsx, CreativeList.tsx

// 工具函数：camelCase，导出命名空间
export function formatDate() {}
export const DateUtils = {};

// 类型文件：*.types.ts
// 样式文件：*.styles.ts, *.css
```

#### 注释规范

```typescript
/**
 * 函数描述
 * @param paramName - 参数描述
 * @returns 返回值描述
 * @example
 * ```typescript
 * const result = myFunction('input');
 * ```
 */
function myFunction(param: string): string {
  // 单行注释用于解释复杂逻辑
  return param;
}
```

### 7.3 组件编写规范

#### 组件结构

```typescript
// 1. 导入
import React, { useState, useEffect } from 'react';
import { Button, Input } from 'antd';
import type { ComponentProps } from './Component.types';

// 2. 类型定义
interface Props extends ComponentProps {
  title: string;
  onSubmit: (data: SubmitData) => void;
}

// 3. 组件定义
const MyComponent: React.FC<Props> = ({ title, onSubmit, ...props }) => {
  // 4. Hooks
  const [state, setState] = useState(initialValue);

  // 5. 副作用
  useEffect(() => {
    // effect logic
  }, [dependency]);

  // 6. 回调函数
  const handleClick = () => {
    onSubmit({ /* data */ });
  };

  // 7. 渲染
  return (
    <div className="my-component">
      <h2>{title}</h2>
      <Button onClick={handleClick}>Submit</Button>
    </div>
  );
};

// 8. 默认属性
MyComponent.defaultProps = {
  title: 'Default Title',
};

// 9. 导出
export default MyComponent;
```

#### Props 类型定义

```typescript
// Good: 使用 interface
interface ButtonProps {
  type: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

// Good: 使用 type 处理联合类型
type Status = 'idle' | 'loading' | 'success' | 'error';
type ApiResponse<T> = {
  data: T;
  status: Status;
  message?: string;
};
```

---

## 8. 部署流程

### 8.1 生产构建

#### 构建命令

```bash
# 清理旧构建
npm run clean  # 如有

# 构建前端资源
npm run build

# 打包 Electron 应用
npm run electron:build
```

#### 构建输出

构建完成后，生成的文件位于：

```
dist/
├── main/                    # Electron 主进程代码
├── renderer/                # 前端构建产物
└── release/                 # Electron Builder 输出
    └── win-unpacked/        # Windows 便携版
    └── TravenManager Setup.exe  # Windows 安装包
```

### 8.2 打包配置

#### electron-builder.json5

```json5
{
  "appId": "com.travenmanager.app",
  "productName": "TravenManager",
  "directories": {
    "output": "release"
  },
  "win": {
    "target": [
      {
        "target": "nsis",
        "arch": ["x64"]
      }
    ],
    "icon": "build/icon.ico"
  },
  "nsis": {
    "oneClick": false,
    "perMachine": false,
    "allowToChangeInstallationDirectory": true,
    "deleteAppDataOnUninstall": false
  },
  "mac": {
    "target": ["dmg"],
    "icon": "build/icon.icns"
  },
  "linux": {
    "target": ["AppImage"],
    "icon": "build/icon.png"
  }
}
```

### 8.3 应用发布

#### Windows

1. 构建生成 `TravenManager Setup.exe`
2. 双击运行安装程序
3. 按照安装向导完成安装

#### macOS

1. 构建生成 `.dmg` 文件
2. 挂载磁盘镜像
3. 将应用拖入 Applications 文件夹

#### Linux

1. 构建生成 `.AppImage` 文件
2. 添加执行权限：`chmod +x TravenManager.AppImage`
3. 运行：`./TravenManager.AppImage`

---

## 9. 常见问题解决方案

### 9.1 开发环境问题

#### Q: npm install 失败，提示 EINTEGRITY

**问题**：包校验和不匹配

**解决方案**：
```bash
# 清除 npm 缓存
npm cache clean --force

# 删除 node_modules 和 package-lock.json
rm -rf node_modules package-lock.json

# 重新安装
npm install
```

#### Q: TypeScript 类型错误 "Cannot find module"

**问题**：模块类型定义缺失

**解决方案**：
```bash
# 安装类型定义
npm install --save-dev @types/<module-name>

# 或检查 tsconfig.json 的 paths 配置
```

#### Q: Vite 热更新不工作

**问题**：浏览器缓存或配置问题

**解决方案**：
1. 硬刷新页面：`Ctrl + Shift + R`
2. 禁用浏览器缓存
3. 重启开发服务器

### 9.2 构建问题

#### Q: electron-builder 打包失败

**问题**：缺少图标或配置错误

**解决方案**：
1. 检查 `build/` 目录是否存在图标文件
2. 确保 `electron-builder.json5` 配置正确
3. 查看构建日志中的具体错误

#### Q: 构建后应用无法启动

**问题**：资源路径或权限问题

**解决方案**：
1. 检查控制台错误信息
2. 确认所有资源文件已包含在构建中
3. 验证 `package.json` 中的 `main` 字段路径

### 9.3 存储问题

#### Q: electron-store 数据丢失

**问题**：写入失败或路径错误

**解决方案**：
1. 检查应用数据目录权限
2. 确认 electron-store 配置正确
3. 实现数据备份机制

#### Q: 数据迁移失败

**解决方案**：
1. 检查旧数据文件是否存在
2. 备份当前数据
3. 手动执行迁移脚本

### 9.4 AI 服务问题

#### Q: OpenAI API 调用失败

**问题**：API Key 错误或网络问题

**解决方案**：
1. 验证 API Key 配置正确
2. 检查网络连接
3. 查看 API 配额是否用尽
4. 检查错误日志获取详细信息

#### Q: AI 响应超时

**解决方案**：
1. 增加超时配置
2. 检查网络延迟
3. 实现重试机制

---

## 附录

### A. 相关资源

- [Electron 官方文档](https://www.electronjs.org/docs)
- [React 官方文档](https://react.dev)
- [TypeScript 官方文档](https://www.typescriptlang.org/docs/)
- [Vite 官方文档](https://vitejs.dev)
- [Ant Design 官方文档](https://ant.design)
- [Milkdown 官方文档](https://milkdown.dev)
- [Zustand 官方文档](https://zustand.docs.pmnd.rs)

### B. 许可证

本项目采用 MIT 许可证。

### C. 贡献指南

欢迎提交 Pull Request！请确保：

1. 代码通过 ESLint 检查
2. 通过所有单元测试
3. 更新相关文档
4. 提交信息符合规范

---

**文档版本**：1.0.0
**最后更新**：2026-04-25
**维护者**：TravenManager 开发团队
