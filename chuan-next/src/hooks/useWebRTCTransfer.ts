import { useCallback } from 'react';
import { useFileTransferBusiness } from './webrtc/useFileTransferBusiness';
import { useTextTransferBusiness } from './webrtc/useTextTransferBusiness';

// 文件信息接口（与现有组件兼容）
interface FileInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'ready' | 'downloading' | 'completed';
  progress: number;
}

/**
 * 统一的 WebRTC 传输 Hook - 新架构版本
 * 整合文件传输、文字传输等多种业务功能
 * 
 * 设计原则：
 * 1. 独立连接：每个业务功能有自己独立的 WebRTC 连接
 * 2. 复用逻辑：所有业务功能复用相同的连接建立逻辑（useWebRTCCore）
 * 3. 简单精准：避免过度抽象，每个功能模块职责清晰
 * 4. 易于扩展：可以轻松添加新的业务功能（如屏幕共享、语音传输等）
 * 5. 向后兼容：与现有的 WebRTCFileTransfer 组件保持接口兼容
 */
export function useWebRTCTransfer() {
  const fileTransfer = useFileTransferBusiness();
  const textTransfer = useTextTransferBusiness();

  // 文件传输连接
  const connectFileTransfer = useCallback((roomCode: string, role: 'sender' | 'receiver') => {
    console.log('连接文件传输通道...');
    return fileTransfer.connect(roomCode, role);
  }, [fileTransfer.connect]);

  // 文字传输连接
  const connectTextTransfer = useCallback((roomCode: string, role: 'sender' | 'receiver') => {
    console.log('连接文字传输通道...');
    return textTransfer.connect(roomCode, role);
  }, [textTransfer.connect]);

  // 统一连接方法 - 同时连接所有功能
  const connectAll = useCallback(async (roomCode: string, role: 'sender' | 'receiver') => {
    console.log('=== 启动 WebRTC 多功能传输 ===');
    console.log('房间代码:', roomCode, '角色:', role);
    console.log('将建立独立的文件传输和文字传输连接');

    // 并行连接所有功能（各自独立的连接）
    await Promise.all([
      connectFileTransfer(roomCode, role),
      connectTextTransfer(roomCode, role),
    ]);

    console.log('所有传输通道连接完成');
  }, [connectFileTransfer, connectTextTransfer]);

  // 统一断开连接
  const disconnectAll = useCallback(() => {
    console.log('断开所有 WebRTC 传输连接');
    fileTransfer.disconnect();
    textTransfer.disconnect();
  }, [fileTransfer.disconnect, textTransfer.disconnect]);
  
  // 为了与现有组件兼容，提供旧的接口形式
  return {
    // ===== 与现有组件兼容的接口 =====
    
    // 连接状态
    isConnected: fileTransfer.isConnected,
    isConnecting: fileTransfer.isConnecting,
    isWebSocketConnected: fileTransfer.isWebSocketConnected,
    error: fileTransfer.connectionError || fileTransfer.error,

    // 传输状态
    isTransferring: fileTransfer.isTransferring,
    transferProgress: fileTransfer.progress,
    receivedFiles: fileTransfer.receivedFiles,

    // 主要方法
    connect: fileTransfer.connect,
    disconnect: fileTransfer.disconnect,
    sendFile: fileTransfer.sendFile,
    requestFile: fileTransfer.requestFile,
    sendFileList: fileTransfer.sendFileList,

    // 回调方法
    onFileRequested: fileTransfer.onFileRequested,
    onFileReceived: fileTransfer.onFileReceived,
    onFileProgress: fileTransfer.onFileProgress,
    onFileListReceived: fileTransfer.onFileListReceived,

    // ===== 新的命名空间接口（供Demo等组件使用） =====
    
    // 统一操作
    connectAll,
    disconnectAll,
    
    // 文件传输功能命名空间
    file: {
      // 连接状态
      isConnected: fileTransfer.isConnected,
      isConnecting: fileTransfer.isConnecting,
      isWebSocketConnected: fileTransfer.isWebSocketConnected,
      connectionError: fileTransfer.connectionError,

      // 传输状态
      isTransferring: fileTransfer.isTransferring,
      progress: fileTransfer.progress,
      error: fileTransfer.error,
      receivedFiles: fileTransfer.receivedFiles,

      // 方法
      connect: fileTransfer.connect,
      disconnect: fileTransfer.disconnect,
      sendFile: fileTransfer.sendFile,
      sendFileList: fileTransfer.sendFileList,
      requestFile: fileTransfer.requestFile,
      onFileReceived: fileTransfer.onFileReceived,
      onFileRequested: fileTransfer.onFileRequested,
      onFileProgress: fileTransfer.onFileProgress,
      onFileListReceived: fileTransfer.onFileListReceived,
    },

    // 文字传输功能命名空间
    text: {
      // 连接状态
      isConnected: textTransfer.isConnected,
      isConnecting: textTransfer.isConnecting,
      isWebSocketConnected: textTransfer.isWebSocketConnected,
      connectionError: textTransfer.connectionError,

      // 传输状态
      messages: textTransfer.messages,
      isTyping: textTransfer.isTyping,
      error: textTransfer.error,

      // 方法
      connect: textTransfer.connect,
      disconnect: textTransfer.disconnect,
      sendMessage: textTransfer.sendMessage,
      sendTypingStatus: textTransfer.sendTypingStatus,
      clearMessages: textTransfer.clearMessages,
      onMessageReceived: textTransfer.onMessageReceived,
      onTypingStatus: textTransfer.onTypingStatus,
    },

    // 整体状态（用于 UI 显示）
    hasAnyConnection: fileTransfer.isConnected || textTransfer.isConnected,
    isAnyConnecting: fileTransfer.isConnecting || textTransfer.isConnecting,
    hasAnyError: Boolean(fileTransfer.connectionError || textTransfer.connectionError),

    // 可以继续添加其他业务功能
    // 例如：
    // screen: { ... }, // 屏幕共享
    // voice: { ... },  // 语音传输
    // video: { ... },  // 视频传输
  };
}