import React, { useState } from 'react';
import { Tree, Button, Space, Dropdown, Modal, Input, Form, message } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  FolderOutlined,
  UserOutlined,
  BookOutlined,
  MoreOutlined
} from '@ant-design/icons';
import type { DataNode, TreeProps } from 'antd/es/tree';
import { useCreativeStore } from '../../stores/creativeStore';

interface CreativeTreeViewProps {
  // 可以添加需要的props
}

const CreativeTreeView: React.FC<CreativeTreeViewProps> = () => {
  const {
    creatives,
    currentCreativeId,
    currentEditorTarget,
    addCreative,
    setCurrentCreativeId,
    setCurrentEditorTarget,
    addCharacterCard,
    addWorldBook,
    deleteCreative,
    deleteCharacterCard,
    deleteWorldBook
  } = useCreativeStore();

  const [isAddCreativeModalOpen, setIsAddCreativeModalOpen] = useState(false);
  const [isAddCharacterModalOpen, setIsAddCharacterModalOpen] = useState(false);
  const [isAddWorldBookModalOpen, setIsAddWorldBookModalOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string[]>([]);
  const [creativeForm] = Form.useForm();
  const [characterForm] = Form.useForm();
  const [worldbookForm] = Form.useForm();

  // 构建树形数据
  const buildTreeData = (): DataNode[] => {
    return creatives.map(creative => {
      const children: DataNode[] = [];

      // 添加角色卡节点
      if (creative.characterCards.length > 0) {
        children.push({
          key: `character-folder-${creative.id}`,
          title: '角色卡',
          icon: <UserOutlined />,
          selectable: false,
          children: creative.characterCards.map(character => ({
            key: `character-${character.id}`,
            title: character.name,
            icon: <UserOutlined />
          }))
        });
      }

      // 添加世界书节点
      if (creative.worldBooks.length > 0) {
        children.push({
          key: `worldbook-folder-${creative.id}`,
          title: '世界书',
          icon: <BookOutlined />,
          selectable: false,
          children: creative.worldBooks.map(worldBook => ({
            key: `worldbook-${worldBook.id}`,
            title: worldBook.name,
            icon: <BookOutlined />
          }))
        });
      }

      return {
        key: `creative-${creative.id}`,
        title: creative.title,
        icon: <FolderOutlined />,
        children: children.length > 0 ? children : undefined
      };
    });
  };

  // 处理选中事件
  const handleSelect: TreeProps['onSelect'] = (selectedKeys, info) => {
    if (selectedKeys.length > 0) {
      const key = selectedKeys[0];
      setSelectedKey(selectedKeys);

      if (key.startsWith('creative-')) {
        // 选中创意
        const creativeId = key.replace('creative-', '');
        setCurrentCreativeId(creativeId);
        setCurrentEditorTarget(null);
      } else if (key.startsWith('character-')) {
        // 选中角色卡
        const characterId = key.replace('character-', '');
        const creative = creatives.find(c => c.characterCards.some(cc => cc.id === characterId));
        if (creative) {
          setCurrentCreativeId(creative.id);
          setCurrentEditorTarget({ type: 'character', id: characterId });
        }
      } else if (key.startsWith('worldbook-')) {
        // 选中世界书
        const worldbookId = key.replace('worldbook-', '');
        const creative = creatives.find(c => c.worldBooks.some(wb => wb.id === worldbookId));
        if (creative) {
          setCurrentCreativeId(creative.id);
          setCurrentEditorTarget({ type: 'worldbook', id: worldbookId });
        }
      }
    }
  };

  // 处理删除创意
  const handleDeleteCreative = (creativeId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个创意吗？所有关联的角色卡和世界书也将被删除。',
      onOk: () => {
        deleteCreative(creativeId);
        message.success('创意已删除');
      }
    });
  };

  // 处理删除角色卡
  const handleDeleteCharacter = (creativeId: string, characterId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个角色卡吗？',
      onOk: () => {
        deleteCharacterCard(creativeId, characterId);
        if (currentEditorTarget?.id === characterId) {
          setCurrentEditorTarget(null);
        }
        message.success('角色卡已删除');
      }
    });
  };

  // 处理删除世界书
  const handleDeleteWorldBook = (creativeId: string, worldbookId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个世界书吗？',
      onOk: () => {
        deleteWorldBook(creativeId, worldbookId);
        if (currentEditorTarget?.id === worldbookId) {
          setCurrentEditorTarget(null);
        }
        message.success('世界书已删除');
      }
    });
  };

  // 自定义树节点渲染
  const renderTreeNode = (node: DataNode) => {
    let menuItems = [];

    if (node.key.startsWith('creative-')) {
      const creativeId = node.key.replace('creative-', '');
      menuItems = [
        {
          key: 'add-character',
          icon: <UserOutlined />,
          label: '添加角色卡',
          onClick: () => {
            setCurrentCreativeId(creativeId);
            setIsAddCharacterModalOpen(true);
          }
        },
        {
          key: 'add-worldbook',
          icon: <BookOutlined />,
          label: '添加世界书',
          onClick: () => {
            setCurrentCreativeId(creativeId);
            setIsAddWorldBookModalOpen(true);
          }
        },
        { type: 'divider' as const },
        {
          key: 'delete',
          icon: <DeleteOutlined />,
          label: '删除',
          onClick: () => handleDeleteCreative(creativeId),
          danger: true
        }
      ];
    } else if (node.key.startsWith('character-')) {
      const characterId = node.key.replace('character-', '');
      const creative = creatives.find(c => c.characterCards.some(cc => cc.id === characterId));
      menuItems = creative ? [
        {
          key: 'delete',
          icon: <DeleteOutlined />,
          label: '删除',
          onClick: () => handleDeleteCharacter(creative.id, characterId),
          danger: true
        }
      ] : [];
    } else if (node.key.startsWith('worldbook-')) {
      const worldbookId = node.key.replace('worldbook-', '');
      const creative = creatives.find(c => c.worldBooks.some(wb => wb.id === worldbookId));
      menuItems = creative ? [
        {
          key: 'delete',
          icon: <DeleteOutlined />,
          label: '删除',
          onClick: () => handleDeleteWorldBook(creative.id, worldbookId),
          danger: true
        }
      ] : [];
    }

    return (
      <Space>
        <span>{node.title}</span>
        {menuItems.length > 0 && (
          <Dropdown menu={{ items: menuItems }} trigger={['click']}>
            <Button type="text" icon={<MoreOutlined />} size="small" />
          </Dropdown>
        )}
      </Space>
    );
  };

  // 添加创意
  const handleAddCreative = async (values: { title: string; description: string }) => {
    addCreative(values.title, values.description);
    setIsAddCreativeModalOpen(false);
    creativeForm.resetFields();
    message.success('创意创建成功');
  };

  // 添加角色卡
  const handleAddCharacter = async (values: { name: string }) => {
    if (!currentCreativeId) {
      message.error('请先选择一个创意');
      return;
    }
    addCharacterCard(currentCreativeId, values.name);
    setIsAddCharacterModalOpen(false);
    characterForm.resetFields();
    message.success('角色卡创建成功');
  };

  // 添加世界书
  const handleAddWorldBook = async (values: { name: string }) => {
    if (!currentCreativeId) {
      message.error('请先选择一个创意');
      return;
    }
    addWorldBook(currentCreativeId, values.name);
    setIsAddWorldBookModalOpen(false);
    worldbookForm.resetFields();
    message.success('世界书创建成功');
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsAddCreativeModalOpen(true)}
          style={{ width: '100%' }}
        >
          新建创意
        </Button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <Tree
          showIcon
          defaultExpandAll
          onSelect={handleSelect}
          selectedKeys={selectedKey}
          treeData={buildTreeData()}
          titleRender={renderTreeNode}
        />
      </div>

      {/* 添加创意弹窗 */}
      <Modal
        title="新建创意"
        open={isAddCreativeModalOpen}
        onCancel={() => {
          setIsAddCreativeModalOpen(false);
          creativeForm.resetFields();
        }}
        onOk={() => creativeForm.submit()}
      >
        <Form form={creativeForm} onFinish={handleAddCreative} layout="vertical">
          <Form.Item
            name="title"
            label="创意名称"
            rules={[{ required: true, message: '请输入创意名称' }]}
          >
            <Input placeholder="请输入创意名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入创意描述" rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 添加角色卡弹窗 */}
      <Modal
        title="添加角色卡"
        open={isAddCharacterModalOpen}
        onCancel={() => {
          setIsAddCharacterModalOpen(false);
          characterForm.resetFields();
        }}
        onOk={() => characterForm.submit()}
      >
        <Form form={characterForm} onFinish={handleAddCharacter} layout="vertical">
          <Form.Item
            name="name"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input placeholder="请输入角色名称" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 添加世界书弹窗 */}
      <Modal
        title="添加世界书"
        open={isAddWorldBookModalOpen}
        onCancel={() => {
          setIsAddWorldBookModalOpen(false);
          worldbookForm.resetFields();
        }}
        onOk={() => worldbookForm.submit()}
      >
        <Form form={worldbookForm} onFinish={handleAddWorldBook} layout="vertical">
          <Form.Item
            name="name"
            label="世界书名称"
            rules={[{ required: true, message: '请输入世界书名称' }]}
          >
            <Input placeholder="请输入世界书名称" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CreativeTreeView;
