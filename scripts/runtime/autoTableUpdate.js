/**
 * 自动表格更新模块 - 完全重写版本
 * 参考 Amily2 项目的实现方式
 */

import { APP, BASE, EDITOR, USER } from '../../core/manager.js';
import { executeTableEditActions, getTablePrompt, initTableData } from "../../index.js";
import { handleCustomAPIRequest, handleMainAPIRequest } from "../settings/standaloneAPI.js";
import { updateSystemMessageTableStatus } from "../renderer/tablePushToChat.js";
import JSON5 from '../../utils/json5.min.mjs';

// 导入日志管理器
let logger = null;

// 获取日志器（延迟加载）
function getLogger() {
    if (!logger && window.autoUpdateLogger) {
        logger = window.autoUpdateLogger;
    }
    return logger;
}

// 调试日志函数 - 同时输出到控制台和日志面板
function debugLog(message, data = null, level = 'info') {
    const log = getLogger();
    if (log) {
        log.log(level, message, data);
    } else {
        // 如果日志系统还未初始化，退回到控制台
        const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false, fractionalSecondDigits: 3 });
        console.log(`[自动填表 ${timestamp}] ${message}`);
        if (data) {
            console.log('[自动填表 数据]', data);
        }
    }
}

// 全局状态
let isProcessing = false;
let eventListenerRegistered = false;

/**
 * 注册AI回复监听器
 */
export function registerAutoTableUpdateListener() {
    debugLog('========================================');
    debugLog('开始注册自动填表监听器');
    debugLog('========================================');
    
    // 检查 APP 对象
    if (!APP) {
        debugLog('❌ APP 对象不存在！', null, 'error');
        return;
    }
    debugLog('✅ APP 对象存在', null, 'success');
    
    // 检查 eventSource
    if (!APP.eventSource) {
        debugLog('❌ APP.eventSource 不存在！', null, 'error');
        return;
    }
    debugLog('✅ APP.eventSource 存在', null, 'success');
    
    // 检查 event_types
    if (!APP.event_types) {
        debugLog('❌ APP.event_types 不存在！', null, 'error');
        return;
    }
    debugLog('✅ APP.event_types 存在', APP.event_types, 'success');
    
    // 检查 MESSAGE_RECEIVED 事件
    if (!APP.event_types.MESSAGE_RECEIVED) {
        debugLog('❌ MESSAGE_RECEIVED 事件类型不存在！', null, 'error');
        return;
    }
    debugLog('✅ MESSAGE_RECEIVED 事件类型存在', APP.event_types.MESSAGE_RECEIVED, 'success');
    
    // 检查配置
    debugLog('当前配置', {
        enabled: USER.tableBaseSetting?.auto_table_update_enabled,
        useMainAPI: USER.tableBaseSetting?.auto_update_use_main_api,
        silentMode: USER.tableBaseSetting?.auto_update_silent_mode
    }, 'info');
    
    // 防止重复注册
    if (eventListenerRegistered) {
        debugLog('⚠️ 监听器已经注册过，跳过重复注册', null, 'warning');
        return;
    }
    
    // 注册监听器
    try {
        APP.eventSource.on(APP.event_types.MESSAGE_RECEIVED, handleMessageReceived);
        eventListenerRegistered = true;
        debugLog('========================================');
        debugLog('✅✅✅ 监听器注册成功！✅✅✅', null, 'success');
        debugLog('========================================');
    } catch (error) {
        debugLog('❌ 注册监听器时出错', error, 'error');
    }
}

/**
 * 注销监听器
 */
export function unregisterAutoTableUpdateListener() {
    if (APP && APP.eventSource && eventListenerRegistered) {
        APP.eventSource.removeListener(APP.event_types.MESSAGE_RECEIVED, handleMessageReceived);
        eventListenerRegistered = false;
        debugLog('监听器已注销', null, 'info');
    }
}

/**
 * 处理消息接收事件 - 这个函数会在每次AI回复时被调用
 */
