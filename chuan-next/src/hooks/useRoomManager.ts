import { useState, useCallback } from 'react';
import { FileInfo, RoomStatus } from '@/types';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useToast } from '@/components/ui/toast-simple';
import { apiPost, apiGet } from '@/lib/api-utils';

export const useRoomManager = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [pickupCode, setPickupCode] = useState<string>('');
  const [pickupLink, setPickupLink] = useState<string>('');
  const [currentRole, setCurrentRole] = useState<'sender' | 'receiver'>('sender');
  const [receiverFiles, setReceiverFiles] = useState<FileInfo[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [roomStatus, setRoomStatus] = useState<RoomStatus | null>(null);
  
  const { websocket, isConnected, connect, disconnect, sendMessage } = useWebSocket();
  const { showToast } = useToast();

  // 生成取件码
  const generateCode = useCallback(async () => {
    if (selectedFiles.length === 0) return;
    
    const fileInfos = selectedFiles.map((file, index) => ({
      id: 'file_' + index,
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    }));
    
    try {
      const response = await apiPost('/api/create-room', { files: fileInfos });
      
      const data = await response.json();
      if (data.success) {
        const code = data.code;
        setPickupCode(code);
        setCurrentRole('sender');
        
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/?type=file&mode=receive&code=${code}`;
        setPickupLink(link);
        
        connect(code, 'sender');
        showToast('取件码生成成功！');
      } else {
        showToast('生成取件码失败: ' + data.message, 'error');
      }
    } catch (error) {
      console.error('生成取件码失败:', error);
      showToast('生成取件码失败，请重试', 'error');
    }
  }, [selectedFiles, connect, showToast]);

  // 加入房间
  const joinRoom = useCallback(async (code: string) => {
    // 防止重复连接
    if (isConnecting || (isConnected && pickupCode === code)) {
      console.log('已在连接中或已连接，跳过重复请求');
      return;
    }
    
    setIsConnecting(true);
    
    try {
      const response = await apiGet(`/api/room-info?code=${code}`);
      const data = await response.json();
      
      if (data.success) {
        setPickupCode(code);
        setCurrentRole('receiver');
        setReceiverFiles(data.files || []);
        // 开始连接WebSocket
        connect(code, 'receiver');
        console.log('房间信息获取成功，开始建立WebSocket连接');
        // 注意：isConnecting状态会在WebSocket连接建立后自动重置
        // 不在这里显示成功消息，等WebSocket连接成功后再显示
      } else {
        showToast(data.message || '取件码不存在或已过期', 'error');
        setIsConnecting(false);
      }
    } catch (error) {
      console.error('API调用失败:', error);
      showToast('取件码不存在或已过期', 'error');
      setIsConnecting(false);
    }
  }, [connect, showToast, isConnecting, isConnected, pickupCode]);

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
    
    showToast('文件列表已更新');
  }, [pickupCode, websocket, sendMessage, showToast]);

  // 处理文件删除后的同步
  const handleRemoveFile = useCallback((updatedFiles: File[]) => {
    if (pickupCode) {
      updateFileList(updatedFiles);
    }
  }, [pickupCode, updateFileList]);

  // 清空文件列表但保持房间连接
  const clearFiles = useCallback(() => {
    setSelectedFiles([]);
    if (pickupCode) {
      updateFileList([]);
      showToast('文件列表已清空，房间保持连接', 'success');
    }
  }, [pickupCode, updateFileList, showToast]);

  // 完全重置状态（关闭房间）
  const resetRoom = useCallback(() => {
    setSelectedFiles([]);
    setPickupCode('');
    setPickupLink('');
    setReceiverFiles([]);
    setRoomStatus(null);
    disconnect();
    showToast('已断开连接', 'info');
  }, [disconnect, showToast]);

  // 重置连接状态
  const resetConnectingState = useCallback(() => {
    if (isConnected && isConnecting) {
      setIsConnecting(false);
      console.log('WebSocket连接已建立，重置连接状态');
    }
  }, [isConnected, isConnecting]);

  return {
    // 状态
    selectedFiles,
    pickupCode,
    pickupLink,
    currentRole,
    receiverFiles,
    isConnecting,
    roomStatus,
    isConnected,
    websocket,
    
    // 状态更新函数
    setSelectedFiles,
    setReceiverFiles,
    setRoomStatus,
    setIsConnecting,
    setCurrentRole,
    resetConnectingState,
    
    // 房间操作
    generateCode,
    joinRoom,
    updateFileList,
    handleRemoveFile,
    clearFiles,
    resetRoom,
    
    // WebSocket 相关
    sendMessage,
    disconnect,
    connect
  };
};
