# 系统兼容性检查文档

## 概述

本文档提供了 TravenManager 系统兼容性检查的详细指南，帮助用户排查在添加新引擎时出现的保存失败问题。

## 当前系统环境

```
操作系统: macOS Sonoma 14.6.1
内核版本: Darwin 23.6.0
架构: x86_64 (64位)
```

## 一、操作系统兼容性检查

### 1.1 检查操作系统版本

#### macOS 兼容性要求
- **最低要求**: macOS 10.15 (Catalina) 或更高版本
- **推荐版本**: macOS 12.0 (Monterey) 或更高版本
- **当前版本**: macOS 14.6.1 ✅ 满足要求

#### Windows 兼容性要求
- **最低要求**: Windows 10 版本 1809 或更高版本
- **推荐版本**: Windows 11 或更高版本

#### Linux 兼容性要求
- **最低要求**: Ubuntu 20.04 LTS 或更高版本
- **推荐版本**: Ubuntu 22.04 LTS 或更高版本

### 1.2 检查系统架构

#### 架构验证
```bash
# macOS/Linux 检查命令
uname -m

# Windows PowerShell 检查命令
[Environment]::Is64BitOperatingSystem
```

#### 支持的架构
- ✅ x86_64 (AMD64) - 64位架构
- ✅ arm64 (Apple Silicon) - 64位架构
- ❌ i686 (x86) - 32位架构（不支持）

**当前状态**: x86_64 ✅ 支持

## 二、系统必备组件检查

### 2.1 Node.js 环境检查

#### 检查 Node.js 版本
```bash
node --version
```

#### Node.js 要求
- **最低版本**: Node.js 18.17.0
- **推荐版本**: Node.js 20.x 或更高版本

### 2.2 npm 环境检查

#### 检查 npm 版本
```bash
npm --version
```

#### npm 要求
- **最低版本**: npm 11.6.2
- **推荐版本**: npm 10.x 或更高版本

### 2.3 文件系统权限检查

#### macOS 权限问题排查
1. **检查用户数据目录权限**
```bash
# 查看用户数据目录
ls -la ~/Library/Application\ Support/

# 检查 TravenManager 目录
ls -la ~/Library/Application\ Support/travenManager/
```

2. **修复权限问题**
```bash
# 如果目录不存在，创建目录
mkdir -p ~/Library/Application\ Support/travenManager/

# 设置正确的权限
chmod 755 ~/Library/Application\ Support/travenManager/
```

#### Windows 权限问题排查
1. **以管理员身份运行**
2. **检查防病毒软件是否阻止了文件写入**
3. **检查用户数据目录权限**

#### Linux 权限问题排查
1. **检查用户数据目录**
```bash
ls -la ~/.config/
ls -la ~/.config/travenManager/
```

2. **修复权限问题**
```bash
mkdir -p ~/.config/travenManager/
chmod 755 ~/.config/travenManager/
```

### 2.4 磁盘空间检查

#### 检查可用磁盘空间
```bash
# macOS/Linux
df -h

# Windows PowerShell
Get-PSDrive C | Select-Object Used,Free
```

#### 磁盘空间要求
- **最小可用空间**: 500 MB
- **推荐可用空间**: 2 GB 或更多

## 三、软件冲突排查

### 3.1 端口占用检查

#### 检查常用端口
```bash
# macOS/Linux
lsof -i :5000
lsof -i :8000
lsof -i :3000

# Windows PowerShell
netstat -ano | findstr :5000
netstat -ano | findstr :8000
netstat -ano | findstr :3000
```

#### 常见端口用途
- **5000**: 常用于本地 AI 服务（如 Ollama）
- **8000**: 常用于 Web 服务器
- **3000**: 常用于开发服务器

### 3.2 防病毒软件检查

#### macOS
1. 检查 Gatekeeper 设置
2. 检查 XProtect 是否阻止了应用
3. 临时禁用防病毒软件测试

#### Windows
1. 检查 Windows Defender 隔离区
2. 添加 TravenManager 到白名单
3. 临时禁用防病毒软件测试

### 3.3 防火墙设置检查

