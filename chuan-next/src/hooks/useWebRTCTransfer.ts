import { useCallback, useEffect, useRef } from 'react';
import { useWebRTCConnection } from './webrtc/useWebRTCConnection';
import { useFileTransfer } from './webrtc/useFileTransfer';

interface FileInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'ready' | 'downloading' | 'completed';
  progress: number;
}

export function useWebRTCTransfer() {
  const connection = useWebRTCConnection();
  const fileTransfer = useFileTransfer();
  
  // 文件列表回调存储
  const fileListCallbacks = useRef<Array<(fileList: FileInfo[]) => void>>([]);

  // 设置数据通道消息处理
  useEffect(() => {
    const dataChannel = connection.localDataChannel || connection.remoteDataChannel;
    if (dataChannel && dataChannel.readyState === 'open') {
      console.log('设置数据通道消息处理器, 通道类型:', connection.localDataChannel ? '本地' : '远程');
      
      // 扩展消息处理以包含文件列表
      const originalHandler = fileTransfer.handleMessage;
      
      dataChannel.onmessage = (event) => {
        console.log('收到数据通道消息:', typeof event.data);
        
        if (typeof event.data === 'string') {
          try {
            const message = JSON.parse(event.data);
            
            if (message.type === 'file-list') {
              console.log('收到文件列表:', message.payload);
              fileListCallbacks.current.forEach(callback => {
                callback(message.payload);
              });
              return;
            }
          } catch (error) {
            console.error('解析文件列表消息失败:', error);
          }
        }
        
        // 处理其他消息类型
        originalHandler(event);
      };
    }
  }, [connection.localDataChannel, connection.remoteDataChannel, fileTransfer.handleMessage]);

  // 发送文件
  const sendFile = useCallback((file: File, fileId?: string) => {
    const dataChannel = connection.getDataChannel();
    if (!dataChannel) {
      console.error('数据通道未准备就绪');
      return;
    }

    const actualFileId = fileId || `file_${Date.now()}`;
    console.log('=== 发送文件 ===');
    console.log('文件:', file.name, 'ID:', actualFileId, '大小:', file.size);
    
    fileTransfer.sendFile(file, actualFileId, dataChannel);
  }, [connection.getDataChannel, fileTransfer.sendFile]);

  // 请求文件
  const requestFile = useCallback((fileId: string, fileName: string) => {
    const dataChannel = connection.getDataChannel();
    if (!dataChannel) {
      console.error('数据通道未准备就绪');
      return;
    }

    console.log('=== 请求文件 ===');
    console.log('文件:', fileName, 'ID:', fileId);
    
    fileTransfer.requestFile(fileId, fileName, dataChannel);
  }, [connection.getDataChannel, fileTransfer.requestFile]);

  // 发送文件列表
  const sendFileList = useCallback((fileList: FileInfo[]) => {
    const dataChannel = connection.getDataChannel();
    if (!dataChannel || dataChannel.readyState !== 'open') {
      console.error('数据通道未准备就绪，无法发送文件列表');
      return;
    }

    console.log('=== 发送文件列表 ===');
    console.log('文件列表:', fileList);
    
    const message = JSON.stringify({
      type: 'file-list',
      payload: fileList
    });

    try {
      dataChannel.send(message);
      console.log('文件列表已发送');
    } catch (error) {
      console.error('发送文件列表失败:', error);
    }
  }, [connection.getDataChannel]);

  // 注册文件列表接收回调
  const onFileListReceived = useCallback((callback: (fileList: FileInfo[]) => void) => {
    console.log('注册文件列表回调');
    fileListCallbacks.current.push(callback);
    
    // 返回清理函数
    return () => {
      const index = fileListCallbacks.current.indexOf(callback);
      if (index > -1) {
        fileListCallbacks.current.splice(index, 1);
      }
    };
  }, []);

  return {
    // 连接状态
    isConnected: connection.isConnected,
    isConnecting: connection.isConnecting,
    isWebSocketConnected: connection.isWebSocketConnected,
    error: connection.error || fileTransfer.error,

    // 传输状态
    isTransferring: fileTransfer.isTransferring,
    transferProgress: fileTransfer.transferProgress,
    receivedFiles: fileTransfer.receivedFiles,

    // 操作方法
    connect: connection.connect,
    disconnect: connection.disconnect,
    sendFile,
    requestFile,
    sendFileList,

    // 回调注册
    onFileRequested: fileTransfer.onFileRequested,
    onFileReceived: fileTransfer.onFileReceived,
    onFileProgress: fileTransfer.onFileProgress,
    onFileListReceived,
  };
}
