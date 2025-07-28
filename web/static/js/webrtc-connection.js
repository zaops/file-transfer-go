// WebSocket和WebRTC连接管理

// 全局变量
let clientConnections = new Map(); // 存储与其他客户端的P2P连接
let currentClientId = '';          // 当前客户端ID

// WebSocket连接
function connectWebSocket() {
    console.log('尝试连接WebSocket, 角色:', currentRole, '取件码:', currentPickupCode);
    
    if (!currentPickupCode || !currentRole) {
        console.error('缺少必要参数：取件码或角色');
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
            console.log('WebSocket连接已建立');
            isConnecting = false;
            updateConnectionStatus(true);
            
            // 连接建立后，启用P2P功能
            if (currentRole === 'receiver') {
                updateP2PStatus(true); // 接收方连接成功后立即启用下载
            }
            
            // 发送方在WebSocket连接建立后初始化（等待接收方连接）
            if (currentRole === 'sender') {
                console.log('发送方初始化完成，等待接收方连接');
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
            
            // 清理所有P2P连接
            clientConnections.forEach((conn, clientId) => {
                if (conn.peerConnection) {
                    conn.peerConnection.close();
                }
            });
            clientConnections.clear();
            
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
        showNotification('无法创建WebSocket连接', 'error');
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
            
        case 'room-status':
            // 房间状态更新
            updateRoomStatus(message.payload);
            break;
            
        case 'new-receiver':
            // 新接收方加入
            if (currentRole === 'sender') {
                console.log('新接收方加入:', message.payload.client_id);
                // 发送方可以准备为新接收方创建P2P连接
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
            // 清理对应的P2P连接
            if (clientConnections.has(message.payload.client_id)) {
                const conn = clientConnections.get(message.payload.client_id);
                if (conn.peerConnection) {
                    conn.peerConnection.close();
                }
                clientConnections.delete(message.payload.client_id);
            }
            break;
            
        case 'file-request':
            // 文件请求
            if (currentRole === 'sender') {
                await handleFileRequest(message.payload);
            }
            break;
            
        // WebRTC信令消息
        case 'offer':
            await handleOffer(message.payload);
            break;
        case 'answer':
            await handleAnswer(message.payload);
            break;
        case 'ice-candidate':
            await handleIceCandidate(message.payload);
            break;
            
        default:
            console.log('未知消息类型:', message.type);
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
        document.getElementById('roomStatusSection').classList.remove('hidden');
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
        receiverStatus.innerHTML = connected ? 
            `<div class="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800">
                <span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                已连接，可以下载文件
            </div>` :
            `<div class="inline-flex items-center px-3 py-1 rounded-full bg-red-100 text-red-800">
                <span class="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                连接断开
            </div>`;
    }
}

// 处理文件请求
async function handleFileRequest(payload) {
    console.log('处理文件请求:', payload);
    
    const fileId = payload.file_id;
    const requesterId = payload.requester;
    const requestId = payload.request_id;
    
    // 找到对应的文件
    const file = selectedFiles.find(f => f.id === fileId || selectedFiles.indexOf(f).toString() === fileId);
    if (!file) {
        console.error('未找到请求的文件:', fileId);
        return;
    }
    
    // 创建或获取与请求者的P2P连接
    let connection = clientConnections.get(requesterId);
    if (!connection) {
        connection = await createPeerConnection(requesterId);
        clientConnections.set(requesterId, connection);
    }
    
    // 发送文件
    if (connection.dataChannel && connection.dataChannel.readyState === 'open') {
        await sendFileToClient(file, connection.dataChannel, requestId);
    } else {
        console.log('等待数据通道建立...');
        connection.pendingFiles = connection.pendingFiles || [];
        connection.pendingFiles.push({ file, requestId });
    }
}

// 创建P2P连接
async function createPeerConnection(targetClientId) {
    console.log('创建P2P连接到:', targetClientId);
    
    const connection = {
        peerConnection: null,
        dataChannel: null,
        pendingFiles: []
    };
    
    const pc = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    });
    
    connection.peerConnection = pc;
    
    // 创建数据通道（发送方）
    if (currentRole === 'sender') {
        const dataChannel = pc.createDataChannel('fileTransfer', {
            ordered: true
        });
        
        connection.dataChannel = dataChannel;
        
        dataChannel.onopen = () => {
            console.log('数据通道已打开，可以传输文件');
            // 发送待发送的文件
            if (connection.pendingFiles && connection.pendingFiles.length > 0) {
                connection.pendingFiles.forEach(({ file, requestId }) => {
                    sendFileToClient(file, dataChannel, requestId);
                });
                connection.pendingFiles = [];
            }
        };
        
        dataChannel.onmessage = (event) => {
            console.log('数据通道收到消息:', event.data);
        };
    }
    
    // 处理数据通道（接收方）
    pc.ondatachannel = (event) => {
        const channel = event.channel;
        connection.dataChannel = channel;
        
        channel.onopen = () => {
            console.log('接收方数据通道已打开');
        };
        
        channel.onmessage = (event) => {
            handleFileData(event.data, targetClientId);
        };
    };
    
    // ICE候选者
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            websocket.send(JSON.stringify({
                type: 'ice-candidate',
                payload: {
                    candidate: event.candidate,
                    target_client: targetClientId
                }
            }));
        }
    };
    
    return connection;
}