async function handleMessageReceived(chatId) {
    debugLog('========================================');
    debugLog('⚡⚡⚡ MESSAGE_RECEIVED 事件触发！⚡⚡⚡', null, 'info');
    debugLog('========================================');
    debugLog('接收到的 chatId', chatId, 'info');
    
    try {
        // 步骤1: 检查功能是否启用
        debugLog('[步骤1] 检查功能是否启用...', null, 'info');
        const isEnabled = USER.tableBaseSetting?.auto_table_update_enabled === true;
        debugLog('[步骤1] 功能启用状态', isEnabled, 'info');
        
        if (!isEnabled) {
            debugLog('[步骤1] ⏸️ 自动填表功能未启用，退出', null, 'warning');
            return;
        }
        
        // 步骤2: 检查是否正在处理
        debugLog('[步骤2] 检查处理状态...', null, 'info');
        if (isProcessing) {
            debugLog('[步骤2] ⏸️ 正在处理中，跳过本次请求', null, 'warning');
            return;
        }
        
        // 步骤3: 获取聊天上下文
        debugLog('[步骤3] 获取聊天上下文...', null, 'info');
        const context = USER.getContext();
        if (!context || !context.chat) {
            debugLog('[步骤3] ❌ 无法获取聊天上下文', null, 'error');
            return;
        }
        debugLog('[步骤3] 聊天长度', context.chat.length, 'success');
        
        // 步骤4: 获取最新消息
        debugLog('[步骤4] 获取最新消息...', null, 'info');
        const latestMessage = context.chat[context.chat.length - 1];
        if (!latestMessage) {
            debugLog('[步骤4] ❌ 无法获取最新消息', null, 'error');
            return;
        }
        
        debugLog('[步骤4] 最新消息信息', {
            is_user: latestMessage.is_user,
            name: latestMessage.name,
            消息长度: latestMessage.mes?.length || 0,
            消息预览: latestMessage.mes?.substring(0, 100) || ''
        }, 'info');
        
        // 步骤5: 检查是否是用户消息
        if (latestMessage.is_user) {
            debugLog('[步骤5] ⏭️ 这是用户消息，跳过', null, 'warning');
            return;
        }
        
        debugLog('[步骤5] ✅ 这是AI消息，继续处理', null, 'success');
        
        // 步骤6: 检查消息长度
        debugLog('[步骤6] 检查消息长度...', null, 'info');
        const minLength = USER.tableBaseSetting.auto_update_min_message_length || 50;
        const messageLength = latestMessage.mes?.length || 0;
        debugLog('[步骤6] 消息长度检查', { 实际长度: messageLength, 最小要求: minLength }, 'info');
        
        if (messageLength < minLength) {
            debugLog('[步骤6] ⏭️ 消息太短，跳过', null, 'warning');
            return;
        }
        
        // 步骤7: 开始处理
        debugLog('[步骤7] ✅ 所有检查通过，开始处理自动填表', null, 'success');
        debugLog('========================================');
        
        isProcessing = true;
        
        await processAutoTableUpdate(latestMessage);
        
    } catch (error) {
        debugLog('❌ 处理过程中出错', { message: error.message, stack: error.stack }, 'error');
    } finally {
        isProcessing = false;
        debugLog('========================================');
        debugLog('处理完成，重置处理状态', null, 'info');
        debugLog('========================================');
    }
}

/**
 * 执行自动表格更新
 */
