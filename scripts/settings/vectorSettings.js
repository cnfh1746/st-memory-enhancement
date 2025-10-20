/**
 * 向量化设置界面
 */

import { EDITOR, USER } from '../../core/manager.js';
import { loadVectorConfig, saveVectorConfig, validateVectorConfig } from '../../data/vectorConfig.js';
import VectorStore from '../../services/vectorStore.js';

// 全局向量存储实例
export let vectorStore = null;

/**
 * 初始化向量存储
 */
export async function initVectorStore() {
    if (vectorStore) {
        console.log('向量存储已存在');
        return vectorStore;
    }

    try {
        const config = loadVectorConfig(USER.tableBaseSetting);
        
        if (!config.enabled || !config.embedding.api_key) {
            console.log('向量功能未启用或未配置API Key');
            return null;
        }

        vectorStore = new VectorStore();
        await vectorStore.init(config.embedding);
        
        console.log('✅ 向量存储初始化成功');
        return vectorStore;
    } catch (error) {
        console.error('❌ 向量存储初始化失败:', error);
        EDITOR.error('向量存储初始化失败', error.message, error);
        return null;
    }
}

/**
 * 渲染向量设置界面
 */
export function renderVectorSettings() {
    const config = loadVectorConfig(USER.tableBaseSetting);
    
    const html = `
        <div class="vector-settings-container">
            <h3>🎯 向量化设置</h3>
            <p class="vector-description">
                使用向量化技术实现语义搜索，智能检索最相关的表格数据，大幅减少token消耗。
            </p>
            
            <!-- 启用开关 -->
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>启用向量搜索</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <label class="checkbox_label">
                        <input type="checkbox" id="vector_enabled" ${config.enabled ? 'checked' : ''}>
                        <span>启用向量化功能（需要配置API Key）</span>
                    </label>
                    <small>启用后，表格数据将自动进行向量化，支持语义搜索</small>
                </div>
            </div>

            <!-- Embedding API 配置 -->
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>Embedding API 配置</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <label for="vector_api_url">API 地址:</label>
                    <input type="text" id="vector_api_url" class="text_pole" 
                           value="${config.embedding.api_url}" 
                           placeholder="https://api.siliconflow.cn/v1">
                    
                    <label for="vector_api_key">API Key:</label>
                    <input type="password" id="vector_api_key" class="text_pole" 
                           value="${config.embedding.api_key}" 
                           placeholder="sk-xxxxxxxxxxxxxx">
                    
                    <label for="vector_model">模型:</label>
                    <input type="text" id="vector_model" class="text_pole" 
                           value="${config.embedding.model}" 
                           placeholder="BAAI/bge-large-zh-v1.5">
                    
                    <button id="test_vector_connection" class="menu_button">
                        <i class="fa-solid fa-plug"></i> 测试连接
                    </button>
                </div>
            </div>

            <!-- 搜索配置 -->
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>搜索配置</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <label for="vector_topk">返回结果数量 (Top-K):</label>
                    <input type="number" id="vector_topk" class="text_pole" 
                           value="${config.search.topK}" min="1" max="100">
                    <small>每次搜索返回最相关的N条结果</small>
                    
                    <label for="vector_min_score">最小相似度阈值:</label>
                    <input type="number" id="vector_min_score" class="text_pole" 
                           value="${config.search.minScore}" min="0" max="1" step="0.1">
                    <small>只返回相似度高于此值的结果</small>
                </div>
            </div>

            <!-- 向量化策略 -->
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>向量化策略</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <label class="checkbox_label">
                        <input type="checkbox" id="vector_auto_vectorize" 
                               ${config.vectorization.autoVectorize ? 'checked' : ''}>
                        <span>自动向量化新表格</span>
                    </label>
                    
                    <label class="checkbox_label">
                        <input type="checkbox" id="vector_vectorize_on_edit" 
                               ${config.vectorization.vectorizeOnEdit ? 'checked' : ''}>
                        <span>编辑后立即向量化</span>
                    </label>
                    
                    <button id="rebuild_all_vectors" class="menu_button">
                        <i class="fa-solid fa-rotate"></i> 重建所有向量
                    </button>
                    <small>重新生成所有表格的向量数据</small>
                </div>
            </div>

            <!-- 统计信息 -->
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>统计信息</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <div id="vector_stats_container">
                        <p>正在加载统计信息...</p>
                    </div>
                    <button id="refresh_vector_stats" class="menu_button">
                        <i class="fa-solid fa-sync"></i> 刷新统计
                    </button>
                </div>
            </div>

            <!-- 保存按钮 -->
            <div class="vector-actions">
                <button id="save_vector_settings" class="menu_button menu_button_icon">
                    <i class="fa-solid fa-save"></i> 保存设置
                </button>
            </div>
        </div>
    `;
    
    return html;
}

/**
 * 绑定向量设置事件
 */
