import React, { useEffect, useState } from 'react';
import { Card, Tabs, Button, Space, Typography, Divider, Tag, Badge, message, Empty } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  RocketOutlined,
  FileTextOutlined,
  HistoryOutlined,
  CheckOutlined,
  SaveOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import MDEditor from '@uiw/react-md-editor';
import { useCreativeStore } from '../../stores/creativeStore';
import { useUIStore } from '../../stores/uiStore';
import CreativeInput from './CreativeInput';
import CreativeGenerate from './CreativeGenerate';
import CreativeOptimize from './CreativeOptimize';
import CreativeFormat from './CreativeFormat';
import CreativeHistory from './CreativeHistory';
import CreativeList from './CreativeList';
import './CreativeManager.css';

const { TabPane } = Tabs;
const { Text, Title } = Typography;

const CreativeManager: React.FC = () => {
  const { theme } = useUIStore();
  const { 
    loadCreatives,
    exportData,
    importData,
    currentCreativeId,
    getCurrentCreative,
    updateCreative
  } = useCreativeStore();
  
  const currentCreative = getCurrentCreative();
  const [editingContent, setEditingContent] = useState<string>(currentCreative?.content || '');

  useEffect(() => {
    loadCreatives();
  }, []);

  useEffect(() => {
    if (currentCreative) {
      setEditingContent(currentCreative.content || '');
    } else {
      setEditingContent('');
    }
  }, [currentCreative]);

  const handleExportData = () => {
    const data = exportData();
    if (data) {
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `creative-manager-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          importData(result);
        };
        reader.readAsText(target.files[0]);
      }
    };
    input.click();
  };

  const handleSaveCreative = () => {
    if (currentCreativeId) {
      updateCreative(currentCreativeId, { content: editingContent });
      message.success('创意内容已更新！');
    } else {
      message.error('请先选择或创建一个创意！');
    }
  };

  return (
    <div className={`creative-manager ${theme === 'dark' ? 'dark-theme' : 'light-theme'}`}>
      <div className="creative-manager-header">
        <Title level={2} style={{ marginBottom: 0, color: theme === 'dark' ? '#40a9ff' : '#1890ff' }}>
          <RocketOutlined style={{ marginRight: 8 }} /> 创意管理
        </Title>
        <Text type="secondary">
          基于已连接的大模型，智能生成和优化角色卡与世界书内容
        </Text>
      </div>

      <Divider />

      <Tabs defaultActiveKey="list" className="creative-manager-tabs">
        <TabPane tab={<><FileTextOutlined /> 创意列表</>} key="list">
          <CreativeList />
        </TabPane>
        <TabPane tab={<><PlusOutlined /> 新增创意</>} key="input">
          <CreativeInput />
        </TabPane>
        {currentCreativeId && (
          <>
            <TabPane tab={<><RocketOutlined /> 智能生成</>} key="generate">
              <CreativeGenerate />
            </TabPane>
            <TabPane tab={<><EditOutlined /> 多轮优化</>} key="optimize">
              <CreativeOptimize />
            </TabPane>
            <TabPane tab={<><CheckOutlined /> 格式规范</>} key="format">
              <CreativeFormat />
            </TabPane>
            <TabPane tab={<><HistoryOutlined /> 历史记录</>} key="history">
              <CreativeHistory />
            </TabPane>
          </>
        )}
      </Tabs>

      {currentCreative && (
        <>
          <Divider />
          <Card className="current-creative-card" size="small">
            <div className="current-creative-header">
              <Text strong>当前创意: {currentCreative.title}</Text>
              <Space size="small">
                <Tag color={currentCreative.type === 'character' ? 'blue' : 'green'}>
                  {currentCreative.type === 'character' ? '角色卡' : '世界书'}
                </Tag>
                <Tag color={
                  currentCreative.status === 'draft' ? 'blue' :
                  currentCreative.status === 'in_progress' ? 'orange' : 'green'
                }>
                  {currentCreative.status === 'draft' ? '草稿' :
                   currentCreative.status === 'in_progress' ? '进行中' : '已完成'}
                </Tag>
                <Badge count={editingContent.length} showZero style={{ backgroundColor: theme === 'dark' ? '#40a9ff' : '#1890ff' }} />
                <Button 
                  type="link" 
                  size="small" 
                  onClick={() => navigator.clipboard.writeText(editingContent)}
                >
                  复制
                </Button>
                <Button 
                  type="primary" 
                  size="small" 
                  icon={<SaveOutlined />}
                  onClick={handleSaveCreative}
                >
                  保存
                </Button>
              </Space>
            </div>
            <div className="current-creative-content">
              <MDEditor
                value={editingContent}
                onChange={setEditingContent}
                height={200}
                preview="edit"
                dark={theme === 'dark'}
              />
            </div>
            <div className="current-creative-footer" style={{ marginTop: 16 }}>
              <Text type="secondary">
                创建时间: {new Date(currentCreative.createdAt).toLocaleString()} | 
                更新时间: {new Date(currentCreative.updatedAt).toLocaleString()}
              </Text>
            </div>
          </Card>
        </>
      )}

      <Divider />

      <div className="creative-manager-footer">
        <Space>
          <Button 
            icon={<FileTextOutlined />} 
            onClick={handleExportData}
          >
            导出数据
          </Button>
          <Button 
            icon={<PlusOutlined />} 
            onClick={handleImportData}
          >
            导入数据
          </Button>
        </Space>
        <Text type="secondary">
          提示：该模块需要已连接的大模型才能正常工作
        </Text>
      </div>
    </div>
  );
};

export default CreativeManager;