async function processAutoTableUpdate(message) {
    try {
        debugLog('[处理] 开始自动填表流程', null, 'info');
        
        // 显示处理提示
        if (!USER.tableBaseSetting.auto_update_silent_mode) {
            EDITOR.info('正在后台分析并更新表格...', '', 1000);
        }
        
        // 获取当前表格数据
        debugLog('[处理] 获取当前表格数据...', null, 'info');
        const currentTableText = getTablePrompt();
        debugLog('[处理] 当前表格数据长度', currentTableText?.length || 0, 'info');
        
        // 获取表格说明
        const tableInfo = initTableData();
        debugLog('[处理] 表格说明长度', tableInfo?.length || 0, 'info');
        
        // 构建分析提示词
        debugLog('[处理] 构建分析提示词...', null, 'info');
        const promptTemplate = USER.tableBaseSetting.auto_update_prompt_template || getDefaultAutoUpdatePrompt();
        
        let promptMessages;
        try {
            promptMessages = JSON5.parse(promptTemplate);
            debugLog('[处理] 提示词模板解析成功', { 消息数量: promptMessages.length }, 'success');
        } catch (e) {
            debugLog('[处理] 提示词模板解析失败', { error: e.message }, 'error');
            return;
        }
        
        // 替换占位符
        const processedMessages = promptMessages.map(msg => ({
            ...msg,
            content: msg.content
                .replace(/\$0/g, currentTableText)
                .replace(/\$2/g, message.mes)
                .replace(/\$3/g, tableInfo)
        }));
        
        debugLog('[处理] 发送分析请求到API...', null, 'info');
        const useMainAPI = USER.tableBaseSetting.auto_update_use_main_api ?? false;
        debugLog('[处理] 使用主API', useMainAPI, 'info');
        
        // 调用API
        let rawResponse;
        
        if (useMainAPI) {
            debugLog('[处理] 调用主API...', null, 'info');
            rawResponse = await handleMainAPIRequest(processedMessages, null, true);
        } else {
            debugLog('[处理] 调用独立API...', null, 'info');
            rawResponse = await handleCustomAPIRequest(processedMessages, null, true, true);
        }
        
        debugLog('[处理] API响应长度', rawResponse?.length || 0, 'info');
        
        if (!rawResponse || !rawResponse.trim()) {
            debugLog('[处理] ⚠️ API返回空响应', null, 'warning');
            return;
        }
        
        debugLog('[处理] AI分析结果（前500字）', rawResponse.substring(0, 500), 'success');
        
        // 检查是否需要更新
        const noUpdateKeywords = ['无需更新', '不需要更新', 'no update', 'no changes', '无变化'];
        if (noUpdateKeywords.some(keyword => rawResponse.toLowerCase().includes(keyword.toLowerCase()))) {
            debugLog('[处理] AI判断无需更新', null, 'info');
            return;
        }
        
        // 提取tableEdit标签
        debugLog('[处理] 提取表格操作指令...', null, 'info');
        const tableEditRegex = /<tableEdit>([\s\S]*?)<\/tableEdit>/gi;
        const matches = [];
        let match;
        
        while ((match = tableEditRegex.exec(rawResponse)) !== null) {
            matches.push(match[1].trim());
        }
        
        debugLog('[处理] 找到操作指令数量', matches.length, 'info');
        
        if (matches.length === 0) {
            debugLog('[处理] ⚠️ 未找到有效的tableEdit指令', null, 'warning');
            debugLog('[处理] 完整的AI响应', rawResponse, 'info');
            return;
        }
        
        // 执行表格操作
        debugLog('[处理] 执行表格操作...', null, 'info');
        debugLog('[处理] 操作指令详情', matches, 'info');
        
        const { piece } = USER.getChatPiece();
        const success = executeTableEditActions(matches, piece);
        
        if (success) {
            debugLog('[处理] ✅ 表格操作执行成功', null, 'success');
            
            // 保存更新
            await USER.saveChat();
            BASE.refreshContextView();
            updateSystemMessageTableStatus();
            
            if (!USER.tableBaseSetting.auto_update_silent_mode) {
                EDITOR.success('表格已自动更新', '', 1500);
            }
            
            debugLog('[处理] ✅ 自动填表完成', null, 'success');
        } else {
            debugLog('[处理] ❌ 表格操作执行失败', null, 'error');
        }
        
    } catch (error) {
        debugLog('[处理] 处理过程出错', { message: error.message, stack: error.stack }, 'error');
        if (!USER.tableBaseSetting.auto_update_silent_mode) {
            EDITOR.error('自动填表失败', error.message);
        }
    }
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

# AI刚生成的回复
$2

请分析以上内容，判断是否需要更新表格。如果需要，请生成操作指令。`
        }
    ], null, 2);
}

/**
 * 手动触发自动填表（用于测试）
 */
export async function triggerAutoUpdateManually() {
    debugLog('手动触发自动填表', null, 'info');
    const context = USER.getContext();
    if (!context || !context.chat || context.chat.length === 0) {
        EDITOR.error('没有可用的聊天消息');
        return;
    }
    
    const latestMessage = context.chat[context.chat.length - 1];
    EDITOR.info('手动触发自动填表...');
    await processAutoTableUpdate(latestMessage);
}

// 导出配置默认值
export const AUTO_UPDATE_DEFAULT_SETTINGS = {
    auto_table_update_enabled: false,
    auto_update_use_main_api: false,
    auto_update_silent_mode: false,
    auto_update_min_message_length: 50,
    auto_update_context_depth: 3,
    auto_update_use_lorebook: true,
    auto_update_prompt_template: getDefaultAutoUpdatePrompt()
};
