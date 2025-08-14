import { useState, useRef, useCallback } from 'react';
import { getWsUrl } from '@/lib/config';

// 基础连接状态
interface WebRTCState {
  isConnected: boolean;
  isConnecting: boolean;
  isWebSocketConnected: boolean;
  isPeerConnected: boolean;  // 新增：P2P连接状态
  error: string | null;
}

// 消息类型
interface WebRTCMessage {
  type: string;
  payload: any;
  channel?: string;
}

// 消息和数据处理器类型
type MessageHandler = (message: WebRTCMessage) => void;
type DataHandler = (data: ArrayBuffer) => void;

// WebRTC 连接接口
export interface WebRTCConnection {
  // 状态
  isConnected: boolean;
  isConnecting: boolean;
  isWebSocketConnected: boolean;
  isPeerConnected: boolean;  // 新增：P2P连接状态
  error: string | null;

  // 操作方法
  connect: (roomCode: string, role: 'sender' | 'receiver') => Promise<void>;
  disconnect: () => void;
  sendMessage: (message: WebRTCMessage, channel?: string) => boolean;
  sendData: (data: ArrayBuffer) => boolean;

  // 处理器注册
  registerMessageHandler: (channel: string, handler: MessageHandler) => () => void;
  registerDataHandler: (channel: string, handler: DataHandler) => () => void;

  // 工具方法
  getChannelState: () => RTCDataChannelState;
  isConnectedToRoom: (roomCode: string, role: 'sender' | 'receiver') => boolean;

  // 当前房间信息
  currentRoom: { code: string; role: 'sender' | 'receiver' } | null;

  // 媒体轨道方法
  addTrack: (track: MediaStreamTrack, stream: MediaStream) => RTCRtpSender | null;
  removeTrack: (sender: RTCRtpSender) => void;
  onTrack: (callback: (event: RTCTrackEvent) => void) => void;
  getPeerConnection: () => RTCPeerConnection | null;
  createOfferNow: () => Promise<boolean>;
}

/**
 * 共享 WebRTC 连接管理器
 * 创建单一的 WebRTC 连接实例，供多个业务模块共享使用
 */
