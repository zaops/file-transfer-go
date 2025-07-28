// 通用JavaScript工具函数

// 工具函数
const Utils = {
    // 格式化文件大小
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    // 格式化时间
    formatTime(date) {
        return new Date(date).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    },

    // 生成随机字符串
    randomString(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },

    // 复制到剪贴板
    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // 兼容性处理
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const result = document.execCommand('copy');
                document.body.removeChild(textArea);
                return result;
            }
        } catch (error) {
            console.error('复制失败:', error);
            return false;
        }
    },

    // 获取文件类型图标
    getFileIcon(fileName, fileType) {
        const ext = fileName.split('.').pop().toLowerCase();
        
        // 根据MIME类型
        if (fileType) {
            if (fileType.startsWith('image/')) return '🖼️';
            if (fileType.startsWith('video/')) return '🎥';
            if (fileType.startsWith('audio/')) return '🎵';
            if (fileType.includes('pdf')) return '📄';
            if (fileType.includes('text')) return '📝';
            if (fileType.includes('zip') || fileType.includes('rar')) return '📦';
        }
        
        // 根据文件扩展名
        switch (ext) {
            case 'pdf': return '📄';
            case 'doc':
            case 'docx': return '📝';
            case 'xls':
            case 'xlsx': return '📊';
            case 'ppt':
            case 'pptx': return '📈';
            case 'txt': return '📄';
            case 'epub':
            case 'mobi': return '📚';
            case 'zip':
            case 'rar':
            case '7z': return '📦';
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
            case 'bmp': return '🖼️';
            case 'mp4':
            case 'avi':
            case 'mov':
            case 'wmv': return '🎥';
            case 'mp3':
            case 'wav':
            case 'flac':
            case 'aac': return '🎵';
            case 'js':
            case 'html':
            case 'css':
            case 'py':
            case 'java':
            case 'cpp': return '💻';
            default: return '📁';
        }
    },

    // 验证取件码格式
    validateCode(code) {
        return /^[A-Z0-9]{6}$/.test(code);
    },

    // 获取浏览器信息
    getBrowserInfo() {
        const ua = navigator.userAgent;
        let browser = 'Unknown';
        let version = 'Unknown';

        if (ua.indexOf('Chrome') > -1) {
            browser = 'Chrome';
            version = ua.match(/Chrome\/(\d+)/)[1];
        } else if (ua.indexOf('Firefox') > -1) {
            browser = 'Firefox';
            version = ua.match(/Firefox\/(\d+)/)[1];
        } else if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) {
            browser = 'Safari';
            version = ua.match(/Version\/(\d+)/)[1];
        } else if (ua.indexOf('Edge') > -1) {
            browser = 'Edge';
            version = ua.match(/Edge\/(\d+)/)[1];
        } else if (ua.indexOf('360SE') > -1) {
            browser = '360浏览器';
        } else if (ua.indexOf('QQBrowser') > -1) {
            browser = 'QQ浏览器';
            version = ua.match(/QQBrowser\/(\d+)/)[1];
        }

        return { browser, version };
    },

    // 检查WebRTC支持
    checkWebRTCSupport() {
        return !!(window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection);
    },

    // 检查文件API支持
    checkFileAPISupport() {
        return !!(window.File && window.FileReader && window.FileList && window.Blob);
    },

    // 节流函数
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    },

    // 防抖函数
    debounce(func, delay) {
        let timeoutId;
        return function() {
            const args = arguments;
            const context = this;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(context, args), delay);
        }
    }
};

// 通知系统
const Notification = {
    // 显示成功消息
    success(message, duration = 3000) {
        this.show(message, 'success', duration);
    },

    // 显示错误消息
    error(message, duration = 5000) {
        this.show(message, 'error', duration);
    },

    // 显示警告消息
    warning(message, duration = 4000) {
        this.show(message, 'warning', duration);
    },

    // 显示信息消息
    info(message, duration = 3000) {
        this.show(message, 'info', duration);
    },

    // 显示通知
    show(message, type = 'info', duration = 3000) {
        // 创建通知容器（如果不存在）
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'fixed top-4 right-4 z-50 space-y-2';
            document.body.appendChild(container);
        }

        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 fade-in`;
        
        const bgColor = {
            success: 'bg-green-50 border-green-200',
            error: 'bg-red-50 border-red-200',
            warning: 'bg-yellow-50 border-yellow-200',
            info: 'bg-blue-50 border-blue-200'
        }[type] || 'bg-gray-50 border-gray-200';

        const iconEmoji = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        }[type] || 'ℹ️';

        notification.innerHTML = `
            <div class="flex-1 w-0 p-4">
                <div class="flex items-start">
                    <div class="flex-shrink-0">
                        <span class="text-xl">${iconEmoji}</span>
                    </div>
                    <div class="ml-3 w-0 flex-1 pt-0.5">
                        <p class="text-sm font-medium text-gray-900">${message}</p>
                    </div>
                </div>
            </div>
            <div class="flex border-l border-gray-200">
                <button onclick="this.parentElement.parentElement.remove()" 
                        class="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-600 hover:text-gray-500 focus:outline-none">
                    ×
                </button>
            </div>
        `;

        notification.className += ` ${bgColor}`;
        container.appendChild(notification);

        // 自动移除
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.style.opacity = '0';
                    notification.style.transform = 'translateX(100%)';
                    setTimeout(() => notification.remove(), 300);
                }
            }, duration);
        }
    }
};

// 加载管理器
const Loading = {
    show(message = '加载中...') {
        this.hide(); // 先隐藏现有的加载提示
        
        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        
        overlay.innerHTML = `
            <div class="bg-white rounded-lg p-6 flex items-center space-x-3">
                <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                <span class="text-gray-700">${message}</span>
            </div>
        `;
        
        document.body.appendChild(overlay);
    },

    hide() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.remove();
        }
    }
};

// API请求工具
const API = {
    async request(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const config = { ...defaultOptions, ...options };
        
        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return await response.text();
            }
        } catch (error) {
            console.error('API请求失败:', error);
            throw error;
        }
    },

    async get(url, params = {}) {
        const urlObj = new URL(url, window.location.origin);
        Object.keys(params).forEach(key => 
            urlObj.searchParams.append(key, params[key])
        );
        
        return this.request(urlObj.toString());
    },

    async post(url, data = {}) {
        return this.request(url, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    async delete(url) {
        return this.request(url, {
            method: 'DELETE',
        });
    }
};

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 检查浏览器兼容性
    const browserInfo = Utils.getBrowserInfo();
    console.log(`浏览器: ${browserInfo.browser} ${browserInfo.version}`);
    
    // 检查功能支持
    if (!Utils.checkFileAPISupport()) {
        Notification.warning('您的浏览器不完全支持文件API，部分功能可能受限');
    }
    
    if (!Utils.checkWebRTCSupport()) {
        console.warn('浏览器不支持WebRTC，视频功能不可用');
    }

    // 添加全局错误处理
    window.addEventListener('error', function(event) {
        console.error('全局错误:', event.error);
        Notification.error('页面发生错误，请刷新后重试');
    });

    // 添加网络状态监听
    window.addEventListener('online', function() {
        Notification.success('网络连接已恢复');
    });

    window.addEventListener('offline', function() {
        Notification.warning('网络连接已断开，请检查网络设置');
    });

    // 添加页面可见性变化监听
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            console.log('页面已隐藏');
        } else {
            console.log('页面已显示');
        }
    });
});

// 导出全局对象
window.Utils = Utils;
window.Notification = Notification;
window.Loading = Loading;
window.API = API;
