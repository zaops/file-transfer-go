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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="w-5 h-5" />
            <span>选择文件</span>
          </CardTitle>
          <CardDescription>
            选择要发送的文件，支持拖拽上传
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">拖拽文件到这里或点击选择</p>
            <p className="text-sm text-muted-foreground">
              支持多个文件同时上传
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              disabled={disabled}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="w-5 h-5" />
            <span>已选择文件 ({selectedFiles.length})</span>
          </CardTitle>
          <CardDescription>
            文件列表，点击生成取件码开始传输
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedFiles.map((file, index) => (
            <div
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                {getFileIcon(file.type)}
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFile(index)}
                disabled={disabled}
                className="text-destructive hover:text-destructive"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}

          <div className="flex flex-wrap gap-2 pt-4">
            {!pickupCode && (
              <>
                <Button
                  onClick={onGenerateCode}
                  disabled={disabled || selectedFiles.length === 0}
                  className="flex-1 min-w-[120px]"
                >
                  生成取件码
                </Button>
                <Button
                  variant="outline"
                  onClick={onAddMoreFiles}
                  disabled={disabled}
                >
                  添加更多文件
                </Button>
              </>
            )}
            
            {pickupCode && (
              <Button
                variant="outline"
                onClick={onAddMoreFiles}
                disabled={disabled}
                className="flex-1"
              >
                添加更多文件
              </Button>
            )}
            
            <Button
              variant="outline"
              onClick={onReset}
              disabled={disabled}
            >
              重置
            </Button>
          </div>
        </CardContent>
      </Card>

      {pickupCode && (
        <Card>
          <CardHeader>
            <CardTitle>取件码生成成功</CardTitle>
            <CardDescription>
              分享以下信息给接收方
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">取件码</label>
              <div className="flex space-x-2 mt-1">
                <div className="flex-1 p-3 bg-muted rounded-lg font-mono text-lg text-center">
                  {pickupCode}
                </div>
                <Button
                  variant="outline"
                  onClick={onCopyCode}
                  size="sm"
                >
                  复制
                </Button>
              </div>
            </div>

            {pickupLink && (
              <div>
                <label className="text-sm font-medium">取件链接</label>
                <div className="flex space-x-2 mt-1">
                  <div className="flex-1 p-3 bg-muted rounded-lg text-sm break-all">
                    {pickupLink}
                  </div>
                  <Button
                    variant="outline"
                    onClick={onCopyLink}
                    size="sm"
                  >
                    复制
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