// 处理WebRTC信令消息
async function handleOffer(payload) {
    console.log('处理offer:', payload);
    // 实现WebRTC offer处理逻辑
}

async function handleAnswer(payload) {
    console.log('处理answer:', payload);
    // 实现WebRTC answer处理逻辑
}

// 发送文件给客户端
async function sendFileToClient(file, dataChannel, requestId) {
    console.log('开始发送文件:', file.name, '到客户端');
    
    // 发送文件信息
    const fileInfo = {
        type: 'file-info',
        file_id: requestId,
        name: file.name,
        size: file.size,
        mime_type: file.type,
        last_modified: file.lastModified
    };
    
    dataChannel.send(JSON.stringify(fileInfo));
    
    // 分块发送文件
    const chunkSize = 65536; // 64KB chunks
    let offset = 0;
    
    const sendChunk = () => {
        if (offset >= file.size) {
            // 发送完成消息
            const completeMsg = {
                type: 'file-complete',
                file_id: requestId
            };
            dataChannel.send(JSON.stringify(completeMsg));
            console.log('文件发送完成:', file.name);
            return;
        }
        
        const slice = file.slice(offset, offset + chunkSize);
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const chunk = e.target.result;
            
            // 发送块元数据
            const metadata = {
                type: 'file-chunk-meta',
                file_id: requestId,
                offset: offset,
                size: chunk.byteLength,
                is_last: offset + chunk.byteLength >= file.size
            };
            
            dataChannel.send(JSON.stringify(metadata));
            
            // 发送二进制数据
            dataChannel.send(chunk);
            
            offset += chunk.byteLength;
            
            // 继续发送下一块
            setTimeout(sendChunk, 10); // 小延时以避免阻塞
        };
        
        reader.readAsArrayBuffer(slice);
    };
    
    sendChunk();
}

// 处理接收到的文件数据
function handleFileData(data, senderId) {
    console.log('从发送方接收文件数据:', senderId);
    
    // 检查是否是二进制数据
    if (data instanceof ArrayBuffer) {
        // 处理二进制数据块
        if (pendingChunkMeta) {
            receiveFileChunk(pendingChunkMeta, data, senderId);
            pendingChunkMeta = null;
        }
    } else {
        // 处理JSON消息
        try {
            const message = JSON.parse(data);
            console.log('接收到文件传输消息:', message.type);
            
            switch (message.type) {
                case 'file-chunk-meta':
                    // 存储chunk元数据，等待二进制数据
                    pendingChunkMeta = message;
                    break;
                    
                case 'file-info':
                    // 初始化文件传输
                    initFileTransfer(message, senderId);
                    break;
                    
                case 'file-complete':
                    // 文件传输完成
                    completeFileDownload(message.file_id, senderId);
                    break;
                    
                default:
                    console.log('未知文件传输消息类型:', message.type);
            }
        } catch (error) {
            console.error('解析文件传输消息失败:', error);
        }
    }
}

// 初始化文件传输
function initFileTransfer(fileInfo, senderId) {
    console.log('初始化文件传输:', fileInfo);
    
    const transferKey = `${fileInfo.file_id}_${senderId}`;
    
    if (!fileTransfers.has(transferKey)) {
        fileTransfers.set(transferKey, {
            fileId: fileInfo.file_id,
            senderId: senderId,
            chunks: [],
            totalSize: fileInfo.size,
            receivedSize: 0,
            fileName: fileInfo.name,
            mimeType: fileInfo.mime_type || fileInfo.type,
            startTime: Date.now()
        });
        
        console.log('文件传输已初始化:', transferKey);
    }
}

