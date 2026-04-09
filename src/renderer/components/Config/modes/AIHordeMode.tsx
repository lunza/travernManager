import React from 'react';
import { Card, Form, Input } from 'antd';

interface AIHordeModeProps {
  form: any;
}

const AIHordeMode: React.FC<AIHordeModeProps> = ({ form }) => {
  return (
    <Card title="API模式配置" className="api-mode-config-card">
      <Form form={form} layout="vertical">
        <Form.Item label="AI Horde API密钥" name="ai_horde_api_key">
          <Input.Password placeholder="输入AI Horde API密钥（可选）" />
        </Form.Item>
        <Form.Item label="模型名称" name="ai_horde_model">
          <Input placeholder="输入模型名称" />
        </Form.Item>
        <Form.Item label="最大等待时间（秒）" name="ai_horde_max_wait">
          <Input type="number" placeholder="例如: 60" />
        </Form.Item>
        <Form.Item label="优先级" name="ai_horde_priority">
          <Input type="number" min="0" max="100" placeholder="例如: 50" />
        </Form.Item>
      </Form>
    </Card>
  );
};

export default AIHordeMode;