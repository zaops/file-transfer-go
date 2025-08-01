"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Upload, Download } from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import { FileReceive } from '@/components/FileReceive';
import { FileInfo, TransferProgress } from '@/types';

interface FileTransferProps {
  // 发送方相关
  selectedFiles: File[];
  onFilesChange: (files: File[]) => void;
  onGenerateCode: () => void;
  pickupCode: string;
  pickupLink: string;
  onCopyCode: () => void;
  onCopyLink: () => void;
  onAddMoreFiles: () => void;
  onRemoveFile: (updatedFiles: File[]) => void;
  onClearFiles?: () => void;
  onReset: () => void;
  
  // 接收方相关
  onJoinRoom: (code: string) => void;
  receiverFiles: FileInfo[];
  onDownloadFile: (fileId: string) => void;
  transferProgresses: TransferProgress[];
  
  // 通用状态
  isConnected: boolean;
  isConnecting: boolean;
  disabled?: boolean;
}

export default function FileTransfer({
  selectedFiles,
  onFilesChange,
  onGenerateCode,
  pickupCode,
  pickupLink,
  onCopyCode,
  onCopyLink,
  onAddMoreFiles,
  onRemoveFile,
  onClearFiles,
  onReset,
  onJoinRoom,
  receiverFiles,
  onDownloadFile,
  transferProgresses,
  isConnected,
  isConnecting,
  disabled = false
}: FileTransferProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<'send' | 'receive'>('send');

  // 从URL参数中获取初始模式
  useEffect(() => {
    const urlMode = searchParams.get('mode') as 'send' | 'receive';
    const type = searchParams.get('type');
    
    if (type === 'file' && urlMode && ['send', 'receive'].includes(urlMode)) {
      setMode(urlMode);
    }
  }, [searchParams]);

  // 更新URL参数
  const updateMode = useCallback((newMode: 'send' | 'receive') => {
    setMode(newMode);
    const params = new URLSearchParams(searchParams.toString());
    params.set('type', 'file');
    params.set('mode', newMode);
    router.push(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

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
        <div className="animate-fade-in-up">
          <FileUpload
            selectedFiles={selectedFiles}
            onFilesChange={onFilesChange}
            onGenerateCode={onGenerateCode}
            pickupCode={pickupCode}
            pickupLink={pickupLink}
            onCopyCode={onCopyCode}
            onCopyLink={onCopyLink}
            onAddMoreFiles={onAddMoreFiles}
            onRemoveFile={onRemoveFile}
            onClearFiles={onClearFiles}
            onReset={onReset}
            disabled={disabled}
          />
        </div>
      ) : (
        <div className="animate-fade-in-up">
          <FileReceive
            onJoinRoom={onJoinRoom}
            files={receiverFiles}
            onDownloadFile={onDownloadFile}
            transferProgresses={transferProgresses}
            isConnected={isConnected}
            isConnecting={isConnecting}
          />
        </div>
      )}
    </div>
  );
}
