/**
 * 向量存储服务
 * 管理向量数据的存储、检索和持久化
 */

import { EmbeddingApiService } from './embeddingApi.js';
import { cosineSimilarity, rankBySimilarity } from '../utils/vectorMath.js';
import { EDITOR, USER, BASE } from '../core/manager.js';

export class VectorStore {
    constructor() {
        this.dbName = 'st-memory-vectors';
        this.dbVersion = 1;
        this.storeName = 'vectors';
        
        this.currentChatId = null;
        this.vectors = []; // 当前聊天的向量数据
        this.embeddingService = null;
        this.db = null;
        
        this.isInitialized = false;
        this.isVectorizing = false;
    }

    /**
     * 初始化向量存储
     * @param {Object} config - Embedding API 配置
     */
    async init(config) {
        if (this.isInitialized) {
            console.log('向量存储已初始化');
            return;
        }

        try {
            // 初始化 Embedding API
            this.embeddingService = new EmbeddingApiService(config);
            
            // 测试连接
            const connected = await this.embeddingService.testConnection();
            if (!connected) {
                throw new Error('Embedding API 连接失败');
            }

            // 打开 IndexedDB
            await this.openDB();

            // 加载当前聊天的向量数据
            await this.loadCurrentChat();

            this.isInitialized = true;
            console.log('✅ 向量存储初始化成功');
        } catch (error) {
            console.error('❌ 向量存储初始化失败:', error);
            throw error;
        }
    }

