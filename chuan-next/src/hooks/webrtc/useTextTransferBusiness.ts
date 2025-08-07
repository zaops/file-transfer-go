import { useState, useCallback, useRef, useEffect } from 'react';
import { useWebRTCCore } from './useWebRTCCore';

// 文字传输状态
interface TextTransferState {
  messages: Array<{
    id: string;
    text: string;
    timestamp: Date;
    sender: 'self' | 'peer';
  }>;
  isTyping: boolean;
  error: string | null;
}

// 消息类型
interface TextMessage {
  id: string;
  text: string;
  timestamp: string;
}

// 回调类型
type MessageReceivedCallback = (message: TextMessage) => void;
type TypingStatusCallback = (isTyping: boolean) => void;
type RealTimeTextCallback = (text: string) => void;

/**
 * 文字传输业务层
 * 使用 WebRTC 核心连接逻辑实现实时文字传输功能
 * 每个实例有独立的连接，但复用相同的连接建立逻辑
 */
export function useTextTransferBusiness() {
  const webrtcCore = useWebRTCCore('text-transfer');

  const [state, setState] = useState<TextTransferState>({
    messages: [],
    isTyping: false,
    error: null,
  });

  // 回调存储
  const messageCallbacks = useRef<Set<MessageReceivedCallback>>(new Set());
  const typingCallbacks = useRef<Set<TypingStatusCallback>>(new Set());
  const realTimeTextCallbacks = useRef<Set<RealTimeTextCallback>>(new Set());

  // 打字状态防抖
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateState = useCallback((updates: Partial<TextTransferState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // 处理文字传输消息
  const handleMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'text-message':
        const textMessage: TextMessage = message.payload;
        console.log('收到文字消息:', textMessage.text);
        
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, {
            id: textMessage.id,
            text: textMessage.text,
            timestamp: new Date(textMessage.timestamp),
            sender: 'peer'
          }]
        }));

        // 触发回调
        messageCallbacks.current.forEach(cb => cb(textMessage));
        break;

      case 'typing-status':
        const { isTyping } = message.payload;
        updateState({ isTyping });
        typingCallbacks.current.forEach(cb => cb(isTyping));
        break;

      case 'real-time-text':
        const { text } = message.payload;
        console.log('收到实时文本:', text);
        realTimeTextCallbacks.current.forEach(cb => cb(text));
        break;

      case 'text-clear':
        console.log('收到清空消息指令');
        updateState({ messages: [] });
        break;
    }
  }, [updateState]);

  // 设置处理器
  useEffect(() => {
    webrtcCore.setMessageHandler(handleMessage);
    // 文字传输不需要数据处理器

    return () => {
      webrtcCore.setMessageHandler(null);
    };
  }, [webrtcCore.setMessageHandler, handleMessage]);

  // 连接
  const connect = useCallback((roomCode: string, role: 'sender' | 'receiver') => {
    return webrtcCore.connect(roomCode, role);
  }, [webrtcCore.connect]);

  // 发送文字消息
  const sendMessage = useCallback((text: string) => {
    if (webrtcCore.getChannelState() !== 'open') {
      updateState({ error: '连接未就绪' });
      return;
    }

    const message: TextMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text,
      timestamp: new Date().toISOString(),
    };

    console.log('发送文字消息:', text);

    // 发送到对方
    const success = webrtcCore.sendMessage({
      type: 'text-message',
      payload: message
    });

    if (success) {
      // 添加到本地消息列表
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, {
          id: message.id,
          text: message.text,
          timestamp: new Date(message.timestamp),
          sender: 'self'
        }],
        error: null
      }));
    } else {
      updateState({ error: '发送消息失败' });
    }
  }, [webrtcCore.getChannelState, webrtcCore.sendMessage, updateState]);

  // 发送打字状态
  const sendTypingStatus = useCallback((isTyping: boolean) => {
    if (webrtcCore.getChannelState() !== 'open') return;

    webrtcCore.sendMessage({
      type: 'typing-status',
      payload: { isTyping }
    });

    // 如果开始打字，设置自动停止
    if (isTyping) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingStatus(false);
      }, 3000); // 3秒后自动停止打字状态
    } else {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  }, [webrtcCore.getChannelState, webrtcCore.sendMessage]);

  // 发送实时文本
  const sendRealTimeText = useCallback((text: string) => {
    if (webrtcCore.getChannelState() !== 'open') return;
    
    webrtcCore.sendMessage({
      type: 'real-time-text',
      payload: { text }
    });
  }, [webrtcCore.getChannelState, webrtcCore.sendMessage]);

  // 注册实时文本回调
  const onRealTimeText = useCallback((callback: RealTimeTextCallback) => {
    realTimeTextCallbacks.current.add(callback);
    return () => { realTimeTextCallbacks.current.delete(callback); };
  }, []);

  // 清空消息
  const clearMessages = useCallback(() => {
    updateState({ messages: [] });
    
    // 通知对方也清空
    if (webrtcCore.getChannelState() === 'open') {
      webrtcCore.sendMessage({
        type: 'text-clear',
        payload: {}
      });
    }
  }, [webrtcCore.getChannelState, webrtcCore.sendMessage, updateState]);

  // 注册消息接收回调
  const onMessageReceived = useCallback((callback: MessageReceivedCallback) => {
    messageCallbacks.current.add(callback);
    return () => { messageCallbacks.current.delete(callback); };
  }, []);

  // 注册打字状态回调
  const onTypingStatus = useCallback((callback: TypingStatusCallback) => {
    typingCallbacks.current.add(callback);
    return () => { typingCallbacks.current.delete(callback); };
  }, []);

  return {
    // 继承基础连接状态
    isConnected: webrtcCore.isConnected,
    isConnecting: webrtcCore.isConnecting,
    isWebSocketConnected: webrtcCore.isWebSocketConnected,
    connectionError: webrtcCore.error,

    // 文字传输状态
    ...state,

    // 操作方法
    connect,
    disconnect: webrtcCore.disconnect,
    sendMessage,
    sendTypingStatus,
    sendRealTimeText,
    clearMessages,

    // 回调注册
    onMessageReceived,
    onTypingStatus,
    onRealTimeText,
  };
}
