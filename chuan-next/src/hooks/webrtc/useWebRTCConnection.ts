import { url } from 'inspector';
import { useState, useRef, useCallback } from 'react';

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

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const STUN_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];

  // 连接超时时间（30秒）
  const CONNECTION_TIMEOUT = 30000;

  const updateState = useCallback((updates: Partial<WebRTCConnectionState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

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
    updateState({ 
      error: '连接超时，请检查取件码是否正确或稍后重试',
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

    // 清理之前的超时定时器
    clearConnectionTimeout();

    updateState({ isConnecting: true, error: null });

    // 设置连接超时
    timeoutRef.current = setTimeout(() => {
      handleConnectionTimeout();
    }, CONNECTION_TIMEOUT);

    try {
      // 创建PeerConnection
      const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
      pcRef.current = pc;

      // 连接WebSocket信令服务器
      const ws = new WebSocket(`ws://localhost:8080/ws/webrtc?code=${roomCode}&role=${role}`);
      wsRef.current = ws;

      // WebSocket事件处理
      ws.onopen = async () => {
        console.log('WebSocket连接已建立');
        updateState({ isWebSocketConnected: true });
        
        // 如果是发送方，在WebSocket连接建立后创建offer
        if (role === 'sender') {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            ws.send(JSON.stringify({ type: 'offer', payload: offer }));
            console.log('已发送offer');
          } catch (error) {
            console.error('创建offer失败:', error);
            updateState({ error: '创建连接失败', isConnecting: false });
          }
        }
      };

      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('收到信令消息:', message);

          switch (message.type) {
            case 'offer':
              if (message.payload) {
                await pc.setRemoteDescription(new RTCSessionDescription(message.payload));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'answer', payload: answer }));
                  console.log('已发送answer');
                }
              }
              break;

            case 'answer':
              if (message.payload) {
                await pc.setRemoteDescription(new RTCSessionDescription(message.payload));
              }
              break;

            case 'ice-candidate':
              if (message.payload) {
                await pc.addIceCandidate(new RTCIceCandidate(message.payload));
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
        updateState({ error: 'WebSocket连接失败', isConnecting: false, isWebSocketConnected: false });
      };

      ws.onclose = () => {
        console.log('WebSocket连接已关闭');
        updateState({ isWebSocketConnected: false });
      };

      // ICE候选事件
      pc.onicecandidate = (event) => {
        if (event.candidate && ws.readyState === WebSocket.OPEN) {
          console.log('发送ICE候选:', event.candidate);
          ws.send(JSON.stringify({
            type: 'ice-candidate',
            payload: event.candidate
          }));
        }
      };

      // 连接状态变化
      pc.onconnectionstatechange = () => {
        console.log('连接状态:', pc.connectionState);
        const isConnected = pc.connectionState === 'connected';
        
        if (isConnected) {
          // 连接成功，清理超时定时器
          clearConnectionTimeout();
        }
        
        updateState({ 
          isConnected,
          isConnecting: !isConnected && pc.connectionState !== 'failed'
        });

        if (pc.connectionState === 'failed') {
          clearConnectionTimeout();
          updateState({ error: '连接失败', isConnecting: false });
        }
      };

      // 如果是发送方，创建数据通道
      if (role === 'sender') {
        const dataChannel = pc.createDataChannel('fileTransfer', {
          ordered: true,
          maxPacketLifeTime: undefined,
          maxRetransmits: undefined
        });
        dcRef.current = dataChannel;

        // 设置缓冲区管理
        dataChannel.bufferedAmountLowThreshold = 256 * 1024; // 256KB

        dataChannel.onopen = () => {
          console.log('数据通道已打开 (发送方)');
          console.log('数据通道配置:', {
            id: dataChannel.id,
            label: dataChannel.label,
            maxPacketLifeTime: dataChannel.maxPacketLifeTime,
            maxRetransmits: dataChannel.maxRetransmits,
            ordered: dataChannel.ordered,
            bufferedAmountLowThreshold: dataChannel.bufferedAmountLowThreshold
          });
          updateState({ localDataChannel: dataChannel });
        };
      } else {
        // 接收方等待数据通道
        pc.ondatachannel = (event) => {
          const dataChannel = event.channel;
          dcRef.current = dataChannel;
          console.log('收到数据通道 (接收方)');

          dataChannel.onopen = () => {
            console.log('数据通道已打开 (接收方)');
            updateState({ remoteDataChannel: dataChannel });
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
  }, [updateState, clearConnectionTimeout, handleConnectionTimeout]);

  const disconnect = useCallback(() => {
    console.log('断开WebRTC连接');

    // 清理超时定时器
    clearConnectionTimeout();

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
