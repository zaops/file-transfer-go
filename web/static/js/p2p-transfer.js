// P2P文件传输系统
// 全局变量
let websocket = null;
let peerConnection = null;
let dataChannel = null;
let selectedFiles = [];
let currentPickupCode = '';
let currentRole = ''; // 'sender' or 'receiver'
let fileTransfers = new Map(); // 存储文件传输状态
let isP2PConnected = false; // P2P连接状态
let isConnecting = false; // 是否正在连接中
let connectionTimeout = null; // 连接超时定时器

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
});

// 初始化事件监听器
function initializeEventListeners() {
    // 文件选择事件
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);
    
    // 取件码输入事件
    document.getElementById('pickupCodeInput').addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
        if (e.target.value.length === 6) {
            // 自动连接
            setTimeout(() => joinRoom(), 100);
        }
    });
    
    // 拖拽上传
    setupDragAndDrop();
}

// 设置拖拽上传
function setupDragAndDrop() {
    const dropArea = document.querySelector('.border-dashed');
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.classList.add('border-blue-400');
    });
    
    dropArea.addEventListener('dragleave', () => {
        dropArea.classList.remove('border-blue-400');
    });
    
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('border-blue-400');
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            selectedFiles = files;
            displaySelectedFiles();
        }
    });
}

// 处理文件选择
function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
        selectedFiles = files;
        displaySelectedFiles();
    }
}

// 显示选中的文件
function displaySelectedFiles() {
    const container = document.getElementById('selectedFiles');
    const filesList = document.getElementById('filesList');
    
    if (selectedFiles.length === 0) {
        container.classList.add('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    filesList.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'flex items-center justify-between bg-gray-50 p-3 rounded-lg';
        fileItem.innerHTML = `
            <div class="flex items-center">
                <span class="text-2xl mr-3">${getFileIcon(file.type)}</span>
                <div>
                    <div class="font-medium">${file.name}</div>
                    <div class="text-sm text-gray-500">${formatFileSize(file.size)}</div>
                </div>
            </div>
            <button onclick="removeFile(${index})" class="text-red-500 hover:text-red-700 p-1">
                ❌
            </button>
        `;
        filesList.appendChild(fileItem);
    });
}

// 移除文件
function removeFile(index) {
    selectedFiles.splice(index, 1);
    displaySelectedFiles();
}

// 生成取件码
async function generatePickupCode() {
    if (selectedFiles.length === 0) return;
    
    // 准备文件信息
    const fileInfos = selectedFiles.map((file, index) => ({
        id: 'file_' + index,
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
    }));
    
    try {
        const response = await fetch('/api/create-room', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ files: fileInfos })
        });
        
        const data = await response.json();
        if (data.success) {
            currentPickupCode = data.code;
            currentRole = 'sender';
            showPickupCode(data.code);
            connectWebSocket();
        } else {
            alert('生成取件码失败: ' + data.message);
        }
    } catch (error) {
        console.error('生成取件码失败:', error);
        alert('生成取件码失败，请重试');
    }
}

// 显示取件码
function showPickupCode(code) {
    document.getElementById('pickupCodeDisplay').textContent = code;
    document.getElementById('pickupCodeSection').classList.remove('hidden');
    document.getElementById('generateCodeBtn').classList.add('hidden');
}

// 复制取件码
function copyPickupCode() {
    navigator.clipboard.writeText(currentPickupCode).then(() => {
        alert('取件码已复制到剪贴板');
    });
}

// 重置发送方
function resetSender() {
    selectedFiles = [];
    currentPickupCode = '';
    currentRole = '';
    if (websocket) {
        websocket.close();
    }
    
    document.getElementById('selectedFiles').classList.add('hidden');
    document.getElementById('pickupCodeSection').classList.add('hidden');
    document.getElementById('generateCodeBtn').classList.remove('hidden');
    document.getElementById('fileInput').value = '';
}

// 加入房间
async function joinRoom() {
    const code = document.getElementById('pickupCodeInput').value.trim();
    if (code.length !== 6) {
        alert('请输入6位取件码');
        return;
    }
    
    try {
        const response = await fetch(`/api/room-info?code=${code}`);
        const data = await response.json();
        
        if (data.success) {
            currentPickupCode = code;
            currentRole = 'receiver';
            displayReceiverFiles(data.files);
            connectWebSocket();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('连接失败:', error);
        alert('连接失败，请检查取件码是否正确');
    }
}

// 显示接收方文件列表
function displayReceiverFiles(files) {
    document.getElementById('codeInputSection').classList.add('hidden');
    document.getElementById('receiverFilesSection').classList.remove('hidden');
    
    const filesList = document.getElementById('receiverFilesList');
    filesList.innerHTML = '';
    
    files.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'flex items-center justify-between bg-gray-50 p-3 rounded-lg';
        fileItem.innerHTML = `
            <div class="flex items-center">
                <span class="text-2xl mr-3">${getFileIcon(file.type)}</span>
                <div>
                    <div class="font-medium">${file.name}</div>
                    <div class="text-sm text-gray-500">${formatFileSize(file.size)}</div>
                </div>
            </div>
            <button onclick="downloadFile('${file.id}')" disabled 
                    class="bg-blue-500 text-white px-4 py-2 rounded font-semibold opacity-50 cursor-not-allowed">
                📥 下载
            </button>
        `;
        filesList.appendChild(fileItem);
    });
    
    // 初始化时显示正在建立连接状态
    updateP2PStatus(false);
}

// 工具函数
function getFileIcon(mimeType) {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return '📦';
    return '📄';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    if (websocket) {
        websocket.close();
    }
    if (peerConnection) {
        peerConnection.close();
    }
});
