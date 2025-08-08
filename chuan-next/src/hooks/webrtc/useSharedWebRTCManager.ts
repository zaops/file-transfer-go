import { useState, useRef, useCallback } from 'react';
import { config } from '@/lib/config';

// 基础连接状态
interface WebRTCState {
  isConnected: boolean;
  isConnecting: boolean;
  isWebSocketConnected: boolean;
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

  // STUN 服务器配置
  const STUN_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.miwifi.com' },
    { urls: 'stun:turn.cloudflare.com:3478' },
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
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      
      await pc.setLocalDescription(offer);
      
      const iceTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'offer', payload: pc.localDescription }));
          console.log('[SharedWebRTC] 发送 offer (超时发送)');
        }
      }, 3000);

      if (pc.iceGatheringState === 'complete') {
        clearTimeout(iceTimeout);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'offer', payload: pc.localDescription }));
          console.log('[SharedWebRTC] 发送 offer (ICE收集完成)');
        }
      } else {
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') {
            clearTimeout(iceTimeout);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'offer', payload: pc.localDescription }));
              console.log('[SharedWebRTC] 发送 offer (ICE收集完成)');
            }
          }
        };
      }
    } catch (error) {
      console.error('[SharedWebRTC] 创建 offer 失败:', error);
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
    console.log('[SharedWebRTC] 连接到房间:', roomCode, role);

    // 检查是否已经连接到相同房间
    if (currentRoom.current?.code === roomCode && currentRoom.current?.role === role) {
      if (state.isConnected) {
        console.log('[SharedWebRTC] 已连接到相同房间，复用连接');
        return;
      }
      if (state.isConnecting) {
        console.log('[SharedWebRTC] 正在连接到相同房间，等待连接完成');
        return new Promise<void>((resolve, reject) => {
          const checkConnection = () => {
            if (state.isConnected) {
              resolve();
            } else if (!state.isConnecting) {
              reject(new Error('连接失败'));
            } else {
              setTimeout(checkConnection, 100);
            }
          };
          checkConnection();
        });
      }
    }

    // 如果要连接到不同房间，先断开当前连接
    if (currentRoom.current && (currentRoom.current.code !== roomCode || currentRoom.current.role !== role)) {
      console.log('[SharedWebRTC] 切换到新房间，断开当前连接');
      cleanup();
      updateState({
        isConnected: false,
        isConnecting: false,
        isWebSocketConnected: false,
        error: null,
      });
    }

    if (state.isConnecting) {
      console.warn('[SharedWebRTC] 正在连接中，跳过重复连接请求');
      return;
    }

    cleanup();
    currentRoom.current = { code: roomCode, role };
    updateState({ isConnecting: true, error: null });

    // 设置连接超时
    timeoutRef.current = setTimeout(() => {
      console.warn('[SharedWebRTC] 连接超时');
      updateState({ error: '连接超时，请检查网络状况或重新尝试', isConnecting: false });
      cleanup();
    }, 30000);

    try {
      // 创建 PeerConnection
      const pc = new RTCPeerConnection({
        iceServers: STUN_SERVERS,
        iceCandidatePoolSize: 10,
      });
      pcRef.current = pc;

      // 连接 WebSocket
      const wsUrl = config.api.wsUrl.replace('/ws/p2p', '/ws/webrtc');
      const ws = new WebSocket(`${wsUrl}?code=${roomCode}&role=${role}&channel=shared`);
      wsRef.current = ws;

      // WebSocket 事件处理
      ws.onopen = () => {
        console.log('[SharedWebRTC] WebSocket 连接已建立');
        updateState({ isWebSocketConnected: true });

        if (role === 'sender') {
          createOffer(pc, ws);
        }
      };

      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[SharedWebRTC] 收到信令消息:', message.type);

          switch (message.type) {
            case 'offer':
              if (pc.signalingState === 'stable') {
                await pc.setRemoteDescription(new RTCSessionDescription(message.payload));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                ws.send(JSON.stringify({ type: 'answer', payload: answer }));
                console.log('[SharedWebRTC] 发送 answer');
              }
              break;

            case 'answer':
              if (pc.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(message.payload));
                console.log('[SharedWebRTC] 处理 answer 完成');
              }
              break;

            case 'ice-candidate':
              if (message.payload && pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(message.payload));
                console.log('[SharedWebRTC] 添加 ICE 候选');
              }
              break;

            case 'error':
              console.error('[SharedWebRTC] 信令错误:', message.error);
              updateState({ error: message.error, isConnecting: false });
              break;
          }
        } catch (error) {
          console.error('[SharedWebRTC] 处理信令消息失败:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[SharedWebRTC] WebSocket 错误:', error);
        updateState({ error: 'WebSocket连接失败，请检查网络连接', isConnecting: false });
      };

      ws.onclose = () => {
        console.log('[SharedWebRTC] WebSocket 连接已关闭');
        updateState({ isWebSocketConnected: false });
      };

      // PeerConnection 事件处理
      pc.onicecandidate = (event) => {
        if (event.candidate && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'ice-candidate',
            payload: event.candidate
          }));
          console.log('[SharedWebRTC] 发送 ICE 候选');
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[SharedWebRTC] 连接状态变化:', pc.connectionState);
        switch (pc.connectionState) {
          case 'connected':
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            updateState({ isConnected: true, isConnecting: false, error: null });
            break;
          case 'failed':
            updateState({ error: 'WebRTC连接失败，可能是网络防火墙阻止了连接', isConnecting: false, isConnected: false });
            break;
          case 'disconnected':
            updateState({ isConnected: false });
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            break;
          case 'closed':
            updateState({ isConnected: false, isConnecting: false });
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
          };

          dataChannel.onmessage = handleDataChannelMessage;

          dataChannel.onerror = (error) => {
            console.error('[SharedWebRTC] 数据通道错误:', error);
            updateState({ error: '数据通道连接失败，可能是网络环境受限', isConnecting: false });
          };
        };
      }

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

  return {
    // 状态
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    isWebSocketConnected: state.isWebSocketConnected,
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
    
    // 当前房间信息
    currentRoom: currentRoom.current,
  };
}
