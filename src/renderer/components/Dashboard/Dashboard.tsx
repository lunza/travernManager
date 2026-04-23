import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Card, Row, Col, Statistic, Button, Space, message, Modal, Typography } from 'antd';
import {
  BookOutlined,
  UserOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  LoadingOutlined,
  ThunderboltOutlined,
  LeftOutlined,
  RightOutlined,
  BulbOutlined,
  ThunderboltOutlined as AvatarIcon
} from '@ant-design/icons';
import { Carousel } from 'antd';
import { useDataStore } from '../../stores/dataStore';
import { useSettingStore } from '../../stores/settingStore';
import { useLogStore } from '../../stores/logStore';
import { useUIStore } from '../../stores/uiStore';
import { ANIMATIONS, ANIMATION_DELAYS, CARD_ANIMATIONS, HOVER_EFFECTS, BUTTON_ANIMATIONS } from '../../utils/animation';
import { AppSetting } from '../../settings';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const { worldBooks, characters, installedPlugins, avatars, fetchWorldBooks, fetchCharacters, fetchInstalledPlugins, fetchAvatars } = useDataStore();
  const { setting, fetchSetting } = useSettingStore();
  const { addLog } = useLogStore();
  const { animationEnabled } = useUIStore();
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const backgroundRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  // 获取动画类名的辅助函数
  const getAnimatedClass = (className: string, animationName: string): string => {
    return animationEnabled ? `${className} ${animationName}` : className;
  };

  // 检测图片尺寸并计算合适的显示大小
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.target as HTMLImageElement;
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    setImageSize({ width: naturalWidth, height: naturalHeight });
  };

  // 计算背景图片区域的尺寸
  const getBackgroundSize = () => {
    if (!setting?.dashboardBackgroundImage) {
      return { height: 200 };
    }

    const minHeight = 100;
    const maxHeight = 800;
    const { width, height } = imageSize;

    // 如果还没有加载到图片尺寸，返回默认高度
    if (width === 0 || height === 0) {
      return { height: minHeight };
    }

    // 计算宽高比
    const aspectRatio = width / height;

    // 使用实际容器宽度计算高度
    const calculatedHeight = containerWidth / aspectRatio;

    // 确保高度在合理范围内
    let finalHeight = calculatedHeight;
    if (finalHeight < minHeight) {
      finalHeight = minHeight;
    }
    if (finalHeight > maxHeight) {
      finalHeight = maxHeight;
    }

    return { 
      height: finalHeight, 
      objectFit: 'cover' as const 
    };
  };

  // 检测容器宽度变化
  useEffect(() => {
    const updateContainerWidth = () => {
      if (backgroundRef.current) {
        setContainerWidth(backgroundRef.current.offsetWidth);
      }
    };

    // 初始更新
    updateContainerWidth();

    // 监听窗口大小变化
    window.addEventListener('resize', updateContainerWidth);
    return () => window.removeEventListener('resize', updateContainerWidth);
  }, []);

  // 当容器宽度或图片尺寸变化时重新计算样式
  const backgroundStyle = React.useMemo(() => {
    return getBackgroundSize();
  }, [containerWidth, imageSize, setting?.dashboardBackgroundImage]);

  useEffect(() => {
    fetchSetting();
    fetchWorldBooks();
    fetchCharacters();
    fetchInstalledPlugins();
  }, [fetchSetting, fetchWorldBooks, fetchCharacters, fetchInstalledPlugins, fetchAvatars]);

  // 启动状态管理
  type StartStatus = 'idle' | 'checking' | 'starting' | 'running' | 'error';
  const [isStarting, setIsStarting] = useState(false);
  const [startStatus, setStartStatus] = useState<StartStatus>('idle');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  // 建立WebSocket连接
  useEffect(() => {
    let ws: WebSocket | null = null;
    
    try {
      ws = new WebSocket('ws://localhost:8081');
      
      ws.onopen = () => {
        addLog('WebSocket connected', 'debug');
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'log' && message.data) {
            // 将日志添加到全局日志存储
            addLog(message.data, 'info');
          }
        } catch (error) {
          addLog('WebSocket消息解析失败', 'error', {
            category: 'websocket',
            error: error instanceof Error ? error : undefined,
            context: {
              errorType: error instanceof Error ? error.name : 'UnknownError',
              errorLocation: 'Dashboard.tsx:137:setupWebSocket',
              errorMessage: error instanceof Error ? error.message : String(error)
            },
            details: '解析WebSocket消息时发生错误'  
          });
        }
      };
      
      ws.onclose = () => {
        addLog('WebSocket disconnected', 'debug');
      };
      
      ws.onerror = (error) => {
        addLog('WebSocket连接错误', 'error', {
          category: 'websocket',
          error: error instanceof Error ? error : undefined,
          context: {
            errorType: error instanceof Error ? error.name : 'UnknownError',
            errorLocation: 'Dashboard.tsx:146:setupWebSocket',
            errorMessage: error instanceof Error ? error.message : String(error)
          },
          details: 'WebSocket连接发生错误'  
        });
      };
    } catch (error) {
      addLog('WebSocket连接设置失败', 'error', {
        category: 'websocket',
        error: error instanceof Error ? error : undefined,
        context: {
          errorType: error instanceof Error ? error.name : 'UnknownError',
          errorLocation: 'Dashboard.tsx:149:setupWebSocket',
          errorMessage: error instanceof Error ? error.message : String(error)
        },
        details: '设置WebSocket连接时发生错误'  
      });
    }

    // 清理函数
    return () => {
      if (ws) {
        try {
          ws.close();
        } catch (error) {
          addLog('WebSocket关闭错误', 'error', {
            category: 'websocket',
            error: error instanceof Error ? error : undefined,
            context: {
              errorType: error instanceof Error ? error.name : 'UnknownError',
              errorLocation: 'Dashboard.tsx:158:setupWebSocket',
              errorMessage: error instanceof Error ? error.message : String(error)
            },
            details: '关闭WebSocket连接时发生错误'  
          });
        }
      }
    };
  }, [addLog]);

  // 启动SillyTavern
  const handleStart = async () => {
    if (isStarting) return;

    setIsStarting(true);
    setStartStatus('checking');
    addLog('开始启动SillyTavern...', 'info');

    try {
      // 启动
      addLog('步骤3: 启动SillyTavern...', 'info');
      await startSillyTavern();

    } catch (error) {
      addLog('启动服务失败', 'error', {
        category: 'server',
        error: error instanceof Error ? error : undefined,
        context: {
          errorType: error instanceof Error ? error.name : 'UnknownError',
          errorLocation: 'Dashboard.tsx:178:startService',
          errorMessage: error instanceof Error ? error.message : '未知错误'
        },
        details: '启动服务时发生错误'  
      });
      setStartStatus('error');
      message.error('启动失败');
    } finally {
      setIsStarting(false);
    }
  };

  // 调用IPC启动SillyTavern
  const startSillyTavern = async () => {
    setStartStatus('starting');
    
    try {
      // 检查window.electronAPI是否可用
      if (!window.electronAPI || !window.electronAPI.sillyTavern) {
        addLog('Electron API未初始化', 'error', {
          category: 'system',
          context: {
            errorType: 'APIInitError',
            errorLocation: 'Dashboard.tsx:193:checkDependencies',
            errorMessage: 'Electron API未初始化'
          },
          details: 'Electron API未初始化，无法执行依赖检查'  
        });
        setStartStatus('error');
        message.error('Electron API未初始化');
        return;
      }
      
      // 调用IPC启动SillyTavern
      const result = await window.electronAPI.sillyTavern.start();
      
      if (result.success) {
        setStartStatus('running');
        addLog('SillyTavern 启动成功', 'info');
        message.success('SillyTavern 启动成功');
      } else {
        addLog('启动失败', 'error', {
          category: 'server',
          context: {
            errorType: 'StartFailedError',
            errorLocation: 'Dashboard.tsx:207:startService',
            errorMessage: result.message
          },
          details: '启动服务时失败'  
        });
        setStartStatus('error');
        message.error(`启动失败: ${result.message}`);
      }
    } catch (error) {
      addLog('启动错误', 'error', {
        category: 'server',
        error: error instanceof Error ? error : undefined,
        context: {
          errorType: error instanceof Error ? error.name : 'UnknownError',
          errorLocation: 'Dashboard.tsx:212:startService',
          errorMessage: error instanceof Error ? error.message : '未知错误'
        },
        details: '启动服务时发生异常'  
      });
      setStartStatus('error');
      message.error('启动失败');
    }
  };

  // 检查更新
  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    addLog('正在检查更新...', 'info');

    try {
      // 调用IPC检查更新
      const result = await window.electronAPI.update.check();
      
      if (result.success) {
        const { hasUpdate, currentVersion, latestVersion } = result.data;
        
        if (hasUpdate) {
          addLog(`发现新版本: v${latestVersion} (当前版本: v${currentVersion})`, 'warn');
          
          // 显示更新确认对话框
          Modal.confirm({
            title: '发现新版本',
            content: (
              <div>
                <p>当前版本: v{currentVersion}</p>
                <p>最新版本: v{latestVersion}</p>
                <p style={{ marginTop: 12 }}>是否下载并安装更新？</p>
              </div>
            ),
            onOk: async () => {
              addLog('开始下载更新...', 'info');
              try {
                const downloadResult = await window.electronAPI.update.download(latestVersion);
                if (downloadResult.success) {
                  addLog('更新下载完成，开始安装...', 'info');
                  const installResult = await window.electronAPI.update.install(downloadResult.data.downloadPath);
                  if (installResult.success) {
                    addLog('更新安装成功', 'info');
                    message.success('更新安装成功，请重启应用');
                  } else {
                    addLog('安装失败', 'error', {
                      category: 'update',
                      context: {
                        errorType: 'InstallFailedError',
                        errorLocation: 'Dashboard.tsx:254:checkUpdate',
                        errorMessage: installResult.message
                      },
                      details: '安装更新时失败'  
                    });
                    message.error(`安装失败: ${installResult.message}`);
                  }
                } else {
                  addLog('下载失败', 'error', {
                    category: 'update',
                    context: {
                      errorType: 'DownloadFailedError',
                      errorLocation: 'Dashboard.tsx:258:checkUpdate',
                      errorMessage: downloadResult.message
                    },
                    details: '下载更新时失败'  
                  });
                  message.error(`下载失败: ${downloadResult.message}`);
                }
              } catch (error) {
                addLog('更新错误', 'error', {
                  category: 'update',
                  error: error instanceof Error ? error : undefined,
                  context: {
                    errorType: error instanceof Error ? error.name : 'UnknownError',
                    errorLocation: 'Dashboard.tsx:262:checkUpdate',
                    errorMessage: error instanceof Error ? error.message : '未知错误'
                  },
                  details: '检查更新时发生错误'  
                });
                message.error('更新失败');
              }
            },
            onCancel: () => {
              addLog('取消更新', 'info');
            }
          });
        } else {
          addLog(`已是最新版本: v${currentVersion}`, 'info');
          message.success(`已是最新版本: v${currentVersion}`);
        }
      } else {
        addLog('检查更新失败', 'error', {
          category: 'update',
          context: {
            errorType: 'CheckUpdateFailedError',
            errorLocation: 'Dashboard.tsx:275:checkUpdate',
            errorMessage: result.message
          },
          details: '检查更新时失败'  
        });
        message.error(`检查更新失败: ${result.message}`);
      }
    } catch (error) {
      addLog('检查更新错误', 'error', {
        category: 'update',
        error: error instanceof Error ? error : undefined,
        context: {
          errorType: error instanceof Error ? error.name : 'UnknownError',
          errorLocation: 'Dashboard.tsx:279:checkUpdate',
          errorMessage: error instanceof Error ? error.message : '未知错误'
        },
        details: '检查更新时发生异常'  
      });
      message.error('检查更新失败');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  // 停止SillyTavern
  const handleStop = async () => {
    if (isStarting) return;

    setIsStarting(true);
    addLog('正在停止SillyTavern...', 'info');

    try {
      // 调用IPC停止SillyTavern
      const result = await window.electronAPI.sillyTavern.stop();
      
      if (result.success) {
        addLog('SillyTavern 已停止', 'info');
        setStartStatus('idle');
        message.success('SillyTavern 已停止');
      } else {
        addLog('停止失败', 'error', {
          category: 'server',
          context: {
            errorType: 'StopFailedError',
            errorLocation: 'Dashboard.tsx:414:handleStop',
            errorMessage: result.message
          },
          details: '停止SillyTavern时失败'  
        });
        message.error(`停止失败: ${result.message}`);
      }
    } catch (error) {
      addLog('停止错误', 'error', {
        category: 'server',
        error: error instanceof Error ? error : undefined,
        context: {
          errorType: error instanceof Error ? error.name : 'UnknownError',
          errorLocation: 'Dashboard.tsx:426:handleStop',
          errorMessage: error instanceof Error ? error.message : '未知错误'
        },
        details: '停止SillyTavern时发生异常'  
      });
      message.error('停止失败');
    } finally {
      setIsStarting(false);
    }
  };

  // 停止所有SillyTavern进程
  const handleStopAll = async () => {
    if (isStarting) return;

    setIsStarting(true);
    addLog('正在停止所有SillyTavern进程...', 'info');

    try {
      // 调用IPC停止所有SillyTavern进程
      const result = await window.electronAPI.sillyTavern.stopAll();
      
      if (result.success) {
        addLog('所有SillyTavern进程已停止', 'info');
        setStartStatus('idle');
        message.success('所有SillyTavern进程已停止');
      } else {
        addLog('停止失败', 'error', {
          category: 'server',
          context: {
            errorType: 'StopFailedError',
            errorLocation: 'Dashboard.tsx:441:handleStopAll',
            errorMessage: result.message
          },
          details: '停止所有SillyTavern进程时失败'  
        });
        message.error(`停止失败: ${result.message}`);
      }
    } catch (error) {
      addLog('停止错误', 'error', {
        category: 'server',
        error: error instanceof Error ? error : undefined,
        context: {
          errorType: error instanceof Error ? error.name : 'UnknownError',
          errorLocation: 'Dashboard.tsx:470:handleStopAll',
          errorMessage: error instanceof Error ? error.message : '未知错误'
        },
        details: '停止所有SillyTavern进程时发生异常'  
      });
      message.error('停止失败');
    } finally {
      setIsStarting(false);
    }
  };

  // 打开世界书存储文件夹
  const handleOpenWorldBookFolder = async () => {
    try {
      // 调用IPC打开文件夹（让主进程处理路径）
      addLog('打开世界书存储文件夹', 'info');
      
      // 调用IPC打开文件夹
      const result = await window.electronAPI.file.openFolder('worldbook');
      if (!result.success) {
        throw new Error(result.message || '打开文件夹失败');
      }
    } catch (error) {
      addLog('打开世界书存储文件夹失败', 'error', {
        category: 'file',
        error: error instanceof Error ? error : undefined,
        context: {
          errorType: error instanceof Error ? error.name : 'UnknownError',
          errorLocation: 'Dashboard.tsx:498:handleOpenWorldBookFolder',
          errorMessage: error instanceof Error ? error.message : '未知错误'
        },
        details: '打开世界书存储文件夹时发生错误'  
      });
      message.error('打开文件夹失败');
    }
  };

  // 打开角色卡存储文件夹
  const handleOpenCharacterFolder = async () => {
    try {
      // 调用IPC打开文件夹（让主进程处理路径）
      addLog('打开角色卡存储文件夹', 'info');
      
      // 调用IPC打开文件夹
      const result = await window.electronAPI.file.openFolder('character');
      if (!result.success) {
        throw new Error(result.message || '打开文件夹失败');
      }
    } catch (error) {
      addLog('打开角色卡存储文件夹失败', 'error', {
        category: 'file',
        error: error instanceof Error ? error : undefined,
        context: {
          errorType: error instanceof Error ? error.name : 'UnknownError',
          errorLocation: 'Dashboard.tsx:515:handleOpenCharacterFolder',
          errorMessage: error instanceof Error ? error.message : '未知错误'
        },
        details: '打开角色卡存储文件夹时发生错误'  
      });
      message.error('打开文件夹失败');
    }
  };

  // 打开用户设定存储文件夹
  const handleOpenAvatarFolder = async () => {
    try {
      // 调用IPC打开文件夹（让主进程处理路径）
      addLog('打开用户设定存储文件夹', 'info');
      
      // 调用IPC打开文件夹
      const result = await window.electronAPI.file.openFolder('avatar');
      if (!result.success) {
        throw new Error(result.message || '打开文件夹失败');
      }
    } catch (error) {
      addLog('打开用户设定存储文件夹失败', 'error', {
        category: 'file',
        error: error instanceof Error ? error : undefined,
        context: {
          errorType: error instanceof Error ? error.name : 'UnknownError',
          errorLocation: 'Dashboard.tsx:532:handleOpenAvatarFolder',
          errorMessage: error instanceof Error ? error.message : '未知错误'
        },
        details: '打开用户设定存储文件夹时发生错误'  
      });
      message.error('打开文件夹失败');
    }
  };

  // Tips 状态管理
  interface Tip {
    id: number;
    title: string;
    content: string;
  }
  
  const [tips, setTips] = useState<Tip[]>([]);
  const [tipsLoading, setTipsLoading] = useState(true);
  const carouselRef = useRef<any>(null);
  
  // 加载 tips 数据
  useEffect(() => {
    const loadTips = async () => {
      try {
        const tipsData = await window.electronAPI.file.readJson('tips');
        if (tipsData && Array.isArray(tipsData)) {
          setTips(tipsData);
        }
      } catch (error) {
        console.error('Failed to load tips:', error);
        // 使用默认 tips
        const defaultTips: Tip[] = [
          { id: 1, title: "使用提示", content: "欢迎使用 TravenManager！这是一个强大的 SillyTavern 管理工具。" }
        ];
        setTips(defaultTips);
      } finally {
        setTipsLoading(false);
      }
    };
    loadTips();
  }, []);

  // 计算统计数据
  const totalWorldBooks = worldBooks.length;
  const totalCharacters = characters.length;
  const totalPlugins = installedPlugins.length;
  const totalAvatars = avatars.length;
  const configLoaded = setting !== null;

  return (
    <div className={getAnimatedClass('dashboard', ANIMATIONS.fadeIn)}>
      <div style={{ width: '100%', maxWidth: '100%', overflow: 'hidden', padding: '0 16px', boxSizing: 'border-box' }}>
        <h2>仪表盘</h2>
        
        {/* 背景图片区域 */}
        <div 
          ref={backgroundRef}
          className={getAnimatedClass('dashboard-background', ANIMATIONS.fadeInDown)}
          style={{ height: backgroundStyle.height }}
        >
          {setting?.dashboardBackgroundImage ? (
            <img
              src={setting.dashboardBackgroundImage}
              alt="仪表盘背景"
              onLoad={handleImageLoad}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                borderRadius: '16px'
              }}
            />
          ) : (
            <div className="background-placeholder">
              <p>背景图片区域</p>
              <p style={{ fontSize: 12, marginTop: 8, color: '#888' }}>
                在设置页面上传自定义背景图片
              </p>
            </div>
          )}
        </div>

        <Row gutter={[16, 16]} style={{ marginTop: 24, width: '100%', marginLeft: 0, marginRight: 0 }}>
          <Col xs={24} sm={12} md={4} style={{ paddingLeft: 8, paddingRight: 8 }}>
            <Card 
              onClick={handleOpenWorldBookFolder} 
              style={{ cursor: 'pointer' }} 
              hoverable
              className={getAnimatedClass('', `${ANIMATIONS.fadeInUp} ${ANIMATION_DELAYS['100']} ${CARD_ANIMATIONS.animated} ${HOVER_EFFECTS.lift}`)}
            >
              <Statistic
                title="世界书数量"
                value={totalWorldBooks}
                prefix={<BookOutlined />}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={4} style={{ paddingLeft: 8, paddingRight: 8 }}>
            <Card 
              onClick={handleOpenCharacterFolder} 
              style={{ cursor: 'pointer' }} 
              hoverable
              className={getAnimatedClass('', `${ANIMATIONS.fadeInUp} ${ANIMATION_DELAYS['200']} ${CARD_ANIMATIONS.animated} ${HOVER_EFFECTS.lift}`)}
            >
              <Statistic
                title="角色卡数量"
                value={totalCharacters}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={4} style={{ paddingLeft: 8, paddingRight: 8 }}>
            <Card 
              onClick={handleOpenAvatarFolder} 
              style={{ cursor: 'pointer' }} 
              hoverable
              className={getAnimatedClass('', `${ANIMATIONS.fadeInUp} ${ANIMATION_DELAYS['300']} ${CARD_ANIMATIONS.animated} ${HOVER_EFFECTS.lift}`)}
            >
              <Statistic
                title="用户设定数量"
                value={totalAvatars}
                prefix={<AvatarIcon />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={4} style={{ paddingLeft: 8, paddingRight: 8 }}>
            <Card 
              className={getAnimatedClass('', `${ANIMATIONS.fadeInUp} ${ANIMATION_DELAYS['400']} ${CARD_ANIMATIONS.animated} ${HOVER_EFFECTS.lift}`)}
            >
              <Statistic
                title="已安装插件"
                value={totalPlugins}
                prefix={<ThunderboltOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={4} style={{ paddingLeft: 8, paddingRight: 8 }}>
            <Card 
              className={getAnimatedClass('', `${ANIMATIONS.fadeInUp} ${ANIMATION_DELAYS['500']} ${CARD_ANIMATIONS.animated} ${HOVER_EFFECTS.lift}`)}
            >
              <Statistic
                title="配置状态"
                value={configLoaded ? '已加载' : '未加载'}
                prefix={configLoaded ? <CheckCircleOutlined /> : <WarningOutlined />}
                valueStyle={{ color: configLoaded ? '#3f8600' : '#cf1322' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={4} style={{ paddingLeft: 8, paddingRight: 8 }}>
            <Card 
              className={getAnimatedClass('', `${ANIMATIONS.fadeInUp} ${ANIMATION_DELAYS['600']} ${CARD_ANIMATIONS.animated} ${HOVER_EFFECTS.lift}`)}
            >
              <Statistic
                title="系统状态"
                value="正常"
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
        </Row>

        <div style={{ marginTop: 16, marginBottom: 80, width: '100%', boxSizing: 'border-box' }}>
          {/* 使用技巧轮播 */}
          <Card 
            title={<Space><BulbOutlined /> SillyTavern 使用技巧</Space>}
            className={getAnimatedClass('', `${ANIMATIONS.fadeInUp} ${ANIMATION_DELAYS['600']} ${CARD_ANIMATIONS.animated} ${HOVER_EFFECTS.lift}`)}
            extra={
              <Space>
                <Button 
                  shape="circle" 
                  icon={<LeftOutlined />} 
                  onClick={() => carouselRef.current?.prev()} 
                />
                <Button 
                  shape="circle" 
                  icon={<RightOutlined />} 
                  onClick={() => carouselRef.current?.next()} 
                />
              </Space>
            }
          >
            {tipsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <LoadingOutlined style={{ fontSize: 24 }} spin />
                <div style={{ marginTop: 8 }}>加载中...</div>
              </div>
            ) : tips.length > 0 ? (
              <Carousel
                ref={carouselRef}
                dots={true}
                autoplay={true}
                autoplaySpeed={5000}
                easing="ease-in-out"
                beforeChange={(from, to) => {
                  console.log(`从 ${from} 切换到 ${to}`);
                }}
              >
                {tips.map((tip, index) => (
                  <div key={tip.id} style={{ padding: '8px 0' }}>
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      minHeight: 100,
                      justifyContent: 'center'
                    }}>
                      <Typography.Title 
                        level={4} 
                        style={{ 
                          marginBottom: 12, 
                          color: '#722ed1',
                          marginTop: 0
                        }}
                      >
                        {tip.title}
                      </Typography.Title>
                      <Typography.Paragraph 
                        style={{ 
                          fontSize: '16px', 
                          lineHeight: 1.8,
                          marginBottom: 0
                        }}
                      >
                        {tip.content}
                      </Typography.Paragraph>
                    </div>
                  </div>
                ))}
              </Carousel>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <p>暂无使用技巧</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* 右下角按钮 */}
      <div className={getAnimatedClass('dashboard-buttons', ANIMATIONS.fadeInUp)}>
        <Space>
          {startStatus === 'running' ? (
            <Button
              type="primary"
              danger
              size="large"
              icon={<LoadingOutlined spin />}
              onClick={handleStop}
              loading={isStarting}
              className={getAnimatedClass('start-button', BUTTON_ANIMATIONS.animated)}
            >
              停止
            </Button>
          ) : (
            <Button
              type="primary"
              size="large"
              icon={isStarting ? <LoadingOutlined spin /> : <PlayCircleOutlined />}
              onClick={handleStart}
              loading={isStarting}
              disabled={startStatus === 'running'}
              className={getAnimatedClass('start-button', BUTTON_ANIMATIONS.animated)}
            >
              {isStarting ? '启动中...' : startStatus === 'running' ? '已启动' : '一键启动'}
            </Button>
          )}
          <Button
            size="large"
            icon={isCheckingUpdate ? <LoadingOutlined spin /> : <ReloadOutlined />}
            onClick={handleCheckUpdate}
            loading={isCheckingUpdate}
            disabled={isStarting}
            className={getAnimatedClass('update-button', BUTTON_ANIMATIONS.animated)}
          >
            检查更新
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default Dashboard;
