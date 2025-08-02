import { useState, useCallback, useRef } from 'react';

interface FileTransferState {
  isTransferring: boolean;
  transferProgress: number;
  receivedFiles: Array<{ id: string; file: File }>;
  error: string | null;
}

interface FileProgressInfo {
  fileId: string;
  fileName: string;
  progress: number;
}

interface FileChunk {
  fileId: string;
  chunkIndex: number;
  totalChunks: number;
  data: ArrayBuffer;
}

interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
}

const CHUNK_SIZE = 256 * 1024; // 256KB chunks - 平衡传输效率和内存使用

export function useFileTransfer() {
  const [state, setState] = useState<FileTransferState>({
    isTransferring: false,
    transferProgress: 0,
    receivedFiles: [],
    error: null,
  });

  // 存储接收中的文件数据
  const receivingFiles = useRef<Map<string, {
    metadata: FileMetadata;
    chunks: ArrayBuffer[];
    receivedChunks: number;
    totalChunks: number;
  }>>(new Map());

  // 存储当前正在接收的块信息
  const expectedChunk = useRef<{
    fileId: string;
    chunkIndex: number;
    totalChunks: number;
  } | null>(null);

  // 文件请求回调
  const fileRequestCallbacks = useRef<Array<(fileId: string, fileName: string) => void>>([]);
  const fileReceivedCallbacks = useRef<Array<(fileData: { id: string; file: File }) => void>>([]);
  const fileProgressCallbacks = useRef<Array<(progressInfo: FileProgressInfo) => void>>([]);

  const updateState = useCallback((updates: Partial<FileTransferState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // 发送文件
  const sendFile = useCallback(async (file: File, fileId: string, dataChannel: RTCDataChannel) => {
    if (!dataChannel || dataChannel.readyState !== 'open') {
      console.error('数据通道未准备就绪');
      updateState({ error: '数据通道未准备就绪' });
      return;
    }

    console.log('=== 开始发送文件 ===');
    console.log('文件:', file.name, '大小:', file.size, 'ID:', fileId);

    updateState({ isTransferring: true, transferProgress: 0, error: null });

    try {
      // 发送文件元数据
      const metadata: FileMetadata = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type
      };

      const metadataMessage = JSON.stringify({
        type: 'file-start',
        payload: metadata
      });

      console.log('发送文件元数据:', metadataMessage);
      dataChannel.send(metadataMessage);

      // 计算分块数量
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      console.log('总分块数:', totalChunks);

      // 分块发送文件
      let sentChunks = 0;

      const sendNextChunk = () => {
        if (sentChunks >= totalChunks) {
          // 发送结束信号
          const endMessage = JSON.stringify({
            type: 'file-end',
            payload: { id: fileId }
          });
          dataChannel.send(endMessage);
          
          updateState({ isTransferring: false, transferProgress: 100 });
          console.log('文件发送完成:', file.name);
          return;
        }

        const start = sentChunks * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result && dataChannel.readyState === 'open') {
            const arrayBuffer = event.target.result as ArrayBuffer;
            
            // 检查缓冲区状态，避免过度缓冲
            if (dataChannel.bufferedAmount > 1024 * 1024) { // 1MB 缓冲区限制
              console.log('数据通道缓冲区满，等待清空...');
              // 等待缓冲区清空后再发送
              const waitForBuffer = () => {
                if (dataChannel.bufferedAmount < 256 * 1024) { // 等到缓冲区低于 256KB
                  sendChunkData();
                } else {
                  setTimeout(waitForBuffer, 10);
                }
              };
              waitForBuffer();
            } else {
              sendChunkData();
            }

            function sendChunkData() {
              // 发送分块数据
              const chunkMessage = JSON.stringify({
                type: 'file-chunk',
                payload: {
                  fileId,
                  chunkIndex: sentChunks,
                  totalChunks
                }
              });
              
              dataChannel.send(chunkMessage);
              dataChannel.send(arrayBuffer);

              sentChunks++;
              const progress = (sentChunks / totalChunks) * 100;
              updateState({ transferProgress: progress });

              // 通知文件级别的进度
              fileProgressCallbacks.current.forEach(callback => {
                callback({
                  fileId,
                  fileName: file.name,
                  progress
                });
              });

              console.log(`发送进度: ${progress.toFixed(1)}%, 块: ${sentChunks}/${totalChunks}, 文件: ${file.name}, 缓冲区: ${dataChannel.bufferedAmount} bytes`);

              // 立即发送下一个块，不等待
              sendNextChunk();
            }
          }
        };

        reader.onerror = () => {
          console.error('读取文件块失败');
          updateState({ error: '读取文件失败', isTransferring: false });
        };

        reader.readAsArrayBuffer(chunk);
      };

      sendNextChunk();

    } catch (error) {
      console.error('发送文件失败:', error);
      updateState({ 
        error: error instanceof Error ? error.message : '发送文件失败',
        isTransferring: false 
      });
    }
  }, [updateState]);

  // 处理接收到的消息
  const handleMessage = useCallback((event: MessageEvent) => {
    if (typeof event.data === 'string') {
      try {
        const message = JSON.parse(event.data);
        console.log('收到消息:', message.type, message.payload);

        switch (message.type) {
          case 'file-list':
            // 文件列表消息由主hook处理
            console.log('文件列表消息将由主hook处理');
            return;

          case 'file-start':
            const metadata = message.payload as FileMetadata;
            console.log('开始接收文件:', metadata.name, '大小:', metadata.size);
            
            receivingFiles.current.set(metadata.id, {
              metadata,
              chunks: [],
              receivedChunks: 0,
              totalChunks: Math.ceil(metadata.size / CHUNK_SIZE)
            });
            
            updateState({ isTransferring: true, transferProgress: 0 });
            break;

          case 'file-chunk':
            const chunkInfo = message.payload;
            const { fileId: chunkFileId, chunkIndex, totalChunks } = chunkInfo;
            console.log(`接收文件块信息: ${chunkIndex + 1}/${totalChunks}, 文件ID: ${chunkFileId}`);
            
            // 设置期望的下一个块
            expectedChunk.current = {
              fileId: chunkFileId,
              chunkIndex,
              totalChunks
            };
            break;

          case 'file-end':
            const { id: fileId } = message.payload;
            const fileInfo = receivingFiles.current.get(fileId);
            
            if (fileInfo) {
              // 组装文件
              const blob = new Blob(fileInfo.chunks, { type: fileInfo.metadata.type });
              const file = new File([blob], fileInfo.metadata.name, { type: fileInfo.metadata.type });
              
              console.log('文件接收完成:', file.name);
              
              // 添加到接收文件列表
              setState(prev => ({
                ...prev,
                receivedFiles: [...prev.receivedFiles, { id: fileId, file }],
                isTransferring: false,
                transferProgress: 100
              }));

              // 触发回调
              fileReceivedCallbacks.current.forEach(callback => {
                callback({ id: fileId, file });
              });

              // 清理
              receivingFiles.current.delete(fileId);
            }
            break;

          case 'file-request':
            const { fileId: requestedFileId, fileName } = message.payload;
            console.log('收到文件请求:', fileName, 'ID:', requestedFileId);
            
            // 触发文件请求回调
            fileRequestCallbacks.current.forEach(callback => {
              callback(requestedFileId, fileName);
            });
            break;
        }
      } catch (error) {
        console.error('解析消息失败:', error);
      }
    } else if (event.data instanceof ArrayBuffer) {
      // 处理文件块数据
      const arrayBuffer = event.data;
      console.log('收到文件块数据:', arrayBuffer.byteLength, 'bytes');

      // 检查是否有期望的块信息
      if (expectedChunk.current) {
        const { fileId, chunkIndex } = expectedChunk.current;
        const fileInfo = receivingFiles.current.get(fileId);
        
        if (fileInfo) {
          // 确保chunks数组足够大
          if (!fileInfo.chunks[chunkIndex]) {
            fileInfo.chunks[chunkIndex] = arrayBuffer;
            fileInfo.receivedChunks++;

            const progress = (fileInfo.receivedChunks / fileInfo.totalChunks) * 100;
            updateState({ transferProgress: progress });

            // 通知文件级别的进度
            fileProgressCallbacks.current.forEach(callback => {
              callback({
                fileId,
                fileName: fileInfo.metadata.name,
                progress
              });
            });

            console.log(`文件接收进度: ${progress.toFixed(1)}%, 块: ${fileInfo.receivedChunks}/${fileInfo.totalChunks}, 文件: ${fileInfo.metadata.name}`);
          }
          
          // 清除期望的块信息
          expectedChunk.current = null;
        }
      } else {
        console.warn('收到块数据但没有对应的块信息');
      }
    }
  }, [updateState]);

  // 请求文件
  const requestFile = useCallback((fileId: string, fileName: string, dataChannel: RTCDataChannel) => {
    if (!dataChannel || dataChannel.readyState !== 'open') {
      console.error('数据通道未准备就绪');
      return;
    }

    console.log('请求文件:', fileName, 'ID:', fileId);
    
    const requestMessage = JSON.stringify({
      type: 'file-request',
      payload: { fileId, fileName }
    });

    dataChannel.send(requestMessage);
  }, []);

  // 注册文件请求回调
  const onFileRequested = useCallback((callback: (fileId: string, fileName: string) => void) => {
    fileRequestCallbacks.current.push(callback);
    
    // 返回清理函数
    return () => {
      const index = fileRequestCallbacks.current.indexOf(callback);
      if (index > -1) {
        fileRequestCallbacks.current.splice(index, 1);
      }
    };
  }, []);

  // 注册文件接收回调
  const onFileReceived = useCallback((callback: (fileData: { id: string; file: File }) => void) => {
    fileReceivedCallbacks.current.push(callback);
    
    // 返回清理函数
    return () => {
      const index = fileReceivedCallbacks.current.indexOf(callback);
      if (index > -1) {
        fileReceivedCallbacks.current.splice(index, 1);
      }
    };
  }, []);

  // 注册文件进度回调
  const onFileProgress = useCallback((callback: (progressInfo: FileProgressInfo) => void) => {
    fileProgressCallbacks.current.push(callback);
    
    // 返回清理函数
    return () => {
      const index = fileProgressCallbacks.current.indexOf(callback);
      if (index > -1) {
        fileProgressCallbacks.current.splice(index, 1);
      }
    };
  }, []);

  return {
    ...state,
    sendFile,
    requestFile,
    handleMessage,
    onFileRequested,
    onFileReceived,
    onFileProgress,
  };
}