#### macOS
```bash
# 检查防火墙状态
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# 如果需要，添加例外
```

#### Windows
1. 检查 Windows Defender 防火墙设置
2. 添加 TravenManager 到允许列表

### 3.4 其他 Electron 应用冲突

#### 检查是否有其他 Electron 应用同时运行
```bash
# macOS/Linux
ps aux | grep -i electron

# Windows PowerShell
Get-Process | Where-Object {$_.ProcessName -like "*electron*"}
```

## 四、配置文件检查

### 4.1 检查配置文件路径

#### macOS 配置文件路径
```
~/Library/Application Support/travenManager/config.json
```

#### Windows 配置文件路径
```
%APPDATA%\travenManager\config.json
```

#### Linux 配置文件路径
```
~/.config/travenManager/config.json
```

### 4.2 检查配置文件是否损坏

#### 验证 JSON 格式
```bash
# 使用 Python 验证
python -m json.tool ~/Library/Application\ Support/travenManager/config.json

# 或使用 Node.js 验证
node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync('~/Library/Application Support/travenManager/config.json', 'utf8')), null, 2))"
```

### 4.3 检查配置文件大小

#### 配置文件大小限制
- **建议大小**: < 1 MB
- **警告大小**: 1-5 MB
- **危险大小**: > 5 MB（可能导致保存失败）

## 五、日志分析

### 5.1 查看应用日志

#### 日志位置
- **macOS**: `~/Library/Logs/travenManager/`
- **Windows**: `%APPDATA%\travenManager\logs\`
- **Linux**: `~/.config/travenManager/logs/`

#### 关键日志查找
1. 查找包含 "error" 或 "Error" 的日志
2. 查找包含 "save" 或 "保存" 的日志
3. 查找包含 "config" 或 "配置" 的日志

### 5.2 浏览器控制台日志

#### 打开开发者工具
1. 在 TravenManager 中按 `Cmd+Option+I` (macOS) 或 `Ctrl+Shift+I` (Windows/Linux)
2. 切换到 Console 标签
3. 查看错误信息

## 六、常见问题解决方案

### 6.1 保存失败问题

#### 问题 1: 配置文件损坏
**解决方案**:
1. 备份现有配置文件
2. 删除损坏的配置文件
3. 重启应用，会自动创建新配置

#### 问题 2: 权限不足
**解决方案**:
1. 检查用户数据目录权限
2. 以管理员/root 身份运行应用
3. 修复目录权限

#### 问题 3: 磁盘空间不足
**解决方案**:
1. 清理磁盘空间
2. 移动用户数据目录到有足够空间的位置

#### 问题 4: 配置对象过大
**解决方案**:
1. 检查是否有不必要的数据
2. 清理旧的日志和缓存
3. 删除未使用的引擎配置

### 6.2 新引擎添加问题

#### 问题: 表单验证失败
**解决方案**:
1. 检查必填字段是否都已填写
2. 检查 API 地址格式是否正确
3. 查看日志中的详细错误信息

#### 问题: 保存后引擎不显示
**解决方案**:
1. 刷新页面重新加载配置
2. 检查配置文件是否成功保存
3. 查看日志中的保存过程

## 七、系统兼容性检查清单

### 检查前准备
- [ ] 备份现有配置文件
- [ ] 关闭其他不必要的应用
- [ ] 确保有足够的磁盘空间

### 操作系统检查
- [ ] 操作系统版本满足要求
- [ ] 系统架构为 64 位
- [ ] 系统更新到最新版本

### 环境检查
- [ ] Node.js 版本满足要求
- [ ] npm 版本满足要求
- [ ] 所有依赖已正确安装

### 权限检查
- [ ] 用户数据目录存在
- [ ] 用户数据目录权限正确
- [ ] 配置文件可读写

### 冲突检查
- [ ] 无端口冲突
- [ ] 防病毒软件未阻止
- [ ] 防火墙未阻止
- [ ] 无其他 Electron 应用冲突

### 配置检查
- [ ] 配置文件格式正确
- [ ] 配置文件大小合理
- [ ] 配置文件无损坏

## 八、联系支持

如果按照上述步骤检查后问题仍然存在，请：

1. **收集信息**:
   - 操作系统版本和架构
   - Node.js 和 npm 版本
   - 应用日志文件
   - 浏览器控制台错误信息
   - 复现问题的步骤

2. **提交 Issue**:
   - 在项目仓库提交 Issue
   - 提供上述收集的信息
   - 描述问题的详细情况

## 九、附录

### A. 快速诊断脚本（macOS）

```bash
#!/bin/bash
echo "=== TravenManager 系统兼容性检查 ==="
echo ""

