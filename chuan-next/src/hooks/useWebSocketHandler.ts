import { useEffect } from 'react';
import { WebSocketMessage, FileInfo, RoomStatus } from '@/types';
import { useToast } from '@/components/ui/toast-simple';

interface UseWebSocketHandlerProps {
  currentRole: 'sender' | 'receiver';
  setReceiverFiles: (files: FileInfo[]) => void;
  setRoomStatus: (status: RoomStatus | null) => void;
  setIsConnecting: (connecting: boolean) => void;
  initFileTransfer: (fileInfo: any) => void;
  receiveFileChunk: (chunkData: any) => void;
  completeFileDownload: (fileId: string) => void;
  handleFileRequest: (payload: any) => Promise<void>;
}

export const useWebSocketHandler = ({
  currentRole,
  setReceiverFiles,
  setRoomStatus,
  setIsConnecting,
  initFileTransfer,
  receiveFileChunk,
  completeFileDownload,
  handleFileRequest
}: UseWebSocketHandlerProps) => {
  const { showToast } = useToast();

  useEffect(() => {
    const handleWebSocketMessage = (event: CustomEvent<WebSocketMessage>) => {
      const message = event.detail;
      console.log('收到WebSocket消息:', message.type, message);
      
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
            showToast('文件列表已更新，发现新文件！');
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
          
        case 'connected':
        case 'connection-established':
          console.log('WebSocket连接已建立');
          setIsConnecting(false);
          showToast('连接成功！', 'success');
          break;
          
        case 'text-content':
          console.log('处理text-content消息');
          // 文本内容由TextTransfer组件处理
          setIsConnecting(false);
          break;
          
        default:
          // 对于任何其他消息类型，也重置连接状态（说明连接已建立）
          console.log('收到消息，连接已建立，重置连接状态');
          setIsConnecting(false);
          break;
      }
    };

    window.addEventListener('websocket-message', handleWebSocketMessage as EventListener);
    return () => {
      window.removeEventListener('websocket-message', handleWebSocketMessage as EventListener);
    };
  }, [
    currentRole,
    setReceiverFiles,
    setRoomStatus,
    setIsConnecting,
    initFileTransfer,
    receiveFileChunk,
    completeFileDownload,
    handleFileRequest,
    showToast
  ]);
};
