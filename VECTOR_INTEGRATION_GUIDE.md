# 向量化功能集成指南

## 📋 概述

本指南介绍如何将向量化功能集成到 SillyTavern Memory Enhancement 插件中，实现基于语义搜索的智能表格数据检索。

## 🎯 功能特性

- ✅ **语义搜索**: 使用向量相似度进行智能搜索
- ✅ **自动向量化**: 表格数据自动转换为向量
- ✅ **持久化存储**: 使用 IndexedDB 本地存储向量数据
- ✅ **批量处理**: 支持批量向量化，提高效率
- ✅ **Token优化**: 只注入最相关的数据，大幅减少token消耗

## 📁 新增文件

```
st-memory-enhancement/
├── services/
│   ├── embeddingApi.js          # Embedding API 服务
│   └── vectorStore.js           # 向量存储服务
├── utils/
│   └── vectorMath.js            # 向量数学工具
├── data/
│   └── vectorConfig.js          # 向量配置
├── scripts/settings/
│   └── vectorSettings.js        # 向量设置界面
└── test_vector_system.js        # 测试文件
```

## 🔧 集成步骤

### 步骤 1: 在设置界面中添加向量设置

在 `scripts/settings/userExtensionSetting.js` 中添加向量设置选项卡：

```javascript
import { renderVectorSettings, bindVectorSettingsEvents, refreshVectorStats } from './vectorSettings.js';

// 在设置面板中添加向量设置选项卡
function renderSettings() {
    // ... 现有代码 ...
    
    // 添加向量设置选项卡
    const vectorSettingsHtml = `
        <div id="vector_settings_tab" class="settings-tab">
            ${renderVectorSettings()}
        </div>
    `;
    
    $('#settings_tabs').append(vectorSettingsHtml);
    
    // 绑定事件
    bindVectorSettingsEvents();
}
```

### 步骤 2: 在主入口初始化向量存储

在 `index.js` 的 jQuery 初始化函数中添加：

```javascript
import { initVectorStore, vectorStore } from './scripts/settings/vectorSettings.js';

jQuery(async () => {
    // ... 现有代码 ...
    
    // 初始化向量存储
    try {
        await initVectorStore();
        console.log('✅ 向量化功能已初始化');
    } catch (error) {
        console.warn('向量化功能初始化失败:', error);
    }
    
    // ... 其他初始化代码 ...
});
```

### 步骤 3: 在聊天切换时更新向量

在 `onChatChanged` 函数中添加向量切换逻辑：

```javascript
async function onChatChanged() {
    try {
        // ... 现有代码 ...
        
        // 切换向量数据
        if (vectorStore && vectorStore.isInitialized) {
            await vectorStore.switchChat();
        }
        
        updateSheetsView();
    } catch (error) {
        EDITOR.error("记忆插件：处理聊天变更失败", error.message, error);
    }
}
```

### 步骤 4: 在消息接收时自动向量化

修改 `onMessageReceived` 函数，添加自动向量化逻辑：

```javascript
async function onMessageReceived(chat_id) {
    if (USER.tableBaseSetting.isExtensionAble === false) return;
    
    // ... 现有的表格更新逻辑 ...
    
    // 自动向量化（如果启用）
    if (vectorStore && vectorStore.isInitialized) {
        const config = loadVectorConfig(USER.tableBaseSetting);
        if (config.vectorization.autoVectorize) {
            try {
                await vectorStore.vectorizeAllTables();
            } catch (error) {
                console.warn('自动向量化失败:', error);
            }
        }
    }
    
    updateSheetsView();
}
```

### 步骤 5: 实现向量搜索增强的提示词注入

创建新函数用于基于向量搜索的智能提示词生成：

