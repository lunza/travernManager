import React from 'react';
import { Card, Form, Input, Space, Tooltip, Switch, Button, List, Modal, message } from 'antd';
import { QuestionCircleOutlined, PlusOutlined, MinusOutlined, EditOutlined } from '@ant-design/icons';

// 简单的转义函数，用于处理{{}}格式的通配符
const escapeBraces = (text: string): string => {
  return text
    .replace(/\{\{/g, "{'{{'}")
    .replace(/\}\}/g, "{'}}'");
};

interface ChatCompletionModeProps {
  form: any;
}

interface PromptItem {
  identifier: string;
  system_prompt: boolean;
  role: string;
  name: string;
  content: string;
}

const ChatCompletionMode: React.FC<ChatCompletionModeProps> = ({ form }) => {
  const [promptModalVisible, setPromptModalVisible] = React.useState(false);
  const [editingPrompt, setEditingPrompt] = React.useState<PromptItem | null>(null);
  const [editingIndex, setEditingIndex] = React.useState<number>(-1);

  const handleAddPrompt = () => {
    const prompts = form.getFieldValue('prompts') || [];
    const newPrompt: PromptItem = {
      identifier: `prompt_${Date.now()}`,
      system_prompt: false,
      role: 'system',
      name: 'New Prompt',
      content: ''
    };
    form.setFieldsValue({ prompts: [...prompts, newPrompt] });
  };

  const handleEditPrompt = (index: number) => {
    const prompts = form.getFieldValue('prompts') || [];
    setEditingPrompt({ ...prompts[index] });
    setEditingIndex(index);
    setPromptModalVisible(true);
  };

  const handleDeletePrompt = (index: number) => {
    const prompts = form.getFieldValue('prompts') || [];
    prompts.splice(index, 1);
    form.setFieldsValue({ prompts });
  };

  const handleSavePrompt = () => {
    if (editingPrompt && editingIndex >= 0) {
      const prompts = form.getFieldValue('prompts') || [];
      prompts[editingIndex] = { ...editingPrompt };
      form.setFieldsValue({ prompts });
      setPromptModalVisible(false);
      setEditingPrompt(null);
      setEditingIndex(-1);
      message.success('Prompt saved successfully');
    }
  };

  return (
    <Card title="API模式配置" className="api-mode-config-card">
      <Form form={form} layout="vertical">
        {/* 基础参数 */}
        <Form.Item 
          label={
            <Space>
              温度 (temperature)
              <Tooltip 
                title={
                  <div>
                    <p><strong>功能</strong>：控制token选择的随机性</p>
                    <p><strong>影响</strong>：值越高，输出越随机、创意性越强；值越低，输出越可预测、保守</p>
                    <p><strong>建议范围</strong>：0.1-1.0，默认1.0</p>
                  </div>
                }
                placement="top"
                arrow
              >
                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          } 
          name="temperature"
        >
          <Input type="number" step="0.1" min="0" max="2" placeholder="例如: 1" />
        </Form.Item>
        <Form.Item 
          label={
            <Space>
              频率惩罚 (frequency_penalty)
              <Tooltip 
                title={
                  <div>
                    <p><strong>功能</strong>：惩罚频繁出现的token</p>
                    <p><strong>影响</strong>：值越高，越抑制重复词汇的使用</p>
                    <p><strong>建议范围</strong>：-2.0到2.0，默认0</p>
                  </div>
                }
                placement="top"
                arrow
              >
                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          } 
          name="frequency_penalty"
        >
          <Input type="number" step="0.1" min="-2.0" max="2.0" placeholder="例如: 0" />
        </Form.Item>
        <Form.Item 
          label={
            <Space>
              存在惩罚 (presence_penalty)
              <Tooltip 
                title={
                  <div>
                    <p><strong>功能</strong>：惩罚新token的使用</p>
                    <p><strong>影响</strong>：值越高，越倾向于使用已存在的token</p>
                    <p><strong>建议范围</strong>：-2.0到2.0，默认0</p>
                  </div>
                }
                placement="top"
                arrow
              >
                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          } 
          name="presence_penalty"
        >
          <Input type="number" step="0.1" min="-2.0" max="2.0" placeholder="例如: 0" />
        </Form.Item>
        <Form.Item 
          label={
            <Space>
              顶级P (top_p)
              <Tooltip 
                title={
                  <div>
                    <p><strong>功能</strong>：控制token选择的多样性（核采样）</p>
                    <p><strong>影响</strong>：值越高，考虑的token越多，输出越多样；值越低，只考虑高概率token，输出越集中</p>
                    <p><strong>建议范围</strong>：0.7-1.0，默认1.0</p>
                  </div>
                }
                placement="top"
                arrow
              >
                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          } 
          name="top_p"
        >
          <Input type="number" step="0.1" min="0" max="1.0" placeholder="例如: 1" />
        </Form.Item>
        <Form.Item 
          label={
            <Space>
              顶级K (top_k)
              <Tooltip 
                title={
                  <div>
                    <p><strong>功能</strong>：限制每次选择的token数量</p>
                    <p><strong>影响</strong>：值越高，考虑的token越多，输出越多样；值越低，只考虑最可能的token，输出越集中</p>
                    <p><strong>建议范围</strong>：0-100，默认0（禁用）</p>
                  </div>
                }
                placement="top"
                arrow
              >
                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          } 
          name="top_k"
        >
          <Input type="number" min="0" placeholder="例如: 0" />
        </Form.Item>
        <Form.Item 
          label={
            <Space>
              顶级A (top_a)
              <Tooltip 
                title={
                  <div>
                    <p><strong>功能</strong>：通过绝对值切断低概率token</p>
                    <p><strong>影响</strong>：值越高，过滤掉的低概率token越多</p>
                    <p><strong>建议范围</strong>：0-1.0，默认0（禁用）</p>
                  </div>
                }
                placement="top"
                arrow
              >
                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          } 
          name="top_a"
        >
          <Input type="number" step="0.1" min="0" max="1.0" placeholder="例如: 0" />
        </Form.Item>
        <Form.Item 
          label={
            <Space>
              最小P (min_p)
              <Tooltip 
                title={
                  <div>
                    <p><strong>功能</strong>：通过相对于最高token切断低概率token来限制token池</p>
                    <p><strong>影响</strong>：值越高，过滤掉的低概率token越多，输出越连贯但可能更重复</p>
                    <p><strong>建议范围</strong>：0.01-0.2，默认0</p>
                  </div>
                }
                placement="top"
                arrow
              >
                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          } 
          name="min_p"
        >
          <Input type="number" step="0.01" min="0" max="1.0" placeholder="例如: 0" />
        </Form.Item>
        <Form.Item 
          label={
            <Space>
              重复惩罚 (repetition_penalty)
              <Tooltip 
                title={
                  <div>
                    <p><strong>功能</strong>：惩罚上下文中已出现的token</p>
                    <p><strong>影响</strong>：值越高，越抑制重复；值越低，允许更多重复</p>
                    <p><strong>建议范围</strong>：1.0-1.2，默认1.0</p>
                  </div>
                }
                placement="top"
                arrow
              >
                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          } 
          name="repetition_penalty"
        >
          <Input type="number" step="0.1" min="0" max="2.0" placeholder="例如: 1" />
        </Form.Item>
        <Form.Item 
          label={
            <Space>
              OpenAI最大上下文 (openai_max_context)
              <Tooltip 
                title={
                  <div>
                    <p><strong>功能</strong>：设置OpenAI模型的最大上下文长度</p>
                    <p><strong>影响</strong>：值越大，模型可以处理的上下文越长，但可能会增加API调用成本</p>
                    <p><strong>建议值</strong>：根据模型类型设置，默认4095</p>
                  </div>
                }
                placement="top"
                arrow
              >
                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          } 
          name="openai_max_context"
        >
          <Input type="number" placeholder="例如: 4095" />
        </Form.Item>
        <Form.Item 
          label={
            <Space>
              OpenAI最大Token数 (openai_max_tokens)
              <Tooltip 
                title={
                  <div>
                    <p><strong>功能</strong>：设置OpenAI模型的最大生成Token数</p>
                    <p><strong>影响</strong>：值越大，生成的内容越长，但可能会增加API调用成本</p>
                    <p><strong>建议值</strong>：根据需要设置，默认300</p>
                  </div>
                }
                placement="top"
                arrow
              >
                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          } 
          name="openai_max_tokens"
        >
          <Input type="number" placeholder="例如: 300" />
        </Form.Item>
        <Form.Item 
          label={
            <Space>
              名称行为 (names_behavior)
              <Tooltip 
                title={
                  <div>
                    <p><strong>功能</strong>：控制名称在生成内容中的行为</p>
                    <p><strong>影响</strong>：不同的值会影响名称的处理方式</p>
                    <p><strong>建议值</strong>：0-1，默认0</p>
                  </div>
                }
                placement="top"
                arrow
              >
                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          } 
          name="names_behavior"
        >
          <Input type="number" placeholder="例如: 0" />
        </Form.Item>
        <Form.Item 
          label={
            <Space>
              空发送内容 (send_if_empty)
              <Tooltip 
                title={
                  <div>
                    <p><strong>功能</strong>：当用户输入为空时发送的内容</p>
                    <p><strong>影响</strong>：设置用户空输入时的默认行为</p>
                    <p><strong>建议值</strong>：根据需要设置，默认空字符串</p>
                  </div>
                }
                placement="top"
                arrow
              >
                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          } 
          name="send_if_empty"
        >
          <Input placeholder="例如: " />
        </Form.Item>

        {/* 聊天相关参数 */}
        <Form.Item 
          label={
            <Space>
              助手预填充 (assistant_prefill)
              <Tooltip 
                title={
                  <div>
                    <p><strong>功能</strong>：助手回复的预填充内容</p>
                    <p><strong>影响</strong>：设置助手回复的初始内容</p>
                    <p><strong>建议值</strong>：根据需要设置，默认空字符串</p>
                  </div>
                }
                placement="top"
                arrow
              >
                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          } 
          name="assistant_prefill"
        >
          <Input placeholder="例如: " />
        </Form.Item>
        <Form.Item 
          label={
            <Space>
              助手模拟 (assistant_impersonation)
              <Tooltip 
                title={
                  <div>
                    <p><strong>功能</strong>：助手模拟用户的内容</p>
                    <p><strong>影响</strong>：设置助手如何模拟用户的风格和语气</p>
                    <p><strong>建议值</strong>：根据需要设置，默认空字符串</p>
                  </div>
                }
                placement="top"
                arrow
              >
                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          } 
          name="assistant_impersonation"
        >
          <Input placeholder="例如: " />
        </Form.Item>
        <Form.Item 
          label={
            <Space>
              使用系统提示 (use_sysprompt)
              <Tooltip 
                title={
                  <div>
                    <p><strong>功能</strong>：控制是否使用系统提示</p>
                    <p><strong>影响</strong>：开启时使用系统提示，关闭时不使用</p>
                    <p><strong>建议值</strong>：根据需要设置，默认false</p>
                  </div>
                }
                placement="top"
                arrow
              >
                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          } 
          name="use_sysprompt" 
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item 
          label={
            <Space>
              压缩系统消息 (squash_system_messages)
              <Tooltip 
                title={
                  <div>
                    <p><strong>功能</strong>：控制是否压缩系统消息</p>
                    <p><strong>影响</strong>：开启时压缩系统消息，减少上下文长度</p>
                    <p><strong>建议值</strong>：根据需要设置，默认false</p>
                  </div>
                }
                placement="top"
                arrow
              >
                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          } 
          name="squash_system_messages" 
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item 
          label={
            <Space>
              媒体内联 (media_inlining)
              <Tooltip 
                title={
                  <div>
                    <p><strong>功能</strong>：控制是否启用媒体内联</p>
                    <p><strong>影响</strong>：开启时支持媒体内容内联显示</p>
                    <p><strong>建议值</strong>：根据需要设置，默认true</p>
                  </div>
                }
                placement="top"
                arrow
              >
                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          } 
          name="media_inlining" 
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item 
          label={
            <Space>
              继续预填充 (continue_prefill)
              <Tooltip 
                title={
                  <div>
                    <p><strong>功能</strong>：控制是否启用继续预填充</p>
                    <p><strong>影响</strong>：开启时在继续生成时使用预填充内容</p>
                    <p><strong>建议值</strong>：根据需要设置，默认false</p>
                  </div>
                }
                placement="top"
                arrow
              >
                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          } 
          name="continue_prefill" 
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item 
          label={
            <Space>
              继续后缀 (continue_postfix)
              <Tooltip 
                title={
                  <div>
                    <p><strong>功能</strong>：继续生成时添加的后缀</p>
                    <p><strong>影响</strong>：设置继续生成时的后缀内容</p>
                    <p><strong>建议值</strong>：根据需要设置，默认" "</p>
                  </div>
                }
                placement="top"
                arrow
              >
                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          } 
          name="continue_postfix"
        >
          <Input placeholder="例如:  " />
        </Form.Item>
        <Form.Item 
          label={
            <Space>
              种子 (seed)
              <Tooltip 
                title={
                  <div>
                    <p><strong>功能</strong>：设置随机种子</p>
                    <p><strong>影响</strong>：相同的种子会产生相同的输出，-1表示随机种子</p>
                    <p><strong>建议值</strong>：-1或特定数字，默认-1</p>
                  </div>
                }
                placement="top"
                arrow
              >
                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          } 
          name="seed"
        >
          <Input type="number" placeholder="例如: -1" />
        </Form.Item>
        <Form.Item 
          label={
            <Space>
              生成数量 (n)
              <Tooltip 
                title={
                  <div>
                    <p><strong>功能</strong>：设置生成的回复数量</p>
                    <p><strong>影响</strong>：值越大，生成的回复越多，但可能会增加API调用成本</p>
                    <p><strong>建议值</strong>：1-5，默认1</p>
                  </div>
                }
                placement="top"
                arrow
              >
                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          } 
          name="n"
        >
          <Input type="number" placeholder="例如: 1" />
        </Form.Item>

        {/* 从Cozy's Soji Preset提取的参数 */}
        <Form.Item 
          label={
            <Space>
              名称在补全中 (names_in_completion)
              <Tooltip 
                title={
                  <div>
                    <p><strong>功能</strong>：控制是否在补全中包含名称</p>
                    <p><strong>影响</strong>：开启时在生成内容中包含角色名称</p>
                    <p><strong>建议值</strong>：根据需要设置，默认true</p>
                  </div>
                }
                placement="top"
                arrow
              >
                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          } 
          name="names_in_completion" 
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item 
          label={
            <Space>
              主提示 (main_prompt)
              <Tooltip 
                title={
                  <div>
                    <p><strong>功能</strong>：设置主提示内容</p>
                    <p><strong>影响</strong>：控制模型的整体行为和角色定位</p>
                    <p><strong>建议值</strong>：根据需要设置，默认空字符串</p>
                  </div>
                }
                placement="top"
                arrow
              >
                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          } 
          name="main_prompt"
        >
          <Input.TextArea rows={3} placeholder="输入主提示" />
        </Form.Item>
        <Form.Item 
          label={
            <Space>
              模拟提示 (impersonation_prompt)
              <Tooltip 
                title={
                  <div>
                    <p><strong>功能</strong>：设置模拟提示内容</p>
                    <p><strong>影响</strong>：控制模型如何模拟用户的风格和语气</p>
                    <p><strong>建议值</strong>：根据需要设置，默认空字符串</p>
                  </div>
                }
                placement="top"
                arrow
              >
                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          } 
          name="impersonation_prompt"
        >
          <Input.TextArea rows={3} placeholder="输入模拟提示" />
        </Form.Item>
        <Form.Item 
          label={
            <Space>
              越狱提示 (jailbreak_prompt)
              <Tooltip 
                title={
                  <div>
                    <p><strong>功能</strong>：设置越狱提示内容</p>
                    <p><strong>影响</strong>：控制模型突破限制的能力</p>
                    <p><strong>建议值</strong>：根据需要设置，默认空字符串</p>
                  </div>
                }
                placement="top"
                arrow
              >
                <QuestionCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </Space>
          } 
          name="jailbreak_prompt"
        >
          <Input.TextArea rows={3} placeholder="输入越狱提示" />
        </Form.Item>

        {/* Prompts数组管理 */}
        <Form.Item label="Prompts" name="prompts">
          <div>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={handleAddPrompt}
              style={{ marginBottom: 16 }}
            >
              添加Prompt
            </Button>
            <List
              bordered
              dataSource={form.getFieldValue('prompts') || []}
              renderItem={(item: PromptItem, index: number) => (
                <List.Item
                  actions={[
                    <Button 
                      key="edit" 
                      icon={<EditOutlined />} 
                      onClick={() => handleEditPrompt(index)}
                    >
                      编辑
                    </Button>,
                    <Button 
                      key="delete" 
                      danger 
                      icon={<MinusOutlined />} 
                      onClick={() => handleDeletePrompt(index)}
                    >
                      删除
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    title={item.name}
                    description={
                      <div>
                        <p>Identifier: {item.identifier}</p>
                        <p>System Prompt: {item.system_prompt ? 'Yes' : 'No'}</p>
                        <p>Role: {item.role}</p>
                        <p>Content: {escapeBraces(item.content.substring(0, 100))}{item.content.length > 100 ? '...' : ''}</p>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        </Form.Item>

        {/* 流式响应设置 */}
        <Form.Item label="启用流式响应" name="streaming" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>

      {/* Prompt编辑模态框 */}
      <Modal
        title="编辑Prompt"
        open={promptModalVisible}
        onOk={handleSavePrompt}
        onCancel={() => setPromptModalVisible(false)}
      >
        {editingPrompt && (
          <Form layout="vertical">
            <Form.Item label="Identifier">
              <Input 
                value={editingPrompt.identifier} 
                onChange={(e) => setEditingPrompt({ ...editingPrompt, identifier: e.target.value })} 
              />
            </Form.Item>
            <Form.Item label="System Prompt">
              <Switch 
                checked={editingPrompt.system_prompt} 
                onChange={(checked) => setEditingPrompt({ ...editingPrompt, system_prompt: checked })} 
              />
            </Form.Item>
            <Form.Item label="Role">
              <Input 
                value={editingPrompt.role} 
                onChange={(e) => setEditingPrompt({ ...editingPrompt, role: e.target.value })} 
              />
            </Form.Item>
            <Form.Item label="Name">
              <Input 
                value={editingPrompt.name} 
                onChange={(e) => setEditingPrompt({ ...editingPrompt, name: e.target.value })} 
              />
            </Form.Item>
            <Form.Item label="Content">
              <Input.TextArea 
                rows={4} 
                value={editingPrompt.content} 
                onChange={(e) => setEditingPrompt({ ...editingPrompt, content: e.target.value })} 
              />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </Card>
  );
};

export default ChatCompletionMode;