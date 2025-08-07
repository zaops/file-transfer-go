"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useWebRTCTransfer } from '@/hooks/useWebRTCTransfer';
import TextTransfer from './TextTransfer';

export default function TextTransferWrapper() {
  const webrtc = useWebRTCTransfer();
  const [currentRole, setCurrentRole] = useState<'sender' | 'receiver' | undefined>();
  const [pickupCode, setPickupCode] = useState<string>();

  // 创建房间并建立连接
  const handleCreateWebSocket = useCallback(async (code: string, role: 'sender' | 'receiver') => {
    console.log('=== TextTransferWrapper: 开始建立WebRTC连接 ===');
    console.log('房间码:', code, '角色:', role);
    
    setCurrentRole(role);
    setPickupCode(code);

    try {
      // 建立WebRTC连接
      await webrtc.text.connect(code, role);
      console.log('WebRTC连接请求已发送');
    } catch (error) {
      console.error('建立WebRTC连接失败:', error);
    }
  }, [webrtc.text.connect]);

  // 处理文字消息接收
  useEffect(() => {
    if (!webrtc.text.onMessageReceived) {
      return;
    }

    const unsubscribeMessage = webrtc.text.onMessageReceived((message) => {
      console.log('收到文字消息:', message);
      
      // 检查是否是图片消息
      if (message.text && message.text.startsWith('[IMAGE]')) {
        const imageData = message.text.substring(7); // 移除 '[IMAGE]' 前缀
        window.dispatchEvent(new CustomEvent('websocket-message', {
          detail: {
            type: 'image-send',
            payload: { imageData }
          }
        }));
      } else {
        // 普通文字消息
        window.dispatchEvent(new CustomEvent('websocket-message', {
          detail: {
            type: 'text-content',
            payload: { text: message.text }
          }
        }));
      }
    });

    return unsubscribeMessage;
  }, [webrtc.text.onMessageReceived]);

  // 处理实时文本更新接收
  useEffect(() => {
    if (!webrtc.text.onRealTimeText) {
      return;
    }

    const unsubscribeRealTime = webrtc.text.onRealTimeText((text: string) => {
      console.log('收到实时文本更新:', text);
      window.dispatchEvent(new CustomEvent('websocket-message', {
        detail: {
          type: 'text-update',
          payload: { text }
        }
      }));
    });

    return unsubscribeRealTime;
  }, [webrtc.text.onRealTimeText]);

  // 监听连接状态变化并发送事件
  useEffect(() => {
    console.log('WebRTC文字传输状态:', {
      isConnected: webrtc.text.isConnected,
      isConnecting: webrtc.text.isConnecting,
      isWebSocketConnected: webrtc.text.isWebSocketConnected,
      error: webrtc.text.connectionError
    });

    // WebSocket信令连接成功时发送事件
    if (webrtc.text.isWebSocketConnected) {
      console.log('WebSocket信令连接成功，通知TextTransfer组件');
      window.dispatchEvent(new CustomEvent('websocket-message', {
        detail: { 
          type: 'websocket-signaling-connected',
          payload: { code: pickupCode, role: currentRole }
        }
      }));
    }

    // WebRTC数据通道连接中
    if (webrtc.text.isConnecting) {
      console.log('WebRTC数据通道连接中，通知TextTransfer组件');
      window.dispatchEvent(new CustomEvent('websocket-message', {
        detail: { 
          type: 'webrtc-connecting',
          payload: { code: pickupCode, role: currentRole }
        }
      }));
    }

    // WebRTC数据通道连接成功
    if (webrtc.text.isConnected) {
      console.log('WebRTC数据通道连接成功，通知TextTransfer组件');
      window.dispatchEvent(new CustomEvent('websocket-message', {
        detail: { 
          type: 'webrtc-connected',
          payload: { code: pickupCode, role: currentRole }
        }
      }));
    }

    if (webrtc.text.connectionError) {
      console.error('WebRTC连接错误:', webrtc.text.connectionError);
      window.dispatchEvent(new CustomEvent('websocket-message', {
        detail: {
          type: 'webrtc-error',
          payload: { message: webrtc.text.connectionError }
        }
      }));
    }
  }, [webrtc.text.isConnected, webrtc.text.isConnecting, webrtc.text.isWebSocketConnected, webrtc.text.connectionError, pickupCode, currentRole]);

  // 模拟WebSocket对象来保持与TextTransfer的兼容性
  const mockWebSocket = {
    send: (data: string) => {
      // 数据必须通过WebRTC数据通道发送，不能通过WebSocket
      if (!webrtc.text.isConnected) {
        console.warn('WebRTC数据通道未建立，无法发送数据。当前状态:', {
          isWebSocketConnected: webrtc.text.isWebSocketConnected,
          isConnected: webrtc.text.isConnected
        });
        return;
      }

      try {
        const message = JSON.parse(data);
        console.log('通过WebRTC数据通道发送消息:', message.type);
        
        switch (message.type) {
          case 'text-update':
            // 通过WebRTC数据通道发送实时文本更新
            if (webrtc.text.sendRealTimeText) {
              webrtc.text.sendRealTimeText(message.payload.text);
            }
            break;
            
          case 'text-send':
            // 通过WebRTC数据通道发送完整文字消息
            webrtc.text.sendMessage(message.payload.text);
            break;
            
          case 'image-send':
            // 通过WebRTC数据通道发送图片数据
            const imageMessage = `[IMAGE]${message.payload.imageData}`;
            webrtc.text.sendMessage(imageMessage);
            break;
            
          default:
            console.log('未处理的消息类型:', message.type);
        }
      } catch (error) {
        console.error('通过WebRTC发送消息失败:', error);
      }
    },
    
    readyState: webrtc.text.isConnected ? 1 : 0, // WebSocket.OPEN = 1，但实际是WebRTC状态
    close: () => {
      webrtc.text.disconnect();
    }
  };

  return (
    <TextTransfer
      websocket={mockWebSocket as any}
      isConnected={webrtc.text.isConnected} // WebRTC连接状态
      isWebSocketConnected={webrtc.text.isWebSocketConnected} // WebSocket信令状态
      currentRole={currentRole}
      pickupCode={pickupCode}
      onCreateWebSocket={handleCreateWebSocket}
    />
  );
}
