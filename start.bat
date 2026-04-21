@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ====================================
echo TravenManager 项目启动器
echo ====================================
echo.

:: 检查是否已安装 Node.js
node --version >nul 2>&1
if %errorlevel% NEQ 0 (
    echo 未找到 Node.js，正在检查是否存在本地 Node.js...
    echo.
    
    :: 检查是否存在 node 目录
    if exist "node" (
        echo 找到本地 Node.js 目录
        set "PATH=%~dp0node;%~dp0node\node_modules\npm\bin;%PATH%"
        echo 已设置本地 Node.js 路径
    ) else (
        echo 未找到 Node.js，正在下载并安装...
        echo 请稍候，这可能需要几分钟时间...
        echo.
        
        :: 下载 Node.js 18.17.0 (LTS) 32位版本
        powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v18.17.0/node-v18.17.0-win-x86.zip' -OutFile 'node.zip'"
        
        if exist "node.zip" (
            echo 下载完成，正在解压...
            powershell -Command "Expand-Archive -Path 'node.zip' -DestinationPath '.'"
            ren "node-v18.17.0-win-x86" "node"
            del "node.zip"
            set "PATH=%~dp0node;%~dp0node\node_modules\npm\bin;%PATH%"
            echo Node.js 安装完成
        ) else (
            echo 下载 Node.js 失败，请手动安装 Node.js
            pause
            exit /b 1
        )
    )
)

echo 检测到 Node.js 环境
node --version
echo.

:: 检查 npm 是否可用
npm --version >nul 2>&1
if %errorlevel% NEQ 0 (
    echo npm 不可用，正在修复...
    echo 请稍候...
    echo.
    
    :: 重新安装 npm
    powershell -Command "npm install -g npm@latest"
    if %errorlevel% NEQ 0 (
        echo 修复 npm 失败
        pause
        exit /b 1
    )
    echo npm 修复完成
    echo.
)

echo 检测到 npm 环境
npm --version
echo.

:: 检查项目依赖是否已安装
if not exist "node_modules" (
    echo 未找到依赖包，正在安装...
    echo ====================================
    npm install
    if %errorlevel% NEQ 0 (
        echo 依赖安装失败
        pause
        exit /b 1
    )
    echo 依赖安装完成
    echo ====================================
) else (
    echo 依赖包已存在，正在检查更新...
    echo ====================================
    npm update
    if %errorlevel% NEQ 0 (
        echo 依赖更新失败
        pause
        exit /b 1
    )
    echo 依赖更新完成
    echo ====================================
)
echo.
echo 启动开发服务器...
echo ====================================
npm run dev
pause