// 接收文件数据块
function receiveFileChunk(metadata, chunk, senderId) {
    const transferKey = `${metadata.file_id}_${senderId}`;
    const transfer = fileTransfers.get(transferKey);
    
    if (!transfer) {
        console.error('未找到对应的文件传输:', transferKey);
        return;
    }
    
    // 存储数据块
    transfer.chunks.push({
        offset: metadata.offset,
        data: chunk
    });
    
    transfer.receivedSize += chunk.byteLength;
    
    // 更新进度
    const progress = (transfer.receivedSize / transfer.totalSize) * 100;
    updateTransferProgress(metadata.file_id, progress, transfer.receivedSize, transfer.totalSize);
    
    console.log(`文件块接收进度: ${progress.toFixed(1)}% (${transfer.receivedSize}/${transfer.totalSize})`);
    
    // 检查是否是最后一块
    if (metadata.is_last || transfer.receivedSize >= transfer.totalSize) {
        console.log('文件接收完成，开始合并数据块');
        assembleAndDownloadFile(transferKey);
    }
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
    const totalSize = transfer.chunks.reduce((sum, chunk) => sum + chunk.data.byteLength, 0);
    const mergedData = new Uint8Array(totalSize);
    let currentOffset = 0;
    
    transfer.chunks.forEach(chunk => {
        const chunkView = new Uint8Array(chunk.data);
        mergedData.set(chunkView, currentOffset);
        currentOffset += chunkView.length;
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

// 为发送方初始化P2P连接（不立即创建offer）
function initPeerConnectionForSender() {
    console.log('为发送方初始化P2P连接（等待接收方就绪）');
    
    // 清除之前的超时定时器
    if (connectionTimeout) {
        clearTimeout(connectionTimeout);
    }
    
    // 设置连接超时（60秒，合理的超时时间）
    connectionTimeout = setTimeout(() => {
        console.error('P2P连接超时（60秒）');
        if (peerConnection && !isP2PConnected) {
            console.log('关闭超时的P2P连接');
            peerConnection.close();
            peerConnection = null;
            updateP2PStatus(false);
            alert('P2P连接超时，请检查网络连接并重试');
        }
    }, 60000);
    
    // 使用国内优化的WebRTC配置
    peerConnection = new RTCPeerConnection({
        iceServers: [
            // 阿里云和腾讯STUN服务器
            { urls: 'stun:stun.chat.bilibili.com:3478' },
            { urls: 'stun:stun.voipbuster.com' },
            { urls: 'stun:stun.voipstunt.com' },
            { urls: 'stun:stun.qq.com:3478' },
            // 备用国外服务器
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10
    });
    
    // 连接状态监听
    peerConnection.onconnectionstatechange = () => {
        console.log('P2P连接状态:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
            console.log('P2P连接建立成功');
            isP2PConnected = true;
            updateP2PStatus(true);
            
            // 清除连接超时定时器
            if (connectionTimeout) {
                clearTimeout(connectionTimeout);
                connectionTimeout = null;
            }
        } else if (peerConnection.connectionState === 'failed') {
            console.error('P2P连接失败');
            updateP2PStatus(false);
        }
    };
    
    // ICE连接状态监听
    peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE连接状态:', peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === 'failed') {
            console.error('ICE连接失败');
            updateP2PStatus(false);
        }
    };
    
    // 创建数据通道
    dataChannel = peerConnection.createDataChannel('fileTransfer', {
        ordered: true
    });
    setupDataChannel(dataChannel);
    
    // 处理ICE候选
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log('发送ICE候选:', event.candidate.candidate);
            sendWebSocketMessage({
                type: 'ice-candidate',
                payload: event.candidate
            });
        } else {
            console.log('ICE候选收集完成');
        }
    };
}

// 创建offer（发送方专用）
function createOffer() {
    if (!peerConnection) {
        console.error('PeerConnection未初始化');
        return;
    }
    
    console.log('发送方创建 offer');
    
    peerConnection.createOffer().then(offer => {
        console.log('Offer 创建成功');
        return peerConnection.setLocalDescription(offer);
    }).then(() => {
        console.log('本地描述设置成功，发送 offer');
        sendWebSocketMessage({
            type: 'offer',
            payload: peerConnection.localDescription
        });
    }).catch(error => {
        console.error('创建 offer 失败:', error);
    });
}

