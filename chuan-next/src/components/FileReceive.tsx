"use client";

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Download, FileText, Image, Video, Music, Archive } from 'lucide-react';
import { FileInfo, TransferProgress } from '@/types';

interface FileReceiveProps {
  onJoinRoom: (code: string) => void;
  files: FileInfo[];
  onDownloadFile: (fileId: string) => void;
  transferProgresses: TransferProgress[];
  isConnected: boolean;
  isConnecting: boolean;
}

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return <Image className="w-5 h-5" />;
  if (mimeType.startsWith('video/')) return <Video className="w-5 h-5" />;
  if (mimeType.startsWith('audio/')) return <Music className="w-5 h-5" />;
  if (mimeType.includes('zip') || mimeType.includes('rar')) return <Archive className="w-5 h-5" />;
  return <FileText className="w-5 h-5" />;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export function FileReceive({
  onJoinRoom,
  files,
  onDownloadFile,
  transferProgresses,
  isConnected,
  isConnecting
}: FileReceiveProps) {
  const [pickupCode, setPickupCode] = useState('');

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (pickupCode.length === 6) {
      onJoinRoom(pickupCode.toUpperCase());
    }
  }, [pickupCode, onJoinRoom]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^A-Z0-9]/g, '').toUpperCase();
    if (value.length <= 6) {
      setPickupCode(value);
    }
  }, []);

  // 如果已经连接并且有文件列表，显示文件列表
  if (files.length > 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>可下载文件 ({files.length})</CardTitle>
            <CardDescription>
              {isConnected ? (
                <span className="text-green-600">✅ 已连接，可以下载文件</span>
              ) : (
                <span className="text-yellow-600">⏳ 正在建立连接...</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {files.map((file) => {
              const progress = transferProgresses.find(p => p.originalFileId === file.id);
              const isDownloading = progress && progress.status === 'downloading';
              
              console.log(`文件 ${file.id} 进度状态:`, progress, '是否下载中:', isDownloading);
              
              return (
                <div key={file.id} className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="text-muted-foreground">
                        {getFileIcon(file.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => onDownloadFile(file.id)}
                      disabled={!isConnected || isDownloading}
                      size="sm"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {isDownloading ? '下载中...' : '下载'}
                    </Button>
                  </div>
                  
                  {progress && progress.status === 'downloading' && (
                    <div className="px-3">
                      <div className="flex justify-between text-sm text-muted-foreground mb-1">
                        <span>正在下载...</span>
                        <span>{progress.progress.toFixed(1)}%</span>
                      </div>
                      <Progress value={progress.progress} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>{formatFileSize(progress.receivedSize)} / {formatFileSize(progress.totalSize)}</span>
                      </div>
                    </div>
                  )}
                  
                  {progress && (
                    <div className="px-3 text-xs text-muted-foreground">
                      调试：状态={progress.status}, 进度={progress.progress}%, 文件ID={progress.originalFileId}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    );
  }

  // 显示取件码输入界面  
  return (
    <Card>
      <CardHeader>
        <CardTitle>输入取件码</CardTitle>
        <CardDescription>
          请输入6位取件码来获取文件
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              value={pickupCode}
              onChange={handleInputChange}
              placeholder="输入6位取件码"
              className="text-center text-2xl tracking-wider font-mono"
              maxLength={6}
              disabled={isConnecting}
            />
            <p className="text-xs text-muted-foreground text-center">
              {pickupCode.length}/6 位
            </p>
          </div>
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={pickupCode.length !== 6 || isConnecting}
          >
            {isConnecting ? '连接中...' : '连接'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
