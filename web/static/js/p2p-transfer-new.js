// P2P文件传输系统（多人房间版本）
// 全局变量
let websocket = null;
let clientConnections = new Map(); // 存储与其他客户端的P2P连接
let selectedFiles = [];
let currentPickupCode = '';
let currentRole = ''; // 'sender' or 'receiver'
let currentClientId = ''; // 当前客户端ID
let fileTransfers = new Map(); // 存储文件传输状态
let isP2PConnected = false; // P2P连接状态
let isConnecting = false; // 是否正在连接中
let pendingChunkMeta = null; // 待处理的数据块元数据

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
            // 添加新文件到现有列表
            selectedFiles = [...selectedFiles, ...files];
            displaySelectedFiles();
            
            // 如果已经生成了取件码，自动更新房间文件列表
            if (currentPickupCode && currentRole === 'sender') {
                updateRoomFiles();
            }
        }
    });
}

// 处理文件选择
function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
        // 添加新文件到现有列表
        selectedFiles = [...selectedFiles, ...files];
        displaySelectedFiles();
        
        // 如果已经生成了取件码，自动更新房间文件列表
        if (currentPickupCode && currentRole === 'sender') {
            updateRoomFiles();
        }
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
    
    // 如果已经生成了取件码，需要更新房间文件列表
    if (currentPickupCode && currentRole === 'sender') {
        updateRoomFiles();
    }
}

// 添加更多文件
function addMoreFiles() {
    document.getElementById('fileInput').click();
}

// 更新房间文件列表
async function updateRoomFiles() {
    if (!currentPickupCode || currentRole !== 'sender') return;
    
    const fileInfos = selectedFiles.map((file, index) => ({
        id: 'file_' + index,
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
    }));
    
    try {
        const response = await fetch('/api/update-room-files', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                code: currentPickupCode,
                files: fileInfos 
            })
        });
        
        const data = await response.json();
        if (data.success) {
            console.log('房间文件列表已更新');
            showNotification('文件列表已更新', 'success');
            
            // 通过WebSocket通知所有接收方文件列表更新
            if (websocket && websocket.readyState === WebSocket.OPEN) {
                const updateMsg = {
                    type: 'file-list-updated',
                    payload: {
                        files: fileInfos
                    }
                };
                websocket.send(JSON.stringify(updateMsg));
            }
        } else {
            console.error('更新文件列表失败:', data.message);
            showNotification('更新文件列表失败: ' + data.message, 'error');
        }
    } catch (error) {
        console.error('更新文件列表请求失败:', error);
        showNotification('更新文件列表失败，请重试', 'error');
    }
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
    // 不隐藏生成取件码按钮，改为"添加更多文件"
    const generateBtn = document.getElementById('generateCodeBtn');
    generateBtn.textContent = '➕ 添加更多文件';
    generateBtn.onclick = addMoreFiles;
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
    currentClientId = '';
    if (websocket) {
        websocket.close();
    }
    
    document.getElementById('selectedFiles').classList.add('hidden');
    document.getElementById('pickupCodeSection').classList.add('hidden');
    document.getElementById('generateCodeBtn').classList.remove('hidden');
    document.getElementById('fileInput').value = '';
    document.getElementById('roomStatusSection').classList.add('hidden');
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