// 初始化P2P连接（接收方使用）
function initPeerConnection() {
    console.log('接收方初始化P2P连接');
    
    // 清除之前的超时定时器
    if (connectionTimeout) {
        clearTimeout(connectionTimeout);
    }
    
    // 设置连接超时（60秒）
    connectionTimeout = setTimeout(() => {
        console.error('P2P连接超时（60秒）');
        if (peerConnection && !isP2PConnected) {
            console.log('关闭超时的P2P连接');
            peerConnection.close();
            peerConnection = null;
            updateP2PStatus(false);
            alert('P2P连接超时，请检查网络连接并重试');
        }
    }, 60000);
    
    // 使用国内优化配置
    peerConnection = new RTCPeerConnection({
        iceServers: [
            // 阿里云和腾讯STUN服务器
            { urls: 'stun:stun.chat.bilibili.com:3478' },
            { urls: 'stun:stun.voipbuster.com' },
            { urls: 'stun:stun.voipstunt.com' },
            { urls: 'stun:stun.qq.com:3478' },
            // 备用国外服务器
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10
    });
    
    // 连接状态监听
    peerConnection.onconnectionstatechange = () => {
        console.log('P2P连接状态:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
            console.log('P2P连接建立成功');
            isP2PConnected = true;
            updateP2PStatus(true);
            
            // 清除连接超时定时器
            if (connectionTimeout) {
                clearTimeout(connectionTimeout);
                connectionTimeout = null;
            }
        } else if (peerConnection.connectionState === 'failed') {
            console.error('P2P连接失败');
            updateP2PStatus(false);
        }
    };
    
    // ICE连接状态监听
    peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE连接状态:', peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === 'failed') {
            console.error('ICE连接失败');
            updateP2PStatus(false);
        }
    };
    
    // 处理数据通道
    peerConnection.ondatachannel = (event) => {
        console.log('接收到数据通道');
        const channel = event.channel;
        setupDataChannel(channel);
    };
    
    // 处理ICE候选
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log('发送ICE候选:', event.candidate.candidate);
            sendWebSocketMessage({
                type: 'ice-candidate',
                payload: event.candidate
            });
        } else {
            console.log('ICE候选收集完成');
        }
    };
}

// 处理WebSocket消息
async function handleWebSocketMessage(message) {
    console.log('收到WebSocket消息:', message.type);
    
    try {
        switch (message.type) {
            case 'offer':
                console.log('处理 offer');
                // 确保接收方的peerConnection已初始化
                if (!peerConnection) {
                    console.log('接收方peerConnection未初始化，先初始化');
                    initPeerConnection();
                    // 等待一小段时间让peerConnection完全初始化
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
                await peerConnection.setRemoteDescription(new RTCSessionDescription(message.payload));
                console.log('远程描述设置成功，创建 answer');
                
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                console.log('本地描述设置成功，发送 answer');
                
                sendWebSocketMessage({
                    type: 'answer',
                    payload: answer
                });
                break;
                
            case 'answer':
                console.log('处理 answer');
                if (peerConnection) {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(message.payload));
                    console.log('远程 answer 设置成功');
                } else {
                    console.error('收到answer但peerConnection未初始化');
                }
                break;
                
            case 'ice-candidate':
                console.log('处理 ICE 候选:', message.payload.candidate);
                if (peerConnection && peerConnection.remoteDescription) {
                    try {
                        await peerConnection.addIceCandidate(new RTCIceCandidate(message.payload));
                        console.log('ICE 候选添加成功');
                    } catch (error) {
                        console.error('添加ICE候选失败:', error);
                    }
                } else {
                    console.warn('收到ICE候选但远程描述未设置，暂时缓存');
                }
                break;
                
            case 'file-list':
                if (currentRole === 'receiver') {
                    console.log('接收到文件列表');
                    displayReceiverFiles(message.payload.files);
                    // 接收方在收到文件列表后初始化P2P连接
                    if (!peerConnection) {
                        console.log('初始化接收方P2P连接');
                        initPeerConnection();
                    }
                }
                break;
                
            case 'receiver-ready':
                if (currentRole === 'sender') {
                    console.log('接收方已连接，创建offer');
                    // 发送方现在可以创建offer了
                    setTimeout(() => {
                        if (peerConnection && !isP2PConnected) {
                            createOffer();
                        }
                    }, 500);
                }
                break;
        }
    } catch (error) {
        console.error('处理WebSocket消息失败:', error);
    }
}

// 发送WebSocket消息
function sendWebSocketMessage(message) {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify(message));
    } else {
        console.warn('WebSocket未连接，无法发送消息:', message.type);
    }
}
