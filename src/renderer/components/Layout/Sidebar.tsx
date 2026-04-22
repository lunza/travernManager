import React from 'react';
import { Layout, Menu, Button, Tooltip } from 'antd';
import {
  DashboardOutlined,
  SettingOutlined,
  BookOutlined,
  UserOutlined,
  ToolOutlined,
  RocketOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  AppstoreOutlined,
  ThunderboltOutlined,
  DatabaseOutlined
} from '@ant-design/icons';
import { useUIStore } from '../../stores/uiStore';
import { AppConfig } from '../../config';
import './Sidebar.css';

const { Sider } = Layout;

const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, sidebarCollapsed, toggleSidebar, theme } = useUIStore();

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: '仪表盘'
    },
    {
      key: 'config',
      icon: <ToolOutlined />,
      label: '配置管理'
    },
    {
      key: 'prompt-optimizer',
      icon: <RocketOutlined />,
      label: '提示词优化'
    },
    {
      key: 'creative',
      icon: <RocketOutlined />,
      label: '创意管理'
    },
    {
      key: 'worldbook',
      icon: <BookOutlined />,
      label: '世界书'
    },
    {
      key: 'avatar',
      icon: <ThunderboltOutlined />,
      label: '用户人设'
    },
    {
      key: 'character',
      icon: <UserOutlined />,
      label: '角色卡'
    },
    {
      key: 'plugin',
      icon: <AppstoreOutlined />,
      label: '插件管理'
    },
    {
      key: 'memory',
      icon: <DatabaseOutlined />,
      label: '记忆管理'
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置'
    }
  ];

  // 根据主题设置背景色
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#141414' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#000000';

  return (
    <Sider
      trigger={null}
      collapsible
      collapsed={sidebarCollapsed}
      className="sidebar"
      theme={isDark ? 'dark' : 'light'}
      width={240}
      style={{ 
        background: bgColor,
        boxShadow: isDark ? '2px 0 8px rgba(0,0,0,0.3)' : '2px 0 8px rgba(0,0,0,0.05)'
      }}
    >
      <div className="sidebar-header" style={{ background: bgColor }}>
        <Tooltip 
          title={
            <div>
              <p>TravenManager: v{AppConfig.version}</p>
              <p>SillyTavern: v1.17.0</p>
            </div>
          } 
          placement="right"
        >
          <div className="sidebar-logo" style={{ cursor: 'pointer' }}>
            {!sidebarCollapsed && (
              <>
                <h2 style={{ color: isDark ? '#40a9ff' : '#1890ff' }}>SillyTaven</h2>
                <p style={{ color: isDark ? '#888' : '#8c8c8c' }}>Manager</p>
              </>
            )}
          </div>
        </Tooltip>
        <Tooltip title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'} placement="right">
          <Button
            type="text"
            icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={toggleSidebar}
            className="sidebar-toggle-btn"
            style={{ color: isDark ? '#aaa' : '#666' }}
          />
        </Tooltip>
      </div>
      <Menu
        mode="inline"
        selectedKeys={[activeTab]}
        items={menuItems}
        onClick={({ key }) => setActiveTab(key as any)}
        className="sidebar-menu"
        theme={isDark ? 'dark' : 'light'}
        style={{ background: bgColor, borderRight: 'none' }}
      />
    </Sider>
  );
};

export default Sidebar;
