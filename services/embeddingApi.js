/**
 * Embedding API 服务
 * 用于调用 SiliconFlow 的向量化接口
 */

import { EDITOR } from '../core/manager.js';

export class EmbeddingApiService {
    constructor(config = {}) {
        this.config = {
            api_url: config.api_url || 'https://api.siliconflow.cn/v1',
            api_key: config.api_key || '',
            model: config.model || 'BAAI/bge-large-zh-v1.5',
            max_batch_size: config.max_batch_size || 100, // 每批最大处理数量
            retry_times: config.retry_times || 3,
            retry_delay: config.retry_delay || 1000
        };
        
        this.requestQueue = [];
        this.isProcessing = false;
    }

    /**
     * 单条文本向量化
     * @param {string} text - 要向量化的文本
     * @returns {Promise<number[]>} 向量数组
     */
    async embed(text) {
        if (!text || typeof text !== 'string') {
            throw new Error('输入文本无效');
        }

        const result = await this.embedBatch([text]);
        return result[0];
    }

    /**
     * 批量文本向量化
     * @param {string[]} texts - 文本数组
     * @returns {Promise<number[][]>} 向量数组的数组
     */
    async embedBatch(texts) {
        if (!Array.isArray(texts) || texts.length === 0) {
            throw new Error('输入文本数组无效');
        }

        if (!this.config.api_key) {
            throw new Error('未配置 Embedding API Key');
        }

        // 分批处理
        const results = [];
        for (let i = 0; i < texts.length; i += this.config.max_batch_size) {
            const batch = texts.slice(i, i + this.config.max_batch_size);
            const batchResults = await this._embedBatchInternal(batch);
            results.push(...batchResults);
            
            // 避免API限流
            if (i + this.config.max_batch_size < texts.length) {
                await this._sleep(100);
            }
        }

        return results;
    }

    /**
     * 内部批量向量化实现
     * @private
     */
    async _embedBatchInternal(texts) {
        let lastError = null;

        for (let attempt = 0; attempt < this.config.retry_times; attempt++) {
            try {
                const response = await fetch(`${this.config.api_url}/embeddings`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.config.api_key}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: this.config.model,
                        input: texts,
                        encoding_format: 'float'
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`API请求失败: ${response.status} - ${errorText}`);
                }

                const data = await response.json();

                if (!data.data || !Array.isArray(data.data)) {
                    throw new Error('API返回数据格式错误');
                }

                // 提取向量数据
                return data.data.map(item => item.embedding);

            } catch (error) {
                lastError = error;
                console.warn(`Embedding API 请求失败 (尝试 ${attempt + 1}/${this.config.retry_times}):`, error);

                if (attempt < this.config.retry_times - 1) {
                    await this._sleep(this.config.retry_delay * (attempt + 1));
                }
            }
        }

        // 所有重试都失败
        throw new Error(`Embedding API 请求失败: ${lastError.message}`);
    }

    /**
     * 测试API连接
     * @returns {Promise<boolean>} 是否连接成功
     */
    async testConnection() {
        try {
            const testText = '测试连接';
            await this.embed(testText);
            console.log('✅ Embedding API 连接成功');
            return true;
        } catch (error) {
            console.error('❌ Embedding API 连接失败:', error);
            return false;
        }
    }

    /**
     * 估算文本的token数量（粗略估算）
     * @param {string} text - 文本内容
     * @returns {number} 估算的token数
     */
    estimateTokens(text) {
        // 中文字符算1个token，英文单词算1.3个token
        const chineseCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
        const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
        const symbols = text.length - chineseCount - englishWords;
        
        return Math.ceil(chineseCount + englishWords * 1.3 + symbols * 0.5);
    }

    /**
     * 估算批量向量化的成本
     * @param {string[]} texts - 文本数组
     * @returns {Object} 成本信息
     */
    estimateCost(texts) {
        const totalTokens = texts.reduce((sum, text) => sum + this.estimateTokens(text), 0);
        
        // SiliconFlow 的计费标准 (需要根据实际情况调整)
        const costPerMillionTokens = 0.0001; // 假设值
        const estimatedCost = (totalTokens / 1000000) * costPerMillionTokens;

        return {
            totalTexts: texts.length,
            totalTokens: totalTokens,
            estimatedCost: estimatedCost.toFixed(6),
            currency: 'USD'
        };
    }

    /**
     * 延迟函数
     * @private
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 更新配置
     * @param {Object} newConfig - 新配置
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * 获取当前配置
     * @returns {Object} 当前配置
     */
    getConfig() {
        return { ...this.config };
    }
}

export default EmbeddingApiService;
