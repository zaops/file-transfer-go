"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useWebRTCTransfer } from '@/hooks/useWebRTCTransfer';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast-simple';
import { Upload, Download } from 'lucide-react';
import { WebRTCFileUpload } from '@/components/webrtc/WebRTCFileUpload';
import { WebRTCFileReceive } from '@/components/webrtc/WebRTCFileReceive';

interface FileInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'ready' | 'downloading' | 'completed';
  progress: number;
}

export const WebRTCFileTransfer: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  
  // 独立的文件状态
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileList, setFileList] = useState<FileInfo[]>([]);
  const [downloadedFiles, setDownloadedFiles] = useState<Map<string, File>>(new Map());
  const [currentTransferFile, setCurrentTransferFile] = useState<{
    fileId: string;
    fileName: string;
    progress: number;
  } | null>(null);
  
  // 房间状态
  const [pickupCode, setPickupCode] = useState('');
  const [mode, setMode] = useState<'send' | 'receive'>('send');
  const [hasProcessedInitialUrl, setHasProcessedInitialUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const {
    isConnected,
    isConnecting,
    isWebSocketConnected,
    error,
    connect,
    disconnect,
    sendFile,
    sendFileList,
    requestFile: requestFileFromHook,
    onFileReceived,
    onFileListReceived,
    onFileRequested,
    onFileProgress
  } = useWebRTCTransfer();

  // 从URL参数中获取初始模式（仅在首次加载时处理）
  useEffect(() => {
    const urlMode = searchParams.get('mode') as 'send' | 'receive';
    const type = searchParams.get('type');
    const code = searchParams.get('code');
    
    // 只在首次加载且URL中有webrtc类型时处理
    if (!hasProcessedInitialUrl && type === 'webrtc' && urlMode && ['send', 'receive'].includes(urlMode)) {
      console.log('=== 处理初始URL参数 ===');
      console.log('URL模式:', urlMode, '类型:', type, '取件码:', code);
      
      setMode(urlMode);
      setHasProcessedInitialUrl(true);
      
      if (code && urlMode === 'receive') {
        // 自动加入房间，使用房间状态检查
        console.log('URL中有取件码，自动加入房间');
        joinRoom(code);
      }
    }
  }, [searchParams, hasProcessedInitialUrl]);

  // 更新URL参数
  const updateMode = useCallback((newMode: 'send' | 'receive') => {
    console.log('=== 手动切换模式 ===');
    console.log('新模式:', newMode);
    
    setMode(newMode);
    const params = new URLSearchParams(searchParams.toString());
    params.set('type', 'webrtc');
    params.set('mode', newMode);
    
    // 如果切换到发送模式，移除code参数
    if (newMode === 'send') {
      params.delete('code');
    }
    
    router.push(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  // 生成文件ID
  const generateFileId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  // 文件选择处理
  const handleFileSelect = (files: File[]) => {
    console.log('=== 文件选择 ===');
    console.log('新文件:', files.map(f => f.name));
    
    // 更新选中的文件
    setSelectedFiles(prev => [...prev, ...files]);
    
    // 创建对应的文件信息
    const newFileInfos: FileInfo[] = files.map(file => ({
      id: generateFileId(),
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'ready',
      progress: 0
    }));
    
    setFileList(prev => {
      const updatedList = [...prev, ...newFileInfos];
      console.log('更新后的文件列表:', updatedList);
      
      // 如果已连接，立即同步文件列表
      if (isConnected && pickupCode) {
        console.log('立即同步文件列表到对端');
        setTimeout(() => sendFileList(updatedList), 100);
      }
      
      return updatedList;
    });
  };

  // 创建房间 (发送模式)
  const generateCode = async () => {
    if (selectedFiles.length === 0) {
      showToast("需要选择文件才能创建传输房间", "error");
      return;
    }

    try {
      console.log('=== 创建房间 ===');
      console.log('选中文件数:', selectedFiles.length);
      
      // 创建后端房间
      const response = await fetch('/api/create-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: selectedFiles.map(file => ({
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
          }))
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '创建房间失败');
      }

      const code = data.code;
      setPickupCode(code);
      
      console.log('房间创建成功，取件码:', code);
      
      // 连接WebRTC作为发送方
      connect(code, 'sender');
      
      showToast(`房间创建成功，取件码: ${code}`, "success");
    } catch (error) {
      console.error('创建房间失败:', error);
      showToast(error instanceof Error ? error.message : '网络错误，请重试', "error");
    }
  };

  // 加入房间 (接收模式)
  const joinRoom = async (code: string) => {
    console.log('=== 加入房间 ===');
    console.log('取件码:', code);
    
    const trimmedCode = code.trim();
    
    // 检查取件码格式
    if (!trimmedCode || trimmedCode.length !== 6) {
      showToast('请输入正确的6位取件码', "error");
      return;
    }
    
    try {
      // 先检查房间状态
      console.log('检查房间状态...');
      showToast('正在检查房间状态...', "info");
      
      const response = await fetch(`/api/webrtc-room-status?code=${trimmedCode}`);
      const result = await response.json();
      
      if (!result.success) {
        showToast(result.message || '房间不存在或已过期', "error");
        return;
      }
      
      // 检查发送方是否在线
      if (!result.sender_online) {
        showToast('发送方不在线，请确认取件码是否正确', "error");
        return;
      }
      
      console.log('房间状态检查通过，开始连接...');
      setPickupCode(trimmedCode);
      connect(trimmedCode, 'receiver');
      
      showToast(`正在连接到房间: ${trimmedCode}`, "info");
    } catch (error) {
      console.error('检查房间状态失败:', error);
      showToast('检查房间状态失败，请重试', "error");
    }
  };

  // 重置连接状态 (用于连接失败后重新输入)
  const resetConnection = () => {
    console.log('=== 重置连接状态 ===');
    
    // 断开当前连接
    disconnect();
    
    // 清空状态
    setPickupCode('');
    setFileList([]);
    setDownloadedFiles(new Map());
    
    // 如果是接收模式，更新URL移除code参数
    if (mode === 'receive') {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('code');
      router.push(`?${params.toString()}`, { scroll: false });
    }
  };

  // 处理文件列表更新
  useEffect(() => {
    const cleanup = onFileListReceived((fileInfos: FileInfo[]) => {
      console.log('=== 收到文件列表更新 ===');
      console.log('文件列表:', fileInfos);
      console.log('当前模式:', mode);
      
      if (mode === 'receive') {
        setFileList(fileInfos);
      }
    });

    return cleanup;
  }, [onFileListReceived, mode]);

  // 处理连接错误
  useEffect(() => {
    if (error && mode === 'receive') {
      console.log('=== 连接错误处理 ===');
      console.log('错误信息:', error);
      
      // 显示错误提示
      showToast(`连接失败: ${error}`, "error");
    }
  }, [error, mode, showToast]);

  // 处理文件接收
  useEffect(() => {
    const cleanup = onFileReceived((fileData: { id: string; file: File }) => {
      console.log('=== 接收到文件 ===');
      console.log('文件:', fileData.file.name, 'ID:', fileData.id);
      
      // 更新下载的文件
      setDownloadedFiles(prev => new Map(prev.set(fileData.id, fileData.file)));
      
      // 更新文件状态
      setFileList(prev => prev.map(item => 
        item.id === fileData.id 
          ? { ...item, status: 'completed' as const, progress: 100 }
          : item
      ));
      
      showToast(`${fileData.file.name} 已准备好下载`, "success");
    });

    return cleanup;
  }, [onFileReceived, showToast]);

  // 监听文件级别的进度更新
  useEffect(() => {
    const cleanup = onFileProgress((progressInfo) => {
      console.log('=== 文件进度更新 ===');
      console.log('文件:', progressInfo.fileName, 'ID:', progressInfo.fileId, '进度:', progressInfo.progress);
      
      // 更新当前传输文件信息
      setCurrentTransferFile({
        fileId: progressInfo.fileId,
        fileName: progressInfo.fileName,
        progress: progressInfo.progress
      });
      
      // 更新文件列表中对应文件的进度
      setFileList(prev => prev.map(item => {
        if (item.id === progressInfo.fileId || item.name === progressInfo.fileName) {
          const newProgress = progressInfo.progress;
          const newStatus = newProgress >= 100 ? 'completed' as const : 'downloading' as const;
          
          console.log(`更新文件 ${item.name} 进度: ${item.progress} -> ${newProgress}`);
          return { ...item, progress: newProgress, status: newStatus };
        }
        return item;
      }));
      
      // 当传输完成时显示提示
      if (progressInfo.progress >= 100 && mode === 'send') {
        showToast(`文件发送完成: ${progressInfo.fileName}`, "success");
        setCurrentTransferFile(null);
      }
    });

    return cleanup;
  }, [onFileProgress, mode, showToast]);

  // 实时更新传输进度（旧逻辑 - 删除）
  // useEffect(() => {
  //   ...已删除的旧代码...
  // }, [...]);

  // 处理文件请求（发送方监听）
  useEffect(() => {
    const cleanup = onFileRequested((fileId: string, fileName: string) => {
      console.log('=== 收到文件请求 ===');
      console.log('文件:', fileName, 'ID:', fileId, '当前模式:', mode);
      
      if (mode === 'send') {
        console.log('当前选中的文件列表:', selectedFiles.map(f => f.name));
        
        // 在发送方的selectedFiles中查找对应文件
        const file = selectedFiles.find(f => f.name === fileName);
        
        if (!file) {
          console.error('找不到匹配的文件:', fileName);
          console.log('可用文件:', selectedFiles.map(f => `${f.name} (${f.size} bytes)`));
          showToast(`无法找到文件: ${fileName}`, "error");
          return;
        }
        
        console.log('找到匹配文件，开始发送:', file.name, 'ID:', fileId, '文件大小:', file.size);
        
        // 更新发送方文件状态为downloading
        setFileList(prev => prev.map(item => 
          item.id === fileId || item.name === fileName
            ? { ...item, status: 'downloading' as const, progress: 0 }
            : item
        ));
        
        // 发送文件
        sendFile(file, fileId);
        
        // 显示开始传输的提示
        showToast(`开始发送文件: ${fileName}`, "info");
      } else {
        console.warn('接收模式下收到文件请求，忽略');
      }
    });

    return cleanup;
  }, [onFileRequested, mode, selectedFiles, sendFile, showToast]);

  // 连接状态变化时同步文件列表
  useEffect(() => {
    console.log('=== 连接状态变化 ===');
    console.log('连接状态:', {
      isConnected,
      pickupCode,
      mode,
      selectedFilesCount: selectedFiles.length,
      fileListCount: fileList.length
    });
    
    if (isConnected && pickupCode && mode === 'send' && selectedFiles.length > 0) {
      // 确保有文件列表
      if (fileList.length === 0) {
        console.log('创建文件列表并发送...');
        const newFileInfos: FileInfo[] = selectedFiles.map(file => ({
          id: generateFileId(),
          name: file.name,
          size: file.size,
          type: file.type,
          status: 'ready',
          progress: 0
        }));
        setFileList(newFileInfos);
        // 延迟发送，确保数据通道已准备好
        setTimeout(() => {
          sendFileList(newFileInfos);
        }, 500);
      } else if (fileList.length > 0) {
        console.log('发送现有文件列表...');
        // 延迟发送，确保数据通道已准备好
        setTimeout(() => {
          sendFileList(fileList);
        }, 500);
      }
    }
  }, [isConnected, pickupCode, mode, selectedFiles.length]);

  // 请求下载文件（接收方调用）
  const requestFile = (fileId: string) => {
    if (mode !== 'receive') {
      console.error('requestFile只能在接收模式下调用');
      return;
    }

    const fileInfo = fileList.find(f => f.id === fileId);
    if (!fileInfo) {
      console.error('找不到文件信息:', fileId);
      return;
    }
    
    console.log('=== 开始请求文件 ===');
    console.log('文件信息:', { name: fileInfo.name, id: fileId, size: fileInfo.size });
    console.log('当前文件状态:', fileInfo.status);
    console.log('WebRTC连接状态:', { isConnected, isTransferring: !!currentTransferFile });
    
    // 更新文件状态为下载中
    setFileList(prev => {
      const updated = prev.map(item => 
        item.id === fileId 
          ? { ...item, status: 'downloading' as const, progress: 0 }
          : item
      );
      console.log('更新后的文件列表:', updated.find(f => f.id === fileId));
      return updated;
    });
    
    // 使用hook的requestFile功能
    console.log('调用hook的requestFile...');
    requestFileFromHook(fileId, fileInfo.name);
    
    showToast(`正在请求文件: ${fileInfo.name}`, "info");
  };

  // 复制取件码
  const copyCode = () => {
    navigator.clipboard.writeText(pickupCode);
    showToast("取件码已复制到剪贴板", "success");
  };

  // 复制链接
  const copyLink = () => {
    const link = `${window.location.origin}?type=webrtc&mode=receive&code=${pickupCode}`;
    navigator.clipboard.writeText(link);
    showToast("取件链接已复制到剪贴板", "success");
  };

  // 重置状态
  const resetRoom = () => {
    console.log('=== 重置房间 ===');
    disconnect();
    setPickupCode('');
    setSelectedFiles([]);
    setFileList([]);
    setDownloadedFiles(new Map());
  };

  // 添加更多文件
  const addMoreFiles = () => {
    fileInputRef.current?.click();
  };

  // 清空文件
  const clearFiles = () => {
    console.log('=== 清空文件 ===');
    setSelectedFiles([]);
    setFileList([]);
    if (isConnected && pickupCode) {
      sendFileList([]);
    }
  };

  // 下载文件到本地
  const downloadFile = (fileId: string) => {
    const file = downloadedFiles.get(fileId);
    if (!file) return;
    
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast(`${file.name} 已保存到下载文件夹`, "success");
  };

  // 处理下载请求（接收模式）
  const handleDownloadRequest = (fileId: string) => {
    const file = downloadedFiles.get(fileId);
    if (file) {
      // 文件已下载完成，保存到本地
      downloadFile(fileId);
    } else {
      // 文件未下载，请求传输
      requestFile(fileId);
    }
  };

  const pickupLink = pickupCode ? `${typeof window !== 'undefined' ? window.location.origin : ''}?type=webrtc&mode=receive&code=${pickupCode}` : '';

  // 显示错误信息
  useEffect(() => {
    if (error) {
      showToast(error, "error");
    }
  }, [error, showToast]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 模式切换 */}
      <div className="flex justify-center mb-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-1 shadow-lg">
          <Button
            variant={mode === 'send' ? 'default' : 'ghost'}
            onClick={() => updateMode('send')}
            className="px-6 py-2 rounded-lg"
          >
            <Upload className="w-4 h-4 mr-2" />
            发送文件
          </Button>
          <Button
            variant={mode === 'receive' ? 'default' : 'ghost'}
            onClick={() => updateMode('receive')}
            className="px-6 py-2 rounded-lg"
          >
            <Download className="w-4 h-4 mr-2" />
            接收文件
          </Button>
        </div>
      </div>

      {mode === 'send' ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 sm:p-6 shadow-lg border border-white/20 animate-fade-in-up">
          <WebRTCFileUpload
            selectedFiles={selectedFiles}
            fileList={fileList}
            onFilesChange={setSelectedFiles}
            onGenerateCode={generateCode}
            pickupCode={pickupCode}
            pickupLink={pickupLink}
            onCopyCode={copyCode}
            onCopyLink={copyLink}
            onAddMoreFiles={addMoreFiles}
            onRemoveFile={setSelectedFiles}
            onClearFiles={clearFiles}
            onReset={resetRoom}
            disabled={!!currentTransferFile}
            isConnected={isConnected}
            isWebSocketConnected={isWebSocketConnected}
          />
        </div>
      ) : (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 sm:p-6 shadow-lg border border-white/20 animate-fade-in-up">
          <WebRTCFileReceive
            onJoinRoom={joinRoom}
            files={fileList}
            onDownloadFile={handleDownloadRequest}
            isConnected={isConnected}
            isConnecting={isConnecting}
            isWebSocketConnected={isWebSocketConnected}
            downloadedFiles={downloadedFiles}
            error={error}
            onReset={resetConnection}
          />
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={(e) => handleFileSelect(Array.from(e.target.files || []))}
        className="hidden"
      />
    </div>
  );
};
