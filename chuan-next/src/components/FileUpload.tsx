"use client";

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, Image, Video, Music, Archive, X } from 'lucide-react';

interface FileUploadProps {
  selectedFiles: File[];
  onFilesChange: (files: File[]) => void;
  onGenerateCode: () => void;
  pickupCode?: string;
  pickupLink?: string;
  onCopyCode?: () => void;
  onCopyLink?: () => void;
  onAddMoreFiles?: () => void;
  onRemoveFile?: (updatedFiles: File[]) => void;
  onReset?: () => void;
  disabled?: boolean;
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

export default function FileUpload({
  selectedFiles,
  onFilesChange,
  onGenerateCode,
  pickupCode,
  pickupLink,
  onCopyCode,
  onCopyLink,
  onAddMoreFiles,
  onRemoveFile,
  onReset,
  disabled = false,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFilesChange([...selectedFiles, ...files]);
    }
  }, [selectedFiles, onFilesChange]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesChange([...selectedFiles, ...files]);
    }
  }, [selectedFiles, onFilesChange]);

  const removeFile = useCallback((index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    onFilesChange(newFiles);
    // 如果已经生成了取件码，同步删除操作到接收端
    if (onRemoveFile) {
      onRemoveFile(newFiles);
    }
  }, [selectedFiles, onFilesChange, onRemoveFile]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  if (selectedFiles.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-8 animate-fade-in-up">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center animate-float">
            <Upload className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-semibold text-slate-800 mb-2">选择文件</h2>
          <p className="text-slate-600">拖拽文件到下方区域或点击选择文件</p>
        </div>
        
        <div
          className={`upload-area rounded-xl p-6 sm:p-8 md:p-12 text-center cursor-pointer ${
            isDragOver ? 'drag-active' : ''
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          <div className={`transition-all duration-300 ${isDragOver ? 'scale-110' : ''}`}>
            <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
              <Upload className={`w-8 h-8 sm:w-10 sm:h-10 transition-colors duration-300 ${
                isDragOver ? 'text-blue-600' : 'text-slate-400'
              }`} />
            </div>
            <div className="space-y-2">
              <p className="text-lg sm:text-xl font-medium text-slate-700">
                {isDragOver ? '释放文件' : '拖拽文件到这里'}
              </p>
              <p className="text-sm sm:text-base text-slate-500">
                或者 <span className="text-blue-600 font-medium underline">点击选择文件</span>
              </p>
              <p className="text-xs sm:text-sm text-slate-400 mt-4">
                支持多个文件同时上传，无大小限制
              </p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            disabled={disabled}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 文件列表 */}
      <div className="glass-card rounded-2xl p-4 sm:p-6 animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-slate-800">已选择文件</h3>
              <p className="text-slate-500 text-sm">{selectedFiles.length} 个文件准备传输</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-4 sm:mb-6">
          {selectedFiles.map((file, index) => (
            <div
              key={`${file.name}-${file.size}-${index}`}
              className="group flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-slate-50 to-blue-50 border border-slate-200 rounded-xl hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  {getFileIcon(file.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800 truncate text-sm sm:text-base">{file.name}</p>
                  <p className="text-xs sm:text-sm text-slate-500">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFile(index)}
                disabled={disabled}
                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200 flex-shrink-0 ml-2"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-col sm:flex-row gap-3">
          {!pickupCode && (
            <>
              <Button
                onClick={onGenerateCode}
                disabled={disabled || selectedFiles.length === 0}
                className="button-primary text-white px-6 sm:px-8 py-3 rounded-xl font-medium flex-1 min-w-0 shadow-lg"
              >
                <Upload className="w-5 h-5 mr-2" />
                生成取件码
              </Button>
              <Button
                onClick={onAddMoreFiles}
                variant="outline"
                disabled={disabled}
                className="px-6 sm:px-8 py-3 rounded-xl font-medium"
              >
                添加文件
              </Button>
              <Button
                onClick={onReset}
                variant="outline"
                disabled={disabled}
                className="text-red-600 hover:bg-red-50 px-6 sm:px-8 py-3 rounded-xl font-medium"
              >
                重新选择
              </Button>
            </>
          )}
          
          {pickupCode && (
            <Button
              variant="outline"
              onClick={onAddMoreFiles}
              disabled={disabled}
              className="px-6 py-3 rounded-xl border-slate-300 text-slate-600 hover:bg-slate-50 flex-1"
            >
              添加更多文件
            </Button>
          )}
          
          <Button
            variant="outline"
            onClick={onReset}
            disabled={disabled}
            className="px-6 py-3 rounded-xl border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            重置
          </Button>
        </div>
      </div>

      {/* 取件码展示 */}
      {pickupCode && (
        <div className="glass-card rounded-2xl p-4 sm:p-6 md:p-8 animate-fade-in-up">
          <div className="text-center mb-4 sm:mb-6">
            <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center animate-float">
              <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-2">
              取件码生成成功！
            </h3>
            <p className="text-sm sm:text-base text-slate-600">分享以下信息给接收方</p>
          </div>

          <div className="space-y-4 sm:space-y-6">
            {/* 取件码 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">取件码</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 code-display rounded-xl p-4 sm:p-6 text-center">
                  <div className="text-2xl sm:text-3xl font-bold font-mono bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent tracking-wider">
                    {pickupCode}
                  </div>
                </div>
                <Button
                  onClick={onCopyCode}
                  className="px-4 sm:px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium shadow-lg transition-all duration-200 hover:shadow-xl w-full sm:w-auto"
                >
                  复制
                </Button>
              </div>
            </div>

            {/* 取件链接 */}
            {pickupLink && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">取件链接</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 code-display rounded-xl p-3 sm:p-4">
                    <div className="text-xs sm:text-sm text-slate-700 break-all font-mono">
                      {pickupLink}
                    </div>
                  </div>
                  <Button
                    onClick={onCopyLink}
                    className="px-4 sm:px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium shadow-lg transition-all duration-200 hover:shadow-xl w-full sm:w-auto"
                  >
                    复制
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* 使用提示 */}
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
            <p className="text-xs sm:text-sm text-slate-600 text-center">
              💡 <span className="font-medium">使用提示：</span>接收方输入取件码或访问取件链接即可下载文件
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
