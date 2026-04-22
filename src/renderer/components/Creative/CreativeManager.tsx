import React, { useEffect } from 'react';
import { Layout, Typography, Divider, Space, Button, message, Modal, Alert } from 'antd';
import { RocketOutlined, FileTextOutlined, FolderOutlined, DownloadOutlined, UploadOutlined, ReloadOutlined } from '@ant-design/icons';
import { useCreativeStore } from '../../stores/creativeStore';
import CreativeTreeView from './CreativeTreeView';
import CharacterCardEditor from './CharacterCardEditor';
import WorldBookEditor from './WorldBookEditor';
import CreativeDetail from './CreativeDetail';
import CharacterTestChat from './CharacterTestChat';
import './CreativeManager.css';

const { Title, Text } = Typography;
const { Sider, Content } = Layout;

const CreativeManager: React.FC = () => {
  const {
    creatives,
    currentCreativeId,
    currentEditorTarget,
    loadCreatives,
    saveCreatives,
    exportData,
    importData,
    migrateOldData
  } = useCreativeStore();

  const [isMigrateModalOpen, setIsMigrateModalOpen] = React.useState(false);

  useEffect(() => {
    loadCreatives();
  }, []);

  // 导出数据
  const handleExportData = async () => {
    try {
      const data = await exportData();
      if (data) {
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `creative-manager-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        message.success('数据导出成功');
      }
    } catch (error) {
      message.error('数据导出失败');
      console.error(error);
    }
  };

  // 导入数据
  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        try {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const result = event.target?.result as string;
            if (result) {
              await importData(result);
              await loadCreatives();
              message.success('数据导入成功');
            }
          };
          reader.readAsText(target.files[0]);
        } catch (error) {
          message.error('数据导入失败');
          console.error(error);
        }
      }
    };
    input.click();
  };

  // 数据迁移
  const handleMigrateData = async () => {
    try {
      const result = await migrateOldData();
      if (result.success) {
        message.success('数据迁移成功');
        await loadCreatives();
      } else {
        message.warning(result.error || '没有需要迁移的数据');
      }
    } catch (error) {
      message.error('数据迁移失败');
      console.error(error);
    } finally {
      setIsMigrateModalOpen(false);
    }
  };

  // 渲染编辑器
  const renderEditor = () => {
    if (!currentEditorTarget) {
      if (currentCreativeId) {
        // 选中了创意，显示创意编辑页面
        return <CreativeDetail />;
      }
      return (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <Alert
            message="提示"
            description="请从左侧树形视图中选择一个创意、角色卡或世界书进行编辑"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          {creatives.length === 0 && (
            <Space direction="vertical" style={{ width: '100%', maxWidth: 400 }}>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={() => setIsMigrateModalOpen(true)}
              >
                迁移旧数据
              </Button>
              <Text type="secondary">
                如果您之前创建过内容，可以点击此按钮迁移旧数据
              </Text>
            </Space>
          )}
        </div>
      );
    }

    if (currentEditorTarget.type === 'character') {
      // 角色卡：编辑器 + 测试聊天并排显示
      return (
        <div style={{ display: 'flex', height: '100%' }}>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <CharacterCardEditor characterId={currentEditorTarget.id} />
          </div>
          <div style={{ width: '500px', flexShrink: 0, height: '100%' }}>
            <CharacterTestChat 
              creativeId={currentCreativeId!} 
              characterId={currentEditorTarget.id} 
            />
          </div>
        </div>
      );
    } else {
      // 世界书：只有编辑器
      return <WorldBookEditor worldbookId={currentEditorTarget.id} />;
    }
  };

  return (
    <Layout className="creative-manager-layout" style={{ height: '100%' }}>
      <Sider width={300} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
        <CreativeTreeView />
      </Sider>

      <Layout className="creative-manager-content">
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
                <RocketOutlined style={{ marginRight: 8 }} /> 创意管理
              </Title>
              <Text type="secondary">
                基于已连接的大模型，智能生成和优化角色卡与世界书内容
              </Text>
            </div>
            <Space>
              <Button icon={<DownloadOutlined />} onClick={handleExportData}>
                导出
              </Button>
              <Button icon={<UploadOutlined />} onClick={handleImportData}>
                导入
              </Button>
            </Space>
          </div>
        </div>

        <Content style={{ flex: 1, overflow: 'auto', padding: 0 }}>
          {renderEditor()}
        </Content>
      </Layout>

      {/* 数据迁移确认弹窗 */}
      <Modal
        title="数据迁移"
        open={isMigrateModalOpen}
        onOk={handleMigrateData}
        onCancel={() => setIsMigrateModalOpen(false)}
        okText="迁移"
        cancelText="取消"
      >
        <p>这将把您之前创建的旧数据迁移到新的架构中。</p>
        <p>迁移完成后，旧数据将自动备份。</p>
      </Modal>
    </Layout>
  );
};

export default CreativeManager;