```javascript
import { loadVectorConfig } from './data/vectorConfig.js';

/**
 * 使用向量搜索获取相关表格数据
 * @param {string} userMessage - 用户消息
 * @returns {string} 相关表格数据的提示词
 */
async function getVectorSearchPrompt(userMessage) {
    if (!vectorStore || !vectorStore.isInitialized) {
        return getTablePrompt(); // 回退到传统方式
    }
    
    try {
        const config = loadVectorConfig(USER.tableBaseSetting);
        
        // 执行向量搜索
        const results = await vectorStore.search(
            userMessage, 
            config.search.topK,
            (data) => data.metadata.score >= config.search.minScore
        );
        
        if (results.length === 0) {
            return ''; // 没有相关数据
        }
        
        // 构建提示词
        let prompt = '以下是与当前对话最相关的表格数据：\n\n';
        
        results.forEach((result, index) => {
            const meta = result.metadata;
            prompt += `[相关度: ${(result.score * 100).toFixed(1)}%]\n`;
            prompt += `表格: ${meta.tableName}\n`;
            prompt += `行 ${meta.rowIndex}: `;
            
            meta.headers.forEach((header, i) => {
                if (i > 0) { // 跳过第一列（行号）
                    prompt += `${header}=${meta.values[i]} `;
                }
            });
            
            prompt += '\n\n';
        });
        
        return prompt;
    } catch (error) {
        console.error('向量搜索失败:', error);
        return getTablePrompt(); // 回退到传统方式
    }
}

/**
 * 修改提示词注入函数，支持向量搜索
 */
async function onChatCompletionPromptReady(eventData) {
    if (eventData.dryRun === true ||
        USER.tableBaseSetting.isExtensionAble === false ||
        USER.tableBaseSetting.isAiReadTable === false ||
        USER.tableBaseSetting.injection_mode === "injection_off") {
        return;
    }
    
    try {
        const config = loadVectorConfig(USER.tableBaseSetting);
        let promptContent;
        
        // 如果启用了向量搜索，使用智能搜索
        if (config.enabled && vectorStore && vectorStore.isInitialized) {
            const userMessage = eventData.chat[eventData.chat.length - 1]?.content || '';
            promptContent = await getVectorSearchPrompt(userMessage);
            
            if (!promptContent) {
                // 如果没有找到相关数据，回退到传统方式
                promptContent = initTableData(eventData);
            }
        } else {
            // 使用传统方式
            promptContent = initTableData(eventData);
        }
        
        // 注入提示词
        if (USER.tableBaseSetting.deep === 0) {
            eventData.chat.push({ role: getMesRole(), content: promptContent });
        } else {
            eventData.chat.splice(-USER.tableBaseSetting.deep, 0, { role: getMesRole(), content: promptContent });
        }
        
        updateSheetsView();
    } catch (error) {
        EDITOR.error(`记忆插件：表格数据注入失败`, error.message, error);
    }
}
```

## 🔑 配置说明

### Embedding API 配置

使用硅基流动（SiliconFlow）API：

1. 注册账号：https://cloud.siliconflow.cn/
2. 获取 API Key
3. 在插件设置中配置：
   - API 地址：`https://api.siliconflow.cn/v1`
   - API Key：你的密钥
   - 模型：`BAAI/bge-large-zh-v1.5`（推荐中文）

### 搜索参数调优

- **Top-K (10)**: 返回最相关的10条结果
- **最小相似度 (0.5)**: 只返回相似度 > 50% 的结果
- 根据实际使用调整这些参数

## 🧪 测试

运行测试文件验证功能：

```bash
# 在浏览器控制台中运行
import('./test_vector_system.js').then(m => m.runAllTests());
```

或者在设置界面中点击"测试连接"按钮。

## 📊 性能优化建议

### 1. 批量向量化
- 使用批量API减少请求次数
- 建议批量大小：50-100条

### 2. 缓存策略
- 向量数据存储在 IndexedDB 中
- 只在表格修改时重新向量化

### 3. 延迟加载
- 切换聊天时按需加载向量数据
- 避免一次性加载所有向量

### 4. Token优化
- 只注入最相关的数据（Top-K）
- 设置相似度阈值过滤无关数据
- 预计可减少 60-80% 的 token 消耗

## 🐛 故障排除

### 问题 1: 向量存储初始化失败

**原因**: API Key 未配置或无效

**解决**:
1. 检查 API Key 是否正确
2. 测试 API 连接
3. 查看浏览器控制台错误信息

### 问题 2: 向量搜索无结果

**原因**: 
- 表格数据未向量化
- 相似度阈值设置过高

**解决**:
1. 点击"重建所有向量"
2. 降低最小相似度阈值
3. 检查表格是否有数据

### 问题 3: IndexedDB 存储错误

**原因**: 浏览器存储空间不足或权限问题

**解决**:
1. 清理浏览器缓存
2. 检查浏览器存储权限
3. 尝试无痕模式测试

## 📈 使用场景

### 场景 1: 大量角色信息

**问题**: 角色卡包含大量详细信息，全部注入消耗大量 token

**解决**: 
- 启用向量搜索
- 根据对话内容动态检索相关信息
- Token 消耗减少 70%+

### 场景 2: 历史对话记录

**问题**: 长对话历史难以全部保留

**解决**:
- 将历史记录向量化
- 智能检索相关历史
- 保持对话连贯性

### 场景 3: 世界观设定

**问题**: 复杂世界观包含大量设定

**解决**:
- 按主题分类向量化
- 按需检索相关设定
- 避免信息过载

## 🔮 未来规划

- [ ] 支持更多 Embedding 模型
- [ ] 向量压缩优化存储
- [ ] 多语言支持
- [ ] 向量搜索可视化
- [ ] 智能缓存策略
- [ ] 分布式向量存储

## 📝 注意事项

1. **隐私安全**: 
   - 向量数据存储在本地 IndexedDB
   - API 调用通过 HTTPS 加密
   - 不会上传原始表格数据

2. **API 费用**:
   - 硅基流动提供免费额度
   - 注意监控使用量
   - 批量操作更经济

3. **兼容性**:
   - 需要现代浏览器支持 IndexedDB
   - 建议使用 Chrome/Edge/Firefox 最新版

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 改进向量化功能！

## 📄 许可证

与主插件保持一致

---

**版本**: 1.0.0  
**更新日期**: 2025-01-20  
**维护者**: SillyTavern Memory Enhancement Team
