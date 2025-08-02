"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { UseWebSocketReturn, WebSocketMessage } from '@/types';
import { getWebSocketUrl } from '@/lib/api-utils';

export function useWebSocket(): UseWebSocketReturn {
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentCodeRef = useRef<string>('');
  const currentRoleRef = useRef<'sender' | 'receiver'>('sender');

  const connect = useCallback((code: string, role: 'sender' | 'receiver') => {
    // 防止重复连接 - 更严格的检查
    if (websocket && 
        (websocket.readyState === WebSocket.OPEN || websocket.readyState === WebSocket.CONNECTING) && 
        currentCodeRef.current === code && 
        currentRoleRef.current === role) {
      console.log('WebSocket已连接或正在连接，跳过重复连接', {
        readyState: websocket.readyState,
        currentCode: currentCodeRef.current,
        newCode: code,
        currentRole: currentRoleRef.current,
        newRole: role
      });
      return;
    }

    // 如果有现有连接，先关闭
    if (websocket) {
      console.log('关闭现有WebSocket连接');
      websocket.close();
    }

    currentCodeRef.current = code;
    currentRoleRef.current = role;

    // 连接到Go后端的WebSocket - 使用配置文件中的URL
    const baseWsUrl = getWebSocketUrl();
    const wsUrl = `${baseWsUrl}?code=${code}&role=${role}`;
    
    console.log('连接WebSocket:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket连接已建立');
      setIsConnected(true);
      setWebsocket(ws);
      
      // 发送连接建立确认事件
      const connectEvent = new CustomEvent('websocket-connected', {
        detail: { code, role }
      });
      window.dispatchEvent(connectEvent);
      
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
      
      // 发送连接关闭事件
      const closeEvent = new CustomEvent('websocket-close', {
        detail: { code: event.code, reason: event.reason }
      });
      window.dispatchEvent(closeEvent);
      
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
      console.error('WebSocket状态:', ws.readyState);
      console.error('WebSocket URL:', wsUrl);
      setIsConnected(false);
      
      // 发送连接错误事件
      const errorEvent = new CustomEvent('websocket-error', {
        detail: { error, url: wsUrl, readyState: ws.readyState }
      });
      window.dispatchEvent(errorEvent);
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
