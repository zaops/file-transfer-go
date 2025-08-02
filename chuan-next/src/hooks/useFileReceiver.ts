import { useCallback } from 'react';
import { FileInfo, TransferProgress } from '@/types';
import { useToast } from '@/components/ui/toast-simple';

export const useFileReceiver = (
  receiverFiles: FileInfo[],
  transferProgresses: TransferProgress[],
  setTransferProgresses: (progresses: TransferProgress[] | ((prev: TransferProgress[]) => TransferProgress[])) => void,
  websocket: WebSocket | null,
  sendMessage: (message: any) => void
) => {
  const { showToast } = useToast();

  // 下载文件
  const downloadFile = useCallback((fileId: string) => {
    console.log('开始下载文件:', fileId);
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      showToast('连接未建立，请重试', 'error');
      return;
    }
    
    // 检查是否已有同文件的进行中传输
    const existingProgress = transferProgresses.find(p => p.originalFileId === fileId && p.status !== 'completed');
    if (existingProgress) {
      console.log('文件已在下载中，跳过重复请求:', fileId);
      showToast('文件正在下载中...', 'info');
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
  }, [websocket, sendMessage, receiverFiles, showToast, transferProgresses, setTransferProgresses]);

  return {
    downloadFile
  };
};
