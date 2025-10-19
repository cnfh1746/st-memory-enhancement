@echo off
chcp 65001 >nul
echo ========================================
echo   一键更新到GitHub仓库
echo ========================================
echo.

:: 检查是否有修改
echo [1/5] 检查文件状态...
git status

echo.
echo [2/5] 添加所有修改的文件...
git add .

echo.
echo [3/5] 提交修改...
set /p commit_msg="请输入提交信息 (直接回车使用默认信息): "
if "%commit_msg%"=="" (
    set commit_msg=Update: %date% %time%
)
git commit -m "%commit_msg%"

echo.
echo [4/5] 拉取远程更新（如果有）...
git pull origin main --rebase

echo.
echo [5/5] 推送到GitHub...
git push -u origin main

echo.
echo ========================================
echo   更新完成！
echo ========================================
pause
