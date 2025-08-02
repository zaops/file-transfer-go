import { useCallback } from 'react';
import { useToast } from '@/components/ui/toast-simple';

export const useFileSender = (selectedFiles: File[], sendMessage: (message: any) => void) => {
  const { showToast } = useToast();

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
    showToast(`开始发送文件: ${file.name}`);
    
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
        showToast(`文件发送完成: ${file.name}`);
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
  }, [selectedFiles, sendMessage, showToast]);

  return {
    handleFileRequest
  };
};
