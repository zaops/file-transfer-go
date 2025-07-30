"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { UseWebSocketReturn, WebSocketMessage } from '@/types';

export function useWebSocket(): UseWebSocketReturn {
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentCodeRef = useRef<string>('');
  const currentRoleRef = useRef<'sender' | 'receiver'>('sender');

  const connect = useCallback((code: string, role: 'sender' | 'receiver') => {
    // 防止重复连接
    if (websocket && websocket.readyState === WebSocket.OPEN && currentCodeRef.current === code) {
      console.log('WebSocket已连接，跳过重复连接');
      return;
    }

    if (websocket) {
      websocket.close();
    }

    currentCodeRef.current = code;
    currentRoleRef.current = role;

    // 连接到Go后端的WebSocket
    const wsUrl = process.env.NODE_ENV === 'production' 
      ? `wss://${window.location.host}/ws/p2p?code=${code}&role=${role}`
      : `ws://localhost:8080/ws/p2p?code=${code}&role=${role}`;
    
    console.log('连接WebSocket:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket连接已建立');
      setIsConnected(true);
      setWebsocket(ws);
      
      // 发送初始连接信息
      const message = {
        type: 'connect',
        payload: {
          code: code,
          role: role,
          timestamp: Date.now()
        }
      };
      ws.send(JSON.stringify(message));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('收到WebSocket消息:', message);
        
        // 分发事件
        const customEvent = new CustomEvent('websocket-message', {
          detail: message
        });
        window.dispatchEvent(customEvent);
      } catch (error) {
        console.error('解析WebSocket消息失败:', error);
      }
    };

    ws.onclose = (event) => {
      console.log('WebSocket连接关闭:', event.code, event.reason);
      setIsConnected(false);
      setWebsocket(null);
      
      // 如果不是正常关闭且有房间码，尝试重连
      if (event.code !== 1000 && currentCodeRef.current) {
        console.log('尝试重新连接...');
        reconnectTimeoutRef.current = setTimeout(() => {
          connect(currentCodeRef.current, currentRoleRef.current);
        }, 3000);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket错误:', error);
    };
  }, [websocket]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    currentCodeRef.current = '';
    
    if (websocket) {
      websocket.close(1000, 'User disconnected');
    }
  }, [websocket]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket未连接，无法发送消息');
    }
  }, [websocket]);

  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (websocket) {
        websocket.close();
      }
    };
  }, [websocket]);

  return {
    websocket,
    isConnected,
    connect,
    disconnect,
    sendMessage
  };
}
