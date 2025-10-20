@echo off
chcp 65001 >nul
echo ====================================
echo  SillyTavern Memory Enhancement
echo  一键更新到 GitHub 仓库
echo ====================================
echo.

REM 检查是否在 Git 仓库中
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo [错误] 当前目录不是 Git 仓库！
    echo.
    echo 正在初始化 Git 仓库...
    git init
    git remote add origin https://github.com/cnfh1746/st-memory-enhancement.git
    echo Git 仓库初始化完成！
    echo.
)

REM 检查是否有远程仓库
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo [提示] 添加远程仓库...
    git remote add origin https://github.com/cnfh1746/st-memory-enhancement.git
)

echo [步骤 1/5] 检查文件状态...
git status
echo.

echo [步骤 2/5] 添加所有更改...
git add .
echo ✓ 文件已添加
echo.

echo [步骤 3/5] 提交更改...
set /p commit_message="请输入提交说明（直接回车使用默认）: "
if "%commit_message%"=="" (
    set commit_message=更新向量化功能模块
)
git commit -m "%commit_message%"
if errorlevel 1 (
    echo [提示] 没有需要提交的更改
) else (
    echo ✓ 提交成功
)
echo.

echo [步骤 4/5] 拉取远程更新...
git pull origin main --rebase
if errorlevel 1 (
    echo [警告] 拉取失败，可能是首次推送
    git branch -M main
)
echo.

echo [步骤 5/5] 推送到 GitHub...
git push -u origin main
if errorlevel 1 (
    echo.
    echo [错误] 推送失败！可能的原因：
    echo 1. 需要配置 GitHub 认证
    echo 2. 网络连接问题
    echo 3. 权限不足
    echo.
    echo 解决方案：
    echo - 方案1: 使用 GitHub Desktop 进行推送
    echo - 方案2: 配置 SSH 密钥
    echo - 方案3: 使用个人访问令牌（PAT）
    echo.
    pause
    exit /b 1
)

echo.
echo ====================================
echo ✓ 成功推送到 GitHub！
echo 仓库地址: https://github.com/cnfh1746/st-memory-enhancement
echo ====================================
echo.
pause
