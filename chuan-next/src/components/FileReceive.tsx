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
  if (mimeType.startsWith('image/')) return <Image className="w-5 h-5 text-white" />;
  if (mimeType.startsWith('video/')) return <Video className="w-5 h-5 text-white" />;
  if (mimeType.startsWith('audio/')) return <Music className="w-5 h-5 text-white" />;
  if (mimeType.includes('zip') || mimeType.includes('rar')) return <Archive className="w-5 h-5 text-white" />;
  return <FileText className="w-5 h-5 text-white" />;
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
      <div className="space-y-4 sm:space-y-6">
        <div className="glass-card rounded-2xl p-4 sm:p-6 animate-fade-in-up">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                <Download className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-semibold text-slate-800">可下载文件</h3>
                <p className="text-slate-500 text-sm">
                  {isConnected ? (
                    <span className="text-emerald-600">✅ 已连接，可以下载文件</span>
                  ) : (
                    <span className="text-amber-600">⏳ 正在建立连接...</span>
                  )}
                </p>
              </div>
            </div>
            <div className="bg-gradient-to-r from-emerald-100 to-teal-100 px-3 sm:px-4 py-2 rounded-full self-start sm:self-center">
              <span className="text-emerald-700 font-medium text-sm">{files.length} 个文件</span>
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {files.map((file) => {
              const progress = transferProgresses.find(p => p.originalFileId === file.id);
              const isDownloading = progress && progress.status === 'downloading';
              const isCompleted = progress && progress.status === 'completed';
              
              return (
                <div key={file.id} className="bg-gradient-to-r from-slate-50 to-blue-50 border border-slate-200 rounded-xl p-3 sm:p-4 hover:shadow-md transition-all duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-3">
                    <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        {getFileIcon(file.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate text-sm sm:text-base">{file.name}</p>
                        <p className="text-sm text-slate-500">{formatFileSize(file.size)}</p>
                        {isCompleted && (
                          <p className="text-xs text-emerald-600 font-medium">✅ 下载完成</p>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => onDownloadFile(file.id)}
                      disabled={!isConnected || isDownloading || isCompleted}
                      className={`px-6 py-2 rounded-lg font-medium shadow-lg transition-all duration-200 hover:shadow-xl ${
                        isCompleted 
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                          : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white'
                      }`}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {isDownloading ? '下载中...' : isCompleted ? '已完成' : '下载'}
                    </Button>
                  </div>
                  
                  {progress && (progress.status === 'downloading' || progress.status === 'completed') && (
                    <div className="mt-3 space-y-2">
                      <div className="flex justify-between text-sm text-slate-600">
                        <span>{progress.status === 'completed' ? '下载完成' : '正在下载...'}</span>
                        <span className="font-medium">{progress.progress.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            progress.status === 'completed' 
                              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' 
                              : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                          }`}
                          style={{ width: `${progress.progress}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{formatFileSize(progress.receivedSize)} / {formatFileSize(progress.totalSize)}</span>
                        {progress.status === 'downloading' && (
                          <span>预计还需 {Math.ceil((progress.totalSize - progress.receivedSize) / 1024 / 1024)} MB</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 显示取件码输入界面  
  return (
    <div className="glass-card rounded-2xl p-4 sm:p-6 md:p-8 animate-fade-in-up">
      <div className="text-center mb-6 sm:mb-8">
        <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center animate-float">
          <Download className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
        </div>
        <h2 className="text-xl sm:text-2xl font-semibold text-slate-800 mb-2">输入取件码</h2>
        <p className="text-sm sm:text-base text-slate-600">请输入6位取件码来获取文件</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        <div className="space-y-3">
          <div className="relative">
            <Input
              value={pickupCode}
              onChange={handleInputChange}
              placeholder="请输入取件码"
              className="text-center text-2xl sm:text-3xl tracking-[0.3em] sm:tracking-[0.5em] font-mono h-12 sm:h-16 border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-emerald-500 bg-white/80 backdrop-blur-sm pb-2 sm:pb-4"
              maxLength={6}
              disabled={isConnecting}
            />
            <div className="absolute inset-x-0 -bottom-4 sm:-bottom-6 flex justify-center space-x-1 sm:space-x-2">
              {[...Array(6)].map((_, i) => (
                <div 
                  key={i} 
                  className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-all duration-200 ${
                    i < pickupCode.length 
                      ? 'bg-emerald-500' 
                      : 'bg-slate-300'
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="h-3 sm:h-4"></div>
          <p className="text-center text-xs sm:text-sm text-slate-500">
            {pickupCode.length}/6 位
          </p>
        </div>
        
        <Button 
          type="submit" 
          className="w-full h-10 sm:h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-base sm:text-lg font-medium rounded-xl shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:scale-100" 
          disabled={pickupCode.length !== 6 || isConnecting}
        >
          {isConnecting ? (
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>连接中...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Download className="w-5 h-5" />
              <span>开始接收</span>
            </div>
          )}
        </Button>
      </form>

      {/* 使用提示 */}
      <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
        <p className="text-sm text-slate-600 text-center">
          💡 <span className="font-medium">提示：</span>取件码由发送方提供，有效期为24小时
        </p>
      </div>
    </div>
  );
}