export function bindVectorSettingsEvents() {
    // 保存设置
    $('#save_vector_settings').on('click', saveVectorSettings);
    
    // 测试连接
    $('#test_vector_connection').on('click', testVectorConnection);
    
    // 重建向量
    $('#rebuild_all_vectors').on('click', rebuildAllVectors);
    
    // 刷新统计
    $('#refresh_vector_stats').on('click', refreshVectorStats);
    
    // 启用开关变化
    $('#vector_enabled').on('change', function() {
        const enabled = $(this).is(':checked');
        if (enabled && !$('#vector_api_key').val()) {
            EDITOR.warning('请先配置 API Key');
            $(this).prop('checked', false);
        }
    });
}

/**
 * 保存向量设置
 */
async function saveVectorSettings() {
    try {
        const config = {
            enabled: $('#vector_enabled').is(':checked'),
            embedding: {
                api_url: $('#vector_api_url').val().trim(),
                api_key: $('#vector_api_key').val().trim(),
                model: $('#vector_model').val().trim(),
            },
            search: {
                topK: parseInt($('#vector_topk').val()),
                minScore: parseFloat($('#vector_min_score').val()),
            },
            vectorization: {
                autoVectorize: $('#vector_auto_vectorize').is(':checked'),
                vectorizeOnEdit: $('#vector_vectorize_on_edit').is(':checked'),
            }
        };
        
        // 验证配置
        const validation = validateVectorConfig(config);
        if (!validation.isValid) {
            EDITOR.warning(validation.errors.join('\n'));
            return;
        }
        
        // 保存配置
        saveVectorConfig(USER.tableBaseSetting, config);
        USER.saveChat();
        
        // 重新初始化向量存储
        if (config.enabled) {
            await initVectorStore();
        }
        
        EDITOR.success('向量设置已保存');
    } catch (error) {
        console.error('保存向量设置失败:', error);
        EDITOR.error('保存失败', error.message, error);
    }
}

/**
 * 测试向量连接
 */
async function testVectorConnection() {
    const button = $('#test_vector_connection');
    button.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 测试中...');
    
    try {
        const config = {
            api_url: $('#vector_api_url').val().trim(),
            api_key: $('#vector_api_key').val().trim(),
            model: $('#vector_model').val().trim(),
        };
        
        // 创建临时实例测试
        const { EmbeddingApiService } = await import('../../services/embeddingApi.js');
        const testService = new EmbeddingApiService(config);
        const success = await testService.testConnection();
        
        if (success) {
            EDITOR.success('✅ 连接成功！');
        } else {
            EDITOR.error('❌ 连接失败，请检查配置');
        }
    } catch (error) {
        console.error('测试连接失败:', error);
        EDITOR.error('连接测试失败', error.message, error);
    } finally {
        button.prop('disabled', false).html('<i class="fa-solid fa-plug"></i> 测试连接');
    }
}

/**
 * 重建所有向量
 */
async function rebuildAllVectors() {
    if (!vectorStore || !vectorStore.isInitialized) {
        EDITOR.warning('向量存储未初始化');
        return;
    }
    
    const confirmed = confirm('确定要重建所有向量吗？这可能需要一些时间。');
    if (!confirmed) return;
    
    const button = $('#rebuild_all_vectors');
    button.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 重建中...');
    
    try {
        await vectorStore.rebuildAll();
        EDITOR.success('✅ 向量重建完成');
        refreshVectorStats();
    } catch (error) {
        console.error('重建向量失败:', error);
        EDITOR.error('重建失败', error.message, error);
    } finally {
        button.prop('disabled', false).html('<i class="fa-solid fa-rotate"></i> 重建所有向量');
    }
}

/**
 * 刷新向量统计信息
 */
function refreshVectorStats() {
    const container = $('#vector_stats_container');
    
    if (!vectorStore || !vectorStore.isInitialized) {
        container.html('<p style="color: #888;">向量存储未初始化</p>');
        return;
    }
    
    const stats = vectorStore.getStats();
    
    let tableGroupsHtml = '';
    if (stats.tableGroups && Object.keys(stats.tableGroups).length > 0) {
        tableGroupsHtml = '<ul style="margin: 10px 0;">';
        for (const [tableName, count] of Object.entries(stats.tableGroups)) {
            tableGroupsHtml += `<li>${tableName}: ${count} 条</li>`;
        }
        tableGroupsHtml += '</ul>';
    }
    
    const html = `
        <div class="vector-stats">
            <p><strong>聊天ID:</strong> ${stats.chatId || '未知'}</p>
            <p><strong>总向量数:</strong> ${stats.totalVectors}</p>
            <p><strong>表格分组:</strong></p>
            ${tableGroupsHtml || '<p style="color: #888;">暂无数据</p>'}
        </div>
    `;
    
    container.html(html);
}

export default {
    initVectorStore,
    renderVectorSettings,
    bindVectorSettingsEvents,
    refreshVectorStats
};
