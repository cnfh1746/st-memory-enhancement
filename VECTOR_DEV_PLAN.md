# 🚀 SillyTavern记忆增强插件 - 向量化功能开发计划

## 📋 项目信息

**插件版本：** v2.0.3  
**目标功能：** 表格数据向量化 + RAG语义检索  
**开发模式：** MVP最小可行版本  
**预计周期：** 2-3周  
**开发日期：** 2025-10-20 开始

---

## 🎯 核心目标

### **主要目标**
1. 实现表格数据的向量化存储
2. 基于语义的智能检索相关表格行
3. 大幅减少token消耗（目标：减少80%以上）
4. 提升AI响应质量和速度
5. 保持现有功能完全兼容

### **技术目标**
- 使用SiliconFlow API进行向量化（BAAI/bge-large-zh-v1.5模型）
- IndexedDB本地存储向量数据
- 无感知模式：用户无需额外操作
- 自动降级：API失败时回退到传统模式

---

## 🔧 技术选型

### **1. Embedding API**
- **服务商：** SiliconFlow
- **API地址：** https://api.siliconflow.cn/v1/
- **模型：** BAAI/bge-large-zh-v1.5
- **向量维度：** 1024维
- **优势：** 中文优化，性能好，成本低

### **2. 存储方案**
- **主存储：** IndexedDB（浏览器本地）
- **数据结构：**
  ```javascript
  {
    chatId: "角色名_聊天ID",
    vectors: [{id, vector, metadata}],
    lastUpdate: timestamp
  }
  ```

### **3. 搜索算法**
- **算法：** 余弦相似度
- **Top-K：** 默认返回前10条相关数据
- **过滤：** 按当前聊天记录过滤

---

## 📁 文件结构规划

```
st-memory-enhancement/
├── services/
│   ├── embeddingApi.js          【新增】Embedding API封装
│   └── vectorStore.js            【新增】向量存储和搜索引擎
│
├── utils/
│   └── vectorMath.js             【新增】向量计算工具（余弦相似度等）
│
├── data/
│   └── vectorConfig.js           【新增】向量功能配置项
│
├── scripts/settings/
│   └── vectorSettings.js         【新增】向量设置UI逻辑
│
├── assets/templates/
