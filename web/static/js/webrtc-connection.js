// WebSocket和WebRTC连接管理

// WebSocket连接
function connectWebSocket() {
    console.log('尝试连接WebSocket, 角色:', currentRole, '取件码:', currentPickupCode);
    
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
    
    websocket = new WebSocket(wsUrl);
    
    websocket.onopen = () => {
        console.log('WebSocket连接已建立');
        isConnecting = false;
        updateConnectionStatus(true);
        
        // 发送方在WebSocket连接建立后立即初始化P2P（但不创建offer）
        if (currentRole === 'sender') {
            console.log('发送方初始化P2P连接（等待接收方就绪）');
            initPeerConnectionForSender();
        }
    };
    
    websocket.onmessage = async (event) => {
        try {
            const message = JSON.parse(event.data);
            await handleWebSocketMessage(message);
        } catch (error) {
            console.error('解析WebSocket消息失败:', error);
        }
    };
    
    websocket.onerror = (error) => {
        console.error('WebSocket错误:', error);
        isConnecting = false;
        updateConnectionStatus(false);
        updateP2PStatus(false);
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
            setTimeout(() => {
                if (currentPickupCode && !websocket && !isConnecting) {
                    console.log('尝试重新连接WebSocket');
                    connectWebSocket();
                }
            }, 5000);
        }
    };
}

// 更新连接状态
function updateConnectionStatus(connected) {
    const senderStatus = document.getElementById('senderStatus');
    const receiverStatus = document.getElementById('receiverStatus');
    
    if (currentRole === 'sender' && senderStatus) {
        senderStatus.innerHTML = connected ? 
            `<div class="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800">
                <span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                接收方已连接
            </div>` :
            `<div class="inline-flex items-center px-3 py-1 rounded-full bg-yellow-100 text-yellow-800">
                <span class="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                等待接收方连接...
            </div>`;
    }
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
