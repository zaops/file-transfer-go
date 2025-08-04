import { useState, useCallback } from 'react';
import { TransferProgress } from '@/types';
import { useToast } from '@/components/ui/toast-simple';

interface FileTransferData {
  fileId: string;
  chunks: Array<{ offset: number; data: Uint8Array }>;
  totalSize: number;
  receivedSize: number;
  fileName: string;
  mimeType: string;
  startTime: number;
}

export const useFileTransfer = () => {
  const [fileTransfers, setFileTransfers] = useState<Map<string, FileTransferData>>(new Map());
  const [completedDownloads, setCompletedDownloads] = useState<Set<string>>(new Set());
  const [transferProgresses, setTransferProgresses] = useState<TransferProgress[]>([]);
  const { showToast } = useToast();

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
    showToast(`文件 "${transfer.fileName}" 下载完成！传输速度: ${speed} MB/s`);
  }, [showToast]);

  // 接收文件数据块
  const receiveFileChunk = useCallback((chunkData: any) => {
    console.log('接收文件数据块:', chunkData);
    const transferKey = chunkData.file_id;
    
    setFileTransfers(prev => {
      const newMap = new Map(prev);
      const transfer = newMap.get(transferKey);
      
      if (transfer) {
        // 检查是否已经完成，如果已经完成就不再处理新的数据块
        if (transfer.receivedSize >= transfer.totalSize) {
          console.log('文件已完成，忽略额外的数据块');
          return newMap;
        }

        const chunkArray = new Uint8Array(chunkData.data);
        transfer.chunks.push({
          offset: chunkData.offset,
          data: chunkArray
        });
        transfer.receivedSize += chunkArray.length;
        
        // 确保不超过总大小
        if (transfer.receivedSize > transfer.totalSize) {
          transfer.receivedSize = transfer.totalSize;
        }
        
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
          console.log('文件接收完成，准备下载');
          // 标记为完成，等待 file-complete 消息统一处理下载
          setTransferProgresses(prev => 
            prev.map(p => p.fileId === transferKey 
              ? { ...p, status: 'completed' as const, progress: 100, receivedSize: transfer.totalSize }
              : p
            )
          );
        }
      } else {
        console.warn('未找到对应的文件传输:', transferKey);
      }
      
      return newMap;
    });
  }, []);

  // 完成文件下载
  const completeFileDownload = useCallback((fileId: string) => {
    console.log('文件传输完成，开始下载:', fileId);
    
    // 检查是否已经完成过下载
    if (completedDownloads.has(fileId)) {
      console.log('文件已经下载过，跳过重复下载:', fileId);
      return;
    }
    
    // 标记为已完成
    setCompletedDownloads(prev => new Set([...prev, fileId]));
    
    // 查找对应的文件传输数据
    const transfer = fileTransfers.get(fileId);
    if (transfer) {
      assembleAndDownloadFile(fileId, transfer);
      
      // 清理传输进度，移除已完成的文件进度显示
      setTimeout(() => {
        setTransferProgresses(prev => 
          prev.filter(p => p.fileId !== fileId)
        );
      }, 2000); // 2秒后清理，让用户看到完成状态
    } else {
      console.warn('未找到文件传输数据:', fileId);
    }
  }, [fileTransfers, assembleAndDownloadFile, completedDownloads]);

  // 清理传输状态
  const clearTransfers = useCallback(() => {
    setFileTransfers(new Map());
    setCompletedDownloads(new Set());
    setTransferProgresses([]);
  }, []);

  return {
    fileTransfers,
    transferProgresses,
    initFileTransfer,
    receiveFileChunk,
    completeFileDownload,
    clearTransfers,
    setTransferProgresses
  };
};
