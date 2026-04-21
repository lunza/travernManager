@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ====================================
echo TravenManager 项目启动器
echo ====================================
echo.
echo 正在检查环境...
node --version
npm --version
echo.
echo 正在启动开发服务器...
echo ====================================
npm run dev
pause
