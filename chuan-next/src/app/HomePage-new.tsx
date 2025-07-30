"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import FileUpload from '@/components/FileUpload';
import { FileReceive } from '@/components/FileReceive';
import { useWebSocket } from '@/hooks/useWebSocket';
import { FileInfo, TransferProgress, WebSocketMessage, RoomStatus } from '@/types';
import { Upload, Download } from 'lucide-react';

interface FileTransferData {
  fileId: string;
  chunks: Array<{ offset: number; data: Uint8Array }>;
  totalSize: number;
  receivedSize: number;
  fileName: string;
  mimeType: string;
  startTime: number;
}

export default function HomePage() {
  const searchParams = useSearchParams();
  const { websocket, isConnected, connect, disconnect, sendMessage } = useWebSocket();
  
  // 发送方状态
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [pickupCode, setPickupCode] = useState<string>('');
  const [pickupLink, setPickupLink] = useState<string>('');
  const [currentRole, setCurrentRole] = useState<'sender' | 'receiver'>('sender');
  
  // 接收方状态
  const [receiverFiles, setReceiverFiles] = useState<FileInfo[]>([]);
  const [transferProgresses, setTransferProgresses] = useState<TransferProgress[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // 房间状态
  const [roomStatus, setRoomStatus] = useState<RoomStatus | null>(null);
  
  // 文件传输状态
  const [fileTransfers, setFileTransfers] = useState<Map<string, FileTransferData>>(new Map());

  // 显示通知
  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    console.log(`[${type.toUpperCase()}] ${message}`);
  }, []);

  // 初始化文件传输
  const initFileTransfer = useCallback((fileInfo: any) => {
    console.log('初始化文件传输:', fileInfo);
    const transferKey = fileInfo.file_id;
    
    setFileTransfers(prev => {
      const newMap = new Map(prev);
      newMap.set(transferKey, {
        fileId: fileInfo.file_id,
        chunks: [],
        totalSize: fileInfo.size,
        receivedSize: 0,
        fileName: fileInfo.name,
        mimeType: fileInfo.mime_type,
        startTime: Date.now()
      });
      console.log('添加文件传输记录:', transferKey);
      return newMap;
    });
    
    setTransferProgresses(prev => {
      const updated = prev.map(p => p.fileId === fileInfo.file_id 
        ? { ...p, status: 'downloading' as const, totalSize: fileInfo.size }
        : p
      );
      console.log('更新传输进度为下载中:', updated);
      return updated;
    });
  }, []);

  // 组装并下载文件
  const assembleAndDownloadFile = useCallback((transferKey: string, transfer: FileTransferData) => {
    // 按偏移量排序数据块
    transfer.chunks.sort((a, b) => a.offset - b.offset);
    
    // 合并所有数据块
    const totalSize = transfer.chunks.reduce((sum, chunk) => sum + chunk.data.length, 0);
    const mergedData = new Uint8Array(totalSize);
    let currentOffset = 0;
    
    transfer.chunks.forEach((chunk) => {
      mergedData.set(chunk.data, currentOffset);
      currentOffset += chunk.data.length;
    });
    
    // 创建Blob并触发下载
    const blob = new Blob([mergedData], { type: transfer.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = transfer.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // 清理状态
    setFileTransfers(prev => {
      const newMap = new Map(prev);
      newMap.delete(transferKey);
      return newMap;
    });
    
    setTransferProgresses(prev => 
      prev.filter(p => p.fileId !== transferKey)
    );
    
    const transferTime = (Date.now() - transfer.startTime) / 1000;
    const speed = (transfer.totalSize / transferTime / 1024 / 1024).toFixed(2);
    showNotification(`文件 "${transfer.fileName}" 下载完成！传输速度: ${speed} MB/s`);
  }, [showNotification]);

  // 接收文件数据块
  const receiveFileChunk = useCallback((chunkData: any) => {
    console.log('接收文件数据块:', chunkData);
    const transferKey = chunkData.file_id;
    
    setFileTransfers(prev => {
      const newMap = new Map(prev);
      const transfer = newMap.get(transferKey);
      
      if (transfer) {
        const chunkArray = new Uint8Array(chunkData.data);
        transfer.chunks.push({
          offset: chunkData.offset,
          data: chunkArray
        });
        transfer.receivedSize += chunkArray.length;
        
        const progress = (transfer.receivedSize / transfer.totalSize) * 100;
        console.log(`文件 ${transferKey} 进度: ${progress.toFixed(2)}%`);
        
        // 更新进度
        setTransferProgresses(prev => {
          const updated = prev.map(p => p.fileId === transferKey 
            ? { 
                ...p, 
                progress, 
                receivedSize: transfer.receivedSize,
                totalSize: transfer.totalSize 
              }
            : p
          );
          console.log('更新进度状态:', updated);
          return updated;
        });
        
        // 检查是否完成
        if (chunkData.is_last || transfer.receivedSize >= transfer.totalSize) {
          console.log('文件接收完成，开始组装下载');
          assembleAndDownloadFile(transferKey, transfer);
        }
      } else {
        console.warn('未找到对应的文件传输:', transferKey);
      }
      
      return newMap;
    });
  }, [assembleAndDownloadFile]);

  // 完成文件下载
  const completeFileDownload = useCallback((fileId: string) => {
    console.log('文件传输完成:', fileId);
  }, []);

  // 处理文件请求（发送方）
  const handleFileRequest = useCallback(async (payload: any) => {
    const fileId = payload.file_id;
    const requestId = payload.request_id;
    
    const fileIndex = parseInt(fileId.replace('file_', ''));
    const file = selectedFiles[fileIndex];
    
    if (!file) {
      console.error('未找到请求的文件:', fileId);
      return;
    }
    
    console.log('开始发送文件:', file.name);
    showNotification(`开始发送文件: ${file.name}`);
    
    // 发送文件信息
    sendMessage({
      type: 'file-info',
      payload: {
        file_id: requestId,
        name: file.name,
        size: file.size,
        mime_type: file.type,
        last_modified: file.lastModified
      }
    });
    
    // 分块发送文件
    const chunkSize = 65536;
    let offset = 0;
    
    const sendChunk = () => {
      if (offset >= file.size) {
        sendMessage({
          type: 'file-complete',
          payload: { file_id: requestId }
        });
        showNotification(`文件发送完成: ${file.name}`);
        return;
      }
      
      const slice = file.slice(offset, offset + chunkSize);
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const chunk = e.target?.result as ArrayBuffer;
        
        sendMessage({
          type: 'file-chunk',
          payload: {
            file_id: requestId,
            offset: offset,
            data: Array.from(new Uint8Array(chunk)),
            is_last: offset + chunk.byteLength >= file.size
          }
        });
        
        offset += chunk.byteLength;
        setTimeout(sendChunk, 10);
      };
      
      reader.readAsArrayBuffer(slice);
    };
    
    sendChunk();
  }, [selectedFiles, sendMessage, showNotification]);

  // WebSocket消息处理
  useEffect(() => {
    const handleWebSocketMessage = (event: CustomEvent<WebSocketMessage>) => {
      const message = event.detail;
      console.log('HomePage收到WebSocket消息:', message.type, message);
      
      switch (message.type) {
        case 'file-list':
          console.log('处理file-list消息');
          if (currentRole === 'receiver') {
            setReceiverFiles((message.payload.files as FileInfo[]) || []);
            setIsConnecting(false);
          }
          break;
          
        case 'file-list-updated':
          console.log('处理file-list-updated消息');
          if (currentRole === 'receiver') {
            setReceiverFiles((message.payload.files as FileInfo[]) || []);
            showNotification('文件列表已更新，发现新文件！');
          }
          break;
          
        case 'room-status':
          console.log('处理room-status消息');
          setRoomStatus(message.payload as unknown as RoomStatus);
          break;
          
        case 'file-info':
          console.log('处理file-info消息');
          if (currentRole === 'receiver') {
            initFileTransfer(message.payload);
          }
          break;
          
        case 'file-chunk':
          console.log('处理file-chunk消息');
          if (currentRole === 'receiver') {
            receiveFileChunk(message.payload);
          }
          break;
          
        case 'file-complete':
          console.log('处理file-complete消息');
          if (currentRole === 'receiver') {
            completeFileDownload(message.payload.file_id as string);
          }
          break;
          
        case 'file-request':
          console.log('处理file-request消息');
          if (currentRole === 'sender') {
            handleFileRequest(message.payload);
          }
          break;
      }
    };

    window.addEventListener('websocket-message', handleWebSocketMessage as EventListener);
    return () => {
      window.removeEventListener('websocket-message', handleWebSocketMessage as EventListener);
    };
  }, [currentRole, showNotification, initFileTransfer, receiveFileChunk, completeFileDownload, handleFileRequest]);

  // 生成取件码
  const handleGenerateCode = useCallback(async () => {
    if (selectedFiles.length === 0) return;
    
    const fileInfos = selectedFiles.map((file, index) => ({
      id: 'file_' + index,
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    }));
    
    try {
      const response = await fetch('/api/create-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: fileInfos })
      });
      
      const data = await response.json();
      if (data.success) {
        const code = data.code;
        setPickupCode(code);
        setCurrentRole('sender');
        
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/?code=${code}`;
        setPickupLink(link);
        
        connect(code, 'sender');
        showNotification('取件码生成成功！');
      } else {
        showNotification('生成取件码失败: ' + data.message, 'error');
      }
    } catch (error) {
      console.error('生成取件码失败:', error);
      showNotification('生成取件码失败，请重试', 'error');
    }
  }, [selectedFiles, connect, showNotification]);

  // 加入房间
  const handleJoinRoom = useCallback(async (code: string) => {
    setIsConnecting(true);
    
    try {
      const response = await fetch(`/api/room-info?code=${code}`);
      const data = await response.json();
      
      if (data.success) {
        setPickupCode(code);
        setCurrentRole('receiver');
        setReceiverFiles(data.files || []);
        connect(code, 'receiver');
        showNotification('连接成功！');
      } else {
        showNotification(data.message || '取件码无效或已过期', 'error');
        setIsConnecting(false);
      }
    } catch (error) {
      console.error('连接失败:', error);
      showNotification('连接失败，请检查网络连接', 'error');
      setIsConnecting(false);
    }
  }, [connect, showNotification]);

  // 处理URL参数中的取件码
  useEffect(() => {
    const code = searchParams.get('code');
    if (code && code.length === 6) {
      setCurrentRole('receiver');
      handleJoinRoom(code.toUpperCase());
    }
  }, [searchParams, handleJoinRoom]);

  // 下载文件
  const handleDownloadFile = useCallback((fileId: string) => {
    console.log('开始下载文件:', fileId);
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      showNotification('连接未建立，请重试', 'error');
      return;
    }
    
    const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    console.log('生成请求ID:', requestId);
    
    sendMessage({
      type: 'file-request',
      payload: {
        file_id: fileId,
        request_id: requestId
      }
    });
    
    // 更新传输状态
    const newProgress = {
      fileId: requestId, // 传输的唯一标识
      originalFileId: fileId, // 原始文件ID，用于UI匹配
      fileName: receiverFiles.find(f => f.id === fileId)?.name || fileId,
      progress: 0,
      receivedSize: 0,
      totalSize: 0,
      status: 'pending' as const
    };
    
    console.log('添加传输进度:', newProgress);
    setTransferProgresses(prev => [
      ...prev.filter(p => p.originalFileId !== fileId), // 移除该文件的旧进度记录
      newProgress
    ]);
  }, [websocket, sendMessage, receiverFiles, showNotification]);

  // 通过WebSocket更新文件列表
  const updateFileList = useCallback((files: File[]) => {
    if (!pickupCode || !websocket || websocket.readyState !== WebSocket.OPEN) {
      console.log('无法更新文件列表: pickupCode=', pickupCode, 'websocket状态=', websocket?.readyState);
      return;
    }
    
    const fileInfos = files.map((file, index) => ({
      id: 'file_' + index,
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    }));
    
    console.log('通过WebSocket发送文件列表更新:', fileInfos);
    sendMessage({
      type: 'update-file-list',
      payload: {
        files: fileInfos
      }
    });
    
    showNotification('文件列表已更新');
  }, [pickupCode, websocket, sendMessage, showNotification]);

  // 处理文件删除后的同步
  const handleRemoveFile = useCallback((updatedFiles: File[]) => {
    if (pickupCode) {
      updateFileList(updatedFiles);
    }
  }, [pickupCode, updateFileList]);

  // 重置状态
  const handleReset = useCallback(() => {
    setSelectedFiles([]);
    setPickupCode('');
    setPickupLink('');
    setReceiverFiles([]);
    setTransferProgresses([]);
    setRoomStatus(null);
    setFileTransfers(new Map());
    disconnect();
  }, [disconnect]);

  // 复制到剪贴板
  const copyToClipboard = useCallback(async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showNotification(message);
    } catch (error) {
      showNotification('复制失败，请手动复制', 'error');
    }
  }, [showNotification]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">文件快传</h1>
            <p className="text-muted-foreground">
              安全、快速的P2P文件传输服务
            </p>
          </div>

          <Tabs defaultValue="send" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="send" className="flex items-center space-x-2">
                <Upload className="w-4 h-4" />
                <span>发送文件</span>
              </TabsTrigger>
              <TabsTrigger value="receive" className="flex items-center space-x-2">
                <Download className="w-4 h-4" />
                <span>接收文件</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="send" className="mt-6">
              <FileUpload
                selectedFiles={selectedFiles}
                onFilesChange={setSelectedFiles}
                onGenerateCode={handleGenerateCode}
                pickupCode={pickupCode}
                pickupLink={pickupLink}
                onCopyCode={() => copyToClipboard(pickupCode, '取件码已复制到剪贴板！')}
                onCopyLink={() => copyToClipboard(pickupLink, '取件链接已复制到剪贴板！')}
                onAddMoreFiles={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.multiple = true;
                  input.onchange = async (e) => {
                    const files = Array.from((e.target as HTMLInputElement).files || []);
                    const newFiles = [...selectedFiles, ...files];
                    setSelectedFiles(newFiles);
                    
                    // 如果已经生成了取件码，更新后端文件列表
                    if (pickupCode && files.length > 0) {
                      updateFileList(newFiles);
                    }
                  };
                  input.click();
                }}
                onRemoveFile={handleRemoveFile}
                onReset={handleReset}
                disabled={isConnecting}
              />
              
              {roomStatus && currentRole === 'sender' && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>房间状态</CardTitle>
                    <CardDescription>
                      当前在线用户情况
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-primary">
                          {roomStatus.sender_count + roomStatus.receiver_count}
                        </div>
                        <div className="text-sm text-muted-foreground">总在线</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-600">
                          {roomStatus.sender_count}
                        </div>
                        <div className="text-sm text-muted-foreground">发送方</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">
                          {roomStatus.receiver_count}
                        </div>
                        <div className="text-sm text-muted-foreground">接收方</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="receive" className="mt-6">
              <FileReceive
                onJoinRoom={handleJoinRoom}
                files={receiverFiles}
                onDownloadFile={handleDownloadFile}
                transferProgresses={transferProgresses}
                isConnected={isConnected}
                isConnecting={isConnecting}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