export function useSharedWebRTCManager(): WebRTCConnection {
  const [state, setState] = useState<WebRTCState>({
    isConnected: false,
    isConnecting: false,
    isWebSocketConnected: false,
    isPeerConnected: false,
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 当前连接的房间信息
  const currentRoom = useRef<{ code: string; role: 'sender' | 'receiver' } | null>(null);

  // 多通道消息处理器
  const messageHandlers = useRef<Map<string, MessageHandler>>(new Map());
  const dataHandlers = useRef<Map<string, DataHandler>>(new Map());

  // STUN 服务器配置 - 使用更稳定的服务器
  const STUN_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ];

  const updateState = useCallback((updates: Partial<WebRTCState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // 清理连接
  const cleanup = useCallback(() => {
    console.log('[SharedWebRTC] 清理连接');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

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

    currentRoom.current = null;
  }, []);

  // 创建 Offer
  const createOffer = useCallback(async (pc: RTCPeerConnection, ws: WebSocket) => {
    try {
      console.log('[SharedWebRTC] 🎬 开始创建offer，当前轨道数量:', pc.getSenders().length);
      
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,  // 改为true以支持音频接收
        offerToReceiveVideo: true,  // 改为true以支持视频接收
      });

      console.log('[SharedWebRTC] 📝 Offer创建成功，设置本地描述...');
      await pc.setLocalDescription(offer);

      const iceTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'offer', payload: pc.localDescription }));
          console.log('[SharedWebRTC] 📤 发送 offer (超时发送)');
        }
      }, 3000);

      if (pc.iceGatheringState === 'complete') {
        clearTimeout(iceTimeout);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'offer', payload: pc.localDescription }));
          console.log('[SharedWebRTC] 📤 发送 offer (ICE收集完成)');
        }
      } else {
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') {
            clearTimeout(iceTimeout);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'offer', payload: pc.localDescription }));
              console.log('[SharedWebRTC] 📤 发送 offer (ICE收集完成)');
            }
          }
        };
      }
    } catch (error) {
      console.error('[SharedWebRTC] ❌ 创建 offer 失败:', error);
      updateState({ error: '创建连接失败', isConnecting: false });
    }
  }, [updateState]);

  // 处理数据通道消息
  const handleDataChannelMessage = useCallback((event: MessageEvent) => {
    if (typeof event.data === 'string') {
      try {
        const message = JSON.parse(event.data) as WebRTCMessage;
        console.log('[SharedWebRTC] 收到消息:', message.type, message.channel || 'default');

        // 根据通道分发消息
        if (message.channel) {
          const handler = messageHandlers.current.get(message.channel);
          if (handler) {
            handler(message);
          }
        } else {
          // 兼容旧版本，广播给所有处理器
          messageHandlers.current.forEach(handler => handler(message));
        }
      } catch (error) {
        console.error('[SharedWebRTC] 解析消息失败:', error);
      }
    } else if (event.data instanceof ArrayBuffer) {
      console.log('[SharedWebRTC] 收到数据:', event.data.byteLength, 'bytes');

      // 数据优先发给文件传输处理器
      const fileHandler = dataHandlers.current.get('file-transfer');
      if (fileHandler) {
        fileHandler(event.data);
      } else {
        // 如果没有文件处理器，发给第一个处理器
        const firstHandler = dataHandlers.current.values().next().value;
        if (firstHandler) {
          firstHandler(event.data);
        }
      }
    }
  }, []);

  // 连接到房间
  const connect = useCallback(async (roomCode: string, role: 'sender' | 'receiver') => {
    console.log('[SharedWebRTC] 🚀 开始连接到房间:', roomCode, role);

    // 如果正在连接中，避免重复连接
    if (state.isConnecting) {
      console.warn('[SharedWebRTC] ⚠️ 正在连接中，跳过重复连接请求');
      return;
    }

    // 清理之前的连接
    cleanup();
    currentRoom.current = { code: roomCode, role };
    updateState({ isConnecting: true, error: null });

    // 注意：不在这里设置超时，因为WebSocket连接很快，
    // WebRTC连接的建立是在后续添加轨道时进行的

    try {
      console.log('[SharedWebRTC] 🔧 创建PeerConnection...');
      // 创建 PeerConnection
      const pc = new RTCPeerConnection({
        iceServers: STUN_SERVERS,
        iceCandidatePoolSize: 10,
      });
      pcRef.current = pc;

      // 连接 WebSocket - 使用动态URL
      const baseWsUrl = getWsUrl();
      if (!baseWsUrl) {
        throw new Error('WebSocket URL未配置');
      }
      
      // 构建完整的WebSocket URL
      const wsUrl = baseWsUrl.replace('/ws/p2p', `/ws/webrtc?code=${roomCode}&role=${role}&channel=shared`);
      console.log('[SharedWebRTC] 🌐 连接WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // WebSocket 事件处理
      ws.onopen = () => {
        console.log('[SharedWebRTC] ✅ WebSocket 连接已建立，房间准备就绪');
        updateState({ 
          isWebSocketConnected: true,
          isConnecting: false,  // WebSocket连接成功即表示初始连接完成
          isConnected: true     // 可以开始后续操作
        });
      };

      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[SharedWebRTC] 📨 收到信令消息:', message.type);

          switch (message.type) {
            case 'peer-joined':
              // 对方加入房间的通知
              console.log('[SharedWebRTC] 👥 对方已加入房间，角色:', message.payload?.role);
              if (role === 'sender' && message.payload?.role === 'receiver') {
                console.log('[SharedWebRTC] 🚀 接收方已连接，发送方自动建立P2P连接');
                updateState({ isPeerConnected: true }); // 标记对方已加入，可以开始P2P
                
                // 发送方自动创建offer建立基础P2P连接
                try {
                  console.log('[SharedWebRTC] 📡 自动创建基础P2P连接offer');
                  await createOffer(pc, ws);
                } catch (error) {
                  console.error('[SharedWebRTC] 自动创建基础P2P连接失败:', error);
                }
              } else if (role === 'receiver' && message.payload?.role === 'sender') {
                console.log('[SharedWebRTC] 🚀 发送方已连接，接收方准备接收P2P连接');
                updateState({ isPeerConnected: true }); // 标记对方已加入
              }
              break;

            case 'offer':
              console.log('[SharedWebRTC] 📬 处理offer...');
              if (pc.signalingState === 'stable') {
                await pc.setRemoteDescription(new RTCSessionDescription(message.payload));
                console.log('[SharedWebRTC] ✅ 设置远程描述完成');
                
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                console.log('[SharedWebRTC] ✅ 创建并设置answer完成');
                
                ws.send(JSON.stringify({ type: 'answer', payload: answer }));
                console.log('[SharedWebRTC] 📤 发送 answer');
              } else {
                console.warn('[SharedWebRTC] ⚠️ PeerConnection状态不是stable:', pc.signalingState);
              }
              break;

            case 'answer':
              console.log('[SharedWebRTC] 📬 处理answer...');
              if (pc.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(message.payload));
                console.log('[SharedWebRTC] ✅ answer 处理完成');
              } else {
                console.warn('[SharedWebRTC] ⚠️ PeerConnection状态不是have-local-offer:', pc.signalingState);
              }
              break;

            case 'ice-candidate':
              if (message.payload && pc.remoteDescription) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(message.payload));
                  console.log('[SharedWebRTC] ✅ 添加 ICE 候选成功');
                } catch (err) {
                  console.warn('[SharedWebRTC] ⚠️ 添加 ICE 候选失败:', err);
                }
              } else {
                console.warn('[SharedWebRTC] ⚠️ ICE候选无效或远程描述未设置');
              }
              break;

            case 'error':
              console.error('[SharedWebRTC] ❌ 信令服务器错误:', message.error);
              updateState({ error: message.error, isConnecting: false });
              break;

            default:
              console.warn('[SharedWebRTC] ⚠️ 未知消息类型:', message.type);
          }
        } catch (error) {
          console.error('[SharedWebRTC] ❌ 处理信令消息失败:', error);
          updateState({ error: '信令处理失败: ' + error, isConnecting: false });
        }
      };

      ws.onerror = (error) => {
        console.error('[SharedWebRTC] ❌ WebSocket 错误:', error);
        updateState({ error: 'WebSocket连接失败，请检查服务器是否运行在8080端口', isConnecting: false });
      };

      ws.onclose = (event) => {
        console.log('[SharedWebRTC] 🔌 WebSocket 连接已关闭, 代码:', event.code, '原因:', event.reason);
        updateState({ isWebSocketConnected: false });
        if (event.code !== 1000 && event.code !== 1001) { // 非正常关闭
          updateState({ error: `WebSocket异常关闭 (${event.code}): ${event.reason || '未知原因'}`, isConnecting: false });
        }
      };

      // PeerConnection 事件处理
      pc.onicecandidate = (event) => {
        if (event.candidate && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'ice-candidate',
            payload: event.candidate
          }));
          console.log('[SharedWebRTC] 📤 发送 ICE 候选:', event.candidate.candidate.substring(0, 50) + '...');
        } else if (!event.candidate) {
          console.log('[SharedWebRTC] 🏁 ICE 收集完成');
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[SharedWebRTC] 🧊 ICE连接状态变化:', pc.iceConnectionState);
        switch (pc.iceConnectionState) {
          case 'checking':
            console.log('[SharedWebRTC] 🔍 正在检查ICE连接...');
            break;
          case 'connected':
          case 'completed':
            console.log('[SharedWebRTC] ✅ ICE连接成功');
            break;
          case 'failed':
            console.error('[SharedWebRTC] ❌ ICE连接失败');
            updateState({ error: 'ICE连接失败，可能是网络防火墙阻止了连接', isConnecting: false });
            break;
          case 'disconnected':
            console.log('[SharedWebRTC] 🔌 ICE连接断开');
            break;
          case 'closed':
            console.log('[SharedWebRTC] 🚫 ICE连接已关闭');
            break;
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[SharedWebRTC] 🔗 WebRTC连接状态变化:', pc.connectionState);
        switch (pc.connectionState) {
          case 'connecting':
            console.log('[SharedWebRTC] 🔄 WebRTC正在连接中...');
            updateState({ isPeerConnected: false });
            break;
          case 'connected':
            console.log('[SharedWebRTC] 🎉 WebRTC P2P连接已完全建立，可以进行媒体传输');
            updateState({ isPeerConnected: true, error: null });
            break;
          case 'failed':
            // 只有在数据通道也未打开的情况下才认为连接真正失败
            const currentDc = dcRef.current;
            if (!currentDc || currentDc.readyState !== 'open') {
              console.error('[SharedWebRTC] ❌ WebRTC连接失败，数据通道未建立');
              updateState({ error: 'WebRTC连接失败，请检查网络设置或重试', isPeerConnected: false });
            } else {
              console.log('[SharedWebRTC] ⚠️ WebRTC连接状态为failed，但数据通道正常，忽略此状态');
            }
            break;
          case 'disconnected':
            console.log('[SharedWebRTC] 🔌 WebRTC连接已断开');
            updateState({ isPeerConnected: false });
            break;
          case 'closed':
            console.log('[SharedWebRTC] 🚫 WebRTC连接已关闭');
            updateState({ isPeerConnected: false });
            break;
        }
      };

      // 数据通道处理
      if (role === 'sender') {
        const dataChannel = pc.createDataChannel('shared-channel', {
          ordered: true,
          maxRetransmits: 3
        });
        dcRef.current = dataChannel;

        dataChannel.onopen = () => {
          console.log('[SharedWebRTC] 数据通道已打开 (发送方)');
          updateState({ isPeerConnected: true, error: null, isConnecting: false });
        };

        dataChannel.onmessage = handleDataChannelMessage;

        dataChannel.onerror = (error) => {
          console.error('[SharedWebRTC] 数据通道错误:', error);
          updateState({ error: '数据通道连接失败，可能是网络环境受限', isConnecting: false });
        };
      } else {
        pc.ondatachannel = (event) => {
          const dataChannel = event.channel;
          dcRef.current = dataChannel;

          dataChannel.onopen = () => {
            console.log('[SharedWebRTC] 数据通道已打开 (接收方)');
            updateState({ isPeerConnected: true, error: null, isConnecting: false });
          };

          dataChannel.onmessage = handleDataChannelMessage;

          dataChannel.onerror = (error) => {
            console.error('[SharedWebRTC] 数据通道错误:', error);
            updateState({ error: '数据通道连接失败，可能是网络环境受限', isConnecting: false });
          };
        };
      }

      // 设置轨道接收处理（对于接收方）
      pc.ontrack = (event) => {
        console.log('[SharedWebRTC] 🎥 PeerConnection收到轨道:', event.track.kind, event.track.id);
        console.log('[SharedWebRTC] 关联的流数量:', event.streams.length);
        
        if (event.streams.length > 0) {
          console.log('[SharedWebRTC] 🎬 轨道关联到流:', event.streams[0].id);
        }
        
        // 这里不处理，让具体的业务逻辑处理
        // onTrack会被业务逻辑重新设置
      };

    } catch (error) {
      console.error('[SharedWebRTC] 连接失败:', error);
      updateState({
        error: error instanceof Error ? error.message : '连接失败',
        isConnecting: false
      });
    }
  }, [updateState, cleanup, createOffer, handleDataChannelMessage, state.isConnecting, state.isConnected]);

  // 断开连接
  const disconnect = useCallback(() => {
    console.log('[SharedWebRTC] 断开连接');
    cleanup();
    setState({
      isConnected: false,
      isConnecting: false,
      isWebSocketConnected: false,
      isPeerConnected: false,
      error: null,
    });
  }, [cleanup]);

  // 发送消息
  const sendMessage = useCallback((message: WebRTCMessage, channel?: string) => {
    const dataChannel = dcRef.current;
    if (!dataChannel || dataChannel.readyState !== 'open') {
      console.error('[SharedWebRTC] 数据通道未准备就绪');
      return false;
    }

    try {
      const messageWithChannel = channel ? { ...message, channel } : message;
      dataChannel.send(JSON.stringify(messageWithChannel));
      console.log('[SharedWebRTC] 发送消息:', message.type, channel || 'default');
      return true;
    } catch (error) {
      console.error('[SharedWebRTC] 发送消息失败:', error);
      return false;
    }
  }, []);

  // 发送二进制数据
  const sendData = useCallback((data: ArrayBuffer) => {
    const dataChannel = dcRef.current;
    if (!dataChannel || dataChannel.readyState !== 'open') {
      console.error('[SharedWebRTC] 数据通道未准备就绪');
      return false;
    }

    try {
      dataChannel.send(data);
      console.log('[SharedWebRTC] 发送数据:', data.byteLength, 'bytes');
      return true;
    } catch (error) {
      console.error('[SharedWebRTC] 发送数据失败:', error);
      return false;
    }
  }, []);

  // 注册消息处理器
  const registerMessageHandler = useCallback((channel: string, handler: MessageHandler) => {
    console.log('[SharedWebRTC] 注册消息处理器:', channel);
    messageHandlers.current.set(channel, handler);

    return () => {
      console.log('[SharedWebRTC] 取消注册消息处理器:', channel);
      messageHandlers.current.delete(channel);
    };
  }, []);

  // 注册数据处理器
  const registerDataHandler = useCallback((channel: string, handler: DataHandler) => {
    console.log('[SharedWebRTC] 注册数据处理器:', channel);
    dataHandlers.current.set(channel, handler);

    return () => {
      console.log('[SharedWebRTC] 取消注册数据处理器:', channel);
      dataHandlers.current.delete(channel);
    };
  }, []);

  // 获取数据通道状态
  const getChannelState = useCallback(() => {
    return dcRef.current?.readyState || 'closed';
  }, []);

  // 检查是否已连接到指定房间
  const isConnectedToRoom = useCallback((roomCode: string, role: 'sender' | 'receiver') => {
    return currentRoom.current?.code === roomCode &&
      currentRoom.current?.role === role &&
      state.isConnected;
  }, [state.isConnected]);

  // 添加媒体轨道
  const addTrack = useCallback((track: MediaStreamTrack, stream: MediaStream) => {
    const pc = pcRef.current;
    if (!pc) {
      console.error('[SharedWebRTC] PeerConnection 不可用');
      return null;
    }
    
    try {
      return pc.addTrack(track, stream);
    } catch (error) {
      console.error('[SharedWebRTC] 添加轨道失败:', error);
      return null;
    }
  }, []);

  // 移除媒体轨道
  const removeTrack = useCallback((sender: RTCRtpSender) => {
    const pc = pcRef.current;
    if (!pc) {
      console.error('[SharedWebRTC] PeerConnection 不可用');
      return;
    }
    
    try {
      pc.removeTrack(sender);
    } catch (error) {
      console.error('[SharedWebRTC] 移除轨道失败:', error);
    }
  }, []);

  // 设置轨道处理器
  const onTrack = useCallback((handler: (event: RTCTrackEvent) => void) => {
    const pc = pcRef.current;
    if (!pc) {
      console.warn('[SharedWebRTC] PeerConnection 尚未准备就绪，将在连接建立后设置onTrack');
      // 延迟设置，等待PeerConnection准备就绪
      const checkAndSetTrackHandler = () => {
        const currentPc = pcRef.current;
        if (currentPc) {
          console.log('[SharedWebRTC] ✅ PeerConnection 已准备就绪，设置onTrack处理器');
          currentPc.ontrack = handler;
        } else {
          console.log('[SharedWebRTC] ⏳ 等待PeerConnection准备就绪...');
          setTimeout(checkAndSetTrackHandler, 100);
        }
      };
      checkAndSetTrackHandler();
      return;
    }
    
    console.log('[SharedWebRTC] ✅ 立即设置onTrack处理器');
    pc.ontrack = handler;
  }, []);

  // 获取PeerConnection实例
  const getPeerConnection = useCallback(() => {
    return pcRef.current;
  }, []);

  // 立即创建offer（用于媒体轨道添加后的重新协商）
  const createOfferNow = useCallback(async () => {
    const pc = pcRef.current;
    const ws = wsRef.current;
    if (!pc || !ws) {
      console.error('[SharedWebRTC] PeerConnection 或 WebSocket 不可用');
      return false;
    }
    
    try {
      await createOffer(pc, ws);
      return true;
    } catch (error) {
      console.error('[SharedWebRTC] 创建 offer 失败:', error);
      return false;
    }
  }, [createOffer]);

  return {
    // 状态
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    isWebSocketConnected: state.isWebSocketConnected,
    isPeerConnected: state.isPeerConnected,
    error: state.error,

    // 操作方法
    connect,
    disconnect,
    sendMessage,
    sendData,

    // 处理器注册
    registerMessageHandler,
    registerDataHandler,

    // 工具方法
    getChannelState,
    isConnectedToRoom,

    // 媒体轨道方法
    addTrack,
    removeTrack,
    onTrack,
    getPeerConnection,
    createOfferNow,

    // 当前房间信息
    currentRoom: currentRoom.current,
  };
}
