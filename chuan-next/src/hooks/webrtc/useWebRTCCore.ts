import { useState, useRef, useCallback } from 'react';
import { config } from '@/lib/config';

// 基础连接状态
interface WebRTCCoreState {
  isConnected: boolean;
  isConnecting: boolean;
  isWebSocketConnected: boolean;
  error: string | null;
}

// 消息类型
interface WebRTCMessage {
  type: string;
  payload: any;
}

// 消息处理器类型
type MessageHandler = (message: WebRTCMessage) => void;
type DataHandler = (data: ArrayBuffer) => void;

/**
 * WebRTC 核心连接逻辑
 * 提供可复用的连接建立逻辑，但每个业务模块独立使用
 * 不共享连接实例，只共享连接逻辑
 */
export function useWebRTCCore(channelLabel: string = 'data') {
  const [state, setState] = useState<WebRTCCoreState>({
    isConnected: false,
    isConnecting: false,
    isWebSocketConnected: false,
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 消息处理器存储
  const messageHandlerRef = useRef<MessageHandler | null>(null);
  const dataHandlerRef = useRef<DataHandler | null>(null);

  // STUN 服务器配置
  const STUN_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.miwifi.com' },
    { urls: 'stun:turn.cloudflare.com:3478' },
  ];

  const updateState = useCallback((updates: Partial<WebRTCCoreState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // 清理连接
  const cleanup = useCallback(() => {
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
  }, []);

  // 创建 Offer
  const createOffer = useCallback(async (pc: RTCPeerConnection, ws: WebSocket) => {
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      
      await pc.setLocalDescription(offer);
      
      // 等待 ICE 候选收集完成或超时
      const iceTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'offer', payload: pc.localDescription }));
          console.log(`[${channelLabel}] 发送 offer (超时发送)`);
        }
      }, 3000);

      if (pc.iceGatheringState === 'complete') {
        clearTimeout(iceTimeout);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'offer', payload: pc.localDescription }));
          console.log(`[${channelLabel}] 发送 offer (ICE收集完成)`);
        }
      } else {
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') {
            clearTimeout(iceTimeout);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'offer', payload: pc.localDescription }));
              console.log(`[${channelLabel}] 发送 offer (ICE收集完成)`);
            }
          }
        };
      }
    } catch (error) {
      console.error(`[${channelLabel}] 创建 offer 失败:`, error);
      updateState({ error: '创建连接失败', isConnecting: false });
    }
  }, [channelLabel, updateState]);

  // 处理数据通道消息
  const handleDataChannelMessage = useCallback((event: MessageEvent) => {
    if (typeof event.data === 'string') {
      try {
        const message = JSON.parse(event.data);
        console.log(`[${channelLabel}] 收到消息:`, message.type);
        if (messageHandlerRef.current) {
          messageHandlerRef.current(message);
        }
      } catch (error) {
        console.error(`[${channelLabel}] 解析消息失败:`, error);
      }
    } else if (event.data instanceof ArrayBuffer) {
      console.log(`[${channelLabel}] 收到数据:`, event.data.byteLength, 'bytes');
      if (dataHandlerRef.current) {
        dataHandlerRef.current(event.data);
      }
    }
  }, [channelLabel]);

  // 连接到房间
  const connect = useCallback(async (roomCode: string, role: 'sender' | 'receiver') => {
    console.log(`=== [${channelLabel}] WebRTC 连接开始 ===`);
    console.log(`[${channelLabel}] 房间代码:`, roomCode, '角色:', role);

    // 检查是否已经在连接中或已连接
    if (state.isConnecting) {
      console.warn(`[${channelLabel}] 正在连接中，跳过重复连接请求`);
      return;
    }

    if (state.isConnected) {
      console.warn(`[${channelLabel}] 已经连接，跳过重复连接请求`);
      return;
    }

    // 清理之前的连接（如果存在）
    cleanup();

    updateState({ isConnecting: true, error: null });

    // 设置连接超时
    timeoutRef.current = setTimeout(() => {
      console.warn(`[${channelLabel}] 连接超时`);
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

      // 连接 WebSocket - 使用不同的标识来区分不同的业务连接
      const wsUrl = config.api.wsUrl.replace('/ws/p2p', '/ws/webrtc');
      const ws = new WebSocket(`${wsUrl}?code=${roomCode}&role=${role}&channel=${channelLabel}`);
      wsRef.current = ws;

      // WebSocket 事件处理
      ws.onopen = () => {
        console.log(`[${channelLabel}] WebSocket 连接已建立`);
        updateState({ isWebSocketConnected: true });

        if (role === 'sender') {
          createOffer(pc, ws);
        }
      };

      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log(`[${channelLabel}] 收到信令消息:`, message.type);

          switch (message.type) {
            case 'offer':
              if (pc.signalingState === 'stable') {
                await pc.setRemoteDescription(new RTCSessionDescription(message.payload));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                ws.send(JSON.stringify({ type: 'answer', payload: answer }));
                console.log(`[${channelLabel}] 发送 answer`);
              }
              break;

            case 'answer':
              if (pc.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(message.payload));
                console.log(`[${channelLabel}] 处理 answer 完成`);
              }
              break;

            case 'ice-candidate':
              if (message.payload && pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(message.payload));
                console.log(`[${channelLabel}] 添加 ICE 候选`);
              }
              break;

            case 'error':
              console.error(`[${channelLabel}] 信令错误:`, message.error);
              updateState({ error: message.error, isConnecting: false });
              break;
          }
        } catch (error) {
          console.error(`[${channelLabel}] 处理信令消息失败:`, error);
        }
      };

      ws.onerror = (error) => {
        console.error(`[${channelLabel}] WebSocket 错误:`, error);
        updateState({ error: 'WebSocket连接失败，请检查网络连接', isConnecting: false });
      };

      ws.onclose = () => {
        console.log(`[${channelLabel}] WebSocket 连接已关闭`);
        updateState({ isWebSocketConnected: false });
      };

      // PeerConnection 事件处理
      pc.onicecandidate = (event) => {
        if (event.candidate && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'ice-candidate',
            payload: event.candidate
          }));
          console.log(`[${channelLabel}] 发送 ICE 候选`);
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(`[${channelLabel}] 连接状态变化:`, pc.connectionState);
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
        const dataChannel = pc.createDataChannel(channelLabel, { 
          ordered: true,
          maxRetransmits: 3
        });
        dcRef.current = dataChannel;

        dataChannel.onopen = () => {
          console.log(`[${channelLabel}] 数据通道已打开 (发送方)`);
        };

        dataChannel.onmessage = handleDataChannelMessage;

        dataChannel.onerror = (error) => {
          console.error(`[${channelLabel}] 数据通道错误:`, error);
          updateState({ error: '数据通道连接失败，可能是网络环境受限', isConnecting: false });
        };
      } else {
        pc.ondatachannel = (event) => {
          const dataChannel = event.channel;
          dcRef.current = dataChannel;
          
          dataChannel.onopen = () => {
            console.log(`[${channelLabel}] 数据通道已打开 (接收方)`);
          };

          dataChannel.onmessage = handleDataChannelMessage;

          dataChannel.onerror = (error) => {
            console.error(`[${channelLabel}] 数据通道错误:`, error);
            updateState({ error: '数据通道连接失败，可能是网络环境受限', isConnecting: false });
          };
        };
      }

    } catch (error) {
      console.error(`[${channelLabel}] 连接失败:`, error);
      updateState({ 
        error: error instanceof Error ? error.message : '连接失败',
        isConnecting: false 
      });
    }
  }, [channelLabel, updateState, cleanup, createOffer, handleDataChannelMessage, state.isConnecting, state.isConnected]);

  // 断开连接
  const disconnect = useCallback(() => {
    console.log(`[${channelLabel}] 断开 WebRTC 连接`);
    cleanup();
    setState({
      isConnected: false,
      isConnecting: false,
      isWebSocketConnected: false,
      error: null,
    });
  }, [channelLabel, cleanup]);

  // 发送消息
  const sendMessage = useCallback((message: WebRTCMessage) => {
    const dataChannel = dcRef.current;
    if (!dataChannel || dataChannel.readyState !== 'open') {
      console.error(`[${channelLabel}] 数据通道未准备就绪`);
      return false;
    }

    try {
      dataChannel.send(JSON.stringify(message));
      console.log(`[${channelLabel}] 发送消息:`, message.type);
      return true;
    } catch (error) {
      console.error(`[${channelLabel}] 发送消息失败:`, error);
      return false;
    }
  }, [channelLabel]);

  // 发送二进制数据
  const sendData = useCallback((data: ArrayBuffer) => {
    const dataChannel = dcRef.current;
    if (!dataChannel || dataChannel.readyState !== 'open') {
      console.error(`[${channelLabel}] 数据通道未准备就绪`);
      return false;
    }

    try {
      dataChannel.send(data);
      console.log(`[${channelLabel}] 发送数据:`, data.byteLength, 'bytes');
      return true;
    } catch (error) {
      console.error(`[${channelLabel}] 发送数据失败:`, error);
      return false;
    }
  }, [channelLabel]);

  // 设置消息处理器
  const setMessageHandler = useCallback((handler: MessageHandler | null) => {
    messageHandlerRef.current = handler;
  }, []);

  // 设置数据处理器
  const setDataHandler = useCallback((handler: DataHandler | null) => {
    dataHandlerRef.current = handler;
  }, []);

  // 获取数据通道状态
  const getChannelState = useCallback(() => {
    return dcRef.current?.readyState || 'closed';
  }, []);

  return {
    // 状态
    ...state,

    // 操作方法
    connect,
    disconnect,
    sendMessage,
    sendData,

    // 处理器设置
    setMessageHandler,
    setDataHandler,

    // 工具方法
    getChannelState,
  };
}