// WebSocket连接函数
function connectWebSocket() {
    console.log('尝试连接WebSocket, 角色:', currentRole, '取件码:', currentPickupCode);
    
    if (!currentPickupCode || !currentRole) {
        console.error('缺少必要参数：取件码或角色');
        showNotification('连接参数错误', 'error');
        return;
    }
    
    if (isConnecting) {
        console.log('已在连接中，跳过');
        return;
    }
    
    isConnecting = true;
    
    // 如果已经有连接，先关闭
    if (websocket) {
        console.log('关闭现有WebSocket连接');
        websocket.close();
        websocket = null;
    }
    
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/p2p?code=${currentPickupCode}&role=${currentRole}`;
    console.log('WebSocket URL:', wsUrl);
    
    try {
        websocket = new WebSocket(wsUrl);
        
        websocket.onopen = () => {
            console.log('WebSocket连接已建立, 当前角色:', currentRole);
            isConnecting = false;
            updateConnectionStatus(true);
            
            // 连接建立后，启用P2P功能
            if (currentRole === 'receiver') {
                console.log('接收方WebSocket连接成功，启用下载功能');
                updateP2PStatus(true); // 接收方连接成功后立即启用下载
                showNotification('连接成功，可以开始下载文件', 'success');
            }
            
            // 发送方在WebSocket连接建立后显示房间状态
            if (currentRole === 'sender') {
                console.log('发送方初始化完成');
                showRoomStatus();
            }
        };
        
        websocket.onmessage = async (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log('收到WebSocket消息:', message);
                await handleWebSocketMessage(message);
            } catch (error) {
                console.error('解析WebSocket消息失败:', error, event.data);
            }
        };
        
        websocket.onerror = (error) => {
            console.error('WebSocket错误:', error);
            isConnecting = false;
            updateConnectionStatus(false);
            updateP2PStatus(false);
            showNotification('WebSocket连接失败，请检查网络连接', 'error');
        };
        
        websocket.onclose = (event) => {
            console.log('WebSocket连接已关闭, 代码:', event.code, '原因:', event.reason);
            isConnecting = false;
            updateConnectionStatus(false);
            updateP2PStatus(false);
            websocket = null;
            
            // 如果不是正常关闭且还需要连接，尝试重连
            if (event.code !== 1000 && currentPickupCode && !isConnecting) {
                console.log('WebSocket异常关闭，5秒后尝试重连');
                showNotification('连接断开，5秒后自动重连...', 'info');
                setTimeout(() => {
                    if (currentPickupCode && !websocket && !isConnecting) {
                        console.log('尝试重新连接WebSocket');
                        connectWebSocket();
                    }
                }, 5000);
            }
        };
        
        // 设置连接超时
        setTimeout(() => {
            if (websocket && websocket.readyState === WebSocket.CONNECTING) {
                console.log('WebSocket连接超时');
                websocket.close();
                showNotification('连接超时，请重试', 'error');
            }
        }, 10000);
        
    } catch (error) {
        console.error('创建WebSocket连接失败:', error);
        isConnecting = false;
        showNotification('无法创建WebSocket连接: ' + error.message, 'error');
    }
}

// 处理WebSocket消息
async function handleWebSocketMessage(message) {
    console.log('处理WebSocket消息:', message.type, message);
    
    switch (message.type) {
        case 'file-list':
            // 接收到文件列表
            if (currentRole === 'receiver') {
                displayReceiverFiles(message.payload.files);
            }
            break;
            
        case 'file-list-updated':
            // 文件列表更新（通知接收方）
            if (currentRole === 'receiver') {
                console.log('收到文件列表更新通知');
                displayReceiverFiles(message.payload.files);
                showNotification('文件列表已更新，发现新文件！', 'info');
            }
            break;
            
        case 'room-status':
            // 房间状态更新
            updateRoomStatus(message.payload);
            break;
            
        case 'new-receiver':
            // 新接收方加入
            if (currentRole === 'sender') {
                console.log('新接收方加入:', message.payload.client_id);
                showNotification('有新用户加入房间', 'info');
            }
            break;
            
        case 'new-sender':
            // 新发送方加入
            if (currentRole === 'receiver') {
                console.log('新发送方加入:', message.payload.client_id);
            }
            break;
            
        case 'client-left':
            // 客户端离开
            console.log('客户端离开:', message.payload.client_id, message.payload.role);
            break;
            
        case 'file-request':
            // 文件请求
            if (currentRole === 'sender') {
                await handleFileRequest(message.payload);
            }
            break;
            
        case 'file-info':
            // 文件信息（接收方）
            if (currentRole === 'receiver') {
                initFileTransfer(message.payload);
            }
            break;
            
        case 'file-chunk':
            // 文件数据块（接收方）
            if (currentRole === 'receiver') {
                receiveFileChunk(message.payload);
            }
            break;
            
        case 'file-complete':
            // 文件传输完成（接收方）
            if (currentRole === 'receiver') {
                completeFileDownload(message.payload.file_id);
            }
            break;
            
        default:
            console.log('未知消息类型:', message.type);
    }
}

// 更新连接状态
function updateConnectionStatus(connected) {
    const senderStatus = document.getElementById('senderStatus');
    const receiverStatus = document.getElementById('receiverStatus');
    
    if (currentRole === 'sender' && senderStatus) {
        senderStatus.innerHTML = connected ? 
            `<div class="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800">
                <span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                WebSocket已连接
            </div>` :
            `<div class="inline-flex items-center px-3 py-1 rounded-full bg-red-100 text-red-800">
                <span class="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                连接断开
            </div>`;
    }
    
    if (currentRole === 'receiver' && receiverStatus) {
        // 接收方的状态更新由updateP2PStatus处理
    }
}

// 更新房间状态显示
function updateRoomStatus(status) {
    console.log('更新房间状态:', status);
    
    const totalClients = status.sender_count + status.receiver_count;
    
    // 更新发送方界面的房间状态
    if (currentRole === 'sender') {
        const onlineCountEl = document.getElementById('onlineCount');
        const senderCountEl = document.getElementById('senderCount');
        const receiverCountEl = document.getElementById('receiverCount');
        
        if (onlineCountEl) onlineCountEl.textContent = totalClients;
        if (senderCountEl) senderCountEl.textContent = status.sender_count;
        if (receiverCountEl) receiverCountEl.textContent = status.receiver_count;
        
        const clientsList = document.getElementById('clientsList');
        if (clientsList) {
            clientsList.innerHTML = '';
            
            status.clients.forEach(client => {
                if (client.id !== currentClientId) { // 不显示自己
                    const clientDiv = document.createElement('div');
                    clientDiv.className = 'text-xs text-blue-600';
                    const role = client.role === 'sender' ? '📤 发送' : '📥 接收';
                    const joinTime = new Date(client.joined_at).toLocaleTimeString();
                    clientDiv.textContent = `${role} - ${joinTime}`;
                    clientsList.appendChild(clientDiv);
                }
            });
        }
        
        // 显示房间状态区域
        const roomStatusSection = document.getElementById('roomStatusSection');
        if (roomStatusSection) {
            roomStatusSection.classList.remove('hidden');
        }
    }
    
    // 更新接收方界面的房间状态
    if (currentRole === 'receiver') {
        const receiverOnlineCountEl = document.getElementById('receiverOnlineCount');
        const receiverSenderCountEl = document.getElementById('receiverSenderCount');
        const receiverReceiverCountEl = document.getElementById('receiverReceiverCount');
        
        if (receiverOnlineCountEl) receiverOnlineCountEl.textContent = totalClients;
        if (receiverSenderCountEl) receiverSenderCountEl.textContent = status.sender_count;
        if (receiverReceiverCountEl) receiverReceiverCountEl.textContent = status.receiver_count;
        
        const clientsList = document.getElementById('receiverClientsList');
        if (clientsList) {
            clientsList.innerHTML = '';
            
            status.clients.forEach(client => {
                if (client.id !== currentClientId) { // 不显示自己
                    const clientDiv = document.createElement('div');
                    clientDiv.className = 'text-xs text-blue-600';
                    const role = client.role === 'sender' ? '📤 发送' : '📥 接收';
                    const joinTime = new Date(client.joined_at).toLocaleTimeString();
                    clientDiv.textContent = `${role} - ${joinTime}`;
                    clientsList.appendChild(clientDiv);
                }
            });
        }
    }
}

// 显示房间状态区域
function showRoomStatus() {
    if (currentRole === 'sender') {
        const roomStatusSection = document.getElementById('roomStatusSection');
        if (roomStatusSection) {
            roomStatusSection.classList.remove('hidden');
        }
    }
}

// 处理文件请求（简化版本，通过WebSocket发送文件）
async function handleFileRequest(payload) {
    console.log('处理文件请求:', payload);
    
    const fileId = payload.file_id;
    const requesterId = payload.requester;
    const requestId = payload.request_id;
    
    // 找到对应的文件
    const fileIndex = parseInt(fileId.replace('file_', ''));
    const file = selectedFiles[fileIndex];
    
    if (!file) {
        console.error('未找到请求的文件:', fileId);
        return;
    }
    
    console.log('开始发送文件:', file.name, '给客户端:', requesterId);
    showNotification(`开始发送文件: ${file.name}`, 'info');
    
    // 通过WebSocket发送文件（简化实现）
    await sendFileViaWebSocket(file, requestId);
}

// 通过WebSocket发送文件
async function sendFileViaWebSocket(file, requestId) {
    // 发送文件信息
    const fileInfo = {
        type: 'file-info',
        payload: {
            file_id: requestId,
            name: file.name,
            size: file.size,
            mime_type: file.type,
            last_modified: file.lastModified
        }
    };
    
    websocket.send(JSON.stringify(fileInfo));
    
    // 分块发送文件
    const chunkSize = 65536; // 64KB chunks (提高传输速度)
    let offset = 0;
    
    const sendChunk = () => {
        if (offset >= file.size) {
            // 发送完成消息
            const completeMsg = {
                type: 'file-complete',
                payload: {
                    file_id: requestId
                }
            };
            websocket.send(JSON.stringify(completeMsg));
            console.log('文件发送完成:', file.name);
            showNotification(`文件发送完成: ${file.name}`, 'success');
            return;
        }
        
        const slice = file.slice(offset, offset + chunkSize);
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const chunk = e.target.result;
            
            // 发送块元数据和数据
            const chunkData = {
                type: 'file-chunk',
                payload: {
                    file_id: requestId,
                    offset: offset,
                    data: Array.from(new Uint8Array(chunk)), // 转换为数组以便JSON序列化
                    is_last: offset + chunk.byteLength >= file.size
                }
            };
            
            websocket.send(JSON.stringify(chunkData));
            
            offset += chunk.byteLength;
            
            // 减少延时提高传输速度
            setTimeout(sendChunk, 10); // 从50ms减少到10ms
        };
        
        reader.readAsArrayBuffer(slice);
    };
    
    sendChunk();
}

// 初始化文件传输（接收方）
function initFileTransfer(fileInfo) {
    console.log('初始化文件传输:', fileInfo);
    
    const transferKey = fileInfo.file_id;
    
    if (!fileTransfers.has(transferKey)) {
        fileTransfers.set(transferKey, {
            fileId: fileInfo.file_id,
            chunks: [],
            totalSize: fileInfo.size,
            receivedSize: 0,
            fileName: fileInfo.name,
            mimeType: fileInfo.mime_type,
            startTime: Date.now()
        });
        
        console.log('文件传输已初始化:', transferKey);
        showTransferProgress(fileInfo.file_id, 'downloading', fileInfo.name);
    }
}

// 接收文件数据块（接收方）
function receiveFileChunk(chunkData) {
    const transferKey = chunkData.file_id;
    const transfer = fileTransfers.get(transferKey);
    
    if (!transfer) {
        console.error('未找到对应的文件传输:', transferKey);
        return;
    }
    
    // 将数组转换回Uint8Array
    const chunkArray = new Uint8Array(chunkData.data);
    
    // 存储数据块
    transfer.chunks.push({
        offset: chunkData.offset,
        data: chunkArray
    });
    
    transfer.receivedSize += chunkArray.length;
    
    // 更新进度
    const progress = (transfer.receivedSize / transfer.totalSize) * 100;
    updateTransferProgress(chunkData.file_id, progress, transfer.receivedSize, transfer.totalSize);
    
    console.log(`文件块接收进度: ${progress.toFixed(1)}% (${transfer.receivedSize}/${transfer.totalSize})`);
    
    // 检查是否是最后一块
    if (chunkData.is_last || transfer.receivedSize >= transfer.totalSize) {
        console.log('文件接收完成，开始合并数据块');
        assembleAndDownloadFile(transferKey);
    }
}

// 完成文件下载（接收方）
function completeFileDownload(fileId) {
    console.log('文件传输完成:', fileId);
    // 这个函数可能不需要，因为在receiveFileChunk中已经处理了完成逻辑
}

// 组装文件并触发下载
function assembleAndDownloadFile(transferKey) {
    const transfer = fileTransfers.get(transferKey);
    if (!transfer) {
        console.error('未找到文件传输信息:', transferKey);
        return;
    }
    
    // 按偏移量排序数据块
    transfer.chunks.sort((a, b) => a.offset - b.offset);
    
    // 合并所有数据块
    const totalSize = transfer.chunks.reduce((sum, chunk) => sum + chunk.data.length, 0);
    const mergedData = new Uint8Array(totalSize);
    let currentOffset = 0;
    
    transfer.chunks.forEach(chunk => {
        mergedData.set(chunk.data, currentOffset);
        currentOffset += chunk.data.length;
    });
    
    // 创建Blob并触发下载
    const blob = new Blob([mergedData], { type: transfer.mimeType });
    
    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = transfer.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // 清理传输信息
    fileTransfers.delete(transferKey);
    
    // 显示完成状态
    hideTransferProgress(transfer.fileId);
    
    // 恢复下载按钮
    const button = document.querySelector(`button[onclick="downloadFile('${transfer.fileId}')"]`);
    if (button) {
        button.disabled = false;
        button.textContent = '📥 下载';
    }
    
    const transferTime = (Date.now() - transfer.startTime) / 1000;
    const speed = (transfer.totalSize / transferTime / 1024 / 1024).toFixed(2);
    
    console.log(`文件下载完成: ${transfer.fileName}`);
    console.log(`传输时间: ${transferTime.toFixed(1)}秒，平均速度: ${speed} MB/s`);
    
    // 显示成功消息
    showNotification(`文件 "${transfer.fileName}" 下载完成！传输速度: ${speed} MB/s`, 'success');
}

// 显示接收方文件列表
function displayReceiverFiles(files) {
    console.log('displayReceiverFiles被调用, WebSocket状态:', websocket ? websocket.readyState : 'null');
    
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
    
    // 只有在WebSocket未连接时才显示连接中状态
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
        console.log('WebSocket未连接，显示连接中状态');
        updateP2PStatus(false);
    } else {
        console.log('WebSocket已连接，启用下载功能');
        updateP2PStatus(true);
    }
}

// 下载文件（多人房间版本）
function downloadFile(fileId) {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
        alert('WebSocket连接未建立，请重新连接');
        return;
    }
    
    console.log('请求下载文件:', fileId);
    
    // 找到文件名（从按钮的父元素中获取）
    const button = document.querySelector(`button[onclick="downloadFile('${fileId}')"]`);
    let fileName = fileId; // 默认使用fileId
    if (button) {
        const fileNameEl = button.parentElement.querySelector('.font-medium');
        if (fileNameEl) {
            fileName = fileNameEl.textContent;
        }
    }
    
    // 生成请求ID用于跟踪请求
    const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // 通过WebSocket发送文件请求
    const request = {
        type: 'file-request',
        payload: {
            file_id: fileId,
            request_id: requestId
        }
    };
    
    websocket.send(JSON.stringify(request));
    // 不在这里显示进度条，等收到file-info消息时再显示
    
    // 禁用下载按钮防止重复点击
    if (button) {
        button.disabled = true;
        button.textContent = '⏳ 请求中...';
    }
}

// 更新P2P连接状态
function updateP2PStatus(connected) {
    console.log('updateP2PStatus被调用, connected:', connected, 'currentRole:', currentRole);
    
    const receiverStatus = document.getElementById('receiverStatus');
    const downloadButtons = document.querySelectorAll('button[onclick^="downloadFile"]');
    
    console.log('receiverStatus元素:', receiverStatus);
    console.log('找到的下载按钮数量:', downloadButtons.length);
    
    if (currentRole === 'receiver' && receiverStatus) {
        if (connected) {
            console.log('设置为已连接状态');
            receiverStatus.innerHTML = `
                <div class="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800">
                    <span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    已连接，可以下载文件
                </div>`;
            
            // 启用下载按钮
            downloadButtons.forEach(btn => {
                console.log('启用下载按钮:', btn);
                btn.disabled = false;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
                btn.classList.add('hover:bg-blue-600');
                if (btn.textContent === '⏳ 请求中...') {
                    btn.textContent = '📥 下载';
                }
            });
        } else {
            console.log('设置为连接中状态');
            receiverStatus.innerHTML = `
                <div class="inline-flex items-center px-3 py-1 rounded-full bg-yellow-100 text-yellow-800">
                    <span class="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                    正在建立连接...
                </div>`;
            
            // 禁用下载按钮
            downloadButtons.forEach(btn => {
                btn.disabled = true;
                btn.classList.add('opacity-50', 'cursor-not-allowed');
                btn.classList.remove('hover:bg-blue-600');
            });
        }
    } else {
        console.log('条件不满足: currentRole=' + currentRole + ', receiverStatus存在=' + !!receiverStatus);
    }
}

// 显示传输进度
function showTransferProgress(fileId, type, fileName = null) {
    const progressContainer = document.getElementById('transferProgress');
    const progressList = document.getElementById('progressList');
    
    if (!progressContainer || !progressList) return;
    
    // 如果已经存在相同文件ID的进度条，先删除
    const existingProgress = document.getElementById(`progress-${fileId}`);
    if (existingProgress) {
        existingProgress.remove();
    }
    
    progressContainer.classList.remove('hidden');
    
    const displayName = fileName || fileId;
    const progressItem = document.createElement('div');
    progressItem.id = `progress-${fileId}`;
    progressItem.className = 'bg-gray-100 p-3 rounded-lg';
    progressItem.innerHTML = `
        <div class="flex justify-between items-center mb-2">
            <span class="font-medium">文件: ${displayName}</span>
            <span class="text-sm text-gray-500">${type === 'uploading' ? '上传中' : '下载中'}</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="bg-blue-500 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
        </div>
        <div class="text-sm text-gray-500 mt-1">0%</div>
    `;
    
    progressList.appendChild(progressItem);
}

// 更新传输进度
function updateTransferProgress(fileId, progress, received, total) {
    const progressItem = document.getElementById(`progress-${fileId}`);
    if (!progressItem) return;
    
    const progressBar = progressItem.querySelector('.bg-blue-500');
    const progressText = progressItem.querySelector('.text-sm.text-gray-500:last-child');
    
    if (progressBar && progressText) {
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${progress.toFixed(1)}% (${formatFileSize(received)}/${formatFileSize(total)})`;
    }
}

// 隐藏传输进度
function hideTransferProgress(fileId) {
    const progressItem = document.getElementById(`progress-${fileId}`);
    if (progressItem) {
        progressItem.remove();
        
        // 如果没有其他传输，隐藏进度容器
        const progressList = document.getElementById('progressList');
        if (progressList && progressList.children.length === 0) {
            document.getElementById('transferProgress').classList.add('hidden');
        }
    }
}

// 显示通知
function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm ${
        type === 'success' ? 'bg-green-500 text-white' : 
        type === 'error' ? 'bg-red-500 text-white' : 
        'bg-blue-500 text-white'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // 3秒后自动移除
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
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
    clientConnections.forEach((conn) => {
        if (conn.peerConnection) {
            conn.peerConnection.close();
        }
    });
});
