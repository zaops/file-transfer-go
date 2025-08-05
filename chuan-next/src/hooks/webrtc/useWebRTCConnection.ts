import { useState, useRef, useCallback } from 'react';
import { config } from '@/lib/config';

interface WebRTCConnectionState {
    isConnected: boolean;
    isConnecting: boolean;
    isWebSocketConnected: boolean;
    error: string | null;
    localDataChannel: RTCDataChannel | null;
    remoteDataChannel: RTCDataChannel | null;
}

export function useWebRTCConnection() {
    const [state, setState] = useState<WebRTCConnectionState>({
        isConnected: false,
        isConnecting: false,
        isWebSocketConnected: false,
        error: null,
        localDataChannel: null,
        remoteDataChannel: null,
    });

    // 浏览器兼容性检测
    const detectBrowser = useCallback(() => {
        const userAgent = navigator.userAgent;
        const isEdge = /Edg/.test(userAgent);
        const isChrome = /Chrome/.test(userAgent) && !isEdge;
        const isSafari = /Safari/.test(userAgent) && !isChrome && !isEdge;
        const isFirefox = /Firefox/.test(userAgent);
        const isChromeFamily = isChrome || isEdge; // Chrome内核系列
        
        console.log('浏览器检测结果:', {
            userAgent: userAgent.substring(0, 100) + '...',
            isEdge,
            isChrome, 
            isSafari,
            isFirefox,
            isChromeFamily,
            webRTCSupport: {
                RTCPeerConnection: !!window.RTCPeerConnection,
                getUserMedia: !!(navigator.mediaDevices?.getUserMedia),
                WebSocket: !!window.WebSocket
            }
        });

        return { isEdge, isChrome, isSafari, isFirefox, isChromeFamily };
    }, []);

    const wsRef = useRef<WebSocket | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const dcRef = useRef<RTCDataChannel | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const pendingIceCandidates = useRef<RTCIceCandidate[]>([]);
    const iceGatheringTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const STUN_SERVERS = [
    // Edge 浏览器专用优化配置
    { urls: 'stun:stun.miwifi.com' },
    { urls: 'stun:stun.chat.bilibili.com' },
    { urls: 'stun:turn.cloudflare.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
    // 备用 STUN 服务器
    { urls: 'stun:stun.nextcloud.com:443' },
    { urls: 'stun:stun.sipgate.net:10000' },
    { urls: 'stun:stun.ekiga.net' },
  ];

  // 获取浏览器特定的 RTCConfiguration
  const getBrowserSpecificConfig = useCallback(() => {
    const { isSafari, isChromeFamily } = detectBrowser();
    
    const baseConfig = {
      iceServers: STUN_SERVERS,
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle' as RTCBundlePolicy,
      rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy,
      iceTransportPolicy: 'all' as RTCIceTransportPolicy
    };

    if (isChromeFamily) {
      console.log('应用 Chrome 内核浏览器优化配置');
      return {
        ...baseConfig,
        // Chrome 内核特定优化
        iceCandidatePoolSize: 20, // 增加候选池大小
        bundlePolicy: 'max-bundle' as RTCBundlePolicy,
        rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy,
        iceTransportPolicy: 'all' as RTCIceTransportPolicy,
        // Chrome 内核需要更宽松的配置
        sdpSemantics: 'unified-plan' as const, // 明确使用统一计划
      };
    }

    if (isSafari) {
      console.log('应用 Safari 浏览器优化配置');
      return {
        ...baseConfig,
        // Safari 特定优化
        iceCandidatePoolSize: 8,
        sdpSemantics: 'unified-plan' as const,
      };
    }

    console.log('应用默认浏览器配置');
    return baseConfig;
  }, [detectBrowser, STUN_SERVERS]);

  // 连接超时时间（30秒）
  const CONNECTION_TIMEOUT = 30000;

    const updateState = useCallback((updates: Partial<WebRTCConnectionState>) => {
        setState(prev => ({ ...prev, ...updates }));
    }, []);

    // 处理缓存的ICE候选
    const processPendingIceCandidates = useCallback(async () => {
        const pc = pcRef.current;
        if (!pc || !pc.remoteDescription || pendingIceCandidates.current.length === 0) {
            return;
        }

        console.log('处理缓存的ICE候选，数量:', pendingIceCandidates.current.length);
        
        for (const candidate of pendingIceCandidates.current) {
            try {
                await pc.addIceCandidate(candidate);
                console.log('已添加缓存的ICE候选');
            } catch (error) {
                console.warn('添加缓存ICE候选失败:', error);
            }
        }
        
        // 清空缓存
        pendingIceCandidates.current = [];
    }, []);

    // 优化的Offer创建和发送
    const createAndSendOffer = useCallback(async (pc: RTCPeerConnection, ws: WebSocket) => {
        console.log('开始创建offer...');
        
        // 获取浏览器信息
        const browserInfo = detectBrowser();
        
        try {
            // Chrome内核需要特殊的offer配置
            const offerOptions = browserInfo.isChromeFamily ? {
                offerToReceiveAudio: false,
                offerToReceiveVideo: false,
                iceRestart: false,
                // Chrome内核特定配置
                voiceActivityDetection: false
            } : {
                offerToReceiveAudio: false,
                offerToReceiveVideo: false,
                iceRestart: false
            };
            
            console.log('使用的 offer 配置:', offerOptions);
            
            // 创建offer
            const offer = await pc.createOffer(offerOptions);
            
            await pc.setLocalDescription(offer);
            console.log('已设置本地描述，等待ICE候选收集...');
            
            // Chrome内核需要更长的ICE收集时间
            const iceGatheringTimeout = browserInfo.isChromeFamily ? 5000 : 3000;
            
            // 设置ICE收集超时 - 等待更多ICE候选
            const iceTimeout = setTimeout(() => {
                console.log('ICE收集超时，发送当前offer');
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'offer', payload: pc.localDescription }));
                    console.log('已发送offer (超时发送)');
                }
            }, iceGatheringTimeout);
            
            iceGatheringTimeoutRef.current = iceTimeout;
            
            // 监听ICE收集完成
            const handleIceGatheringComplete = () => {
                if (iceGatheringTimeoutRef.current) {
                    clearTimeout(iceGatheringTimeoutRef.current);
                    iceGatheringTimeoutRef.current = null;
                }
                
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'offer', payload: pc.localDescription }));
                    const candidateCount = pc.localDescription?.sdp ? 
                        pc.localDescription.sdp.split('a=candidate:').length - 1 : 0;
                    console.log('已发送offer (ICE收集完成)', '候选数量:', candidateCount);
                }
            };
            
            // 检查ICE收集状态
            if (pc.iceGatheringState === 'complete') {
                handleIceGatheringComplete();
            } else {
                // 监听ICE收集状态变化
                const originalHandler = pc.onicegatheringstatechange;
                pc.onicegatheringstatechange = (event) => {
                    console.log('ICE收集状态变化:', pc.iceGatheringState);
                    if (originalHandler) originalHandler.call(pc, event);
                    
                    if (pc.iceGatheringState === 'complete') {
                        handleIceGatheringComplete();
                        // 恢复原始处理器
                        pc.onicegatheringstatechange = originalHandler;
                    }
                };
            }
            
        } catch (error) {
            console.error('创建offer失败:', error);
            updateState({ error: '创建连接失败', isConnecting: false });
        }
    }, [updateState, detectBrowser]);

    // 清理超时定时器
    const clearConnectionTimeout = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    // 处理连接超时
    const handleConnectionTimeout = useCallback(() => {
        console.warn('WebRTC连接超时');

        // 获取当前连接状态用于调试
        const pc = pcRef.current;
        const connectionInfo = {
            connectionState: pc?.connectionState || 'unknown',
            iceConnectionState: pc?.iceConnectionState || 'unknown',
            signalingState: pc?.signalingState || 'unknown',
            isWebSocketConnected: wsRef.current?.readyState === WebSocket.OPEN
        };

        console.log('连接超时时的状态:', connectionInfo);

        updateState({
            error: `连接超时 - WebSocket: ${connectionInfo.isWebSocketConnected ? '已连接' : '未连接'}, 信令状态: ${connectionInfo.signalingState}, 连接状态: ${connectionInfo.connectionState}`,
            isConnecting: false
        });

        // 清理连接
        if (wsRef.current) {
            wsRef.current.close();
        }
        if (pcRef.current) {
            pcRef.current.close();
        }
    }, [updateState]);

    const connect = useCallback(async (roomCode: string, role: 'sender' | 'receiver') => {
        console.log('=== 开始WebRTC连接 ===');
        console.log('房间代码:', roomCode, '角色:', role);

        // 浏览器兼容性检测
        const browserInfo = detectBrowser();
        console.log('当前浏览器:', browserInfo);

        // 清理之前的超时定时器
        clearConnectionTimeout();

        updateState({ isConnecting: true, error: null });

        // Chrome内核浏览器使用更长的超时时间
        const timeoutDuration = browserInfo.isChromeFamily ? CONNECTION_TIMEOUT * 2 : CONNECTION_TIMEOUT;
        
        // 只有接收方设置连接超时，发送方无限等待
        if (role === 'receiver') {
            timeoutRef.current = setTimeout(() => {
                handleConnectionTimeout();
            }, timeoutDuration);
        }

        try {
            // 获取浏览器特定的配置
            const rtcConfig = getBrowserSpecificConfig();
            console.log('使用的 RTCConfiguration:', rtcConfig);

            // 创建PeerConnection
            const pc = new RTCPeerConnection(rtcConfig);
            pcRef.current = pc;

            // 连接WebSocket信令服务器
            const wsUrl = config.api.wsUrl.replace('/ws/p2p', '/ws/webrtc');
            const finalWsUrl = `${wsUrl}?code=${roomCode}&role=${role}`;

            console.log('WebSocket 连接信息:', {
                原始wsUrl: config.api.wsUrl,
                替换后wsUrl: wsUrl,
                最终URL: finalWsUrl,
                当前域名: typeof window !== 'undefined' ? window.location.host : 'unknown',
                协议: typeof window !== 'undefined' ? window.location.protocol : 'unknown',
                端口: typeof window !== 'undefined' ? window.location.port : 'unknown',
                浏览器: browserInfo
            });

            const ws = new WebSocket(finalWsUrl);
            wsRef.current = ws;

            // Chrome内核特殊处理：增加连接超时检测
            let wsConnectTimeout: NodeJS.Timeout | null = null;
            
            if (browserInfo.isChromeFamily) {
                wsConnectTimeout = setTimeout(() => {
                    if (ws.readyState === WebSocket.CONNECTING) {
                        console.error('Chrome内核 - WebSocket连接超时');
                        ws.close();
                        updateState({ 
                            error: 'WebSocket连接超时 - Chrome内核可能存在安全策略限制', 
                            isConnecting: false 
                        });
                    }
                }, 10000); // 10秒超时
            }

            // WebSocket事件处理
            ws.onopen = async () => {
                console.log('WebSocket连接已建立，URL:', finalWsUrl);
                
                // 清理Chrome内核的连接超时
                if (wsConnectTimeout) {
                    clearTimeout(wsConnectTimeout);
                    wsConnectTimeout = null;
                }
                
                updateState({ isWebSocketConnected: true });

                // 如果是发送方，在WebSocket连接建立后创建offer
                if (role === 'sender') {
                    // 使用优化的offer创建逻辑
                    createAndSendOffer(pc, ws);
                    // 发送方发送 offer 后，停止 connecting 状态
                    updateState({ isConnecting: false });
                }
            };

            ws.onmessage = async (event) => {
                try {
                    const message = JSON.parse(event.data);
                    console.log('收到信令消息:', message, '当前PC状态:', pc.signalingState);

                    switch (message.type) {
                        case 'offer':
                            if (message.payload) {
                                console.log('处理offer，当前状态:', pc.signalingState);
                                try {
                                    // 根据W3C规范，只有在stable状态下才能接收offer
                                    if (pc.signalingState !== 'stable') {
                                        console.warn('跳过offer，信令状态不为stable:', pc.signalingState);
                                        return;
                                    }
                                    
                                    await pc.setRemoteDescription(new RTCSessionDescription(message.payload));
                                    console.log('已设置远程描述，状态变为:', pc.signalingState);
                                    
                                    // 创建answer
                                    const answer = await pc.createAnswer();
                                    await pc.setLocalDescription(answer);
                                    console.log('已创建并设置本地answer，状态变为:', pc.signalingState);
                                    
                                    if (ws.readyState === WebSocket.OPEN) {
                                        ws.send(JSON.stringify({ type: 'answer', payload: answer }));
                                        console.log('已发送answer');
                                    }
                                    
                                    // 接收方发送answer后，停止connecting状态
                                    updateState({ isConnecting: false });
                                    
                                    // 处理缓存的ICE候选
                                    await processPendingIceCandidates();
                                } catch (error) {
                                    console.error('处理offer失败:', error);
                                    updateState({ error: '信令交换失败', isConnecting: false });
                                }
                            }
                            break;

                        case 'answer':
                            if (message.payload) {
                                console.log('处理answer，当前状态:', pc.signalingState);
                                try {
                                    // 根据W3C规范，只有在have-local-offer状态下才能接收answer
                                    if (pc.signalingState !== 'have-local-offer') {
                                        console.warn('跳过answer，信令状态不为have-local-offer:', pc.signalingState);
                                        return;
                                    }
                                    
                                    await pc.setRemoteDescription(new RTCSessionDescription(message.payload));
                                    console.log('信令交换完成，状态变为:', pc.signalingState);
                                    
                                    // 处理缓存的ICE候选
                                    await processPendingIceCandidates();
                                } catch (error) {
                                    console.error('处理answer失败:', error);
                                    updateState({ error: '信令交换失败', isConnecting: false });
                                }
                            }
                            break;

                        case 'ice-candidate':
                            if (message.payload) {
                                try {
                                    const candidate = new RTCIceCandidate(message.payload);
                                    
                                    // 根据W3C规范，检查连接状态
                                    if (pc.signalingState === 'closed') {
                                        console.warn('跳过ICE候选，连接已关闭');
                                        return;
                                    }
                                    
                                    // 如果有远程描述，直接添加ICE候选
                                    if (pc.remoteDescription) {
                                        await pc.addIceCandidate(candidate);
                                        console.log('已添加ICE候选:', {
                                            type: candidate.type,
                                            protocol: candidate.protocol,
                                            address: candidate.address?.substring(0, 10) + '...',
                                            port: candidate.port
                                        });
                                    } else {
                                        // 缓存ICE候选，等待远程描述设置后处理
                                        pendingIceCandidates.current.push(candidate);
                                        console.log('缓存ICE候选，等待远程描述:', {
                                            type: candidate.type,
                                            缓存数量: pendingIceCandidates.current.length
                                        });
                                    }
                                } catch (error) {
                                    console.warn('处理ICE候选失败:', error);
                                    // 根据W3C规范，ICE候选错误不应该终止连接
                                }
                            }
                            break;

                        case 'disconnection':
                            console.log('收到断开连接通知:', message.payload);
                            const disconnectionMessage = message.payload?.message || '对方已停止传输';
                            updateState({
                                error: disconnectionMessage,
                                isConnecting: false,
                                isConnected: false,
                                isWebSocketConnected: false
                            });
                            // 关闭WebSocket连接
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.close(1000, '对方已断开连接');
                            }
                            // 关闭WebRTC连接
                            if (pc.connectionState !== 'closed') {
                                pc.close();
                            }
                            break;

                        case 'error':
                            console.error('信令错误:', message.error);
                            updateState({ error: message.error, isConnecting: false });
                            break;
                    }
                } catch (error) {
                    console.error('处理信令消息失败:', error);
                    updateState({ error: '信令处理失败', isConnecting: false });
                }
            };

            ws.onerror = (error) => {
                console.error('WebSocket错误:', error);
                console.error('WebSocket连接失败，URL:', finalWsUrl);
                
                // 清理Chrome内核的连接超时
                if (wsConnectTimeout) {
                    clearTimeout(wsConnectTimeout);
                    wsConnectTimeout = null;
                }
                
                // Chrome内核特殊错误处理
                const errorMessage = browserInfo.isChromeFamily 
                    ? 'WebSocket连接失败 - Chrome内核可能阻止了不安全的连接，请确保使用HTTPS'
                    : 'WebSocket连接失败';
                    
                updateState({ 
                    error: errorMessage, 
                    isConnecting: false, 
                    isWebSocketConnected: false 
                });
            };

            ws.onclose = (event) => {
                console.log('WebSocket连接已关闭，代码:', event.code, '原因:', event.reason, 'URL:', finalWsUrl);
                updateState({ isWebSocketConnected: false });
            };

            // ICE候选事件 - 增强处理，Edge浏览器特殊优化
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    const candidateInfo = {
                        type: event.candidate.type,
                        protocol: event.candidate.protocol,
                        address: event.candidate.address,
                        port: event.candidate.port,
                        priority: event.candidate.priority,
                        foundation: event.candidate.foundation
                    };
                    
                    console.log('ICE候选信息:', candidateInfo);

                    // Chrome内核浏览器特殊处理：检查候选质量和延迟
                    if (browserInfo.isChromeFamily && event.candidate.priority !== null) {
                        // Chrome内核可能生成质量较低的候选，添加延迟来等待更好的候选
                        const isLowQualityCandidate = event.candidate.type === 'host' && 
                                                    event.candidate.priority < 1000000;
                        
                        if (isLowQualityCandidate) {
                            console.log('Chrome内核 - 延迟发送低质量候选');
                            setTimeout(() => {
                                if (ws.readyState === WebSocket.OPEN) {
                                    ws.send(JSON.stringify({
                                        type: 'ice-candidate',
                                        payload: event.candidate
                                    }));
                                }
                            }, 800); // Chrome内核需要更长延迟
                            return;
                        }
                    }

                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'ice-candidate',
                            payload: event.candidate
                        }));
                    }
                } else {
                    console.log('ICE候选收集完成');
                }
            };

            // 添加ICE收集状态监听
            pc.onicegatheringstatechange = () => {
                console.log('ICE收集状态变化:', pc.iceGatheringState);
            };

            // 信令状态变化监听 - 增强版
            pc.onsignalingstatechange = () => {
                console.log('信令状态变化:', pc.signalingState);
                
                // 根据W3C规范验证状态转换
                switch (pc.signalingState) {
                    case 'stable':
                        console.log('信令协商完成，连接稳定');
                        break;
                    case 'have-local-offer':
                        console.log('已发送offer，等待answer');
                        break;
                    case 'have-remote-offer':
                        console.log('已接收offer，需要发送answer');
                        break;
                    case 'have-local-pranswer':
                        console.log('已发送provisional answer');
                        break;
                    case 'have-remote-pranswer':
                        console.log('已接收provisional answer');
                        break;
                    case 'closed':
                        console.log('连接已关闭');
                        break;
                    default:
                        console.warn('未知的信令状态:', pc.signalingState);
                }
            };

            // 连接状态变化 - 根据W3C规范
            pc.onconnectionstatechange = () => {
                console.log('连接状态变化:', pc.connectionState);
                
                switch (pc.connectionState) {
                    case 'new':
                        console.log('连接初始化');
                        break;
                    case 'connecting':
                        console.log('正在建立连接...');
                        // 只有在当前不是已连接状态时才设置为连接中
                        if (!state.isConnected) {
                            updateState({ isConnecting: true });
                        }
                        break;
                    case 'connected':
                        console.log('连接已建立');
                        clearConnectionTimeout();
                        updateState({ 
                            isConnected: true,
                            isConnecting: false
                        });
                        break;
                    case 'disconnected':
                        console.log('连接已断开');
                        updateState({ 
                            isConnected: false
                        });
                        break;
                    case 'failed':
                        console.log('连接失败');
                        clearConnectionTimeout();
                        updateState({ 
                            error: '连接失败',
                            isConnecting: false,
                            isConnected: false
                        });
                        break;
                    case 'closed':
                        console.log('连接已关闭');
                        updateState({ 
                            isConnected: false,
                            isConnecting: false
                        });
                        break;
                }
            };

            // ICE连接状态变化 - 根据W3C规范
            pc.oniceconnectionstatechange = () => {
                console.log('ICE连接状态变化:', pc.iceConnectionState);

                switch (pc.iceConnectionState) {
                    case 'new':
                        console.log('ICE连接初始化');
                        break;
                    case 'checking':
                        console.log('ICE正在检查连通性...');
                        break;
                    case 'connected':
                        console.log('ICE连接成功');
                        clearConnectionTimeout();
                        break;
                    case 'completed':
                        console.log('ICE连接完成');
                        clearConnectionTimeout();
                        break;
                    case 'disconnected':
                        console.log('ICE连接断开');
                        updateState({ 
                            error: 'ICE连接断开',
                            isConnected: false
                        });
                        break;
                    case 'failed':
                        console.log('ICE连接失败');
                        clearConnectionTimeout();
                        updateState({ 
                            error: 'ICE连接失败',
                            isConnecting: false,
                            isConnected: false
                        });
                        break;
                    case 'closed':
                        console.log('ICE连接已关闭');
                        break;
                }
            };

            // 如果是发送方，创建数据通道
            if (role === 'sender') {
                // 根据浏览器优化数据通道配置
                const dataChannelConfig = browserInfo.isChromeFamily ? {
                    ordered: true,
                    maxPacketLifeTime: undefined,
                    maxRetransmits: undefined,
                    // Chrome内核特定配置
                    negotiated: false,
                    id: undefined,
                    protocol: ''  // Chrome内核需要明确指定协议
                } : {
                    ordered: true,
                    maxPacketLifeTime: undefined,
                    maxRetransmits: undefined
                };

                console.log('创建数据通道，配置:', dataChannelConfig);
                
                // 根据W3C规范，数据通道应该在设置本地描述之前创建
                const dataChannel = pc.createDataChannel('fileTransfer', dataChannelConfig);
                dcRef.current = dataChannel;

                // 设置缓冲区管理
                dataChannel.bufferedAmountLowThreshold = 256 * 1024; // 256KB

                dataChannel.onopen = () => {
                    console.log('数据通道已打开 (发送方)');
                    // 数据通道成功打开，清除超时定时器
                    clearConnectionTimeout();
                    console.log('数据通道配置:', {
                        id: dataChannel.id,
                        label: dataChannel.label,
                        maxPacketLifeTime: dataChannel.maxPacketLifeTime,
                        maxRetransmits: dataChannel.maxRetransmits,
                        ordered: dataChannel.ordered,
                        bufferedAmountLowThreshold: dataChannel.bufferedAmountLowThreshold,
                        readyState: dataChannel.readyState
                    });
                    updateState({ localDataChannel: dataChannel });
                };

                dataChannel.onclose = () => {
                    console.log('数据通道已关闭 (发送方)');
                    updateState({ localDataChannel: null });
                };

                dataChannel.onerror = (error) => {
                    console.error('数据通道错误 (发送方):', error);
                    updateState({ error: '数据通道连接失败', isConnecting: false });
                };
            } else {
                // 接收方等待数据通道
                pc.ondatachannel = (event) => {
                    const dataChannel = event.channel;
                    dcRef.current = dataChannel;
                    console.log('收到数据通道 (接收方)，标签:', dataChannel.label);

                    dataChannel.onopen = () => {
                        console.log('数据通道已打开 (接收方)');
                        // 数据通道成功打开，清除超时定时器
                        clearConnectionTimeout();
                        console.log('数据通道配置:', {
                            id: dataChannel.id,
                            label: dataChannel.label,
                            readyState: dataChannel.readyState
                        });
                        updateState({ remoteDataChannel: dataChannel });
                    };

                    dataChannel.onclose = () => {
                        console.log('数据通道已关闭 (接收方)');
                        updateState({ remoteDataChannel: null });
                    };

                    dataChannel.onerror = (error) => {
                        console.error('数据通道错误 (接收方):', error);
                        updateState({ error: '数据通道连接失败', isConnecting: false });
                    };
                };
            }

        } catch (error) {
            console.error('连接失败:', error);
            clearConnectionTimeout();
            updateState({
                error: error instanceof Error ? error.message : '连接失败',
                isConnecting: false
            });
        }
    }, [updateState, clearConnectionTimeout, handleConnectionTimeout, processPendingIceCandidates, createAndSendOffer, detectBrowser, getBrowserSpecificConfig]);

    const disconnect = useCallback(() => {
        console.log('断开WebRTC连接');

        // 清理超时定时器
        clearConnectionTimeout();
        
        // 清理ICE收集超时
        if (iceGatheringTimeoutRef.current) {
            clearTimeout(iceGatheringTimeoutRef.current);
            iceGatheringTimeoutRef.current = null;
            console.log('已清理ICE收集超时定时器');
        }

        // 清理缓存的ICE候选
        pendingIceCandidates.current = [];

        if (dcRef.current) {
            dcRef.current.close();
            dcRef.current = null;
        }

        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }

        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        setState({
            isConnected: false,
            isConnecting: false,
            isWebSocketConnected: false,
            error: null,
            localDataChannel: null,
            remoteDataChannel: null,
        });
    }, [clearConnectionTimeout]);

    const getDataChannel = useCallback(() => {
        return dcRef.current;
    }, []);

    return {
        ...state,
        connect,
        disconnect,
        getDataChannel,
    };
}
