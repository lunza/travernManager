import React from 'react';
import { Card, Form, Input, Space, Tooltip, Button, Switch } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';

interface TextCompletionModeProps {
  form: any;
  optimizing: boolean;
  customOptimizationEnabled: boolean;
  setCustomOptimizationEnabled: (value: boolean) => void;
  handleOptimizePrompt: () => void;
}

const TextCompletionMode: React.FC<TextCompletionModeProps> = ({
  form,
  optimizing,
  customOptimizationEnabled,
  setCustomOptimizationEnabled,
  handleOptimizePrompt
}) => {
  return (
    <Card title="API模式配置" className="api-mode-config-card">
      <Form form={form} layout="vertical">
        <Form.Item 
          label="提示模板"
          name="prompt_template"
        >
          <Input.TextArea rows={3} placeholder="输入文本补全的提示模板" />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button 
              type="primary" 
              onClick={handleOptimizePrompt} 
              loading={optimizing}
              disabled={!form.getFieldValue('prompt_template')}
            >
              AI优化提示模板
            </Button>
            <Tooltip title="启用自定义优化说明">
              <Switch 
                checked={customOptimizationEnabled}
                onChange={setCustomOptimizationEnabled}
              />
            </Tooltip>
          </Space>
        </Form.Item>
        {customOptimizationEnabled && (
          <Form.Item 
            label="自定义优化说明"
            name="custom_optimization_prompt"
          >
            <Input.TextArea rows={4} placeholder="输入自定义优化说明" />
          </Form.Item>
        )}
        <Form.Item label="停止词" name="stop_words">
          <Input placeholder="逗号分隔的停止词列表" />
        </Form.Item>
        <Form.Item label="最大生成长度" name="max_generation_length">
          <Input type="number" placeholder="例如: 1024" />
        </Form.Item>
      </Form>
    </Card>
  );
};

export default TextCompletionMode;