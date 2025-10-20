# 推送到 GitHub 指南

## 🚨 网络问题解决方案

当前遇到了网络连接问题：`Failed to connect to github.com port 443`

## 📝 解决方案

### 方案 1: 使用 GitHub Desktop（推荐）⭐

1. **下载安装 GitHub Desktop**
   - 官网：https://desktop.github.com/
   - 或使用国内镜像下载

2. **操作步骤**：
   ```
   1. 打开 GitHub Desktop
   2. File -> Add Local Repository
   3. 选择当前目录：E:\AXMU\酒馆\记忆表格\st-memory-enhancement
   4. 点击 "Publish repository" 或 "Push origin"
   5. 完成！
   ```

### 方案 2: 配置代理

如果你有代理服务器，可以配置 Git 使用代理：

```bash
# HTTP 代理
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890

# SOCKS5 代理
git config --global http.proxy socks5://127.0.0.1:7890
git config --global https.proxy socks5://127.0.0.1:7890

# 推送
git push origin main

# 取消代理（如果需要）
git config --global --unset http.proxy
git config --global --unset https.proxy
```

### 方案 3: 使用 SSH 方式

1. **生成 SSH 密钥**（如果还没有）：
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   ```

2. **添加 SSH 密钥到 GitHub**：
   - 复制公钥：`cat ~/.ssh/id_ed25519.pub`
   - GitHub -> Settings -> SSH and GPG keys -> New SSH key
   - 粘贴公钥并保存

3. **修改远程地址并推送**：
   ```bash
   git remote set-url origin git@github.com:cnfh1746/st-memory-enhancement.git
   git push origin main
   ```

### 方案 4: 稍后重试

网络问题可能是暂时的，可以：
1. 检查网络连接
2. 等待一段时间后重试
3. 直接运行批处理文件：`update_to_github.bat`

## 📦 当前提交状态

✅ **代码已成功提交到本地仓库**

提交信息：
```
feat: 添加向量化语义搜索功能 - 支持智能表格数据检索，大幅降低token消耗

新增文件：
- services/embeddingApi.js         # Embedding API 服务
- services/vectorStore.js          # 向量存储服务
- utils/vectorMath.js              # 向量数学工具
- data/vectorConfig.js             # 配置文件
- scripts/settings/vectorSettings.js  # 设置界面
- test_vector_system.js            # 测试文件
- VECTOR_DEV_PLAN.md              # 开发计划
- VECTOR_INTEGRATION_GUIDE.md     # 集成指南

修改文件：
- index.js
- data/pluginSetting.js
- scripts/settings/userExtensionSetting.js
- assets/templates/index.html
- update_to_github.bat

删除过时文件：
- AUTO_TABLE_UPDATE_*.md
- scripts/runtime/autoTableUpdate.js
- scripts/runtime/autoUpdateLogger.js
```

## 🎯 推送成功后的验证

推送成功后，访问以下地址确认：
```
https://github.com/cnfh1746/st-memory-enhancement
```

应该能看到：
- ✅ 8 个新增文件
- ✅ 最新的提交记录
- ✅ 更新的 README 和文档

## 📞 需要帮助？

如果以上方案都不行，可以：
1. 检查防火墙设置
2. 尝试切换网络（手机热点等）
3. 联系网络管理员
4. 使用 VPN 服务

## 🔄 使用一键脚本

网络恢复后，直接双击运行：
```
update_to_github.bat
```

脚本会自动完成：
1. 检查 Git 状态
2. 添加所有更改
3. 提交到本地仓库
4. 推送到 GitHub

---

**提示**: 你的代码已经安全保存在本地 Git 仓库中，只是还没推送到 GitHub 而已。不用担心数据丢失！