    /**
     * 打开 IndexedDB
     */
    async openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                reject(new Error('无法打开 IndexedDB'));
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // 创建对象存储
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, { keyPath: 'chatId' });
                    objectStore.createIndex('timestamp', 'lastUpdate', { unique: false });
                    console.log('创建向量存储对象');
                }
            };
        });
    }

    /**
     * 获取当前聊天ID
     */
    getCurrentChatId() {
        const context = USER.getContext?.();
        if (!context) return null;
        
        return `${context.name2 || 'unknown'}_${context.chat_id || Date.now()}`;
    }

    /**
     * 加载当前聊天的向量数据
     */
    async loadCurrentChat() {
        this.currentChatId = this.getCurrentChatId();
        
        if (!this.currentChatId) {
            console.warn('无法获取当前聊天ID');
            this.vectors = [];
            return;
        }

        try {
            const data = await this.getFromDB(this.currentChatId);
            
            if (data && data.vectors) {
                this.vectors = data.vectors;
                console.log(`✅ 加载了 ${this.vectors.length} 个向量 (${this.currentChatId})`);
            } else {
                this.vectors = [];
                console.log('📝 这是新聊天，开始自动向量化...');
                await this.vectorizeAllTables();
            }
        } catch (error) {
            console.error('加载向量数据失败:', error);
            this.vectors = [];
        }
    }

    /**
     * 切换聊天时调用
     */
    async switchChat() {
        // 保存当前聊天的向量
        if (this.currentChatId && this.vectors.length > 0) {
            await this.saveToDB();
        }

        // 加载新聊天的向量
        await this.loadCurrentChat();
    }

    /**
     * 向量化所有表格
     */
    async vectorizeAllTables() {
        if (this.isVectorizing) {
            console.log('向量化正在进行中...');
            return;
        }

        this.isVectorizing = true;

        try {
            const sheets = BASE.getChatSheets?.() || [];
            const enabledSheets = sheets.filter(sheet => sheet.enable);

            if (enabledSheets.length === 0) {
                console.log('没有启用的表格需要向量化');
                return;
            }

            console.log(`开始向量化 ${enabledSheets.length} 个表格...`);

            for (const sheet of enabledSheets) {
                await this.vectorizeTable(sheet);
            }

            await this.saveToDB();
            console.log('✅ 所有表格向量化完成');

        } catch (error) {
            console.error('向量化表格失败:', error);
        } finally {
            this.isVectorizing = false;
        }
    }

    /**
     * 向量化单个表格
     * @param {Object} sheet - 表格对象
     */
    async vectorizeTable(sheet) {
        try {
            const headers = sheet.getHeader?.() || [];
            const rows = sheet.getBody?.() || [];

            if (headers.length === 0 || rows.length === 0) {
                console.log(`表格 ${sheet.name} 为空，跳过`);
                return;
            }

            console.log(`向量化表格: ${sheet.name} (${rows.length} 行)`);

            // 生成文本描述
            const texts = rows.map((row, idx) => {
                return this.generateRowText(sheet.name, headers, row, idx);
            });

            // 批量向量化
            const vectors = await this.embeddingService.embedBatch(texts);

            // 存储向量
            rows.forEach((row, idx) => {
                const rowId = `${sheet.uid}_row${idx}`;
                this.addVector(rowId, vectors[idx], {
                    tableUid: sheet.uid,
                    tableName: sheet.name,
                    rowIndex: idx,
                    headers: headers,
                    values: row,
                    timestamp: Date.now()
                });
            });

            console.log(`✅ 表格 ${sheet.name} 向量化完成`);

        } catch (error) {
            console.error(`向量化表格 ${sheet.name} 失败:`, error);
        }
    }

    /**
     * 生成行的文本描述
     */
    generateRowText(tableName, headers, values, rowIndex) {
        const pairs = headers.map((header, i) => {
            const value = values[i] || '';
            return `${header}是${value}`;
        }).join('，');

        return `表格${tableName}第${rowIndex}行：${pairs}`;
    }

    /**
     * 添加或更新向量
     */
    addVector(id, vector, metadata) {
        const existingIndex = this.vectors.findIndex(v => v.id === id);
        
        const vectorData = {
            id: id,
            vector: vector,
            metadata: metadata
        };

        if (existingIndex >= 0) {
            this.vectors[existingIndex] = vectorData;
        } else {
            this.vectors.push(vectorData);
        }
    }

    /**
     * 删除向量
     */
    deleteVector(id) {
        this.vectors = this.vectors.filter(v => v.id !== id);
    }

    /**
     * 更新表格行
     * @param {Object} sheet - 表格对象
     * @param {number} rowIndex - 行索引
     */
    async updateRow(sheet, rowIndex) {
        try {
            const headers = sheet.getHeader();
            const row = sheet.getBody()[rowIndex];

            if (!row) {
                console.warn(`行 ${rowIndex} 不存在`);
                return;
            }

            const rowId = `${sheet.uid}_row${rowIndex}`;
            const text = this.generateRowText(sheet.name, headers, row, rowIndex);
            const vector = await this.embeddingService.embed(text);

            this.addVector(rowId, vector, {
                tableUid: sheet.uid,
                tableName: sheet.name,
                rowIndex: rowIndex,
                headers: headers,
                values: row,
                timestamp: Date.now()
            });

            await this.saveToDB();
            console.log(`✅ 向量已更新: ${rowId}`);

        } catch (error) {
            console.error('更新行向量失败:', error);
        }
    }

    /**
     * 语义搜索
     * @param {string} query - 查询文本
     * @param {number} topK - 返回前K个结果
     * @param {Function} filter - 可选的过滤函数
     */
    async search(query, topK = 10, filter = null) {
        if (!this.embeddingService) {
            throw new Error('Embedding服务未初始化');
        }

        if (this.vectors.length === 0) {
            console.warn('没有可搜索的向量数据');
            return [];
        }

        try {
            // 向量化查询
            const queryVector = await this.embeddingService.embed(query);

            // 准备候选向量
            let candidates = this.vectors.map(v => ({
                vector: v.vector,
                data: v
            }));

            // 应用过滤
            if (filter && typeof filter === 'function') {
                candidates = candidates.filter(c => filter(c.data));
            }

            // 计算相似度并排序
            const results = rankBySimilarity(queryVector, candidates, topK);

            return results.map(r => ({
                id: r.data.id,
                score: r.score,
                metadata: r.data.metadata
            }));

        } catch (error) {
            console.error('向量搜索失败:', error);
            return [];
        }
    }

    /**
     * 保存到 IndexedDB
     */
    async saveToDB() {
        if (!this.db || !this.currentChatId) {
            console.warn('无法保存: 数据库未初始化或聊天ID无效');
            return;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);

            const data = {
                chatId: this.currentChatId,
                vectors: this.vectors,
                lastUpdate: Date.now(),
                version: '1.0'
            };

            const request = objectStore.put(data);

            request.onsuccess = () => {
                console.log(`💾 向量数据已保存 (${this.vectors.length} 个)`);
                resolve();
            };

            request.onerror = () => {
                console.error('保存向量数据失败');
                reject(request.error);
            };
        });
    }

    /**
     * 从 IndexedDB 读取
     */
    async getFromDB(chatId) {
        if (!this.db) {
            throw new Error('数据库未初始化');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.get(chatId);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * 重建所有向量
     */
    async rebuildAll() {
        console.log('开始重建所有向量...');
        this.vectors = [];
        await this.vectorizeAllTables();
    }

    /**
     * 获取统计信息
     */
    getStats() {
        const tableGroups = {};
        
        this.vectors.forEach(v => {
            const tableName = v.metadata.tableName;
            if (!tableGroups[tableName]) {
                tableGroups[tableName] = 0;
            }
            tableGroups[tableName]++;
        });

        return {
            totalVectors: this.vectors.length,
            tableGroups: tableGroups,
            chatId: this.currentChatId,
            isInitialized: this.isInitialized
        };
    }

    /**
     * 清理当前聊天的向量
     */
    async clearCurrentChat() {
        this.vectors = [];
        await this.saveToDB();
        console.log('✅ 已清理当前聊天的向量数据');
    }
}

export default VectorStore;
