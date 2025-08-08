import { useState, useCallback, useRef, useEffect } from 'react';
import type { WebRTCConnection } from './useSharedWebRTCManager';

// 文件传输状态
interface FileTransferState {
  isTransferring: boolean;
  progress: number;
  error: string | null;
  receivedFiles: Array<{ id: string; file: File }>;
}

// 文件信息
interface FileInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'ready' | 'downloading' | 'completed';
  progress: number;
}

// 文件元数据
interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
}

// 文件块信息
interface FileChunk {
  fileId: string;
  chunkIndex: number;
  totalChunks: number;
}

// 回调类型
type FileReceivedCallback = (fileData: { id: string; file: File }) => void;
type FileRequestedCallback = (fileId: string, fileName: string) => void;
type FileProgressCallback = (progressInfo: { fileId: string; fileName: string; progress: number }) => void;
type FileListReceivedCallback = (fileList: FileInfo[]) => void;

const CHANNEL_NAME = 'file-transfer';
const CHUNK_SIZE = 256 * 1024; // 256KB

/**
 * 文件传输业务层
 * 必须传入共享的 WebRTC 连接
 */
export function useFileTransferBusiness(connection: WebRTCConnection) {

  const [state, setState] = useState<FileTransferState>({
    isTransferring: false,
    progress: 0,
    error: null,
    receivedFiles: [],
  });

  // 接收文件缓存
  const receivingFiles = useRef<Map<string, {
    metadata: FileMetadata;
    chunks: ArrayBuffer[];
    receivedChunks: number;
  }>>(new Map());

  // 当前期望的文件块
  const expectedChunk = useRef<FileChunk | null>(null);

  // 回调存储
  const fileReceivedCallbacks = useRef<Set<FileReceivedCallback>>(new Set());
  const fileRequestedCallbacks = useRef<Set<FileRequestedCallback>>(new Set());
  const fileProgressCallbacks = useRef<Set<FileProgressCallback>>(new Set());
  const fileListCallbacks = useRef<Set<FileListReceivedCallback>>(new Set());

  const updateState = useCallback((updates: Partial<FileTransferState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // 消息处理器
  const handleMessage = useCallback((message: any) => {
    if (!message.type.startsWith('file-')) return;
    
    console.log('文件传输收到消息:', message.type, message);    switch (message.type) {
      case 'file-metadata':
        const metadata: FileMetadata = message.payload;
        console.log('开始接收文件:', metadata.name);
        
        receivingFiles.current.set(metadata.id, {
          metadata,
          chunks: [],
          receivedChunks: 0,
        });
        
        updateState({ isTransferring: true, progress: 0 });
        break;

      case 'file-chunk-info':
        expectedChunk.current = message.payload;
        console.log('准备接收文件块:', message.payload);
        break;

      case 'file-complete':
        const { fileId } = message.payload;
        const fileInfo = receivingFiles.current.get(fileId);
        
        if (fileInfo) {
          // 组装文件
          const blob = new Blob(fileInfo.chunks, { type: fileInfo.metadata.type });
          const file = new File([blob], fileInfo.metadata.name, { 
            type: fileInfo.metadata.type 
          });
          
          console.log('文件接收完成:', file.name);
          
          setState(prev => ({
            ...prev,
            receivedFiles: [...prev.receivedFiles, { id: fileId, file }],
            isTransferring: false,
            progress: 100
          }));

          fileReceivedCallbacks.current.forEach(cb => cb({ id: fileId, file }));
          receivingFiles.current.delete(fileId);
        }
        break;

      case 'file-list':
        console.log('收到文件列表:', message.payload);
        fileListCallbacks.current.forEach(cb => cb(message.payload));
        break;

      case 'file-request':
        const { fileId: requestedFileId, fileName } = message.payload;
        console.log('收到文件请求:', fileName, requestedFileId);
        fileRequestedCallbacks.current.forEach(cb => cb(requestedFileId, fileName));
        break;
    }
  }, [updateState]);

  // 处理文件块数据
  const handleData = useCallback((data: ArrayBuffer) => {
    if (!expectedChunk.current) {
      console.warn('收到数据但没有对应的块信息');
      return;
    }

    const { fileId, chunkIndex, totalChunks } = expectedChunk.current;
    const fileInfo = receivingFiles.current.get(fileId);
    
    if (fileInfo) {
      fileInfo.chunks[chunkIndex] = data;
      fileInfo.receivedChunks++;

      const progress = (fileInfo.receivedChunks / totalChunks) * 100;
      updateState({ progress });
      
      fileProgressCallbacks.current.forEach(cb => cb({
        fileId: fileId,
        fileName: fileInfo.metadata.name,
        progress
      }));

      console.log(`文件 ${fileInfo.metadata.name} 接收进度: ${progress.toFixed(1)}%`);
      expectedChunk.current = null;
    }
  }, [updateState]);

  // 设置处理器
  useEffect(() => {
    // 使用共享连接的注册方式
    const unregisterMessage = connection.registerMessageHandler(CHANNEL_NAME, handleMessage);
    const unregisterData = connection.registerDataHandler(CHANNEL_NAME, handleData);

    return () => {
      unregisterMessage();
      unregisterData();
    };
  }, [handleMessage, handleData]);

  // 连接
  const connect = useCallback((roomCode: string, role: 'sender' | 'receiver') => {
    return connection.connect(roomCode, role);
  }, [connection]);

  // 发送文件
  const sendFile = useCallback(async (file: File, fileId?: string) => {
    if (connection.getChannelState() !== 'open') {
      updateState({ error: '连接未就绪' });
      return;
    }

    const actualFileId = fileId || `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    console.log('开始发送文件:', file.name, '文件ID:', actualFileId, '总块数:', totalChunks);

    updateState({ isTransferring: true, progress: 0, error: null });

    try {
      // 1. 发送文件元数据
      connection.sendMessage({
        type: 'file-metadata',
        payload: {
          id: actualFileId,
          name: file.name,
          size: file.size,
          type: file.type
        }
      }, CHANNEL_NAME);

      // 2. 分块发送文件
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        // 先发送块信息
        connection.sendMessage({
          type: 'file-chunk-info',
          payload: {
            fileId: actualFileId,
            chunkIndex,
            totalChunks
          }
        }, CHANNEL_NAME);

        // 再发送块数据
        const arrayBuffer = await chunk.arrayBuffer();
        connection.sendData(arrayBuffer);

        const progress = ((chunkIndex + 1) / totalChunks) * 100;
        updateState({ progress });
        
        fileProgressCallbacks.current.forEach(cb => cb({
          fileId: actualFileId,
          fileName: file.name,
          progress
        }));

        // 简单的流控：等待一小段时间让接收方处理
        if (chunkIndex % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      // 3. 发送完成信号
      connection.sendMessage({
        type: 'file-complete',
        payload: { fileId: actualFileId }
      }, CHANNEL_NAME);

      updateState({ isTransferring: false, progress: 100 });
      console.log('文件发送完成:', file.name);

    } catch (error) {
      console.error('发送文件失败:', error);
      updateState({ 
        error: error instanceof Error ? error.message : '发送失败',
        isTransferring: false 
      });
    }
  }, [connection, updateState]);

  // 发送文件列表
  const sendFileList = useCallback((fileList: FileInfo[]) => {
    if (connection.getChannelState() !== 'open') {
      console.error('数据通道未准备就绪，无法发送文件列表');
      return;
    }

    console.log('发送文件列表:', fileList);
    
    connection.sendMessage({
      type: 'file-list',
      payload: fileList
    }, CHANNEL_NAME);
  }, [connection]);

  // 请求文件
  const requestFile = useCallback((fileId: string, fileName: string) => {
    if (connection.getChannelState() !== 'open') {
      console.error('数据通道未准备就绪，无法请求文件');
      return;
    }

    console.log('请求文件:', fileName, fileId);
    
    connection.sendMessage({
      type: 'file-request',
      payload: { fileId, fileName }
    }, CHANNEL_NAME);
  }, [connection]);

  // 注册回调函数
  const onFileReceived = useCallback((callback: FileReceivedCallback) => {
    fileReceivedCallbacks.current.add(callback);
    return () => { fileReceivedCallbacks.current.delete(callback); };
  }, []);

  const onFileRequested = useCallback((callback: FileRequestedCallback) => {
    fileRequestedCallbacks.current.add(callback);
    return () => { fileRequestedCallbacks.current.delete(callback); };
  }, []);

  const onFileProgress = useCallback((callback: FileProgressCallback) => {
    fileProgressCallbacks.current.add(callback);
    return () => { fileProgressCallbacks.current.delete(callback); };
  }, []);

  const onFileListReceived = useCallback((callback: FileListReceivedCallback) => {
    fileListCallbacks.current.add(callback);
    return () => { fileListCallbacks.current.delete(callback); };
  }, []);

  return {
    // 继承基础连接状态
    isConnected: connection.isConnected,
    isConnecting: connection.isConnecting,
    isWebSocketConnected: connection.isWebSocketConnected,
    connectionError: connection.error,

    // 文件传输状态
    ...state,

    // 操作方法
    connect,
    disconnect: connection.disconnect,
    sendFile,
    sendFileList,
    requestFile,

    // 回调注册
    onFileReceived,
    onFileRequested,
    onFileProgress,
    onFileListReceived,
  };
}
