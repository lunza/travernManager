import React from 'react';
import { Layout, Button, Space, Badge } from 'antd';
import { MoonOutlined, SunOutlined, ReloadOutlined } from '@ant-design/icons';
import { useUIStore } from '../../stores/uiStore';
import './Header.css';

const { Header: AntHeader } = Layout;

const Header: React.FC = () => {
  const { theme, setTheme } = useUIStore();

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <AntHeader className="app-header">
      <div className="header-left">
        <h1>SillyTaven 配置管理器</h1>
      </div>
      <div className="header-right">
        <Space>
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={() => window.location.reload()}
          >
            刷新
          </Button>
          <Button
            type="text"
            icon={theme === 'light' ? <MoonOutlined /> : <SunOutlined />}
            onClick={toggleTheme}
          >
            {theme === 'light' ? '暗色' : '亮色'}
          </Button>
        </Space>
      </div>
    </AntHeader>
  );
};

export default Header;