echo "1. 操作系统信息"
sw_vers
uname -m
echo ""

echo "2. Node.js 版本"
node --version 2>/dev/null || echo "Node.js 未安装"
echo ""

echo "3. npm 版本"
npm --version 2>/dev/null || echo "npm 未安装"
echo ""

echo "4. 磁盘空间"
df -h ~
echo ""

echo "5. 用户数据目录"
DATA_DIR="$HOME/Library/Application Support/travenManager"
if [ -d "$DATA_DIR" ]; then
    echo "目录存在: $DATA_DIR"
    ls -lh "$DATA_DIR"
else
    echo "目录不存在: $DATA_DIR"
fi
echo ""

echo "6. 配置文件检查"
CONFIG_FILE="$DATA_DIR/config.json"
if [ -f "$CONFIG_FILE" ]; then
    echo "配置文件存在"
    echo "文件大小: $(ls -lh "$CONFIG_FILE" | awk '{print $5}')"
    if python -m json.tool "$CONFIG_FILE" >/dev/null 2>&1; then
        echo "JSON 格式: ✅ 正确"
    else
        echo "JSON 格式: ❌ 损坏"
    fi
else
    echo "配置文件不存在"
fi
echo ""

echo "=== 检查完成 ==="
```

### B. 快速诊断脚本（Windows PowerShell）

```powershell
Write-Host "=== TravenManager 系统兼容性检查 ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. 操作系统信息" -ForegroundColor Yellow
[Environment]::OSVersion
Write-Host "架构: $([Environment]::Is64BitOperatingSystem ? '64位' : '32位')"
Write-Host ""

Write-Host "2. Node.js 版本" -ForegroundColor Yellow
try {
    node --version
} catch {
    Write-Host "Node.js 未安装" -ForegroundColor Red
}
Write-Host ""

Write-Host "3. npm 版本" -ForegroundColor Yellow
try {
    npm --version
} catch {
    Write-Host "npm 未安装" -ForegroundColor Red
}
Write-Host ""

Write-Host "4. 磁盘空间" -ForegroundColor Yellow
Get-PSDrive C | Select-Object Used,Free | Format-Table -AutoSize
Write-Host ""

Write-Host "5. 用户数据目录" -ForegroundColor Yellow
$dataDir = "$env:APPDATA\travenManager"
if (Test-Path $dataDir) {
    Write-Host "目录存在: $dataDir"
    Get-ChildItem $dataDir | Format-Table -AutoSize
} else {
    Write-Host "目录不存在: $dataDir" -ForegroundColor Red
}
Write-Host ""

Write-Host "6. 配置文件检查" -ForegroundColor Yellow
$configFile = "$dataDir\config.json"
if (Test-Path $configFile) {
    Write-Host "配置文件存在"
    $fileSize = (Get-Item $configFile).Length
    Write-Host "文件大小: $([math]::Round($fileSize/1KB, 2)) KB"
    try {
        $content = Get-Content $configFile -Raw | ConvertFrom-Json
        Write-Host "JSON 格式: ✅ 正确" -ForegroundColor Green
    } catch {
        Write-Host "JSON 格式: ❌ 损坏" -ForegroundColor Red
    }
} else {
    Write-Host "配置文件不存在" -ForegroundColor Red
}
Write-Host ""

Write-Host "=== 检查完成 ===" -ForegroundColor Cyan
```

---

**文档版本**: 1.0  
**最后更新**: 2025-01-13  
**维护者**: TravenManager 开发团队
