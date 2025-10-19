/**
 * 自动表格更新模块
 * 用于在AI回复后自动分析内容并在后台完成填表，无需在正文中注入填表指令
 */

import { APP, BASE, EDITOR, SYSTEM, USER } from '../../core/manager.js';
import { executeTableEditActions, getTablePrompt, initTableData } from "../../index.js";
import { handleCustomAPIRequest, handleMainAPIRequest, estimateTokenCount } from "../settings/standaloneAPI.js";
import { updateSystemMessageTableStatus } from "../renderer/tablePushToChat.js";
import JSON5 from '../../utils/json5.min.mjs';

// 自动填表队列，防止并发问题
let autoUpdateQueue = [];
let isProcessing = false;

/**
 * 注册AI回复监听器
 * 在AI生成回复后自动触发表格分析
 */
export function registerAutoTableUpdateListener() {
    console.log('[自动填表] 开始注册监听器...');
    console.log('[自动填表] 当前配置:', {
        enabled: USER.tableBaseSetting.auto_table_update_enabled,
        useMainAPI: USER.tableBaseSetting.auto_update_use_main_api,
        silentMode: USER.tableBaseSetting.auto_update_silent_mode
    });
    
    // 监听AI回复事件
    if (APP && APP.eventSource) {
        APP.eventSource.on(APP.event_types.CHARACTER_MESSAGE_RENDERED, handleNewAIMessage);
        console.log('[自动填表] ✅ 监听器注册成功 - 已绑定到 CHARACTER_MESSAGE_RENDERED 事件');
    } else {
        console.error('[自动填表] ❌ 无法注册监听器 - APP.eventSource 不可用');
    }
}

/**
 * 注销监听器
 */
export function unregisterAutoTableUpdateListener() {
    if (APP && APP.eventSource) {
        APP.eventSource.removeListener(APP.event_types.CHARACTER_MESSAGE_RENDERED, handleNewAIMessage);
        console.log('[自动填表] 监听器已注销');
    }
}

/**
 * 处理新的AI消息
 */
async function handleNewAIMessage(data) {
    console.log('[自动填表] ⚡ 触发事件 - CHARACTER_MESSAGE_RENDERED', data);
    
    // 检查是否启用自动填表
    if (!USER.tableBaseSetting.auto_table_update_enabled) {
        console.log('[自动填表] ⏸️ 功能未启用，跳过处理');
        return;
    }
    
    // 检查是否是AI消息
    const { piece } = USER.getChatPiece();
    if (!piece) {
        console.log('[自动填表] ⚠️ 未找到聊天片段');
        return;
    }
    
    if (piece.is_user) {
        console.log('[自动填表] ⏭️ 用户消息，跳过');
        return;
    }
    
    console.log('[自动填表] ✅ 检测到AI回复，准备分析...', {
        messageLength: piece.mes?.length || 0,
        timestamp: new Date().toLocaleTimeString()
    });
    
    // 添加到队列
    autoUpdateQueue.push({
        piece,
        timestamp: Date.now()
    });
    
    // 处理队列
    processAutoUpdateQueue();
}

/**
 * 处理自动更新队列
 */
