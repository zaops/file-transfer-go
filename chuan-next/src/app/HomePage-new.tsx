"use client";

import React, { useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, MessageSquare, Monitor } from 'lucide-react';
import Hero from '@/components/Hero';
import FileTransfer from '@/components/FileTransfer';
import TextTransfer from '@/components/TextTransfer';
import DesktopShare from '@/components/DesktopShare';
import { RoomStatusDisplay } from '@/components/RoomStatusDisplay';
import { TabSwitchDialog } from '@/components/TabSwitchDialog';

// Hooks
import { useFileTransfer } from '@/hooks/useFileTransfer';
import { useRoomManager } from '@/hooks/useRoomManager';
import { useFileSender } from '@/hooks/useFileSender';
import { useFileReceiver } from '@/hooks/useFileReceiver';
import { useWebSocketHandler } from '@/hooks/useWebSocketHandler';
import { useTabManager } from '@/hooks/useTabManager';
import { useUtilities } from '@/hooks/useUtilities';
import { useUrlHandler } from '@/hooks/useUrlHandler';

export default function HomePage() {
  // 文件传输相关
  const {
    fileTransfers,
    transferProgresses,
    initFileTransfer,
    receiveFileChunk,
    completeFileDownload,
    clearTransfers,
    setTransferProgresses
  } = useFileTransfer();

  // 房间管理相关
  const {
    selectedFiles,
    pickupCode,
    pickupLink,
    currentRole,
    receiverFiles,
    isConnecting,
    roomStatus,
    isConnected,
    websocket,
    setSelectedFiles,
    setReceiverFiles,
    setRoomStatus,
    setIsConnecting,
    setCurrentRole,
    resetConnectingState,
    generateCode,
    joinRoom,
    updateFileList,
    handleRemoveFile,
    clearFiles,
    resetRoom,
    sendMessage,
    disconnect,
    connect
  } = useRoomManager();

  // Tab管理相关
  const {
    activeTab,
    showConfirmDialog,
    setShowConfirmDialog,
    handleTabChange,
    confirmTabSwitch,
    cancelTabSwitch,
    getModeDescription,
    updateUrlParams
  } = useTabManager(isConnected, pickupCode, isConnecting);

  // 工具函数
  const { copyToClipboard, showNotification } = useUtilities();

  // 文件发送处理
  const { handleFileRequest } = useFileSender(selectedFiles, sendMessage);

  // 文件接收处理
  const { downloadFile } = useFileReceiver(
    receiverFiles,
    transferProgresses,
    setTransferProgresses,
    websocket,
    sendMessage
  );

  // WebSocket连接状态变化处理
  useEffect(() => {
    resetConnectingState();
  }, [resetConnectingState]);

  // 额外的连接状态重置逻辑
  useEffect(() => {
    if (isConnected) {
      setIsConnecting(false);
      console.log('WebSocket已连接，重置连接中状态');
    }
  }, [isConnected, setIsConnecting]);

  // 监听WebSocket错误事件
  useEffect(() => {
    const handleWebSocketError = (event: CustomEvent) => {
      console.error('WebSocket连接错误:', event.detail);
      setIsConnecting(false);
      showNotification('连接失败，请检查网络或重试', 'error');
    };

    const handleWebSocketConnected = (event: CustomEvent) => {
      console.log('WebSocket连接成功:', event.detail);
      setIsConnecting(false);
      showNotification('连接成功！', 'success');
    };

    window.addEventListener('websocket-error', handleWebSocketError as EventListener);
    window.addEventListener('websocket-connected', handleWebSocketConnected as EventListener);
    
    return () => {
      window.removeEventListener('websocket-error', handleWebSocketError as EventListener);
      window.removeEventListener('websocket-connected', handleWebSocketConnected as EventListener);
    };
  }, [setIsConnecting, showNotification]);

  // WebSocket消息处理
  useWebSocketHandler({
    currentRole,
    setReceiverFiles,
    setRoomStatus,
    setIsConnecting,
    initFileTransfer,
    receiveFileChunk,
    completeFileDownload,
    handleFileRequest
  });

  // URL参数处理
  useUrlHandler({
    isConnected,
    pickupCode,
    setCurrentRole,
    joinRoom
  });

  // 处理添加更多文件
  const handleAddMoreFiles = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      const newFiles = [...selectedFiles, ...files];
      setSelectedFiles(newFiles);
      
      if (pickupCode && files.length > 0) {
        updateFileList(newFiles);
      }
    };
    input.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Hero Section */}
      <div className="relative min-h-screen">
        {/* Background decorations */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-indigo-600/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative container mx-auto px-4 sm:px-6 py-8 max-w-6xl">
          <Hero />

          <div className="max-w-4xl mx-auto">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-white/80 backdrop-blur-sm border-0 shadow-lg h-12 sm:h-14 p-1 mb-6">
                <TabsTrigger 
                  value="file" 
                  className="flex items-center justify-center space-x-2 text-sm sm:text-base font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
                >
                  <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">传文件</span>
                  <span className="sm:hidden">文件</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="text" 
                  className="flex items-center justify-center space-x-2 text-sm sm:text-base font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
                >
                  <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">传文字</span>
                  <span className="sm:hidden">文字</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="desktop" 
                  className="flex items-center justify-center space-x-2 text-sm sm:text-base font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
                >
                  <Monitor className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">共享桌面</span>
                  <span className="sm:hidden">桌面</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="file" className="mt-6 animate-fade-in-up">
                <FileTransfer
                  selectedFiles={selectedFiles}
                  onFilesChange={setSelectedFiles}
                  onGenerateCode={generateCode}
                  pickupCode={pickupCode}
                  pickupLink={pickupLink}
                  onCopyCode={() => copyToClipboard(pickupCode, '取件码已复制到剪贴板！')}
                  onCopyLink={() => copyToClipboard(pickupLink, '取件链接已复制到剪贴板！')}
                  onAddMoreFiles={handleAddMoreFiles}
                  onRemoveFile={handleRemoveFile}
                  onClearFiles={clearFiles}
                  onReset={resetRoom}
                  onJoinRoom={joinRoom}
                  receiverFiles={receiverFiles}
                  onDownloadFile={downloadFile}
                  transferProgresses={transferProgresses}
                  isConnected={isConnected}
                  isConnecting={isConnecting}
                  disabled={isConnecting}
                />
                
                <RoomStatusDisplay roomStatus={roomStatus} currentRole={currentRole} />
              </TabsContent>

              <TabsContent value="text" className="mt-6 animate-fade-in-up">
                <TextTransfer
                  onSendText={async (text: string) => {
                    try {
                      const response = await fetch('/api/create-text-room', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ text }),
                      });

                      const data = await response.json();
                      
                      if (!response.ok) {
                        const errorMessage = data.error || '创建文字传输房间失败';
                        showNotification(errorMessage, 'error');
                        return '';
                      }

                      return data.code;
                    } catch (error) {
                      console.error('创建文字传输房间失败:', error);
                      showNotification('网络错误，请重试', 'error');
                      return '';
                    }
                  }}
                  onReceiveText={async (code: string) => {
                    console.log('onReceiveText被调用，但文字内容将通过WebSocket获取:', code);
                    return '';
                  }}
                  websocket={websocket}
                  isConnected={isConnected}
                  currentRole={currentRole}
                  onCreateWebSocket={(code: string, role: 'sender' | 'receiver') => {
                    if (websocket) {
                      disconnect();
                    }
                    connect(code, role);
                  }}
                />
              </TabsContent>

              <TabsContent value="desktop" className="mt-6 animate-fade-in-up">
                <DesktopShare
                  onStartSharing={async () => {
                    showNotification('桌面共享功能开发中', 'info');
                    return 'DEF456';
                  }}
                  onStopSharing={async () => {
                    showNotification('桌面共享已停止', 'info');
                  }}
                  onJoinSharing={async (code: string) => {
                    showNotification('桌面共享功能开发中', 'info');
                  }}
                />
              </TabsContent>
            </Tabs>
          </div>
          
          <div className="h-8 sm:h-16"></div>
        </div>
      </div>

      {/* 确认对话框 */}
      <TabSwitchDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={confirmTabSwitch}
        onCancel={cancelTabSwitch}
        description={getModeDescription()}
      />
    </div>
  );
}
