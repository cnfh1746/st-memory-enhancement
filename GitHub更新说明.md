# GitHub仓库更新说明

## 仓库地址
https://github.com/cnfh1746/st-memory-enhancement.git

## 一键更新脚本使用方法

### 方法1: 使用 update_to_github.bat（推荐）

1. 双击运行 `update_to_github.bat`
2. 脚本会自动执行以下操作：
   - 检查文件修改状态
   - 添加所有修改的文件
   - 提示输入提交信息（可直接回车使用默认信息）
   - 拉取远程更新
   - 推送到GitHub

### 方法2: 手动使用Git命令

```bash
# 1. 查看修改状态
git status

# 2. 添加所有修改
git add .

# 3. 提交修改
git commit -m "你的提交信息"

# 4. 推送到远程
git push origin main
```

## 常见问题

### 1. 推送失败：权限问题
如果遇到权限问题，需要配置GitHub认证：

**方法A: 使用Personal Access Token（推荐）**
1. 访问 GitHub Settings → Developer settings → Personal access tokens
2. 生成新的token，勾选 `repo` 权限
3. 第一次推送时，用户名输入GitHub用户名，密码输入token

**方法B: 使用SSH密钥**
```bash
# 生成SSH密钥
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# 添加到GitHub账户
# 复制 ~/.ssh/id_rsa.pub 的内容到 GitHub Settings → SSH keys
```

### 2. 拉取冲突
如果远程有其他人的提交，可能需要先拉取：
```bash
git pull origin main --rebase
# 解决冲突后
git push origin main
```

### 3. 查看提交历史
```bash
git log --oneline
```

### 4. 撤销本地修改
```bash
# 撤销某个文件的修改
git checkout -- filename

# 撤销所有修改
git reset --hard HEAD
```

## 分支管理

### 创建新分支
```bash
git checkout -b feature-name
```

### 切换分支
```bash
git checkout main
git checkout feature-name
```

### 合并分支
```bash
git checkout main
git merge feature-name
```

## 忽略文件

如果需要忽略某些文件，编辑 `.gitignore` 文件：
```
# 示例
node_modules/
*.log
.env
```

## 最佳实践

1. **提交前检查**: 先用 `git status` 查看修改
2. **清晰的提交信息**: 描述本次修改的内容
3. **频繁提交**: 完成一个功能就提交一次
4. **推送前拉取**: 先 `git pull` 再 `git push`
5. **使用分支**: 新功能在新分支开发

## 提交信息规范建议

```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 重构代码
test: 测试相关
chore: 构建/工具链相关

示例：
feat: 添加自动填表功能
fix: 修复表格更新bug
docs: 更新README文档
```

## 团队协作

### 克隆仓库
```bash
git clone https://github.com/cnfh1746/st-memory-enhancement.git
```

### 保持同步
```bash
# 获取远程更新
git fetch origin

# 合并到本地
git merge origin/main
# 或使用 rebase
git rebase origin/main
```

---

**首次推送时间**: 2025-01-19  
**当前分支**: main  
**远程仓库**: https://github.com/cnfh1746/st-memory-enhancement.git