async function processAutoUpdateQueue() {
    if (isProcessing || autoUpdateQueue.length === 0) return;
    
    isProcessing = true;
    
    try {
        while (autoUpdateQueue.length > 0) {
            const task = autoUpdateQueue.shift();
            await executeAutoTableUpdate(task.piece);
            
            // 添加短暂延迟，避免API请求过快
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } finally {
        isProcessing = false;
    }
}

/**
 * 执行自动表格更新
 * @param {Object} piece - 当前聊天片段
 */
async function executeAutoTableUpdate(piece) {
    try {
        // 获取AI刚刚生成的文本内容
        const aiMessage = piece.mes || '';
        
        if (!aiMessage.trim()) {
            console.log('[自动填表] AI消息为空，跳过');
            return;
        }
        
        // 检查消息长度，太短的消息可能不包含有价值的信息
        const minLength = USER.tableBaseSetting.auto_update_min_message_length || 50;
        if (aiMessage.length < minLength) {
            console.log(`[自动填表] 消息长度不足 (${aiMessage.length} < ${minLength})，跳过`);
            return;
        }
        
        // 显示后台处理提示
        if (!USER.tableBaseSetting.auto_update_silent_mode) {
            EDITOR.info('正在后台分析并更新表格...', '', 1000);
        }
        
        // 构建分析提示词
        const analysisResult = await analyzeMessageAndGenerateActions(aiMessage, piece);
        
        if (!analysisResult || analysisResult === 'no_update') {
            console.log('[自动填表] AI判断无需更新表格');
            return;
        }
        
        if (analysisResult === 'suspended' || analysisResult === 'error') {
            console.log('[自动填表] 分析过程被中断或出错');
            return;
        }
        
        // 执行表格操作
        const success = await applyTableActions(analysisResult, piece);
        
        if (success) {
            // 保存更新
            await USER.saveChat();
            BASE.refreshContextView();
            updateSystemMessageTableStatus();
            
            if (!USER.tableBaseSetting.auto_update_silent_mode) {
                EDITOR.success('表格已自动更新', '', 1500);
            }
            
            console.log('[自动填表] 表格更新成功');
        }
        
    } catch (error) {
        console.error('[自动填表] 执行出错:', error);
        if (!USER.tableBaseSetting.auto_update_silent_mode) {
            EDITOR.error('自动填表失败', error.message);
        }
    }
}

/**
 * 分析消息并生成表格操作指令
 * @param {string} aiMessage - AI生成的消息
 * @param {Object} piece - 聊天片段
 * @returns {Promise<string|Object>} 返回操作指令或状态
 */
async function analyzeMessageAndGenerateActions(aiMessage, piece) {
    try {
        // 获取当前表格状态
        const currentTableText = getTablePrompt(piece);
        const tableInfo = initTableData();
        
        // 获取上下文（可选，根据设置）
        const contextDepth = USER.tableBaseSetting.auto_update_context_depth || 3;
        const recentContext = await getRecentMessages(contextDepth);
        
        // 获取世界书内容（如果启用）
        let lorebookContent = '';
        if (USER.tableBaseSetting.auto_update_use_lorebook && window.TavernHelper) {
            try {
                const charLorebooks = await window.TavernHelper.getCharLorebooks({ type: 'all' });
                const bookNames = [];
                if (charLorebooks.primary) bookNames.push(charLorebooks.primary);
                if (charLorebooks.additional) bookNames.push(...charLorebooks.additional);
                
                for (const bookName of bookNames) {
                    if (bookName) {
                        const entries = await window.TavernHelper.getLorebookEntries(bookName);
                        if (entries && entries.length > 0) {
                            lorebookContent += entries.map(entry => entry.content).join('\n');
                        }
                    }
                }
            } catch (e) {
                console.error('[自动填表] 获取世界书失败:', e);
            }
        }
        
        // 构建分析提示词
        const promptTemplate = USER.tableBaseSetting.auto_update_prompt_template || getDefaultAutoUpdatePrompt();
        
        // 解析提示词模板（支持多消息格式）
        let promptMessages;
        try {
            promptMessages = JSON5.parse(promptTemplate);
            if (!Array.isArray(promptMessages)) {
                throw new Error("提示词模板必须是消息数组");
            }
        } catch (e) {
            console.error('[自动填表] 提示词模板解析失败:', e);
            return 'error';
        }
        
        // 替换占位符
        const processedMessages = promptMessages.map(msg => ({
            ...msg,
            content: msg.content
                .replace(/\$0/g, currentTableText)      // 当前表格状态
                .replace(/\$1/g, recentContext)         // 最近上下文
                .replace(/\$2/g, aiMessage)             // AI刚生成的消息
                .replace(/\$3/g, tableInfo)             // 表格说明
                .replace(/\$4/g, lorebookContent)       // 世界书内容
        }));
        
        console.log('[自动填表] 发送分析请求...');
        
        // 调用API进行分析
        const useMainAPI = USER.tableBaseSetting.auto_update_use_main_api ?? false;
        let rawResponse;
        
        if (useMainAPI) {
            rawResponse = await handleMainAPIRequest(processedMessages, null, true); // 静默模式
        } else {
            rawResponse = await handleCustomAPIRequest(processedMessages, null, true, true); // 静默模式
        }
        
        if (rawResponse === 'suspended') {
            return 'suspended';
        }
        
        if (!rawResponse || !rawResponse.trim()) {
            console.log('[自动填表] API返回空响应');
            return 'no_update';
        }
        
        console.log('[自动填表] AI分析结果:', rawResponse);
        
        return rawResponse;
        
    } catch (error) {
        console.error('[自动填表] 分析过程出错:', error);
        return 'error';
    }
}

/**
 * 应用表格操作
 * @param {string} actionsText - 包含操作指令的文本
 * @param {Object} piece - 聊天片段
 * @returns {Promise<boolean>}
 */
async function applyTableActions(actionsText, piece) {
    try {
        // 检查是否包含"无需更新"等关键词
        const noUpdateKeywords = ['无需更新', '不需要更新', 'no update', 'no changes', '无变化'];
        if (noUpdateKeywords.some(keyword => actionsText.toLowerCase().includes(keyword.toLowerCase()))) {
            console.log('[自动填表] AI判断无需更新');
            return false;
        }
        
        // 提取tableEdit标签内容
        const tableEditRegex = /<tableEdit>([\s\S]*?)<\/tableEdit>/gi;
        const matches = [];
        let match;
        
        while ((match = tableEditRegex.exec(actionsText)) !== null) {
            matches.push(match[1].trim());
        }
        
        if (matches.length === 0) {
            console.log('[自动填表] 未找到有效的tableEdit指令');
            return false;
        }
        
        console.log(`[自动填表] 找到 ${matches.length} 个操作指令`);
        
        // 执行表格操作
        executeTableEditActions(matches, piece);
        
        return true;
        
    } catch (error) {
        console.error('[自动填表] 应用操作失败:', error);
        throw error;
    }
}

/**
 * 获取最近的消息作为上下文
 * @param {number} depth - 获取消息的深度
 * @returns {Promise<string>}
 */
async function getRecentMessages(depth) {
    const chat = USER.getContext().chat;
    if (!chat || chat.length === 0) return '';
    
    const messages = [];
    const startIndex = Math.max(0, chat.length - depth - 1);
    
    for (let i = startIndex; i < chat.length - 1; i++) {
        const msg = chat[i];
        // 移除已有的tableEdit标签
        const cleanMsg = msg.mes.replace(/<tableEdit>[\s\S]*?<\/tableEdit>/g, '').trim();
        if (cleanMsg) {
            messages.push(`${msg.name}: ${cleanMsg}`);
        }
    }
    
    return messages.join('\n');
}

/**
 * 获取默认的自动更新提示词模板
 */
function getDefaultAutoUpdatePrompt() {
    return JSON.stringify([
        {
            role: "system",
            content: `你是一个智能助手，负责分析对话内容并更新结构化表格。

# 任务说明
1. 分析AI刚刚生成的回复内容
2. 根据回复内容判断是否需要更新表格
3. 如果需要更新，生成精确的表格操作指令

# 表格操作格式
使用以下格式输出操作指令：
<tableEdit>
<!--
insertRow(tableIndex, {0: "值1", 1: "值2", ...})
updateRow(tableIndex, rowIndex, {0: "新值1", ...})
deleteRow(tableIndex, rowIndex)
-->
</tableEdit>

# 重要规则
- 如果回复内容不涉及需要记录的信息，直接回复"无需更新"
- 只更新确实发生变化的内容
- 保持表格结构的一致性
- 列索引从0开始`
        },
        {
            role: "user",
            content: `# 当前表格状态
$0

# 表格说明
$3

# 最近对话上下文
$1

# AI刚生成的回复
$2

# 世界书信息
$4

请分析以上内容，判断是否需要更新表格。如果需要，请生成操作指令。`
        }
    ], null, 2);
}

/**
 * 手动触发自动填表（用于测试）
 */
export async function triggerAutoUpdateManually() {
    const { piece } = USER.getChatPiece();
    if (!piece) {
        EDITOR.error('没有可用的聊天片段');
        return;
    }
    
    EDITOR.info('手动触发自动填表...');
    await executeAutoTableUpdate(piece);
}

// 导出配置默认值
export const AUTO_UPDATE_DEFAULT_SETTINGS = {
    auto_table_update_enabled: false,           // 是否启用自动填表
    auto_update_use_main_api: false,            // 使用主API还是独立API
    auto_update_silent_mode: false,             // 静默模式（不显示提示）
    auto_update_min_message_length: 50,         // 最小消息长度
    auto_update_context_depth: 3,               // 上下文深度
    auto_update_use_lorebook: true,             // 是否使用世界书
    auto_update_prompt_template: getDefaultAutoUpdatePrompt() // 提示词模板
};
