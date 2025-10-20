/**
 * 自动填表日志管理器
 * 提供可视化的日志面板，替代控制台日志
 */

class AutoUpdateLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 500; // 最多保留500条日志
        this.counts = {
            total: 0,
            info: 0,
            success: 0,
            warning: 0,
            error: 0
        };
    }

    /**
     * 添加日志
     */
    log(level, message, data = null) {
        const timestamp = new Date();
        const timeStr = timestamp.toLocaleTimeString('zh-CN', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            fractionalSecondDigits: 3
        });

        const logEntry = {
            timestamp: timeStr,
            level: level,
            message: message,
            data: data,
            id: Date.now() + Math.random()
        };

        this.logs.push(logEntry);
        this.counts.total++;
        if (this.counts[level] !== undefined) {
            this.counts[level]++;
        }

        // 限制日志数量
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // 同时输出到控制台（带颜色）
        this.consoleLog(level, timeStr, message, data);

        // 更新UI
        this.updateUI();
    }

    /**
     * 控制台日志（带颜色）
     */
    consoleLog(level, timeStr, message, data) {
        const styles = {
            info: 'color: #3794ff',
            success: 'color: #89d185',
            warning: 'color: #e5c07b',
            error: 'color: #e06c75'
        };

        const prefix = `[自动填表 ${timeStr}]`;
        console.log(`%c${prefix} ${message}`, styles[level] || '');
        if (data) {
            console.log(data);
        }
    }

    /**
     * 快捷方法
     */
    info(message, data) { this.log('info', message, data); }
    success(message, data) { this.log('success', message, data); }
    warning(message, data) { this.log('warning', message, data); }
    error(message, data) { this.log('error', message, data); }

    /**
     * 更新UI
     */
    updateUI() {
        const container = document.getElementById('auto_update_log_container');
        if (!container) return;

        // 更新统计
        document.getElementById('log_count_total').textContent = this.counts.total;
        document.getElementById('log_count_success').textContent = this.counts.success;
        document.getElementById('log_count_warning').textContent = this.counts.warning;
        document.getElementById('log_count_error').textContent = this.counts.error;

        // 获取过滤设置
        const filters = {
            info: document.getElementById('log_level_info')?.checked ?? true,
            success: document.getElementById('log_level_success')?.checked ?? true,
            warning: document.getElementById('log_level_warning')?.checked ?? true,
            error: document.getElementById('log_level_error')?.checked ?? true
        };

        // 生成HTML
        const filteredLogs = this.logs.filter(log => filters[log.level]);
        
        if (filteredLogs.length === 0) {
            container.innerHTML = '<div style="color: #888;">没有日志</div>';
            return;
        }

        const html = filteredLogs.map(log => this.renderLogEntry(log)).join('');
        container.innerHTML = html;

        // 自动滚动到底部
        container.scrollTop = container.scrollHeight;
    }

    /**
     * 渲染单条日志
     */
    renderLogEntry(log) {
        const levelIcons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };

        let dataHtml = '';
        if (log.data) {
            let dataStr = '';
            if (typeof log.data === 'object') {
                dataStr = JSON.stringify(log.data, null, 2);
            } else {
                dataStr = String(log.data);
            }
            dataHtml = `<div class="log-data">${this.escapeHtml(dataStr)}</div>`;
        }

        return `
            <div class="log-entry ${log.level}">
                <span class="log-timestamp">${log.timestamp}</span>
                <span class="log-level ${log.level}">${levelIcons[log.level]} ${log.level.toUpperCase()}</span>
                <span class="log-message">${this.escapeHtml(log.message)}</span>
                ${dataHtml}
            </div>
        `;
    }

    /**
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 清空日志
     */
    clear() {
        this.logs = [];
        this.counts = {
            total: 0,
            info: 0,
            success: 0,
            warning: 0,
            error: 0
        };
        this.updateUI();
        this.info('日志已清空');
    }

    /**
     * 初始化UI事件
     */
    initUI() {
        // 清空按钮
        document.getElementById('auto_update_clear_log')?.addEventListener('click', () => {
            this.clear();
        });

        // 刷新按钮
        document.getElementById('auto_update_refresh_log')?.addEventListener('click', () => {
            this.updateUI();
        });

        // 过滤器
        ['info', 'success', 'warning', 'error'].forEach(level => {
            document.getElementById(`log_level_${level}`)?.addEventListener('change', () => {
                this.updateUI();
            });
        });

        this.info('日志面板已初始化');
    }

    /**
     * 导出日志
     */
    export() {
        const text = this.logs.map(log => {
            let line = `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`;
            if (log.data) {
                line += '\n' + JSON.stringify(log.data, null, 2);
            }
            return line;
        }).join('\n\n');

        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `auto-update-log-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);

        this.success('日志已导出');
    }
}

// 创建全局实例
window.autoUpdateLogger = new AutoUpdateLogger();

export default window.autoUpdateLogger;
