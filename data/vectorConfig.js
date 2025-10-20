/**
 * 向量化功能配置
 */

export const VECTOR_CONFIG = {
    // 是否启用向量搜索
    enabled: false,
    
    // Embedding API 配置
    embedding: {
        api_url: 'https://api.siliconflow.cn/v1',
        api_key: '',
        model: 'BAAI/bge-large-zh-v1.5',
        max_batch_size: 100,
        retry_times: 3,
        retry_delay: 1000
    },
    
    // 搜索配置
    search: {
        topK: 10,                    // 返回前K个最相关结果
        minScore: 0.5,               // 最小相似度阈值
        includeContext: true,        // 是否包含上下文
        contextSize: 3               // 上下文大小（前后N轮对话）
    },
    
    // 向量化策略
    vectorization: {
        autoVectorize: true,         // 是否自动向量化新表格
        vectorizeOnEdit: true,       // 编辑后是否立即向量化
        batchSize: 50,               // 批量处理大小
        debounceTime: 1000           // 防抖时间（毫秒）
    },
    
    // 存储配置
    storage: {
        dbName: 'st-memory-vectors',
        dbVersion: 1,
        storeName: 'vectors',
        maxVectorsPerChat: 10000     // 单个聊天最大向量数
    },
    
    // UI配置
    ui: {
        showStats: true,             // 显示统计信息
        showDebug: false,            // 显示调试信息
        notifyOnVectorize: true      // 向量化完成时通知
    },
    
    // 性能配置
    performance: {
        enableCache: true,           // 启用缓存
        cacheSize: 100,              // 缓存大小
        enableCompression: false     // 启用向量压缩（未来功能）
    }
};

/**
 * 从用户设置加载配置
 */
export function loadVectorConfig(userSettings) {
    if (!userSettings || !userSettings.vectorSettings) {
        return { ...VECTOR_CONFIG };
    }
    
    const config = { ...VECTOR_CONFIG };
    const saved = userSettings.vectorSettings;
    
    // 合并配置
    if (saved.enabled !== undefined) {
        config.enabled = saved.enabled;
    }
    
    if (saved.embedding) {
        config.embedding = { ...config.embedding, ...saved.embedding };
    }
    
    if (saved.search) {
        config.search = { ...config.search, ...saved.search };
    }
    
    if (saved.vectorization) {
        config.vectorization = { ...config.vectorization, ...saved.vectorization };
    }
    
    return config;
}

/**
 * 保存配置到用户设置
 */
export function saveVectorConfig(userSettings, config) {
    if (!userSettings) {
        return;
    }
    
    userSettings.vectorSettings = {
        enabled: config.enabled,
        embedding: config.embedding,
        search: config.search,
        vectorization: config.vectorization
    };
}

/**
 * 验证配置
 */
export function validateVectorConfig(config) {
    const errors = [];
    
    if (!config.embedding.api_url) {
        errors.push('API URL 不能为空');
    }
    
    if (!config.embedding.api_key) {
        errors.push('API Key 不能为空');
    }
    
    if (config.search.topK < 1 || config.search.topK > 100) {
        errors.push('TopK 必须在 1-100 之间');
    }
    
    if (config.search.minScore < 0 || config.search.minScore > 1) {
        errors.push('最小相似度必须在 0-1 之间');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

export default {
    VECTOR_CONFIG,
    loadVectorConfig,
    saveVectorConfig,
    validateVectorConfig
};
