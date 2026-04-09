/**
 * 记忆插件主管理组件
 * 整合表格模板管理和聊天记录管理功能
 */

import React, { useState } from 'react';
import { Tabs } from 'antd';
import {
  FileTextOutlined,
  CommentOutlined
} from '@ant-design/icons';
import MemoryTemplateManager from './TemplateManager';
import ChatManager from './ChatManager';
import './MemoryChatManager.css';

const MemoryChatManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState('templates');

  const tabItems = [
    {
      key: 'templates',
      label: '表格模板管理',
      icon: <FileTextOutlined />,
      children: <MemoryTemplateManager />
    },
    {
      key: 'chats',
      label: '聊天记录管理',
      icon: <CommentOutlined />,
      children: <ChatManager />
    }
  ];

  return (
    <div className="memory-chat-manager-container">
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        type="card"
      />
    </div>
  );
};

export default MemoryChatManager;
