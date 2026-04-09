import React from 'react';
import { Card, Form, Input, Select } from 'antd';

interface NovelAIModeProps {
  form: any;
}

const NovelAIMode: React.FC<NovelAIModeProps> = ({ form }) => {
  const { Option } = Select;
  
  return (
    <Card title="API模式配置" className="api-mode-config-card">
      <Form form={form} layout="vertical">
        <Form.Item label="NovelAI API密钥" name="novelai_api_key">
          <Input.Password placeholder="输入NovelAI API密钥" />
        </Form.Item>
        <Form.Item label="模型" name="novelai_model">
          <Select style={{ width: '100%' }}>
            <Option value="krake-v2">Krake v2</Option>
            <Option value="krake-v1">Krake v1</Option>
            <Option value="euterpe-v2">Euterpe v2</Option>
          </Select>
        </Form.Item>
        <Form.Item label="采样器" name="novelai_sampler">
          <Select style={{ width: '100%' }}>
            <Option value="k_dpm_2">k_dpm_2</Option>
            <Option value="k_dpm_2_ancestral">k_dpm_2_ancestral</Option>
            <Option value="k_euler">k_euler</Option>
            <Option value="k_euler_ancestral">k_euler_ancestral</Option>
          </Select>
        </Form.Item>
        <Form.Item label="CFG Scale" name="novelai_cfg_scale">
          <Input type="number" step="0.1" min="0.1" max="10.0" placeholder="例如: 7.0" />
        </Form.Item>
      </Form>
    </Card>
  );
};

export default NovelAIMode;