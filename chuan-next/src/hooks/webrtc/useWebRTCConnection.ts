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

  const STUN_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];

  const updateState = useCallback((updates: Partial<WebRTCConnectionState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const connect = useCallback(async (roomCode: string, role: 'sender' | 'receiver') => {
    console.log('=== 开始WebRTC连接 ===');
    console.log('房间代码:', roomCode, '角色:', role);

    updateState({ isConnecting: true, error: null });

    try {
      // 创建PeerConnection
      const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
      pcRef.current = pc;

      // 连接WebSocket信令服务器
      const ws = new WebSocket(`ws://localhost:8080/ws/webrtc?room=${roomCode}&role=${role}`);
      wsRef.current = ws;

      // WebSocket事件处理
      ws.onopen = () => {
        console.log('WebSocket连接已建立');
        updateState({ isWebSocketConnected: true });
      };

      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('收到信令消息:', message);

          switch (message.type) {
            case 'offer':
              await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              ws.send(JSON.stringify({ type: 'answer', answer }));
              break;

            case 'answer':
              await pc.setRemoteDescription(new RTCSessionDescription(message.answer));
              break;

            case 'ice-candidate':
              if (message.candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
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
            candidate: event.candidate
          }));
        }
      };

      // 连接状态变化
      pc.onconnectionstatechange = () => {
        console.log('连接状态:', pc.connectionState);
        const isConnected = pc.connectionState === 'connected';
        updateState({ 
          isConnected,
          isConnecting: !isConnected && pc.connectionState !== 'failed'
        });

        if (pc.connectionState === 'failed') {
          updateState({ error: '连接失败', isConnecting: false });
        }
      };

      // 如果是发送方，创建数据通道
      if (role === 'sender') {
        const dataChannel = pc.createDataChannel('fileTransfer', {
          ordered: true
        });
        dcRef.current = dataChannel;

        dataChannel.onopen = () => {
          console.log('数据通道已打开 (发送方)');
          updateState({ localDataChannel: dataChannel });
        };

        // 创建offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: 'offer', offer }));
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
      updateState({ 
        error: error instanceof Error ? error.message : '连接失败',
        isConnecting: false 
      });
    }
  }, [updateState]);

  const disconnect = useCallback(() => {
    console.log('断开WebRTC连接');

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
  }, []);

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
