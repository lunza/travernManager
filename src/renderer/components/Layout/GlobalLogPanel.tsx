import React, { useEffect, useRef, useState } from 'react';
import { Card, Button, Space, Typography, Badge, Select, Input, Modal } from 'antd';
import { 
  CloseOutlined, 
  ClearOutlined, 
  CopyOutlined,
  SearchOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { useLogStore } from '../../stores/logStore';
import { useUIStore } from '../../stores/uiStore';
import { useConfigStore } from '../../stores/configStore';
import './GlobalLogPanel.css';

const { Text } = Typography;
const { Option } = Select;

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVELS: LogLevel[] = ['error', 'warn', 'info', 'debug'];

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  'error': 0,
  'warn': 1,
  'info': 2,
  'debug': 3
};

const GlobalLogPanel: React.FC = () => {
  const { logs, isLogPanelOpen, setLogPanelOpen, clearLogs } = useLogStore();
  const { theme } = useUIStore();
  const { config } = useConfigStore();
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'all'>('all');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    // 自动滚动到底部
    if (logContainerRef.current && isLogPanelOpen) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isLogPanelOpen]);

  const copyLogs = () => {
    const logText = filteredLogs.map(log => `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}`).join('\n');
    navigator.clipboard.writeText(logText);
  };

  const [exportModalVisible, setExportModalVisible] = useState(false);

  const exportLogsAsTxt = () => {
    const logText = filteredLogs.map(log => `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}`).join('\n');
    const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.download = `travenmanager-logs-${timestamp}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExportModalVisible(false);
  };

  const exportLogsAsJson = () => {
    const logData = filteredLogs.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      type: log.type,
      message: log.message
    }));
    const jsonText = JSON.stringify(logData, null, 2);
    const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.download = `travenmanager-logs-${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExportModalVisible(false);
  };

  const getLogColor = (type: LogLevel) => {
    const isDark = theme === 'dark';
    switch (type) {
      case 'error':
        return isDark ? '#ff6b6b' : '#ff4d4f';
      case 'warn':
        return isDark ? '#ffd43b' : '#faad14';
      case 'info':
        return isDark ? '#4dabf7' : '#1890ff';
      case 'debug':
        return isDark ? '#868e96' : '#8c8c8c';
      default:
        return isDark ? '#4dabf7' : '#1890ff';
    }
  };

  const getLogLabel = (type: LogLevel) => {
    switch (type) {
      case 'error':
        return '错误';
      case 'warn':
        return '警告';
      case 'info':
        return '信息';
      case 'debug':
        return '调试';
      default:
        return type;
    }
  };

  const shouldShowLog = (log: { type: LogLevel; message: string }) => {
    // 根据配置的日志级别过滤
    const configLevel = (config?.logLevel as LogLevel) || 'info';
    const configPriority = LOG_LEVEL_PRIORITY[configLevel];
    const logPriority = LOG_LEVEL_PRIORITY[log.type];
    
    if (logPriority > configPriority) {
      return false;
    }

    // 根据用户选择的级别过滤
    if (filterLevel !== 'all' && log.type !== filterLevel) {
      return false;
    }

    // 根据搜索文本过滤
    if (searchText && !log.message.toLowerCase().includes(searchText.toLowerCase())) {
      return false;
    }

    return true;
  };

  const filteredLogs = logs.filter(shouldShowLog);

  if (!isLogPanelOpen) {
    return null;
  }

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#1f1f1f' : '#ffffff';
  const timestampColor = isDark ? '#888' : '#666';
  const borderColor = isDark ? '#333' : '#e8e8e8';

  return (
    <div className="global-log-panel">
      <Card
        className="log-panel-card"
        title={
          <Space>
            <Text strong>系统日志</Text>
            <Badge count={filteredLogs.length} showZero style={{ backgroundColor: isDark ? '#40a9ff' : '#1890ff' }} />
          </Space>
        }
        extra={
          <Space>
            <Select
              value={filterLevel}
              onChange={setFilterLevel}
              style={{ width: 100 }}
              size="small"
            >
              <Option value="all">全部</Option>
              <Option value="error">错误</Option>
              <Option value="warn">警告</Option>
              <Option value="info">信息</Option>
              <Option value="debug">调试</Option>
            </Select>
            <Input
              placeholder="搜索日志"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 180 }}
              size="small"
              allowClear
            />
            <Button
              type="text"
              icon={<DownloadOutlined />}
              size="small"
              onClick={() => setExportModalVisible(true)}
            >
              导出
            </Button>
            <Button
              type="text"
              icon={<CopyOutlined />}
              size="small"
              onClick={copyLogs}
            >
              复制
            </Button>
            <Button
              type="text"
              icon={<ClearOutlined />}
              size="small"
              onClick={clearLogs}
            >
              清空
            </Button>
            <Button
              type="text"
              icon={<CloseOutlined />}
              size="small"
              onClick={() => setLogPanelOpen(false)}
            />
          </Space>
        }
      >
        <div
          ref={logContainerRef}
          className="log-panel-content"
          style={{ 
            backgroundColor: bgColor
          }}
        >
          {filteredLogs.length === 0 ? (
            <div className="log-empty">
              <Text type="secondary">暂无日志</Text>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div 
                key={log.id} 
                className={`log-entry log-${log.type}`}
                style={{ borderBottomColor: borderColor }}
              >
                <span 
                  className="log-level"
                  style={{ 
                    color: getLogColor(log.type as LogLevel),
                    fontWeight: 600,
                    minWidth: 40
                  }}
                >
                  [{getLogLabel(log.type as LogLevel)}]
                </span>
                <span className="log-timestamp" style={{ color: timestampColor }}>
                  [{log.timestamp}]
                </span>
                <span 
                  className="log-message" 
                  style={{ color: getLogColor(log.type as LogLevel) }}
                >
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>
      
      <Modal
        title="导出日志"
        open={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
        footer={null}
      >
        <div style={{ padding: '16px 0' }}>
          <Text>请选择导出格式：</Text>
          <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
            <Button
              type="primary"
              size="large"
              block
              onClick={exportLogsAsTxt}
            >
              导出为文本文件 (.txt)
            </Button>
            <Button
              size="large"
              block
              onClick={exportLogsAsJson}
            >
              导出为 JSON 文件 (.json)
            </Button>
          </Space>
        </div>
      </Modal>
    </div>
  );
};

export default GlobalLogPanel;
